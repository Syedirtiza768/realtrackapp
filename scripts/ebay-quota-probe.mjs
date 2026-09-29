#!/usr/bin/env node
/**
 * ebay-quota-probe.mjs — is the eBay Browse API answering for this app token?
 *
 * Exits 0 when a real search returns HTTP 200, 1 on HTTP 429 (quota/rate limit
 * still exhausted), 2 on any other failure. Used by the pricing retry watcher
 * so a re-run starts the moment the quota frees instead of guessing a time.
 */
import path from 'node:path';
import process from 'node:process';
import axios from 'axios';
import dotenv from 'dotenv';

const ROOT = process.env.PIPELINE_ROOT || '/app';
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const API_BASE = String(process.env.EBAY_ENVIRONMENT || 'PRODUCTION').toUpperCase() === 'PRODUCTION'
  ? 'https://api.ebay.com'
  : 'https://api.sandbox.ebay.com';

try {
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID || ''}:${process.env.EBAY_CLIENT_SECRET || ''}`).toString('base64');
  const token = (await axios.post(
    `${API_BASE}/identity/v1/oauth2/token`,
    'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 },
  )).data.access_token;

  const response = await axios.get(`${API_BASE}/buy/browse/v1/item_summary/search`, {
    params: { q: 'brake pad', limit: 1, filter: 'conditions:{NEW},buyingOptions:{FIXED_PRICE}' },
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': process.env.PRICING_MARKETPLACE || 'EBAY_US' },
    timeout: 30000,
    validateStatus: () => true,
  });

  if (response.status === 200) { console.log('quota_ok'); process.exit(0); }
  if (response.status === 429) { console.log('rate_limited'); process.exit(1); }
  console.log(`unexpected_status_${response.status}`);
  process.exit(2);
} catch (error) {
  console.log(`probe_error ${error?.message || error}`);
  process.exit(2);
}
