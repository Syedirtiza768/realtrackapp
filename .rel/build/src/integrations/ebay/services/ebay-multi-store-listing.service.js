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
exports.EbayMultiStoreListingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const typeorm_2 = require("typeorm");
const ebay_listing_job_entity_js_1 = require("../entities/ebay-listing-job.entity.js");
const ebay_listing_job_target_entity_js_1 = require("../entities/ebay-listing-job-target.entity.js");
const ebay_listing_validation_service_js_1 = require("./ebay-listing-validation.service.js");
const catalog_publish_resolver_service_js_1 = require("./catalog-publish-resolver.service.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_trading_quota_service_js_1 = require("./ebay-trading-quota.service.js");
const MAX_BULK_LISTINGS = 500;
const MAX_DAILY_PUBLISH_TARGETS = 5_000;
const TRADING_CALL_RESERVE = 100;
function targetPolicyOverrides(target) {
    const values = {
        fulfillmentPolicyId: target.fulfillmentPolicyId,
        paymentPolicyId: target.paymentPolicyId,
        returnPolicyId: target.returnPolicyId,
        merchantLocationKey: target.merchantLocationKey,
        requestedFulfillmentPolicyName: target.requestedFulfillmentPolicyName,
        requestedPaymentPolicyName: target.requestedPaymentPolicyName,
        requestedReturnPolicyName: target.requestedReturnPolicyName,
    };
    return Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === 'string' && value.trim()));
}
let EbayMultiStoreListingService = class EbayMultiStoreListingService {
    jobRepo;
    targetRepo;
    accountRepo;
    config;
    validation;
    publishResolver;
    publishQueue;
    tradingQuota;
    constructor(jobRepo, targetRepo, accountRepo, config, validation, publishResolver, publishQueue, tradingQuota) {
        this.jobRepo = jobRepo;
        this.targetRepo = targetRepo;
        this.accountRepo = accountRepo;
        this.config = config;
        this.validation = validation;
        this.publishResolver = publishResolver;
        this.publishQueue = publishQueue;
        this.tradingQuota = tradingQuota;
    }
    dailyTargetLimit() {
        const configured = Number(this.config.get('EBAY_DAILY_PUBLISH_TARGET_LIMIT', '5000'));
        if (!Number.isFinite(configured))
            return MAX_DAILY_PUBLISH_TARGETS;
        return Math.min(MAX_DAILY_PUBLISH_TARGETS, Math.max(1, Math.floor(configured)));
    }
    async countTodayTargets(organizationId) {
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0);
        return this.targetRepo
            .createQueryBuilder('target')
            .innerJoin(ebay_listing_job_entity_js_1.EbayListingJob, 'job', 'job.id = target.listingJobId')
            .where('job.organizationId = :organizationId', { organizationId })
            .andWhere('job.jobType = :jobType', { jobType: 'publish' })
            .andWhere('target.createdAt >= :dayStart', { dayStart })
            .getCount();
    }
    async assertTradingCapacity(requestedNativeTargets) {
        if (!requestedNativeTargets)
            return;
        const quota = await this.tradingQuota.getPublishCapacity();
        const inFlight = await this.targetRepo
            .createQueryBuilder('target')
            .where('target.status IN (:...statuses)', {
            statuses: ['pending', 'processing'],
        })
            .getCount();
        if (requestedNativeTargets + inFlight + TRADING_CALL_RESERVE > quota.remaining) {
            throw new common_1.BadRequestException(`eBay Trading API allowance is low (${quota.remaining} call(s) remaining, ` +
                `${inFlight} publish target(s) already queued). Publishing is paused ` +
                `until the allowance resets at ${quota.reset.toISOString()}.`);
        }
    }
    async createBulkPublishJob(input) {
        const listingIds = [...new Set(input.listingIds)];
        const storeIds = [...new Set(input.storeIds)];
        if (!listingIds.length || !storeIds.length) {
            throw new common_1.BadRequestException('At least one listing and one target store are required');
        }
        if (listingIds.length > MAX_BULK_LISTINGS) {
            throw new common_1.BadRequestException(`A single bulk publish job supports at most ${MAX_BULK_LISTINGS} listings`);
        }
        if (input.idempotencyKey) {
            const existing = await this.jobRepo.findOne({
                where: {
                    organizationId: input.organizationId,
                    idempotencyKey: input.idempotencyKey,
                },
            });
            if (existing) {
                const targetCount = await this.targetRepo.count({
                    where: { listingJobId: existing.id },
                });
                const dailyUsed = await this.countTodayTargets(input.organizationId);
                return {
                    job: existing,
                    targetCount,
                    dailyLimit: this.dailyTargetLimit(),
                    dailyUsed,
                    skipped: [],
                };
            }
        }
        const accounts = await this.accountRepo.find({
            where: {
                organizationId: input.organizationId,
                primaryStoreId: (0, typeorm_2.In)(storeIds),
                connectionStatus: 'active',
            },
            relations: ['primaryStore', 'marketplaces'],
        });
        const accountByStore = new Map(accounts.map((account) => [account.primaryStoreId, account]));
        const missingStores = storeIds.filter((id) => !accountByStore.has(id));
        if (missingStores.length) {
            throw new common_1.BadRequestException(`${missingStores.length} selected store(s) are not active eBay stores in this organization`);
        }
        for (const [storeId, marketplaceId] of Object.entries(input.marketplaceByStore ?? {})) {
            const account = accountByStore.get(storeId);
            if (!account?.marketplaces?.some((marketplace) => marketplace.enabled && marketplace.marketplaceId === marketplaceId)) {
                throw new common_1.BadRequestException('The requested marketplace is not enabled for the selected eBay store');
            }
        }
        const resolvedProducts = [];
        const skipped = [];
        for (const listingId of listingIds) {
            const resolved = await this.publishResolver.resolve(listingId);
            if (!resolved) {
                skipped.push({
                    listingId,
                    reason: `Catalog product or listing record ${listingId} was not found`,
                });
                continue;
            }
            resolvedProducts.push({
                sourceListingId: listingId,
                catalogProductId: resolved.snapshot.catalogProductId,
                vertical: resolved.snapshot.vertical ?? 'automotive',
            });
        }
        if (!resolvedProducts.length) {
            throw new common_1.BadRequestException(`None of the ${listingIds.length} selected listing(s) could be resolved to a catalog product`);
        }
        const requestedTargets = resolvedProducts.length * accounts.length;
        const dailyLimit = this.dailyTargetLimit();
        const dailyUsed = await this.countTodayTargets(input.organizationId);
        if (dailyUsed + requestedTargets > dailyLimit) {
            throw new common_1.BadRequestException(`Daily eBay publish limit exceeded: ${dailyUsed} target(s) already submitted, ${requestedTargets} requested, ${dailyLimit} maximum.`);
        }
        const requestedNativeTargets = resolvedProducts.length *
            accounts.filter((account) => account.connectionSource === 'native_oauth')
                .length;
        await this.assertTradingCapacity(requestedNativeTargets);
        const savedJob = await this.jobRepo.save(this.jobRepo.create({
            organizationId: input.organizationId,
            requestedByUserId: input.requestedByUserId,
            jobType: 'publish',
            status: 'pending',
            idempotencyKey: input.idempotencyKey ?? null,
        }));
        const targets = resolvedProducts.flatMap((product) => accounts.map((account) => {
            const storePolicyOverrides = targetPolicyOverrides(input.policyOverridesByStore?.[account.primaryStoreId] ?? input.policyOverrides ?? {});
            return this.targetRepo.create({
                listingJobId: savedJob.id,
                catalogProductId: product.catalogProductId,
                ebayAccountId: account.id,
                vertical: product.vertical,
                marketplaceId: input.marketplaceByStore?.[account.primaryStoreId] ??
                    account.primaryStore?.ebayMarketplaceId ??
                    (typeof account.primaryStore?.config?.marketplace === 'string'
                        ? account.primaryStore.config.marketplace
                        : 'EBAY_US'),
                status: 'pending',
                resultPayload: {
                    sourceListingId: product.sourceListingId,
                    ...(Object.keys(storePolicyOverrides).length
                        ? { policyOverrides: storePolicyOverrides }
                        : {}),
                },
            });
        }));
        const savedTargets = await this.targetRepo.save(targets, { chunk: 500 });
        await this.publishQueue.addBulk(savedTargets.map((target) => ({
            name: 'publish-target',
            data: { targetId: target.id },
            opts: {
                attempts: 4,
                backoff: { type: 'exponential', delay: 2_000 },
                removeOnComplete: 500,
                removeOnFail: 500,
            },
        })));
        return {
            job: savedJob,
            targetCount: savedTargets.length,
            dailyLimit,
            dailyUsed: dailyUsed + savedTargets.length,
            skipped,
        };
    }
    async resolveCanonicalProductId(productRefId) {
        const resolved = await this.publishResolver.resolve(productRefId);
        if (!resolved) {
            throw new common_1.BadRequestException('Catalog product or listing record not found');
        }
        return resolved.snapshot.catalogProductId;
    }
    async validateTargets(input) {
        const results = [];
        for (const t of input.targets) {
            const key = `${t.ebayAccountId}:${t.marketplaceId}`;
            const v = await this.validation.validatePublish({
                organizationId: input.organizationId,
                catalogProductId: input.catalogProductId,
                ebayAccountId: t.ebayAccountId,
                marketplaceId: t.marketplaceId,
                policyOverrides: targetPolicyOverrides(t),
            });
            results.push({ key, ...v });
        }
        return { results };
    }
    async createPublishJob(input) {
        if (!input.targets.length) {
            throw new common_1.BadRequestException('At least one target store is required');
        }
        const canonicalProductId = await this.resolveCanonicalProductId(input.catalogProductId);
        const source = await this.publishResolver.resolve(input.sourceListingId ?? input.catalogProductId);
        const vertical = source?.snapshot.vertical ?? 'automotive';
        const eligible = [];
        const skipped = [];
        for (const t of input.targets) {
            const v = await this.validation.validatePublish({
                organizationId: input.organizationId,
                catalogProductId: input.catalogProductId,
                ebayAccountId: t.ebayAccountId,
                marketplaceId: t.marketplaceId,
                policyOverrides: targetPolicyOverrides(t),
            });
            if (v.status === 'blocked') {
                skipped.push({
                    ebayAccountId: t.ebayAccountId,
                    marketplaceId: t.marketplaceId,
                    errors: v.errors,
                });
            }
            else {
                eligible.push(t);
            }
        }
        if (!eligible.length) {
            const detail = skipped
                .flatMap((row) => row.errors)
                .filter((message) => typeof message === 'string' && message.trim())
                .slice(0, 8)
                .join('; ');
            throw new common_1.BadRequestException({
                message: detail
                    ? `No targets passed validation — ${detail}`
                    : 'No targets passed validation — fix errors or deselect blocked stores.',
                failures: skipped,
            });
        }
        if (input.idempotencyKey) {
            const existing = await this.jobRepo.findOne({
                where: {
                    organizationId: input.organizationId,
                    idempotencyKey: input.idempotencyKey,
                },
            });
            if (existing)
                return { job: existing, skipped: [] };
        }
        const nativeAccounts = await this.accountRepo.find({
            where: {
                organizationId: input.organizationId,
                id: (0, typeorm_2.In)(eligible.map((target) => target.ebayAccountId)),
                connectionSource: 'native_oauth',
            },
        });
        await this.assertTradingCapacity(eligible.filter((target) => nativeAccounts.some((account) => account.id === target.ebayAccountId)).length);
        const job = this.jobRepo.create({
            organizationId: input.organizationId,
            requestedByUserId: input.requestedByUserId,
            jobType: 'publish',
            status: 'pending',
            idempotencyKey: input.idempotencyKey ?? null,
        });
        const savedJob = await this.jobRepo.save(job);
        const targets = [];
        for (const t of eligible) {
            const row = this.targetRepo.create({
                listingJobId: savedJob.id,
                catalogProductId: canonicalProductId,
                vertical,
                ebayAccountId: t.ebayAccountId,
                marketplaceId: t.marketplaceId,
                status: 'pending',
                resultPayload: {
                    sourceListingId: input.sourceListingId ?? input.catalogProductId,
                    ...(Object.keys(targetPolicyOverrides(t)).length
                        ? { policyOverrides: targetPolicyOverrides(t) }
                        : {}),
                },
            });
            targets.push(await this.targetRepo.save(row));
        }
        for (const t of targets) {
            await this.publishQueue.add('publish-target', { targetId: t.id }, { removeOnComplete: 100, removeOnFail: 50 });
        }
        return { job: savedJob, skipped };
    }
    async getJob(jobId, organizationId) {
        const job = await this.jobRepo.findOne({
            where: { id: jobId, organizationId },
        });
        if (!job)
            throw new common_1.NotFoundException('Job not found');
        return job;
    }
    async getJobTargets(jobId, organizationId) {
        const job = await this.getJob(jobId, organizationId);
        const rows = await this.targetRepo.find({
            where: { listingJobId: job.id },
            relations: ['ebayAccount', 'ebayAccount.primaryStore'],
            order: { createdAt: 'ASC' },
        });
        return rows.map((t) => {
            const payload = t.errorPayload;
            const directMessage = typeof payload?.message === 'string' && payload.message.trim() ? payload.message.trim() : null;
            const errorMessage = directMessage || (Array.isArray(payload?.errors)
                ? payload.errors.map((error) => typeof error === 'string' ? error : error?.message).filter((message) => typeof message === 'string' && message.trim().length > 0).join('; ') || null
                : null);
            return {
                id: t.id,
                catalogProductId: t.catalogProductId,
                ebayAccountId: t.ebayAccountId,
                marketplaceId: t.marketplaceId,
                vertical: t.vertical,
                storeId: t.ebayAccount?.primaryStoreId ?? null,
                storeName: t.ebayAccount?.primaryStore?.storeName ?? null,
                status: t.status,
                resultPayload: t.resultPayload,
                errorPayload: t.errorPayload,
                errorMessage,
                lastErrorMessage: errorMessage,
            };
        });
    }
};
exports.EbayMultiStoreListingService = EbayMultiStoreListingService;
exports.EbayMultiStoreListingService = EbayMultiStoreListingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_listing_job_entity_js_1.EbayListingJob)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_listing_job_target_entity_js_1.EbayListingJobTarget)),
    __param(2, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(6, (0, bullmq_1.InjectQueue)('ebay-listing-publish')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        ebay_listing_validation_service_js_1.EbayListingValidationService,
        catalog_publish_resolver_service_js_1.CatalogPublishResolverService, Function, ebay_trading_quota_service_js_1.EbayTradingQuotaService])
], EbayMultiStoreListingService);
//# sourceMappingURL=ebay-multi-store-listing.service.js.map