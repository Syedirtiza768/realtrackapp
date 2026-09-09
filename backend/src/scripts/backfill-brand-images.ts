import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../channels/ebay/ebay-trading-api.service.js';
import type { EbayInventoryItem } from '../channels/ebay/ebay-api.types.js';
import {
  isSingleImageBrand,
  parseImageUrlField,
  selectPrimaryImageForBrand,
} from '../channels/ebay/ebay-listing-images.util.js';

type ListingRecordRow = {
  id: string;
  brand: string | null;
  sku: string | null;
  ebayItemId: string | null;
  status: string | null;
  itemPhotoUrl: string | null;
  updatedAt: string | Date | null;
};

type CatalogProductRow = {
  id: string;
  sku: string | null;
  brand: string | null;
  imageUrls: string[] | null;
};

type ImageAssetRow = {
  listingId: string;
  cdnUrl: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number | null;
};

type PublishedTarget = {
  source: 'channel' | 'mirror';
  sourceId: string;
  accountId: string;
  storeId: string;
  marketplaceId: string;
  sku: string;
  offerId: string | null;
  itemId: string | null;
  brand: string | null;
};

type EbayTarget = {
  key: string;
  storeId: string;
  accountId: string;
  marketplaceId: string;
  sku: string;
  offerIds: string[];
  itemIds: string[];
  sourceIds: string[];
  brand: string | null;
  selectedImage: string;
};

type EbayStoreCandidate = {
  accountId: string;
  storeId: string;
  marketplaceId: string;
};

type LegacyTarget = {
  listingId: string;
  sku: string | null;
  brand: string | null;
  itemId: string;
  storeId: string;
  accountId: string;
  marketplaceId: string;
  selectedImage: string;
};

type ListingUpdate = {
  id: string;
  sku: string | null;
  brand: string | null;
  oldImageField: string | null;
  selectedImage: string;
};

type CatalogUpdate = {
  id: string;
  sku: string | null;
  brand: string | null;
  oldImages: string[];
  selectedImage: string;
};

const APPLY = process.argv.includes('--apply');
const SKIP_EBAY = process.argv.includes('--skip-ebay');
const SKIP_LEGACY = process.argv.includes('--skip-legacy');
const DISCOVER_LEGACY =
  !SKIP_LEGACY && (process.argv.includes('--discover-legacy') || APPLY);
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(0, Number(limitArg.split('=')[1])) : 0;

function isDurableUrl(url: string): boolean {
  return !/\/temp\//i.test(url);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function scoreAsset(asset: ImageAssetRow): number {
  if (!asset.width || !asset.height) return 0;
  return asset.width * asset.height;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const response = (
    error as Error & {
      response?: { status?: number; data?: unknown };
    }
  ).response;
  if (!response) return error.message;
  const status = response.status ? `HTTP ${response.status}` : 'eBay request';
  const data = response.data;
  if (data == null || data === '') return `${status}: ${error.message}`;
  let detail: string;
  try {
    detail = typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    detail = String(data);
  }
  return `${status}: ${detail.slice(0, 1000)}`;
}

function inventoryItemPayloadForWrite(item: EbayInventoryItem): EbayInventoryItem {
  const { packageWeightAndSize, ...base } = item;
  const packagePayload: NonNullable<
    EbayInventoryItem['packageWeightAndSize']
  > = {};
  const weight = packageWeightAndSize?.weight;
  if (weight && Number.isFinite(weight.value) && weight.value > 0) {
    packagePayload.weight = weight;
  }
  const dimensions = packageWeightAndSize?.dimensions;
  if (
    dimensions &&
    [
      dimensions.length.value,
      dimensions.width.value,
      dimensions.height.value,
    ].every((value) => Number.isFinite(value) && value > 0)
  ) {
    packagePayload.dimensions = dimensions;
  }
  return Object.keys(packagePayload).length > 0
    ? { ...base, packageWeightAndSize: packagePayload }
    : base;
}

