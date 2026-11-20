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
var InventoryEditorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryEditorService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const part_fitment_entity_js_1 = require("../fitment/entities/part-fitment.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../integrations/ebay/entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../integrations/ebay/entities/ebay-business-policy.entity.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const MARKETPLACE_LABELS = {
    EBAY_US: 'United States',
    EBAY_AU: 'Australia',
    EBAY_DE: 'Germany',
    EBAY_GB: 'United Kingdom',
    EBAY_MOTORS_US: 'eBay Motors (US)',
};
const LISTING_MARKETPLACE_TO_EBAY = {
    US: 'EBAY_US',
    AU: 'EBAY_AU',
    DE: 'EBAY_DE',
};
const EBAY_TO_LISTING_MARKETPLACE = {
    EBAY_US: 'US',
    EBAY_MOTORS_US: 'US',
    EBAY_AU: 'AU',
    EBAY_DE: 'DE',
};
let InventoryEditorService = InventoryEditorService_1 = class InventoryEditorService {
    listingRepo;
    productRepo;
    fitmentRepo;
    storeRepo;
    ebayAccountRepo;
    marketplaceRepo;
    policyRepo;
    storeAccess;
    logger = new common_1.Logger(InventoryEditorService_1.name);
    constructor(listingRepo, productRepo, fitmentRepo, storeRepo, ebayAccountRepo, marketplaceRepo, policyRepo, storeAccess) {
        this.listingRepo = listingRepo;
        this.productRepo = productRepo;
        this.fitmentRepo = fitmentRepo;
        this.storeRepo = storeRepo;
        this.ebayAccountRepo = ebayAccountRepo;
        this.marketplaceRepo = marketplaceRepo;
        this.policyRepo = policyRepo;
        this.storeAccess = storeAccess;
    }
    async getEditorData(listingId, user) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        const sku = listing.customLabelSku;
        const siblings = sku
            ? await this.listingRepo.find({
                where: { customLabelSku: sku, deletedAt: (0, typeorm_2.IsNull)() },
            })
            : [];
        let catalogProduct = null;
        if (sku) {
            catalogProduct = await this.productRepo.findOne({ where: { sku } });
        }
        const listingInfo = {
            id: listing.id,
            sku: listing.customLabelSku ?? '',
            title: listing.title,
            brand: listing.cBrand,
            partType: listing.cType,
            mpn: listing.cManufacturerPartNumber,
            oemNumber: listing.cOeOemPartNumber,
            categoryId: listing.categoryId,
            categoryName: listing.categoryName,
            imageUrls: this.parseImageUrls(listing.itemPhotoUrl),
            fitmentCount: await this.fitmentRepo.count({ where: { listingId } }),
            status: listing.status,
        };
        const marketplaceVersions = this.buildMarketplaceVersions(listing, siblings, catalogProduct);
        const stores = await this.getStoresWithPolicies(user);
        return {
            listing: listingInfo,
            marketplaceVersions,
            stores,
        };
    }
    async saveEditorData(listingId, dto) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId },
        });
        if (!listing || listing.deletedAt) {
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        }
        const sku = listing.customLabelSku;
        const siblings = sku
            ? await this.listingRepo.find({
                where: { customLabelSku: sku, deletedAt: (0, typeorm_2.IsNull)() },
            })
            : [listing];
        const byMarketplace = new Map();
        for (const s of siblings) {
            const mkt = s.marketplace;
            if (mkt)
                byMarketplace.set(mkt, s);
        }
        let catalogProduct = null;
        if (sku) {
            catalogProduct = await this.productRepo.findOne({ where: { sku } });
        }
        const payloadVersions = {};
        if (catalogProduct?.optimizationPayload) {
            const raw = catalogProduct.optimizationPayload;
            if (raw.US || raw.AU || raw.DE) {
                Object.assign(payloadVersions, raw);
            }
        }
        for (const ver of dto.marketplaceVersions) {
            let target = byMarketplace.get(ver.marketplace);
            if (!target) {
                target = this.cloneListingForMarketplace(listing, ver.marketplace);
                target = await this.listingRepo.save(target);
                byMarketplace.set(ver.marketplace, target);
            }
            target.title = ver.title;
            target.description = ver.description;
            target.startPriceNum = ver.price ?? null;
            target.startPrice = ver.price != null ? String(ver.price) : null;
            target.quantityNum = ver.quantity ?? null;
            target.quantity = ver.quantity != null ? String(ver.quantity) : null;
            target.conditionId = ver.conditionId;
            await this.listingRepo.save(target);
            const existingPayload = (payloadVersions[ver.marketplace] ??
                {});
            payloadVersions[ver.marketplace] = {
                ...existingPayload,
                optimizedTitle: ver.title,
                seoDescription: ver.description,
                itemSpecifics: ver.itemSpecifics ?? {},
            };
        }
        if (catalogProduct) {
            catalogProduct.optimizationPayload = payloadVersions;
            const usVer = dto.marketplaceVersions.find((v) => v.marketplace === 'US');
            const primaryVer = usVer ?? dto.marketplaceVersions[0];
            if (primaryVer) {
                catalogProduct.title = primaryVer.title;
                catalogProduct.description = primaryVer.description;
                if (primaryVer.price != null)
                    catalogProduct.price = primaryVer.price;
                if (primaryVer.quantity != null)
                    catalogProduct.quantity = primaryVer.quantity;
                if (primaryVer.conditionId)
                    catalogProduct.conditionId = primaryVer.conditionId;
            }
            await this.productRepo.save(catalogProduct);
        }
        this.logger.log(`Saved editor data for listing ${listingId} (${dto.marketplaceVersions.length} versions)`);
        return { ok: true };
    }
    cloneListingForMarketplace(primary, marketplace) {
        const row = Math.floor(Date.now() + Math.random() * 1000) % 2_000_000_000;
        return this.listingRepo.create({
            organizationId: primary.organizationId,
            sourceFileName: primary.sourceFileName ?? 'warehouse-intake',
            sourceFilePath: primary.sourceFilePath ?? 'warehouse-intake',
            origin: primary.origin,
            sheetName: primary.sheetName ?? 'Listings',
            sourceRowNumber: row,
            customLabelSku: primary.customLabelSku,
            categoryId: primary.categoryId,
            categoryName: primary.categoryName,
            title: primary.title,
            description: primary.description,
            cBrand: primary.cBrand,
            cType: primary.cType,
            cManufacturerPartNumber: primary.cManufacturerPartNumber,
            cOeOemPartNumber: primary.cOeOemPartNumber,
            cFeatures: primary.cFeatures,
            conditionId: primary.conditionId,
            startPrice: primary.startPrice,
            startPriceNum: primary.startPriceNum,
            quantity: primary.quantity,
            quantityNum: primary.quantityNum,
            itemPhotoUrl: primary.itemPhotoUrl,
            location: primary.location,
            pipelineJobId: primary.pipelineJobId,
            teamId: primary.teamId,
            marketplace,
            status: primary.status ?? 'draft',
        });
    }
    buildMarketplaceVersions(primaryListing, siblings, catalogProduct) {
        const targetMarketplaces = ['US', 'AU', 'DE'];
        const byMarketplace = new Map();
        for (const s of siblings) {
            const mkt = s.marketplace;
            if (mkt)
                byMarketplace.set(mkt, s);
        }
        let payloadVersions = {};
        if (catalogProduct?.optimizationPayload) {
            try {
                const raw = catalogProduct.optimizationPayload;
                if (raw.US || raw.AU || raw.DE) {
                    payloadVersions = raw;
                }
            }
            catch { }
        }
        const seoScore = catalogProduct?.seoScore
            ? Number(catalogProduct.seoScore)
            : null;
        const readinessScore = catalogProduct?.readinessScore
            ? Number(catalogProduct.readinessScore)
            : null;
        return targetMarketplaces.map((mkt) => {
            const sibling = byMarketplace.get(mkt);
            const payload = payloadVersions[mkt] ?? {};
            return {
                marketplace: mkt,
                title: sibling?.title ??
                    payload.optimizedTitle ??
                    primaryListing.title ??
                    '',
                description: sibling?.description ??
                    payload.seoDescription ??
                    primaryListing.description ??
                    '',
                price: sibling?.startPriceNum ?? primaryListing.startPriceNum ?? null,
                quantity: sibling?.quantityNum ?? primaryListing.quantityNum ?? null,
                conditionId: sibling?.conditionId ?? primaryListing.conditionId ?? 'Used',
                conditionDescription: null,
                itemSpecifics: payload?.itemSpecifics ?? {},
                fitmentSummary: null,
                seoScore,
                readinessScore,
            };
        });
    }
    async getStoresWithPolicies(user) {
        const storeIds = await this.storeAccess.getAccessibleStoreIds(user);
        if (storeIds.size === 0)
            return [];
        const stores = await this.storeRepo.find({
            where: { id: (0, typeorm_2.In)([...storeIds]), channel: 'ebay', status: 'active' },
        });
        if (stores.length === 0)
            return [];
        const storeIdSet = new Set(stores.map((s) => s.id));
        const accounts = await this.ebayAccountRepo.find({
            where: { primaryStoreId: (0, typeorm_2.In)([...storeIdSet]) },
        });
        if (accounts.length === 0)
            return [];
        const accountIds = accounts.map((a) => a.id);
        const marketplaces = await this.marketplaceRepo.find({
            where: { ebayAccountId: (0, typeorm_2.In)(accountIds), enabled: true },
        });
        const policies = await this.policyRepo.find({
            where: { ebayAccountId: (0, typeorm_2.In)(accountIds) },
        });
        const policyIndex = new Map();
        for (const p of policies) {
            const key = `${p.ebayAccountId}:${p.marketplaceId}:${p.policyType}`;
            if (!policyIndex.has(key))
                policyIndex.set(key, []);
            policyIndex.get(key).push({
                id: p.id,
                ebayPolicyId: p.ebayPolicyId,
                name: p.name,
                policyType: p.policyType,
                marketplaceId: p.marketplaceId,
            });
        }
        const marketplacesByAccount = new Map();
        for (const mp of marketplaces) {
            if (!marketplacesByAccount.has(mp.ebayAccountId)) {
                marketplacesByAccount.set(mp.ebayAccountId, []);
            }
            marketplacesByAccount.get(mp.ebayAccountId).push(mp);
        }
        const storeMap = new Map(stores.map((s) => [s.id, s]));
        const result = [];
        for (const account of accounts) {
            const store = storeMap.get(account.primaryStoreId);
            if (!store)
                continue;
            const accountMarketplaces = marketplacesByAccount.get(account.id) ?? [];
            result.push({
                id: store.id,
                name: store.storeName,
                ebayAccountId: account.id,
                ebayUserId: account.ebayUserId,
                marketplaces: accountMarketplaces.map((mp) => {
                    const makePolicyList = (type) => {
                        return (policyIndex.get(`${account.id}:${mp.marketplaceId}:${type}`) ?? []);
                    };
                    return {
                        marketplaceId: mp.marketplaceId,
                        label: MARKETPLACE_LABELS[mp.marketplaceId] ?? mp.marketplaceId,
                        defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
                        defaultReturnPolicyId: mp.defaultReturnPolicyId,
                        defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
                        defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
                        policies: {
                            payment: makePolicyList('payment'),
                            return: makePolicyList('return'),
                            fulfillment: makePolicyList('fulfillment'),
                        },
                    };
                }),
            });
        }
        return result;
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
exports.InventoryEditorService = InventoryEditorService;
exports.InventoryEditorService = InventoryEditorService = InventoryEditorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(part_fitment_entity_js_1.PartFitment)),
    __param(3, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(4, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(5, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __param(6, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        store_access_service_js_1.StoreAccessService])
], InventoryEditorService);
//# sourceMappingURL=inventory-editor.service.js.map