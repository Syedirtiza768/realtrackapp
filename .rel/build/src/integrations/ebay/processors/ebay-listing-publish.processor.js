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
var EbayListingPublishProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayListingPublishProcessor = void 0;
exports.isTransientPublishFailure = isTransientPublishFailure;
exports.extractExistingEbayListingId = extractExistingEbayListingId;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const fashion_listings_service_js_1 = require("../../../verticals/fashion-listings.service.js");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const ebay_listing_job_target_entity_js_1 = require("../entities/ebay-listing-job-target.entity.js");
const ebay_listing_job_entity_js_1 = require("../entities/ebay-listing-job.entity.js");
const connected_ebay_account_entity_js_1 = require("../entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../entities/ebay-listing-channel.entity.js");
const ebay_listing_validation_service_js_1 = require("../services/ebay-listing-validation.service.js");
const listing_builder_service_js_1 = require("../services/listing-builder.service.js");
const catalog_publish_resolver_service_js_1 = require("../services/catalog-publish-resolver.service.js");
const ebay_publish_service_js_1 = require("../../../channels/ebay/ebay-publish.service.js");
const ebay_publish_quantity_util_js_1 = require("../../../channels/ebay/ebay-publish-quantity.util.js");
const store_entity_js_1 = require("../../../channels/entities/store.entity.js");
class RetriablePublishError extends Error {
}
function isTransientPublishFailure(message) {
    const normalized = message.toLowerCase();
    const permanentMarkers = [
        '21919474',
        '21919233',
        'inventory-based listing management is not currently supported',
        'already have on ebay',
        'identical items from the same seller',
        'selling limit',
        'only approved sellers',
        'do not relist',
        'policy violation',
        'policy restriction',
        'airbag',
        'mis-categor',
        'select a different category',
        'invalid category',
        'invalid item condition',
        'missing business policy',
        'sku collision',
        'srm_his_wh_location_mismatch_inventory_block',
        '1276646',
        'forward-deployed item',
        'forward deployed item',
        'overseas warehouse block policy',
        'overseas-warehouse-block-policy-authorization',
        'different from your registered address',
        'shipping from overseas warehouses',
        'ship from overseas warehouses',
        'verify ebay before retrying',
    ];
    if (permanentMarkers.some((marker) => normalized.includes(marker))) {
        return false;
    }
    return [
        'product not found',
        'availability not found',
        'this offer is not available',
        '25713',
        'cannot revise listing',
        'try again later',
        'core inventory service internal error',
        'status code 500',
        'status code 502',
        'status code 503',
        'status code 504',
        'temporarily unavailable',
        'service unavailable',
        'connection reset',
        'socket hang up',
        'upstream connect error',
        'timed out',
        'timeout',
        'rate limit',
        'too many requests',
    ].some((marker) => normalized.includes(marker));
}
function extractExistingEbayListingId(message) {
    if (!/already have on eBay/i.test(message))
        return null;
    return message.match(/\((\d{9,})\)/)?.[1] ?? null;
}
let EbayListingPublishProcessor = EbayListingPublishProcessor_1 = class EbayListingPublishProcessor extends bullmq_1.WorkerHost {
    targetRepo;
    jobRepo;
    accountRepo;
    channelRepo;
    storeRepo;
    productRepo;
    validation;
    builder;
    publishResolver;
    ebayPublish;
    fashion;
    logger = new common_1.Logger(EbayListingPublishProcessor_1.name);
    constructor(targetRepo, jobRepo, accountRepo, channelRepo, storeRepo, productRepo, validation, builder, publishResolver, ebayPublish, fashion) {
        super();
        this.targetRepo = targetRepo;
        this.jobRepo = jobRepo;
        this.accountRepo = accountRepo;
        this.channelRepo = channelRepo;
        this.storeRepo = storeRepo;
        this.productRepo = productRepo;
        this.validation = validation;
        this.builder = builder;
        this.publishResolver = publishResolver;
        this.ebayPublish = ebayPublish;
        this.fashion = fashion;
    }
    async process(job) {
        const target = await this.targetRepo.findOne({
            where: { id: job.data.targetId },
            relations: ['listingJob', 'ebayAccount'],
        });
        if (!target) {
            this.logger.warn(`Missing publish target ${job.data.targetId}`);
            return;
        }
        const listingJob = target.listingJob;
        const account = target.ebayAccount;
        if (!target.catalogProductId || !account) {
            await this.targetRepo.update(target.id, {
                status: 'failed',
                errorPayload: {
                    source: 'internal',
                    stage: 'precondition',
                    message: !target.catalogProductId
                        ? 'Catalog product was deleted before publish could run'
                        : 'eBay account was disconnected before publish could run',
                    errors: [
                        !target.catalogProductId
                            ? `catalogProductId is null for target ${target.id}`
                            : `ebayAccountId ${target.ebayAccountId ?? 'null'} no longer exists`,
                    ],
                },
            });
            await this.refreshJobStatus(listingJob.id);
            return;
        }
        const catalogProductId = target.catalogProductId;
        const ebayAccountId = target.ebayAccountId;
        const policyOverrides = target.resultPayload?.policyOverrides &&
            typeof target.resultPayload.policyOverrides === 'object'
            ? target.resultPayload.policyOverrides
            : undefined;
        await this.jobRepo.update(listingJob.id, { status: 'processing' });
        await this.targetRepo.update(target.id, { status: 'processing' });
        try {
            const v = await this.validation.validatePublish({
                organizationId: listingJob.organizationId,
                catalogProductId,
                ebayAccountId,
                marketplaceId: target.marketplaceId,
                policyOverrides,
            });
            if (v.status === 'blocked') {
                await this.targetRepo.update(target.id, {
                    status: 'failed',
                    errorPayload: {
                        source: 'internal',
                        stage: 'validation',
                        message: 'Publish validation blocked',
                        errors: v.errors,
                        warnings: v.warnings,
                    },
                });
                await this.refreshJobStatus(listingJob.id);
                return;
            }
            const store = await this.storeRepo.findOneBy({
                id: account.primaryStoreId,
            });
            if (!store) {
                await this.targetRepo.update(target.id, {
                    status: 'failed',
                    errorPayload: { message: 'Primary store missing' },
                });
                await this.refreshJobStatus(listingJob.id);
                return;
            }
            if (store.ebayMarketplaceId !== target.marketplaceId) {
                store.config = {
                    ...(store.config ?? {}),
                    marketplace: target.marketplaceId,
                };
                store.ebayMarketplaceId = target.marketplaceId;
                await this.storeRepo.save(store);
            }
            const resolved = await this.publishResolver.resolve(catalogProductId);
            const sourceListingId = typeof target.resultPayload?.sourceListingId === 'string'
                ? target.resultPayload.sourceListingId
                : undefined;
            const built = await this.builder.build({
                catalogProductId,
                sourceListingId,
                ebayAccountId,
                marketplaceId: target.marketplaceId,
                listingRecordId: sourceListingId ??
                    resolved?.snapshot.listingRecordId ??
                    catalogProductId,
                storeId: account.primaryStoreId,
                vertical: target.vertical ?? undefined,
                policyOverrides,
            });
            if (built.blockingErrors.length) {
                await this.targetRepo.update(target.id, {
                    status: 'failed',
                    errorPayload: {
                        source: 'internal',
                        stage: 'build',
                        message: 'Listing build failed',
                        errors: built.blockingErrors,
                    },
                });
                await this.refreshJobStatus(listingJob.id);
                return;
            }
            const isFashion = target.vertical === 'fashion' ||
                resolved?.snapshot.vertical === 'fashion';
            if (isFashion) {
                if (!this.fashion)
                    throw new Error('Fashion publishing safeguards unavailable');
                await this.fashion.assertApproved(catalogProductId, listingJob.organizationId);
            }
            const results = await this.ebayPublish.publish(built.publishRequest);
            const r = results[0];
            if (r?.success) {
                await this.targetRepo.update(target.id, {
                    status: 'success',
                    resultPayload: {
                        ...(target.resultPayload ?? {}),
                        offerId: r.offerId,
                        listingId: r.listingId,
                        warnings: [...v.warnings, ...built.warnings],
                    },
                });
                let ch = await this.channelRepo.findOne({
                    where: {
                        organizationId: listingJob.organizationId,
                        catalogProductId,
                        ebayAccountId,
                        marketplaceId: target.marketplaceId,
                    },
                });
                if (!ch) {
                    ch = this.channelRepo.create({
                        organizationId: listingJob.organizationId,
                        catalogProductId,
                        ebayAccountId,
                        marketplaceId: target.marketplaceId,
                    });
                }
                ch.vertical = built.publishRequest.vertical ?? target.vertical ?? null;
                ch.internalSku = built.publishRequest.sku;
                ch.ebayInventorySku = r.offerId
                    ? r.effectiveSku ?? built.publishRequest.sku
                    : null;
                ch.offerId = r.offerId ?? null;
                ch.listingId = r.listingId ?? null;
                ch.listingUrl =
                    r.listingId != null
                        ? `https://www.ebay.com/itm/${r.listingId}`
                        : null;
                ch.channelPrice = String(built.publishRequest.price);
                ch.channelQuantity = (0, ebay_publish_quantity_util_js_1.capEbayPublishQuantity)(built.publishRequest.quantity);
                ch.listingStatus = 'published';
                ch.publishedAt = new Date();
                ch.lastErrorCode = null;
                ch.lastErrorMessage = null;
                await this.channelRepo.save(ch);
                if (r.listingId) {
                    await this.productRepo.update(catalogProductId, {
                        ebayItemId: r.listingId,
                    });
                }
                if (isFashion) {
                    const containment = await this.fashion.containIfBlocked(ch, listingJob.requestedByUserId);
                    if (containment)
                        await this.targetRepo.update(target.id, {
                            status: 'failed',
                            errorPayload: {
                                message: 'Fashion approval changed during publication',
                                containment,
                            },
                        });
                }
            }
            else {
                const message = r?.error ?? 'Publish failed';
                const existingListingId = extractExistingEbayListingId(message);
                if (existingListingId) {
                    const existingChannel = await this.channelRepo.findOne({
                        where: {
                            ebayAccountId,
                            marketplaceId: target.marketplaceId,
                            listingId: existingListingId,
                            listingStatus: 'published',
                        },
                    });
                    if (existingChannel) {
                        const existingWarnings = Array.isArray(target.resultPayload?.warnings)
                            ? target.resultPayload.warnings.filter((warning) => typeof warning === 'string')
                            : [];
                        await this.targetRepo.update(target.id, {
                            status: 'skipped',
                            resultPayload: {
                                ...(target.resultPayload ?? {}),
                                listingId: existingListingId,
                                duplicateExistingListingId: existingListingId,
                                duplicateExistingChannelId: existingChannel.id,
                                warnings: [
                                    ...existingWarnings,
                                    'Skipped duplicate publish because the matching eBay listing is already published on this account.',
                                ],
                            },
                            errorPayload: null,
                        });
                        if (existingListingId) {
                            await this.productRepo.update(catalogProductId, {
                                ebayItemId: existingListingId,
                            });
                        }
                        this.logger.warn(`Skipped duplicate publish target ${target.id}: eBay listing ${existingListingId} is already published in channel ${existingChannel.id}`);
                        await this.refreshJobStatus(listingJob.id);
                        return;
                    }
                }
                const maxAttempts = job.opts.attempts ?? 1;
                if (isTransientPublishFailure(message) &&
                    job.attemptsMade + 1 < maxAttempts) {
                    await this.targetRepo.update(target.id, {
                        status: 'pending',
                        errorPayload: {
                            source: 'ebay',
                            stage: 'bulk_create',
                            message,
                            errors: [message],
                        },
                    });
                    await this.refreshJobStatus(listingJob.id);
                    throw new RetriablePublishError(message);
                }
                await this.targetRepo.update(target.id, {
                    status: 'failed',
                    errorPayload: {
                        source: 'ebay',
                        stage: 'bulk_create',
                        message,
                        errors: [message],
                    },
                });
            }
            await this.refreshJobStatus(listingJob.id);
        }
        catch (err) {
            if (err instanceof RetriablePublishError) {
                this.logger.warn(`Publish target ${target.id} will retry after transient failure: ${err.message}`);
                throw err;
            }
            this.logger.error(`Publish target ${target.id} crashed`, err);
            await this.targetRepo.update(target.id, {
                status: 'failed',
                errorPayload: {
                    message: err instanceof Error ? err.message : String(err),
                },
            });
            await this.refreshJobStatus(listingJob.id);
            throw err;
        }
    }
    async refreshJobStatus(jobId) {
        const targets = await this.targetRepo.find({
            where: { listingJobId: jobId },
        });
        const failed = targets.filter((t) => t.status === 'failed').length;
        const success = targets.filter((t) => t.status === 'success').length;
        const pending = targets.filter((t) => t.status === 'pending' || t.status === 'processing').length;
        let status = 'processing';
        if (pending === 0) {
            if (failed && success)
                status = 'completed_with_errors';
            else if (failed)
                status = 'failed';
            else
                status = 'completed';
        }
        await this.jobRepo.update(jobId, { status });
    }
};
exports.EbayListingPublishProcessor = EbayListingPublishProcessor;
exports.EbayListingPublishProcessor = EbayListingPublishProcessor = EbayListingPublishProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('ebay-listing-publish', { concurrency: 5 }),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_listing_job_target_entity_js_1.EbayListingJobTarget)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_listing_job_entity_js_1.EbayListingJob)),
    __param(2, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(3, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __param(4, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(5, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(10, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_listing_validation_service_js_1.EbayListingValidationService,
        listing_builder_service_js_1.ListingBuilderService,
        catalog_publish_resolver_service_js_1.CatalogPublishResolverService,
        ebay_publish_service_js_1.EbayPublishService,
        fashion_listings_service_js_1.FashionListingsService])
], EbayListingPublishProcessor);
//# sourceMappingURL=ebay-listing-publish.processor.js.map