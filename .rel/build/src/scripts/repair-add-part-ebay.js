"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_fs_1 = require("node:fs");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const app_module_js_1 = require("../app.module.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const ebay_publish_service_js_1 = require("../channels/ebay/ebay-publish.service.js");
const ebay_inventory_api_service_js_1 = require("../channels/ebay/ebay-inventory-api.service.js");
const ebay_compatibility_reconciliation_service_js_1 = require("../channels/ebay/ebay-compatibility-reconciliation.service.js");
const ebay_sku_util_js_1 = require("../channels/ebay/ebay-sku.util.js");
function option(name, fallback) {
    const prefix = `--${name}=`;
    return (process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
        fallback);
}
function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}
function errorMessage(error) {
    const base = error instanceof Error ? error.message : String(error);
    if (!error || typeof error !== 'object' || !('response' in error))
        return base;
    const response = error.response;
    if (!response)
        return base;
    const detail = response.data === undefined
        ? ''
        : ` ${typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}`;
    return `${base} (HTTP ${response.status ?? 'unknown'})${detail}`;
}
function isNotFound(error) {
    return /(?:status code\s*)?404|not found/i.test(errorMessage(error));
}
async function cleanupUnpublishedAlternate(inventoryApi, target, alternateSku) {
    try {
        const item = await inventoryApi.getItem(target.storeId, alternateSku);
        const offers = await inventoryApi.getOffersBySku(target.storeId, alternateSku, 100, 0);
        const blockingOffers = offers.offers.filter((offer) => offer.status === 'PUBLISHED' || Boolean(offer.listingId));
        const deletableOffers = offers.offers.filter((offer) => Boolean(offer.offerId) &&
            offer.status !== 'PUBLISHED' &&
            !offer.listingId);
        const safeToDelete = Boolean(item) && blockingOffers.length === 0;
        if (safeToDelete) {
            for (const offer of deletableOffers) {
                await inventoryApi.deleteOffer(target.storeId, offer.offerId);
            }
            const remaining = await inventoryApi.getOffersBySku(target.storeId, alternateSku, 100, 0);
            if (remaining.total > 0) {
                throw new Error(`Cleanup retained ${remaining.total} offer(s) for ${alternateSku}`);
            }
            await inventoryApi.deleteItem(target.storeId, alternateSku);
        }
        console.log(JSON.stringify({
            event: 'alternate_cleanup_result',
            channelId: target.channelId,
            canonicalSku: target.catalogSku,
            alternateSku,
            itemExists: Boolean(item),
            offerCount: offers.total,
            deletedOfferCount: deletableOffers.length,
            deleted: safeToDelete,
        }));
    }
    catch (error) {
        console.log(JSON.stringify({
            event: 'alternate_cleanup_skipped',
            channelId: target.channelId,
            canonicalSku: target.catalogSku,
            alternateSku,
            error: errorMessage(error),
        }));
    }
}
async function persistChannelProjection(dataSource, target, result) {
    if (!result.offerId || !result.listingId) {
        throw new Error(`eBay publish returned incomplete projection for ${target.catalogSku}`);
    }
    const effectiveSku = result.effectiveSku?.trim() || target.catalogSku;
    await dataSource.transaction(async (manager) => {
        await manager.query(`UPDATE ebay_listing_channels
          SET internal_sku = $1,
              ebay_inventory_sku = $2,
              offer_id = $3,
              listing_id = $4,
              listing_url = $5,
              last_revised_at = NOW(),
              last_synced_at = NOW(),
              updated_at = NOW()
        WHERE id = $6`, [
            target.catalogSku,
            effectiveSku,
            result.offerId,
            result.listingId,
            `https://www.ebay.com/itm/${result.listingId}`,
            target.channelId,
        ]);
        if (target.publishedListingId) {
            await manager.query(`UPDATE ebay_published_listings
            SET ebay_item_id = $1,
                offer_id = $2,
                sku = $3,
                listing_url = $4,
                last_synced_at = NOW(),
                updated_at = NOW()
          WHERE id = $5`, [
                result.listingId,
                result.offerId,
                effectiveSku,
                `https://www.ebay.com/itm/${result.listingId}`,
                target.publishedListingId,
            ]);
        }
    });
}
function auditedAnomalyIds(path) {
    const ids = new Set();
    for (const line of (0, node_fs_1.readFileSync)(path, 'utf8').split(/\r?\n/)) {
        if (!line.trimStart().startsWith('{'))
            continue;
        try {
            const event = JSON.parse(line);
            const anomalies = event.anomalies ?? [];
            const binOnlyLocationFlag = anomalies.length === 1 && anomalies[0] === 'location_mismatch';
            if (event.event === 'audit_result' &&
                event.channelId &&
                anomalies.length > 0 &&
                !binOnlyLocationFlag) {
                ids.add(event.channelId);
            }
        }
        catch {
        }
    }
    return [...ids];
}
async function main() {
    const apply = hasFlag('apply');
    const limit = Math.max(0, Number(option('limit', '0')) || 0);
    const offset = Math.max(0, Number(option('offset', '0')) || 0);
    const channelFilter = option('channel-id', '').trim();
    const cleanupOnly = hasFlag('cleanup-only');
    const cleanupOfferId = option('cleanup-offer-id', '').trim();
    const recreateStale = hasFlag('recreate-stale');
    const reportPath = option('report', '/tmp/add-part-ebay-audit-20260823-v4.jsonl');
    const auditedIds = auditedAnomalyIds(reportPath);
    if (auditedIds.length === 0)
        throw new Error(`No audited anomaly rows found in ${reportPath}`);
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn'],
    });
    try {
        const dataSource = app.get(typeorm_2.DataSource);
        const publishService = app.get(ebay_publish_service_js_1.EbayPublishService);
        const inventoryApi = app.get(ebay_inventory_api_service_js_1.EbayInventoryApiService);
        const compatibilityReconciler = app.get(ebay_compatibility_reconciliation_service_js_1.EbayCompatibilityReconciliationService);
        const catalogRepo = app.get((0, typeorm_1.getRepositoryToken)(catalog_product_entity_js_1.CatalogProduct));
        const rows = await dataSource.query(`
        SELECT
          elc.id AS "channelId",
          ca.primary_store_id AS "storeId",
          ca.id AS "accountId",
          elc.marketplace_id AS "marketplaceId",
          COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) AS sku,
          cp.sku AS "catalogSku",
          elc.ebay_inventory_sku AS "ebaySku",
          source_listing.id AS "sourceListingId",
          cp.id AS "catalogProductId",
          elc.offer_id AS "offerId",
          elc.listing_id AS "listingId",
          epl.id AS "publishedListingId"
        FROM ebay_listing_channels elc
        JOIN catalog_products cp ON cp.id = elc.catalog_product_id
        JOIN connected_ebay_accounts ca ON ca.id = elc.ebay_account_id
        JOIN LATERAL (
          SELECT lr.id
          FROM listing_records lr
          WHERE lr.origin = 'add_part'
            AND lr."customLabelSku" = cp.sku
            AND lr."deletedAt" IS NULL
          ORDER BY lr."updatedAt" DESC NULLS LAST, lr."importedAt" DESC NULLS LAST
          LIMIT 1
        ) source_listing ON TRUE
        LEFT JOIN ebay_published_listings epl
          ON epl.ebay_account_id = elc.ebay_account_id
         AND epl.marketplace_id = elc.marketplace_id
         AND epl.ebay_item_id = elc.listing_id
        WHERE elc.id = ANY($1::uuid[])
          AND elc.listing_status = 'published'
          AND elc.listing_id IS NOT NULL
          AND COALESCE(source_listing.id::text, '') <> ''
          AND COALESCE((
            SELECT lr."cBrand"
            FROM listing_records lr
            WHERE lr.id = source_listing.id
          ), cp.brand, '') !~* '(febi|lemf)'
        ORDER BY ca.id, elc.listing_id
      `, [auditedIds]);
        const scopedRows = channelFilter
            ? rows.filter((row) => row.channelId === channelFilter)
            : rows;
        if (channelFilter && scopedRows.length === 0) {
            throw new Error(`Repair channel ${channelFilter} was not found in the audited target set`);
        }
        const selected = limit > 0
            ? scopedRows.slice(offset, offset + limit)
            : scopedRows.slice(offset);
        const normal = selected.filter((target) => target.ebaySku === target.catalogSku &&
            !target.ebaySku.includes('-FF-'));
        const collision = selected.filter((target) => !normal.includes(target));
        console.log(JSON.stringify({
            event: 'repair_started',
            apply,
            auditedAnomalyCount: auditedIds.length,
            targetCount: selected.length,
            offset,
            normalSkuRepairCount: normal.length,
            collisionOrFreshSkuCount: collision.length,
            readOnly: !apply,
            startedAt: new Date().toISOString(),
        }));
        for (const target of selected) {
            if (!normal.includes(target)) {
                console.log(JSON.stringify({
                    event: 'repair_skipped',
                    channelId: target.channelId,
                    sku: target.sku,
                    ebaySku: target.ebaySku,
                    reason: 'fresh_or_noncanonical_sku_requires_canonical_recovery',
                }));
                continue;
            }
            if (!apply) {
                console.log(JSON.stringify({
                    event: 'repair_would_apply',
                    channelId: target.channelId,
                    sku: target.sku,
                    sourceListingId: target.sourceListingId,
                }));
                continue;
            }
            if (cleanupOnly) {
                const cleanupSku = (0, ebay_sku_util_js_1.conflictSafeSkuFor)(target.catalogSku);
                if (!cleanupSku) {
                    throw new Error(`Cannot derive a deterministic cleanup SKU for ${target.catalogSku}`);
                }
                if (cleanupOfferId) {
                    if (target.offerId === cleanupOfferId) {
                        throw new Error(`Cleanup refused for ${cleanupOfferId}: it is still the local channel offer`);
                    }
                    const canonical = await publishService.buildCanonicalRecoveryProjection(target.sourceListingId, target.storeId);
                    const item = await inventoryApi.getItem(target.storeId, target.catalogSku);
                    const offers = await inventoryApi.getOffersBySku(target.storeId, target.catalogSku, 100, 0);
                    const ownedOffer = offers.offers.find((offer) => offer.offerId === cleanupOfferId);
                    const safeFailedRecreate = Boolean(ownedOffer) &&
                        ownedOffer?.status === 'PUBLISHED' &&
                        !ownedOffer.listingId &&
                        item.product?.title?.trim() ===
                            canonical.item.product.title?.trim();
                    if (!safeFailedRecreate) {
                        throw new Error(`Cleanup refused for ${cleanupOfferId}: failed-recreate ownership was not proven`);
                    }
                    await inventoryApi.withdrawOffer(target.storeId, cleanupOfferId);
                    await inventoryApi.deleteOffer(target.storeId, cleanupOfferId);
                    const remaining = await inventoryApi.getOffersBySku(target.storeId, target.catalogSku, 100, 0);
                    if (remaining.total === 0) {
                        await inventoryApi.deleteItem(target.storeId, target.catalogSku);
                    }
                    console.log(JSON.stringify({
                        event: 'failed_recreate_cleanup_result',
                        channelId: target.channelId,
                        sku: target.catalogSku,
                        offerId: cleanupOfferId,
                        deleted: true,
                    }));
                    continue;
                }
                const canonical = await publishService.buildCanonicalRecoveryProjection(target.sourceListingId, target.storeId);
                const item = await inventoryApi
                    .getItem(target.storeId, cleanupSku)
                    .catch((error) => {
                    if (isNotFound(error))
                        return null;
                    throw error;
                });
                const offers = await inventoryApi.getOffersBySku(target.storeId, cleanupSku, 100, 0);
                const actualProduct = item?.product;
                const expectedProduct = canonical.item.product;
                const blockingOffers = offers.offers.filter((offer) => offer.status === 'PUBLISHED' || Boolean(offer.listingId));
                const deletableOffers = offers.offers.filter((offer) => Boolean(offer.offerId) &&
                    offer.status !== 'PUBLISHED' &&
                    !offer.listingId);
                const safeOrphan = Boolean(item) &&
                    blockingOffers.length === 0 &&
                    actualProduct?.title?.trim() === expectedProduct.title?.trim() &&
                    (actualProduct.imageUrls?.length ?? 0) ===
                        (expectedProduct.imageUrls?.length ?? 0) &&
                    (!actualProduct.mpn ||
                        !expectedProduct.mpn ||
                        actualProduct.mpn === expectedProduct.mpn);
                console.log(JSON.stringify({
                    event: 'alternate_cleanup_check',
                    channelId: target.channelId,
                    canonicalSku: target.catalogSku,
                    alternateSku: cleanupSku,
                    itemExists: Boolean(item),
                    offerCount: offers.total,
                    actualTitle: actualProduct?.title ?? null,
                    expectedTitle: expectedProduct.title ?? null,
                    actualImageCount: actualProduct?.imageUrls?.length ?? null,
                    expectedImageCount: expectedProduct.imageUrls?.length ?? null,
                    actualMpn: actualProduct?.mpn ?? null,
                    expectedMpn: expectedProduct.mpn ?? null,
                    offers: offers.offers.map((offer) => ({
                        offerId: offer.offerId ?? null,
                        status: offer.status ?? null,
                        listingId: offer.listingId ?? null,
                    })),
                    safeOrphan,
                }));
                if (!safeOrphan) {
                    throw new Error(`Cleanup refused for ${cleanupSku}: unpublished canonical partial recovery was not proven`);
                }
                for (const offer of deletableOffers) {
                    await inventoryApi.deleteOffer(target.storeId, offer.offerId);
                }
                const remaining = await inventoryApi.getOffersBySku(target.storeId, cleanupSku, 100, 0);
                if (remaining.total > 0) {
                    throw new Error(`Cleanup retained ${remaining.total} offer(s) for ${cleanupSku}`);
                }
                await inventoryApi.deleteItem(target.storeId, cleanupSku);
                console.log(JSON.stringify({
                    event: 'alternate_cleanup_result',
                    channelId: target.channelId,
                    canonicalSku: target.catalogSku,
                    alternateSku: cleanupSku,
                    itemExists: true,
                    offerCount: offers.total,
                    deletedOfferCount: deletableOffers.length,
                    deleted: true,
                }));
                continue;
            }
            if (recreateStale) {
                try {
                    if (!target.offerId) {
                        throw new Error(`Cannot recreate ${target.catalogSku}: local offer ID is missing`);
                    }
                    const catalog = await catalogRepo.findOneBy({
                        id: target.catalogProductId,
                    });
                    if (!catalog) {
                        throw new Error(`Catalog product ${target.catalogProductId} not found`);
                    }
                    const expected = (await publishService.resolveCatalogCompatibility(catalog)) ?? {
                        compatibleProducts: [],
                    };
                    const canonical = await publishService.buildCanonicalRecoveryProjection(target.sourceListingId, target.storeId);
                    const listingId = await compatibilityReconciler.recreatePublishedOffer(target.storeId, target.offerId, target.catalogSku, expected, { item: canonical.item, offer: canonical.offer });
                    const offers = await inventoryApi.getOffersBySku(target.storeId, target.catalogSku, 100, 0);
                    const replacementOffer = offers.offers.find((offer) => offer.listingId === listingId);
                    if (!replacementOffer?.offerId) {
                        throw new Error(`Recreated listing ${listingId} has no discoverable offer for ${target.catalogSku}`);
                    }
                    await persistChannelProjection(dataSource, target, {
                        effectiveSku: target.catalogSku,
                        offerId: replacementOffer.offerId,
                        listingId,
                    });
                    console.log(JSON.stringify({
                        event: 'stale_recreate_result',
                        channelId: target.channelId,
                        sku: target.catalogSku,
                        offerId: replacementOffer.offerId,
                        listingId,
                    }));
                }
                catch (error) {
                    console.log(JSON.stringify({
                        event: 'stale_recreate_error',
                        channelId: target.channelId,
                        sku: target.catalogSku,
                        error: errorMessage(error),
                    }));
                }
                continue;
            }
            const alternateSku = target.ebaySku === target.catalogSku
                ? (0, ebay_sku_util_js_1.conflictSafeSkuFor)(target.catalogSku)
                : null;
            let alternateWasAbsent = false;
            if (alternateSku) {
                try {
                    await inventoryApi.getItem(target.storeId, alternateSku);
                }
                catch (error) {
                    alternateWasAbsent = isNotFound(error);
                }
            }
            try {
                const [result] = await publishService.publishByListingIds([target.sourceListingId], [target.storeId]);
                const failedStores = result?.results?.filter((item) => !item.success) ?? [];
                if (!result || failedStores.length > 0) {
                    const details = failedStores
                        .map((item) => `${item.storeId}: ${item.error ?? 'publish returned success=false'}`)
                        .join('; ');
                    console.log(JSON.stringify({
                        event: 'repair_error',
                        channelId: target.channelId,
                        sku: target.sku,
                        error: details || 'publishByListingIds returned no result',
                        result: result ?? null,
                    }));
                    continue;
                }
                const successfulStore = result.results.find((item) => item.success);
                if (!successfulStore) {
                    throw new Error(`Publish returned no successful store result for ${target.catalogSku}`);
                }
                await persistChannelProjection(dataSource, target, successfulStore);
                console.log(JSON.stringify({
                    event: 'repair_result',
                    channelId: target.channelId,
                    sku: target.sku,
                    effectiveSku: successfulStore.effectiveSku ?? target.catalogSku,
                    result,
                }));
            }
            catch (error) {
                if (alternateWasAbsent && alternateSku) {
                    await cleanupUnpublishedAlternate(inventoryApi, target, alternateSku);
                }
                console.log(JSON.stringify({
                    event: 'repair_error',
                    channelId: target.channelId,
                    sku: target.sku,
                    error: errorMessage(error),
                }));
            }
        }
        console.log(JSON.stringify({
            event: 'repair_completed',
            apply,
            targetCount: selected.length,
            offset,
            normalSkuRepairCount: normal.length,
            collisionOrFreshSkuCount: collision.length,
            completedAt: new Date().toISOString(),
        }));
    }
    finally {
        await app.close();
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(JSON.stringify({ event: 'repair_failed', error: errorMessage(error) }));
    process.exit(1);
});
//# sourceMappingURL=repair-add-part-ebay.js.map