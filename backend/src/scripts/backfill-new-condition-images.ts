import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type QueryRunner } from 'typeorm';
import { mapToEbayConditionEnum } from '../channels/ebay/ebay-listing-condition.util.js';
import { StorageService } from '../storage/storage.service.js';

type CatalogImageRow = {
  id: string;
  sku: string | null;
  conditionId: string | null;
  conditionLabel: string | null;
  imageUrls: unknown;
};

type ListingImageRow = {
  id: string;
  sku: string | null;
  conditionId: string | null;
  itemPhotoUrl: string | null;
};

type PublishedListingImageRow = {
  id: string;
  sku: string | null;
  condition: string | null;
  listingCondition: string | null;
  productConditionId: string | null;
  productConditionLabel: string | null;
  imageUrls: unknown;
};

type CatalogImageUpdate = {
  id: string;
  sku: string | null;
  oldImages: string[];
  newImages: string[];
};

type ListingImageUpdate = {
  id: string;
  sku: string | null;
  oldImageField: string | null;
  newImageField: string;
  oldImages: string[];
  newImages: string[];
};

type PublishedListingImageUpdate = {
  id: string;
  sku: string | null;
  oldImages: string[];
  newImages: string[];
};

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(0, Number(limitArg.split('=')[1])) : 0;
const IMAGE_DIRECTORY = 'new-condition-listing-images';
const IMAGE_FILES = ['F1.webp', 'F2.webp', 'F3.webp'] as const;

/** This maintenance context deliberately has no eBay clients, queues, or workers. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.IGNORE_ENV_FILE === 'true',
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '.env'),
        '/app/.env',
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'listingpro'),
        entities: [],
        synchronize: false,
        migrationsRun: false,
        extra: {
          max: 5,
          min: 0,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          statement_timeout: 30_000,
        },
      }),
    }),
  ],
  providers: [
    {
      provide: StorageService,
      useFactory: (config: ConfigService) =>
        // Backfill only calls StorageService's S3 methods; no thumbnail queue is used.
        new StorageService(config, {} as never),
      inject: [ConfigService],
    },
  ],
})
class NewConditionImageBackfillModule {}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parsePipeField(value: string | null): string[] {
  return value?.split('|').map((url) => url.trim()).filter(Boolean) ?? [];
}

function isNewCondition(...values: Array<string | null | undefined>): boolean {
  return values.some(
    (value) =>
      Boolean(value?.trim()) &&
      mapToEbayConditionEnum(value, 'USED_GOOD') === 'NEW',
  );
}

/** Keep the existing gallery intact and force the shared F1/F2/F3 URLs to its tail. */
function appendImagesAtEnd(existing: string[], required: string[]): string[] {
  const suffix = [...new Set(required.map((url) => url.trim()).filter(Boolean))];
  const suffixKeys = new Set(suffix.map((url) => url.toLowerCase()));
  const retained = existing
    .map((url) => url.trim())
    .filter((url) => url && !suffixKeys.has(url.toLowerCase()));
  return [...retained, ...suffix];
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((url, i) => url === right[i]);
}

function chunks<T>(items: T[], size = 250): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function getNewConditionImageUrls(
  storage: StorageService,
  uploadIfMissing: boolean,
): Promise<string[]> {
  const urls: string[] = [];
  for (const fileName of IMAGE_FILES) {
    const paths = [
      join(process.cwd(), 'assets', IMAGE_DIRECTORY, fileName),
      join(process.cwd(), 'backend', 'assets', IMAGE_DIRECTORY, fileName),
    ];
    let buffer: Buffer | null = null;
    for (const path of paths) {
      try {
        buffer = await readFile(path);
        break;
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    if (!buffer) throw new Error(`Bundled image ${fileName} was not found`);
    if (
      buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WEBP'
    ) {
      throw new Error(`${fileName} is not a valid WebP image`);
    }

    const digest = createHash('sha256').update(buffer).digest('hex');
    const key = storage.buildDurableKey(
      `shared/${IMAGE_DIRECTORY}/${digest}-${fileName}`,
    );
    if (uploadIfMissing && !(await storage.objectExists(key))) {
      await storage.putObject(key, buffer, 'image/webp');
    }
    urls.push(storage.getCdnUrl(key));
  }
  return urls;
}

function valuePlaceholders(
  rowCount: number,
  parameterCount: number,
  casts: string[],
): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const first = rowIndex * parameterCount + 1;
    return `(${Array.from(
      { length: parameterCount },
      (_, columnIndex) => `$${first + columnIndex}${casts[columnIndex] ?? ''}`,
    ).join(', ')})`;
  }).join(', ');
}

