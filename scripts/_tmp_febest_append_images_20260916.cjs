require('reflect-metadata');

const fs = require('fs/promises');
const crypto = require('crypto');
const { NestFactory } = require('@nestjs/core');
const { DataSource, In } = require('typeorm');
const { AppModule } = require('/app/dist/src/app.module.js');
const { StorageService } = require('/app/dist/src/storage/storage.service.js');
const { ImageProcessorService } = require('/app/dist/src/storage/image-processor.service.js');
const { ListingRecord } = require('/app/dist/src/listings/listing-record.entity.js');
const { CatalogProduct } = require('/app/dist/src/catalog-import/entities/catalog-product.entity.js');

const ASSET_DIR = process.env.FEBEST_IMAGE_ASSET_DIR || '/job-assets';
const ASSET_FILES = ['1.jpeg', '2.jpeg', '3.jpeg'];
const IMAGE_NAMESPACE = 'catalog-images/febest-shared';
const CONCURRENCY = 12;

function parsePipeUrls(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw).split('|').map((url) => url.trim()).filter(Boolean);
}

function uniqueUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

async function mapConcurrent(items, worker) {
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, run),
  );
}

function progress(kind, payload) {
  console.log(JSON.stringify({ kind, at: new Date().toISOString(), ...payload }));
}

(async () => {
  let app;
  const result = {
    mode: 'apply',
    sourceScope: 'FEBEST listings with status != published and no external marketplace IDs',
    assetFiles: ASSET_FILES,
    uploadedImages: [],
    targetListings: 0,
    listingAlreadyComplete: 0,
    listingUpdated: 0,
    listingFailed: [],
    targetCatalogProducts: 0,
    catalogAlreadyComplete: 0,
    catalogUpdated: 0,
    catalogFailed: [],
    missingCatalogSkus: [],
  };

  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    const dataSource = app.get(DataSource);
    const storage = app.get(StorageService);
    const imageProcessor = app.get(ImageProcessorService);
    const listingRepo = dataSource.getRepository(ListingRecord);
    const productRepo = dataSource.getRepository(CatalogProduct);

    const imageUrls = [];
    for (let i = 0; i < ASSET_FILES.length; i += 1) {
      const filename = ASSET_FILES[i];
      const sourceBuffer = await fs.readFile(`${ASSET_DIR}/${filename}`);
      const converted = await imageProcessor.convertBufferToWebp(sourceBuffer);
      const digest = crypto
        .createHash('sha256')
        .update(converted.buffer)
        .digest('hex')
        .slice(0, 32);
      const key = `${IMAGE_NAMESPACE}/${i + 1}-${digest}.webp`;
      await storage.putObject(key, converted.buffer, 'image/webp');
      // Generate the same responsive WebP siblings used by catalog images.
      await imageProcessor.processImage(key);
      const url = storage.getCdnUrl(key);
      imageUrls.push(url);
      result.uploadedImages.push({ filename, key, url, bytes: converted.buffer.length });
      progress('asset-ready', { index: i + 1, total: ASSET_FILES.length, filename, key });
    }

    const listings = await listingRepo
      .createQueryBuilder('r')
      .select(['r.id', 'r.customLabelSku', 'r.itemPhotoUrl', 'r.status'])
      .where("LOWER(COALESCE(r.sourceFileName, '')) LIKE :source", { source: '%febest%' })
      .andWhere("r.status <> 'published'")
      .andWhere('r.deletedAt IS NULL')
      .andWhere('r.ebayListingId IS NULL')
      .andWhere('r.shopifyProductId IS NULL')
      .andWhere('r.customLabelSku IS NOT NULL')
      .orderBy('r.customLabelSku', 'ASC')
      .getMany();

    result.targetListings = listings.length;
    const skus = uniqueUrls(listings.map((listing) => listing.customLabelSku));
    const products = skus.length
      ? await productRepo
          .createQueryBuilder('p')
          .select(['p.id', 'p.sku', 'p.imageUrls'])
          .where('p.sku IN (:...skus)', { skus })
          .getMany()
      : [];
    const productsBySku = new Map(products.map((product) => [product.sku, product]));
    result.targetCatalogProducts = products.length;
    result.missingCatalogSkus = skus.filter((sku) => !productsBySku.has(sku));

    progress('scope-ready', {
      targetListings: result.targetListings,
      targetCatalogProducts: result.targetCatalogProducts,
      missingCatalogProducts: result.missingCatalogSkus.length,
      imageUrls,
    });

    await mapConcurrent(listings, async (listing, index) => {
      try {
        const existing = parsePipeUrls(listing.itemPhotoUrl);
        const merged = uniqueUrls([...existing, ...imageUrls]);
        if (merged.length === existing.length) {
          result.listingAlreadyComplete += 1;
        } else {
          await listingRepo.update({ id: listing.id }, { itemPhotoUrl: merged.join('|') });
          result.listingUpdated += 1;
        }
        if ((index + 1) % 250 === 0 || index + 1 === listings.length) {
          progress('listing-progress', {
            processed: index + 1,
            total: listings.length,
            updated: result.listingUpdated,
            alreadyComplete: result.listingAlreadyComplete,
          });
        }
      } catch (error) {
        result.listingFailed.push({
          id: listing.id,
          sku: listing.customLabelSku,
          error: error?.message || String(error),
        });
      }
    });

    await mapConcurrent(products, async (product) => {
      try {
        const existing = Array.isArray(product.imageUrls)
          ? product.imageUrls.filter(Boolean)
          : [];
        const merged = uniqueUrls([...existing, ...imageUrls]);
        if (merged.length === existing.length) {
          result.catalogAlreadyComplete += 1;
        } else {
          await productRepo.update({ id: product.id }, { imageUrls: merged });
          result.catalogUpdated += 1;
        }
      } catch (error) {
        result.catalogFailed.push({
          id: product.id,
          sku: product.sku,
          error: error?.message || String(error),
        });
      }
    });

    progress('complete', result);
    console.log(JSON.stringify(result, null, 2));
    if (result.listingFailed.length || result.catalogFailed.length || result.missingCatalogSkus.length) {
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(JSON.stringify({ error: error?.message || String(error), stack: error?.stack, result }, null, 2));
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
  }
})();
