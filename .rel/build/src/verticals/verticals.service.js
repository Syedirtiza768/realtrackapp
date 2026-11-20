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
var VerticalsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerticalsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const ebay_taxonomy_api_service_js_1 = require("../channels/ebay/ebay-taxonomy-api.service.js");
const ebay_selling_metadata_service_js_1 = require("../channels/ebay/ebay-selling-metadata.service.js");
const vertical_config_js_1 = require("./vertical.config.js");
const vertical_types_js_1 = require("./vertical.types.js");
const business_industrial_config_js_1 = require("./business-industrial.config.js");
const fashion_config_js_1 = require("./fashion.config.js");
const product_family_entity_js_1 = require("./entities/product-family.entity.js");
const product_variant_entity_js_1 = require("./entities/product-variant.entity.js");
const variant_marketplace_mapping_entity_js_1 = require("./entities/variant-marketplace-mapping.entity.js");
const product_marketplace_category_entity_js_1 = require("./entities/product-marketplace-category.entity.js");
const business_industrial_review_entity_js_1 = require("./entities/business-industrial-review.entity.js");
const typeorm_2 = require("typeorm");
let VerticalsService = VerticalsService_1 = class VerticalsService {
    featureFlags;
    taxonomy;
    sellingMetadata;
    storeRepo;
    accountRepo;
    productRepo;
    listingRepo;
    familyRepo;
    variantRepo;
    mappingRepo;
    categoryRepo;
    businessIndustrialReviewRepo;
    logger = new common_1.Logger(VerticalsService_1.name);
    metadataCache = new Map();
    metadataTtlMs = 24 * 60 * 60 * 1000;
    constructor(featureFlags, taxonomy, sellingMetadata, storeRepo, accountRepo, productRepo, listingRepo, familyRepo, variantRepo, mappingRepo, categoryRepo, businessIndustrialReviewRepo) {
        this.featureFlags = featureFlags;
        this.taxonomy = taxonomy;
        this.sellingMetadata = sellingMetadata;
        this.storeRepo = storeRepo;
        this.accountRepo = accountRepo;
        this.productRepo = productRepo;
        this.listingRepo = listingRepo;
        this.familyRepo = familyRepo;
        this.variantRepo = variantRepo;
        this.mappingRepo = mappingRepo;
        this.categoryRepo = categoryRepo;
        this.businessIndustrialReviewRepo = businessIndustrialReviewRepo;
    }
    async assertFeatureEnabled() {
        if (!(await this.featureFlags.isEnabled('multi_vertical_catalog'))) {
            throw new common_1.ServiceUnavailableException('Business & Industrial and Fashion workflows are disabled. Enable the multi_vertical_catalog feature flag before configuring a pilot store.');
        }
    }
    async assertIntakeVerticalEnabled(vertical, storeId) {
        if (vertical === vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL)
            return;
        await this.assertFeatureEnabled();
        if (!storeId)
            return;
        const store = await this.storeRepo.findOneBy({ id: storeId });
        if (!store)
            throw new common_1.NotFoundException(`Store ${storeId} not found`);
        const config = this.getStoreConfig(store);
        if (!config.enabledVerticals.includes(vertical)) {
            throw new common_1.BadRequestException(`${vertical_config_js_1.VERTICAL_PROFILES[vertical].label} is not enabled for store ${store.storeName}`);
        }
    }
    getProfiles() {
        return Object.values(vertical_config_js_1.VERTICAL_PROFILES);
    }
    getStoreConfig(store) {
        return (0, vertical_config_js_1.normalizeVerticalConfig)(store.verticalConfig ?? vertical_config_js_1.DEFAULT_VERTICAL_CONFIG);
    }
    async listStoresForOrganization(organizationId) {
        const stores = await this.storeRepo
            .createQueryBuilder('store')
            .leftJoinAndMapOne('store.ebayAccount', connected_ebay_account_entity_js_1.ConnectedEbayAccount, 'account', 'account.primary_store_id = store.id')
            .where('store.organization_id = :organizationId OR account.organization_id = :organizationId', { organizationId })
            .orderBy('store.is_primary', 'DESC')
            .addOrderBy('store.store_name', 'ASC')
            .getMany();
        return stores.map((store) => ({
            ...store,
            verticalConfig: this.getStoreConfig(store),
        }));
    }
    async getStoreConfigForOrganization(storeId, organizationId) {
        const store = await this.assertStoreOrganization(storeId, organizationId);
        return this.getStoreConfig(store);
    }
    async updateFashionStoreConfig(storeId, organizationId, enabled) {
        const store = await this.assertStoreOrganization(storeId, organizationId);
        const current = this.getStoreConfig(store);
        if (enabled)
            await this.assertFeatureEnabled();
        const enabledVerticals = enabled
            ? [
                ...new Set([
                    ...current.enabledVerticals,
                    'fashion',
                ]),
            ]
            : current.enabledVerticals.filter((vertical) => vertical !== 'fashion');
        const defaultVertical = enabled || current.defaultVertical !== 'fashion'
            ? current.defaultVertical
            : vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL;
        const next = (0, vertical_config_js_1.normalizeVerticalConfig)({
            ...current,
            enabledVerticals,
            defaultVertical,
        });
        store.verticalConfig = next;
        await this.storeRepo.save(store);
        return next;
    }
    async updateStoreConfig(storeId, organizationId, patch) {
        const store = await this.assertStoreOrganization(storeId, organizationId);
        const current = this.getStoreConfig(store);
        const next = (0, vertical_config_js_1.normalizeVerticalConfig)({ ...current, ...patch });
        const newVerticals = next.enabledVerticals.filter((v) => v !== vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL);
        if (newVerticals.length ||
            next.defaultVertical !== vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL) {
            await this.assertFeatureEnabled();
        }
        if (!next.enabledVerticals.includes(next.defaultVertical)) {
            throw new common_1.BadRequestException('The store default vertical must be enabled for that store');
        }
        store.verticalConfig = next;
        await this.storeRepo.save(store);
        return next;
    }
    resolveVertical(product, listing, frozenVertical) {
        if (frozenVertical && (0, vertical_types_js_1.isProductVertical)(frozenVertical))
            return frozenVertical;
        if (product?.vertical && (0, vertical_types_js_1.isProductVertical)(product.vertical))
            return product.vertical;
        if (listing?.vertical && (0, vertical_types_js_1.isProductVertical)(listing.vertical))
            return listing.vertical;
        return vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL;
    }
    normalizeIntakeVertical(value) {
        const vertical = (0, vertical_types_js_1.normalizeProductVertical)(value);
        if (value != null &&
            typeof value === 'string' &&
            !(0, vertical_types_js_1.isProductVertical)(value) &&
            vertical === vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL) {
            const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
            if (!['auto', 'motors', 'automotive'].includes(normalized)) {
                throw new common_1.BadRequestException(`Unsupported product vertical "${value}"`);
            }
        }
        return vertical;
    }
    buildAttributes(vertical, data) {
        const candidate = (0, vertical_config_js_1.attributesFromImportRow)(vertical, data);
        const validated = (0, vertical_config_js_1.validateVerticalAttributes)(vertical, candidate);
        if (validated.errors.length)
            throw new common_1.BadRequestException(validated.errors);
        return validated.attributes;
    }
    async buildPublishProjection(params) {
        if (params.vertical === vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL)
            return null;
        await this.assertIntakeVerticalEnabled(params.vertical, params.storeId);
        const productAttributes = (0, vertical_config_js_1.validateVerticalAttributes)(params.vertical, params.product.verticalAttributes ?? {});
        const warnings = [
            ...productAttributes.errors.map((error) => `Invalid vertical attributes: ${error}`),
        ];
        const blockingErrors = [];
        if (params.vertical === 'business_industrial') {
            const allowUnapprovedPublish = process.env.BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH === 'true';
            const businessIndustrial = (0, business_industrial_config_js_1.validateBusinessIndustrialAttributes)(params.product.verticalAttributes ?? {});
            for (const error of businessIndustrial.errors) {
                blockingErrors.push(`Invalid Business & Industrial attributes: ${error}`);
            }
            warnings.push(...businessIndustrial.warnings);
            if (!allowUnapprovedPublish &&
                params.product.verticalValidationStatus !== 'approved') {
                blockingErrors.push('Business & Industrial compliance review must be approved before publishing');
            }
            const productIdentity = params.product;
            const review = await this.businessIndustrialReviewRepo.findOne({
                where: {
                    organizationId: productIdentity.organizationId,
                    catalogProductId: productIdentity.id,
                },
            });
            if (!allowUnapprovedPublish && review?.status !== 'approved') {
                blockingErrors.push('A recorded Business & Industrial compliance decision is required before publishing');
            }
            const attributes = businessIndustrial.attributes;
            if (!allowUnapprovedPublish &&
                (0, business_industrial_config_js_1.isRestrictedBusinessIndustrialFamily)(attributes.categoryFamily) &&
                !review?.restrictedCategoryCleared) {
                blockingErrors.push('Restricted Business & Industrial categories require recorded compliance clearance before publishing');
            }
            if (!allowUnapprovedPublish && params.product.manualReview) {
                blockingErrors.push('Business & Industrial listing is quarantined and cannot be published');
            }
            const shippingMode = attributes.shippingMode;
            if (!shippingMode)
                blockingErrors.push('shippingMode is required for Business & Industrial publishing');
            if (!attributes.dispatchLocation)
                blockingErrors.push('dispatchLocation is required for Business & Industrial publishing');
            if (!attributes.shippingCoverage)
                blockingErrors.push('shippingCoverage is required for Business & Industrial publishing');
            if (shippingMode === 'parcel' || shippingMode === 'freight') {
                for (const field of [
                    'packedLength',
                    'packedWidth',
                    'packedHeight',
                    'packedWeight',
                    'packedDimensionsUnit',
                    'packedWeightUnit',
                ]) {
                    if (attributes[field] === undefined || attributes[field] === '')
                        blockingErrors.push(`${field} is required for ${shippingMode} shipping`);
                }
            }
            if (shippingMode === 'freight' && !attributes.freightLoadingFacilities) {
                blockingErrors.push('freightLoadingFacilities is required for freight shipping');
            }
        }
        if (params.vertical === 'fashion') {
            const fashionAttributes = params.product.verticalAttributes ?? {};
            if (fashionAttributes._sourceFormat === 'artisticserver-fashion-export' &&
                fashionAttributes._imageMirrorStatus !== 'complete') {
                blockingErrors.push('All source catalogue photos must be copied to application storage as WebP before publishing; re-import the source catalogue to retry failed image copies');
            }
            if (fashionAttributes._sourceFormat === 'artisticserver-fashion-export' &&
                fashionAttributes._measurementUnitReviewRequired === true) {
                blockingErrors.push('Confirm whether the imported source measurements are in cm or inches before publishing');
            }
            const fashion = (0, fashion_config_js_1.validateFashionAttributes)(fashionAttributes);
            for (const error of fashion.errors) {
                blockingErrors.push(`Invalid Fashion attributes: ${error}`);
            }
            warnings.push(...fashion.warnings);
            if (params.product.verticalValidationStatus !== 'approved') {
                blockingErrors.push('Fashion authenticity/compliance review must be approved before publishing');
            }
            if (params.product.manualReview) {
                blockingErrors.push('Fashion listing is quarantined and cannot be published');
            }
        }
        const categoryId = params.listing?.categoryId?.trim() ||
            params.product.categoryId?.trim() ||
            '';
        const metadata = categoryId
            ? await this.getCategoryMetadata(params.storeId, params.marketplaceId, categoryId).catch((error) => {
                blockingErrors.push(`Category metadata could not be validated for ${categoryId}. Refresh eBay metadata and try again: ${error instanceof Error ? error.message : String(error)}`);
                return null;
            })
            : null;
        if (!categoryId)
            blockingErrors.push(params.vertical === 'fashion'
                ? 'An eBay Fashion leaf category is required before publishing'
                : params.vertical === 'business_industrial'
                    ? 'An eBay Business & Industrial leaf category is required before publishing'
                    : 'An eBay leaf category is required before publishing');
        let conditionId = (params.listing?.conditionId ||
            params.product.conditionId ||
            '').trim();
        let condition = this.mapCondition(conditionId, params.listing?.conditionLabel || params.product.conditionLabel);
        if (!condition)
            blockingErrors.push('A category-supported eBay condition is required; no condition was inferred');
        if (metadata?.supportedConditions.length) {
            const supportedConditionId = this.pickSupportedConditionId(condition, metadata.supportedConditions, conditionId || null);
            if (supportedConditionId) {
                if (supportedConditionId !== conditionId) {
                    warnings.push(`Normalized eBay condition ${conditionId || '(inferred)'} to category-supported condition ${supportedConditionId} for category ${categoryId}`);
                }
                conditionId = supportedConditionId;
                condition = this.mapCondition(conditionId, null);
            }
            else if (!conditionId) {
                blockingErrors.push('Select an explicit eBay condition supported by the chosen category');
            }
            else {
                blockingErrors.push('eBay condition ' +
                    conditionId +
                    ' is not supported by category ' +
                    categoryId);
            }
        }
        const aspects = this.buildAspects(params.product, params.listing, productAttributes.attributes);
        if (metadata) {
            for (const aspect of metadata.aspects) {
                const name = aspect.localizedAspectName;
                const normalize = (key) => key
                    .trim()
                    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, ch) => ch.toUpperCase())
                    .toLowerCase();
                const matched = Object.keys(aspects).find((key) => normalize(key) === normalize(name));
                let values = aspects[name] ?? aspects[matched ?? ''] ?? [];
                if (matched && matched !== name) {
                    aspects[name] = values;
                    delete aspects[matched];
                }
                if (aspect.aspectConstraint?.aspectRequired &&
                    values.length === 0 &&
                    params.vertical !== 'business_industrial') {
                    blockingErrors.push(`Required eBay aspect "${name}" is missing for category ${categoryId}`);
                }
                if (aspect.aspectConstraint?.aspectRequired &&
                    values.length === 0 &&
                    params.vertical === 'business_industrial') {
                    const allowedValues = (aspect.aspectValues ?? [])
                        .map((value) => value.localizedValue?.trim())
                        .filter((value) => Boolean(value));
                    const fallbackName = normalize(name) === 'brand'
                        ? 'unbranded'
                        : 'does not apply';
                    const fallback = allowedValues.find((value) => normalize(value) === fallbackName);
                    if (fallback) {
                        aspects[name] = [fallback];
                        values = aspects[name];
                        warnings.push(`Required eBay aspect "${name}" was not evidenced; using the category-approved "${fallback}" value.`);
                    }
                    else {
                        blockingErrors.push(`Required eBay aspect "${name}" is missing for category ${categoryId}`);
                    }
                }
                const maxValues = aspect.aspectConstraint
                    ?.aspectMaxValues;
                if (typeof maxValues === 'number' && values.length > maxValues) {
                    blockingErrors.push(`eBay aspect "${name}" allows at most ${maxValues} value(s)`);
                }
            }
        }
        const fashionContent = params.vertical === 'fashion'
            ? (0, fashion_config_js_1.buildFashionListingContent)({
                brand: params.product.brand,
                title: params.listing?.title || params.product.title,
                attributes: productAttributes.attributes,
                conditionLabel: params.listing?.conditionLabel || params.product.conditionLabel,
            })
            : null;
        const title = params.listing?.title?.trim() ||
            params.product.title?.trim() ||
            fashionContent?.title ||
            '';
        const description = params.listing?.description?.trim() ||
            params.product.description?.trim() ||
            fashionContent?.description ||
            title;
        if (!title)
            blockingErrors.push('A product title is required');
        if (!params.product.imageUrls?.length &&
            !params.listing?.itemPhotoUrl?.trim())
            warnings.push('No image is currently stored; publish will require at least one HTTPS image');
        return {
            vertical: params.vertical,
            title,
            description,
            categoryId,
            aspects,
            condition: condition ?? 'NEW',
            conditionDescription: params.product.conditionLabel ?? undefined,
            warnings,
            blockingErrors,
            taxonomyAspects: metadata?.aspects ?? [],
        };
    }
    async getCategoryMetadata(storeId, marketplaceId, categoryId) {
        const normalizedCategory = categoryId.trim();
        const key = `${marketplaceId}:${normalizedCategory}`;
        const cached = this.metadataCache.get(key);
        if (cached && cached.expiresAt > Date.now())
            return cached.value;
        const treeId = await this.taxonomy.getDefaultCategoryTreeId(marketplaceId);
        const [aspects, policy] = await Promise.all([
            this.taxonomy.getItemAspectsForCategory(normalizedCategory, treeId),
            this.sellingMetadata
                .getCategoryPolicies(storeId, marketplaceId, normalizedCategory)
                .catch(() => null),
        ]);
        const metadata = {
            marketplaceId,
            categoryTreeId: treeId,
            categoryId: normalizedCategory,
            aspects,
            supportedConditions: policy?.supportedConditions ?? [],
            supportsVariations: policy?.supportsVariations ?? null,
            fetchedAt: new Date().toISOString(),
        };
        this.metadataCache.set(key, {
            value: metadata,
            expiresAt: Date.now() + this.metadataTtlMs,
        });
        return metadata;
    }
    async persistCategoryMetadata(productId, organizationId, vertical, metadata) {
        const existing = await this.categoryRepo.findOne({
            where: {
                catalogProductId: productId,
                marketplaceId: metadata.marketplaceId,
            },
        });
        const row = existing ??
            this.categoryRepo.create({
                catalogProductId: productId,
                marketplaceId: metadata.marketplaceId,
            });
        Object.assign(row, {
            organizationId,
            vertical,
            categoryTreeId: metadata.categoryTreeId,
            categoryId: metadata.categoryId,
            categoryName: metadata.categoryName ?? null,
            aspectMetadata: metadata.aspects,
            conditionMetadata: metadata.supportedConditions,
            supportsVariations: metadata.supportsVariations,
            fetchedAt: new Date(metadata.fetchedAt),
            invalidatedAt: null,
        });
        return this.categoryRepo.save(row);
    }
    async createFamily(input) {
        if (input.vertical === vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL) {
            throw new common_1.BadRequestException('Product families are only available for pilot non-automotive verticals');
        }
        await this.assertFeatureEnabledForNonAutomotive(input.vertical);
        const product = await this.productRepo.findOneBy({
            id: input.catalogProductId,
        });
        if (!product)
            throw new common_1.NotFoundException('Catalog product not found');
        if (product.vertical && product.vertical !== input.vertical)
            throw new common_1.ConflictException('Product family vertical does not match the catalog product');
        return this.familyRepo.save(this.familyRepo.create(input));
    }
    async createVariant(input) {
        const family = await this.familyRepo.findOneBy({
            id: input.familyId,
            organizationId: input.organizationId,
        });
        if (!family)
            throw new common_1.NotFoundException('Product family not found');
        const validated = (0, vertical_config_js_1.validateVerticalAttributes)(family.vertical, input.attributes ?? {});
        if (validated.errors.length)
            throw new common_1.BadRequestException(validated.errors);
        const variant = this.variantRepo.create({
            organizationId: input.organizationId,
            familyId: family.id,
            catalogProductId: family.catalogProductId,
            vertical: family.vertical,
            sku: input.sku.trim(),
            price: input.price ?? null,
            quantity: input.quantity ?? 0,
            attributes: validated.attributes,
            imageUrls: input.imageUrls ?? [],
            conditionId: input.conditionId ?? null,
        });
        return this.variantRepo.save(variant);
    }
    async listVariants(familyId, organizationId) {
        return this.variantRepo.find({
            where: { familyId, organizationId },
            order: { sku: 'ASC' },
        });
    }
    async createVariantMapping(input) {
        const variant = await this.variantRepo.findOneBy({
            id: input.variantId,
            organizationId: input.organizationId,
        });
        if (!variant)
            throw new common_1.NotFoundException('Product variant not found');
        const account = await this.accountRepo.findOneBy({
            id: input.ebayAccountId,
            organizationId: input.organizationId,
        });
        if (!account)
            throw new common_1.NotFoundException('eBay account not found in this organization');
        return this.mappingRepo.save(this.mappingRepo.create({
            variantId: variant.id,
            ebayAccountId: account.id,
            marketplaceId: input.marketplaceId,
            inventorySku: input.inventorySku?.trim() || variant.sku,
            offerId: null,
            listingId: null,
            status: 'pending',
            lastError: null,
            resultPayload: null,
        }));
    }
    async assertStoreOrganization(storeId, organizationId) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        if (!store)
            throw new common_1.NotFoundException(`Store ${storeId} not found`);
        if (store.organizationId === organizationId)
            return store;
        const account = await this.accountRepo.findOneBy({
            primaryStoreId: storeId,
            organizationId,
        });
        if (!account)
            throw new common_1.NotFoundException(`Store ${storeId} is not available in this organization`);
        return store;
    }
    async assertFeatureEnabledForNonAutomotive(vertical) {
        if (vertical !== vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL)
            await this.assertFeatureEnabled();
    }
    buildAspects(product, listing, attributes) {
        if (product.vertical === 'fashion') {
            return (0, fashion_config_js_1.fashionAspectsFromAttributes)(attributes, listing?.cBrand ?? product.brand);
        }
        const result = {};
        for (const [key, value] of Object.entries(attributes)) {
            if ((0, fashion_config_js_1.isFashionMetaKey)(key))
                continue;
            const values = Array.isArray(value) ? value : [String(value)];
            if (values.length && values.every((item) => item.trim().length > 0))
                result[key] = values;
        }
        const fallback = [
            ['Brand', listing?.cBrand?.trim() || product.brand],
            ['MPN', listing?.cManufacturerPartNumber?.trim() || product.mpn],
            ['Model', attributes.model],
            [
                'Type',
                listing?.cType?.trim() ||
                    product.partType ||
                    attributes.partType,
            ],
            [
                'Material',
                listing?.cMaterial ?? attributes.material,
            ],
        ];
        for (const [key, value] of fallback)
            if (value?.trim() && !result[key])
                result[key] = [value.trim()];
        if (product.vertical === 'business_industrial' &&
            !result['Form Factor'] &&
            /rack[ -]?mount/i.test([product.title, product.partType, attributes.mounting]
                .filter(Boolean)
                .join(' ')))
            result['Form Factor'] = ['Rack Mount'];
        if (product.vertical === 'business_industrial' &&
            !result.Model &&
            product.mpn?.trim() &&
            product.mpn.trim().toLowerCase() !== 'does not apply')
            result.Model = [product.mpn.trim()];
        if (product.vertical === 'business_industrial' &&
            !result.Model &&
            product.mpn?.trim().toLowerCase() === 'does not apply')
            result.Model = ['Model Not Specified'];
        return result;
    }
    mapCondition(conditionId, conditionLabel) {
        if (conditionId?.trim() === '3000')
            return 'USED_EXCELLENT';
        if (!conditionId?.trim() && /^used$/i.test(conditionLabel?.trim() ?? '')) {
            return 'USED_EXCELLENT';
        }
        const raw = `${conditionId ?? ''} ${conditionLabel ?? ''}`.toLowerCase();
        if (raw.includes('1750'))
            return 'NEW_WITH_DEFECTS';
        if (raw.includes('1000') || raw.includes('new'))
            return 'NEW';
        if (raw.includes('1500') || raw.includes('open'))
            return 'NEW_OTHER';
        if (raw.includes('2000') || raw.includes('certified'))
            return 'CERTIFIED_REFURBISHED';
        if (raw.includes('2500') || raw.includes('refurb'))
            return 'SELLER_REFURBISHED';
        if (raw.includes('7000') || raw.includes('parts'))
            return 'FOR_PARTS_OR_NOT_WORKING';
        if (raw.includes('3000'))
            return 'USED_EXCELLENT';
        if (raw.includes('4000'))
            return 'USED_VERY_GOOD';
        if (raw.includes('5000'))
            return 'USED_GOOD';
        if (raw.includes('6000'))
            return 'USED_ACCEPTABLE';
        if (raw.includes('very good'))
            return 'USED_VERY_GOOD';
        if (raw.includes('acceptable'))
            return 'USED_ACCEPTABLE';
        if (raw.includes('good') || raw.includes('used'))
            return 'USED_GOOD';
        return null;
    }
    pickSupportedConditionId(condition, supportedConditions, preferredId) {
        const supported = new Set(supportedConditions.map((value) => String(value).trim()).filter(Boolean));
        if (preferredId && supported.has(preferredId))
            return preferredId;
        const candidates = condition === 'FOR_PARTS_OR_NOT_WORKING'
            ? ['7000']
            : condition === 'NEW' ||
                condition === 'NEW_OTHER' ||
                condition === 'NEW_WITH_DEFECTS'
                ? ['1000', '1500', '1750']
                : condition === 'MANUFACTURER_REFURBISHED' ||
                    condition === 'CERTIFIED_REFURBISHED' ||
                    condition === 'SELLER_REFURBISHED'
                    ? ['2000', '2500']
                    : condition === 'USED_EXCELLENT' ||
                        condition === 'USED_VERY_GOOD' ||
                        condition === 'USED_GOOD' ||
                        condition === 'USED_ACCEPTABLE'
                        ? ['3000', '4000', '5000', '6000']
                        : [];
        return candidates.find((candidate) => supported.has(candidate)) ?? null;
    }
};
exports.VerticalsService = VerticalsService;
exports.VerticalsService = VerticalsService = VerticalsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(4, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(5, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(6, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(7, (0, typeorm_1.InjectRepository)(product_family_entity_js_1.ProductFamily)),
    __param(8, (0, typeorm_1.InjectRepository)(product_variant_entity_js_1.ProductVariant)),
    __param(9, (0, typeorm_1.InjectRepository)(variant_marketplace_mapping_entity_js_1.VariantMarketplaceMapping)),
    __param(10, (0, typeorm_1.InjectRepository)(product_marketplace_category_entity_js_1.ProductMarketplaceCategory)),
    __param(11, (0, typeorm_1.InjectRepository)(business_industrial_review_entity_js_1.BusinessIndustrialReview)),
    __metadata("design:paramtypes", [feature_flag_service_js_1.FeatureFlagService,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        ebay_selling_metadata_service_js_1.EbaySellingMetadataService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], VerticalsService);
//# sourceMappingURL=verticals.service.js.map