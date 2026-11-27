// Apply validated Haiku proposals to catalog_products (2026-11-27).
// Dry run by default; set APPLY=1 to write. Backs up every changed row first (sku_enrich_backup_20261127).
// Only fills EMPTY specifics, sets the description where the stored one is not proper, appends the stored condition label.
//   node /work/apply_enh.cjs <resultsFile>
'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('/app/node_modules/pg');
const WORK = '/work';
const [resultsName] = process.argv.slice(2);
const APPLY = process.env.APPLY === '1';
const MIN_DESC = 300; // same threshold as the 2026-11-27 scope count: under 300 characters is not a proper description
const MAX_DESC = 700;
const DEPARTMENTS = new Set(['Men', 'Women', 'Boys', 'Girls', 'Unisex Adults', 'Unisex Kids', 'Baby']);
const SIZE_TYPES = new Set(['Regular', 'Slim', 'Tall', 'Petite', 'Plus', 'Big & Tall']);
const SPEC_KEYS = ['department', 'itemType', 'size', 'sizeType', 'color', 'style', 'material', 'fit'];
const CONDITION_LABELS = { 'Used excellent': 1, 'Used good': 1, 'Used acceptable': 1, 'New': 1, 'New other': 1 };

function clean(v, max) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s || /^(null|none|n\/a|unknown)$/i.test(s)) return null;
  return s.slice(0, max);
}

function cleanDescription(text, conditionLabel) {
  if (typeof text !== 'string') return { ok: false, why: 'no description' };
  let d = text.replace(/\s+/g, ' ').trim();
  d = d.replace(/\s*Condition:[^.]*\.?\s*$/i, '').trim(); // the stored condition is appended below, never the model's
  if (d.length < MIN_DESC - 60) return { ok: false, why: 'too short' };
  if (/[<>]/.test(d)) return { ok: false, why: 'markup' };
  if (/\b(authentic|genuine|guaranteed|brand new|NWT)\b/i.test(d)) return { ok: false, why: 'claim word' };
  if (/on record|recorded|the title|listing title|the listing|\brecords?\b|sources?\b/i.test(d)) return { ok: false, why: 'meta wording' };
  if (!/[.!?]$/.test(d)) d += '.';
  if (conditionLabel && CONDITION_LABELS[conditionLabel]) d += ' Condition: ' + conditionLabel + '.';
  if (d.length > MAX_DESC) return { ok: false, why: 'too long' };
  return { ok: true, text: d };
}

async function main() {
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  const latest = new Map();
  for (const line of fs.readFileSync(path.join(WORK, resultsName), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.ok && r.result) latest.set(r.sku, r);
  }
  const skus = [...latest.keys()];
  const { rows } = await db.query(
    'SELECT id, sku, title, brand, condition_label, description, vertical_attributes FROM catalog_products WHERE sku = ANY($1)', [skus]);
  const bySku = new Map(rows.map((r) => [r.sku, r]));

  const plan = [];
  const stats = { proposals: skus.length, rowsFound: 0, rowsChanged: 0, descSet: 0, descRejected: {}, fieldsFilled: {}, heldForReview: 0 };
  for (const sku of skus) {
    const row = bySku.get(sku);
    if (!row) continue;
    stats.rowsFound++;
    const res = latest.get(sku).result;
    const va = row.vertical_attributes || {};
    const changes = { va: {} };
    // Only high-confidence proposals are written. Medium and low ones carry notes on conflicts or doubt: held for review.
    if (res.confidence !== 'high') { stats.heldForReview = (stats.heldForReview || 0) + 1; continue; }
    const empty = (k) => !(va[k] !== undefined && va[k] !== null && String(Array.isArray(va[k]) ? va[k].join('') : va[k]).trim() !== '');

    const values = {
      department: DEPARTMENTS.has(res.department) ? res.department : null,
      itemType: clean(res.itemType, 40),
      size: clean(res.size, 20),
      sizeType: SIZE_TYPES.has(res.sizeType) ? res.sizeType : null,
      color: clean(res.color, 40),
      style: clean(res.style, 40),
      material: clean(res.material, 60),
      fit: clean(res.fit, 40),
    };
    for (const k of SPEC_KEYS) {
      if (values[k] && empty(k)) { changes.va[k] = values[k]; stats.fieldsFilled[k] = (stats.fieldsFilled[k] || 0) + 1; }
    }
    // Brand: only when the stored brand is empty and the title or a cited source supports it.
    const brand = clean(res.brand, 60);
    const titleHasBrand = brand && row.title && row.title.toLowerCase().includes(brand.toLowerCase());
    const sourced = Array.isArray(res.sources) && res.sources.length > 0;
    if (brand && !(row.brand && row.brand.trim()) && (titleHasBrand || sourced)) {
      changes.brand = brand;
      if (empty('brand')) changes.va.brand = brand;
      stats.fieldsFilled.brand = (stats.fieldsFilled.brand || 0) + 1;
    }
    // Description: only where the stored one is not proper (empty or under 200 characters).
    const stored = (row.description || '').trim();
    if (stored.length < MIN_DESC) {
      const d = cleanDescription(res.description, row.condition_label);
      if (d.ok) { changes.description = d.text; stats.descSet++; }
      else stats.descRejected[d.why] = (stats.descRejected[d.why] || 0) + 1;
    }
    const hasChange = changes.description || changes.brand || Object.keys(changes.va).length;
    if (!hasChange) continue;
    stats.rowsChanged++;
    plan.push({ id: row.id, sku, changes, before: { brand: row.brand, description: row.description, vertical_attributes: va } });
  }
  console.log(JSON.stringify(stats, null, 1));
  fs.writeFileSync(path.join(WORK, 'apply_plan.json'), JSON.stringify(plan.map((p) => ({ sku: p.sku, id: p.id, changes: p.changes, before_description: p.before.description, before_brand: p.before.brand })), null, 1));

  if (!APPLY) { console.log('DRY RUN: no writes. Set APPLY=1 to apply', plan.length, 'rows.'); await db.end(); return; }

  await db.query('BEGIN');
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS sku_enrich_backup_20261127 (
      sku text PRIMARY KEY, id uuid NOT NULL, brand text, description text,
      vertical_attributes jsonb, backed_up_at timestamptz NOT NULL DEFAULT now())`);
    await db.query(`INSERT INTO sku_enrich_backup_20261127 (sku, id, brand, description, vertical_attributes)
      SELECT cp.sku, cp.id, cp.brand, cp.description, cp.vertical_attributes FROM catalog_products cp
      WHERE cp.sku = ANY($1) ON CONFLICT (sku) DO NOTHING`, [plan.map((p) => p.sku)]);
    for (const p of plan) {
      const c = p.changes;
      const vaPatch = c.va && Object.keys(c.va).length ? c.va : null;
      await db.query(
        `UPDATE catalog_products SET
           description = COALESCE($2, description),
           brand = COALESCE($3, brand),
           vertical_attributes = CASE WHEN $4::jsonb IS NULL THEN vertical_attributes ELSE vertical_attributes || $4::jsonb END,
           "updatedAt" = now()
         WHERE id = $1`,
        [p.id, c.description || null, c.brand || null, vaPatch ? JSON.stringify(vaPatch) : null]);
    }
    await db.query('COMMIT');
    console.log('APPLIED', plan.length, 'rows');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    await db.end();
  }
}
main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
