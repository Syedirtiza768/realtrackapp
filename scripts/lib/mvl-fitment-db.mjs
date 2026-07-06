/**
 * Optional PostgreSQL access for local eBay MVL reference data during pipeline runs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

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

let pgClient = null;
let activeReleaseCache = new Map();

function getPg() {
  if (!pgClient) {
    const require = createRequire(import.meta.url);
    const { Client } = require(path.join(ROOT, 'backend/node_modules/pg'));
    pgClient = new Client({
      host: env.DB_HOST || 'localhost',
      port: Number(env.DB_PORT || 5432),
      user: env.DB_USER || 'postgres',
      password: env.DB_PASSWORD || 'postgres',
      database: env.DB_NAME || 'listingpro',
    });
  }
  return pgClient;
}

export async function connectMvlDb() {
  const client = getPg();
  if (!client._connected) {
    await client.connect();
    client._connected = true;
  }
  return client;
}

export async function disconnectMvlDb() {
  if (pgClient?._connected) {
    await pgClient.end();
    pgClient = null;
  }
}

export async function hasActiveMvlRelease(marketplace = 'US') {
  try {
    const client = await connectMvlDb();
    const { rows } = await client.query(
      `SELECT id FROM ebay_mvl_releases WHERE marketplace = $1 AND status = 'active' ORDER BY imported_at DESC LIMIT 1`,
      [marketplace],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function getActiveReleaseId(marketplace = 'US') {
  if (activeReleaseCache.has(marketplace)) {
    return activeReleaseCache.get(marketplace);
  }
  try {
    const client = await connectMvlDb();
    const { rows } = await client.query(
      `SELECT id FROM ebay_mvl_releases WHERE marketplace = $1 AND status = 'active' ORDER BY imported_at DESC LIMIT 1`,
      [marketplace],
    );
    const id = rows[0]?.id ?? null;
    activeReleaseCache.set(marketplace, id);
    return id;
  } catch {
    return null;
  }
}

export async function queryMvlYearsInRange(marketplace, make, model, yearStart, yearEnd) {
  const releaseId = await getActiveReleaseId(marketplace);
  if (!releaseId || !make || !model) return [];
  try {
    const client = await connectMvlDb();
    const { rows } = await client.query(
      `SELECT DISTINCT year FROM ebay_mvl_entries
       WHERE release_id = $1 AND marketplace = $2
         AND LOWER(make) = LOWER($3) AND LOWER(model) = LOWER($4)
         AND year BETWEEN $5 AND $6
       ORDER BY year ASC`,
      [releaseId, marketplace, make, model, yearStart, yearEnd],
    );
    return rows.map((r) => Number(r.year)).filter((y) => Number.isFinite(y));
  } catch {
    return [];
  }
}

export async function queryMvlModelsInYearRange(marketplace, make, yearStart, yearEnd) {
  const releaseId = await getActiveReleaseId(marketplace);
  if (!releaseId || !make) return [];
  try {
    const client = await connectMvlDb();
    const { rows } = await client.query(
      `SELECT model, MIN(year) AS min_year, MAX(year) AS max_year
       FROM ebay_mvl_entries
       WHERE release_id = $1 AND marketplace = $2
         AND LOWER(make) = LOWER($3)
         AND year BETWEEN $4 AND $5
       GROUP BY model
       ORDER BY model ASC`,
      [releaseId, marketplace, make, yearStart, yearEnd],
    );
    return rows.map((r) => ({
      model: r.model,
      minYear: Number(r.min_year),
      maxYear: Number(r.max_year),
    }));
  } catch {
    return [];
  }
}

export async function queryMvlModelsByPlatform(marketplace, make, platform) {
  const releaseId = await getActiveReleaseId(marketplace);
  if (!releaseId || !make || !platform) return [];
  try {
    const client = await connectMvlDb();
    const { rows } = await client.query(
      `SELECT model, MIN(year) AS min_year, MAX(year) AS max_year
       FROM ebay_mvl_entries
       WHERE release_id = $1 AND marketplace = $2
         AND LOWER(make) = LOWER($3)
         AND LOWER(platform) = LOWER($4)
       GROUP BY model
       ORDER BY model ASC`,
      [releaseId, marketplace, make, platform],
    );
    return rows.map((r) => ({
      model: r.model,
      minYear: Number(r.min_year),
      maxYear: Number(r.max_year),
    }));
  } catch {
    return [];
  }
}

export async function filterRowsAgainstMvl(marketplace, rows) {
  const releaseId = await getActiveReleaseId(marketplace);
  if (!releaseId || !rows?.length) {
    return { accepted: rows ?? [], rejectedCount: 0, usedDb: false };
  }

  const accepted = [];
  let rejectedCount = 0;
  try {
    const client = await connectMvlDb();
    for (const row of rows) {
      const year = parseInt(row.year, 10);
      if (!row.make || !row.model || !Number.isFinite(year)) {
        rejectedCount++;
        continue;
      }
      const { rows: hits } = await client.query(
        `SELECT 1 FROM ebay_mvl_entries
         WHERE release_id = $1 AND marketplace = $2
           AND LOWER(make) = LOWER($3) AND LOWER(model) = LOWER($4) AND year = $5
         LIMIT 1`,
        [releaseId, marketplace, row.make, row.model, year],
      );
      if (hits.length) {
        accepted.push({ ...row, mvlSource: 'database' });
      } else {
        rejectedCount++;
      }
    }
    return { accepted, rejectedCount, usedDb: true };
  } catch {
    return { accepted: rows, rejectedCount: 0, usedDb: false };
  }
}

export async function expandSiblingModelsFromMvl({
  marketplace = 'US',
  make,
  yearStart,
  yearEnd,
  donorModel,
  tier,
  siblingMode,
  getEbayFitmentModelFields,
  addRow,
}) {
  if (siblingMode === 'off') return 0;
  if (tier === 'interior' && siblingMode !== 'aggressive') return 0;
  if (tier === 'electrical' || tier === 'mechanical') return 0;

  const models = await queryMvlModelsInYearRange(marketplace, make, yearStart, yearEnd);
  let added = 0;
  const donorLower = String(donorModel ?? '').toLowerCase();

  for (const entry of models) {
    if (entry.model.toLowerCase() === donorLower) continue;
    if (siblingMode === 'conservative' && tier === 'body') {
      // body: allow models in same generation year span
    } else if (siblingMode === 'conservative' && tier === 'general') {
      continue;
    }
    const lo = Math.max(yearStart, entry.minYear);
    const hi = Math.min(yearEnd, entry.maxYear);
    const fields = getEbayFitmentModelFields(make, entry.model, '');
    for (let y = lo; y <= hi; y++) {
      if (
        addRow({
          year: String(y),
          make,
          model: fields.model,
          trim: fields.trim || '',
          engine: '',
          submodel: '',
          bodyType: '',
          notes: `Sibling model from MVL (${entry.model})`,
          source: 'mvl_sibling',
        })
      ) {
        added++;
      }
    }
  }
  return added;
}
