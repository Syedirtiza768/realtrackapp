/**
 * extract-fitment.ts
 *
 * Parses Make + Model from listing titles and populates
 * fitment_makes, fitment_models, and part_fitments tables.
 *
 * Usage:  npx ts-node -r tsconfig-paths/register src/scripts/extract-fitment.ts
 * Or:     node dist/scripts/extract-fitment.js
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/* ──────────────────  Known multi-word makes  ────────────────── */
const MULTI_WORD_MAKES: string[] = [
  'Land Rover',
  'Mercedes-Benz',
  'Mercedes Benz',
  'Alfa Romeo',
  'Aston Martin',
  'Rolls Royce',
  'Rolls-Royce',
];

/* ──────────────────  Single-word make aliases  ────────────────── */
const MAKE_ALIASES: Record<string, string> = {
  'MERCEDES':       'Mercedes-Benz',
  'MERCEDES-BENZ':  'Mercedes-Benz',
  'MERCEDES BENZ':  'Mercedes-Benz',
  'MERC':           'Mercedes-Benz',
  'BENZ':           'Mercedes-Benz',
  'VW':             'Volkswagen',
  'VOLKSWAGON':     'Volkswagen',
  'LAND ROVER':     'Land Rover',
  'LANDROVER':      'Land Rover',
  'ROLLS ROYCE':    'Rolls-Royce',
  'ROLLS-ROYCE':    'Rolls-Royce',
  'ALFA ROMEO':     'Alfa Romeo',
  'ASTON MARTIN':   'Aston Martin',
  'MINI':           'MINI',
  'BMW':            'BMW',
  'CADILLAC':       'Cadillac',
};

/* ──────────────────  Skip words (not model names)  ────────────────── */
const SKIP_WORDS = new Set([
  // common part-description lead-ins
  'FRONT', 'REAR', 'LEFT', 'RIGHT', 'UPPER', 'LOWER', 'INNER',
  'OUTER', 'CENTER', 'INTERIOR', 'EXTERIOR', 'BODY', 'RADIO',
  'STEREO', 'AUDIO', 'HEADLIGHT', 'TAILLIGHT', 'DOOR', 'WINDOW',
  'SEAT', 'ENGINE', 'TURBO', 'ABS', 'A/C', 'AC', 'AIR', 'BRAKE',
  'POWER', 'ELECTRIC', 'ELECTRONIC', 'CENTRAL', 'CONTROL', 'MODULE',
  'CONTINENTAL', 'SIEMENS',
]);

/* ──────────────────  Known chassis / platform codes  ────────────────── */
const CHASSIS_RE = /^[A-Z]{0,2}\d{2,4}[A-Z]?$/i;  // e.g. W209, E90, R50, L320, L405
function isChassis(w: string): boolean {
  if (w.length < 2 || w.length > 6) return false;
  return CHASSIS_RE.test(w);
}

/* ──────────────────  Known automotive makes (whitelist)  ────────────────── */
const KNOWN_MAKES = new Set([
  'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'BMW', 'Bentley', 'Buick',
  'Cadillac', 'Chevrolet', 'Chrysler', 'Citroen', 'DS', 'Dodge',
  'Ferrari', 'Fiat', 'Ford', 'GMC', 'Genesis', 'Honda', 'Hyundai',
  'Infiniti', 'Jaguar', 'Jeep', 'Jetour', 'Kia',
  'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln',
  'MINI', 'Maserati', 'Maybach', 'Mazda', 'Mercedes-Benz', 'Mitsubishi',
  'Nissan', 'Opel', 'Peugeot', 'Pontiac', 'Porsche',
  'Ram', 'Renault', 'Rolls-Royce',
  'Saab', 'Skoda', 'Soueast', 'Subaru', 'Suzuki',
  'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
]);
const KNOWN_MAKES_UPPER = new Map<string, string>();
for (const m of KNOWN_MAKES) KNOWN_MAKES_UPPER.set(m.toUpperCase(), m);

/* ──────────────────  Year-range regex  ────────────────── */
// Handles: YYYY-YYYY, YY-YY, YYYY+, YYYY-Present, #, just YYYY
const YEAR_RANGE_RE = /^#?\s*(\d{2,4})\s*(?:[-–]\s*(\d{2,4}|present|current))?\+?\s+/i;

interface ParsedFitment {
  make: string;
  model: string;
  yearStart: number | null;
  yearEnd: number | null;
}

