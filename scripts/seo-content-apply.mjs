#!/usr/bin/env node
/**
 * seo-content-apply.mjs — write vehicle-aware SEO titles and structured
 * descriptions (see seo-content.mjs) into the pipeline CSVs for every row whose
 * fitment has been validated (`Fitment Status = verified_mvl`).
 *
 * DRY-RUN BY DEFAULT: prints what would change and writes nothing. `--apply`
 * backs up both CSVs into `_backup-seo-content-<timestamp>/` first, then updates:
 *   - <stem>.complete-fitment-enriched.csv   `SEO Title`, `SEO Description`
 *                                            (and `Title` when it mirrored SEO Title)
 *   - <stem>.complete.ebay-listings-ready.csv `*Title`, `*Description` on the main row
 * It never touches the database and never publishes. Regenerate the PartsBazar360
 * exports afterwards with create-partsbazar360-csv.mjs.
 *
 * Safety: before writing, the CSV is parsed and re-serialized; if that does not
 * reproduce the original file byte-for-byte (line endings aside), the run aborts.
 *
 * Usage:
 *   node scripts/seo-content-apply.mjs [--dir DIR] [--samples N] [--skus a,b] [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseCsv, value } from './price-enrich-catalog.mjs';
import { buildSeoTitle, buildSeoDescription, tidyFitments, chassisCodes, isRemanProne, TITLE_MAX, DESCRIPTION_MAX } from './seo-content.mjs';

const ROOT = process.env.PIPELINE_ROOT || '/app';
const SOURCE_FILE = 'napa_ebay_shopify_listings.complete-fitment-enriched.csv';
const READY_FILE = 'napa_ebay_shopify_listings.complete.ebay-listings-ready.csv';

function parseArgs(argv) {
  const out = { samples: 5 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') out.dir = argv[++i];
    else if (argv[i] === '--samples') out.samples = Number(argv[++i]);
    else if (argv[i] === '--skus') out.skus = String(argv[++i]).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (argv[i] === '--apply') out.apply = true;
  }
  return out;
}

function csvCell(input) {
  const text = input == null ? '' : String(input);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function serialize(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header] ?? '')).join(','));
  return `${lines.join('\n')}\n`;
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parsed = parseCsv(text);
  const headers = parsed.shift();
  const rows = parsed.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
  const original = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (serialize(headers, rows) !== original) {
    throw new Error(`Refusing to touch ${path.basename(file)}: parsing and re-serializing it does not reproduce the file exactly.`);
  }
  return { headers, rows };
}

function parseFitments(row) {
  try { return JSON.parse(row['Fitment Data'] || '[]'); } catch { return []; }
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const dir = cli.dir || `${ROOT}/output/ebay-pipeline`;
  const sourcePath = path.join(dir, SOURCE_FILE);
  const readyPath = path.join(dir, READY_FILE);

  const source = readCsv(sourcePath);
  const targets = source.rows.filter((row) => {
    if (row['Fitment Status'] !== 'verified_mvl') return false;
    if (cli.skus && !cli.skus.includes(value(row, 'Custom Label (SKU)').toLowerCase())) return false;
    return tidyFitments(parseFitments(row)).length > 0;
  });

  const changes = [];
  for (const row of targets) {
    const fits = parseFitments(row);
    const input = {
      brand: value(row, 'Brand'), mpn: value(row, 'MPN'), partType: value(row, 'Product Type', 'Part Type'),
      upc: value(row, 'UPC'), ean: value(row, 'EAN'), oem: value(row, 'Interchange Part Number'), series: value(row, 'Manufacturer Series'),
    };
    const title = buildSeoTitle(input, fits);
    const description = buildSeoDescription(input, fits);
    changes.push({
      row, sku: value(row, 'Custom Label (SKU)'), input, title, description,
      oldTitle: row['SEO Title'], oldDescription: row['SEO Description'],
      titleMirrored: row.Title === row['SEO Title'],
    });
  }

  // Invariants: fail loudly rather than write a title or description eBay would reject.
  const tooLong = changes.filter((c) => c.title.length > TITLE_MAX);
  const descTooLong = changes.filter((c) => c.description.length > DESCRIPTION_MAX);
  // A title must carry the part number and must not end on a dangling "for".
  const badTitle = changes.filter((c) => !c.title.includes(c.input.mpn) || /\bfor$/i.test(c.title));
  if (tooLong.length || descTooLong.length || badTitle.length) {
    throw new Error(`Invariant failure: ${tooLong.length} title(s) > ${TITLE_MAX}, ${descTooLong.length} description(s) > ${DESCRIPTION_MAX}, ${badTitle.length} malformed title(s). Nothing written.`);
  }

  const changed = changes.filter((c) => c.title !== c.oldTitle || c.description !== c.oldDescription);
  const reman = changes.filter((c) => isRemanProne(c.input.partType));
  const summary = {
    mode: cli.apply ? 'APPLY' : 'dry-run',
    directory: dir,
    rowsWithValidatedFitment: targets.length,
    rowsChanged: changed.length,
    titleLength: { max: Math.max(...changes.map((c) => c.title.length)), avg: Math.round(changes.reduce((s, c) => s + c.title.length, 0) / (changes.length || 1)) },
    descriptionLength: { max: Math.max(...changes.map((c) => c.description.length)) },
    titlesWithChassisCode: changes.filter((c) => chassisCodes(tidyFitments(parseFitments(c.row))).some((code) => c.title.includes(` ${code}`))).length,
    remanProneRowsDescribedWithoutNew: reman.length,
    remanProneSkus: reman.map((c) => c.sku),
    rowsWithoutImage: changes.filter((c) => !c.row['Image URL']).map((c) => c.sku),
  };

  console.log(JSON.stringify(summary, null, 2));
  for (const c of changes.slice(0, cli.samples)) {
    console.log(`\n${c.sku}\n  old: ${c.oldTitle}\n  new: ${c.title}  (${c.title.length})\n  desc: ${c.description.slice(0, 420)}${c.description.length > 420 ? '…' : ''}`);
  }

  if (!cli.apply) {
    console.log('\nDry run only — nothing written. Re-run with --apply to update the CSVs (backups are taken first).');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(dir, `_backup-seo-content-${stamp}`);
  fs.mkdirSync(backup, { recursive: true });
  fs.copyFileSync(sourcePath, path.join(backup, SOURCE_FILE));
  const haveReady = fs.existsSync(readyPath);
  if (haveReady) fs.copyFileSync(readyPath, path.join(backup, READY_FILE));

  const bySku = new Map(changes.map((c) => [c.sku.toLowerCase(), c]));
  for (const c of changes) {
    if (c.titleMirrored) c.row.Title = c.title;
    c.row['SEO Title'] = c.title;
    c.row['SEO Description'] = c.description;
    if ('Title Status' in c.row) c.row['Title Status'] = 'completed_vehicle_enriched';
  }
  fs.writeFileSync(sourcePath, serialize(source.headers, source.rows));

  let readyPatched = 0;
  if (haveReady) {
    const ready = readCsv(readyPath);
    for (const row of ready.rows) {
      const c = bySku.get(String(row['CustomLabel (SKU)'] || row['Custom Label (SKU)'] || '').toLowerCase());
      if (!c || !row['*Title']) continue;
      row['*Title'] = c.title;
      row['*Description'] = c.description;
      readyPatched += 1;
    }
    fs.writeFileSync(readyPath, serialize(ready.headers, ready.rows));
  }

  const manifest = { ...summary, readyRowsPatched: readyPatched, backup, appliedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'seo-content.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nApplied. Backups: ${backup}\nREADY rows patched: ${readyPatched}\nNext: node scripts/create-partsbazar360-csv.mjs`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`[seo-content-apply] ${error?.message || error}`); process.exitCode = 1; }
}
