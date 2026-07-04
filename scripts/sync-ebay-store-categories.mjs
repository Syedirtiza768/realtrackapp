#!/usr/bin/env node
/**
 * sync-ebay-store-categories.mjs
 *
 * Fetches eBay Taxonomy category trees for every marketplace used by
 * connected, active eBay stores and upserts rows into `ebay_categories`.
 *
 * Usage (from repo root):
 *   node scripts/sync-ebay-store-categories.mjs
 *   node scripts/sync-ebay-store-categories.mjs --marketplace EBAY_AU
 *   node scripts/sync-ebay-store-categories.mjs --dry-run
 *
 * Reads eBay credentials from backend/.env + .env + process.env.
 * DB connection uses the same env vars as other scripts.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function resolvePgClient() {
  const candidates = [
    path.join(ROOT, 'backend/node_modules/pg'),
    path.join(ROOT, 'node_modules/pg'),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate).Client;
    } catch {
      // try next path
    }
  }
  return require('pg').Client;
}

const Client = resolvePgClient();

/** Motors / parts subtree roots per marketplace (verified taxonomy roots). */
const MARKETPLACE_TAXONOMY = {
  EBAY_MOTORS_US: { treeId: '0', subtreeRoot: '6000', label: 'eBay Motors US' },
  EBAY_US: { treeId: '0', subtreeRoot: '6000', label: 'eBay US Motors' },
  EBAY_AU: { treeId: '15', subtreeRoot: '29690', label: 'eBay AU Motors' },
  EBAY_GB: { treeId: '3', subtreeRoot: '9800', label: 'eBay UK Vehicle Parts' },
  EBAY_DE: { treeId: '77', subtreeRoot: '131090', label: 'eBay DE Auto & Motorrad' },
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function parseArgs(argv) {
  const args = { marketplace: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--marketplace' && argv[i + 1]) args.marketplace = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class RateLimiter {
  constructor(intervalMs) {
    this.intervalMs = intervalMs;
    this.last = 0;
  }
  async acquire() {
    const now = Date.now();
    const wait = this.last + this.intervalMs - now;
    if (wait > 0) await sleep(wait);
    this.last = Date.now();
  }
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status >= 400) {
          const err = new Error(`HTTP ${status}: ${data.slice(0, 400)}`);
          err.status = status;
          err.body = data;
          reject(err);
        } else {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function flattenNode(node, parentId, parentPath, depth, rows) {
  const cat = node.category;
  if (!cat?.categoryId) return;
  const pathParts = parentPath ? [...parentPath, cat.categoryName] : [cat.categoryName];
  const children = node.childCategoryTreeNodes ?? [];
  rows.push({
    ebayCategoryId: String(cat.categoryId),
    parentCategoryId: parentId,
    categoryName: cat.categoryName,
    categoryPath: pathParts.join(' > '),
    depth,
    isLeaf: children.length === 0,
  });
  for (const child of children) {
    flattenNode(child, String(cat.categoryId), pathParts, depth + 1, rows);
  }
}

async function getAppToken(env, limiter) {
  const sandbox = String(env.EBAY_SANDBOX ?? 'false').toLowerCase() === 'true';
  const base = sandbox ? 'api.sandbox.ebay.com' : 'api.ebay.com';
  const basic = Buffer.from(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`).toString('base64');
  const body =
    'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';

  await limiter.acquire();
  const data = await request({
    hostname: base,
    path: '/identity/v1/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return { token: data.access_token, base, sandbox };
}

async function withRetry(label, fn, maxAttempts = 8) {
  const delays = [3000, 8000, 15000, 30000, 60000, 90000, 120000, 180000];
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      if (status !== 429 || attempt >= maxAttempts - 1) throw err;
      const wait = delays[attempt] ?? 120000;
      console.warn(`  ${label}: rate-limited, retry ${attempt + 1}/${maxAttempts - 1} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function fetchSubtree(token, base, limiter, treeId, subtreeRoot) {
  await limiter.acquire();
  return withRetry(`subtree tree=${treeId} root=${subtreeRoot}`, () =>
    request({
      hostname: base,
      path: `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_subtree?category_id=${subtreeRoot}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

async function discoverMarketplaces(client) {
  const { rows } = await client.query(`
    SELECT DISTINCT s.ebay_marketplace_id AS marketplace_id
    FROM stores s
    JOIN connected_ebay_accounts cea ON cea.channel_connection_id = s.connection_id
    WHERE s.channel = 'ebay'
      AND s.status = 'active'
      AND cea.connection_status = 'active'
      AND s.ebay_marketplace_id IS NOT NULL
    ORDER BY 1
  `);
  return rows.map((r) => r.marketplace_id);
}

async function upsertCategories(client, treeId, treeVersion, rows) {
  const chunkSize = 200;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = [];
    const params = [];
    let p = 1;
    for (const row of chunk) {
      values.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, NOW(), NOW())`,
      );
      params.push(
        row.ebayCategoryId,
        treeId,
        row.parentCategoryId,
        row.categoryName,
        row.categoryPath,
        row.depth,
        row.isLeaf,
        '[]',
        '[]',
        treeVersion,
      );
    }
    const sql = `
      INSERT INTO ebay_categories (
        ebay_category_id, tree_id, parent_category_id, category_name, category_path,
        depth, is_leaf, required_aspects, recommended_aspects, tree_version,
        created_at, updated_at
      ) VALUES ${values.join(', ')}
      ON CONFLICT (ebay_category_id, tree_id) DO UPDATE SET
        parent_category_id = EXCLUDED.parent_category_id,
        category_name = EXCLUDED.category_name,
        category_path = EXCLUDED.category_path,
        depth = EXCLUDED.depth,
        is_leaf = EXCLUDED.is_leaf,
        tree_version = EXCLUDED.tree_version,
        updated_at = NOW()
    `;
    const result = await client.query(sql, params);
    upserted += result.rowCount ?? chunk.length;
  }
  return upserted;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = {
    ...loadEnv(path.resolve(ROOT, 'backend/.env')),
    ...loadEnv(path.resolve(ROOT, '.env')),
    ...loadEnv(path.resolve(ROOT, '../backend/.env')),
    ...loadEnv(path.resolve(ROOT, '../.env')),
    ...process.env,
  };

  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
    throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are required');
  }

  const client = new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || 'postgres',
    database: env.DB_NAME || 'listingpro',
  });

  const limiter = new RateLimiter(Number(env.EBAY_TAXONOMY_RPS ? 1000 / Number(env.EBAY_TAXONOMY_RPS) : 2000));

  await client.connect();
  try {
    let marketplaces = await discoverMarketplaces(client);
    if (args.marketplace) {
      marketplaces = marketplaces.filter((m) => m === args.marketplace);
      if (!marketplaces.length) {
        throw new Error(`Marketplace ${args.marketplace} not found among connected stores`);
      }
    }

    if (!marketplaces.length) {
      console.log('No active connected eBay store marketplaces found.');
      return;
    }

    console.log(`Connected store marketplaces: ${marketplaces.join(', ')}`);
    console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'} | sandbox=${env.EBAY_SANDBOX ?? 'false'}\n`);

    const { token, base } = await getAppToken(env, limiter);

    for (const marketplaceId of marketplaces) {
      const cfg = MARKETPLACE_TAXONOMY[marketplaceId];
      if (!cfg) {
        console.warn(`Skipping ${marketplaceId}: no taxonomy config (add to MARKETPLACE_TAXONOMY)`);
        continue;
      }

      console.log(`Fetching ${cfg.label} (tree ${cfg.treeId}, root ${cfg.subtreeRoot})...`);
      const payload = await fetchSubtree(token, base, limiter, cfg.treeId, cfg.subtreeRoot);
      const rootNode = payload.categorySubtreeNode;
      const treeVersion = payload.categoryTreeVersion ?? payload.categoryTreeId ?? null;
      const rootName = rootNode?.category?.categoryName ?? '(unknown)';
      console.log(`  Root: "${rootName}" | version: ${treeVersion ?? 'n/a'}`);

      const rows = [];
      flattenNode(rootNode, null, null, 0, rows);
      const leafCount = rows.filter((r) => r.isLeaf).length;
      console.log(`  Categories: ${rows.length} total, ${leafCount} leaf`);

      if (args.dryRun) {
        console.log(`  [dry-run] would upsert ${rows.length} rows into ebay_categories (tree_id=${cfg.treeId})\n`);
        continue;
      }

      const upserted = await upsertCategories(client, cfg.treeId, treeVersion, rows);
      console.log(`  Upserted ${upserted} rows for tree_id=${cfg.treeId}\n`);
      await sleep(5000);
    }

    const { rows: summary } = await client.query(`
      SELECT tree_id, COUNT(*)::int AS cnt, MAX(updated_at) AS last_updated
      FROM ebay_categories
      GROUP BY tree_id
      ORDER BY tree_id
    `);
    console.log('ebay_categories summary:');
    for (const row of summary) {
      console.log(`  tree ${row.tree_id}: ${row.cnt} categories (updated ${row.last_updated})`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
