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
exports.ListingBuilderService = void 0;
const verticals_service_js_1 = require("../../../verticals/verticals.service.js");
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const listing_store_override_entity_js_1 = require("../entities/listing-store-override.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../entities/ebay-business-policy.entity.js");
const ebay_marketplace_config_service_js_1 = require("./ebay-marketplace-config.service.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_listing_text_util_js_1 = require("../../../channels/ebay/ebay-listing-text.util.js");
const ebay_listing_images_util_js_1 = require("../../../channels/ebay/ebay-listing-images.util.js");
const ebay_publish_category_util_js_1 = require("../../../channels/ebay/ebay-publish-category.util.js");
const catalog_publish_resolver_service_js_1 = require("./catalog-publish-resolver.service.js");
const ebay_listing_condition_util_js_1 = require("../../../channels/ebay/ebay-listing-condition.util.js");
const ebay_business_policy_util_js_1 = require("./ebay-business-policy.util.js");
const ebay_inventory_api_service_js_1 = require("../../../channels/ebay/ebay-inventory-api.service.js");
const ebay_listing_aspects_util_js_1 = require("../../../channels/ebay/ebay-listing-aspects.util.js");
const fitment_mvl_util_js_1 = require("../../../fitment/fitment-mvl.util.js");
let ListingBuilderService = class ListingBuilderService {
    overrideRepo;
    mpRepo;
    policyRepo;
    accountRepo;
    marketplaceConfig;
    publishResolver;
    inventoryApi;
    verticals;
    constructor(overrideRepo, mpRepo, policyRepo, accountRepo, marketplaceConfig, publishResolver, inventoryApi, verticals) {
        this.overrideRepo = overrideRepo;
        this.mpRepo = mpRepo;
        this.policyRepo = policyRepo;
        this.accountRepo = accountRepo;
        this.marketplaceConfig = marketplaceConfig;
        this.publishResolver = publishResolver;
        this.inventoryApi = inventoryApi;
        this.verticals = verticals;
    }
    async build(params) {
        const warnings = [];
        const blockingErrors = [];
        let resolved = await this.publishResolver.resolve(params.sourceListingId ?? params.catalogProductId);
        if (!resolved &&
            params.sourceListingId &&
            params.sourceListingId !== params.catalogProductId) {
            warnings.push('Stored source listing was not found; fell back to the canonical catalog product');
            resolved = await this.publishResolver.resolve(params.catalogProductId);
        }
        if (!resolved) {
            blockingErrors.push('Catalog product or listing record not found');
            return this.emptyResult(blockingErrors, warnings, params);
        }
        const { snapshot } = resolved;
        warnings.push(...resolved.warnings);
        const ov = await this.overrideRepo.findOne({
            where: {
                catalogProductId: snapshot.catalogProductId,
                ebayAccountId: params.ebayAccountId,
                marketplaceId: params.marketplaceId,
            },
        });
        const sku = snapshot.sku;
        const listingRecord = resolved.listingRecord;
        const catalogProduct = resolved.catalogProduct;
        const vertical = params.vertical ??
            snapshot.vertical ??
            catalogProduct?.vertical ??
            listingRecord?.vertical ??
            'automotive';
        const projection = vertical !== 'automotive' && this.verticals
            ? await this.verticals.buildPublishProjection({
                vertical,
                product: (catalogProduct ?? {
                    vertical,
                    verticalAttributes: listingRecord?.verticalAttributes ?? {},
                    title: snapshot.title,
                    description: snapshot.description,
                    brand: snapshot.brand,
                    mpn: snapshot.mpn,
                    price: snapshot.price,
                    quantity: snapshot.quantity,
                    categoryId: snapshot.categoryId,
                    categoryName: null,
                    conditionId: snapshot.conditionId,
                    conditionLabel: snapshot.conditionLabel,
                    imageUrls: snapshot.imageUrls,
                }),
                listing: listingRecord,
                storeId: params.storeId,
                marketplaceId: params.marketplaceId,
            })
            : null;
        if (projection) {
            warnings.push(...projection.warnings);
            blockingErrors.push(...projection.blockingErrors);
        }
        const parsedFitmentRows = (vertical === 'automotive' ? (catalogProduct?.fitmentData ?? []) : [])
            .map((row) => (0, fitment_mvl_util_js_1.parseFitmentEntry)(row))
            .filter((row) => row !== null);
        const fitmentMake = parsedFitmentRows[0]?.make?.trim() || null;
        const fitmentYears = parsedFitmentRows
            .map((row) => Number(row.year))
            .filter((y) => Number.isFinite(y));
        const fitmentYearRange = fitmentYears.length
            ? (() => {
                const min = Math.min(...fitmentYears);
                const max = Math.max(...fitmentYears);
                return min === max ? String(min) : `${min}-${max}`;
            })()
            : null;
        const rawMake = (snapshot.brand ??
            listingRecord?.cBrand ??
            listingRecord?.extractedMake ??
            '').trim();
        const structuredMake = (rawMake && fitmentMake && (0, fitment_mvl_util_js_1.isSameMakeVariant)(rawMake, fitmentMake)
            ? fitmentMake
            : rawMake) ||
            fitmentMake ||
            null;
        const structuredModel = (listingRecord?.extractedModel ?? '').trim() || null;
        const structuredPosition = (catalogProduct?.placement ?? listingRecord?.cPlacement ?? '').trim() ||
            null;
        const structuredPartName = (snapshot.partType ?? listingRecord?.cType ?? '').trim() || null;
        const structuredOem = (catalogProduct?.oemPartNumber ??
            listingRecord?.cOeOemPartNumber ??
            snapshot.mpn ??
            listingRecord?.cManufacturerPartNumber ??
            '').trim() || null;
        const titleResult = (0, ebay_listing_text_util_js_1.buildEbayListingTitle)({
            title: snapshot.title,
            titleOverride: ov?.titleOverride,
            brand: snapshot.brand,
            partType: snapshot.partType,
            mpn: snapshot.mpn,
            sku,
            yearRange: fitmentYearRange,
            make: structuredMake,
            model: structuredModel,
            position: structuredPosition,
            partName: structuredPartName,
            oemPartNumber: structuredOem,
        });
        if (vertical === 'automotive')
            warnings.push(...titleResult.warnings);
        const title = vertical === 'automotive'
            ? titleResult.title
            : ov?.titleOverride?.trim() || projection?.title || snapshot.title;
        const descResult = (0, ebay_listing_text_util_js_1.buildEbayListingDescription)({
            description: ov?.descriptionOverride?.trim() || snapshot.description,
            title,
            brand: snapshot.brand,
            mpn: snapshot.mpn,
            sku,
            partType: snapshot.partType,
        });
        if (vertical === 'automotive')
            warnings.push(...descResult.warnings);
        const description = vertical === 'automotive'
            ? descResult.description
            : ov?.descriptionOverride?.trim() ||
                projection?.description ||
                snapshot.description ||
                title;
        const price = ov?.priceOverride != null
            ? Number(ov.priceOverride)
            : Number(snapshot.price ?? 0);
        const quantity = ov?.quantityOverride ?? snapshot.quantity ?? 0;
        let categoryId = ov?.categoryIdOverride?.trim() || snapshot.categoryId || '';
        if (vertical === 'automotive') {
            const safeCategory = (0, ebay_publish_category_util_js_1.resolveSafePublishCategory)({
                categoryId,
                categoryName: catalogProduct?.categoryName ?? listingRecord?.categoryName,
                listingText: [
                    snapshot.title,
                    snapshot.partType,
                    catalogProduct?.title,
                    listingRecord?.cType,
                ]
                    .filter(Boolean)
                    .join(' '),
            });
            if (safeCategory.changed) {
                warnings.push(`Replaced stale generic engine category ${categoryId || '(name only)'} with ${ebay_publish_category_util_js_1.SAFE_PUBLISH_FALLBACK_CATEGORY_NAME} (${safeCategory.categoryId})`);
                categoryId = safeCategory.categoryId;
            }
        }
        const condition = vertical === 'automotive'
            ? (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(ov?.conditionOverride ?? snapshot.conditionId, 'USED_GOOD')
            : (projection?.condition ?? 'NEW');
        if (!categoryId) {
            warnings.push('Using empty category — publish will likely fail until taxonomy is set');
        }
        const mpRow = await this.mpRepo.findOne({
            where: {
                ebayAccountId: params.ebayAccountId,
                marketplaceId: params.marketplaceId,
            },
        });
        let fulfillmentPolicyId = mpRow?.defaultFulfillmentPolicyId ?? undefined;
        let paymentPolicyId = mpRow?.defaultPaymentPolicyId ?? undefined;
        let returnPolicyId = mpRow?.defaultReturnPolicyId ?? undefined;
        let merchantLocationKey = mpRow?.defaultInventoryLocationKey ?? undefined;
        const po = {
            ...(ov?.policyOverrides ?? {}),
            ...(params.policyOverrides ?? {}),
        };
        let explicitFulfillmentPolicy = false;
        let explicitPaymentPolicy = false;
        let explicitReturnPolicy = false;
        if (po && typeof po === 'object') {
            const o = po;
            if (typeof o.fulfillmentPolicyId === 'string' &&
                o.fulfillmentPolicyId.trim()) {
                fulfillmentPolicyId = o.fulfillmentPolicyId.trim();
                explicitFulfillmentPolicy = true;
            }
            if (typeof o.paymentPolicyId === 'string' && o.paymentPolicyId.trim()) {
                paymentPolicyId = o.paymentPolicyId.trim();
                explicitPaymentPolicy = true;
            }
            if (typeof o.returnPolicyId === 'string' && o.returnPolicyId.trim()) {
                returnPolicyId = o.returnPolicyId.trim();
                explicitReturnPolicy = true;
            }
            if (typeof o.merchantLocationKey === 'string' &&
                o.merchantLocationKey.trim()) {
                merchantLocationKey = o.merchantLocationKey.trim();
            }
        }
        const policyRows = await this.policyRepo.find({
            where: {
                ebayAccountId: params.ebayAccountId,
                marketplaceId: params.marketplaceId,
            },
        });
        const overrideProfileName = (key) => typeof po[key] === 'string' && po[key].trim()
            ? po[key].trim()
            : undefined;
        const requestedFulfillmentPolicyName = overrideProfileName('requestedFulfillmentPolicyName') ||
            listingRecord?.shippingProfileName?.trim() ||
            catalogProduct?.shippingProfile?.trim() ||
            undefined;
        const requestedReturnPolicyName = overrideProfileName('requestedReturnPolicyName') ||
            listingRecord?.returnProfileName?.trim() ||
            catalogProduct?.returnProfile?.trim() ||
            undefined;
        const requestedPaymentPolicyName = overrideProfileName('requestedPaymentPolicyName') ||
            listingRecord?.paymentProfileName?.trim() ||
            catalogProduct?.paymentProfile?.trim() ||
            undefined;
        const normalizedPolicyName = (name) => name.trim().toLowerCase();
        const candidates = (rows) => rows.map((r) => ({
            ebayPolicyId: r.ebayPolicyId,
            isDefault: r.isDefault,
            geoSite: (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(r.rawPayload ?? {}),
            rawPayload: r.rawPayload ?? {},
        }));
        const rowsByName = (policyType, name) => policyRows.filter((row) => row.policyType === policyType &&
            normalizedPolicyName(row.name) === normalizedPolicyName(name));
        const resolveNamedPolicy = (policyType, name) => {
            const matching = rowsByName(policyType, name);
            if (policyType === 'return') {
                return (0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(candidates(matching), params.marketplaceId, categoryId, condition);
            }
            return (0, ebay_business_policy_util_js_1.pickPolicyIdForMarketplace)(candidates(matching), params.marketplaceId);
        };
        if (!explicitFulfillmentPolicy && requestedFulfillmentPolicyName) {
            const resolvedId = resolveNamedPolicy('fulfillment', requestedFulfillmentPolicyName);
            if (resolvedId)
                fulfillmentPolicyId = resolvedId;
            else {
                warnings.push(`Shipping profile "${requestedFulfillmentPolicyName}" is not in the local policy cache; it will be refreshed and verified against eBay before publishing.`);
            }
        }
        if (!explicitPaymentPolicy && requestedPaymentPolicyName) {
            const resolvedId = resolveNamedPolicy('payment', requestedPaymentPolicyName);
            if (resolvedId)
                paymentPolicyId = resolvedId;
            else {
                warnings.push(`Payment profile "${requestedPaymentPolicyName}" is not in the local policy cache; it will be refreshed and verified against eBay before publishing.`);
            }
        }
        if (!explicitReturnPolicy && requestedReturnPolicyName) {
            const resolvedId = resolveNamedPolicy('return', requestedReturnPolicyName);
            if (resolvedId)
                returnPolicyId = resolvedId;
            else {
                warnings.push(`Return profile "${requestedReturnPolicyName}" is not usable from the local policy cache; it will be refreshed and verified against eBay before publishing.`);
            }
        }
        const returnRows = policyRows.filter((r) => r.policyType === 'return');
        if (!explicitReturnPolicy &&
            !requestedReturnPolicyName &&
            returnRows.length) {
            const compliantReturnId = (0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(candidates(returnRows), params.marketplaceId, categoryId, condition);
            if (compliantReturnId) {
                returnPolicyId = compliantReturnId;
            }
            else if (vertical !== 'fashion' &&
                (0, ebay_business_policy_util_js_1.listingRequiresPartsAccessoriesReturnPolicy)(params.marketplaceId, categoryId, condition)) {
                blockingErrors.push((0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)());
            }
        }
        let currency;
        try {
            currency = this.marketplaceConfig.require(params.marketplaceId).currency;
        }
        catch {
            warnings.push(`Unknown marketplace ${params.marketplaceId} — defaulting currency in offer may be wrong`);
        }
        const account = await this.accountRepo.findOne({
            where: { id: params.ebayAccountId },
        });
        const isSellerpundit = account?.connectionSource === 'sellerpundit';
        if ((!fulfillmentPolicyId && !requestedFulfillmentPolicyName) ||
            (!paymentPolicyId && !requestedPaymentPolicyName) ||
            (!returnPolicyId && !requestedReturnPolicyName)) {
            blockingErrors.push(isSellerpundit
                ? 'Missing fulfillment, payment, or return policy IDs — sync SellerPundit policies.'
                : 'Missing fulfillment, payment, or return policy IDs — sync policies and map defaults.');
        }
        if (!merchantLocationKey) {
            const ensured = params.readOnly
                ? null
                : await this.inventoryApi.ensureMerchantLocation(params.storeId, merchantLocationKey);
            if (ensured) {
                merchantLocationKey = ensured;
                if (mpRow) {
                    mpRow.defaultInventoryLocationKey = ensured;
                    await this.mpRepo.save(mpRow);
                }
            }
            else {
                blockingErrors.push(isSellerpundit
                    ? 'Missing merchant location — required when SellerPundit falls back to direct eBay publish. Sync policies from eBay or set a default ship-from address.'
                    : 'Missing merchant location — sync policies from eBay or set a default ship-from address.');
            }
        }
        const automotiveAspects = (0, ebay_listing_aspects_util_js_1.buildListingAspects)({
            brand: snapshot.brand,
            mpn: snapshot.mpn,
            partType: snapshot.partType,
            upc: listingRecord?.pUpc ?? catalogProduct?.upc,
        });
        const aspects = vertical === 'automotive'
            ? automotiveAspects
            : (projection?.aspects ?? {});
        if (vertical === 'automotive' && !aspects.Brand?.length) {
            aspects.Brand = ['Unbranded'];
            warnings.push('Brand/Hersteller is missing — using "Unbranded" as fallback. Set the brand on the catalog product for better search ranking.');
        }
        const imageUrls = (0, ebay_listing_images_util_js_1.applyImageOrderOverride)(snapshot.imageUrls, ov?.imageOrderOverride);
        if (!imageUrls.length) {
            blockingErrors.push('At least one valid image URL (http/https) is required — add images to the catalog listing or linked image assets');
        }
        const listingRecordId = snapshot.listingRecordId ??
            params.listingRecordId ??
            snapshot.catalogProductId;
        let compatibility;
        if (vertical === 'automotive') {
            const fitmentOverride = ov?.fitmentOverride;
            const fitmentSource = Array.isArray(fitmentOverride) && fitmentOverride.length > 0
                ? fitmentOverride
                : (0, fitment_mvl_util_js_1.selectPublishFitmentSource)(resolved.catalogProduct?.fitmentData, resolved.catalogProduct?.fitmentRows, { requireValidated: true });
            compatibility = (0, fitment_mvl_util_js_1.fitmentDataToCompatibilityPayload)(fitmentSource);
        }
        if (compatibility) {
            let supportsMotorsFitment = true;
            try {
                supportsMotorsFitment = this.marketplaceConfig.require(params.marketplaceId).supportsMotorsFitment;
            }
            catch {
                supportsMotorsFitment = false;
            }
            if (!supportsMotorsFitment) {
                warnings.push('Marketplace does not support Motors fitment — compatibility omitted from publish');
                compatibility = undefined;
            }
            else {
                warnings.push(`Including ${compatibility.compatibleProducts.length} eBay MVL fitment row(s) in publish payload`);
            }
        }
        const publishRequest = {
            listingId: listingRecordId,
            vertical,
            storeIds: [params.storeId],
            sku,
            title,
            description,
            categoryId,
            condition,
            conditionDescription: vertical === 'automotive'
                ? snapshot.conditionLabel?.trim() ||
                    ((0, ebay_listing_aspects_util_js_1.isUsedEbayCondition)(condition)
                        ? snapshot.partType?.trim() || title
                        : undefined)
                : projection?.conditionDescription ||
                    snapshot.conditionLabel?.trim() ||
                    undefined,
            listingDuration: 'GTC',
            price,
            currency,
            quantity,
            imageUrls,
            aspects,
            compatibility,
            fulfillmentPolicyId,
            paymentPolicyId,
            returnPolicyId,
            requestedFulfillmentPolicyName: explicitFulfillmentPolicy
                ? policyRows.find((row) => row.policyType === 'fulfillment' &&
                    row.ebayPolicyId === fulfillmentPolicyId)?.name
                : requestedFulfillmentPolicyName,
            requestedReturnPolicyName: explicitReturnPolicy
                ? policyRows.find((row) => row.policyType === 'return' &&
                    row.ebayPolicyId === returnPolicyId)?.name
                : requestedReturnPolicyName,
            requestedPaymentPolicyName: explicitPaymentPolicy
                ? policyRows.find((row) => row.policyType === 'payment' &&
                    row.ebayPolicyId === paymentPolicyId)?.name
                : requestedPaymentPolicyName,
            merchantLocationKey,
        };
        return { publishRequest, warnings, blockingErrors };
    }
    emptyResult(blockingErrors, warnings, params) {
        return {
            blockingErrors,
            warnings,
            publishRequest: {
                listingId: params.listingRecordId,
                storeIds: [params.storeId],
                sku: 'missing',
                title: 'missing',
                description: 'missing',
                categoryId: '',
                condition: 'USED_GOOD',
                price: 0,
                quantity: 0,
                imageUrls: [],
                aspects: {},
            },
        };
    }
};
exports.ListingBuilderService = ListingBuilderService;
exports.ListingBuilderService = ListingBuilderService = __decorate([
    (0, common_2.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_store_override_entity_js_1.ListingStoreOverride)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __param(3, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(7, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
        catalog_publish_resolver_service_js_1.CatalogPublishResolverService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        verticals_service_js_1.VerticalsService])
], ListingBuilderService);
//# sourceMappingURL=listing-builder.service.js.map