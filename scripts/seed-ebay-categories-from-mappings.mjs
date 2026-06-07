#!/usr/bin/env node
/**
 * Seed ebay_categories from ebay_category_mappings (motors cache).
 * Enables AI_TAXONOMY_VALIDATION_ENABLED leaf checks without live eBay API.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const { Client } = require(path.join(ROOT, 'backend/node_modules/pg'));

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

const env = {
  ...loadEnv(path.resolve(ROOT, 'backend/.env')),
  ...loadEnv(path.resolve(ROOT, '.env')),
  ...process.env,
};

const client = new Client({
  host: env.DB_HOST || 'localhost',
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USER || 'postgres',
  password: env.DB_PASSWORD || 'postgres',
  database: env.DB_NAME || 'listingpro',
});

const sql = `
INSERT INTO ebay_categories (
  ebay_category_id,
  tree_id,
  parent_category_id,
  category_name,
  category_path,
  depth,
  is_leaf,
  required_aspects,
  recommended_aspects,
  supports_compatibility,
  created_at,
  updated_at
)
SELECT
  m."ebayCategoryId",
  '0',
  m."parentCategoryId",
  m."ebayCategoryName",
  CASE
    WHEN m."parentCategoryName" IS NOT NULL AND m."parentCategoryName" <> ''
      THEN m."parentCategoryName" || ' > ' || m."ebayCategoryName"
    ELSE m."ebayCategoryName"
  END,
  2,
  true,
  '[]'::jsonb,
  '[]'::jsonb,
  COALESCE(m."supportsCompatibility", false),
  NOW(),
  NOW()
FROM ebay_category_mappings m
WHERE m.active = true
ON CONFLICT (ebay_category_id, tree_id) DO UPDATE SET
  category_name = EXCLUDED.category_name,
  category_path = EXCLUDED.category_path,
  is_leaf = EXCLUDED.is_leaf,
  supports_compatibility = EXCLUDED.supports_compatibility,
  updated_at = NOW();
`;

async function main() {
  await client.connect();
  try {
    const result = await client.query(sql);
    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS n FROM ebay_categories',
    );
    console.log(
      `Seeded ebay_categories (${result.rowCount ?? 0} upserts). Total rows: ${rows[0].n}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
