/**
 * Dry-run: list return policies from eBay Account API and attempt upgrade
 * for All About Mercedes (or STORE_ID env).
 */
import pg from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const authBase = (process.env.SELLERPUNDIT_API_BASE_URL || 'https://authentication.sellerpundit.com/api/v1').replace(/\/$/, '');
const mpBase = (process.env.SELLERPUNDIT_MARKETPLACES_URL || 'https://marketplaces.sellerpundit.com').replace(/\/$/, '');
const ebayApi = (process.env.EBAY_API_BASE_URL || 'https://api.ebay.com').replace(/\/$/, '');
const marketplaceId = 'EBAY_MOTORS_US';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const c = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
await c.connect();
const storeRes = await c.query(`
  SELECT s.id, s.store_name, cea.id as account_id, cea.sellerpundit_token_id
  FROM stores s
  JOIN connected_ebay_accounts cea ON cea.primary_store_id = s.id
  WHERE cea.sellerpundit_account_name = 'All About Mercedes'
  LIMIT 1
`);
const store = storeRes.rows[0];
if (!store) throw new Error('Store not found');
console.log('Store', store);

const login = await axios.post(`${authBase}/auth/login`, {
  email: process.env.SELLERPUNDIT_EMAIL,
  password: process.env.SELLERPUNDIT_PASSWORD,
});
const jwt = login.data?.token || login.data?.accessToken || login.data?.data?.token;

const tokensRes = await axios.get(`${mpBase}/token/get-all-tokens`, {
  headers: { Authorization: `Bearer ${jwt}` },
});
const tokens = Array.isArray(tokensRes.data)
  ? tokensRes.data
  : tokensRes.data?.data ?? [];
const match = tokens.find((t) => (t.id ?? t.tokenId) === store.sellerpundit_token_id);
const spToken = (match?.token ?? match?.accessToken ?? '').trim();
if (!spToken) {
  console.log('token row', match);
  throw new Error('No SP access token from get-all-tokens');
}

try {
  const inv = await axios.get(`${ebayApi}/sell/inventory/v1/inventory_item?limit=1`, {
    headers: { Authorization: `Bearer ${spToken}`, 'X-EBAY-C-MARKETPLACE-ID': marketplaceId },
  });
  console.log('Inventory API OK, items', inv.data?.total ?? inv.data?.inventoryItems?.length);
} catch (e) {
  console.log('Inventory API', e.response?.status, e.response?.data?.errors?.[0]?.message ?? e.message);
}

const listRes = await axios.get(`${ebayApi}/sell/account/v1/return_policy`, {
  headers: {
    Authorization: `Bearer ${spToken}`,
    'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
  },
  params: { marketplace_id: marketplaceId },
});
const policies = listRes.data?.returnPolicies ?? [];
console.log('=== eBay Account API return policies ===');
for (const p of policies) {
  console.log({
    id: p.returnPolicyId,
    name: p.name,
    returnsAccepted: p.returnsAccepted,
    returnPeriod: p.returnPeriod,
    returnShippingCostPayer: p.returnShippingCostPayer,
    categoryTypes: p.categoryTypes?.map((c) => c.name),
  });
}

const target = policies.find((p) => p.returnPolicyId === '410665876022');
if (!target) {
  console.log('Policy 410665876022 not in Account API list');
  await c.end();
  process.exit(0);
}

const body = {
  name: target.name,
  marketplaceId,
  categoryTypes: target.categoryTypes,
  returnsAccepted: true,
  returnPeriod: { value: 30, unit: 'DAY' },
  returnShippingCostPayer: 'SELLER',
  refundMethod: target.refundMethod ?? 'MONEY_BACK',
  returnMethod: target.returnMethod ?? 'MERCHANT_RETURN',
};
console.log('Upgrade body', body);
if (DRY_RUN) {
  console.log('DRY_RUN=true — skip PUT');
} else {
  try {
    await axios.put(`${ebayApi}/sell/account/v1/return_policy/410665876022`, body, {
      headers: {
        Authorization: `Bearer ${spToken}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        'Content-Type': 'application/json',
      },
    });
    console.log('UPGRADE OK');
  } catch (e) {
    console.error('UPGRADE FAILED', e.response?.status, e.response?.data ?? e.message);
  }
}
await c.end();
