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
var InventoryPublishService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPublishService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const listing_store_override_entity_js_1 = require("../integrations/ebay/entities/listing-store-override.entity.js");
const ebay_multi_store_listing_service_js_1 = require("../integrations/ebay/services/ebay-multi-store-listing.service.js");
let InventoryPublishService = InventoryPublishService_1 = class InventoryPublishService {
    listingRepo;
    productRepo;
    storeRepo;
    ebayAccountRepo;
    overrideRepo;
    multiStoreListing;
    logger = new common_1.Logger(InventoryPublishService_1.name);
    constructor(listingRepo, productRepo, storeRepo, ebayAccountRepo, overrideRepo, multiStoreListing) {
        this.listingRepo = listingRepo;
        this.productRepo = productRepo;
        this.storeRepo = storeRepo;
        this.ebayAccountRepo = ebayAccountRepo;
        this.overrideRepo = overrideRepo;
        this.multiStoreListing = multiStoreListing;
    }
    async publish(listingId, userId, targets) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        const organizationId = listing.organizationId;
        if (!organizationId) {
            throw new common_1.BadRequestException('Listing has no organization — cannot publish');
        }
        const sku = listing.customLabelSku;
        if (!sku) {
            throw new common_1.BadRequestException('Listing has no SKU — cannot publish');
        }
        const catalogProduct = await this.ensureCatalogProduct(listing);
        const storeIds = targets.map((t) => t.storeId);
        const stores = await this.storeRepo.find({ where: { id: (0, typeorm_2.In)(storeIds) } });
        const storeMap = new Map(stores.map((s) => [s.id, s]));
        const accounts = await this.ebayAccountRepo.find({
            where: { primaryStoreId: (0, typeorm_2.In)(storeIds) },
        });
        const accountByStore = new Map();
        for (const a of accounts) {
            accountByStore.set(a.primaryStoreId, a);
        }
        const publishTargets = [];
        const resultTargets = [];
        for (const target of targets) {
            const store = storeMap.get(target.storeId);
            if (!store) {
                resultTargets.push({
                    storeId: target.storeId,
                    marketplaceId: target.marketplaceId,
                    status: 'skipped',
                    errors: ['Store not found'],
                });
                continue;
            }
            const account = accountByStore.get(target.storeId);
            if (!account) {
                resultTargets.push({
                    storeId: target.storeId,
                    marketplaceId: target.marketplaceId,
                    status: 'skipped',
                    errors: ['No eBay account linked to this store'],
                });
                continue;
            }
            publishTargets.push({
                ebayAccountId: account.id,
                marketplaceId: target.marketplaceId,
            });
            resultTargets.push({
                storeId: target.storeId,
                marketplaceId: target.marketplaceId,
                status: 'eligible',
            });
            if (target.policyOverrides) {
                await this.upsertPolicyOverrides(catalogProduct.id, account.id, target.marketplaceId, target.policyOverrides);
            }
        }
        if (publishTargets.length === 0) {
            throw new common_1.BadRequestException({
                message: 'No valid publish targets',
                targets: resultTargets,
            });
        }
        try {
            const result = await this.multiStoreListing.createPublishJob({
                organizationId,
                requestedByUserId: userId,
                catalogProductId: catalogProduct.id,
                sourceListingId: listingId,
                targets: publishTargets,
            });
            for (const skipped of result.skipped) {
                const existing = resultTargets.find((t) => t.marketplaceId === skipped.marketplaceId &&
                    stores.find((s) => accountByStore.get(s.id)?.id === skipped.ebayAccountId)?.id ===
                        resultTargets.find((rt) => rt.marketplaceId === skipped.marketplaceId)?.storeId);
                if (existing) {
                    existing.status = 'skipped';
                    existing.errors = skipped.errors;
                }
            }
            return {
                jobId: result.job.id,
                status: result.job.status,
                targets: resultTargets,
            };
        }
        catch (err) {
            this.logger.error(`Publish failed for listing ${listingId}: ${err instanceof Error ? err.message : err}`);
            throw err;
        }
    }
    async ensureCatalogProduct(listing) {
        const sku = listing.customLabelSku;
        const existing = await this.productRepo.findOne({ where: { sku } });
        if (existing)
            return existing;
        const product = this.productRepo.create({
            sku,
            title: listing.title ?? listing.cOeOemPartNumber ?? '',
            description: listing.description ?? null,
            brand: listing.cBrand ?? null,
            brandNormalized: listing.cBrand?.toLowerCase().trim() ?? null,
            mpn: listing.cManufacturerPartNumber ?? null,
            mpnNormalized: listing.cManufacturerPartNumber?.toLowerCase().replace(/[\s\-]/g, '') ??
                null,
            oemPartNumber: listing.cOeOemPartNumber ?? null,
            partType: listing.cType ?? null,
            features: listing.cFeatures ?? null,
            categoryId: listing.categoryId ?? null,
            categoryName: listing.categoryName ?? null,
            price: listing.startPriceNum ?? null,
            quantity: listing.quantityNum ?? null,
            conditionId: listing.conditionId ?? null,
            imageUrls: this.parseImageUrls(listing.itemPhotoUrl),
            location: listing.location ?? null,
            pipelineJobId: listing.pipelineJobId ?? null,
        });
        const saved = await this.productRepo.save(product);
        this.logger.log(`Created catalog product ${saved.id} for SKU ${sku}`);
        return saved;
    }
    async upsertPolicyOverrides(catalogProductId, ebayAccountId, marketplaceId, overrides) {
        const policyOverrides = {};
        if (overrides.fulfillmentPolicyId) {
            policyOverrides.fulfillmentPolicyId = overrides.fulfillmentPolicyId;
        }
        if (overrides.paymentPolicyId) {
            policyOverrides.paymentPolicyId = overrides.paymentPolicyId;
        }
        if (overrides.returnPolicyId) {
            policyOverrides.returnPolicyId = overrides.returnPolicyId;
        }
        if (overrides.merchantLocationKey) {
            policyOverrides.merchantLocationKey = overrides.merchantLocationKey;
        }
        if (Object.keys(policyOverrides).length === 0)
            return;
        let row = await this.overrideRepo.findOne({
            where: { catalogProductId, ebayAccountId, marketplaceId },
        });
        if (!row) {
            row = this.overrideRepo.create({
                catalogProductId,
                ebayAccountId,
                marketplaceId,
                policyOverrides,
            });
        }
        else {
            row.policyOverrides = { ...row.policyOverrides, ...policyOverrides };
        }
        await this.overrideRepo.save(row);
        this.logger.debug(`Policy overrides saved for product ${catalogProductId} account ${ebayAccountId} ${marketplaceId}`);
    }
    parseImageUrls(raw) {
        if (!raw?.trim())
            return [];
        return raw
            .split('|')
            .map((u) => u.trim())
            .filter(Boolean);
    }
};
exports.InventoryPublishService = InventoryPublishService;
exports.InventoryPublishService = InventoryPublishService = InventoryPublishService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(3, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(4, (0, typeorm_1.InjectRepository)(listing_store_override_entity_js_1.ListingStoreOverride)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_multi_store_listing_service_js_1.EbayMultiStoreListingService])
], InventoryPublishService);
//# sourceMappingURL=inventory-publish.service.js.map