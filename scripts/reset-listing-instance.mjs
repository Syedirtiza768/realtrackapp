/**
 * Reset the channel instance for DX231560AA so the publish poll gets a fresh result.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Use pg from the backend's node_modules
const pg = require('../backend/node_modules/pg');
import path from 'path';
import fs from 'fs';
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

const client = new pg.Client({
  host: env.DB_HOST || 'localhost',
  port: parseInt(env.DB_PORT || '5432'),
  user: env.DB_USER || 'postgres',
  password: env.DB_PASSWORD,
  database: env.DB_NAME || 'listingpro',
});

await client.connect();

// Reset any existing channel instances for DX231560AA to force a fresh result
const res = await client.query(
  `UPDATE listing_channel_instances
   SET sync_status = 'pending', external_id = NULL, external_url = NULL, last_synced_at = NULL
   WHERE listing_id = '8825eb9f-1be3-4fea-9c30-c7efa0d0bbb4'`
);
console.log(`Reset ${res.rowCount} channel instance(s) to pending.`);

// Also show current state
const rows = await client.query(
  `SELECT id, connection_id, sync_status, external_id, last_synced_at
   FROM listing_channel_instances
   WHERE listing_id = '8825eb9f-1be3-4fea-9c30-c7efa0d0bbb4'`
);
console.log('Current instances:', rows.rows);

await client.end();
console.log('Done. Now run: node scripts/publish-dx231560aa.mjs');
