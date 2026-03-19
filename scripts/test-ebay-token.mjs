/**
 * Test the stored eBay token against the sandbox API directly.
 * This reveals the exact error the publishListing call is hitting.
 */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const pg = require('../backend/node_modules/pg');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv(path.resolve(__dirname, '../backend/.env'));

// ─── Read the stored token from DB ─────────────────────────────────────────
const client = new pg.Client({
  host: env.DB_HOST || 'localhost',
  port: parseInt(env.DB_PORT || '5432'),
  user: env.DB_USER || 'postgres',
  password: env.DB_PASSWORD,
  database: env.DB_NAME || 'listingpro',
});
await client.connect();

const result = await client.query(
  `SELECT encrypted_tokens, status, account_name FROM channel_connections
   WHERE channel = 'ebay' AND status = 'active'
   ORDER BY created_at DESC LIMIT 1`
);
await client.end();

if (!result.rows.length) {
  console.error('No active eBay connection found!');
  process.exit(1);
}

const row = result.rows[0];
const encKey = env.CHANNEL_ENCRYPTION_KEY;

// ─── Decrypt the token ──────────────────────────────────────────────────────
let tokenSet;
try {
  const crypto = await import('crypto');
  const [ivB64, authTagB64, encB64] = row.encrypted_tokens.split(':');
  const key = Buffer.from(encKey, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  tokenSet = JSON.parse(plain);
  console.log('Token type  :', tokenSet.tokenType);
  console.log('Token prefix:', tokenSet.accessToken?.slice(0, 30) + '...');
  console.log('Expires     :', tokenSet.expiresAt);
} catch (e) {
  console.error('Failed to decrypt token:', e.message);
  process.exit(1);
}

// ─── Test token against eBay's identity endpoint ────────────────────────────
console.log('\nTesting against sandbox eBay Sell Inventory API...');

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || 'null') }));
    });
    req.on('error', reject);
    req.end();
  });
}

// Try GET /sell/inventory/v1/inventory_item — just list items to verify auth
const testRes = await httpsGet(
  'https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item?limit=1',
  { Authorization: `Bearer ${tokenSet.accessToken}`, 'Content-Type': 'application/json' }
);

console.log(`\neBay API status : ${testRes.status}`);
if (testRes.status === 200) {
  console.log('✅ Token is VALID — REST API accepted it!');
  console.log('Total inventory items:', testRes.body?.total ?? 0);
} else if (testRes.status === 401) {
  console.log('❌ 401 Unauthorized — Token is NOT valid as OAuth 2.0 Bearer token');
  console.log('Error:', JSON.stringify(testRes.body?.errors?.[0] ?? testRes.body, null, 2));
  console.log('\nDiagnosis: The stored token is a legacy Auth\'n\'Auth token, not an OAuth 2.0 access token.');
  console.log('Solution: Complete the OAuth 2.0 browser flow to get a real access token.\n');
  console.log('FOLLOW THESE STEPS:');
  console.log('1. Open this URL in your browser:');

  const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  ].join(' ');

  const authUrl = `https://auth.sandbox.ebay.com/oauth2/authorize?client_id=${env.EBAY_CLIENT_ID}&redirect_uri=${encodeURIComponent(env.EBAY_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=listingpro:system`;
  console.log('\n' + authUrl + '\n');
  console.log('2. Log in with your SANDBOX seller account');
  console.log('3. eBay will redirect to http://localhost:4191/api/channels/ebay/callback');
  console.log('4. The backend automatically stores a real OAuth token');
  console.log('5. Re-run: node scripts/publish-dx231560aa.mjs');
} else {
  console.log('Unexpected status:', testRes.status);
  console.log(JSON.stringify(testRes.body, null, 2));
}
