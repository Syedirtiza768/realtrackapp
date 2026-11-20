"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EbayFitmentPublishService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayFitmentPublishService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const ebay_compatibility_reconciliation_service_js_1 = require("../channels/ebay/ebay-compatibility-reconciliation.service.js");
const ebay_publish_service_js_1 = require("../channels/ebay/ebay-publish.service.js");
let EbayFitmentPublishService = EbayFitmentPublishService_1 = class EbayFitmentPublishService {
    dataSource;
    catalogRepo;
    publishService;
    reconciler;
    logger = new common_1.Logger(EbayFitmentPublishService_1.name);
    constructor(dataSource, catalogRepo, publishService, reconciler) {
        this.dataSource = dataSource;
        this.catalogRepo = catalogRepo;
        this.publishService = publishService;
        this.reconciler = reconciler;
    }
    async publishValidatedFitment(productId, marketplace = 'US') {
        const catalog = await this.catalogRepo.findOneBy({ id: productId });
        if (!catalog) {
            return {
                productId,
                status: 'failed',
                rows: 0,
                channels: 0,
                message: 'Catalog product not found',
            };
        }
        const expected = (await this.publishService.resolveCatalogCompatibility(catalog)) ?? { compatibleProducts: [] };
        if (expected.compatibleProducts.length === 0) {
            this.logger.log(`Skipping product ${catalog.sku ?? productId}: no validated fitment rows after optimization`);
            return {
                productId,
                status: 'skipped',
                rows: 0,
                channels: 0,
                message: 'No validated fitment rows',
            };
        }
        const marketplaceId = this.marketplaceIdFor(marketplace);
        const targets = await this.dataSource.query(`
        SELECT
          elc.id AS "channelId",
          ca.primary_store_id AS "storeId",
          elc.marketplace_id AS "marketplaceId",
          COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) AS sku,
          elc.listing_id AS "listingId",
          elc.offer_id AS "offerId",
          epl.id AS "publishedListingId"
        FROM ebay_listing_channels elc
        JOIN connected_ebay_accounts ca ON ca.id = elc.ebay_account_id
        JOIN catalog_products cp ON cp.id = elc.catalog_product_id
        LEFT JOIN ebay_published_listings epl
          ON epl.ebay_account_id = elc.ebay_account_id
         AND epl.marketplace_id = elc.marketplace_id
         AND epl.ebay_item_id = elc.listing_id
        WHERE elc.catalog_product_id = $1
          AND elc.listing_status = 'published'
          AND elc.listing_id IS NOT NULL
          AND elc.marketplace_id = $2
          AND COALESCE(elc.ebay_inventory_sku, elc.internal_sku, cp.sku) IS NOT NULL
        ORDER BY elc.ebay_account_id, elc.listing_id
      `, [productId, marketplaceId]);
        if (targets.length === 0) {
            return {
                productId,
                status: 'skipped',
                rows: expected.compatibleProducts.length,
                channels: 0,
                message: 'No published eBay channels for product',
            };
        }
        let synced = 0;
        for (const target of targets) {
            await this.syncTarget(target, expected);
            synced += 1;
        }
        this.logger.log(`Published ${expected.compatibleProducts.length} validated fitment row(s) for ${catalog.sku ?? productId} across ${synced} channel(s)`);
        return {
            productId,
            status: 'published',
            rows: expected.compatibleProducts.length,
            channels: synced,
        };
    }
    async syncTarget(target, expected) {
        let listingId = target.listingId;
        let sku = target.sku;
        let offerId = target.offerId;
        try {
            await this.reconciler.syncInventory(target.storeId, sku, expected);
            if (offerId) {
                try {
                    listingId =
                        (await this.reconciler.refreshPublishedOffer(target.storeId, offerId, sku, expected)) ?? listingId;
                    await this.reconciler.verifyLiveListing(target.storeId, listingId, target.marketplaceId, sku, expected);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    if (!message.includes('compatibility verification failed') &&
                        !message.includes('status code 404')) {
                        throw err;
                    }
                    try {
                        listingId = await this.reconciler.recreatePublishedOffer(target.storeId, offerId, sku, expected);
                        await this.reconciler.verifyLiveListing(target.storeId, listingId, target.marketplaceId, sku, expected);
                    }
                    catch (sameSkuErr) {
                        const sameSkuMessage = sameSkuErr instanceof Error
                            ? sameSkuErr.message
                            : String(sameSkuErr);
                        this.logger.warn(`Same-SKU fitment recovery failed for ${sku}/${target.listingId}: ${sameSkuMessage}; using fresh SKU`);
                        const fresh = await this.reconciler.recreatePublishedOfferWithFreshSku(target.storeId, offerId, sku, expected);
                        listingId = fresh.listingId;
                        sku = fresh.sku;
                        offerId = fresh.offerId;
                        await this.reconciler.verifyLiveListing(target.storeId, listingId, target.marketplaceId, sku, expected);
                    }
                }
            }
            else {
                await this.reconciler.syncLiveListing(target.storeId, listingId, target.marketplaceId, sku, expected);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('not allowed to revise ended listings') ||
                message.includes('original offer is missing and 0 replacement')) {
                await this.dataSource.query(`UPDATE ebay_listing_channels
              SET listing_status = 'ended',
                  last_synced_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1`, [target.channelId]);
                this.logger.warn(`Marked ended channel ${target.channelId} for item ${target.listingId} while publishing fitment`);
                return;
            }
            throw err;
        }
        await this.dataSource.query(`UPDATE ebay_listing_channels
          SET listing_id = $1,
              listing_url = $2,
              offer_id = $3,
              ebay_inventory_sku = $4,
              last_revised_at = NOW(),
              last_synced_at = NOW(),
              updated_at = NOW()
        WHERE id = $5`, [
            listingId,
            `https://www.ebay.com/itm/${listingId}`,
            offerId,
            sku,
            target.channelId,
        ]);
        if (target.publishedListingId) {
            await this.dataSource.query(`UPDATE ebay_published_listings
            SET ebay_item_id = $1,
                offer_id = $2,
                sku = $3,
                listing_url = $4,
                compatibility = $5::jsonb,
                last_synced_at = NOW(),
                updated_at = NOW()
          WHERE id = $6`, [
                listingId,
                offerId,
                sku,
                `https://www.ebay.com/itm/${listingId}`,
                JSON.stringify(expected),
                target.publishedListingId,
            ]);
        }
    }
    marketplaceIdFor(marketplace) {
        if (marketplace === 'DE')
            return 'EBAY_DE';
        if (marketplace === 'AU')
            return 'EBAY_AU';
        return 'EBAY_MOTORS_US';
    }
};
exports.EbayFitmentPublishService = EbayFitmentPublishService;
exports.EbayFitmentPublishService = EbayFitmentPublishService = EbayFitmentPublishService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        typeorm_2.Repository,
        ebay_publish_service_js_1.EbayPublishService,
        ebay_compatibility_reconciliation_service_js_1.EbayCompatibilityReconciliationService])
], EbayFitmentPublishService);
//# sourceMappingURL=ebay-fitment-publish.service.js.map