import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

console.log('EBAY_CLIENT_ID   =', env.EBAY_CLIENT_ID);
console.log('EBAY_REDIRECT_URI=', env.EBAY_REDIRECT_URI);
console.log('EBAY_SANDBOX     =', env.EBAY_SANDBOX);
console.log('CHANNEL_DEMO_MODE=', env.CHANNEL_DEMO_MODE);
console.log('PORT             =', env.PORT || '4191');

const scopes = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
].join('%20');

const state = 'listingpro:system';
const authBase = 'https://auth.sandbox.ebay.com';

const url =
  `${authBase}/oauth2/authorize?` +
  `client_id=${env.EBAY_CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(env.EBAY_REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${scopes}` +
  `&state=${state}`;

console.log('\n=== STEP 1: Visit this URL in your browser ===\n');
console.log(url);
console.log('\n=== STEP 2: After approving, your browser will redirect to ===\n');
console.log(`http://localhost:${env.PORT || 4191}/api/channels/ebay/callback?code=<CODE>&state=${state}`);
console.log('\nThe backend will automatically exchange the code for tokens and store them.\n');
