/**
 * connect-ebay-sandbox-token.mjs
 *
 * Stores a pre-generated eBay sandbox User Access Token into ListingPro,
 * replacing the browser-based OAuth flow for sandbox testing.
 *
 * HOW TO GET YOUR SANDBOX USER TOKEN
 * ────────────────────────────────────
 * 1. Go to: https://developer.ebay.com/my/auth?env=sandbox&index=0
 * 2. Select your Sandbox app (IrtizaHa-listingp-SBX-...)
 * 3. Under "Get a User Access Token", click "Get OAuth Access Token"
 * 4. Sign in with your SANDBOX seller account (not your real eBay account)
 *    (Create one at: https://developer.ebay.com/my/users?env=sandbox)
 * 5. eBay will show you a long token string starting with "v^1.1#i^1#..."
 * 6. Copy that ENTIRE token string
 * 7. Run: node scripts/connect-ebay-sandbox-token.mjs "PASTE_TOKEN_HERE"
 *
 * Usage:
 *   node scripts/connect-ebay-sandbox-token.mjs "<your_user_token>"
 */

import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

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

function apiRequest(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost',
      port,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

(async () => {
  const token = process.argv[2];

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ListingPro — Connect eBay Sandbox via User Token');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!token) {
    console.log('Usage:  node scripts/connect-ebay-sandbox-token.mjs "<USER_TOKEN>"\n');
    console.log('How to get your sandbox User Access Token:');
    console.log('  1. Visit: https://developer.ebay.com/my/auth?env=sandbox&index=0');
    console.log('  2. Select your sandbox app (IrtizaHa-listingp-SBX-...)');
    console.log('  3. Click "Get OAuth Access Token"');
    console.log('  4. Log in with your SANDBOX seller account');
    console.log('     (create one at https://developer.ebay.com/my/users?env=sandbox)');
    console.log('  5. Copy the token (starts with v^1.1# or AgAAAA...)');
    console.log('  6. Re-run this script with that token as the argument\n');
    process.exit(0);
  }

  const env = loadEnv(path.resolve(__dirname, '../backend/.env'));
  const PORT = parseInt(env.PORT || '4191', 10);

  // Health check
  console.log('Checking backend is running...');
  try {
    const health = await apiRequest(PORT, 'GET', '/api/health', null);
    if (health.status !== 200) throw new Error(`Status ${health.status}`);
    console.log('  ✓ Backend is up\n');
  } catch (e) {
    console.error(`  ✗ Backend not reachable on port ${PORT}: ${e.message}`);
    console.error('  → Make sure the backend is running (npm run start:dev inside backend/)');
    process.exit(1);
  }

  // Store the token
  console.log('Storing eBay sandbox user token...');
  const res = await apiRequest(PORT, 'POST', '/api/channels/ebay/connect-legacy-token', {
    token,
    userId: 'system',
  });

  if (res.status === 200 || res.status === 201) {
    const conn = res.body?.connection ?? res.body;
    console.log('  ✓ Connection created!\n');
    console.log('  Connection ID :', conn?.id);
    console.log('  Status        :', conn?.status);
    console.log('  Account Name  :', conn?.accountName);
    console.log('  Token Expires :', conn?.tokenExpiresAt);
    console.log('\n✅ eBay sandbox connection is ready.');
    console.log('\nNext step — republish DX231560AA to eBay for real:');
    console.log('  node scripts/publish-dx231560aa.mjs\n');
  } else {
    console.error(`  ✗ Failed (${res.status}):`, JSON.stringify(res.body, null, 2));
    process.exit(1);
  }
})();
