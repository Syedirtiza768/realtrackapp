require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { AppModule } = require('/app/dist/src/app.module.js');
const { ListingsService } = require('/app/dist/src/listings/listings.service.js');
const { ListingRecord } = require('/app/dist/src/listings/listing-record.entity.js');

const JOBS = [
  'a12a32b2-849e-412b-a434-e2e1b23f790f', 'e9726294-82a3-459c-bdb3-484de0811e0e',
  'a082d0bd-4dae-48f3-a914-d7a67ead9864', '92b82f1d-6599-40f9-b8cd-03ffca244992',
  'da12f07b-fcc8-4866-86af-37d1d9c5634e', '75b3bf37-93a2-49c2-9b69-7c5bd2a445a4',
  '90913a70-4826-48a1-a06a-a6b2045d8550', '18090d95-df6b-48a0-aed3-736a3029985b',
];
const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 8;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function parsePricingSheet(csv) {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) => row.some((value) => String(value).trim() === 'Part Number'));
  if (headerIndex < 0) throw new Error('Part Number header not found in supplied workbook preview');
  const header = rows[headerIndex].map((value) => String(value).trim());
  const partIndex = header.indexOf('Part Number');
  const costIndex = header.indexOf('Cost Price (AED)');
  if (costIndex < 0) throw new Error('Cost Price (AED) header not found in supplied workbook preview');

  const prices = new Map();
  const duplicates = [];
  const invalid = [];
  const bands = { '0-15': 0, '16-21': 0, '22-25': 0, 'above-25': 0 };
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const sku = String(row[partIndex] || '').trim();
    if (!sku) continue;
    const rawCost = String(row[costIndex] || '').trim().replace(/,/g, '');
    const costAed = Number(rawCost);
    if (!Number.isFinite(costAed) || costAed < 0) {
      invalid.push({ row: i + 1, sku, rawCost });
      continue;
    }
    if (prices.has(sku)) duplicates.push(sku);
    const priceUsd = costAed <= 15 ? 38 : costAed <= 21 ? 45.99 : costAed <= 25 ? 49.99 : Math.round(costAed * 2 * 100) / 100;
    const band = costAed <= 15 ? '0-15' : costAed <= 21 ? '16-21' : costAed <= 25 ? '22-25' : 'above-25';
    bands[band] += 1;
    prices.set(sku, { costAed, priceUsd, band });
  }
  return { prices, duplicates: [...new Set(duplicates)], invalid, bands, sourceRows: rows.length - headerIndex - 1 };
}

async function mapConcurrent(items, worker) {
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
}

(async () => {
  let app;
  const input = [];
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input.push(chunk);
  const source = parsePricingSheet(input.join(''));
  const result = {
    mode: APPLY ? 'apply' : 'dry-run',
    sourceRows: source.sourceRows,
    sourceSkus: source.prices.size,
    sourceDuplicates: source.duplicates.length,
    sourceInvalid: source.invalid.length,
    sourceBands: source.bands,
    productionListings: 0,
    matched: 0,
    missingSourceCost: [],
    alreadyCorrect: 0,
    toUpdate: 0,
    changed: 0,
    failed: [],
    examples: [],
  };

  try {
    if (source.duplicates.length || source.invalid.length) {
      throw new Error(`Source validation failed: ${source.duplicates.length} duplicate SKUs, ${source.invalid.length} invalid costs`);
    }
    app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const dataSource = app.get(DataSource);
    const listingRepo = dataSource.getRepository(ListingRecord);
    const listingsService = app.get(ListingsService);
    const listings = await listingRepo.createQueryBuilder('r')
      .select(['r.id', 'r.customLabelSku', 'r.startPrice', 'r.startPriceNum', 'r.version', 'r.status', 'r.pipelineJobId', 'r.vertical', 'r.ebayListingId', 'r.shopifyProductId'])
      .where('r.pipelineJobId IN (:...jobs)', { jobs: JOBS })
      .andWhere('r.status = :status', { status: 'draft' })
      .andWhere('r.vertical = :vertical', { vertical: 'automotive' })
      .andWhere('r.customLabelSku IS NOT NULL')
      .andWhere('r.ebayListingId IS NULL')
      .andWhere('r.shopifyProductId IS NULL')
      .orderBy('r.customLabelSku', 'ASC')
      .getMany();
    result.productionListings = listings.length;

    const candidates = [];
    for (const listing of listings) {
      const sku = String(listing.customLabelSku);
      const sourceRow = source.prices.get(sku);
      if (!sourceRow) {
        result.missingSourceCost.push(sku);
        continue;
      }
      result.matched += 1;
      const current = Number(listing.startPriceNum ?? listing.startPrice);
      if (Number.isFinite(current) && Math.round(current * 100) === Math.round(sourceRow.priceUsd * 100)) {
        result.alreadyCorrect += 1;
        continue;
      }
      candidates.push({ listing, sourceRow });
      if (result.examples.length < 20) {
        result.examples.push({ sku, costAed: sourceRow.costAed, band: sourceRow.band, before: listing.startPrice, after: sourceRow.priceUsd.toFixed(2) });
      }
    }
    result.toUpdate = candidates.length;
    if (result.missingSourceCost.length) throw new Error(`Missing source cost for ${result.missingSourceCost.length} production SKUs`);

    if (APPLY) {
      const active = await dataSource.query("select count(*)::int as count from pipeline_jobs where status not in ('completed','failed','cancelled','canceled')");
      if (Number(active[0]?.count || 0) > 0) throw new Error(`Active pipeline jobs present: ${active[0].count}`);
      await mapConcurrent(candidates, async ({ listing, sourceRow }) => {
        try {
          await listingsService.update(listing.id, {
            version: listing.version,
            startPrice: sourceRow.priceUsd.toFixed(2),
          });
          result.changed += 1;
        } catch (error) {
          result.failed.push({ sku: listing.customLabelSku, error: error?.message || String(error) });
        }
      });
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.failed.length) process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({ error: error?.message || String(error), stack: error?.stack, result }));
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
  }
})();
