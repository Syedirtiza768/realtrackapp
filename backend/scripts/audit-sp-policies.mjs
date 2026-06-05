import pg from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const authBase = (process.env.SELLERPUNDIT_API_BASE_URL || 'https://authentication.sellerpundit.com/api/v1').replace(/\/$/, '');
const mpBase = (process.env.SELLERPUNDIT_MARKETPLACES_URL || 'https://marketplaces.sellerpundit.com').replace(/\/$/, '');

function unwrapArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.policies)) return raw.policies;
  }
  return [];
}

function compliance(raw) {
  const d = raw?.policy_details ?? raw?.policyDetails ?? {};
  const period = d.returnPeriod ?? raw.returnPeriod;
  const payer = d.returnShippingCostPayer ?? raw.returnShippingCostPayer;
  const accepted = d.returnsAccepted ?? raw.returnsAccepted;
  const days = period?.value != null ? Number(period.value) : null;
  const ok =
    accepted !== false &&
    days != null &&
    days >= 30 &&
    payer &&
    String(payer).toUpperCase().includes('SELLER');
  return { days, payer, accepted, paCompliant: !!ok };
}

const login = await axios.post(`${authBase}/auth/login`, {
  email: process.env.SELLERPUNDIT_EMAIL,
  password: process.env.SELLERPUNDIT_PASSWORD,
}, { timeout: 30000 });
const jwt = login.data?.token || login.data?.accessToken || login.data?.data?.token;

const tokensRes = await axios.get(`${mpBase}/token/get-all-tokens`, {
  headers: { Authorization: `Bearer ${jwt}` },
});
const tokens = unwrapArray(tokensRes.data);

const audit = [];
for (const t of tokens) {
  const accountName = t.accountName || t.account_name;
  if (!accountName) continue;
  const retRes = await axios.get(`${mpBase}/master/get-all-policies`, {
    params: { accountName, policyType: 'return' },
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const returns = unwrapArray(retRes.data);
  audit.push({
    accountName,
    marketplaceId: t.marketplaceId ?? t.marketPlaceId,
    tokenId: t.id ?? t.tokenId,
    returnPolicies: returns.map((r) => {
      const d = r.policy_details ?? r.policyDetails ?? {};
      const ebayId = d.returnPolicyId ?? r.returnPolicyId;
      return {
        spInternalId: r.id,
        ebayReturnPolicyId: ebayId,
        name: r.name,
        geoSite: r.geoSite ?? d.marketplaceId,
        ...compliance(r),
      };
    }),
    hasPaCompliantReturn: returns.some((r) => compliance(r).paCompliant),
  });
}

console.log('=== LIVE SELLERPUNDIT RETURN POLICY AUDIT ===');
console.log(JSON.stringify(audit, null, 2));

const c = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
await c.connect();
const db = await c.query(`
  SELECT s.store_name, cea.sellerpundit_account_name, eam.marketplace_id,
         eam.default_fulfillment_policy_id, eam.default_payment_policy_id,
         eam.default_return_policy_id
  FROM stores s
  JOIN connected_ebay_accounts cea ON cea.primary_store_id = s.id
  LEFT JOIN ebay_account_marketplaces eam ON eam.ebay_account_id = cea.id
  WHERE cea.connection_source = 'sellerpundit'
  ORDER BY s.store_name
`);
console.log('=== DB DEFAULT POLICIES ===');
console.log(JSON.stringify(db.rows, null, 2));
await c.end();
