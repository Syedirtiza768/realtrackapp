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
var ListingOptimizationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingOptimizationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const pipeline_job_entity_js_1 = require("../ingestion/entities/pipeline-job.entity.js");
const enterprise_listing_intelligence_service_js_1 = require("../ingestion/enterprise-listing-intelligence.service.js");
const fitment_discovery_service_js_1 = require("./fitment-discovery.service.js");
const source_data_hash_util_js_1 = require("./source-data-hash.util.js");
const platform_generation_util_js_1 = require("../fitment/platform-generation.util.js");
const OPTIMIZATION_VERSION = 28;
let ListingOptimizationService = ListingOptimizationService_1 = class ListingOptimizationService {
    productRepo;
    listingRepo;
    jobRepo;
    fitmentDiscovery;
    enterprise;
    logger = new common_1.Logger(ListingOptimizationService_1.name);
    pipelineDonorModelCache = new Map();
    constructor(productRepo, listingRepo, jobRepo, fitmentDiscovery, enterprise) {
        this.productRepo = productRepo;
        this.listingRepo = listingRepo;
        this.jobRepo = jobRepo;
        this.fitmentDiscovery = fitmentDiscovery;
        this.enterprise = enterprise;
    }
    async enqueueJobOptimization(jobId, marketplace = 'US', bullJob, options) {
        const pipelineJob = await this.jobRepo.findOneBy({ id: jobId });
        const byMkt = (pipelineJob?.optimizationByMarketplace ?? {});
        const existingStatus = byMkt[marketplace]?.status;
        const force = options?.force ?? false;
        if (!force &&
            (existingStatus === 'completed' || existingStatus === 'needs_review')) {
            this.logger.log(`Optimization for job ${jobId} [${marketplace}] already completed, skipping`);
            await this.refreshJobOptimizationAggregate(jobId);
            return;
        }
        const isRetry = existingStatus === 'running';
        const existingCounts = isRetry ? (byMkt[marketplace] ?? {}) : {};
        await this.mergeOptimizationByMarketplace(jobId, marketplace, {
            status: 'running',
            passCount: isRetry ? (existingCounts.passCount ?? 0) : 0,
            reviewCount: isRetry ? (existingCounts.reviewCount ?? 0) : 0,
            blockCount: isRetry ? (existingCounts.blockCount ?? 0) : 0,
            processed: isRetry ? (existingCounts.processed ?? 0) : 0,
            total: isRetry ? (existingCounts.total ?? 0) : 0,
        });
        await this.jobRepo.update(jobId, {
            optimizationStatus: 'running',
            optimizationProcessed: isRetry ? (existingCounts.processed ?? 0) : 0,
        });
        const marketplaceListingSkus = await this.listingRepo
            .createQueryBuilder('lr')
            .select('lr.customLabelSku', 'sku')
            .where('lr.pipelineJobId = :jobId', { jobId })
            .andWhere('lr.marketplace = :marketplace', { marketplace })
            .andWhere('lr.customLabelSku IS NOT NULL')
            .getRawMany();
        const marketplaceSkus = new Set(marketplaceListingSkus.map((r) => r.sku));
        let products = await this.productRepo.find({
            where: { pipelineJobId: jobId },
            select: ['id', 'sku'],
            order: { id: 'ASC' },
        });
        if (marketplaceSkus.size === 0) {
            this.logger.log(`No listing records for job ${jobId} [${marketplace}], skipping optimization`);
            await this.mergeOptimizationByMarketplace(jobId, marketplace, {
                status: 'completed',
                passCount: 0,
                reviewCount: 0,
                blockCount: 0,
                processed: 0,
                total: 0,
            });
            await this.refreshJobOptimizationAggregate(jobId);
            return;
        }
        products = products.filter((p) => p.sku && marketplaceSkus.has(p.sku));
        await this.jobRepo.update(jobId, {
            optimizationTotal: products.length,
        });
        const PRODUCT_TIMEOUT_MS = 60_000;
        const EXTEND_LOCK_MS = 10 * 60 * 1000;
        const PRODUCT_CONCURRENCY = Math.max(1, Number(process.env.LISTING_OPTIMIZATION_PRODUCT_CONCURRENCY ?? '5') || 5);
        const OPTIMIZATION_BATCH_SIZE = Math.max(1, Number(process.env.LISTING_OPTIMIZATION_BATCH_SIZE ?? '5') || 5);
        const EXTEND_LOCK_EVERY_N_CHUNKS = Math.max(1, Math.round(10 / OPTIMIZATION_BATCH_SIZE));
        const startIndex = isRetry ? (existingCounts.processed ?? 0) : 0;
        const remaining = products.slice(startIndex);
        const chunks = [];
        for (let i = 0; i < remaining.length; i += OPTIMIZATION_BATCH_SIZE) {
            chunks.push(remaining.slice(i, i + OPTIMIZATION_BATCH_SIZE));
        }
        this.logger.log(`Optimization for job ${jobId} [${marketplace}]: ${products.length} total, starting at index ${startIndex}${isRetry ? ' (retry)' : ''}, ${chunks.length} batches of up to ${OPTIMIZATION_BATCH_SIZE}, concurrency ${PRODUCT_CONCURRENCY}`);
        await this.mapWithConcurrency(chunks, PRODUCT_CONCURRENCY, async (chunk, ci) => {
            if (bullJob && ci > 0 && ci % EXTEND_LOCK_EVERY_N_CHUNKS === 0) {
                try {
                    await bullJob.extendLock(bullJob.token, EXTEND_LOCK_MS);
                }
                catch (e) {
                    this.logger.warn(`Failed to extend lock for job ${jobId} [${marketplace}]: ${String(e)}`);
                }
                const pct = Math.floor((ci / chunks.length) * 100);
                try {
                    await bullJob.updateProgress(pct);
                }
                catch {
                }
            }
            const chunkTimeoutMs = PRODUCT_TIMEOUT_MS * chunk.length;
            try {
                await Promise.race([
                    this.optimizeProductsBatch(chunk.map((p) => p.id), marketplace, {
                        force: force && !isRetry,
                        sourceFilename: pipelineJob?.originalFilename ?? undefined,
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Batch of ${chunk.length} products timed out after ${chunkTimeoutMs}ms`)), chunkTimeoutMs)),
                ]);
            }
            catch (err) {
                this.logger.error(`Batch optimization failed for ${chunk.length} products [${marketplace}]: ${String(err)}`);
                await Promise.all(chunk.map((p) => this.markProductOptimizationFailed(p.id, String(err))));
            }
            try {
                await this.refreshJobOptimizationCounts(jobId, marketplace);
            }
            catch (err) {
                this.logger.error(`refreshJobOptimizationCounts failed for job ${jobId} [${marketplace}] after batch: ${String(err)}`);
            }
        });
        await this.refreshJobOptimizationAggregate(jobId);
    }
    async mapWithConcurrency(items, concurrency, fn) {
        const results = new Array(items.length);
        let nextIndex = 0;
        const worker = async () => {
            while (true) {
                const i = nextIndex++;
                if (i >= items.length)
                    return;
                results[i] = await fn(items[i], i);
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
        return results;
    }
    async optimizeProduct(productId, marketplace = 'US', options) {
        const prepared = await this.prepareProductForOptimization(productId, marketplace, options);
        if (prepared.skip)
            return prepared.product;
        const listing = await this.enterprise.generateForProduct(productId, {
            marketplace,
            listingQualityProfile: 'max_seo_comprehensive',
        });
        return this.finalizeProductOptimization(productId, marketplace, prepared.product, prepared.fitment, prepared.hash, listing);
    }
    async optimizeProductsBatch(productIds, marketplace = 'US', options) {
        if (productIds.length === 0)
            return;
        const prepared = await Promise.all(productIds.map(async (id) => {
            try {
                return {
                    id,
                    result: await this.prepareProductForOptimization(id, marketplace, options),
                };
            }
            catch (err) {
                return { id, error: err };
            }
        }));
        const toGenerate = prepared.filter((p) => p.result !== undefined && !p.result.skip);
        const aiResults = await this.enterprise.generateForProductsBatch(toGenerate.map((p) => p.id), { marketplace, listingQualityProfile: 'max_seo_comprehensive' });
        for (const p of toGenerate) {
            const listing = aiResults.get(p.id);
            if (!listing) {
                await this.markProductOptimizationFailed(p.id, 'No AI listing result returned for product in batch');
                continue;
            }
            try {
                await this.finalizeProductOptimization(p.id, marketplace, p.result.product, p.result.fitment, p.result.hash, listing);
            }
            catch (err) {
                await this.markProductOptimizationFailed(p.id, String(err));
            }
        }
        for (const p of prepared) {
            if ('error' in p) {
                await this.markProductOptimizationFailed(p.id, String(p.error));
            }
        }
    }
    async markProductOptimizationFailed(productId, message) {
        await this.productRepo
            .update(productId, {
            optimizationStatus: 'failed',
            optimizationErrors: [
                {
                    code: 'OPTIMIZATION_FAILED',
                    severity: 'error',
                    message: message.substring(0, 500),
                },
            ],
        })
            .catch(() => { });
    }
    async prepareProductForOptimization(productId, marketplace, options) {
        const product = await this.productRepo.findOneBy({ id: productId });
        if (!product)
            throw new common_1.NotFoundException(`Product ${productId} not found`);
        const sourceFilename = options?.sourceFilename ??
            (product.pipelineJobId
                ? (await this.jobRepo.findOneBy({ id: product.pipelineJobId }))?.originalFilename
                : undefined);
        const sourceDonor = this.enterprise.parseDonorVehicleFromFilename(sourceFilename, product.brand);
        if (sourceDonor) {
            if (!product.donorYear?.trim())
                product.donorYear = sourceDonor.year;
            if (!product.donorMake?.trim())
                product.donorMake = sourceDonor.make;
            if (!product.donorModel?.trim()) {
                product.donorModel =
                    sourceDonor.model ||
                        (0, platform_generation_util_js_1.resolvePlatformModelFromTitle)(sourceDonor.make, product.title) ||
                        (product.pipelineJobId
                            ? (await this.resolvePipelineDonorModel(product.pipelineJobId, sourceDonor.make)) ?? ''
                            : '');
            }
        }
        const hash = (0, source_data_hash_util_js_1.computeSourceDataHash)(product);
        if (!options?.force &&
            product.optimizationStatus === 'completed' &&
            product.optimizationVersion === OPTIMIZATION_VERSION &&
            product.sourceDataHash === hash) {
            return { skip: true, product };
        }
        await this.productRepo.update(productId, {
            optimizationStatus: 'running',
            fitmentStatus: 'running',
        });
        let discoveryCategoryId;
        if (product.sku) {
            const mktListing = await this.listingRepo.findOne({
                where: {
                    customLabelSku: product.sku,
                    marketplace,
                    deletedAt: (0, typeorm_2.IsNull)(),
                },
                select: ['categoryId'],
            });
            if (mktListing?.categoryId) {
                discoveryCategoryId = mktListing.categoryId;
            }
        }
        const fitment = await this.fitmentDiscovery.discover(product, {
            marketplace,
            categoryId: discoveryCategoryId,
        });
        const fitmentJson = this.fitmentDiscovery.toFitmentDataJson(fitment.rows);
        const existingFitmentUsable = Array.isArray(product.fitmentData) &&
            product.fitmentData.some((row) => {
                const r = row;
                return String(r['Year'] ?? r['year'] ?? '').trim().length > 0;
            });
        await this.productRepo.update(productId, {
            fitmentData: fitmentJson.length > 0
                ? fitmentJson
                : existingFitmentUsable
                    ? product.fitmentData
                    : fitmentJson,
            fitmentRows: fitment.rows,
            fitmentStatus: fitment.status,
            fitmentConfidence: fitment.confidence,
            donorVin: fitment.donorVin,
            donorVinDecoded: fitment.donorVinDecoded,
            ...(product.donorYear?.trim()
                ? { donorYear: product.donorYear.trim() }
                : {}),
            ...(product.donorMake?.trim()
                ? { donorMake: product.donorMake.trim() }
                : {}),
            ...(product.donorModel?.trim()
                ? { donorModel: product.donorModel.trim() }
                : {}),
        });
        return { skip: false, product, fitment, hash };
    }
    resolvePipelineDonorModel(pipelineJobId, make) {
        const cached = this.pipelineDonorModelCache.get(pipelineJobId);
        if (cached)
            return cached;
        const pending = this.productRepo
            .find({
            where: { pipelineJobId },
            select: ['donorModel', 'title'],
            order: { id: 'ASC' },
            take: 2000,
        })
            .then((products) => {
            const models = new Map();
            for (const product of products) {
                const model = product.donorModel?.trim() ||
                    (0, platform_generation_util_js_1.resolvePlatformModelFromTitle)(make, product.title);
                if (model)
                    models.set(model.toLowerCase(), model);
            }
            return models.size === 1 ? [...models.values()][0] : null;
        })
            .catch((error) => {
            this.logger.warn(`Unable to infer donor model for pipeline job ${pipelineJobId}: ${String(error)}`);
            return null;
        });
        this.pipelineDonorModelCache.set(pipelineJobId, pending);
        if (this.pipelineDonorModelCache.size > 200) {
            const oldestKey = this.pipelineDonorModelCache.keys().next().value;
            if (oldestKey)
                this.pipelineDonorModelCache.delete(oldestKey);
        }
        return pending;
    }
    async finalizeProductOptimization(productId, marketplace, product, fitment, hash, listing) {
        const errors = listing.complianceWarnings
            .filter((w) => w.severity === 'error')
            .map((w) => ({
            code: w.code,
            severity: w.severity,
            message: w.message,
            field: w.field,
        }));
        const warnings = [
            ...listing.complianceWarnings
                .filter((w) => w.severity !== 'error')
                .map((w) => ({
                code: w.code,
                severity: w.severity,
                message: w.message,
                field: w.field,
            })),
            ...fitment.manualReviewReasons.map((msg) => ({
                code: 'FITMENT_REVIEW',
                severity: 'warning',
                message: msg,
                field: 'fitment',
            })),
        ];
        let optimizationStatus = 'completed';
        if (listing.validationStatus === 'block') {
            optimizationStatus = 'failed';
        }
        else if (listing.validationStatus === 'review' ||
            fitment.status === 'needs_review' ||
            fitment.manualReviewReasons.length > 0) {
            optimizationStatus = 'needs_review';
        }
        const ebayValidationStatus = fitment.rows.filter((r) => r.validationStatus === 'valid').length > 0
            ? 'valid'
            : fitment.categorySupportsCompatibility === false
                ? 'unsupported'
                : 'needs_review';
        const manualReview = optimizationStatus === 'needs_review' ||
            fitment.status === 'needs_review';
        const seoScore = listing.confidenceScores.overall;
        const readinessScore = listing.uploadReadinessScore;
        const appliedTitle = listing.optimizedTitle?.trim() || undefined;
        await this.productRepo.update(productId, {
            optimizationStatus,
            optimizationVersion: OPTIMIZATION_VERSION,
            optimizedAt: new Date(),
            sourceDataHash: hash,
            ebayValidationStatus,
            optimizationErrors: errors,
            optimizationWarnings: warnings,
            optimizedTitle: listing.optimizedTitle,
            optimizedDescription: listing.seoDescription,
            optimizationPayload: listing,
            seoScore,
            readinessScore,
            manualReview,
            ...(appliedTitle ? { title: appliedTitle } : {}),
        });
        if (product.sku) {
            const mktListing = await this.listingRepo.findOne({
                where: {
                    customLabelSku: product.sku,
                    marketplace,
                    deletedAt: (0, typeorm_2.IsNull)(),
                },
            });
            if (mktListing) {
                if (listing.categoryId) {
                    mktListing.categoryId = listing.categoryId;
                    if (listing.categoryName) {
                        mktListing.categoryName = listing.categoryName;
                    }
                }
                if (appliedTitle) {
                    mktListing.title = appliedTitle;
                }
                await this.listingRepo.save(mktListing);
            }
        }
        if (product.pipelineJobId) {
            await this.refreshJobOptimizationCounts(product.pipelineJobId, marketplace);
        }
        return this.productRepo.findOneByOrFail({ id: productId });
    }
    async getJobOptimizationStatus(jobId, marketplace) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (!job)
            throw new common_1.NotFoundException(`Pipeline job ${jobId} not found`);
        const products = await this.productRepo.find({
            where: { pipelineJobId: jobId },
            order: { sourceRow: 'ASC' },
        });
        const byMkt = (job.optimizationByMarketplace ?? {});
        const mktData = marketplace ? byMkt[marketplace] : null;
        return {
            jobId,
            optimizationStatus: job.optimizationStatus ?? 'pending',
            processed: mktData?.processed ?? job.optimizationProcessed ?? 0,
            total: mktData?.total ?? job.optimizationTotal ?? products.length,
            passCount: mktData?.passCount ?? job.optimizationPassCount ?? 0,
            reviewCount: mktData?.reviewCount ?? job.optimizationReviewCount ?? 0,
            blockCount: mktData?.blockCount ?? job.optimizationBlockCount ?? 0,
            byMarketplace: byMkt,
            products: products.map((p) => this.toProductSummary(p)),
        };
    }
    async getProductOptimization(productId) {
        const product = await this.productRepo.findOneBy({ id: productId });
        if (!product)
            throw new common_1.NotFoundException(`Product ${productId} not found`);
        return {
            ...this.toProductSummary(product),
            fitmentRows: product.fitmentRows,
            fitmentData: product.fitmentData,
            optimizationPayload: product.optimizationPayload,
        };
    }
    async markManualReview(productId, enabled = true) {
        await this.productRepo.update(productId, {
            manualReview: enabled,
            optimizationStatus: enabled ? 'needs_review' : 'completed',
        });
        return this.productRepo.findOneByOrFail({ id: productId });
    }
    async bypassJobOptimization(jobId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (!job)
            throw new common_1.NotFoundException(`Pipeline job ${jobId} not found`);
        const result = await this.productRepo.update({ pipelineJobId: jobId }, {
            optimizationStatus: 'completed',
            manualReview: false,
            optimizationErrors: [],
            optimizationWarnings: [],
        });
        this.logger.warn(`Optimization bypassed for job ${jobId} — ${result.affected ?? 0} products updated`);
        await this.productRepo
            .createQueryBuilder()
            .update(catalog_product_entity_js_1.CatalogProduct)
            .set({
            optimizationPayload: () => `jsonb_set(COALESCE(optimization_payload, '{}'), '{validationStatus}', '"pass"')`,
        })
            .where('pipeline_job_id = :jobId', { jobId })
            .execute();
        await this.jobRepo.update(jobId, {
            optimizationStatus: 'completed',
            optimizationProcessed: result.affected ?? 0,
            optimizationPassCount: result.affected ?? 0,
            optimizationReviewCount: 0,
            optimizationBlockCount: 0,
        });
        return { updatedCount: result.affected ?? 0 };
    }
    canPublish(product) {
        if (product.optimizationStatus !== 'completed')
            return false;
        if (product.manualReview)
            return false;
        const payload = product.optimizationPayload;
        if (payload?.validationStatus === 'block')
            return false;
        const errors = product.optimizationErrors ?? [];
        if (errors.some((e) => e.severity === 'error'))
            return false;
        return true;
    }
    toProductSummary(product) {
        const payload = product.optimizationPayload;
        const fitmentRows = Array.isArray(product.fitmentRows)
            ? product.fitmentRows
            : [];
        return {
            productId: product.id,
            sku: product.sku,
            optimizationStatus: product.optimizationStatus ?? 'pending',
            fitmentStatus: product.fitmentStatus ??
                'pending',
            ebayValidationStatus: product.ebayValidationStatus,
            optimizedTitle: product.optimizedTitle,
            validationStatus: payload?.validationStatus ?? 'review',
            uploadReadinessScore: payload?.uploadReadinessScore ?? Number(product.readinessScore ?? 0),
            seoScore: Number(product.seoScore ?? 0),
            readinessScore: Number(product.readinessScore ?? 0),
            fitmentConfidence: product.fitmentConfidence != null
                ? Number(product.fitmentConfidence)
                : null,
            fitmentRowCount: fitmentRows.length,
            manualReview: Boolean(product.manualReview),
            errors: product.optimizationErrors ?? [],
            warnings: product.optimizationWarnings ?? [],
            missingDataReport: payload?.missingDataReport ?? [],
            canPublish: this.canPublish(product),
        };
    }
    async refreshJobOptimizationCounts(jobId, marketplace) {
        const products = await this.productRepo.find({
            where: { pipelineJobId: jobId },
            select: [
                'optimizationStatus',
                'optimizationPayload',
                'manualReview',
                'optimizationErrors',
            ],
        });
        let passCount = 0;
        let reviewCount = 0;
        let blockCount = 0;
        let processed = 0;
        for (const p of products) {
            if (p.optimizationStatus === 'pending' ||
                p.optimizationStatus === 'running')
                continue;
            processed++;
            const payload = p.optimizationPayload;
            const status = payload?.validationStatus;
            if (status === 'block' || p.optimizationStatus === 'failed')
                blockCount++;
            else if (status === 'review' ||
                p.optimizationStatus === 'needs_review' ||
                p.manualReview)
                reviewCount++;
            else if (status === 'pass' && p.optimizationStatus === 'completed')
                passCount++;
            else
                reviewCount++;
        }
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (marketplace) {
            const total = job?.optimizationTotal ?? 0;
            const status = processed < total
                ? 'running'
                : blockCount > 0 && passCount === 0
                    ? 'failed'
                    : reviewCount > 0
                        ? 'needs_review'
                        : 'completed';
            await this.mergeOptimizationByMarketplace(jobId, marketplace, {
                status,
                passCount,
                reviewCount,
                blockCount,
                processed,
                total,
            });
        }
        await this.jobRepo.update(jobId, {
            optimizationProcessed: processed,
            optimizationPassCount: passCount,
            optimizationReviewCount: reviewCount,
            optimizationBlockCount: blockCount,
        });
    }
    async mergeOptimizationByMarketplace(jobId, marketplace, data) {
        await this.jobRepo.query(`UPDATE pipeline_jobs
       SET optimization_by_marketplace = COALESCE(optimization_by_marketplace, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`, [jobId, JSON.stringify({ [marketplace]: data })]);
    }
    async markJobOptimizationFailed(jobId, marketplace) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (!job)
            return;
        const byMkt = (job.optimizationByMarketplace ?? {});
        const existing = byMkt[marketplace] ?? {};
        await this.mergeOptimizationByMarketplace(jobId, marketplace, {
            ...existing,
            status: 'failed',
        });
        await this.refreshJobOptimizationAggregate(jobId);
    }
    async refreshJobOptimizationAggregate(jobId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (!job)
            return;
        const byMkt = (job.optimizationByMarketplace ?? {});
        const statuses = Object.values(byMkt).map((v) => v.status ?? 'pending');
        let aggregateStatus = 'completed';
        if (statuses.length === 0)
            aggregateStatus = 'pending';
        else if (statuses.some((s) => s === 'running'))
            aggregateStatus = 'running';
        else if (statuses.some((s) => s === 'failed'))
            aggregateStatus = 'needs_review';
        else if (statuses.some((s) => s === 'needs_review'))
            aggregateStatus = 'needs_review';
        else if (statuses.some((s) => s === 'pending'))
            aggregateStatus = 'pending';
        await this.jobRepo.update(jobId, {
            optimizationStatus: aggregateStatus,
            optimizationByMarketplace: byMkt,
        });
    }
};
exports.ListingOptimizationService = ListingOptimizationService;
exports.ListingOptimizationService = ListingOptimizationService = ListingOptimizationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        fitment_discovery_service_js_1.FitmentDiscoveryService,
        enterprise_listing_intelligence_service_js_1.EnterpriseListingIntelligenceService])
], ListingOptimizationService);
//# sourceMappingURL=listing-optimization.service.js.map