/**
 * Select the same primary-image policy used by the publish path. Known local
 * image dimensions are placed first; eBay URLs with embedded dimensions are
 * still ranked by selectPrimaryImageForBrand. Temporary S3 URLs are only a
 * last resort when no durable source exists.
 */
function selectImage(
  brand: string | null,
  listingField: string | null | undefined,
  catalogImages: string[] | null | undefined,
  assets: ImageAssetRow[],
): string | null {
  if (!isSingleImageBrand(brand)) return null;

  const listingImages = parseImageUrlField(listingField);
  const durableAssets = assets
    .filter((asset) => asset.cdnUrl && isDurableUrl(asset.cdnUrl))
    .sort((a, b) => scoreAsset(b) - scoreAsset(a));
  const durableListingImages = listingImages.filter(isDurableUrl);
  const durableCatalogImages = asStringArray(catalogImages).filter(
    isDurableUrl,
  );

  const durableCandidates = unique([
    ...durableAssets.map((asset) => asset.cdnUrl!).filter(Boolean),
    ...durableListingImages,
    ...durableCatalogImages,
  ]);
  const fallbackCandidates = unique([
    ...listingImages,
    ...asStringArray(catalogImages),
    ...assets.map((asset) => asset.cdnUrl ?? '').filter(Boolean),
  ]);
  const candidates = durableCandidates.length
    ? durableCandidates
    : fallbackCandidates;
  if (!candidates.length) return null;

  return selectPrimaryImageForBrand(candidates, brand)[0] ?? null;
}

function parseLimit<T>(rows: T[]): T[] {
  return LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
}

function brandGroup(brand: string | null): 'Febi' | 'Lemforder' | null {
  if (!brand) return null;
  if (/febi/i.test(brand)) return 'Febi';
  if (/lemf/i.test(brand)) return 'Lemforder';
  return null;
}

function summarizeByBrand<T extends { brand: string | null }>(
  rows: T[],
): Record<string, number> {
  const result: Record<string, number> = { Febi: 0, Lemforder: 0 };
  for (const row of rows) {
    const group = brandGroup(row.brand);
    if (group) result[group] += 1;
  }
  return result;
}

function makeEbayTargetKey(target: PublishedTarget): string {
  return `${target.storeId}:${target.sku}`;
}

function addPublishedTarget(
  map: Map<string, EbayTarget>,
  target: PublishedTarget,
  selectedImage: string | null,
): void {
  if (!selectedImage || !target.sku) return;
  const key = makeEbayTargetKey(target);
  const current = map.get(key);
  if (current) {
    if (target.offerId && !current.offerIds.includes(target.offerId)) {
      current.offerIds.push(target.offerId);
    }
    if (target.itemId && !current.itemIds.includes(target.itemId)) {
      current.itemIds.push(target.itemId);
    }
    if (!current.sourceIds.includes(target.sourceId)) {
      current.sourceIds.push(target.sourceId);
    }
    return;
  }
  map.set(key, {
    key,
    storeId: target.storeId,
    accountId: target.accountId,
    marketplaceId: target.marketplaceId,
    sku: target.sku,
    offerIds: target.offerId ? [target.offerId] : [],
    itemIds: target.itemId ? [target.itemId] : [],
    sourceIds: [target.sourceId],
    brand: target.brand,
    selectedImage,
  });
}