async function applyCatalogUpdates(
  runner: QueryRunner,
  updates: CatalogImageUpdate[],
): Promise<void> {
  for (const batch of chunks(updates)) {
    const values = batch.flatMap((row) => [row.id, row.newImages]);
    await runner.query(
      `UPDATE catalog_products AS target
       SET image_urls = source.images, "updatedAt" = NOW()
       FROM (VALUES ${valuePlaceholders(batch.length, 2, ['::uuid', '::text[]'])}) AS source(id, images)
       WHERE target.id = source.id
       RETURNING target.id`,
      values,
    );
  }
}

async function applyListingUpdates(
  runner: QueryRunner,
  updates: ListingImageUpdate[],
): Promise<void> {
  for (const batch of chunks(updates)) {
    const values = batch.flatMap((row) => [row.id, row.newImageField]);
    await runner.query(
      `UPDATE listing_records AS target
       SET "itemPhotoUrl" = source.image_field,
           "version" = COALESCE(target."version", 0) + 1,
           "updatedAt" = NOW()
       FROM (VALUES ${valuePlaceholders(batch.length, 2, ['::uuid', '::text'])}) AS source(id, image_field)
       WHERE target.id = source.id
       RETURNING target.id`,
      values,
    );
  }
}

async function applyPublishedListingUpdates(
  runner: QueryRunner,
  updates: PublishedListingImageUpdate[],
): Promise<void> {
  for (const batch of chunks(updates)) {
    const values = batch.flatMap((row) => [row.id, JSON.stringify(row.newImages)]);
    await runner.query(
      `UPDATE ebay_published_listings AS target
       SET image_urls = source.images::jsonb, updated_at = NOW()
       FROM (VALUES ${valuePlaceholders(batch.length, 2, ['::uuid', '::text'])}) AS source(id, images)
       WHERE target.id = source.id
       RETURNING target.id`,
      values,
    );
  }
}

