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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayVariantPublishingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
const ebay_inventory_api_service_js_1 = require("../channels/ebay/ebay-inventory-api.service.js");
const ebay_publish_quantity_util_js_1 = require("../channels/ebay/ebay-publish-quantity.util.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const product_family_entity_js_1 = require("./entities/product-family.entity.js");
const product_variant_entity_js_1 = require("./entities/product-variant.entity.js");
const variant_marketplace_mapping_entity_js_1 = require("./entities/variant-marketplace-mapping.entity.js");
let EbayVariantPublishingService = class EbayVariantPublishingService {
    featureFlags;
    inventoryApi;
    familyRepo;
    variantRepo;
    mappingRepo;
    productRepo;
    accountRepo;
    constructor(featureFlags, inventoryApi, familyRepo, variantRepo, mappingRepo, productRepo, accountRepo) {
        this.featureFlags = featureFlags;
        this.inventoryApi = inventoryApi;
        this.familyRepo = familyRepo;
        this.variantRepo = variantRepo;
        this.mappingRepo = mappingRepo;
        this.productRepo = productRepo;
        this.accountRepo = accountRepo;
    }
    async buildGroupPayload(family, variants) {
        if (family.vertical === 'automotive') {
            throw new common_1.BadRequestException('Automotive products continue to use the existing Motors workflow; item groups are only enabled for pilot verticals.');
        }
        if (!variants.length) {
            throw new common_1.BadRequestException('At least one active variant is required');
        }
        const seenSkus = new Set();
        const valuesByName = new Map();
        for (const variant of variants) {
            if (!variant.sku.trim() || seenSkus.has(variant.sku.trim())) {
                throw new common_1.BadRequestException('Variant SKUs must be present and unique');
            }
            if (variant.vertical !== family.vertical) {
                throw new common_1.BadRequestException('All variants must use the family vertical');
            }
            seenSkus.add(variant.sku.trim());
            for (const [name, rawValue] of Object.entries(variant.attributes ?? {})) {
                const values = Array.isArray(rawValue)
                    ? rawValue.map(String)
                    : [String(rawValue)];
                const cleanValues = values.map((value) => value.trim()).filter(Boolean);
                if (!cleanValues.length)
                    continue;
                const set = valuesByName.get(name) ?? new Set();
                cleanValues.forEach((value) => set.add(value));
                valuesByName.set(name, set);
            }
        }
        if (!valuesByName.size) {
            throw new common_1.BadRequestException('At least one shared variation aspect is required before creating an eBay item group');
        }
        return {
            variantSKUs: [...seenSkus],
            title: family.name,
            description: family.name,
            variesBy: {
                specifications: [...valuesByName.entries()].map(([name, values]) => ({
                    name,
                    values: [...values],
                })),
            },
        };
    }
    async publishFamily(input) {
        if (!(await this.featureFlags.isEnabled('multi_vertical_catalog'))) {
            throw new common_1.BadRequestException('The multi_vertical_catalog pilot is disabled');
        }
        await this.rejectInventoryApiVariationPublishing();
        const account = await this.accountRepo.findOneBy({
            id: input.ebayAccountId,
            organizationId: input.organizationId,
            primaryStoreId: input.storeId,
        });
        if (!account)
            throw new common_1.NotFoundException('eBay account/store is not in this organization');
        const family = await this.familyRepo.findOneBy({
            id: input.familyId,
            organizationId: input.organizationId,
        });
        if (!family)
            throw new common_1.NotFoundException('Product family not found');
        if (family.vertical === 'automotive') {
            throw new common_1.BadRequestException('Item-group publishing is not available for automotive');
        }
        const variants = await this.variantRepo.find({
            where: {
                familyId: family.id,
                organizationId: input.organizationId,
                active: true,
            },
            order: { sku: 'ASC' },
        });
        const group = await this.buildGroupPayload(family, variants);
        const product = family.catalogProductId
            ? await this.productRepo.findOneBy({ id: family.catalogProductId })
            : null;
        const categoryId = input.categoryId.trim() || product?.categoryId?.trim();
        if (!categoryId)
            throw new common_1.BadRequestException('A leaf eBay category is required for the family');
        if (!input.merchantLocationKey.trim())
            throw new common_1.BadRequestException('A merchant location is required');
        const mappings = [];
        for (const variant of variants) {
            const attributes = Object.fromEntries(Object.entries(variant.attributes ?? {}).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.map(String) : [String(value)],
            ]));
            const condition = this.mapCondition(variant.conditionId);
            const quantity = (0, ebay_publish_quantity_util_js_1.capEbayPublishQuantity)(variant.quantity ?? 0);
            const item = {
                sku: variant.sku,
                product: {
                    title: `${family.name} ${this.variantLabel(variant)}`.trim(),
                    description: product?.description ?? family.name,
                    imageUrls: variant.imageUrls.length
                        ? variant.imageUrls
                        : (product?.imageUrls ?? []),
                    aspects: attributes,
                    brand: product?.brand ?? undefined,
                    mpn: variant.mpn ?? product?.mpn ?? undefined,
                },
                condition,
                availability: {
                    shipToLocationAvailability: { quantity },
                },
            };
            await this.inventoryApi.createOrReplaceItem(input.storeId, variant.sku, item);
            const offer = {
                sku: variant.sku,
                marketplaceId: input.marketplaceId,
                format: 'FIXED_PRICE',
                listingDescription: product?.description ?? family.name,
                availableQuantity: quantity,
                categoryId,
                merchantLocationKey: input.merchantLocationKey,
                pricingSummary: {
                    price: {
                        value: String(variant.price ?? product?.price ?? 0),
                        currency: input.currency ?? 'USD',
                    },
                },
                listingPolicies: {
                    fulfillmentPolicyId: input.fulfillmentPolicyId,
                    paymentPolicyId: input.paymentPolicyId,
                    returnPolicyId: input.returnPolicyId,
                },
            };
            let mapping = await this.mappingRepo.findOneBy({
                variantId: variant.id,
                ebayAccountId: input.ebayAccountId,
                marketplaceId: input.marketplaceId,
            });
            mapping =
                mapping ??
                    this.mappingRepo.create({
                        variantId: variant.id,
                        ebayAccountId: input.ebayAccountId,
                        marketplaceId: input.marketplaceId,
                        inventorySku: variant.sku,
                        status: 'processing',
                    });
            mapping.status = 'processing';
            if (mapping.offerId) {
                await this.inventoryApi.updateOffer(input.storeId, mapping.offerId, offer);
            }
            else {
                const created = await this.inventoryApi.createOffer(input.storeId, offer);
                mapping.offerId = created.offerId ?? null;
            }
            mapping.inventorySku = variant.sku;
            mappings.push(await this.mappingRepo.save(mapping));
        }
        const groupKey = `${family.slug}-${input.marketplaceId}`
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .slice(0, 50);
        await this.inventoryApi.createOrReplaceInventoryItemGroup(input.storeId, groupKey, group);
        const published = await this.inventoryApi.publishOfferByInventoryItemGroup(input.storeId, groupKey);
        for (const mapping of mappings) {
            mapping.status = 'published';
            mapping.listingId = published.listingId ?? null;
            mapping.resultPayload = { groupKey, listingId: published.listingId };
        }
        await this.mappingRepo.save(mappings);
        return {
            groupKey,
            listingId: published.listingId,
            variantCount: variants.length,
        };
    }
    variantLabel(variant) {
        return Object.values(variant.attributes ?? {})
            .flatMap((value) => (Array.isArray(value) ? value : [value]))
            .map(String)
            .filter(Boolean)
            .join(' / ');
    }
    mapCondition(conditionId) {
        const raw = (conditionId ?? '').toLowerCase();
        if (raw.includes('used') || raw === '3000')
            return 'USED_GOOD';
        if (raw.includes('refurb'))
            return 'SELLER_REFURBISHED';
        return 'NEW';
    }
    rejectInventoryApiVariationPublishing() {
        return Promise.reject(new common_1.BadRequestException('eBay multi-variation publishing is paused until it can create Seller Hub-managed Trading API listings.'));
    }
};
exports.EbayVariantPublishingService = EbayVariantPublishingService;
exports.EbayVariantPublishingService = EbayVariantPublishingService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(product_family_entity_js_1.ProductFamily)),
    __param(3, (0, typeorm_1.InjectRepository)(product_variant_entity_js_1.ProductVariant)),
    __param(4, (0, typeorm_1.InjectRepository)(variant_marketplace_mapping_entity_js_1.VariantMarketplaceMapping)),
    __param(5, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(6, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __metadata("design:paramtypes", [feature_flag_service_js_1.FeatureFlagService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EbayVariantPublishingService);
//# sourceMappingURL=ebay-variant-publishing.service.js.map