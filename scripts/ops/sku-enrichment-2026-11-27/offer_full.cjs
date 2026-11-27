// READ-ONLY: full offer JSON for one offer, and the public price of its listing.
'use strict';
const { Client } = require('/app/node_modules/pg');
const { TokenEncryptionService } = require('/app/dist/src/channels/token-encryption.service.js');
async function main() {
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  const { rows: [t] } = await db.query('SELECT access_token_encrypted FROM ebay_oauth_tokens WHERE ebay_account_id = $1', ['718461ce-554b-49ca-9482-79fe676b0195']);
  await db.end();
  const token = new TokenEncryptionService({ get: (k, d) => process.env[k] ?? d }).decrypt(t.access_token_encrypted);
  const H = { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Accept-Language': 'en-US', 'Content-Language': 'en-US', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' };
  const o = await (await fetch('https://api.ebay.com/sell/inventory/v1/offer/370202551011', { headers: H })).json();
  const { listingDescription, ...rest } = o;
  console.log(JSON.stringify({ offer: { ...rest, listingDescription: undefined } }));
  const app = await (await fetch('https://api.ebay.com/identity/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(process.env.EBAY_CLIENT_ID + ':' + process.env.EBAY_CLIENT_SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope') })).json();
  const b = await (await fetch('https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=840159538553', { headers: { Authorization: 'Bearer ' + app.access_token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } })).json();
  console.log(JSON.stringify({ browsePrice: b.price, browseQuantityLimit: b.estimatedAvailabilities, buyingOptions: b.buyingOptions, promotions: (b.promotions || b.eligibleForPromotions) ? 'present' : 'none' }));
}
main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