function verifyImages(actual: unknown, expected: string[], table: string): void {
  if (!arraysEqual(stringArray(actual), expected)) {
    throw new Error(`Readback verification failed for ${table}`);
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    NewConditionImageBackfillModule,
    { logger: ['error', 'warn'] },
  );
  try {
    const dataSource = app.get(DataSource);
    const storage = app.get(StorageService);
    const [catalogRows, listingRows, publishedListingRows] =
      (await Promise.all([
        dataSource.query(
          `SELECT id, sku, condition_id AS "conditionId",
                  condition_label AS "conditionLabel", image_urls AS "imageUrls"
             FROM catalog_products
            WHERE vertical_validation_status IS DISTINCT FROM 'deleted'
              AND (condition_id IS NOT NULL OR condition_label IS NOT NULL)
              AND (condition_id ILIKE '%new%' OR condition_label ILIKE '%new%'
                   OR condition_id ~ '^[[:space:]]*1000([[:space:]]*-.*)?$')
            ORDER BY "updatedAt" DESC NULLS LAST, id`,
        ),
        dataSource.query(
          `SELECT id, "customLabelSku" AS sku, "conditionId",
                  "itemPhotoUrl" AS "itemPhotoUrl"
             FROM listing_records
            WHERE "deletedAt" IS NULL
              AND "conditionId" IS NOT NULL
              AND ("conditionId" ILIKE '%new%'
                   OR "conditionId" ~ '^[[:space:]]*1000([[:space:]]*-.*)?$')
            ORDER BY "updatedAt" DESC NULLS LAST, id`,
        ),
        dataSource.query(
          `SELECT epl.id, epl.sku, epl.condition,
                  lr."conditionId" AS "listingCondition",
                  cp.condition_id AS "productConditionId",
                  cp.condition_label AS "productConditionLabel",
                  epl.image_urls AS "imageUrls"
             FROM ebay_published_listings epl
             LEFT JOIN LATERAL (
               SELECT product.condition_id, product.condition_label
                 FROM catalog_products product
                WHERE product.id = epl.catalog_product_id OR product.sku = epl.sku
                ORDER BY (product.id = epl.catalog_product_id) DESC NULLS LAST
                LIMIT 1
             ) cp ON TRUE
             LEFT JOIN LATERAL (
               SELECT listing."conditionId"
                 FROM listing_records listing
                WHERE listing."customLabelSku" = epl.sku
                  AND listing."deletedAt" IS NULL
                ORDER BY listing."updatedAt" DESC NULLS LAST
                LIMIT 1
             ) lr ON TRUE
            WHERE epl.condition ILIKE '%new%'
               OR lr."conditionId" ILIKE '%new%'
               OR cp.condition_id ILIKE '%new%'
               OR cp.condition_label ILIKE '%new%'
               OR epl.condition ~ '^[[:space:]]*1000([[:space:]]*-.*)?$'
               OR lr."conditionId" ~ '^[[:space:]]*1000([[:space:]]*-.*)?$'
               OR cp.condition_id ~ '^[[:space:]]*1000([[:space:]]*-.*)?$'
            ORDER BY epl.updated_at DESC NULLS LAST, epl.id`,
        ),
      ])) as [CatalogImageRow[], ListingImageRow[], PublishedListingImageRow[]];

    const selectedCatalogRows = catalogRows.filter((row) =>
      isNewCondition(row.conditionId, row.conditionLabel),
    );
    const selectedListingRows = listingRows.filter((row) =>
      isNewCondition(row.conditionId),
    );
    const selectedPublishedRows = publishedListingRows.filter((row) =>
      isNewCondition(
        row.condition,
        row.listingCondition,
        row.productConditionId,
        row.productConditionLabel,
      ),
    );
    const limitedCatalogRows = LIMIT ? selectedCatalogRows.slice(0, LIMIT) : selectedCatalogRows;
    const limitedListingRows = LIMIT ? selectedListingRows.slice(0, LIMIT) : selectedListingRows;
    const limitedPublishedRows = LIMIT
      ? selectedPublishedRows.slice(0, LIMIT)
      : selectedPublishedRows;

    const urls = await getNewConditionImageUrls(storage, false);
    const catalogUpdates: CatalogImageUpdate[] = limitedCatalogRows.flatMap((row) => {
      const oldImages = stringArray(row.imageUrls);
      const newImages = appendImagesAtEnd(oldImages, urls);
      return arraysEqual(oldImages, newImages)
        ? []
        : [{ id: row.id, sku: row.sku, oldImages, newImages }];
    });
    const listingUpdates: ListingImageUpdate[] = limitedListingRows.flatMap((row) => {
      const oldImages = parsePipeField(row.itemPhotoUrl);
      const newImages = appendImagesAtEnd(oldImages, urls);
      const newImageField = newImages.join('|');
      return row.itemPhotoUrl === newImageField
        ? []
        : [{ id: row.id, sku: row.sku, oldImageField: row.itemPhotoUrl, newImageField, oldImages, newImages }];
    });
    const publishedListingUpdates: PublishedListingImageUpdate[] =
      limitedPublishedRows.flatMap((row) => {
        const oldImages = stringArray(row.imageUrls);
        const newImages = appendImagesAtEnd(oldImages, urls);
        return arraysEqual(oldImages, newImages)
          ? []
          : [{ id: row.id, sku: row.sku, oldImages, newImages }];
      });

    const summary = {
      mode: APPLY ? 'apply' : 'dry-run',
      scope: 'Application image fields for listings with condition New',
      appendOrder: IMAGE_FILES,
      limitPerTable: LIMIT || null,
      catalogProductsMatched: limitedCatalogRows.length,
      catalogProductsToUpdate: catalogUpdates.length,
      listingRecordsMatched: limitedListingRows.length,
      listingRecordsToUpdate: listingUpdates.length,
      appPublishedListingRecordsMatched: limitedPublishedRows.length,
      appPublishedListingRecordsToUpdate: publishedListingUpdates.length,
      liveEbayListingsModified: 0,
      sampleSkus: [
        ...catalogUpdates.slice(0, 3).map((row) => row.sku),
        ...listingUpdates.slice(0, 3).map((row) => row.sku),
        ...publishedListingUpdates.slice(0, 3).map((row) => row.sku),
      ],
    };
    console.log(JSON.stringify(summary, null, 2));
    if (!APPLY) return;

    // Upload each content-addressed WebP only when it is missing, then reuse its URL in every row.
    const uploadedUrls = await getNewConditionImageUrls(storage, true);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(
      process.cwd(),
      'output',
      `new-condition-image-backfill-${timestamp}.json`,
    );
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFile(
      backupPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          scope: summary.scope,
          appendOrder: IMAGE_FILES,
          sharedImageUrls: uploadedUrls,
          catalogProducts: catalogUpdates.map(({ id, sku, oldImages }) => ({
            id,
            sku,
            oldImages,
          })),
          listingRecords: listingUpdates.map(({ id, sku, oldImageField }) => ({
            id,
            sku,
            oldImageField,
          })),
          appPublishedListingRecords: publishedListingUpdates.map(
            ({ id, sku, oldImages }) => ({ id, sku, oldImages }),
          ),
          liveEbayListingsModified: 0,
        },
        null,
        2,
      ),
      'utf8',
    );

    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await applyCatalogUpdates(runner, catalogUpdates);
      await applyListingUpdates(runner, listingUpdates);
      await applyPublishedListingUpdates(runner, publishedListingUpdates);

      for (const batch of chunks(catalogUpdates)) {
        const rows: Array<{ id: string; imageUrls: unknown }> = await runner.query(
          `SELECT id, image_urls AS "imageUrls"
             FROM catalog_products WHERE id = ANY($1::uuid[])`,
          [batch.map((row) => row.id)],
        );
        const byId = new Map(rows.map((row) => [row.id, row.imageUrls]));
        for (const row of batch) verifyImages(byId.get(row.id), row.newImages, 'catalog_products');
      }
      for (const batch of chunks(listingUpdates)) {
        const rows: Array<{ id: string; imageField: string | null }> = await runner.query(
          `SELECT id, "itemPhotoUrl" AS "imageField"
             FROM listing_records WHERE id = ANY($1::uuid[])`,
          [batch.map((row) => row.id)],
        );
        const byId = new Map(rows.map((row) => [row.id, row.imageField]));
        for (const row of batch) {
          if (byId.get(row.id) !== row.newImageField) {
            throw new Error(`Readback verification failed for listing_records ${row.id}`);
          }
        }
      }
      for (const batch of chunks(publishedListingUpdates)) {
        const rows: Array<{ id: string; imageUrls: unknown }> = await runner.query(
          `SELECT id, image_urls AS "imageUrls"
             FROM ebay_published_listings WHERE id = ANY($1::uuid[])`,
          [batch.map((row) => row.id)],
        );
        const byId = new Map(rows.map((row) => [row.id, row.imageUrls]));
        for (const row of batch) verifyImages(byId.get(row.id), row.newImages, 'ebay_published_listings');
      }
      await runner.commitTransaction();
    } catch (error: unknown) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }

    console.log(
      JSON.stringify(
        {
          ...summary,
          uploadedOrReusedSharedImages: uploadedUrls.length,
          backupPath,
          verified: {
            catalogProducts: catalogUpdates.length,
            listingRecords: listingUpdates.length,
            appPublishedListingRecords: publishedListingUpdates.length,
          },
          liveEbayListingsModified: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
