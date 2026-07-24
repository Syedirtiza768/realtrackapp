/**
 * Backfill listing_records.cType for warehouse-intake rows still holding the
 * intake form's filler part-source value (OEM/Aftermarket/Salvage/etc.)
 * instead of a real part descriptor.
 *
 * cType is what listing-builder.service.ts actually reads as the title's
 * Part Name at eBay publish time (and it's what /catalog and /inventory
 * would show if title itself needed rebuilding) -- unlike
 * catalog_products.part_type / optimized_title, which single-listing-form
 * autoEnrichListing now fixes going forward for NEW parts (see
 * single-listing-form.service.ts). This script is the one-off backfill for
 * rows created before that fix.
 *
 * Mirrors the stripping logic in
 * backend/src/listings/utils/derive-part-name-from-title.ts (duplicated
 * here rather than requiring compiled dist output, to keep this one-off
 * script self-contained).
 *
 * Usage (run inside the backend container):
 *   docker compose exec backend node scripts/backfill-warehouse-intake-ctype.cjs
 *
 * Env:
 *   DRY_RUN=1   list matching rows only, do not update the DB
 */
const { Client } = require('pg');

const DRY_RUN = process.env.DRY_RUN === '1';

const FILLER_CTYPES = new Set([
  'oem',
  'aftermarket',
  'salvage',
  'used',
  'new',
  'general',
  'unknown',
  'other',
  '',
]);

const STOP_WORDS = new Set([
  'oem',
  'genuine',
  'used',
  'new',
  'original',
  'factory',
  'oe',
  'fits',
]);

function stripSpecialChars(value) {
  return (value ?? '')
    .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function derivePartNameFromTitle(title, partNumber, brand) {
  if (!title || !title.trim()) return undefined;

  const brandTokens = new Set(
    (brand ?? '').toLowerCase().split(/\s+/).filter(Boolean),
  );
  const normalize = (v) => v.toLowerCase().replace(/[\s-]/g, '');
  const targetPn = normalize(partNumber ?? '');

  const words = stripSpecialChars(title)
    .split(/\s+/)
    .filter((w) => {
      const lower = w.toLowerCase();
      if (STOP_WORDS.has(lower)) return false;
      if (brandTokens.has(lower)) return false;
      if (targetPn && normalize(w) === targetPn) return false;
      if (/^[a-z0-9-]{8,}$/i.test(w) && /\d/.test(w)) return false;
      if (/^(19|20)\d{2}([-/](19|20)?\d{2})?$/.test(w)) return false;
      return true;
    });

  const name = words.join(' ').replace(/\s+/g, ' ').trim();
  return name.length >= 3 ? name.slice(0, 80) : undefined;
}

async function main() {
  const pg = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro',
  });
  await pg.connect();

  try {
    const { rows } = await pg.query(
      `SELECT id, "customLabelSku", title, "cType", "cBrand",
              "cOeOemPartNumber", "cManufacturerPartNumber"
       FROM listing_records
       WHERE origin = 'add_part' AND "deletedAt" IS NULL`,
    );

    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const current = (row.cType ?? '').trim().toLowerCase();
      if (!FILLER_CTYPES.has(current)) continue;

      const partNumber = row.cOeOemPartNumber || row.cManufacturerPartNumber;
      const derived = derivePartNameFromTitle(row.title, partNumber, row.cBrand);
      if (!derived) {
        skipped += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `[DRY RUN] ${row.customLabelSku}: "${row.cType ?? ''}" -> "${derived}"`,
        );
      } else {
        await pg.query('UPDATE listing_records SET "cType" = $1 WHERE id = $2', [
          derived,
          row.id,
        ]);
      }
      updated += 1;
    }

    console.log(
      `${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'} ${updated} row(s), skipped ${skipped} (title had no usable part descriptor).`,
    );
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
