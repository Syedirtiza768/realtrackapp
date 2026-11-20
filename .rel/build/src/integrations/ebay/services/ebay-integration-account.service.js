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
exports.EbayIntegrationAccountService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_business_policy_entity_js_1 = require("../entities/ebay-business-policy.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../entities/ebay-account-marketplace.entity.js");
const listing_action_log_writer_service_js_1 = require("./listing-action-log-writer.service.js");
const ebay_inventory_location_util_js_1 = require("../../../channels/ebay/ebay-inventory-location.util.js");
let EbayIntegrationAccountService = class EbayIntegrationAccountService {
    accountRepo;
    policyRepo;
    mpRepo;
    logWriter;
    constructor(accountRepo, policyRepo, mpRepo, logWriter) {
        this.accountRepo = accountRepo;
        this.policyRepo = policyRepo;
        this.mpRepo = mpRepo;
        this.logWriter = logWriter;
    }
    async listForOrganization(organizationId) {
        const rows = await this.accountRepo.find({
            where: { organizationId },
            relations: ['marketplaces'],
            order: { createdAt: 'DESC' },
        });
        return rows.map((a) => ({
            id: a.id,
            organizationId: a.organizationId,
            internalStoreId: a.internalStoreId,
            ebayUserId: a.ebayUserId,
            ebayUsername: a.ebayUsername,
            accountDisplayName: a.accountDisplayName,
            environment: a.environment,
            connectionStatus: a.connectionStatus,
            connectedAt: a.connectedAt,
            lastVerifiedAt: a.lastVerifiedAt,
            lastSuccessfulSyncAt: a.lastSuccessfulSyncAt,
            lastTokenRefreshAt: a.lastTokenRefreshAt,
            lastErrorMessage: a.lastErrorMessage,
            lastListingsFetchedCount: a.lastListingsFetchedCount,
            lastPoliciesFetchedCount: a.lastPoliciesFetchedCount,
            primaryStoreId: a.primaryStoreId,
            connectionSource: a.connectionSource ?? 'native_oauth',
            sellerpunditTokenId: a.sellerpunditTokenId,
            sellerpunditAccountName: a.sellerpunditAccountName,
            sellerpunditLastSyncAt: a.sellerpunditLastSyncAt,
            sellerpunditLastPolicySyncAt: a.sellerpunditLastPolicySyncAt,
            marketplaces: (a.marketplaces ?? []).map((m) => ({
                id: m.id,
                marketplaceId: m.marketplaceId,
                currency: m.currency,
                locale: m.locale,
                enabled: m.enabled,
                defaultPaymentPolicyId: m.defaultPaymentPolicyId,
                defaultReturnPolicyId: m.defaultReturnPolicyId,
                defaultFulfillmentPolicyId: m.defaultFulfillmentPolicyId,
                defaultInventoryLocationKey: m.defaultInventoryLocationKey,
            })),
        }));
    }
    async getOne(id, organizationId) {
        const a = await this.accountRepo.findOne({
            where: { id, organizationId },
            relations: ['marketplaces'],
        });
        if (!a)
            throw new common_1.NotFoundException('Account not found');
        return {
            id: a.id,
            organizationId: a.organizationId,
            internalStoreId: a.internalStoreId,
            ebayUserId: a.ebayUserId,
            ebayUsername: a.ebayUsername,
            accountDisplayName: a.accountDisplayName,
            environment: a.environment,
            connectionStatus: a.connectionStatus,
            connectedAt: a.connectedAt,
            lastVerifiedAt: a.lastVerifiedAt,
            lastSuccessfulSyncAt: a.lastSuccessfulSyncAt,
            lastTokenRefreshAt: a.lastTokenRefreshAt,
            lastErrorMessage: a.lastErrorMessage,
            lastListingsFetchedCount: a.lastListingsFetchedCount,
            lastPoliciesFetchedCount: a.lastPoliciesFetchedCount,
            primaryStoreId: a.primaryStoreId,
            connectionSource: a.connectionSource ?? 'native_oauth',
            sellerpunditTokenId: a.sellerpunditTokenId,
            sellerpunditAccountName: a.sellerpunditAccountName,
            sellerpunditLastSyncAt: a.sellerpunditLastSyncAt,
            sellerpunditLastPolicySyncAt: a.sellerpunditLastPolicySyncAt,
            marketplaces: (a.marketplaces ?? []).map((m) => ({
                id: m.id,
                marketplaceId: m.marketplaceId,
                currency: m.currency,
                locale: m.locale,
                enabled: m.enabled,
                defaultPaymentPolicyId: m.defaultPaymentPolicyId,
                defaultReturnPolicyId: m.defaultReturnPolicyId,
                defaultFulfillmentPolicyId: m.defaultFulfillmentPolicyId,
                defaultInventoryLocationKey: m.defaultInventoryLocationKey,
            })),
        };
    }
    async getPolicies(id, organizationId) {
        await this.getOne(id, organizationId);
        const policies = await this.policyRepo.find({
            where: { ebayAccountId: id },
            order: { marketplaceId: 'ASC', policyType: 'ASC', name: 'ASC' },
        });
        return {
            policies: policies.map((p) => ({
                id: p.id,
                marketplaceId: p.marketplaceId,
                policyType: p.policyType,
                ebayPolicyId: p.ebayPolicyId,
                name: p.name,
                isDefault: p.isDefault,
            })),
        };
    }
    async patchDefaultPolicies(id, organizationId, body, meta) {
        await this.getOne(id, organizationId);
        const mp = await this.mpRepo.findOne({
            where: { ebayAccountId: id, marketplaceId: body.marketplaceId },
        });
        if (!mp) {
            throw new common_1.NotFoundException('Marketplace row not found for this account');
        }
        const before = {
            defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
            defaultReturnPolicyId: mp.defaultReturnPolicyId,
            defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
            defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
        };
        if (body.defaultPaymentPolicyId !== undefined) {
            mp.defaultPaymentPolicyId = body.defaultPaymentPolicyId?.trim() || null;
        }
        if (body.defaultReturnPolicyId !== undefined) {
            mp.defaultReturnPolicyId = body.defaultReturnPolicyId?.trim() || null;
        }
        if (body.defaultFulfillmentPolicyId !== undefined) {
            mp.defaultFulfillmentPolicyId =
                body.defaultFulfillmentPolicyId?.trim() || null;
        }
        if (body.defaultInventoryLocationKey !== undefined) {
            const requestedLocationKey = body.defaultInventoryLocationKey?.trim() || null;
            mp.defaultInventoryLocationKey = (0, ebay_inventory_location_util_js_1.isLegacyDefaultMerchantLocationKey)(requestedLocationKey)
                ? ebay_inventory_location_util_js_1.DEFAULT_MERCHANT_LOCATION_KEY
                : requestedLocationKey;
        }
        await this.mpRepo.save(mp);
        await this.logWriter.write({
            organizationId,
            userId: meta?.userId ?? null,
            ebayAccountId: id,
            marketplaceId: body.marketplaceId,
            action: 'ebay_default_policies_updated',
            result: 'success',
            beforeSnapshot: before,
            afterSnapshot: {
                defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
                defaultReturnPolicyId: mp.defaultReturnPolicyId,
                defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
                defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
            },
            ipAddress: meta?.ip ?? null,
            userAgent: meta?.userAgent ?? null,
        });
        return this.getOne(id, organizationId);
    }
    async patch(id, organizationId, patch) {
        const a = await this.accountRepo.findOne({ where: { id, organizationId } });
        if (!a)
            throw new common_1.NotFoundException('Account not found');
        if (patch.accountDisplayName != null) {
            a.accountDisplayName = patch.accountDisplayName;
        }
        if (patch.connectionStatus != null) {
            a.connectionStatus = patch.connectionStatus;
        }
        return this.accountRepo.save(a);
    }
    async disconnect(id, organizationId, userId, meta) {
        const a = await this.accountRepo.findOne({ where: { id, organizationId } });
        if (!a)
            throw new common_1.NotFoundException('Account not found');
        a.connectionStatus = 'disabled';
        await this.accountRepo.save(a);
        await this.logWriter.write({
            organizationId,
            userId,
            ebayAccountId: a.id,
            action: 'ebay_account_disconnected',
            result: 'success',
            ipAddress: meta?.ip ?? null,
            userAgent: meta?.userAgent ?? null,
        });
        return { ok: true };
    }
};
exports.EbayIntegrationAccountService = EbayIntegrationAccountService;
exports.EbayIntegrationAccountService = EbayIntegrationAccountService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __param(2, (0, typeorm_1.InjectRepository)(ebay_account_marketplace_entity_js_1.EbayAccountMarketplace)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        listing_action_log_writer_service_js_1.ListingActionLogWriterService])
], EbayIntegrationAccountService);
//# sourceMappingURL=ebay-integration-account.service.js.map