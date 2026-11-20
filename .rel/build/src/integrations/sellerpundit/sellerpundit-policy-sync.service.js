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
var SellerpunditPolicySyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerpunditPolicySyncService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("../ebay/entities/connected-ebay-account.entity.js");
const ebay_business_policy_entity_js_1 = require("../ebay/entities/ebay-business-policy.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../ebay/entities/ebay-account-marketplace.entity.js");
const listing_action_log_writer_service_js_1 = require("../ebay/services/listing-action-log-writer.service.js");
const sellerpundit_auth_service_js_1 = require("./sellerpundit-auth.service.js");
const sellerpundit_http_client_js_1 = require("./sellerpundit-http.client.js");
const ebay_business_policy_util_js_1 = require("../ebay/services/ebay-business-policy.util.js");
let SellerpunditPolicySyncService = SellerpunditPolicySyncService_1 = class SellerpunditPolicySyncService {
    config;
    auth;
    http;
    accountRepo;
    policyRepo;
    mpRepo;
    logWriter;
    logger = new common_1.Logger(SellerpunditPolicySyncService_1.name);
    constructor(config, auth, http, accountRepo, policyRepo, mpRepo, logWriter) {
        this.config = config;
        this.auth = auth;
        this.http = http;
        this.accountRepo = accountRepo;
        this.policyRepo = policyRepo;
        this.mpRepo = mpRepo;
        this.logWriter = logWriter;
    }
    policyMaxAgeMs() {
        const hours = Number(this.config.get('SELLERPUNDIT_POLICY_SYNC_MAX_AGE_HOURS', 24));
        return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;
    }
    async ensurePoliciesFresh(ebayAccountId, organizationId, marketplaceId) {
        const account = await this.accountRepo.findOne({
            where: {
                id: ebayAccountId,
                organizationId,
                connectionSource: 'sellerpundit',
            },
        });
        if (!account) {
            throw new common_1.NotFoundException('SellerPundit eBay account not found');
        }
        const mpRow = await this.mpRepo.findOne({
            where: { ebayAccountId, marketplaceId },
        });
        const policyCount = await this.policyRepo.count({
            where: { ebayAccountId, marketplaceId },
        });
        const stale = !account.sellerpunditLastPolicySyncAt ||
            Date.now() - new Date(account.sellerpunditLastPolicySyncAt).getTime() >
                this.policyMaxAgeMs();
        const missingDefaults = !mpRow?.defaultFulfillmentPolicyId ||
            !mpRow?.defaultPaymentPolicyId ||
            !mpRow?.defaultReturnPolicyId ||
            !mpRow?.defaultInventoryLocationKey;
        const invalidDefaults = !(0, ebay_business_policy_util_js_1.hasValidDefaultPolicyIds)(mpRow);
        if (policyCount === 0 || stale || missingDefaults || invalidDefaults) {
            return this.syncPolicies(ebayAccountId, organizationId, null, marketplaceId);
        }
        return {
            ok: true,
            synced: policyCount,
            message: 'Policies are up to date',
        };
    }
    async syncPolicies(ebayAccountId, organizationId, userId, onlyMarketplaceId) {
        const account = await this.accountRepo.findOne({
            where: { id: ebayAccountId, organizationId },
            relations: ['marketplaces'],
        });
        if (!account)
            throw new common_1.NotFoundException('eBay account not found');
        if (account.connectionSource !== 'sellerpundit') {
            throw new common_1.NotFoundException('Account is not a SellerPundit connection');
        }
        if (!account.sellerpunditAccountName) {
            return {
                ok: false,
                synced: 0,
                message: 'Missing SellerPundit account name',
            };
        }
        let marketplaces = account.marketplaces ?? [];
        if (!marketplaces.length) {
            marketplaces = await this.mpRepo.find({ where: { ebayAccountId } });
        }
        if (onlyMarketplaceId) {
            marketplaces = marketplaces.filter((m) => m.marketplaceId === onlyMarketplaceId);
        }
        marketplaces = marketplaces.filter((m) => m.enabled);
        if (!marketplaces.length) {
            return {
                ok: false,
                synced: 0,
                message: 'No enabled marketplace rows for this account',
            };
        }
        const jwt = await this.auth.getJwt(organizationId);
        const accountName = account.sellerpunditAccountName;
        let synced = 0;
        for (const mp of marketplaces) {
            const [fulfill, payment, ret] = await Promise.all([
                this.fetchPolicies(jwt, accountName, 'shipping'),
                this.fetchPolicies(jwt, accountName, 'payment'),
                this.fetchPolicies(jwt, accountName, 'return'),
            ]);
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
            const fulfillPick = (0, ebay_business_policy_util_js_1.pickPolicyIdForMarketplace)(fulfill, mp.marketplaceId);
            const paymentPick = (0, ebay_business_policy_util_js_1.pickPolicyIdForMarketplace)(payment, mp.marketplaceId);
            const returnPick = (0, ebay_business_policy_util_js_1.pickReturnPolicyIdForListing)(ret.map((p) => ({
                ebayPolicyId: p.ebayPolicyId,
                isDefault: p.isDefault,
                geoSite: p.geoSite,
                rawPayload: p.raw,
            })), mp.marketplaceId);
            mp.defaultFulfillmentPolicyId = fulfillPick ?? null;
            mp.defaultPaymentPolicyId = paymentPick ?? null;
            mp.defaultReturnPolicyId = returnPick ?? null;
            await this.mpRepo.save(mp);
        }
        account.lastPoliciesFetchedCount = synced;
        account.sellerpunditLastPolicySyncAt = new Date();
        account.lastVerifiedAt = new Date();
        await this.accountRepo.save(account);
        await this.logWriter.write({
            organizationId,
            userId: userId ?? null,
            ebayAccountId,
            action: 'sellerpundit_policies_synced',
            result: 'success',
            afterSnapshot: {
                synced,
                marketplaces: marketplaces.map((m) => m.marketplaceId),
            },
        });
        return {
            ok: synced > 0,
            synced,
            message: `Synced ${synced} SellerPundit policy row(s).`,
        };
    }
    async fetchPolicies(jwt, accountName, policyType) {
        try {
            const raw = await this.http.get(jwt, '/master/get-all-policies', { accountName, policyType });
            const kind = policyType === 'shipping'
                ? 'fulfillment'
                : policyType === 'payment'
                    ? 'payment'
                    : 'return';
            return this.parsePolicies(raw, kind);
        }
        catch (e) {
            const msg = e instanceof common_1.HttpException
                ? (e.getResponse()?.message ?? e.message)
                : e.message;
            this.logger.error(`SP policies ${policyType} failed: ${msg}`);
            throw e;
        }
    }
    parsePolicies(raw, kind) {
        const list = this.unwrapArray(raw);
        const out = [];
        for (const item of list) {
            if (!item || typeof item !== 'object')
                continue;
            const o = item;
            const policyKind = kind ??
                (o.fulfillmentPolicyId != null || o.policyType === 'shipping'
                    ? 'fulfillment'
                    : o.paymentPolicyId != null
                        ? 'payment'
                        : 'return');
            const ebayPolicyId = (0, ebay_business_policy_util_js_1.extractEbayRestPolicyId)(o, policyKind);
            if (!ebayPolicyId)
                continue;
            out.push({
                ebayPolicyId,
                name: String(o.name ?? o.policyName ?? o.title ?? `Policy ${ebayPolicyId}`),
                raw: o,
                isDefault: Boolean(o.default ?? o.isDefault ?? o.is_default),
                geoSite: (0, ebay_business_policy_util_js_1.readPolicyGeoSite)(o),
            });
        }
        return out;
    }
    unwrapArray(raw) {
        if (Array.isArray(raw))
            return raw;
        if (raw && typeof raw === 'object') {
            const o = raw;
            if (Array.isArray(o.data))
                return o.data;
            if (Array.isArray(o.policies))
                return o.policies;
            if (o.data && typeof o.data === 'object') {
                const d = o.data;
                if (Array.isArray(d.policies))
                    return d.policies;
                if (Array.isArray(d.data))
                    return d.data;
            }
        }
        return [];
    }
};
exports.SellerpunditPolicySyncService = SellerpunditPolicySyncService;
exports.SellerpunditPolicySyncService = SellerpunditPolicySyncService = SellerpunditPolicySyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(4, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __param(5, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        sellerpundit_auth_service_js_1.SellerpunditAuthService,
        sellerpundit_http_client_js_1.SellerpunditHttpClient,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        listing_action_log_writer_service_js_1.ListingActionLogWriterService])
], SellerpunditPolicySyncService);
//# sourceMappingURL=sellerpundit-policy-sync.service.js.map