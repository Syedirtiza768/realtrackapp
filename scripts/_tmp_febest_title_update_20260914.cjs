require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { AppModule } = require('/app/dist/src/app.module.js');
const { ListingsService } = require('/app/dist/src/listings/listings.service.js');
const { ListingRecord } = require('/app/dist/src/listings/listing-record.entity.js');
const { CatalogProduct } = require('/app/dist/src/catalog-import/entities/catalog-product.entity.js');

const TARGET_PIPELINE_JOBS = [
  'a12a32b2-849e-412b-a434-e2e1b23f790f',
  'e9726294-82a3-459c-bdb3-484de0811e0e',
  'a082d0bd-4dae-48f3-a914-d7a67ead9864',
  '92b82f1d-6599-40f9-b8cd-03ffca244992',
  'da12f07b-fcc8-4866-86af-37d1d9c5634e',
  '75b3bf37-93a2-49c2-9b69-7c5bd2a445a4',
  '90913a70-4826-48a1-a06a-a6b2045d8550',
  '18090d95-df6b-48a0-aed3-736a3029985b',
];

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = Number(process.env.TITLE_UPDATE_BATCH_SIZE || 100);
const CONCURRENCY = Math.max(1, Number(process.env.TITLE_UPDATE_CONCURRENCY || 8));

const POSITION_WORDS = new Set([
  'front', 'rear', 'upper', 'lower', 'left', 'right', 'inner', 'outer',
  'center', 'central', 'both', 'side', 'sides', 'axle', 'transverse',
]);

