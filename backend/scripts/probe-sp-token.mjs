// SellerPundit token row vs eBay API acceptance (inventory probe — identity often 404 without scope).
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const tokenId = Number(process.argv[2] ?? 447);
const marketplaceId = process.argv[3] ?? 'EBAY_DE';

const authBase = (process.env.SELLERPUNDIT_API_BASE_URL || 'https://authentication.sellerpundit.com/api/v1').replace(/\/$/, '');
const mpBase = (process.env.SELLERPUNDIT_MARKETPLACES_URL || 'https://marketplaces.sellerpundit.com').replace(/\/$/, '');
const ebayApi = (process.env.EBAY_ENVIRONMENT || 'PRODUCTION').toUpperCase() === 'SANDBOX'
  ? 'https://api.sandbox.ebay.com'
  : 'https://api.ebay.com';

const login = await axios.post(`${authBase}/auth/login`, {
  email: process.env.SELLERPUNDIT_EMAIL,
  password: process.env.SELLERPUNDIT_PASSWORD,
});
const jwt = login.data?.token || login.data?.accessToken || login.data?.data?.token;

const tokensRes = await axios.get(`${mpBase}/token/get-all-tokens`, {
  headers: { Authorization: `Bearer ${jwt}` },
});
const tokens = Array.isArray(tokensRes.data) ? tokensRes.data : tokensRes.data?.data ?? [];
const row = tokens.find((t) => (t.id ?? t.tokenId) === tokenId);
if (!row) {
  console.error('Token id not found:', tokenId);
  process.exit(1);
}

const spToken = (row.token ?? row.accessToken ?? '').trim();
console.log('=== SellerPundit token row (redacted) ===');
console.log({
  id: row.id,
  accountName: row.accountName,
  marketPlaceId: row.marketPlaceId ?? row.marketplaceId,
  status: row.status,
  sellerId: row.sellerId,
  expiresIn: row.expiresIn,
  lastTokenRefreshDate: row.lastTokenRefreshDate,
  tokenLength: spToken.length,
  tokenPrefix: spToken.slice(0, 12) + '...',
  hasRefreshToken: !!(row.refreshToken?.trim()),
});

const ebayHeaders = {
  Authorization: `Bearer ${spToken}`,
  'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
};

for (const [label, url] of [
  ['inventory', `${ebayApi}/sell/inventory/v1/inventory_item?limit=1`],
  ['account_return', `${ebayApi}/sell/account/v1/return_policy?marketplace_id=${marketplaceId}`],
]) {
  try {
    const r = await axios.get(url, { headers: ebayHeaders, timeout: 20000 });
    console.log(`eBay ${label}: OK`, r.status);
  } catch (e) {
    const status = e.response?.status;
    const err = e.response?.data?.errors?.[0] ?? e.response?.data;
    console.log(`eBay ${label}: FAIL`, status, JSON.stringify(err));
  }
}

// SellerPundit bulk-create probe (minimal body)
try {
  const body = {
    accountName: row.accountName,
    marketplaceId: row.marketPlaceId ?? row.marketplaceId,
    marketPlaceId: row.marketPlaceId ?? row.marketplaceId,
    tokenId: row.id,
    cskuData: [],
  };
  const r = await axios.post(`${mpBase}/inventory/bulk-create-using-api`, body, {
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    timeout: 60000,
  });
  console.log('SP bulk-create empty:', r.status, JSON.stringify(r.data).slice(0, 300));
} catch (e) {
  console.log('SP bulk-create empty: FAIL', e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 400));
}

const refreshToken = (row.refreshToken ?? '').trim();
if (refreshToken) {
  const clientId = process.env.EBAY_CLIENT_ID ?? '';
  const clientSecret = process.env.EBAY_CLIENT_SECRET ?? '';
  if (clientId && clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    try {
      const r = await axios.post(
        `${ebayApi}/identity/v1/oauth2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: [
            'https://api.ebay.com/oauth/api_scope',
            'https://api.ebay.com/oauth/api_scope/sell.inventory',
            'https://api.ebay.com/oauth/api_scope/sell.account',
          ].join(' '),
        }).toString(),
        {
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 20000,
        },
      );
      console.log('eBay refresh_token via RealTrack client: OK', r.data?.expires_in);
      const newToken = r.data?.access_token;
      if (newToken) {
        try {
          await axios.get(`${ebayApi}/sell/inventory/v1/inventory_item?limit=1`, {
            headers: { Authorization: `Bearer ${newToken}`, 'X-EBAY-C-MARKETPLACE-ID': marketplaceId },
          });
          console.log('Refreshed token inventory probe: OK');
        } catch (e2) {
          console.log('Refreshed token inventory probe: FAIL', e2.response?.status, JSON.stringify(e2.response?.data?.errors?.[0]));
        }
      }
    } catch (e) {
      console.log('eBay refresh_token via RealTrack client: FAIL', e.response?.status, JSON.stringify(e.response?.data ?? e.message).slice(0, 300));
    }
  }
}