async function discoverLegacyTargets(
  dataSource: DataSource,
  tradingApi: EbayTradingApiService,
  rows: ListingRecordRow[],
  selectedBySku: Map<string, string>,
): Promise<{
  targets: LegacyTarget[];
  failures: Array<{ listingId: string; sku: string | null; itemId: string; error: string }>;
  candidateStoreCount: number;
}> {
  const stores = (await dataSource.query(
    `SELECT cea.id AS "accountId", cea.primary_store_id AS "storeId",
            COALESCE(NULLIF(s.ebay_marketplace_id, ''), 'EBAY_MOTORS_US') AS "marketplaceId"
     FROM connected_ebay_accounts cea
     JOIN stores s ON s.id = cea.primary_store_id
     WHERE cea.environment = 'production'
       AND s.channel = 'ebay'
     ORDER BY (cea.connection_status = 'active') DESC, cea.account_display_name, cea.id`,
  )) as EbayStoreCandidate[];

  const targets: LegacyTarget[] = [];
  const failures: Array<{
    listingId: string;
    sku: string | null;
    itemId: string;
    error: string;
  }> = [];
  const seenItemIds = new Set<string>();

  for (const row of rows) {
    const itemId = row.ebayItemId?.trim();
    if (!itemId || seenItemIds.has(itemId)) continue;
    seenItemIds.add(itemId);

    const selectedImage = row.sku ? selectedBySku.get(row.sku) : null;
    if (!selectedImage) {
      failures.push({
        listingId: row.id,
        sku: row.sku,
        itemId,
        error: 'no selected source image for the local listing',
      });
      continue;
    }

    let lastError = 'no connected production eBay store matched the item';
    for (const store of stores) {
      try {
        await tradingApi.getItemDetails(
          store.storeId,
          itemId,
          store.marketplaceId,
        );
        targets.push({
          listingId: row.id,
          sku: row.sku,
          brand: row.brand,
          itemId,
          storeId: store.storeId,
          accountId: store.accountId,
          marketplaceId: store.marketplaceId,
          selectedImage,
        });
        console.log(
          `Legacy eBay matched ${itemId} → store ${store.storeId} (${row.sku ?? 'no SKU'})`,
        );
        lastError = '';
        break;
      } catch (error) {
        lastError = describeError(error);
      }
    }

    if (lastError) {
      failures.push({
        listingId: row.id,
        sku: row.sku,
        itemId,
        error: lastError,
      });
      console.error(`Legacy eBay unmatched ${itemId}: ${lastError}`);
    }
  }

  return { targets, failures, candidateStoreCount: stores.length };
}

