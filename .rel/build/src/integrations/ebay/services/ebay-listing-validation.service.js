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
var EbayListingValidationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayListingValidationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../entities/ebay-account-marketplace.entity.js");
const ebay_marketplace_config_service_js_1 = require("./ebay-marketplace-config.service.js");
const ebay_account_token_service_js_1 = require("./ebay-account-token.service.js");
const sellerpundit_policy_sync_service_js_1 = require("../../sellerpundit/sellerpundit-policy-sync.service.js");
const sellerpundit_token_sync_service_js_1 = require("../../sellerpundit/sellerpundit-token-sync.service.js");
const ebay_inventory_api_service_js_1 = require("../../../channels/ebay/ebay-inventory-api.service.js");
const ebay_listing_text_util_js_1 = require("../../../channels/ebay/ebay-listing-text.util.js");
const catalog_publish_resolver_service_js_1 = require("./catalog-publish-resolver.service.js");
const verticals_service_js_1 = require("../../../verticals/verticals.service.js");
let EbayListingValidationService = EbayListingValidationService_1 = class EbayListingValidationService {
    marketplaceConfig;
    tokens;
    sellerpunditPolicies;
    sellerpunditTokens;
    inventoryApi;
    publishResolver;
    verticals;
    accountRepo;
    mpRepo;
    logger = new common_1.Logger(EbayListingValidationService_1.name);
    constructor(marketplaceConfig, tokens, sellerpunditPolicies, sellerpunditTokens, inventoryApi, publishResolver, verticals, accountRepo, mpRepo) {
        this.marketplaceConfig = marketplaceConfig;
        this.tokens = tokens;
        this.sellerpunditPolicies = sellerpunditPolicies;
        this.sellerpunditTokens = sellerpunditTokens;
        this.inventoryApi = inventoryApi;
        this.publishResolver = publishResolver;
        this.verticals = verticals;
        this.accountRepo = accountRepo;
        this.mpRepo = mpRepo;
    }
    async validatePublish(params) {
        const errors = [];
        const warnings = [];
        const requiredActions = [];
        const mp = this.marketplaceConfig.get(params.marketplaceId);
        if (!mp) {
            errors.push(`Unsupported marketplace ${params.marketplaceId}`);
        }
        const account = await this.accountRepo.findOne({
            where: {
                id: params.ebayAccountId,
                organizationId: params.organizationId,
            },
            relations: ['oauthToken', 'primaryStore'],
        });
        if (!account) {
            errors.push('eBay account not found for organization');
            return { status: 'blocked', errors, warnings, requiredActions };
        }
        if (account.connectionStatus === 'disabled') {
            errors.push('eBay account is disabled');
        }
        const isSellerpundit = account.connectionSource === 'sellerpundit';
        if (account.connectionStatus === 'reconnect_required' ||
            account.connectionStatus === 'token_expired' ||
            account.oauthToken?.reconnectRequired) {
            errors.push(isSellerpundit
                ? `eBay rejected the OAuth token for "${account.accountDisplayName ?? account.ebayUsername ?? 'this store'}". Re-sync in Omni Core only refreshes what SellerPundit has — reconnect eBay for this store inside SellerPundit admin, then Re-sync stores here.`
                : 'eBay account requires reconnection');
            requiredActions.push(isSellerpundit ? 'reconnect_sellerpundit_ebay' : 'reconnect_oauth');
        }
        else if (isSellerpundit) {
            const tokenOk = await this.sellerpunditTokens.validateAccountEbayToken(params.ebayAccountId, params.marketplaceId);
            if (!tokenOk) {
                errors.push(`eBay rejected the OAuth token for "${account.accountDisplayName ?? account.ebayUsername ?? 'this store'}". SellerPundit still lists this store as connected, but its eBay authorization is invalid. Reconnect eBay in SellerPundit for this account, then Re-sync stores in Settings → eBay Integrations.`);
                requiredActions.push('reconnect_sellerpundit_ebay');
            }
        }
        if (isSellerpundit) {
            try {
                const pr = await this.sellerpunditPolicies.ensurePoliciesFresh(params.ebayAccountId, params.organizationId, params.marketplaceId);
                if (!pr.ok) {
                    errors.push(pr.message || 'SellerPundit policy sync failed');
                    requiredActions.push('sync_sellerpundit_policies');
                }
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                errors.push(`SellerPundit policy refresh failed: ${msg}`);
                requiredActions.push('sync_sellerpundit_policies');
            }
        }
        if (account.primaryStoreId) {
            try {
                const key = await this.inventoryApi.ensureMerchantLocation(account.primaryStoreId);
                if (key) {
                    await this.mpRepo
                        .createQueryBuilder()
                        .update()
                        .set({ defaultInventoryLocationKey: key })
                        .where('ebay_account_id = :accountId', {
                        accountId: params.ebayAccountId,
                    })
                        .andWhere('default_inventory_location_key IS NULL')
                        .execute();
                }
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this.logger.warn(`Inventory location hydration failed for ${params.ebayAccountId}: ${msg}`);
            }
        }
        const mpRow = await this.mpRepo.findOne({
            where: {
                ebayAccountId: params.ebayAccountId,
                marketplaceId: params.marketplaceId,
            },
        });
        const overrideValue = (key) => {
            const value = params.policyOverrides?.[key];
            return typeof value === 'string' && value.trim() ? value.trim() : undefined;
        };
        if (mpRow && !mpRow.enabled) {
            errors.push('Marketplace is disabled for this account');
        }
        if (!mpRow) {
            errors.push('Marketplace is not configured for this eBay account — reconnect or add a marketplace row.');
        }
        else {
            if (!mpRow.defaultFulfillmentPolicyId && !overrideValue('fulfillmentPolicyId') && !overrideValue('requestedFulfillmentPolicyName')) {
                errors.push(isSellerpundit
                    ? 'Default fulfillment policy is required — sync policies from SellerPundit.'
                    : 'Default fulfillment policy is required — sync policies from eBay or map defaults.');
                requiredActions.push('map_fulfillment_policy');
            }
            if (!mpRow.defaultPaymentPolicyId && !overrideValue('paymentPolicyId') && !overrideValue('requestedPaymentPolicyName')) {
                errors.push(isSellerpundit
                    ? 'Default payment policy is required — sync policies from SellerPundit.'
                    : 'Default payment policy is required — sync policies from eBay or map defaults.');
                requiredActions.push('map_payment_policy');
            }
            if (!mpRow.defaultReturnPolicyId && !overrideValue('returnPolicyId') && !overrideValue('requestedReturnPolicyName')) {
                errors.push(isSellerpundit
                    ? 'Default return policy is required — sync policies from SellerPundit.'
                    : 'Default return policy is required — sync policies from eBay or map defaults.');
                requiredActions.push('map_return_policy');
            }
            if (!mpRow.defaultInventoryLocationKey && !overrideValue('merchantLocationKey')) {
                errors.push(isSellerpundit
                    ? 'Default inventory location is required — needed when SellerPundit publish falls back to direct eBay. Sync policies from eBay or map a merchant location key.'
                    : 'Default inventory location is required — sync policies from eBay or map a merchant location key.');
                requiredActions.push('map_inventory_location');
            }
        }
        const resolved = await this.publishResolver.resolve(params.catalogProductId);
        if (!resolved) {
            errors.push('Catalog product or listing record not found');
        }
        else {
            const { snapshot } = resolved;
            warnings.push(...resolved.warnings);
            const vertical = this.verticals.resolveVertical(resolved.catalogProduct, resolved.listingRecord, snapshot.vertical);
            if (vertical === 'business_industrial') {
                if (!account.primaryStoreId) {
                    errors.push('Business & Industrial publishing requires a dedicated seller store');
                }
                else {
                    const projection = await this.verticals.buildPublishProjection({
                        vertical,
                        product: resolved.catalogProduct,
                        listing: resolved.listingRecord,
                        storeId: account.primaryStoreId,
                        marketplaceId: params.marketplaceId,
                    });
                    if (projection) {
                        errors.push(...projection.blockingErrors);
                        warnings.push(...projection.warnings);
                    }
                }
            }
            if (!snapshot.sku?.trim()) {
                errors.push('Listing is missing SKU');
            }
            if (snapshot.price == null || Number(snapshot.price) <= 0) {
                errors.push('Listing has invalid price');
            }
            if (snapshot.quantity == null || snapshot.quantity < 0) {
                errors.push('Listing has invalid quantity');
            }
            if (!snapshot.imageUrls.length) {
                errors.push('Listing requires at least one valid image URL (http/https) — add itemPhotoUrl or catalog images');
            }
            const rawTitle = (0, ebay_listing_text_util_js_1.normalizeListingText)(snapshot.title ?? '');
            if (!rawTitle) {
                const fallback = (0, ebay_listing_text_util_js_1.buildEbayListingTitle)({
                    brand: snapshot.brand,
                    partType: snapshot.partType,
                    mpn: snapshot.mpn,
                    sku: snapshot.sku,
                });
                if (!fallback.title) {
                    errors.push('Listing is missing a title');
                }
                else {
                    warnings.push('Listing title is empty — publish will use generated title from brand/part type/MPN or SKU');
                }
            }
            else if (rawTitle.length > ebay_listing_text_util_js_1.EBAY_TITLE_MAX_LENGTH) {
                warnings.push(`Listing title is ${rawTitle.length} characters — it will be truncated to ${ebay_listing_text_util_js_1.EBAY_TITLE_MAX_LENGTH} for eBay`);
            }
            if (!snapshot.categoryId?.trim()) {
                warnings.push('Category not set — eBay publish may fail');
            }
            const rawDesc = snapshot.description?.trim() ?? '';
            if (rawDesc) {
                const stripped = (0, ebay_listing_text_util_js_1.stripListingHtmlBoilerplate)(rawDesc);
                if (stripped.length > ebay_listing_text_util_js_1.EBAY_OFFER_DESCRIPTION_MAX_LENGTH) {
                    warnings.push(`Description is ${stripped.length} characters — it will be truncated to ${ebay_listing_text_util_js_1.EBAY_OFFER_DESCRIPTION_MAX_LENGTH} for eBay`);
                }
            }
            else {
                warnings.push('Description is empty — a short fallback will be generated at publish time');
            }
            if (mp?.requiresLocalizedDescription) {
                if (!snapshot.description?.trim()) {
                    errors.push('Localized description required for this marketplace');
                }
                else if (params.marketplaceId === 'EBAY_DE') {
                    const deHint = /[äöüßÄÖÜ]/.test(snapshot.description);
                    if (!deHint) {
                        warnings.push('German marketplace: description may need German-language content');
                    }
                    if (snapshot.title &&
                        /\b(gebraucht OE|Genuine OEM|for \d{4})\b/i.test(snapshot.title)) {
                        warnings.push('German marketplace: title contains non-native phrasing — regenerate DE optimization');
                    }
                }
            }
        }
        try {
            await this.tokens.getValidAccessToken(params.ebayAccountId);
        }
        catch {
            errors.push('Unable to obtain a valid OAuth token for this account');
        }
        let status = 'ready';
        if (errors.length)
            status = 'blocked';
        else if (warnings.length || requiredActions.length)
            status = 'warnings';
        return { status, errors, warnings, requiredActions };
    }
};
exports.EbayListingValidationService = EbayListingValidationService;
exports.EbayListingValidationService = EbayListingValidationService = EbayListingValidationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(8, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __metadata("design:paramtypes", [ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
        ebay_account_token_service_js_1.EbayAccountTokenService,
        sellerpundit_policy_sync_service_js_1.SellerpunditPolicySyncService,
        sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        catalog_publish_resolver_service_js_1.CatalogPublishResolverService,
        verticals_service_js_1.VerticalsService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EbayListingValidationService);
//# sourceMappingURL=ebay-listing-validation.service.js.map