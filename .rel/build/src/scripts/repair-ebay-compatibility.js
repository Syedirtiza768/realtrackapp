"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const app_module_js_1 = require("../app.module.js");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const ebay_published_listing_entity_js_1 = require("../published-listings/entities/ebay-published-listing.entity.js");
const ebay_compatibility_reconciliation_service_js_1 = require("../channels/ebay/ebay-compatibility-reconciliation.service.js");
const ebay_publish_service_js_1 = require("../channels/ebay/ebay-publish.service.js");
const fitment_mvl_util_js_1 = require("../fitment/fitment-mvl.util.js");
function option(name) {
    const prefix = `--${name}=`;
    return process.argv
        .find((arg) => arg.startsWith(prefix))
        ?.slice(prefix.length);
}
function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}
function expectedCompatibilityFromStoredRows(target) {
    const source = (0, fitment_mvl_util_js_1.selectPublishFitmentSource)(target.fitmentData, target.fitmentRows);
    return ((0, fitment_mvl_util_js_1.fitmentDataToCompatibilityPayload)(source) ?? {
        compatibleProducts: [],
    });
}
async function main() {
    const apply = hasFlag('apply');
    if (hasFlag('all-current') && !hasFlag('confirm-all-current')) {
        throw new Error('--all-current scans every published channel; add --confirm-all-current to enable it. ' +
            'Use the default candidate query for fitment mismatch repair.');
    }
    const allCurrent = hasFlag('all-current') && hasFlag('confirm-all-current');
    const skuFilter = option('sku');
    const skuList = (option('sku-list') ?? '')
        .split(',')
        .map((sku) => sku.trim())
        .filter(Boolean);
    const explicitSkuScope = Boolean(skuFilter || skuList.length > 0);
    const skuScope = skuList.length > 0 ? skuList.join(',') : (skuFilter ?? null);
    const limit = Number(option('limit') ?? '0');
    const unavailableFitmentPredicate = `(
            jsonb_array_length(COALESCE(cp.fitment_data, '[]'::jsonb)) = 0
            AND NOT EXISTS (
              SELECT 1
                FROM jsonb_array_elements(COALESCE(cp.fitment_rows, '[]'::jsonb)) AS fitment_row
               WHERE lower(COALESCE(
                 fitment_row->>'MvlStatus',
                 fitment_row->>'mvlStatus',
                 fitment_row->>'validationStatus',
                 fitment_row->>'ValidationStatus',
                 ''
               )) = 'valid'
            )
            AND (
              jsonb_array_length(COALESCE(cp.fitment_rows, '[]'::jsonb)) = 0
              OR EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(COALESCE(cp.fitment_rows, '[]'::jsonb)) AS fitment_row
                 WHERE lower(COALESCE(
                   fitment_row->>'MvlStatus',
                   fitment_row->>'mvlStatus',
                   fitment_row->>'validationStatus',
                   fitment_row->>'ValidationStatus',
                   ''
                 )) <> ''
              )
            )
          )`;
    const candidatePredicate = allCurrent
        ? 'TRUE'
        : explicitSkuScope
            ? unavailableFitmentPredicate
            : `(
            jsonb_array_length(COALESCE(epl.compatibility->'compatibleProducts', '[]'::jsonb)) > 0
            AND ${unavailableFitmentPredicate}
          )`;
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    try {
        const dataSource = app.get(typeorm_2.DataSource);
        const reconciler = app.get(ebay_compatibility_reconciliation_service_js_1.EbayCompatibilityReconciliationService);
        const publishService = app.get(ebay_publish_service_js_1.EbayPublishService);
        const catalogRepo = app.get((0, typeorm_1.getRepositoryToken)(catalog_product_entity_js_1.CatalogProduct));
        const publishedRepo = app.get((0, typeorm_1.getRepositoryToken)(ebay_published_listing_entity_js_1.EbayPublishedListing));
        const rows = await dataSource.query(`
        SELECT
          elc.id AS "channelId",
          ca.primary_store_id AS "storeId",
          elc.ebay_account_id AS "accountId",
          elc.marketplace_id AS "marketplaceId",
          COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) AS "sku",
          elc.listing_id AS "listingId",
          elc.offer_id AS "offerId",
          epl.id AS "publishedListingId",
          cp.id AS "catalogProductId",
          source_listing.id AS "sourceListingId",
          cp.title,
          cp.fitment_status AS "fitmentStatus",
          cp.fitment_data AS "fitmentData",
          cp.fitment_rows AS "fitmentRows",
          jsonb_array_length(COALESCE(epl.compatibility->'compatibleProducts', '[]'::jsonb)) AS "localCompatibilityRows"
        FROM ebay_listing_channels elc
        JOIN catalog_products cp ON cp.id = elc.catalog_product_id
        JOIN connected_ebay_accounts ca ON ca.id = elc.ebay_account_id
        LEFT JOIN LATERAL (
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
        WHERE elc.listing_status = 'published'
          AND elc.marketplace_id = 'EBAY_MOTORS_US'
          AND elc.listing_id IS NOT NULL
          AND COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) IS NOT NULL
          AND (
            $1::text IS NULL
            OR COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) = ANY(string_to_array($1, ','))
          )
          AND ${candidatePredicate}
        ORDER BY elc.ebay_account_id, elc.listing_id
      `, [skuScope]);
        const targets = limit > 0 ? rows.slice(0, limit) : rows;
        console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${targets.length} target channel(s) ` +
            `(candidate query returned ${rows.length})`);
        let repaired = 0;
        let unchanged = 0;
        let failed = 0;
        for (const target of targets) {
            const storedExpected = expectedCompatibilityFromStoredRows(target);
            const label = `${target.sku} / item ${target.listingId}`;
            console.log(`${apply ? 'Repairing' : 'Would repair'} ${label}: ` +
                `${target.localCompatibilityRows} local row(s) -> ${storedExpected.compatibleProducts.length} stored-source row(s) ` +
                `[${target.fitmentStatus ?? 'no status'}]`);
            if (!apply)
                continue;
            try {
                const catalog = await catalogRepo.findOne({
                    where: { id: target.catalogProductId },
                });
                const expected = catalog
                    ? ((await publishService.resolveCatalogCompatibility(catalog)) ?? {
                        compatibleProducts: [],
                    })
                    : expectedCompatibilityFromStoredRows(target);
                await reconciler.syncInventory(target.storeId, target.sku, expected);
                let verifiedListingId = target.listingId;
                let verifiedSku = target.sku;
                let verifiedOfferId = target.offerId;
                if (target.offerId) {
                    const getCanonicalRecoverySource = async () => {
                        if (!target.sourceListingId) {
                            throw new common_1.BadRequestException(`Recovery for ${label} requires a canonical Add Part source row; ` +
                                'the remote item is not trusted.');
                        }
                        const canonical = await publishService.buildCanonicalRecoveryProjection(target.sourceListingId, target.storeId);
                        return { item: canonical.item, offer: canonical.offer };
                    };
                    const recoverWithFreshSku = async () => {
                        const canonical = await getCanonicalRecoverySource();
                        const fresh = await reconciler.recreatePublishedOfferWithFreshSku(target.storeId, verifiedOfferId ?? target.offerId, verifiedSku, expected, canonical);
                        verifiedSku = fresh.sku;
                        verifiedOfferId = fresh.offerId;
                        verifiedListingId = fresh.listingId;
                        await reconciler.verifyLiveListing(target.storeId, verifiedListingId, target.marketplaceId, verifiedSku, expected);
                    };
                    try {
                        verifiedListingId =
                            (await reconciler.refreshPublishedOffer(target.storeId, target.offerId, target.sku, expected)) ?? verifiedListingId;
                    }
                    catch (refreshErr) {
                        const message = refreshErr instanceof Error
                            ? refreshErr.message
                            : String(refreshErr);
                        if (!message.includes('status code 404'))
                            throw refreshErr;
                        try {
                            await reconciler.syncLiveListing(target.storeId, target.listingId, target.marketplaceId, target.sku, expected);
                            verifiedListingId = target.listingId;
                        }
                        catch (legacyErr) {
                            const legacyMessage = legacyErr instanceof Error
                                ? legacyErr.message
                                : String(legacyErr);
                            console.log(`${label}: offer ${target.offerId} is gone; legacy fallback returned ${legacyMessage}; using a fresh Inventory SKU`);
                            await recoverWithFreshSku();
                        }
                    }
                    try {
                        await reconciler.verifyLiveListing(target.storeId, verifiedListingId, target.marketplaceId, verifiedSku, expected);
                    }
                    catch (verificationErr) {
                        const message = verificationErr instanceof Error
                            ? verificationErr.message
                            : String(verificationErr);
                        if (!message.includes('compatibility verification failed')) {
                            throw verificationErr;
                        }
                        console.log(`${label}: published eBay projection retained stale rows; trying same-SKU recreation`);
                        try {
                            verifiedListingId = await reconciler.recreatePublishedOffer(target.storeId, target.offerId, target.sku, expected, await getCanonicalRecoverySource());
                            await reconciler.verifyLiveListing(target.storeId, verifiedListingId, target.marketplaceId, target.sku, expected);
                        }
                        catch (sameSkuErr) {
                            const sameSkuMessage = sameSkuErr instanceof Error
                                ? sameSkuErr.message
                                : String(sameSkuErr);
                            console.log(`${label}: same-SKU recreation returned ${sameSkuMessage}; using a fresh Inventory SKU`);
                            await recoverWithFreshSku();
                        }
                    }
                    if (verifiedListingId !== target.listingId ||
                        verifiedOfferId !== target.offerId ||
                        verifiedSku !== target.sku) {
                        await dataSource.query(`UPDATE ebay_listing_channels
                  SET listing_id = $1,
                      listing_url = $2,
                      offer_id = $3,
                      ebay_inventory_sku = $4,
                      last_revised_at = NOW(),
                      last_synced_at = NOW(),
                      updated_at = NOW()
                WHERE id = $5`, [
                            verifiedListingId,
                            `https://www.ebay.com/itm/${verifiedListingId}`,
                            verifiedOfferId,
                            verifiedSku,
                            target.channelId,
                        ]);
                    }
                }
                else {
                    await reconciler.syncLiveListing(target.storeId, target.listingId, target.marketplaceId, target.sku, expected);
                }
                if (target.publishedListingId) {
                    await publishedRepo.update(target.publishedListingId, {
                        ebayItemId: verifiedListingId,
                        offerId: verifiedOfferId,
                        sku: verifiedSku,
                        listingUrl: `https://www.ebay.com/itm/${verifiedListingId}`,
                        compatibility: expected,
                        lastSyncedAt: new Date(),
                    });
                }
                if (target.localCompatibilityRows === expected.compatibleProducts.length) {
                    unchanged += 1;
                }
                else {
                    repaired += 1;
                }
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('not allowed to revise ended listings') ||
                    message.includes('original offer is missing and 0 replacement')) {
                    await dataSource.query(`UPDATE ebay_listing_channels
                SET listing_status = 'ended',
                    last_synced_at = NOW(),
                    updated_at = NOW()
              WHERE id = $1`, [target.channelId]);
                    if (target.publishedListingId) {
                        await publishedRepo.update(target.publishedListingId, {
                            compatibility: { compatibleProducts: [] },
                            lastSyncedAt: new Date(),
                        });
                    }
                    unchanged += 1;
                    console.warn(`ENDED ${label}: ${message}`);
                    continue;
                }
                failed += 1;
                console.error(`FAILED ${label}: ${message}`);
            }
        }
        console.log(`Summary: repaired=${repaired}, unchanged=${unchanged}, failed=${failed}`);
        if (failed > 0)
            process.exitCode = 1;
    }
    finally {
        await app.close();
    }
}
main().catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
});
//# sourceMappingURL=repair-ebay-compatibility.js.map