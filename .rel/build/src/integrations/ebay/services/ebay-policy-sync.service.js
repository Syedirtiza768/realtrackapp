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
var EbayPolicySyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayPolicySyncService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_business_policy_entity_js_1 = require("../entities/ebay-business-policy.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../entities/ebay-account-marketplace.entity.js");
const ebay_account_token_service_js_1 = require("./ebay-account-token.service.js");
const ebay_sell_account_api_service_js_1 = require("./ebay-sell-account-api.service.js");
const listing_action_log_writer_service_js_1 = require("./listing-action-log-writer.service.js");
const sellerpundit_policy_sync_service_js_1 = require("../../sellerpundit/sellerpundit-policy-sync.service.js");
const ebay_inventory_api_service_js_1 = require("../../../channels/ebay/ebay-inventory-api.service.js");
const ebay_auth_service_js_1 = require("../../../channels/ebay/ebay-auth.service.js");
const ebay_inventory_location_util_js_1 = require("../../../channels/ebay/ebay-inventory-location.util.js");
const ebay_business_policy_util_js_1 = require("./ebay-business-policy.util.js");
let EbayPolicySyncService = EbayPolicySyncService_1 = class EbayPolicySyncService {
    accountRepo;
    policyRepo;
    mpRepo;
    tokens;
    sellAccount;
    logWriter;
    sellerpunditPolicies;
    inventoryApi;
    ebayAuth;
    logger = new common_1.Logger(EbayPolicySyncService_1.name);
    constructor(accountRepo, policyRepo, mpRepo, tokens, sellAccount, logWriter, sellerpunditPolicies, inventoryApi, ebayAuth) {
        this.accountRepo = accountRepo;
        this.policyRepo = policyRepo;
        this.mpRepo = mpRepo;
        this.tokens = tokens;
        this.sellAccount = sellAccount;
        this.logWriter = logWriter;
        this.sellerpunditPolicies = sellerpunditPolicies;
        this.inventoryApi = inventoryApi;
        this.ebayAuth = ebayAuth;
    }
    baseUrl(env) {
        return env === 'production'
            ? 'https://api.ebay.com'
            : 'https://api.sandbox.ebay.com';
    }
    async syncPolicies(ebayAccountId, organizationId, userId) {
        this.logger.log(`syncPolicies START account=${ebayAccountId}`);
        try {
            const result = await this._syncPoliciesInner(ebayAccountId, organizationId, userId);
            this.logger.log(`syncPolicies DONE account=${ebayAccountId} ok=${result.ok} synced=${result.synced}`);
            return result;
        }
        catch (err) {
            this.logger.error(`syncPolicies FAILED account=${ebayAccountId}: ${err instanceof Error ? err.message : err}`);
            throw err;
        }
    }
    async _syncPoliciesInner(ebayAccountId, organizationId, userId) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId, organizationId },
        });
        if (!account) {
            throw new common_1.NotFoundException('eBay account not found');
        }
        if (account.connectionSource === 'sellerpundit') {
            const spResult = await this.sellerpunditPolicies.syncPolicies(ebayAccountId, organizationId, userId);
            const overlaySynced = await this.overlaySellerpunditPoliciesFromEbayApi(account);
            await this.hydrateInventoryLocationsFromStore(account);
            return {
                ...spResult,
                synced: spResult.synced + overlaySynced,
                message: overlaySynced > 0
                    ? `${spResult.message} Overlaid ${overlaySynced} row(s) from eBay Account API.`
                    : spResult.message,
            };
        }
        const rel = account.marketplaces ?? [];
        let marketplaces = rel.length
            ? rel
            : await this.mpRepo.find({ where: { ebayAccountId } });
        marketplaces = marketplaces.filter((m) => m.enabled);
        if (!marketplaces.length) {
            return {
                ok: false,
                synced: 0,
                message: 'No enabled marketplace rows for this account — connect OAuth with a marketplace first.',
            };
        }
        const token = await this.tokens.getValidAccessToken(ebayAccountId);
        const baseUrl = this.baseUrl(account.environment);
        let synced = 0;
        for (const mp of marketplaces) {
            let fulfill = [];
            let payment = [];
            let ret = [];
            try {
                [fulfill, payment, ret] = await Promise.all([
                    this.sellAccount.listFulfillmentPolicies(token, baseUrl, mp.marketplaceId),
                    this.sellAccount.listPaymentPolicies(token, baseUrl, mp.marketplaceId),
                    this.sellAccount.listReturnPolicies(token, baseUrl, mp.marketplaceId),
                ]);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`Policy fetch failed for account=${ebayAccountId} mp=${mp.marketplaceId}: ${msg}`);
                throw err;
            }
            await this.policyRepo.manager.transaction(async (trx) => {
                await trx.delete(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                    ebayAccountId,
                    marketplaceId: mp.marketplaceId,
                });
                for (const p of fulfill) {
                    await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                        ebayAccountId,
                        marketplaceId: mp.marketplaceId,
                        policyType: 'fulfillment',
                        ebayPolicyId: p.ebayPolicyId,
                        name: p.name,
                        rawPayload: p.raw,
                        isDefault: p.isDefault,
                    }));
                    synced++;
                }
                for (const p of payment) {
                    await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                        ebayAccountId,
                        marketplaceId: mp.marketplaceId,
                        policyType: 'payment',
                        ebayPolicyId: p.ebayPolicyId,
                        name: p.name,
                        rawPayload: p.raw,
                        isDefault: p.isDefault,
                    }));
                    synced++;
                }
                for (const p of ret) {
                    await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                        ebayAccountId,
                        marketplaceId: mp.marketplaceId,
                        policyType: 'return',
                        ebayPolicyId: p.ebayPolicyId,
                        name: p.name,
                        rawPayload: p.raw,
                        isDefault: p.isDefault,
                    }));
                    synced++;
                }
            });
            let locations = [];
            let locationsTimeout;
            try {
                locations = await Promise.race([
                    this.sellAccount.listInventoryLocations(token, baseUrl, mp.marketplaceId),
                    new Promise((_, reject) => {
                        locationsTimeout = setTimeout(() => reject(new Error('Inventory locations fetch timed out (30s)')), 30_000);
                    }),
                ]);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Inventory locations fetch failed account=${ebayAccountId} mp=${mp.marketplaceId}: ${msg}`);
            }
            finally {
                clearTimeout(locationsTimeout);
            }
            const pick = (items) => items.find((x) => x.isDefault)?.ebayPolicyId ??
                items[0]?.ebayPolicyId ??
                null;
            if (!mp.defaultFulfillmentPolicyId) {
                mp.defaultFulfillmentPolicyId = pick(fulfill);
            }
            if (!mp.defaultPaymentPolicyId) {
                mp.defaultPaymentPolicyId = pick(payment);
            }
            if (!mp.defaultReturnPolicyId) {
                mp.defaultReturnPolicyId = pick(ret);
            }
            if (!mp.defaultInventoryLocationKey && locations.length) {
                mp.defaultInventoryLocationKey =
                    (0, ebay_inventory_location_util_js_1.pickPreferredInventoryLocationKey)(locations) ??
                        locations[0].merchantLocationKey;
            }
            await this.mpRepo.save(mp);
        }
        account.lastVerifiedAt = new Date();
        account.lastPoliciesFetchedCount = synced;
        await this.accountRepo.save(account);
        const stillMissingLocation = (await this.mpRepo.find({ where: { ebayAccountId } })).some((row) => !row.defaultInventoryLocationKey);
        if (stillMissingLocation) {
            await this.hydrateInventoryLocationsFromStore(account);
        }
        await this.logWriter.write({
            organizationId,
            userId: userId ?? null,
            ebayAccountId,
            action: 'ebay_policies_synced',
            result: 'success',
            afterSnapshot: {
                synced,
                marketplaces: marketplaces.map((m) => m.marketplaceId),
            },
        });
        return {
            ok: true,
            synced,
            message: `Synced ${synced} policy rows across ${marketplaces.length} marketplace(s).`,
        };
    }
    async overlaySellerpunditPoliciesFromEbayApi(account) {
        if (!account.primaryStoreId)
            return 0;
        let token;
        try {
            token = await this.ebayAuth.getAccessToken(account.primaryStoreId, {
                forceRefresh: true,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`SellerPundit Account API policy overlay skipped (token): ${msg}`);
            return 0;
        }
        const baseUrl = this.baseUrl(account.environment);
        const marketplaces = await this.mpRepo.find({
            where: { ebayAccountId: account.id, enabled: true },
        });
        let synced = 0;
        for (const mp of marketplaces) {
            try {
                const [fulfill, payment, ret] = await Promise.all([
                    this.sellAccount.listFulfillmentPolicies(token, baseUrl, mp.marketplaceId),
                    this.sellAccount.listPaymentPolicies(token, baseUrl, mp.marketplaceId),
                    this.sellAccount.listReturnPolicies(token, baseUrl, mp.marketplaceId),
                ]);
                if (!fulfill.length && !payment.length && !ret.length)
                    continue;
                await this.policyRepo.manager.transaction(async (trx) => {
                    await trx.delete(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                        ebayAccountId: account.id,
                        marketplaceId: mp.marketplaceId,
                    });
                    for (const p of fulfill) {
                        if (!(0, ebay_business_policy_util_js_1.isLikelyEbayRestPolicyId)(p.ebayPolicyId))
                            continue;
                        await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                            ebayAccountId: account.id,
                            marketplaceId: mp.marketplaceId,
                            policyType: 'fulfillment',
                            ebayPolicyId: p.ebayPolicyId,
                            name: p.name,
                            rawPayload: p.raw,
                            isDefault: p.isDefault,
                        }));
                        synced++;
                    }
                    for (const p of payment) {
                        if (!(0, ebay_business_policy_util_js_1.isLikelyEbayRestPolicyId)(p.ebayPolicyId))
                            continue;
                        await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                            ebayAccountId: account.id,
                            marketplaceId: mp.marketplaceId,
                            policyType: 'payment',
                            ebayPolicyId: p.ebayPolicyId,
                            name: p.name,
                            rawPayload: p.raw,
                            isDefault: p.isDefault,
                        }));
                        synced++;
                    }
                    for (const p of ret) {
                        if (!(0, ebay_business_policy_util_js_1.isLikelyEbayRestPolicyId)(p.ebayPolicyId))
                            continue;
                        await trx.save(trx.create(ebay_business_policy_entity_js_1.EbayBusinessPolicy, {
                            ebayAccountId: account.id,
                            marketplaceId: mp.marketplaceId,
                            policyType: 'return',
                            ebayPolicyId: p.ebayPolicyId,
                            name: p.name,
                            rawPayload: p.raw,
                            isDefault: p.isDefault,
                        }));
                        synced++;
                    }
                });
                const pick = (items) => items.find((x) => x.isDefault)?.ebayPolicyId ??
                    items[0]?.ebayPolicyId;
                const fulfillmentPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(pick(fulfill));
                const paymentPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)(pick(payment));
                const returnPolicyId = (0, ebay_business_policy_util_js_1.coalesceValidPolicyId)((0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(ret.map((r) => ({
                    ebayPolicyId: r.ebayPolicyId,
                    isDefault: r.isDefault,
                    geoSite: null,
                    rawPayload: r.raw,
                })), mp.marketplaceId));
                if (fulfillmentPolicyId) {
                    mp.defaultFulfillmentPolicyId = fulfillmentPolicyId;
                }
                if (paymentPolicyId)
                    mp.defaultPaymentPolicyId = paymentPolicyId;
                if (returnPolicyId)
                    mp.defaultReturnPolicyId = returnPolicyId;
                await this.mpRepo.save(mp);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Account API policy overlay failed for ${mp.marketplaceId}: ${msg}`);
            }
        }
        return synced;
    }
    async hydrateInventoryLocationsFromStore(account) {
        if (!account.primaryStoreId)
            return;
        const key = await this.inventoryApi.ensureMerchantLocation(account.primaryStoreId);
        if (!key)
            return;
        const marketplaces = await this.mpRepo.find({
            where: { ebayAccountId: account.id },
        });
        for (const mp of marketplaces) {
            if (!mp.defaultInventoryLocationKey) {
                mp.defaultInventoryLocationKey = key;
                await this.mpRepo.save(mp);
            }
        }
    }
};
exports.EbayPolicySyncService = EbayPolicySyncService;
exports.EbayPolicySyncService = EbayPolicySyncService = EbayPolicySyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_account_token_service_js_1.EbayAccountTokenService,
        ebay_sell_account_api_service_js_1.EbaySellAccountApiService,
        listing_action_log_writer_service_js_1.ListingActionLogWriterService,
        sellerpundit_policy_sync_service_js_1.SellerpunditPolicySyncService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_auth_service_js_1.EbayAuthService])
], EbayPolicySyncService);
//# sourceMappingURL=ebay-policy-sync.service.js.map