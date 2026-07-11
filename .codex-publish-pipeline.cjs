const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const PIPELINE_JOB_ID = '1c3a0f2a-064c-4d86-8c37-c31f60ffd272';
const TARGET_STORE_NAMES = ['BLACKLINEAUTOPARTS', 'Primemotive'];
const API_BASE = 'http://127.0.0.1:4191/api';
const CONCURRENCY = 5;
const MAX_PASSES = 4;

function requiredEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function fetchJson(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.message)
      ? body.message.join('; ')
      : body.message || body.error || response.statusText;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  return body;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  const db = new Client({
    host: requiredEnv('DB_HOST', 'postgres'),
    port: Number(process.env.DB_PORT || 5432),
    user: requiredEnv('DB_USER', 'postgres'),
    password: process.env.DB_PASSWORD || undefined,
    database: requiredEnv('DB_NAME', 'listingpro'),
  });
  await db.connect();
  const userResult = await db.query(
    `SELECT id, email, role
       FROM users
      WHERE active = true AND "lastLoginAt" IS NOT NULL
      ORDER BY "lastLoginAt" DESC
      LIMIT 1`,
  );
  await db.end();
  if (!userResult.rows[0]) throw new Error('No active recently authenticated user found');

  const user = userResult.rows[0];
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    requiredEnv('JWT_SECRET'),
    { expiresIn: Number(process.env.JWT_EXPIRY_SECONDS || 14400) },
  );

  const stores = await fetchJson(`${API_BASE}/stores/by-channel/ebay`, token);
  const targets = TARGET_STORE_NAMES.map((name) =>
    stores.find((store) => store.storeName === name && store.status === 'active'),
  );
  if (targets.some((store) => !store)) {
    throw new Error(`Could not resolve both active target stores: ${TARGET_STORE_NAMES.join(', ')}`);
  }
  const storeIds = targets.map((store) => store.id);

  const listings = [];
  for (let offset = 0; ; offset += 200) {
    const url = new URL(`${API_BASE}/listings/search`);
    url.searchParams.set('pipelineJobIds', PIPELINE_JOB_ID);
    url.searchParams.set('limit', '200');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('sort', 'newest');
    const page = await fetchJson(url, token);
    listings.push(...page.items.map((item) => ({ id: item.id, sku: item.customLabelSku })));
    if (listings.length >= page.total || page.items.length === 0) break;
  }

  const unique = [...new Map(listings.map((item) => [item.id, item])).values()];
  if (unique.length !== 903) {
    throw new Error(`Expected 903 pipeline listings but loaded ${unique.length}`);
  }
  console.log(`Loaded ${unique.length} listings; targets=${TARGET_STORE_NAMES.join(' + ')}`);

  let pending = unique;
  const finalResults = new Map();
  for (let pass = 1; pass <= MAX_PASSES && pending.length > 0; pass++) {
    console.log(`Pass ${pass}: publishing ${pending.length} listings`);
    let completed = 0;
    const outcomes = await mapLimit(pending, CONCURRENCY, async (item) => {
      try {
        const response = await fetchJson(
          `${API_BASE}/channels/ebay/publish-by-listings`,
          token,
          {
            method: 'POST',
            body: JSON.stringify({ listingIds: [item.id], storeIds }),
          },
        );
        const storeResults = response[0]?.results || [];
        const errors = storeResults.filter((result) => !result.success);
        const success = storeResults.length === storeIds.length && errors.length === 0;
        const outcome = {
          ...item,
          success,
          errors: errors.map((result) => ({ store: result.storeName, error: result.error })),
        };
        finalResults.set(item.id, outcome);
        return outcome;
      } catch (error) {
        const outcome = { ...item, success: false, errors: [{ store: 'request', error: error.message }] };
        finalResults.set(item.id, outcome);
        return outcome;
      } finally {
        completed++;
        if (completed % 25 === 0 || completed === pending.length) {
          console.log(`Pass ${pass}: ${completed}/${pending.length} processed`);
        }
      }
    });
    pending = outcomes.filter((outcome) => !outcome.success).map(({ id, sku }) => ({ id, sku }));
    console.log(`Pass ${pass} complete: ${outcomes.length - pending.length} succeeded, ${pending.length} need retry`);
  }

  const failed = [...finalResults.values()].filter((result) => !result.success);
  console.log(`FINAL: ${unique.length - failed.length}/${unique.length} listings succeeded on both stores; ${failed.length} failed`);
  if (failed.length) {
    const grouped = {};
    for (const item of failed) {
      for (const error of item.errors) {
        const key = `${error.store}: ${error.error}`;
        grouped[key] = (grouped[key] || 0) + 1;
      }
    }
    console.log(JSON.stringify({ failed: failed.map((item) => item.sku || item.id), groupedErrors: grouped }, null, 2));
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  process.exitCode = 1;
});