async function markEbaySourceRows(
  dataSource: DataSource,
  target: EbayTarget,
  mirrorSourceIds: Set<string>,
): Promise<void> {
  for (const sourceId of target.sourceIds) {
    if (mirrorSourceIds.has(sourceId)) {
      await dataSource.query(
        `UPDATE ebay_published_listings
         SET image_urls = $1::jsonb, last_synced_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([target.selectedImage]), sourceId],
      );
    } else {
      await dataSource.query(
        `UPDATE ebay_listing_channels
         SET last_revised_at = NOW(), last_error_code = NULL,
             last_error_message = NULL, updated_at = NOW()
         WHERE id = $1`,
        [sourceId],
      );
    }
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const dataSource = app.get(DataSource);
    const inventoryApi = app.get(EbayInventoryApiService);
    const tradingApi = app.get(EbayTradingApiService);

    const listingRows = (await dataSource.query(
      `SELECT "id", "cBrand" AS "brand", "customLabelSku" AS "sku",
              "ebayListingId" AS "ebayItemId", "status",
              "itemPhotoUrl", "updatedAt"
       FROM listing_records
       WHERE "deletedAt" IS NULL
         AND ("cBrand" ILIKE $1 OR "cBrand" ILIKE $2)
       ORDER BY "updatedAt" DESC NULLS LAST, "id"`,
      ['%febi%', '%lemf%'],
    )) as ListingRecordRow[];

    const catalogRows = (await dataSource.query(
      `SELECT id, sku, brand, image_urls AS "imageUrls"
       FROM catalog_products
       WHERE brand ILIKE $1 OR brand ILIKE $2
       ORDER BY "updatedAt" DESC NULLS LAST, id`,
      ['%febi%', '%lemf%'],
    )) as CatalogProductRow[];

    const assetRows = listingRows.length
      ? ((await dataSource.query(
          `SELECT listing_id AS "listingId", cdn_url AS "cdnUrl",
                  width, height, sort_order AS "sortOrder"
           FROM image_assets
           WHERE deleted_at IS NULL
             AND listing_id = ANY($1::uuid[])
             AND cdn_url IS NOT NULL`,
          [listingRows.map((row) => row.id)],
        )) as ImageAssetRow[])
      : [];

    const assetsByListing = new Map<string, ImageAssetRow[]>();
    for (const asset of assetRows) {
      const list = assetsByListing.get(asset.listingId) ?? [];
      list.push(asset);
      assetsByListing.set(asset.listingId, list);
    }

    const catalogBySku = new Map<string, CatalogProductRow>();
    for (const product of catalogRows) {
      if (product.sku) catalogBySku.set(product.sku, product);
    }

    const listingUpdates: ListingUpdate[] = [];
    const catalogUpdates = new Map<string, CatalogUpdate>();
    const selectedBySku = new Map<string, string>();

    for (const row of parseLimit(listingRows)) {
      const product = row.sku ? catalogBySku.get(row.sku) : undefined;
      const selected = selectImage(
        row.brand,
        row.itemPhotoUrl,
        product?.imageUrls,
        assetsByListing.get(row.id) ?? [],
      );
      if (!selected) continue;
      if (row.sku) selectedBySku.set(row.sku, selected);

      const existing = parseImageUrlField(row.itemPhotoUrl);
      if (existing.length !== 1 || existing[0] !== selected) {
        listingUpdates.push({
          id: row.id,
          sku: row.sku,
          brand: row.brand,
          oldImageField: row.itemPhotoUrl,
          selectedImage: selected,
        });
      }

      if (product && isSingleImageBrand(product.brand)) {
        const oldImages = asStringArray(product.imageUrls);
        if (oldImages.length !== 1 || oldImages[0] !== selected) {
          catalogUpdates.set(product.id, {
            id: product.id,
            sku: product.sku,
            brand: product.brand,
            oldImages,
            selectedImage: selected,
          });
        }
      }
    }

    for (const product of parseLimit(catalogRows)) {
      const selected = selectImage(
        product.brand,
        null,
        product.imageUrls,
        [],
      );
      if (!selected) continue;
      if (product.sku) selectedBySku.set(product.sku, selected);
      const oldImages = asStringArray(product.imageUrls);
      if (oldImages.length !== 1 || oldImages[0] !== selected) {
        catalogUpdates.set(product.id, {
          id: product.id,
          sku: product.sku,
          brand: product.brand,
          oldImages,
          selectedImage: selected,
        });
      }
    }

    const channelRows = (await dataSource.query(
      `SELECT elc.id AS "sourceId", elc.ebay_account_id AS "accountId",
              cea.primary_store_id AS "storeId", elc.marketplace_id AS "marketplaceId",
              COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) AS sku,
              elc.offer_id AS "offerId", elc.listing_id AS "itemId",
              COALESCE(NULLIF(cp.brand, ''), lr."cBrand") AS brand,
              'channel' AS source
       FROM ebay_listing_channels elc
       JOIN connected_ebay_accounts cea ON cea.id = elc.ebay_account_id
       JOIN catalog_products cp ON cp.id = elc.catalog_product_id
       LEFT JOIN listing_records lr ON lr."customLabelSku" = cp.sku
       WHERE elc.listing_status = 'published'
         AND (cp.brand ILIKE $1 OR cp.brand ILIKE $2
              OR lr."cBrand" ILIKE $1 OR lr."cBrand" ILIKE $2)`,
      ['%febi%', '%lemf%'],
    )) as PublishedTarget[];

    const mirrorRows = (await dataSource.query(
      `SELECT epl.id AS "sourceId", epl.ebay_account_id AS "accountId",
              epl.store_id AS "storeId", epl.marketplace_id AS "marketplaceId",
              epl.sku, epl.offer_id AS "offerId", epl.ebay_item_id AS "itemId",
              COALESCE(NULLIF(cp.brand, ''), lr."cBrand") AS brand,
              'mirror' AS source
       FROM ebay_published_listings epl
       LEFT JOIN catalog_products cp
         ON cp.id = epl.catalog_product_id OR cp.sku = epl.sku
       LEFT JOIN listing_records lr ON lr."customLabelSku" = epl.sku
       WHERE epl.listing_status IN ('active', 'out_of_stock')
         AND (cp.brand ILIKE $1 OR cp.brand ILIKE $2
              OR lr."cBrand" ILIKE $1 OR lr."cBrand" ILIKE $2)`,
      ['%febi%', '%lemf%'],
    )) as PublishedTarget[];

    const ebayTargets = new Map<string, EbayTarget>();
    for (const target of [...channelRows, ...mirrorRows]) {
      const selected = target.sku ? selectedBySku.get(target.sku) : null;
      addPublishedTarget(ebayTargets, target, selected ?? null);
    }
    const mirrorSourceIds = new Set(
      mirrorRows.map((row) => row.sourceId),
    );

    const mappedItemIds = new Set(
      [...channelRows, ...mirrorRows]
        .map((row) => row.itemId)
        .filter((itemId): itemId is string => Boolean(itemId)),
    );
    const unmappedPublishedRows = parseLimit(listingRows).filter(
      (row) =>
        row.status === 'published' &&
        row.ebayItemId &&
        !mappedItemIds.has(row.ebayItemId),
    );

    const legacyDiscovery =
      !SKIP_EBAY && DISCOVER_LEGACY
        ? await discoverLegacyTargets(
            dataSource,
            tradingApi,
            unmappedPublishedRows,
            selectedBySku,
          )
        : { targets: [], failures: [], candidateStoreCount: 0 };

    const summary = {
      mode: APPLY ? 'apply' : 'dry-run',
      ebayMode: SKIP_EBAY
        ? 'skipped'
        : DISCOVER_LEGACY
          ? 'inventory-api-and-legacy-trading-on-apply'
          : 'inventory-api-on-apply',
      limit: LIMIT || null,
      existingListingRecords: listingRows.length,
      existingCatalogProducts: catalogRows.length,
      listingRecordsToUpdate: listingUpdates.length,
      catalogProductsToUpdate: catalogUpdates.size,
      publishedChannelRows: channelRows.length,
      publishedMirrorRows: mirrorRows.length,
      uniqueEbayInventoryTargets: ebayTargets.size,
      unmappedPublishedListingRecords: unmappedPublishedRows.length,
      legacyDiscovery: {
        attempted: DISCOVER_LEGACY,
        candidateStoreCount: legacyDiscovery.candidateStoreCount,
        matchedTargets: legacyDiscovery.targets.length,
        unmatched: legacyDiscovery.failures.length,
      },
      listingUpdatesByBrand: summarizeByBrand(listingUpdates),
      catalogUpdatesByBrand: summarizeByBrand([...catalogUpdates.values()]),
          ebayTargetsByBrand: summarizeByBrand([...ebayTargets.values()]),
      legacyTargetsByBrand: summarizeByBrand(legacyDiscovery.targets),
      sampleSelections: [
        ...listingUpdates.slice(0, 6).map((row) => ({
          type: 'listing_record',
          sku: row.sku,
          brand: row.brand,
          selectedImage: row.selectedImage,
        })),
        ...[...catalogUpdates.values()].slice(0, 4).map((row) => ({
          type: 'catalog_product',
          sku: row.sku,
          brand: row.brand,
          selectedImage: row.selectedImage,
        })),
      ],
      unmappedSample: unmappedPublishedRows.slice(0, 10).map((row) => ({
        sku: row.sku,
        brand: row.brand,
        ebayItemId: row.ebayItemId,
      })),
      legacyUnmatchedSample: legacyDiscovery.failures.slice(0, 10),
    };
    console.log(JSON.stringify(summary, null, 2));

    if (!APPLY) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `/app/output/brand-image-backfill-${timestamp}.json`;
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFile(
      backupPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          listingRecords: listingUpdates,
          catalogProducts: [...catalogUpdates.values()],
          publishedMirrorIds: [...new Set(mirrorRows.map((row) => row.sourceId))],
          legacyTargets: legacyDiscovery.targets,
          legacyDiscoveryFailures: legacyDiscovery.failures,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`Backup written: ${backupPath}`);

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const update of listingUpdates) {
        await queryRunner.query(
          `UPDATE listing_records
           SET "itemPhotoUrl" = $1,
               "version" = COALESCE("version", 0) + 1,
               "updatedAt" = NOW()
           WHERE id = $2`,
          [update.selectedImage, update.id],
        );
      }
      for (const update of catalogUpdates.values()) {
        await queryRunner.query(
          `UPDATE catalog_products
           SET image_urls = $1::text[], "updatedAt" = NOW()
           WHERE id = $2`,
          [[update.selectedImage], update.id],
        );
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    console.log(
      `Database updated: listing_records=${listingUpdates.length}, catalog_products=${catalogUpdates.size}`,
    );

    if (SKIP_EBAY) {
      console.log('eBay updates skipped by --skip-ebay');
      return;
    }

    let ebaySuccess = 0;
    let ebayFailed = 0;
    const failures: Array<{ sku: string; storeId: string; error: string }> = [];

    for (const target of ebayTargets.values()) {
      try {
        const current = await inventoryApi.getItem(target.storeId, target.sku);
        const currentImages = current.product?.imageUrls ?? [];
        if (
          currentImages.length === 1 &&
          currentImages[0]?.trim() === target.selectedImage.trim()
        ) {
          await markEbaySourceRows(dataSource, target, mirrorSourceIds);
          ebaySuccess += 1;
          console.log(`eBay OK ${target.sku} → already one image`);
          continue;
        }
        const updated = inventoryItemPayloadForWrite({
          ...current,
          product: {
            ...current.product,
            imageUrls: [target.selectedImage],
          },
        });
        await inventoryApi.createOrReplaceItem(
          target.storeId,
          target.sku,
          updated,
        );
        const verified = await inventoryApi.getItem(
          target.storeId,
          target.sku,
        );
        const verifiedImages = verified.product?.imageUrls ?? [];
        if (
          verifiedImages.length !== 1 ||
          verifiedImages[0]?.trim() !== target.selectedImage.trim()
        ) {
          throw new Error(
            `verification returned ${verifiedImages.length} image URL(s) instead of the selected single image`,
          );
        }

        await markEbaySourceRows(dataSource, target, mirrorSourceIds);
        ebaySuccess += 1;
        console.log(`eBay OK ${target.sku} → one image`);
      } catch (error) {
        ebayFailed += 1;
        const message = describeError(error);
        failures.push({
          sku: target.sku,
          storeId: target.storeId,
          error: message,
        });
        console.error(`eBay FAILED ${target.sku}: ${message}`);
      }
    }

    let legacySuccess = 0;
    let legacyFailed = legacyDiscovery.failures.length;
    for (const target of legacyDiscovery.targets) {
      try {
        await tradingApi.replaceListingImages(
          target.storeId,
          target.itemId,
          target.selectedImage,
          target.marketplaceId,
        );
        const verified = await tradingApi.getItemDetails(
          target.storeId,
          target.itemId,
          target.marketplaceId,
        );
        if (verified.imageUrls.length !== 1) {
          throw new Error(
            `verification returned ${verified.imageUrls.length} image URL(s) instead of exactly one`,
          );
        }
        legacySuccess += 1;
        console.log(`Legacy eBay OK ${target.itemId} → one image`);
      } catch (error) {
        legacyFailed += 1;
        const message = describeError(error);
        failures.push({
          sku: target.sku ?? target.itemId,
          storeId: target.storeId,
          error: `legacy item ${target.itemId}: ${message}`,
        });
        console.error(`Legacy eBay FAILED ${target.itemId}: ${message}`);
      }
    }

    console.log(
      JSON.stringify(
        {
          ebaySuccess,
          ebayFailed,
          legacySuccess,
          legacyFailed,
          legacyDiscoveryFailures: legacyDiscovery.failures,
          failures: failures.slice(0, 25),
          backupPath,
          unmappedPublishedListingRecords: unmappedPublishedRows.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.race([
      app.close().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
}

void main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exit(1);
  });