function normaliseYear(y: string): number {
  const n = parseInt(y, 10);
  if (n < 100) {
    return n >= 50 ? 1900 + n : 2000 + n;
  }
  return n;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normaliseMake(raw: string): string {
  const up = raw.toUpperCase();
  if (MAKE_ALIASES[up]) return MAKE_ALIASES[up];
  // Check the known-makes map for canonical casing
  if (KNOWN_MAKES_UPPER.has(up)) return KNOWN_MAKES_UPPER.get(up)!;
  // Already title-cased brand names like "Jaguar" → keep as-is
  // Full uppercase → title-case it
  if (raw === raw.toUpperCase() && raw.length > 3) return titleCase(raw);
  return raw;
}

function isKnownMake(candidate: string): boolean {
  const up = candidate.toUpperCase();
  return KNOWN_MAKES_UPPER.has(up) || !!MAKE_ALIASES[up];
}

/* ──────────────────  Title parser  ────────────────── */
function parseTitleFitment(title: string): ParsedFitment | null {
  if (!title) return null;

  let rest = title.trim();
  let yearStart: number | null = null;
  let yearEnd: number | null = null;

  // Strip leading year range (including YYYY+, YYYY-Present, multi-token ranges)
  // Loop to strip multiple year tokens (e.g., "# MINI" or repeated years)
  let matched = true;
  while (matched) {
    matched = false;
    const ym = rest.match(YEAR_RANGE_RE);
    if (ym) {
      yearStart = normaliseYear(ym[1]);
      const y2 = ym[2];
      if (y2 && !/present|current/i.test(y2)) {
        yearEnd = normaliseYear(y2);
      } else {
        yearEnd = yearStart;
      }
      rest = rest.slice(ym[0].length).trim();
      matched = true;
    }
    // Also strip a bare '#' at the start
    if (rest.startsWith('#')) {
      rest = rest.replace(/^#\s*/, '');
      matched = true;
    }
  }

  // Try multi-word makes first
  let make: string | null = null;
  for (const mw of MULTI_WORD_MAKES) {
    if (rest.toUpperCase().startsWith(mw.toUpperCase())) {
      make = normaliseMake(mw);
      rest = rest.slice(mw.length).trim();
      break;
    }
  }

  if (!make) {
    // Single-word make = first word
    const parts = rest.split(/\s+/);
    if (parts.length < 2) return null;
    const rawMake = parts[0];
    // If make looks like a part description word, skip
    if (SKIP_WORDS.has(rawMake.toUpperCase())) return null;
    // Only accept if it's a known automotive make
    if (!isKnownMake(rawMake)) return null;
    make = normaliseMake(rawMake);
    rest = parts.slice(1).join(' ');
  }

  // Now extract model — first significant word (skip chassis codes)
  const words = rest.split(/\s+/);
  let model: string | null = null;
  let modelWords: string[] = [];

  for (let i = 0; i < words.length && i < 4; i++) {
    const w = words[i];
    if (!w) continue;
    // Skip chassis codes (W209, E90, R50 etc.) but keep them secondary
    if (isChassis(w) && !model) continue;
    // Skip known part description words
    if (SKIP_WORDS.has(w.toUpperCase())) break;
    // Check for known compound model names
    if (!model) {
      model = w;
      modelWords.push(w);
      // Check if next words extend the model name (e.g. "Range Rover Sport", "Flying Spur")
      const nextW = words[i + 1];
      if (nextW && !SKIP_WORDS.has(nextW.toUpperCase()) && !isChassis(nextW)) {
        // Known multi-word models
        const combined = w + ' ' + nextW;
        const knownCompounds = [
          'Range Rover', 'Flying Spur', 'Grand Cherokee',
          'X-Trail', 'X Trail',
        ];
        const combinedUp = combined.toUpperCase();
        for (const kc of knownCompounds) {
          if (combinedUp === kc.toUpperCase()) {
            model = combined;
            modelWords = [w, nextW];
            // Check for "Range Rover Sport"
            const thirdW = words[i + 2];
            if (thirdW && combined.toUpperCase() === 'RANGE ROVER' &&
                thirdW.toUpperCase() === 'SPORT') {
              model = combined + ' ' + thirdW;
              modelWords.push(thirdW);
            }
            break;
          }
        }
      }
      break;
    }
  }

  if (!model) {
    // Last resort: maybe the whole rest is the model + part combined
    // and first word IS the chassis code — use it as model
    if (words[0] && isChassis(words[0])) {
      model = words[0];
    } else {
      return null;
    }
  }

  // Clean model: remove trailing non-alphanumeric
  model = model.replace(/[,;:]+$/, '').trim();
  if (!model || model.length < 1) return null;

  return { make, model, yearStart, yearEnd };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ──────────────────  Main  ────────────────── */
async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'listingpro',
    synchronize: false,
  });

  await ds.initialize();
  console.log('Connected to database');

  // Load all listings
  const listings: { id: string; title: string; description: string | null }[] =
    await ds.query('SELECT id, title, description FROM listing_records');
  console.log(`Loaded ${listings.length} listings`);

  // Parse all titles
  const parsedRows: { listingId: string; make: string; model: string; yearStart: number; yearEnd: number }[] = [];
  // Canonical model name map: slug → first-seen display name
  const canonicalModel = new Map<string, string>(); // key: "make|||modelSlug" → display name

  let parsed = 0;
  let skipped = 0;
  for (const listing of listings) {
    const fitment = parseTitleFitment(listing.title);
    if (!fitment || !fitment.make || !fitment.model) {
      skipped++;
      continue;
    }
    parsed++;
    const modelSlug = slugify(fitment.model);
    const canonKey = fitment.make + '|||' + modelSlug;
    if (!canonicalModel.has(canonKey)) {
      canonicalModel.set(canonKey, fitment.model);
    }
    parsedRows.push({
      listingId: listing.id,
      make: fitment.make,
      model: canonicalModel.get(canonKey)!, // use canonical name
      yearStart: fitment.yearStart ?? 0,
      yearEnd: fitment.yearEnd ?? 0,
    });
  }

  console.log(`Parsed: ${parsed}, Skipped: ${skipped}`);

  // Collect unique makes
  const uniqueMakes = [...new Set(parsedRows.map(r => r.make))].sort();
  console.log(`Unique makes (${uniqueMakes.length}):`, uniqueMakes.join(', '));

  // Collect unique (make, model) combos — using canonical names so slugs are unique per make
  const uniqueModels = [
    ...new Set(parsedRows.map(r => r.make + '|||' + r.model)),
  ].sort();
  console.log(`Unique models: ${uniqueModels.length}`);

  // ─── Insert makes, models, fitments ───
  const makeIdMap = new Map<string, number>();
  const modelIdMap = new Map<string, number>();

  // ─── Clear existing extracted fitments and insert fresh ───
  console.log('Clearing existing fitment data...');
  await ds.query('DELETE FROM part_fitments');
  await ds.query('DELETE FROM fitment_models');
  await ds.query('DELETE FROM fitment_makes');

  // Re-insert makes/models (the maps already have unique values)
  makeIdMap.clear();
  for (const makeName of uniqueMakes) {
    const slug = slugify(makeName);
    const ins = await ds.query(
      'INSERT INTO fitment_makes (name, slug) VALUES ($1, $2) RETURNING id',
      [makeName, slug],
    );
    makeIdMap.set(makeName, ins[0].id);
  }
  console.log(`Inserted ${makeIdMap.size} makes`);

  modelIdMap.clear();
  for (const key of uniqueModels) {
    const [makeName, modelName] = key.split('|||');
    const makeId = makeIdMap.get(makeName)!;
    const slug = slugify(modelName);
    const ins = await ds.query(
      'INSERT INTO fitment_models (make_id, name, slug) VALUES ($1, $2, $3) RETURNING id',
      [makeId, modelName, slug],
    );
    modelIdMap.set(key, ins[0].id);
  }
  console.log(`Inserted ${modelIdMap.size} models`);

  // ─── Insert part_fitments in batches ───
  console.log(`Inserting ${parsedRows.length} part_fitments...`);
  const BATCH_SIZE = 500;

  for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
    const batch = parsedRows.slice(i, i + BATCH_SIZE);
    const values: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const row of batch) {
      const makeId = makeIdMap.get(row.make)!;
      const modelId = modelIdMap.get(row.make + '|||' + row.model)!;
      values.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`,
      );
      params.push(
        row.listingId,
        makeId,
        modelId,
        row.yearStart,
        row.yearEnd,
        'ai_detected',
        0.85,
      );
    }

    try {
      await ds.query(
        `INSERT INTO part_fitments (listing_id, make_id, model_id, year_start, year_end, source, confidence)
         VALUES ${values.join(', ')}`,
        params,
      );
    } catch (err: any) {
      console.error(`Batch error at offset ${i}:`, err.message);
    }

    if ((i / BATCH_SIZE) % 10 === 0) {
      process.stdout.write(`  ${i + batch.length}/${parsedRows.length}\r`);
    }
  }

  console.log(`\nDone! Inserted fitment rows.`);

  // Final counts
  const counts = await Promise.all([
    ds.query('SELECT COUNT(*) as c FROM fitment_makes'),
    ds.query('SELECT COUNT(*) as c FROM fitment_models'),
    ds.query('SELECT COUNT(*) as c FROM part_fitments'),
  ]);
  console.log(`Final counts:`);
  console.log(`  fitment_makes:  ${counts[0][0].c}`);
  console.log(`  fitment_models: ${counts[1][0].c}`);
  console.log(`  part_fitments:  ${counts[2][0].c}`);

  // Show top 10 makes by listing count
  const topMakes = await ds.query(
    `SELECT fm.name, COUNT(DISTINCT pf.listing_id) as cnt
     FROM part_fitments pf
     JOIN fitment_makes fm ON fm.id = pf.make_id
     GROUP BY fm.name ORDER BY cnt DESC LIMIT 10`,
  );
  console.log('\nTop 10 makes:');
  topMakes.forEach((r: any) => console.log(`  ${r.name}: ${r.cnt} listings`));

  await ds.destroy();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
