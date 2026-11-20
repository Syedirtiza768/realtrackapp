"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_listing_condition_util_js_1 = require("../channels/ebay/ebay-listing-condition.util.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(0, Number(limitArg.split('=')[1])) : 0;
const IMAGE_DIRECTORY = 'new-condition-listing-images';
const IMAGE_FILES = ['F1.webp', 'F2.webp', 'F3.webp'];
let NewConditionImageBackfillModule = class NewConditionImageBackfillModule {
};
NewConditionImageBackfillModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                ignoreEnvFile: process.env.IGNORE_ENV_FILE === 'true',
                envFilePath: [
                    (0, node_path_1.join)(process.cwd(), '.env'),
                    (0, node_path_1.join)(process.cwd(), '..', '.env'),
                    '/app/.env',
                ],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'postgres',
                    host: config.get('DB_HOST', 'localhost'),
                    port: Number(config.get('DB_PORT', '5432')),
                    username: config.get('DB_USER', 'postgres'),
                    password: config.get('DB_PASSWORD', 'postgres'),
                    database: config.get('DB_NAME', 'listingpro'),
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
                provide: storage_service_js_1.StorageService,
                useFactory: (config) => new storage_service_js_1.StorageService(config, {}),
                inject: [config_1.ConfigService],
            },
        ],
    })
], NewConditionImageBackfillModule);
function stringArray(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? parsed.filter((item) => typeof item === 'string')
                : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
function parsePipeField(value) {
    return value?.split('|').map((url) => url.trim()).filter(Boolean) ?? [];
}
function isNewCondition(...values) {
    return values.some((value) => Boolean(value?.trim()) &&
        (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(value, 'USED_GOOD') === 'NEW');
}
function appendImagesAtEnd(existing, required) {
    const suffix = [...new Set(required.map((url) => url.trim()).filter(Boolean))];
    const suffixKeys = new Set(suffix.map((url) => url.toLowerCase()));
    const retained = existing
        .map((url) => url.trim())
        .filter((url) => url && !suffixKeys.has(url.toLowerCase()));
    return [...retained, ...suffix];
}
function arraysEqual(left, right) {
    return left.length === right.length && left.every((url, i) => url === right[i]);
}
function chunks(items, size = 250) {
    const output = [];
    for (let index = 0; index < items.length; index += size) {
        output.push(items.slice(index, index + size));
    }
    return output;
}
async function getNewConditionImageUrls(storage, uploadIfMissing) {
    const urls = [];
    for (const fileName of IMAGE_FILES) {
        const paths = [
            (0, node_path_1.join)(process.cwd(), 'assets', IMAGE_DIRECTORY, fileName),
            (0, node_path_1.join)(process.cwd(), 'backend', 'assets', IMAGE_DIRECTORY, fileName),
        ];
        let buffer = null;
        for (const path of paths) {
            try {
                buffer = await (0, promises_1.readFile)(path);
                break;
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
            }
        }
        if (!buffer)
            throw new Error(`Bundled image ${fileName} was not found`);
        if (buffer.toString('ascii', 0, 4) !== 'RIFF' ||
            buffer.toString('ascii', 8, 12) !== 'WEBP') {
            throw new Error(`${fileName} is not a valid WebP image`);
        }
        const digest = (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex');
        const key = storage.buildDurableKey(`shared/${IMAGE_DIRECTORY}/${digest}-${fileName}`);
        if (uploadIfMissing && !(await storage.objectExists(key))) {
            await storage.putObject(key, buffer, 'image/webp');
        }
        urls.push(storage.getCdnUrl(key));
    }
    return urls;
}
function valuePlaceholders(rowCount, parameterCount, casts) {
    return Array.from({ length: rowCount }, (_, rowIndex) => {
        const first = rowIndex * parameterCount + 1;
        return `(${Array.from({ length: parameterCount }, (_, columnIndex) => `$${first + columnIndex}${casts[columnIndex] ?? ''}`).join(', ')})`;
    }).join(', ');
}
async function applyCatalogUpdates(runner, updates) {
    for (const batch of chunks(updates)) {
        const values = batch.flatMap((row) => [row.id, row.newImages]);
        await runner.query(`UPDATE catalog_products AS target
       SET image_urls = source.images, "updatedAt" = NOW()
       FROM (VALUES ${valuePlaceholders(batch.length, 2, ['::uuid', '::text[]'])}) AS source(id, images)
       WHERE target.id = source.id
       RETURNING target.id`, values);
    }
}
async function applyListingUpdates(runner, updates) {
    for (const batch of chunks(updates)) {
        const values = batch.flatMap((row) => [row.id, row.newImageField]);
        await runner.query(`UPDATE listing_records AS target
       SET "itemPhotoUrl" = source.image_field,
           "version" = COALESCE(target."version", 0) + 1,
           "updatedAt" = NOW()
       FROM (VALUES ${valuePlaceholders(batch.length, 2, ['::uuid', '::text'])}) AS source(id, image_field)
       WHERE target.id = source.id
       RETURNING target.id`, values);
    }
}
async function applyPublishedListingUpdates(runner, updates) {
    for (const batch of chunks(updates)) {
        const values = batch.flatMap((row) => [row.id, JSON.stringify(row.newImages)]);
        await runner.query(`UPDATE ebay_published_listings AS target
       SET image_urls = source.images::jsonb, updated_at = NOW()
       FROM (VALUES ${valuePlaceholders(batch.length, 2, ['::uuid', '::text'])}) AS source(id, images)
       WHERE target.id = source.id
       RETURNING target.id`, values);
    }
}
function verifyImages(actual, expected, table) {
    if (!arraysEqual(stringArray(actual), expected)) {
        throw new Error(`Readback verification failed for ${table}`);
    }
}
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(NewConditionImageBackfillModule, { logger: ['error', 'warn'] });
    try {
        const dataSource = app.get(typeorm_2.DataSource);
        const storage = app.get(storage_service_js_1.StorageService);
        const [catalogRows, listingRows, publishedListingRows] = (await Promise.all([
            dataSource.query(`SELECT id, sku, condition_id AS "conditionId",
                  condition_label AS "conditionLabel", image_urls AS "imageUrls"
             FROM catalog_products
            WHERE vertical_validation_status IS DISTINCT FROM 'deleted'
              AND (condition_id IS NOT NULL OR condition_label IS NOT NULL)
              AND (condition_id ILIKE '%new%' OR condition_label ILIKE '%new%'
                   OR condition_id ~ '^[[:space:]]*1000([[:space:]]*-.*)?$')
            ORDER BY "updatedAt" DESC NULLS LAST, id`),
            dataSource.query(`SELECT id, "customLabelSku" AS sku, "conditionId",
                  "itemPhotoUrl" AS "itemPhotoUrl"
             FROM listing_records
            WHERE "deletedAt" IS NULL
              AND "conditionId" IS NOT NULL
              AND ("conditionId" ILIKE '%new%'
                   OR "conditionId" ~ '^[[:space:]]*1000([[:space:]]*-.*)?$')
            ORDER BY "updatedAt" DESC NULLS LAST, id`),
            dataSource.query(`SELECT epl.id, epl.sku, epl.condition,
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
            ORDER BY epl.updated_at DESC NULLS LAST, epl.id`),
        ]));
        const selectedCatalogRows = catalogRows.filter((row) => isNewCondition(row.conditionId, row.conditionLabel));
        const selectedListingRows = listingRows.filter((row) => isNewCondition(row.conditionId));
        const selectedPublishedRows = publishedListingRows.filter((row) => isNewCondition(row.condition, row.listingCondition, row.productConditionId, row.productConditionLabel));
        const limitedCatalogRows = LIMIT ? selectedCatalogRows.slice(0, LIMIT) : selectedCatalogRows;
        const limitedListingRows = LIMIT ? selectedListingRows.slice(0, LIMIT) : selectedListingRows;
        const limitedPublishedRows = LIMIT
            ? selectedPublishedRows.slice(0, LIMIT)
            : selectedPublishedRows;
        const urls = await getNewConditionImageUrls(storage, false);
        const catalogUpdates = limitedCatalogRows.flatMap((row) => {
            const oldImages = stringArray(row.imageUrls);
            const newImages = appendImagesAtEnd(oldImages, urls);
            return arraysEqual(oldImages, newImages)
                ? []
                : [{ id: row.id, sku: row.sku, oldImages, newImages }];
        });
        const listingUpdates = limitedListingRows.flatMap((row) => {
            const oldImages = parsePipeField(row.itemPhotoUrl);
            const newImages = appendImagesAtEnd(oldImages, urls);
            const newImageField = newImages.join('|');
            return row.itemPhotoUrl === newImageField
                ? []
                : [{ id: row.id, sku: row.sku, oldImageField: row.itemPhotoUrl, newImageField, oldImages, newImages }];
        });
        const publishedListingUpdates = limitedPublishedRows.flatMap((row) => {
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
        if (!APPLY)
            return;
        const uploadedUrls = await getNewConditionImageUrls(storage, true);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = (0, node_path_1.join)(process.cwd(), 'output', `new-condition-image-backfill-${timestamp}.json`);
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(backupPath), { recursive: true });
        await (0, promises_1.writeFile)(backupPath, JSON.stringify({
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
            appPublishedListingRecords: publishedListingUpdates.map(({ id, sku, oldImages }) => ({ id, sku, oldImages })),
            liveEbayListingsModified: 0,
        }, null, 2), 'utf8');
        const runner = dataSource.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        try {
            await applyCatalogUpdates(runner, catalogUpdates);
            await applyListingUpdates(runner, listingUpdates);
            await applyPublishedListingUpdates(runner, publishedListingUpdates);
            for (const batch of chunks(catalogUpdates)) {
                const rows = await runner.query(`SELECT id, image_urls AS "imageUrls"
             FROM catalog_products WHERE id = ANY($1::uuid[])`, [batch.map((row) => row.id)]);
                const byId = new Map(rows.map((row) => [row.id, row.imageUrls]));
                for (const row of batch)
                    verifyImages(byId.get(row.id), row.newImages, 'catalog_products');
            }
            for (const batch of chunks(listingUpdates)) {
                const rows = await runner.query(`SELECT id, "itemPhotoUrl" AS "imageField"
             FROM listing_records WHERE id = ANY($1::uuid[])`, [batch.map((row) => row.id)]);
                const byId = new Map(rows.map((row) => [row.id, row.imageField]));
                for (const row of batch) {
                    if (byId.get(row.id) !== row.newImageField) {
                        throw new Error(`Readback verification failed for listing_records ${row.id}`);
                    }
                }
            }
            for (const batch of chunks(publishedListingUpdates)) {
                const rows = await runner.query(`SELECT id, image_urls AS "imageUrls"
             FROM ebay_published_listings WHERE id = ANY($1::uuid[])`, [batch.map((row) => row.id)]);
                const byId = new Map(rows.map((row) => [row.id, row.imageUrls]));
                for (const row of batch)
                    verifyImages(byId.get(row.id), row.newImages, 'ebay_published_listings');
            }
            await runner.commitTransaction();
        }
        catch (error) {
            await runner.rollbackTransaction();
            throw error;
        }
        finally {
            await runner.release();
        }
        console.log(JSON.stringify({
            ...summary,
            uploadedOrReusedSharedImages: uploadedUrls.length,
            backupPath,
            verified: {
                catalogProducts: catalogUpdates.length,
                listingRecords: listingUpdates.length,
                appPublishedListingRecords: publishedListingUpdates.length,
            },
            liveEbayListingsModified: 0,
        }, null, 2));
    }
    finally {
        await app.close();
    }
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=backfill-new-condition-images.js.map