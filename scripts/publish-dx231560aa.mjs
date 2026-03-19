/**
 * publish-dx231560aa.mjs
 *
 * 1. Reads the eBay-connected channel connection from the DB
 * 2. Upserts a listing_record for OEM DX231560AA
 * 3. Calls POST /api/channels/publish  (→ BullMQ → publishListing → demo-mode simulation)
 * 4. Polls the listing_channel_instances table until syncStatus = 'synced', then prints the result
 *
 * Usage:
 *   node scripts/publish-dx231560aa.mjs
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import https from 'https';
import http  from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env ────────────────────────────────────────────────────────────────
function loadEnv(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8');
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
const API_BASE = `http://localhost:${env.PORT || 4191}`;

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + urlPath);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: url.hostname,
      port    : url.port,
      path    : url.pathname + url.search,
      method,
      headers : {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = (url.protocol === 'https:' ? https : http).request(opts, res => {
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

// ─── Wait helper ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── The DX231560AA listing data (matches CreateListingDto exactly) ───────────
const LISTING = {
  title                  : 'Jaguar XF XK XKR F-Type TPMS Tire Pressure Control Module OEM DX231560AA',
  customLabelSku         : 'DX231560AA',
  categoryId             : '179696',
  categoryName           : 'Tire Pressure Monitoring Sensor',
  conditionId            : 'Used',
  startPrice             : '139.95',
  quantity               : '1',
  cBrand                 : 'Jaguar',
  cManufacturerPartNumber: 'DX231560AA',
  cOeOemPartNumber       : 'DX231560AA',
  cType                  : 'TPMS Control Module',
  format                 : 'FixedPrice',
  duration               : 'GTC',
  buyItNowPrice          : '139.95',
  bestOfferEnabled       : 'true',
  minimumBestOfferPrice  : '119.00',
  returnsAcceptedOption  : 'ReturnsAccepted',
  returnsWithinOption    : '30DaysEbay',
  refundOption           : 'MoneyBackOrExchange',
  returnShippingCostPaidBy: 'Seller',
  shippingService1Option : 'USPSPriority',
  shippingService1Cost   : '0',
  maxDispatchTime        : '1',
  location               : 'United States',
  description            : `OEM Jaguar Tire Pressure Monitoring System (TPMS) Control Module. Part number: DX231560AA / DX23-1560-AA. Manufactured in Germany. FITS: 2008-2015 Jaguar XF (X250), 2010-2015 Jaguar XK / XKR (X150), 2013-2015 Jaguar F-Type (X152). Genuine OEM pull. 30-day returns. Ships within 1 business day.`,
  status                 : 'ready',
};

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  ListingPro — Publish DX231560AA to eBay');
  console.log('═══════════════════════════════════════════════\n');

  // ── Step 1: Get all channel connections ──────────────────────────────────
  console.log('Step 1/4  Fetching eBay connection...');
  const connRes = await apiRequest('GET', '/api/channels');
  if (connRes.status !== 200) {
    console.error('  ✗ Failed to fetch connections:', connRes.body);
    process.exit(1);
  }

  const connections = Array.isArray(connRes.body) ? connRes.body : [];
  const ebayConn = connections.find(c => c.channel === 'ebay');
  if (!ebayConn) {
    console.error('  ✗ No eBay connection found. Go to Settings → Channels and connect eBay first.');
    process.exit(1);
  }

  console.log(`  ✓ Found connection: ${ebayConn.id} (status: ${ebayConn.status})\n`);

  // ── Step 2: Create/upsert the listing record via the listings API ─────────
  console.log('Step 2/4  Creating listing record for DX231560AA...');

  // Check if it already exists by SKU
  const existRes = await apiRequest('GET', `/api/listings?sku=${encodeURIComponent(LISTING.customLabelSku)}&limit=1`);
  let listingId;

  if (existRes.status === 200) {
    const items = Array.isArray(existRes.body?.items)
      ? existRes.body.items
      : Array.isArray(existRes.body?.data)
        ? existRes.body.data
        : Array.isArray(existRes.body)
          ? existRes.body
          : [];
    const existing = items.find(l => l.customLabelSku === LISTING.customLabelSku);
    if (existing) {
      listingId = existing.id;
      console.log(`  ✓ Existing listing found: ${listingId}\n`);
    }
  }

  if (!listingId) {
    // POST to create it
    const createRes = await apiRequest('POST', '/api/listings', LISTING);
    if (createRes.status === 200 || createRes.status === 201) {
      listingId = createRes.body?.id ?? createRes.body?.listing?.id;
      console.log(`  ✓ Created listing: ${listingId}\n`);
    } else {
      console.error(`  ✗ Listings API returned ${createRes.status}: ${JSON.stringify(createRes.body)}`);
      process.exit(1);
    }
  }

  if (!listingId) {
    console.error('\n✗ Could not obtain a listing ID. Cannot publish.');
    console.log('\nHint: Make sure the backend is running on port 4191.');
    process.exit(1);
  }

  // ── Step 3: Enqueue the publish job ──────────────────────────────────────
  console.log(`Step 3/4  Enqueueing publish job → connection ${ebayConn.id}, listing ${listingId}...`);
  const publishRes = await apiRequest('POST', '/api/channels/publish', {
    connectionId: ebayConn.id,
    listingId   : listingId,
  });

  if (publishRes.status === 200 || publishRes.status === 201) {
    console.log(`  ✓ Job enqueued — jobId: ${publishRes.body?.jobId}\n`);
  } else {
    console.error(`  ✗ Publish enqueue failed (${publishRes.status}):`, publishRes.body);
    process.exit(1);
  }

  // ── Step 4: Poll for the channel instance result ──────────────────────────
  console.log('Step 4/4  Waiting for publish to complete...');
  let instance = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(1500);
    const instRes = await apiRequest('GET', `/api/channels/${ebayConn.id}/listings`);
    if (instRes.status === 200) {
      const list = Array.isArray(instRes.body) ? instRes.body : [];
      instance = list.find(i => i.listingId === listingId && i.syncStatus === 'synced');
      if (instance) break;
      process.stdout.write('.');
    }
  }

  console.log('\n');
  if (instance) {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║               ✅  LISTING PUBLISHED                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`  Part Number   : DX231560AA`);
    console.log(`  Title         : ${LISTING.title}`);
    console.log(`  Price         : $${LISTING.startPrice}`);
    console.log(`  Channel       : ${instance.channel}`);
    console.log(`  External ID   : ${instance.externalId}`);
    console.log(`  Listing URL   : ${instance.externalUrl}`);
    console.log(`  Sync Status   : ${instance.syncStatus}`);
    console.log(`  Synced At     : ${instance.lastSyncedAt}`);
    console.log();
  } else {
    console.warn('⚠ Timed out waiting for synced status. The job may still be processing.');
    console.log('  Check backend logs or Settings → Channels for status.');
  }
})();
