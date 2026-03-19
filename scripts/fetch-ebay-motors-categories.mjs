/**
 * fetch-ebay-motors-categories.mjs
 *
 * Fetches eBay Motors category tree from the eBay Taxonomy API using
 * sandbox credentials.  Outputs two files:
 *   - ebay-motors-categories.json  (full tree)
 *   - ebay-motors-categories.csv   (flat: id, name, level, parentId, parentName)
 *
 * Usage:
 *   node scripts/fetch-ebay-motors-categories.mjs
 *
 * Reads credentials from backend/.env automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env ────────────────────────────────────────────────────────────────
function loadEnv(envPath) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const envPath = path.resolve(__dirname, '../backend/.env');
const env = loadEnv(envPath);

const CLIENT_ID     = env.EBAY_CLIENT_ID;
const CLIENT_SECRET = env.EBAY_CLIENT_SECRET;
const SANDBOX       = env.EBAY_SANDBOX !== 'false';   // default true

const BASE = SANDBOX ? 'api.sandbox.ebay.com' : 'api.ebay.com';

console.log(`\neBay Motors Category Fetcher`);
console.log(`Mode   : ${SANDBOX ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`Host   : ${BASE}`);
console.log(`App ID : ${CLIENT_ID}\n`);

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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

// ─── Step 1: Get app-level access token (client_credentials) ─────────────────
async function getAppToken() {
  console.log('Step 1/3  Getting application access token...');
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body  = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';

  const data = await request(
    {
      hostname: BASE,
      path    : '/identity/v1/oauth2/token',
      method  : 'POST',
      headers : {
        'Content-Type'  : 'application/x-www-form-urlencoded',
        'Authorization' : `Basic ${basic}`,
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
  );

  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  console.log(`           OK — token received (expires in ${data.expires_in}s)\n`);
  return data.access_token;
}

// ─── Step 2: Get category tree ID for eBay Motors US ─────────────────────────
async function getCategoryTreeId(token) {
  console.log('Step 2/3  Fetching category tree ID for EBAY_MOTORS_US...');
  const data = await request({
    hostname: BASE,
    path    : '/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_MOTORS_US',
    method  : 'GET',
    headers : { Authorization: `Bearer ${token}` },
  });
  console.log(`           Tree ID : ${data.categoryTreeId}  Version: ${data.categoryTreeVersion}\n`);
  return data.categoryTreeId;
}

// ─── Step 3: Fetch the subtree rooted at eBay Motors (cat 6000) ───────────────
async function getMotorsSubtree(token, treeId) {
  // Category 6000 = eBay Motors root on the live/sandbox taxonomy
  // The subtree endpoint returns only that branch — far smaller than the full tree
  console.log('Step 3/3  Fetching eBay Motors subtree (category 6000)...');
  const data = await request({
    hostname: BASE,
    path    : `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_subtree?category_id=6000`,
    method  : 'GET',
    headers : { Authorization: `Bearer ${token}` },
  });
  console.log(`           OK — root category: "${data.categorySubtreeNode?.category?.categoryName}"\n`);
  return data;
}

// ─── Flatten tree → [{id, name, level, parentId, parentName}] ────────────────
function flatten(node, parentId, parentName, level, rows) {
  const cat = node.category;
  rows.push({
    id        : cat.categoryId,
    name      : cat.categoryName,
    level,
    parentId  : parentId ?? '',
    parentName: parentName ?? '',
    leafOnly  : node.childCategoryTreeNodes?.length ? 'N' : 'Y',
  });
  if (node.childCategoryTreeNodes) {
    for (const child of node.childCategoryTreeNodes) {
      flatten(child, cat.categoryId, cat.categoryName, level + 1, rows);
    }
  }
}

// ─── Write CSV ────────────────────────────────────────────────────────────────
function writeCsv(rows, outPath) {
  const header = 'categoryId,categoryName,level,parentId,parentName,leafCategory\n';
  const lines  = rows.map(r =>
    [r.id, `"${r.name.replace(/"/g, '""')}"`, r.level, r.parentId, `"${r.parentName.replace(/"/g, '""')}"`, r.leafOnly].join(',')
  );
  fs.writeFileSync(outPath, header + lines.join('\n'), 'utf8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const token  = await getAppToken();
    const treeId = await getCategoryTreeId(token);
    const tree   = await getMotorsSubtree(token, treeId);

    const rows = [];
    flatten(tree.categorySubtreeNode, null, null, 0, rows);

    const outDir  = path.resolve(__dirname, '../files/_analysis_outputs');
    const jsonOut = path.join(outDir, 'ebay-motors-categories.json');
    const csvOut  = path.join(outDir, 'ebay-motors-categories.csv');

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(tree, null, 2), 'utf8');
    writeCsv(rows, csvOut);

    console.log(`Results`);
    console.log(`  Total categories : ${rows.length}`);
    console.log(`  Leaf categories  : ${rows.filter(r => r.leafOnly === 'Y').length}`);
    console.log(`  JSON → ${jsonOut}`);
    console.log(`  CSV  → ${csvOut}\n`);

    // Print the top-level children (direct children of eBay Motors root)
    const top = rows.filter(r => r.parentId === '6000');
    console.log('Top-level eBay Motors sections:');
    console.log('  ID      Name');
    console.log('  ─────── ─────────────────────────────────────');
    for (const t of top) {
      console.log(`  ${t.id.padEnd(7)} ${t.name}`);
    }
    console.log();

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
