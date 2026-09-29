require('reflect-metadata');

const { NestFactory } = require('@nestjs/core');
const { DataSource } = require('typeorm');
const { AppModule } = require('/app/dist/src/app.module.js');
const { ListingsService } = require('/app/dist/src/listings/listings.service.js');
const { ListingRecord } = require('/app/dist/src/listings/listing-record.entity.js');
const { CatalogProduct } = require('/app/dist/src/catalog-import/entities/catalog-product.entity.js');

const JOBS = [
  'a12a32b2-849e-412b-a434-e2e1b23f790f', 'e9726294-82a3-459c-bdb3-484de0811e0e',
  'a082d0bd-4dae-48f3-a914-d7a67ead9864', '92b82f1d-6599-40f9-b8cd-03ffca244992',
  'da12f07b-fcc8-4866-86af-37d1d9d5634e', '75b3bf37-93a2-49c2-9b69-7c5bd2a445a4',
  '90913a70-4826-48a1-a06a-a6b2045d8550', '18090d95-df6b-48a0-aed3-736a3029985b',
];
const POSITIONS = new Set(['front', 'rear', 'upper', 'lower', 'left', 'right', 'inner', 'outer', 'center', 'central', 'both', 'side', 'sides']);
const CONCURRENCY = 8;

function fixTitle(title) {
  const marker = ' for ';
  const split = String(title || '').split(marker);
  if (split.length !== 2) return title;
  const head = split[0].split(/\s+/);
  const controlIndex = head.findIndex((token, index) => token === 'Control' && head[index + 1] === 'Arm');
  if (controlIndex < 0) return title;
  for (let i = controlIndex + 2; i < head.length; i += 1) {
    const lower = head[i].toLowerCase();
    if (POSITIONS.has(lower)) head[i] = lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return `${head.join(' ')}${marker}${split[1]}`;
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
  const result = { candidates: 0, changed: 0, failed: [], examples: [] };
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const dataSource = app.get(DataSource);
    const listingRepo = dataSource.getRepository(ListingRecord);
    const productRepo = dataSource.getRepository(CatalogProduct);
    const listingsService = app.get(ListingsService);
    const listings = await listingRepo.createQueryBuilder('r')
      .select(['r.id', 'r.customLabelSku', 'r.title', 'r.version'])
      .where('r.pipelineJobId IN (:...jobs)', { jobs: JOBS })
      .andWhere('r.status = :status', { status: 'draft' })
      .andWhere('r.vertical = :vertical', { vertical: 'automotive' })
      .andWhere('r.title ILIKE :pattern', { pattern: 'Febest % Control Arm % for %' })
      .andWhere('r.ebayListingId IS NULL')
      .andWhere('r.shopifyProductId IS NULL')
      .getMany();
    result.candidates = listings.length;
    const products = await productRepo.createQueryBuilder('p')
      .select(['p.id', 'p.sku', 'p.title', 'p.optimizedTitle'])
      .where('p.sku IN (:...skus)', { skus: listings.map((l) => l.customLabelSku) })
      .andWhere('p.pipelineJobId IN (:...jobs)', { jobs: JOBS })
      .getMany();
    const productBySku = new Map(products.map((p) => [String(p.sku), p]));
    await mapConcurrent(listings, async (listing) => {
      const nextTitle = fixTitle(listing.title);
      if (nextTitle === listing.title) return;
      const product = productBySku.get(String(listing.customLabelSku));
      try {
        await listingsService.update(listing.id, { version: listing.version, title: nextTitle });
        if (product) await productRepo.update({ id: product.id }, { title: nextTitle, optimizedTitle: nextTitle });
        result.changed += 1;
        if (result.examples.length < 10) result.examples.push({ sku: listing.customLabelSku, title: nextTitle });
      } catch (error) {
        result.failed.push({ sku: listing.customLabelSku, error: error?.message || String(error) });
      }
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.failed.length) process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({ error: error?.message || String(error), stack: error?.stack }));
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
  }
})();