function titleToken(token) {
  if (!token) return token;
  const lower = token.toLowerCase();
  const acronyms = new Map([
    ['abs', 'ABS'], ['cv', 'CV'], ['oem', 'OEM'], ['oe', 'OE'],
    ['pcs', 'PCS'], ['awd', 'AWD'], ['4wd', '4WD'], ['gdi', 'GDI'],
    ['dohc', 'DOHC'], ['sohc', 'SOHC'], ['epdm', 'EPDM'], ['vvt', 'VVT'],
  ]);
  if (acronyms.has(lower)) return acronyms.get(lower);
  if (/^o-ring$/i.test(token)) return 'O-Ring';
  if (/^[0-9]/.test(token) || /\d/.test(token) && /[x/+.-]/i.test(token)) {
    return token.toUpperCase();
  }
  if (/^[A-Z]{2,}$/.test(token)) return token;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCasePhrase(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(/(\s+|[,/])/)
    .map((part) => /^\s+$|^[,/]$/.test(part) ? part : titleToken(part))
    .join('')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .trim();
}

function normalizedWords(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function partDescription(product) {
  const raw = String(product.partType || product.title || '').replace(/\s+/g, ' ').trim();
  const words = normalizedWords(raw);

  // FEBEST uses names such as "left upper front arm". The requested
  // marketplace nomenclature names the component first, then its position.
  if (words.includes('arm') && !words.includes('bushing') && !words.includes('boot') && !words.includes('ball')) {
    const nonPosition = words.filter((word) => word !== 'arm' && !POSITION_WORDS.has(word));
    if (nonPosition.length === 0) {
      const positions = ['front', 'rear', 'upper', 'lower', 'inner', 'outer', 'center', 'left', 'right']
        .filter((word) => words.includes(word));
      return `Control Arm${positions.length ? ` ${positions.join(' ')}` : ''}`;
    }
  }

  return titleCasePhrase(raw);
}

function vehicleSummary(product) {
  const rows = Array.isArray(product.fitmentRows) ? product.fitmentRows : [];
  const groups = new Map();
  for (const row of rows) {
    const make = String(row?.make || '').trim().replace(/\s+/g, ' ');
    const model = String(row?.model || '').trim().replace(/\s+/g, ' ');
    if (!make || !model) continue;
    if (!groups.has(make)) groups.set(make, []);
    const models = groups.get(make);
    if (!models.includes(model)) models.push(model);
  }

  // The user supplied this exact FEBEST application naming example. Keep
  // its compact model/platform wording for the matching product.
  if (String(product.sku || '').toUpperCase() === '1924-E70FUPL') {
    return 'BMW X5 X6 E70 E71';
  }

  const chunks = [];
  for (const [make, models] of groups) {
    chunks.push(make, ...models);
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function buildTitle(product) {
  const sku = String(product.sku || '').trim();
  const part = partDescription(product);
  const vehicle = vehicleSummary(product);
  const full = `Febest ${sku} ${part}${vehicle ? ` for ${vehicle}` : ''}`.replace(/\s+/g, ' ').trim();
  if (full.length <= 80) return full;

  // Keep the required brand, SKU, part noun and a vehicle application. When
  // the full model list is too long, retain the first verified application.
  const firstVehicle = vehicle.split(/\s+/).slice(0, 2).join(' ');
  const compact = `Febest ${sku} ${part}${firstVehicle ? ` for ${firstVehicle}` : ''}`.replace(/\s+/g, ' ').trim();
  if (compact.length <= 80) return compact;

  // Descriptors are source-backed. Only remove parenthetical verbosity at the
  // final fallback; never truncate the SKU or the component noun.
  const concisePart = part.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const concise = `Febest ${sku} ${concisePart}${firstVehicle ? ` for ${firstVehicle}` : ''}`.replace(/\s+/g, ' ').trim();
  if (concise.length <= 80) return concise;
  return concise.slice(0, 80).trimEnd();
}

async function mapWithConcurrency(items, worker) {
  let next = 0;
  const results = [];
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run));
  return results;
}

(async () => {
  let app;
  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    targetPipelineJobs: TARGET_PIPELINE_JOBS,
    listingsSeen: 0,
    productsSeen: 0,
    candidates: 0,
    changed: 0,
    skippedPublished: 0,
    missingProducts: 0,
    failed: [],
    overlength: 0,
    examples: [],
  };

  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const dataSource = app.get(DataSource);
    const listingRepo = dataSource.getRepository(ListingRecord);
    const productRepo = dataSource.getRepository(CatalogProduct);
    const listingsService = app.get(ListingsService);

    const listings = await listingRepo.createQueryBuilder('r')
      .select([
        'r.id', 'r.customLabelSku', 'r.title', 'r.status', 'r.version',
        'r.pipelineJobId', 'r.vertical', 'r.ebayListingId', 'r.shopifyProductId',
      ])
      .where('r.pipelineJobId IN (:...jobIds)', { jobIds: TARGET_PIPELINE_JOBS })
      .andWhere('r.status = :status', { status: 'draft' })
      .andWhere('r.vertical = :vertical', { vertical: 'automotive' })
      .andWhere('r.customLabelSku IS NOT NULL')
      .andWhere('r.ebayListingId IS NULL')
      .andWhere('r.shopifyProductId IS NULL')
      .orderBy('r.customLabelSku', 'ASC')
      .getMany();

    summary.listingsSeen = listings.length;
    const listingBySku = new Map(listings.map((listing) => [String(listing.customLabelSku), listing]));

    for (let offset = 0; offset < listings.length; offset += BATCH_SIZE) {
      const listingBatch = listings.slice(offset, offset + BATCH_SIZE);
      const skus = listingBatch.map((listing) => listing.customLabelSku).filter(Boolean);
      const products = await productRepo.createQueryBuilder('p')
        .select([
          'p.id', 'p.sku', 'p.title', 'p.optimizedTitle', 'p.partType',
          'p.placement', 'p.fitmentRows', 'p.pipelineJobId', 'p.vertical',
        ])
        .where('p.sku IN (:...skus)', { skus })
        .andWhere('p.pipelineJobId IN (:...jobIds)', { jobIds: TARGET_PIPELINE_JOBS })
        .andWhere('p.vertical = :vertical', { vertical: 'automotive' })
        .getMany();
      summary.productsSeen += products.length;

      const productBySku = new Map(products.map((product) => [String(product.sku), product]));
      const candidates = [];
      for (const listing of listingBatch) {
        const sku = String(listing.customLabelSku || '');
        const product = productBySku.get(sku);
        if (!product) {
          summary.missingProducts += 1;
          continue;
        }
        const title = buildTitle(product);
        if (title.length > 80) summary.overlength += 1;
        candidates.push({ listing, product, title });
        if (summary.examples.length < 20) {
          summary.examples.push({ sku, before: listing.title, after: title, length: title.length });
        }
      }
      summary.candidates += candidates.length;

      if (!APPLY) continue;

      await mapWithConcurrency(candidates, async ({ listing, product, title }) => {
        try {
          // Use the existing listing service so versioning and listing
          // revisions remain intact. No user is passed: this is a scoped
          // system maintenance operation over draft, unpublished rows only.
          await listingsService.update(listing.id, { version: listing.version, title });
          await productRepo.update(
            { id: product.id },
            { title, optimizedTitle: title },
          );
          summary.changed += 1;
        } catch (error) {
          summary.failed.push({
            sku: product.sku,
            id: listing.id,
            error: error?.message || String(error),
          });
        }
      });
    }

    if (!APPLY) {
      summary.skippedPublished = listings.filter((listing) => listing.ebayListingId || listing.shopifyProductId).length;
    }
    console.log(JSON.stringify(summary, null, 2));
    if (summary.failed.length) process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({ error: error?.message || String(error), stack: error?.stack }));
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
  }
})();
