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
var EbayPaReturnPolicyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayPaReturnPolicyService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_auth_service_js_1 = require("../../../channels/ebay/ebay-auth.service.js");
const ebay_account_marketplace_entity_js_1 = require("../entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../entities/ebay-business-policy.entity.js");
const ebay_api_error_util_js_1 = require("../../../channels/ebay/ebay-api-error.util.js");
const ebay_business_policy_util_js_1 = require("./ebay-business-policy.util.js");
const ebay_sell_account_api_service_js_1 = require("./ebay-sell-account-api.service.js");
let EbayPaReturnPolicyService = EbayPaReturnPolicyService_1 = class EbayPaReturnPolicyService {
    ebayAuth;
    sellAccount;
    policyRepo;
    mpRepo;
    logger = new common_1.Logger(EbayPaReturnPolicyService_1.name);
    constructor(ebayAuth, sellAccount, policyRepo, mpRepo) {
        this.ebayAuth = ebayAuth;
        this.sellAccount = sellAccount;
        this.policyRepo = policyRepo;
        this.mpRepo = mpRepo;
    }
    async ensureCompliantReturnPolicy(params) {
        const { store, account, marketplaceId, categoryId, condition, currentReturnPolicyId, } = params;
        if (!(0, ebay_business_policy_util_js_1.listingRequiresPartsAccessoriesReturnPolicy)(marketplaceId, categoryId, condition)) {
            return {
                returnPolicyId: currentReturnPolicyId ?? null,
                action: 'unchanged',
            };
        }
        const cachedCurrent = currentReturnPolicyId
            ? await this.policyRepo.findOne({
                where: {
                    ebayAccountId: account.id,
                    marketplaceId,
                    policyType: 'return',
                    ebayPolicyId: currentReturnPolicyId,
                },
            })
            : null;
        if ((0, ebay_business_policy_util_js_1.isPartsAccessoriesCompliantReturnPolicy)(cachedCurrent?.rawPayload ?? {})) {
            return { returnPolicyId: currentReturnPolicyId, action: 'picked' };
        }
        let token;
        let baseUrl;
        let accountApiUnavailable = false;
        try {
            token = await this.ebayAuth.getAccessToken(store.id, {
                forceRefresh: account.connectionSource === 'sellerpundit',
            });
            baseUrl = await this.ebayAuth.getApiBaseUrlForStore(store.id);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Cannot ensure P&A return policy for "${store.storeName}": ${msg}`);
            return this.blockNonCompliant(currentReturnPolicyId, cachedCurrent?.rawPayload, store.storeName, accountApiUnavailable, marketplaceId, condition);
        }
        let policies = [];
        try {
            policies = await this.sellAccount.listReturnPolicies(token, baseUrl, marketplaceId);
        }
        catch (err) {
            accountApiUnavailable = (0, ebay_api_error_util_js_1.isEbayInvalidAccessTokenError)(err);
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Return policy list failed for "${store.storeName}": ${msg}`);
            return this.blockNonCompliant(currentReturnPolicyId, cachedCurrent?.rawPayload, store.storeName, accountApiUnavailable, marketplaceId, condition);
        }
        const candidates = policies.map((p) => ({
            ebayPolicyId: p.ebayPolicyId,
            isDefault: p.isDefault,
            geoSite: (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(p.raw),
            rawPayload: p.raw,
        }));
        const picked = (0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(candidates, marketplaceId, categoryId, condition);
        if (picked) {
            await this.persistReturnPolicy(account.id, marketplaceId, policies, picked);
            await this.updateMarketplaceDefault(account.id, marketplaceId, picked);
            return { returnPolicyId: picked, action: 'picked' };
        }
        const upgrade = (0, ebay_business_policy_util_js_1.pickReturnPolicyUpgradeCandidate)(candidates, marketplaceId, currentReturnPolicyId);
        if (upgrade) {
            try {
                const body = (0, ebay_business_policy_util_js_1.buildPaCompliantReturnPolicyRequest)(marketplaceId, upgrade.rawPayload ?? {});
                await this.sellAccount.updateReturnPolicy(token, baseUrl, marketplaceId, upgrade.ebayPolicyId, body);
                const refreshed = await this.sellAccount.listReturnPolicies(token, baseUrl, marketplaceId);
                const upgradedRaw = refreshed.find((p) => p.ebayPolicyId === upgrade.ebayPolicyId)?.raw;
                if (!(0, ebay_business_policy_util_js_1.isPartsAccessoriesCompliantReturnPolicy)(upgradedRaw ?? {})) {
                    throw new Error(`eBay did not persist seller-paid return shipping on policy ${upgrade.ebayPolicyId}`);
                }
                await this.persistReturnPolicy(account.id, marketplaceId, refreshed, upgrade.ebayPolicyId);
                await this.updateMarketplaceDefault(account.id, marketplaceId, upgrade.ebayPolicyId);
                this.logger.log(`Upgraded return policy ${upgrade.ebayPolicyId} to P&A-compliant (seller-paid, 30+ days) for "${store.storeName}"`);
                return { returnPolicyId: upgrade.ebayPolicyId, action: 'upgraded' };
            }
            catch (err) {
                if ((0, ebay_api_error_util_js_1.isEbayInvalidAccessTokenError)(err)) {
                    accountApiUnavailable = true;
                }
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Return policy upgrade failed for ${upgrade.ebayPolicyId} on "${store.storeName}": ${msg}`);
            }
        }
        try {
            const template = upgrade?.rawPayload ??
                candidates.find((c) => (0, ebay_business_policy_util_js_1.canEvaluateReturnPolicyCompliance)(c.rawPayload ?? {}))?.rawPayload;
            const body = (0, ebay_business_policy_util_js_1.buildPaCompliantReturnPolicyRequest)(marketplaceId, template);
            body.name = 'P&A Compliant Return (Omni Core)';
            const created = await this.sellAccount.createReturnPolicy(token, baseUrl, marketplaceId, body);
            const refreshed = await this.sellAccount.listReturnPolicies(token, baseUrl, marketplaceId);
            await this.persistReturnPolicy(account.id, marketplaceId, refreshed, created.returnPolicyId);
            await this.updateMarketplaceDefault(account.id, marketplaceId, created.returnPolicyId);
            this.logger.log(`Created P&A-compliant return policy ${created.returnPolicyId} for "${store.storeName}"`);
            return { returnPolicyId: created.returnPolicyId, action: 'created' };
        }
        catch (err) {
            if ((0, ebay_api_error_util_js_1.isEbayInvalidAccessTokenError)(err)) {
                accountApiUnavailable = true;
            }
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Create P&A return policy failed for "${store.storeName}": ${msg}`);
        }
        return this.blockNonCompliant(currentReturnPolicyId, cachedCurrent?.rawPayload, store.storeName, accountApiUnavailable, marketplaceId, condition);
    }
    blockNonCompliant(returnPolicyId, raw, storeName, accountApiUnavailable, marketplaceId, condition) {
        if (!returnPolicyId) {
            return {
                returnPolicyId: null,
                action: 'blocked',
                blockedMessage: (0, ebay_business_policy_util_js_1.partsAccessoriesReturnPolicyGuidance)(),
                accountApiUnavailable,
            };
        }
        return {
            returnPolicyId: null,
            action: 'blocked',
            accountApiUnavailable,
            blockedMessage: (0, ebay_business_policy_util_js_1.paReturnPolicyBlockedMessage)({
                returnPolicyId,
                raw,
                storeName,
                marketplaceId,
                condition,
                accountApiUnavailable,
            }),
        };
    }
    async persistReturnPolicy(ebayAccountId, marketplaceId, policies, returnPolicyId) {
        const match = policies.find((p) => p.ebayPolicyId === returnPolicyId);
        if (!match || !(0, ebay_business_policy_util_js_1.isLikelyEbayRestPolicyId)(returnPolicyId))
            return;
        const existing = await this.policyRepo.findOne({
            where: {
                ebayAccountId,
                marketplaceId,
                policyType: 'return',
                ebayPolicyId: returnPolicyId,
            },
        });
        if (existing) {
            existing.name = match.name;
            existing.rawPayload = match.raw;
            existing.isDefault = match.isDefault;
            await this.policyRepo.save(existing);
            return;
        }
        await this.policyRepo.save(this.policyRepo.create({
            ebayAccountId,
            marketplaceId,
            policyType: 'return',
            ebayPolicyId: returnPolicyId,
            name: match.name,
            rawPayload: match.raw,
            isDefault: match.isDefault,
        }));
    }
    async updateMarketplaceDefault(ebayAccountId, marketplaceId, returnPolicyId) {
        const mp = await this.mpRepo.findOne({
            where: { ebayAccountId, marketplaceId },
        });
        if (!mp)
            return;
        mp.defaultReturnPolicyId = returnPolicyId;
        await this.mpRepo.save(mp);
    }
};
exports.EbayPaReturnPolicyService = EbayPaReturnPolicyService;
exports.EbayPaReturnPolicyService = EbayPaReturnPolicyService = EbayPaReturnPolicyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __param(3, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService,
        ebay_sell_account_api_service_js_1.EbaySellAccountApiService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EbayPaReturnPolicyService);
//# sourceMappingURL=ebay-pa-return-policy.service.js.map