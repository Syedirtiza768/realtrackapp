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
exports.SellerpunditListingAdapter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_account_marketplace_entity_js_1 = require("../ebay/entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../ebay/entities/ebay-business-policy.entity.js");
const sellerpundit_auth_service_js_1 = require("./sellerpundit-auth.service.js");
const sellerpundit_http_client_js_1 = require("./sellerpundit-http.client.js");
const sellerpundit_marketplace_registry_js_1 = require("./sellerpundit-marketplace.registry.js");
const sellerpundit_token_sync_service_js_1 = require("./sellerpundit-token-sync.service.js");
const sellerpundit_publish_util_js_1 = require("./sellerpundit-publish.util.js");
const ebay_listing_text_util_js_1 = require("../../channels/ebay/ebay-listing-text.util.js");
const ebay_listing_images_util_js_1 = require("../../channels/ebay/ebay-listing-images.util.js");
const ebay_listing_condition_util_js_1 = require("../../channels/ebay/ebay-listing-condition.util.js");
const ebay_listing_aspects_util_js_1 = require("../../channels/ebay/ebay-listing-aspects.util.js");
const ebay_business_policy_util_js_1 = require("../ebay/services/ebay-business-policy.util.js");
let SellerpunditListingAdapter = class SellerpunditListingAdapter {
    auth;
    http;
    registry;
    tokenSync;
    mpRepo;
    policyRepo;
    constructor(auth, http, registry, tokenSync, mpRepo, policyRepo) {
        this.auth = auth;
        this.http = http;
        this.registry = registry;
        this.tokenSync = tokenSync;
        this.mpRepo = mpRepo;
        this.policyRepo = policyRepo;
    }
    async publish(built, account, marketplaceId) {
        const req = built.publishRequest;
        const listingText = (0, ebay_listing_text_util_js_1.sanitizePublishListingText)({
            title: req.title,
            description: req.description,
            sku: req.sku,
            brand: req.aspects?.Brand?.[0],
            mpn: req.aspects?.MPN?.[0],
            partType: req.aspects?.Type?.[0],
        });
        const images = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(req.imageUrls);
        if (!images.imageUrls.length) {
            return {
                success: false,
                error: 'At least one valid image URL (http/https) is required to publish',
                errors: [
                    'Catalog product requires at least one valid image URL before SellerPundit publish',
                ],
            };
        }
        const mpRow = await this.mpRepo.findOne({
            where: { ebayAccountId: account.id, marketplaceId },
        });
        const fulfillmentPolicyId = req.fulfillmentPolicyId ?? mpRow?.defaultFulfillmentPolicyId;
        const paymentPolicyId = req.paymentPolicyId ?? mpRow?.defaultPaymentPolicyId;
        let returnPolicyId = req.returnPolicyId ?? mpRow?.defaultReturnPolicyId;
        const compliantReturnId = await this.resolveCompliantReturnPolicyId(account.id, marketplaceId, req.categoryId, req.condition);
        if (compliantReturnId) {
            returnPolicyId = compliantReturnId;
        }
        if ((0, ebay_business_policy_util_js_1.listingRequiresPartsAccessoriesReturnPolicy)(marketplaceId, req.categoryId, req.condition)) {
            if (!returnPolicyId) {
                return {
                    success: false,
                    error: (0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)(),
                    errors: [(0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)()],
                };
            }
            const returnRow = await this.policyRepo.findOne({
                where: {
                    ebayAccountId: account.id,
                    marketplaceId,
                    policyType: 'return',
                    ebayPolicyId: returnPolicyId,
                },
            });
            if (!(0, ebay_business_policy_util_js_1.isPartsAccessoriesCompliantReturnPolicy)(returnRow?.rawPayload ?? {})) {
                const blocked = (0, ebay_business_policy_util_js_1.paReturnPolicyBlockedMessage)({
                    returnPolicyId,
                    raw: returnRow?.rawPayload,
                    storeName: account.accountDisplayName ?? account.ebayUsername ?? undefined,
                    marketplaceId,
                    condition: req.condition,
                });
                return {
                    success: false,
                    error: blocked,
                    errors: [blocked],
                };
            }
        }
        if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
            const hint = await this.missingPolicyHint(account.id, marketplaceId, account.sellerpunditAccountName ?? account.accountDisplayName);
            return {
                success: false,
                error: hint ?? 'Missing business policy IDs after sync',
                errors: [
                    hint ??
                        'Fulfillment, payment, and return policies are required — sync SellerPundit policies and map defaults.',
                ],
            };
        }
        if (!(0, ebay_business_policy_util_js_1.isLikelyEbayRestPolicyId)(fulfillmentPolicyId) ||
            !(0, ebay_business_policy_util_js_1.isLikelyEbayRestPolicyId)(paymentPolicyId) ||
            !(0, ebay_business_policy_util_js_1.isLikelyEbayRestPolicyId)(returnPolicyId)) {
            return {
                success: false,
                error: 'Invalid business policy IDs — re-sync policies from Settings → eBay Integrations',
                errors: [
                    'Stored policy IDs are not valid eBay REST policy identifiers. Sync policies again so defaults use eBay fulfillment/payment/return policy IDs.',
                ],
            };
        }
        if (!account.sellerpunditAccountName ||
            account.sellerpunditMarketplaceId == null) {
            return {
                success: false,
                error: 'SellerPundit account metadata missing',
                errors: ['Re-import stores from SellerPundit'],
            };
        }
        const siteId = this.registry.siteIdFor(marketplaceId);
        const country = this.registry.countryForSite(siteId);
        const currency = req.currency ?? this.registry.currencyForMarketplace(marketplaceId);
        const itemSpecifics = Object.entries(req.aspects ?? {}).map(([name, values]) => ({
            name: (0, ebay_listing_aspects_util_js_1.localizeAspectName)(name, marketplaceId),
            value: Array.isArray(values) ? values.join(', ') : String(values),
        }));
        const csku = {
            title: listingText.title,
            description: listingText.description,
            price: String(req.price),
            quantity: String(req.quantity),
            currency,
            images: images.imageUrls,
            country,
            conditionId: this.conditionIdFromEnum((0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(req.condition)),
            location: country,
            sellerProfile: {
                fulfillmentPolicyId,
                paymentPolicyId,
                returnPolicyId,
            },
            categoryId: req.categoryId || '0',
            categoryName: req.categoryId ? `Category ${req.categoryId}` : 'General',
            itemSpecifics,
            siteId,
            isku: req.sku,
            mrp: String(req.price),
        };
        const body = {
            accountName: account.sellerpunditAccountName,
            marketplaceId: account.sellerpunditMarketplaceId,
            marketPlaceId: account.sellerpunditMarketplaceId,
            tokenId: account.sellerpunditTokenId,
            cskuData: [csku],
        };
        try {
            await this.tokenSync.ensureFreshAccessToken(account.id);
            const jwt = await this.auth.getJwt(account.organizationId);
            const raw = await this.http.post(jwt, '/inventory/bulk-create-using-api', body);
            return this.parseBulkCreateResponse(raw, req.sku);
        }
        catch (e) {
            let message;
            let errors;
            let details;
            if (e instanceof common_1.HttpException) {
                const resp = e.getResponse();
                if (typeof resp === 'object' && resp !== null) {
                    const r = resp;
                    message = r.message ?? e.message;
                    errors = Array.isArray(r.errors) ? r.errors : [message];
                    details = r.details;
                }
                else {
                    message = e.message;
                    errors = [message];
                }
            }
            else {
                message = e.message;
                errors = [message];
            }
            const failure = {
                success: false,
                error: message,
                errors,
                sellerPunditResponse: details,
            };
            return {
                ...failure,
                ...(0, sellerpundit_publish_util_js_1.tagSellerpunditPlatformError)(failure),
            };
        }
    }
    asRecord(raw) {
        return raw != null && typeof raw === 'object' && !Array.isArray(raw)
            ? raw
            : undefined;
    }
    parseBulkCreateResponse(raw, sku) {
        if (raw && typeof raw === 'object') {
            const o = raw;
            const successFlag = o.success;
            if (successFlag === false) {
                const errors = this.collectErrors(o);
                const failure = {
                    success: false,
                    error: errors[0] ?? 'SellerPundit bulk create failed',
                    errors,
                    sellerPunditResponse: this.asRecord(raw),
                };
                return { ...failure, ...(0, sellerpundit_publish_util_js_1.tagSellerpunditPlatformError)(failure) };
            }
            const data = o.data ?? o.result ?? o;
            if (data && typeof data === 'object') {
                const d = data;
                if (d.success === false) {
                    const errors = this.collectErrors(d);
                    const failure = {
                        success: false,
                        error: errors[0] ?? 'SellerPundit rejected listing',
                        errors,
                        sellerPunditResponse: this.asRecord(raw),
                    };
                    return { ...failure, ...(0, sellerpundit_publish_util_js_1.tagSellerpunditPlatformError)(failure) };
                }
                const listingId = d.listingId ?? d.ebayListingId ?? d.itemId ?? d.id;
                const offerId = d.offerId ?? d.offer_id;
                if (listingId != null || offerId != null) {
                    return {
                        success: true,
                        listingId: listingId != null ? String(listingId) : undefined,
                        offerId: offerId != null ? String(offerId) : undefined,
                        sellerPunditResponse: this.asRecord(raw),
                    };
                }
            }
            if (Array.isArray(o.errors) && o.errors.length) {
                const errors = this.collectErrors(o);
                const failure = {
                    success: false,
                    error: errors[0] ?? 'SellerPundit returned errors',
                    errors,
                    sellerPunditResponse: this.asRecord(raw),
                };
                return { ...failure, ...(0, sellerpundit_publish_util_js_1.tagSellerpunditPlatformError)(failure) };
            }
        }
        return {
            success: true,
            listingId: undefined,
            offerId: sku,
            sellerPunditResponse: this.asRecord(raw),
        };
    }
    collectErrors(o) {
        const out = [];
        if (typeof o.message === 'string')
            out.push(o.message);
        if (typeof o.error === 'string')
            out.push(o.error);
        if (Array.isArray(o.errors)) {
            for (const e of o.errors) {
                if (typeof e === 'string')
                    out.push(e);
                else if (e && typeof e === 'object' && 'message' in e) {
                    out.push(String(e.message));
                }
            }
        }
        return out.length ? out : ['Unknown SellerPundit error'];
    }
    async resolveCompliantReturnPolicyId(ebayAccountId, marketplaceId, categoryId, condition) {
        const rows = await this.policyRepo.find({
            where: { ebayAccountId, marketplaceId, policyType: 'return' },
        });
        if (!rows.length)
            return undefined;
        return ((0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(rows.map((r) => ({
            ebayPolicyId: r.ebayPolicyId,
            isDefault: r.isDefault,
            geoSite: (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(r.rawPayload ?? {}),
            rawPayload: r.rawPayload ?? {},
        })), marketplaceId, categoryId, condition) ?? undefined);
    }
    async missingPolicyHint(ebayAccountId, marketplaceId, accountName) {
        const rows = await this.policyRepo.find({ where: { ebayAccountId } });
        if (!rows.length) {
            return 'No business policies found — open Settings → eBay Integrations, sync SellerPundit policies, then retry publish.';
        }
        const geoSites = [
            ...new Set(rows
                .map((r) => (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(r.rawPayload ?? {}))
                .filter((g) => Boolean(g?.trim()))),
        ];
        const matchingGeo = geoSites.filter((g) => (0, ebay_business_policy_util_js_1.policyMatchesMarketplaceGeo)(g, marketplaceId));
        if (geoSites.length && !matchingGeo.length) {
            const inferred = accountName
                ? this.registry.inferMarketplaceFromAccountName(accountName)
                : null;
            const geoList = geoSites.join(', ');
            if (inferred && inferred !== marketplaceId) {
                return (`Synced policies are for ${geoList}, but this store is publishing to ${marketplaceId}. ` +
                    `Re-sync SellerPundit stores so "${accountName}" maps to ${inferred}, then sync policies and publish again.`);
            }
            return (`Synced policies are for ${geoList}, but this store is publishing to ${marketplaceId}. ` +
                'Create or enable matching business policies in eBay Seller Hub, sync policies, or publish to the correct marketplace.');
        }
        return null;
    }
    conditionIdFromEnum(condition) {
        const map = {
            NEW: 1000,
            NEW_OTHER: 1500,
            USED_EXCELLENT: 3000,
            USED_GOOD: 5000,
            USED_ACCEPTABLE: 6000,
            FOR_PARTS_OR_NOT_WORKING: 7000,
        };
        return map[condition] ?? 5000;
    }
};
exports.SellerpunditListingAdapter = SellerpunditListingAdapter;
exports.SellerpunditListingAdapter = SellerpunditListingAdapter = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __param(5, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __metadata("design:paramtypes", [sellerpundit_auth_service_js_1.SellerpunditAuthService,
        sellerpundit_http_client_js_1.SellerpunditHttpClient,
        sellerpundit_marketplace_registry_js_1.SellerpunditMarketplaceRegistry,
        sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SellerpunditListingAdapter);
//# sourceMappingURL=sellerpundit-listing.adapter.js.map