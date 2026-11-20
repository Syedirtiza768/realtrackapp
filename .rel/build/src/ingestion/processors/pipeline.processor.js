"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PipelineProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pipeline_job_entity_js_1 = require("../entities/pipeline-job.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const image_asset_entity_js_1 = require("../../storage/entities/image-asset.entity.js");
const image_drive_service_js_1 = require("../../storage/image-drive.service.js");
const extract_make_model_from_title_js_1 = require("../../listings/utils/extract-make-model-from-title.js");
const listing_guards_js_1 = require("../../common/openai/listing-guards.js");
const pipeline_output_image_service_js_1 = require("../services/pipeline-output-image.service.js");
const enterprise_listing_intelligence_service_js_1 = require("../enterprise-listing-intelligence.service.js");
const ebay_mvl_service_js_1 = require("../../fitment/ebay-mvl.service.js");
const ebay_mvl_store_service_js_1 = require("../../fitment/ebay-mvl-store.service.js");
const ebay_marketplace_tree_util_js_1 = require("../../channels/ebay/ebay-marketplace-tree.util.js");
const pipeline_marketplaces_js_1 = require("../../common/marketplaces/pipeline-marketplaces.js");
const pipeline_listing_routing_util_js_1 = require("../utils/pipeline-listing-routing.util.js");
const pipeline_image_matching_util_js_1 = require("../utils/pipeline-image-matching.util.js");
const pipeline_paths_util_js_1 = require("../utils/pipeline-paths.util.js");
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const XLSX = __importStar(require("xlsx"));
const pre_enriched_febest_js_1 = require("../pre-enriched-febest.js");
const ACTIVE_PIPELINE_STATUSES = [
    'pending',
    'uploading',
    'vin_decode',
    'category_mapping',
    'enrichment',
    'validation',
    'output_generation',
];
const PIPELINE_WORKER_CONCURRENCY = Math.max(1, Number(process.env.MAX_CONCURRENT_PIPELINE_JOBS ?? '2') || 2);
let PipelineProcessor = class PipelineProcessor extends bullmq_1.WorkerHost {
    static { PipelineProcessor_1 = this; }
    jobRepo;
    productRepo;
    listingRepo;
    imageAssetRepo;
    pipelineQueue;
    listingOptimizationQueue;
    pipelineOutputImages;
    mvlService;
    mvlStore;
    enterpriseListingIntelligence;
    imageDriveService;
    logger = new common_1.Logger(PipelineProcessor_1.name);
    progressByJob = new Map();
    catalogImportByJob = new Map();
    catalogImportFlushTimers = new Map();
    static FLUSH_INTERVAL_MS = 1500;
    static CATALOG_IMPORT_FLUSH_MS = 2000;
    constructor(jobRepo, productRepo, listingRepo, imageAssetRepo, pipelineQueue, listingOptimizationQueue, pipelineOutputImages, mvlService, mvlStore, enterpriseListingIntelligence, imageDriveService) {
        super();
        this.jobRepo = jobRepo;
        this.productRepo = productRepo;
        this.listingRepo = listingRepo;
        this.imageAssetRepo = imageAssetRepo;
        this.pipelineQueue = pipelineQueue;
        this.listingOptimizationQueue = listingOptimizationQueue;
        this.pipelineOutputImages = pipelineOutputImages;
        this.mvlService = mvlService;
        this.mvlStore = mvlStore;
        this.enterpriseListingIntelligence = enterpriseListingIntelligence;
        this.imageDriveService = imageDriveService;
    }
    async onModuleInit() {
        try {
            const activeJobs = await this.jobRepo.find({
                where: { status: (0, typeorm_2.In)(ACTIVE_PIPELINE_STATUSES) },
            });
            if (activeJobs.length === 0)
                return;
            const [queued, active, delayed] = await Promise.all([
                this.pipelineQueue.getWaiting(),
                this.pipelineQueue.getActive(),
                this.pipelineQueue.getDelayed(),
            ]);
            const liveJobIds = new Set([...queued, ...active, ...delayed].map((entry) => entry.data.jobId));
            for (const job of activeJobs) {
                if (liveJobIds.has(job.id))
                    continue;
                await this.jobRepo.update(job.id, {
                    status: 'failed',
                    lastError: 'Job interrupted (worker restart). Open History and use Retry to run again.',
                    completedAt: new Date(),
                });
                this.logger.warn(`Recovered orphaned pipeline job ${job.id} (${job.originalFilename})`);
            }
        }
        catch (err) {
            this.logger.error(`Failed to recover orphaned pipeline jobs: ${err instanceof Error ? err.message : err}`);
        }
    }
    async process(job) {
        const { jobId } = job.data;
        if (job.name === 'resume-import') {
            await this.runResumeImport(jobId);
            return;
        }
        const { filePath } = job.data;
        this.logger.log(`Starting pipeline job=${jobId} (worker concurrency=${PIPELINE_WORKER_CONCURRENCY})`);
        await this.updateStatus(jobId, 'uploading');
        const dbJob = await this.jobRepo.findOneBy({ id: jobId });
        const importMode = job.data.importMode ??
            dbJob?.stageDetails?.importMode;
        if (importMode === pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE) {
            try {
                await this.runPreEnrichedFebestImport(jobId, filePath, job.data.originalFilename);
                this.logger.log(`Pipeline job=${jobId} trusted FEBEST import completed`);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Pipeline job=${jobId} trusted FEBEST import failed: ${message}`);
                await this.fail(jobId, message);
                throw err;
            }
            finally {
                this.clearJobProgress(jobId);
            }
            return;
        }
        const projectRoot = (0, pipeline_paths_util_js_1.resolvePipelineProjectRoot)();
        const scriptPath = path.resolve(projectRoot, 'scripts', 'ebay-enrichment-pipeline.mjs');
        const outputDir = path.resolve(projectRoot, 'output', `pipeline-${jobId.slice(0, 8)}`);
        if (!fs.existsSync(scriptPath)) {
            await this.fail(jobId, `Pipeline script not found: ${scriptPath}`);
            throw new Error(`Pipeline script not found: ${scriptPath}`);
        }
        fs.mkdirSync(outputDir, { recursive: true });
        try {
            const forceVision = Boolean(dbJob?.stageDetails?.forceVision);
            const exitCode = await this.runPipeline(jobId, scriptPath, filePath, outputDir, projectRoot, {
                forceVision,
                shippingProfile: dbJob?.shippingProfileName ?? undefined,
                returnProfile: dbJob?.returnProfileName ?? undefined,
                paymentProfile: dbJob?.paymentProfileName ?? undefined,
                marketplace: dbJob?.marketplace ?? undefined,
                storeId: dbJob?.storeId ?? undefined,
                originalFilename: job.data.originalFilename ?? undefined,
            });
            if (exitCode !== 0) {
                await this.fail(jobId, `Pipeline exited with code ${exitCode}`);
                throw new Error(`Pipeline exited with code ${exitCode}`);
            }
            await this.runPostEnrichmentImport(jobId, outputDir, job.data.originalFilename);
            this.logger.log(`Pipeline job=${jobId} enrichment completed`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Pipeline job=${jobId} failed: ${message}`);
            await this.fail(jobId, message);
            throw err;
        }
        finally {
            this.clearJobProgress(jobId);
        }
    }
    async runResumeImport(jobId) {
        this.logger.log(`Resuming catalog import for job=${jobId}`);
        const projectRoot = (0, pipeline_paths_util_js_1.resolvePipelineProjectRoot)();
        const outputDir = path.resolve(projectRoot, 'output', `pipeline-${jobId.slice(0, 8)}`);
        if (!fs.existsSync(outputDir)) {
            await this.fail(jobId, `Cannot resume — output directory not found: ${outputDir}`);
            throw new Error(`Cannot resume — output directory not found: ${outputDir}`);
        }
        const dbJob = await this.jobRepo.findOneBy({ id: jobId });
        if (!dbJob) {
            throw new Error(`Cannot resume — job not found: ${jobId}`);
        }
        await this.jobRepo.update(jobId, {
            status: 'output_generation',
            lastError: null,
            completedAt: null,
        });
        try {
            await this.runPostEnrichmentImport(jobId, outputDir, dbJob.originalFilename);
            this.logger.log(`Resume import completed for job=${jobId}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Resume import failed for job=${jobId}: ${message}`);
            await this.fail(jobId, message);
            throw err;
        }
        finally {
            this.clearJobProgress(jobId);
        }
    }
    async runPreEnrichedFebestImport(jobId, filePath, originalFilename) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`FEBEST workbook not found: ${filePath}`);
        }
        const validation = (0, pre_enriched_febest_js_1.parsePreEnrichedFebestWorkbook)(fs.readFileSync(filePath));
        if (!validation.ok || !validation.readyForImport) {
            const detail = validation.errors
                .slice(0, 8)
                .map((issue) => `${issue.sheet}${issue.row ? `:${issue.row}` : ''} ${issue.message}`)
                .join('; ');
            throw new Error(`Cannot import ${pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE}: workbook is not ready${detail ? ` — ${detail}` : ''}`);
        }
        const job = await this.jobRepo.findOneByOrFail({ id: jobId });
        const manifestMarketplace = validation.manifest.Marketplace;
        const expectedMarketplace = manifestMarketplace === 'EBAY_MOTORS_US' ? 'US' : manifestMarketplace;
        if (job.marketplace && expectedMarketplace && job.marketplace !== expectedMarketplace) {
            throw new Error(`Workbook marketplace ${manifestMarketplace} does not match job marketplace ${job.marketplace}`);
        }
        const skus = validation.products.map((product) => product.sku);
        const [existingProducts, existingListings] = await Promise.all([
            skus.length ? this.productRepo.find({ where: { sku: (0, typeorm_2.In)(skus) } }) : [],
            skus.length ? this.listingRepo.find({ where: { customLabelSku: (0, typeorm_2.In)(skus) } }) : [],
        ]);
        const existingProductBySku = new Map(existingProducts.map((product) => [product.sku ?? '', product]));
        const existingListingBySku = new Map(existingListings.map((listing) => [listing.customLabelSku ?? '', listing]));
        const conflicts = [];
        for (const product of validation.products) {
            const existingProduct = existingProductBySku.get(product.sku);
            const existingListing = existingListingBySku.get(product.sku);
            const sameProduct = existingProduct?.sourceDataHash === product.evidenceHash;
            const sameListing = existingListing?.pipelineJobId === jobId ||
                (existingListing?.sourceFileName === originalFilename &&
                    existingListing.sourceRowNumber === product.rowNumber &&
                    existingListing.sheetName === 'Products');
            if ((existingProduct && !sameProduct) || (existingListing && !sameListing)) {
                conflicts.push(`${product.sku}: existing catalog/listing row is not an idempotent match`);
            }
        }
        if (conflicts.length > 0) {
            throw new Error(`Pre-enriched FEBEST import blocked by ${conflicts.length} SKU collision(s): ${conflicts
                .slice(0, 10)
                .join('; ')}`);
        }
        const fitmentsBySku = new Map();
        for (const fitment of validation.fitments) {
            if (fitment.validationStatus !== 'accepted')
                continue;
            const rows = fitmentsBySku.get(fitment.sku) ?? [];
            rows.push(fitment);
            fitmentsBySku.set(fitment.sku, rows);
        }
        const conditionLabels = {
            '1000': 'New',
            '2500': 'Remanufactured',
            '3000': 'Used',
        };
        const specificText = (specifics, names) => {
            for (const name of names) {
                const value = specifics[name];
                if (Array.isArray(value)) {
                    const first = value.find((entry) => String(entry ?? '').trim());
                    if (first != null)
                        return String(first).trim();
                }
                else if (String(value ?? '').trim()) {
                    return String(value).trim();
                }
            }
            return '';
        };
        let insertedProducts = 0;
        let insertedListings = 0;
        await this.productRepo.manager.transaction(async (manager) => {
            const productsRepo = manager.getRepository(catalog_product_entity_js_1.CatalogProduct);
            const listingsRepo = manager.getRepository(listing_record_entity_js_1.ListingRecord);
            for (const product of validation.products) {
                const salePrice = product.price;
                if (salePrice == null) {
                    throw new Error(`Missing validated price for ${product.sku}`);
                }
                const acceptedFitments = fitmentsBySku.get(product.sku) ?? [];
                const specifics = product.itemSpecifics;
                const mirroredImages = await this.pipelineOutputImages.mirrorApprovedImageUrls(jobId, product.sku, product.imageUrls);
                const imageUrls = mirroredImages.urls;
                const fitmentPayload = acceptedFitments.map((fitment) => ({
                    year: fitment.year,
                    make: fitment.make,
                    model: fitment.model,
                    trim: fitment.trim,
                    engine: fitment.engine,
                    submodel: fitment.submodel,
                    bodyStyle: fitment.bodyStyle,
                    drivetrain: fitment.drivetrain,
                    notes: fitment.notes,
                    sourceApplicationId: fitment.sourceApplicationId,
                    sourceUrl: fitment.sourceUrl,
                    marketplace: fitment.marketplace,
                }));
                const approvedPayload = {
                    importMode: pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE,
                    sourceRecordId: product.sourceRecordId,
                    evidenceHash: product.evidenceHash,
                    descriptionHtml: product.descriptionHtml,
                    description: product.description,
                    itemSpecifics: specifics,
                    officialImageUrls: product.imageUrls,
                    mirroredImageUrls: imageUrls,
                    mirroredImageS3Keys: mirroredImages.s3Keys,
                    acceptedFitments: fitmentPayload,
                    qualityStatus: validation.manifest.QualityStatus ?? 'READY',
                };
                const existingProduct = existingProductBySku.get(product.sku);
                const existingListing = existingListingBySku.get(product.sku);
                const sameProduct = existingProduct?.sourceDataHash === product.evidenceHash;
                const sameListing = existingListing?.pipelineJobId === jobId ||
                    (existingListing?.sourceFileName === originalFilename &&
                        existingListing.sourceRowNumber === product.rowNumber &&
                        existingListing.sheetName === 'Products');
                if (!sameProduct) {
                    const catalog = productsRepo.create({
                        sku: product.sku,
                        mpn: product.partNumber,
                        mpnNormalized: product.partNumber.toUpperCase(),
                        title: product.title,
                        titleNormalized: product.title.toLowerCase(),
                        description: product.description,
                        brand: product.brand,
                        brandNormalized: product.brand.toUpperCase(),
                        partType: specificText(specifics, ['Type', 'Part Type']),
                        placement: specificText(specifics, ['Placement', 'Position']),
                        material: specificText(specifics, ['Material']),
                        features: JSON.stringify(specifics.Features ?? specifics.FeaturesAndBenefits ?? ''),
                        oemPartNumber: specificText(specifics, ['OE/OEM Part Number', 'OE Number', 'OEM Number']),
                        price: salePrice,
                        quantity: product.quantity,
                        conditionId: product.conditionId,
                        conditionLabel: conditionLabels[product.conditionId] ?? product.conditionId,
                        categoryId: product.categoryId,
                        imageUrls,
                        fitmentData: fitmentPayload,
                        fitmentRows: fitmentPayload,
                        fitmentStatus: 'validated',
                        fitmentConfidence: 1,
                        ebayValidationStatus: 'validated',
                        sourceDataHash: product.evidenceHash,
                        sourceFile: originalFilename,
                        sourceRow: product.rowNumber,
                        pipelineJobId: jobId,
                        teamId: job.teamId,
                        vertical: job.vertical ?? 'automotive',
                        verticalAttributes: approvedPayload,
                        verticalValidationStatus: 'validated',
                        optimizationStatus: 'not_applicable_trusted_import',
                        optimizationVersion: 1,
                        optimizedAt: new Date(),
                        optimizedTitle: product.title,
                        optimizedDescription: product.descriptionHtml,
                        optimizationPayload: approvedPayload,
                        optimizationErrors: [],
                        optimizationWarnings: [],
                        manualReview: false,
                    });
                    await productsRepo.save(catalog);
                    insertedProducts += 1;
                }
                if (!sameListing) {
                    const listing = listingsRepo.create({
                        organizationId: null,
                        vertical: job.vertical ?? 'automotive',
                        verticalAttributes: approvedPayload,
                        sourceFileName: originalFilename,
                        sourceFilePath: filePath,
                        sheetName: 'Products',
                        sourceRowNumber: product.rowNumber,
                        origin: listing_record_entity_js_1.ListingOrigin.PIPELINE_IMPORT,
                        action: 'Add',
                        customLabelSku: product.sku,
                        categoryId: product.categoryId,
                        title: product.title,
                        startPrice: salePrice.toFixed(2),
                        startPriceNum: salePrice,
                        quantity: String(product.quantity),
                        quantityNum: product.quantity,
                        itemPhotoUrl: imageUrls.join('|'),
                        conditionId: product.conditionId,
                        conditionLabel: conditionLabels[product.conditionId] ?? product.conditionId,
                        description: product.descriptionHtml,
                        format: 'FixedPrice',
                        duration: 'GTC',
                        shippingProfileName: job.shippingProfileName,
                        returnProfileName: job.returnProfileName,
                        paymentProfileName: job.paymentProfileName,
                        cBrand: product.brand,
                        cType: specificText(specifics, ['Type', 'Part Type']),
                        cFeatures: JSON.stringify(specifics.Features ?? specifics.FeaturesAndBenefits ?? ''),
                        cManufacturerPartNumber: product.partNumber,
                        cOeOemPartNumber: specificText(specifics, ['OE/OEM Part Number', 'OE Number', 'OEM Number']),
                        cMaterial: specificText(specifics, ['Material']),
                        cPlacement: specificText(specifics, ['Placement', 'Position']),
                        countryOfOrigin: null,
                        pipelineJobId: jobId,
                        teamId: job.teamId,
                        marketplace: job.marketplace ?? 'US',
                        status: 'draft',
                        enrichmentStage: 'trusted_import',
                        version: 1,
                        deletedAt: null,
                        updatedBy: null,
                        publishedAt: null,
                        ebayListingId: null,
                        shopifyProductId: null,
                    });
                    await listingsRepo.save(listing);
                    insertedListings += 1;
                }
            }
        });
        await this.jobRepo.update(jobId, {
            status: 'completed',
            totalParts: validation.products.length,
            processedParts: validation.products.length,
            enrichedCount: validation.products.length,
            fallbackCount: 0,
            optimizationStatus: 'not_applicable_trusted_import',
            optimizationProcessed: validation.products.length,
            optimizationTotal: validation.products.length,
            optimizationPassCount: validation.products.length,
            optimizationReviewCount: 0,
            optimizationBlockCount: 0,
            completedAt: new Date(),
            stageDetails: {
                ...(job.stageDetails ?? {}),
                importMode: pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE,
                subStage: 'trusted_import_completed',
                trustedImport: {
                    manifestMarketplace,
                    sourceHash: validation.manifest.SourceHash,
                    runHash: validation.manifest.RunHash,
                    productRows: validation.products.length,
                    acceptedFitmentRows: validation.summary.acceptedFitmentRows,
                    insertedProducts,
                    insertedListings,
                    collisionPolicy: 'no_overwrite_idempotent_source_hash_only',
                    listingStatus: 'draft',
                    publication: 'not_performed',
                },
            },
        });
    }
    async runPostEnrichmentImport(jobId, outputDir, originalFilename) {
        await this.collectOutputs(jobId, outputDir);
        await this.touchSubStage(jobId, 'writing_done');
        await this.touchSubStage(jobId, 'mirror_images');
        await this.pipelineOutputImages.mirrorImagesInOutputDir(jobId, outputDir);
        await this.touchSubStage(jobId, 'catalog_import');
        await this.saveToCatalog(jobId, outputDir, originalFilename);
        await this.touchSubStage(jobId, 'finalizing');
        await this.linkUploadedImages(jobId);
        await this.propagateSourceImages(jobId);
        await this.syncPipelineImageDrive(jobId);
        await this.syncResolvedImagesToOutput(jobId, outputDir);
        await this.updateStatus(jobId, 'completed');
        const completedJob = await this.jobRepo.findOneBy({ id: jobId });
        const optimizationMarketplace = completedJob?.marketplace === 'DE' || completedJob?.marketplace === 'AU'
            ? completedJob.marketplace
            : 'US';
        await this.listingOptimizationQueue.add('optimize-job', { jobId, marketplace: optimizationMarketplace }, {
            jobId: `pipeline-optimization-${jobId}-${optimizationMarketplace}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
        });
        this.logger.log(`Queued mandatory listing optimization for job ${jobId} [${optimizationMarketplace}]`);
    }
    getJobProgress(jobId) {
        let state = this.progressByJob.get(jobId);
        if (!state) {
            state = {
                pendingUpdate: null,
                pendingStageDetails: null,
                flushTimer: null,
            };
            this.progressByJob.set(jobId, state);
        }
        return state;
    }
    async shouldSkipMvlOnImport() {
        const raw = process.env.PIPELINE_SKIP_MVL_ON_IMPORT;
        if (raw != null && String(raw).trim() !== '') {
            return /^(1|true|yes|on)$/i.test(String(raw).trim());
        }
        return !(await this.mvlStore.hasAnyActiveRelease());
    }
    async touchSubStage(jobId, subStage) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        await this.jobRepo.update(jobId, {
            stageDetails: {
                ...(job?.stageDetails ?? {}),
                subStage,
            },
        });
    }
    catalogImportSubStage(phase) {
        switch (phase) {
            case 'parsing':
                return 'catalog_parsing';
            case 'mvl':
                return 'mvl_validation';
            case 'saving':
                return 'catalog_saving';
        }
    }
    scheduleCatalogImportProgress(jobId, progress, immediate = false) {
        this.catalogImportByJob.set(jobId, progress);
        if (immediate) {
            this.flushCatalogImportProgress(jobId).catch(() => { });
            return;
        }
        if (this.catalogImportFlushTimers.has(jobId))
            return;
        this.catalogImportFlushTimers.set(jobId, setTimeout(() => {
            this.catalogImportFlushTimers.delete(jobId);
            this.flushCatalogImportProgress(jobId).catch(() => { });
        }, PipelineProcessor_1.CATALOG_IMPORT_FLUSH_MS));
    }
    async flushCatalogImportProgress(jobId) {
        const progress = this.catalogImportByJob.get(jobId);
        if (!progress)
            return;
        const timer = this.catalogImportFlushTimers.get(jobId);
        if (timer) {
            clearTimeout(timer);
            this.catalogImportFlushTimers.delete(jobId);
        }
        const job = await this.jobRepo.findOneBy({ id: jobId });
        await this.jobRepo.update(jobId, {
            stageDetails: {
                ...(job?.stageDetails ?? {}),
                subStage: this.catalogImportSubStage(progress.phase),
                catalogImport: progress,
            },
        });
        this.logger.log(`Job ${jobId}: catalog import [${progress.marketplace}] ${progress.phase} ${progress.processed}/${progress.total}`);
    }
    clearCatalogImportProgress(jobId) {
        const timer = this.catalogImportFlushTimers.get(jobId);
        if (timer)
            clearTimeout(timer);
        this.catalogImportFlushTimers.delete(jobId);
        this.catalogImportByJob.delete(jobId);
    }
    clearJobProgress(jobId) {
        const state = this.progressByJob.get(jobId);
        if (state?.flushTimer) {
            clearTimeout(state.flushTimer);
        }
        this.progressByJob.delete(jobId);
        this.clearCatalogImportProgress(jobId);
    }
    runPipeline(jobId, scriptPath, inputPath, outputDir, cwd, options = {}) {
        return new Promise((resolve, reject) => {
            const child = (0, node_child_process_1.spawn)('node', [scriptPath], {
                cwd,
                env: {
                    ...process.env,
                    PIPELINE_INPUT_FILE: inputPath,
                    PIPELINE_OUTPUT_DIR: outputDir,
                    PIPELINE_JOB_ID: jobId,
                    ...(options.forceVision ? { PIPELINE_FORCE_VISION: '1' } : {}),
                    ...(options.shippingProfile
                        ? { PIPELINE_SHIPPING_PROFILE: options.shippingProfile }
                        : {}),
                    ...(options.returnProfile
                        ? { PIPELINE_RETURN_PROFILE: options.returnProfile }
                        : {}),
                    ...(options.paymentProfile
                        ? { PIPELINE_PAYMENT_PROFILE: options.paymentProfile }
                        : {}),
                    ...(options.marketplace
                        ? { PIPELINE_TARGET_MARKETPLACE: options.marketplace }
                        : {}),
                    ...(options.storeId ? { PIPELINE_STORE_ID: options.storeId } : {}),
                    ...(options.originalFilename
                        ? { PIPELINE_ORIGINAL_FILENAME: options.originalFilename }
                        : {}),
                },
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stderr = '';
            let settled = false;
            const childTimeoutMs = Number(process.env.PIPELINE_CHILD_TIMEOUT_MS) || 90 * 60 * 1000;
            const timer = setTimeout(() => {
                if (settled)
                    return;
                this.logger.error(`Pipeline job=${jobId} child process timed out after ${childTimeoutMs / 1000}s — killing`);
                child.kill('SIGTERM');
            }, childTimeoutMs);
            child.stdout?.on('data', (data) => {
                const text = data.toString();
                this.parseProgress(jobId, text).catch(() => { });
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
                if (stderr.length > 4096) {
                    stderr = stderr.slice(-4096);
                }
            });
            child.on('error', (err) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                reject(err);
            });
            child.on('close', (code) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                if (code !== 0 && stderr) {
                    this.logger.error(`Pipeline stderr: ${stderr.slice(-500)}`);
                }
                this.flushProgress(jobId)
                    .then(() => resolve(code ?? 1))
                    .catch(() => resolve(code ?? 1));
            });
        });
    }
    async parseProgress(jobId, text) {
        const state = this.getJobProgress(jobId);
        const lines = text.split('\n');
        let hasStageChange = false;
        for (const line of lines) {
            const idx = line.indexOf('[PROGRESS]');
            if (idx === -1)
                continue;
            const payload = line.slice(idx + '[PROGRESS]'.length).trim();
            const fields = {};
            for (const pair of payload.split(/\s+/)) {
                const eq = pair.indexOf('=');
                if (eq > 0) {
                    fields[pair.slice(0, eq)] = pair.slice(eq + 1);
                }
            }
            if (!state.pendingUpdate)
                state.pendingUpdate = {};
            const validStages = [
                'uploading',
                'vin_decode',
                'category_mapping',
                'enrichment',
                'validation',
                'output_generation',
            ];
            if (fields.stage &&
                validStages.includes(fields.stage)) {
                state.pendingUpdate.status = fields.stage;
                hasStageChange = true;
            }
            else if (fields.stage === 'enrichment_done') {
                state.pendingUpdate.status = 'enrichment';
                hasStageChange = true;
            }
            if (fields.total_parts)
                state.pendingUpdate.totalParts = parseInt(fields.total_parts, 10);
            if (fields.processed)
                state.pendingUpdate.processedParts = parseInt(fields.processed, 10);
            if (fields.enriched)
                state.pendingUpdate.enrichedCount = parseInt(fields.enriched, 10);
            if (fields.failed)
                state.pendingUpdate.fallbackCount = parseInt(fields.failed, 10);
            if (fields.tokens)
                state.pendingUpdate.openaiTokensUsed = parseInt(fields.tokens, 10);
            if (fields.vin_success)
                state.pendingUpdate.vinDecodeSuccess = parseInt(fields.vin_success, 10);
            if (fields.vin_failed)
                state.pendingUpdate.vinDecodeFailed = parseInt(fields.vin_failed, 10);
            if (fields.cat_api)
                state.pendingUpdate.categoryApiCount = parseInt(fields.cat_api, 10);
            if (fields.cat_fallback)
                state.pendingUpdate.categoryFallbackCount = parseInt(fields.cat_fallback, 10);
            if (fields.cat_ai) {
                if (!state.pendingStageDetails)
                    state.pendingStageDetails = {};
                state.pendingStageDetails.categoryAiCount = parseInt(fields.cat_ai, 10);
                hasStageChange = true;
            }
            if (fields.cat_taxonomy_backoff === '1') {
                if (!state.pendingStageDetails)
                    state.pendingStageDetails = {};
                state.pendingStageDetails.categoryTaxonomyBackoff = true;
                hasStageChange = true;
            }
            if (fields.enrichment_mode) {
                if (!state.pendingStageDetails)
                    state.pendingStageDetails = {};
                state.pendingStageDetails.enrichmentMode = fields.enrichment_mode;
                hasStageChange = true;
            }
            if (fields.sub_stage) {
                if (!state.pendingStageDetails)
                    state.pendingStageDetails = {};
                state.pendingStageDetails.subStage = fields.sub_stage;
                hasStageChange = true;
            }
        }
        if (hasStageChange) {
            await this.flushProgress(jobId);
        }
        else {
            this.scheduleFlush(jobId);
        }
    }
    async flushProgress(jobId) {
        const state = this.getJobProgress(jobId);
        if (state.flushTimer) {
            clearTimeout(state.flushTimer);
            state.flushTimer = null;
        }
        const update = state.pendingUpdate;
        const stagePatch = state.pendingStageDetails;
        state.pendingUpdate = null;
        state.pendingStageDetails = null;
        if (!update && !stagePatch)
            return;
        const merged = { ...(update ?? {}) };
        if (stagePatch && Object.keys(stagePatch).length > 0) {
            const job = await this.jobRepo.findOneBy({ id: jobId });
            merged.stageDetails = {
                ...(job?.stageDetails ?? {}),
                ...stagePatch,
            };
        }
        if (Object.keys(merged).length > 0) {
            await this.jobRepo.update(jobId, merged);
            if (merged.status) {
                this.logger.log(`Job ${jobId} → ${merged.status} (parts: ${merged.processedParts ?? '?'}/${merged.totalParts ?? '?'})`);
            }
        }
    }
    scheduleFlush(jobId) {
        const state = this.getJobProgress(jobId);
        if (state.flushTimer)
            return;
        state.flushTimer = setTimeout(() => {
            state.flushTimer = null;
            this.flushProgress(jobId).catch(() => { });
        }, PipelineProcessor_1.FLUSH_INTERVAL_MS);
    }
    async collectOutputs(jobId, outputDir) {
        const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
        const update = {};
        for (const file of files) {
            const fullPath = path.join(outputDir, file);
            const lower = file.toLowerCase();
            if (lower.includes('us-motors') || lower.includes('us_motors')) {
                update.outputUsPath = fullPath;
            }
            else if (lower.startsWith('au-') || lower.startsWith('au_')) {
                update.outputAuPath = fullPath;
            }
            else if (lower.startsWith('de-') || lower.startsWith('de_')) {
                update.outputDePath = fullPath;
            }
            else if (lower.startsWith('uk-') || lower.startsWith('uk_')) {
                update.outputUkPath = fullPath;
            }
            else if (lower.includes('report') && lower.endsWith('.json')) {
                update.reportPath = fullPath;
                try {
                    const report = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    const summary = report.summary ?? report;
                    const summaryAny = summary;
                    if (summaryAny.totalInputParts)
                        update.totalParts = summaryAny.totalInputParts;
                    else if (summaryAny.totalInput)
                        update.totalParts = summaryAny.totalInput;
                    if (summaryAny.vinDecodeSuccess)
                        update.vinDecodeSuccess = summaryAny.vinDecodeSuccess;
                    if (summaryAny.vinDecodeFail)
                        update.vinDecodeFailed = summaryAny.vinDecodeFail;
                    if (report.categoryMapping?.apiMapped != null) {
                        update.categoryApiCount = report.categoryMapping.apiMapped;
                    }
                    if (report.categoryMapping?.fallbackMapped != null) {
                        update.categoryFallbackCount =
                            report.categoryMapping.fallbackMapped;
                    }
                    if (report.openai?.totalTokens)
                        update.openaiTokensUsed = report.openai.totalTokens;
                    if (summaryAny.totalAiEnriched != null) {
                        update.enrichedCount = summaryAny.totalAiEnriched;
                    }
                    else if (summaryAny.totalProcessed) {
                        update.enrichedCount = summaryAny.totalProcessed;
                    }
                    if (summaryAny.totalFallbackEnrichment != null) {
                        update.fallbackCount = summaryAny.totalFallbackEnrichment;
                    }
                    else if (summaryAny.totalFailedEnrichment != null) {
                        update.fallbackCount = summaryAny.totalFailedEnrichment;
                    }
                    const probeErrors = (report.errors ?? []).filter((e) => e.type === 'openai');
                    const taxonomyErrors = (report.categoryMapping?.taxonomyErrors ??
                        (report.errors ?? []).filter((e) => e.type === 'taxonomy'));
                    update.stageDetails = {
                        enrichmentMode: summaryAny.enrichmentMode ?? null,
                        totalAiEnriched: summaryAny.totalAiEnriched ?? summaryAny.totalProcessed ?? 0,
                        totalFallbackEnrichment: summaryAny.totalFallbackEnrichment ??
                            summaryAny.totalFailedEnrichment ??
                            0,
                        totalListingsGenerated: summaryAny.totalListingsGenerated ?? null,
                        openRouterModel: report.openai?.defaultModel ?? null,
                        openRouterProbeErrors: probeErrors,
                        enrichmentErrors: (report.errors ?? []).slice(0, 20),
                        localization: report.localization ?? null,
                        categoryMapping: {
                            apiMapped: report.categoryMapping?.apiMapped ?? 0,
                            aiMapped: report.categoryMapping?.aiMapped ?? 0,
                            fallbackMapped: report.categoryMapping?.fallbackMapped ?? 0,
                            apiRate: report.categoryMapping?.apiRate ?? '0%',
                            categoryMode: report.categoryMapping?.categoryMode ?? null,
                            aiModel: report.categoryMapping?.aiModel ?? null,
                            apiSkippedReason: report.categoryMapping?.apiSkippedReason ?? null,
                            treeCacheHit: report.categoryMapping?.treeCacheHit ?? false,
                            treeCacheSource: report.categoryMapping?.treeCacheSource ?? null,
                            aiCacheHits: report.categoryMapping?.aiCacheHits ?? 0,
                            aiApiCalls: report.categoryMapping?.aiApiCalls ?? 0,
                            aiTokensUsed: report.categoryMapping?.aiTokensUsed ?? 0,
                            taxonomyErrors,
                        },
                    };
                    if (probeErrors.length > 0 ||
                        summaryAny.enrichmentMode === 'fallback' ||
                        taxonomyErrors.length > 0) {
                        update.errorCount =
                            probeErrors.length +
                                (summaryAny.enrichmentMode === 'fallback' ? 1 : 0) +
                                taxonomyErrors.length;
                    }
                }
                catch {
                }
            }
        }
        if (!update.outputUsPath) {
            const parentOutput = path.resolve(outputDir, '..');
            const parentFiles = fs.readdirSync(parentOutput);
            for (const file of parentFiles) {
                const fullPath = path.join(parentOutput, file);
                const lower = file.toLowerCase();
                if (lower.includes('us-motors') && !update.outputUsPath)
                    update.outputUsPath = fullPath;
                if (lower.startsWith('au-') && !update.outputAuPath)
                    update.outputAuPath = fullPath;
                if (lower.startsWith('de-') && !update.outputDePath)
                    update.outputDePath = fullPath;
                if (lower.startsWith('uk-') && !update.outputUkPath)
                    update.outputUkPath = fullPath;
                if (lower.includes('report') &&
                    lower.endsWith('.json') &&
                    !update.reportPath)
                    update.reportPath = fullPath;
            }
        }
        if (Object.keys(update).length > 0) {
            const existing = await this.jobRepo.findOneBy({ id: jobId });
            if (update.stageDetails && existing?.stageDetails) {
                update.stageDetails = {
                    ...existing.stageDetails,
                    ...update.stageDetails,
                };
            }
            await this.jobRepo.update(jobId, update);
        }
    }
    async updateStatus(jobId, status) {
        const update = { status };
        if (status === 'uploading') {
            update.startedAt = new Date();
        }
        else if (status === 'completed') {
            update.completedAt = new Date();
            const job = await this.jobRepo.findOneBy({ id: jobId });
            update.stageDetails = {
                ...(job?.stageDetails ?? {}),
                subStage: 'done',
            };
        }
        await this.jobRepo.update(jobId, update);
    }
    async fail(jobId, error) {
        await this.jobRepo.update(jobId, {
            status: 'failed',
            lastError: error.substring(0, 2000),
        });
    }
    async linkUploadedImages(jobId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        const assetIds = job?.stageDetails
            ?.uploadedAssetIds;
        if (!assetIds || assetIds.length === 0)
            return;
        const listings = await this.listingRepo.find({
            where: { pipelineJobId: jobId },
            order: { sourceRowNumber: 'ASC' },
        });
        const primaryListing = listings[0];
        if (!primaryListing) {
            this.logger.warn(`Job ${jobId}: Could not find listing record to link uploaded images`);
            return;
        }
        const result = await this.imageAssetRepo
            .createQueryBuilder()
            .update()
            .set({ listingId: primaryListing.id })
            .where('id IN (:...assetIds)', { assetIds })
            .execute();
        this.logger.log(`Job ${jobId}: Linked ${result.affected ?? 0} uploaded images to listing ${primaryListing.id}`);
    }
    async propagateSourceImages(jobId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        const stageDetails = job?.stageDetails ?? {};
        const sourceListingIds = stageDetails.sourceListingIds;
        const uploadedAssetIds = stageDetails.uploadedAssetIds;
        const parseUrls = (pipe) => (pipe ?? '')
            .split('|')
            .map((u) => u.trim())
            .filter((url) => url.startsWith('http'));
        const pipelineListings = await this.listingRepo.find({
            where: { pipelineJobId: jobId },
        });
        const hasExplicitSharedSource = Boolean(sourceListingIds?.length || uploadedAssetIds?.length);
        if (hasExplicitSharedSource) {
            const imageUrlSet = new Set();
            if (sourceListingIds?.length) {
                const sources = await this.listingRepo.find({
                    where: { id: (0, typeorm_2.In)(sourceListingIds) },
                });
                for (const source of sources) {
                    for (const url of parseUrls(source.itemPhotoUrl))
                        imageUrlSet.add(url);
                }
            }
            if (uploadedAssetIds?.length) {
                const assets = await this.imageAssetRepo.find({
                    where: { id: (0, typeorm_2.In)(uploadedAssetIds) },
                });
                for (const asset of assets) {
                    if (typeof asset.cdnUrl === 'string' &&
                        (0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(asset.cdnUrl))
                        imageUrlSet.add(asset.cdnUrl);
                }
            }
            const imageUrls = [...imageUrlSet].slice(0, 24);
            if (imageUrls.length === 0) {
                this.logger.log(`Job ${jobId}: No source/upload images to propagate`);
                return;
            }
            const photoPipe = imageUrls.join('|');
            let catalogUpdated = 0;
            let listingsUpdated = 0;
            const products = await this.productRepo.find({
                where: { pipelineJobId: jobId },
            });
            for (const product of products) {
                if (!(0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(product.imageUrls)) {
                    product.imageUrls = imageUrls;
                    await this.productRepo.save(product);
                    catalogUpdated++;
                }
            }
            for (const listing of pipelineListings) {
                if (!(0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(listing.itemPhotoUrl)) {
                    listing.itemPhotoUrl = photoPipe;
                    await this.listingRepo.save(listing);
                    listingsUpdated++;
                }
            }
            this.logger.log(`Job ${jobId}: Propagated ${imageUrls.length} shared source image(s) to ${catalogUpdated} catalog product(s) and ${listingsUpdated} listing row(s)`);
            return;
        }
        const skusNeedingImages = [
            ...new Set(pipelineListings
                .filter((l) => !(0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(l.itemPhotoUrl))
                .map((l) => l.customLabelSku?.trim())
                .filter((s) => Boolean(s))),
        ];
        if (skusNeedingImages.length === 0) {
            this.logger.log(`Job ${jobId}: No listing rows missing images; skipping intake image propagation`);
            return;
        }
        const intakeListings = await this.listingRepo.find({
            where: {
                customLabelSku: (0, typeorm_2.In)(skusNeedingImages),
                origin: listing_record_entity_js_1.ListingOrigin.ADD_PART,
            },
        });
        const intakeBySku = new Map();
        for (const intake of intakeListings) {
            const sku = intake.customLabelSku?.trim();
            if (!sku)
                continue;
            const urls = parseUrls(intake.itemPhotoUrl);
            if (urls.length)
                intakeBySku.set(sku, urls.slice(0, 24));
        }
        const intakeIds = intakeListings.map((l) => l.id);
        if (intakeIds.length) {
            const linkedAssets = await this.imageAssetRepo.find({
                where: { listingId: (0, typeorm_2.In)(intakeIds) },
            });
            const assetsByListing = new Map();
            for (const asset of linkedAssets) {
                if (!asset.listingId ||
                    typeof asset.cdnUrl !== 'string' ||
                    !(0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(asset.cdnUrl)) {
                    continue;
                }
                const list = assetsByListing.get(asset.listingId) ?? [];
                list.push(asset.cdnUrl);
                assetsByListing.set(asset.listingId, list);
            }
            for (const intake of intakeListings) {
                const sku = intake.customLabelSku?.trim();
                if (!sku || intakeBySku.has(sku))
                    continue;
                const urls = assetsByListing.get(intake.id)?.slice(0, 24);
                if (urls?.length)
                    intakeBySku.set(sku, urls);
            }
        }
        let catalogUpdated = 0;
        let listingsUpdated = 0;
        for (const listing of pipelineListings) {
            if ((0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(listing.itemPhotoUrl))
                continue;
            const sku = listing.customLabelSku?.trim();
            if (!sku)
                continue;
            const urls = intakeBySku.get(sku);
            if (!urls?.length)
                continue;
            listing.itemPhotoUrl = urls.join('|');
            await this.listingRepo.save(listing);
            listingsUpdated++;
        }
        const products = await this.productRepo.find({
            where: { pipelineJobId: jobId },
        });
        for (const product of products) {
            if ((0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(product.imageUrls))
                continue;
            const sku = product.sku?.trim();
            if (!sku)
                continue;
            const urls = intakeBySku.get(sku);
            if (!urls?.length)
                continue;
            product.imageUrls = urls;
            await this.productRepo.save(product);
            catalogUpdated++;
        }
        this.logger.log(`Job ${jobId}: Propagated per-SKU intake image(s) to ${catalogUpdated} catalog product(s) and ${listingsUpdated} listing row(s)`);
        const stillMissingListings = pipelineListings.filter((l) => !(0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(l.itemPhotoUrl));
        if (stillMissingListings.length > 0) {
            const partNumbersNeeded = stillMissingListings
                .map((l) => l.cManufacturerPartNumber?.trim() || l.cOeOemPartNumber?.trim())
                .filter((pn) => Boolean(pn));
            if (partNumbersNeeded.length > 0) {
                try {
                    const driveResults = await this.imageDriveService.findByPartNumbers(partNumbersNeeded);
                    let driveLinked = 0;
                    let driveCatalogLinked = 0;
                    const driveMatchedParts = new Set();
                    const productsBySku = new Map();
                    const productsByPartNumber = new Map();
                    for (const product of products) {
                        if (product.sku?.trim()) {
                            productsBySku.set(product.sku.trim(), product);
                        }
                        for (const rawPartNumber of [
                            product.mpn,
                            product.mpnNormalized,
                            product.oemPartNumber,
                        ]) {
                            const normalizedPartNumber = rawPartNumber
                                ? image_drive_service_js_1.ImageDriveService.normalizePartNumber(rawPartNumber)
                                : '';
                            if (normalizedPartNumber) {
                                productsByPartNumber.set(normalizedPartNumber, product);
                            }
                        }
                    }
                    for (const listing of stillMissingListings) {
                        if ((0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(listing.itemPhotoUrl))
                            continue;
                        const pn = listing.cManufacturerPartNumber?.trim() ||
                            listing.cOeOemPartNumber?.trim();
                        if (!pn)
                            continue;
                        const normalized = image_drive_service_js_1.ImageDriveService.normalizePartNumber(pn);
                        const images = driveResults[normalized];
                        if (!images?.length)
                            continue;
                        const urls = images.map((img) => img.cdnUrl).slice(0, 24);
                        listing.itemPhotoUrl = urls.join('|');
                        await this.listingRepo.save(listing);
                        driveLinked++;
                        driveMatchedParts.add(normalized);
                        const product = productsBySku.get(listing.customLabelSku?.trim() || '') ||
                            productsByPartNumber.get(normalized);
                        if (product && !(0, pipeline_image_matching_util_js_1.hasHttpImageUrls)(product.imageUrls)) {
                            product.imageUrls = urls;
                            await this.productRepo.save(product);
                            driveCatalogLinked++;
                        }
                    }
                    if (driveLinked > 0) {
                        this.logger.log(`Job ${jobId}: Image Drive auto-attached images for ${driveLinked} listing(s) and ${driveCatalogLinked} catalog product(s) across ${driveMatchedParts.size} part number(s)`);
                    }
                    if (driveMatchedParts.size > 0) {
                        const latestJob = await this.jobRepo.findOneBy({ id: jobId });
                        await this.jobRepo.update(jobId, {
                            stageDetails: {
                                ...(latestJob?.stageDetails ?? {}),
                                imageDrive: {
                                    matchedPartNumbers: driveMatchedParts.size,
                                    listingsLinked: driveLinked,
                                    catalogProductsLinked: driveCatalogLinked,
                                },
                            },
                        });
                    }
                }
                catch (err) {
                    this.logger.warn(`Job ${jobId}: Image Drive lookup failed: ${err instanceof Error ? err.message : err}`);
                }
            }
        }
    }
    async syncResolvedImagesToOutput(jobId, outputDir) {
        const [listings, products] = await Promise.all([
            this.listingRepo.find({ where: { pipelineJobId: jobId } }),
            this.productRepo.find({ where: { pipelineJobId: jobId } }),
        ]);
        const productsBySku = new Map();
        for (const product of products) {
            const sku = product.sku?.trim().toLowerCase();
            if (sku)
                productsBySku.set(sku, product);
        }
        const imagesBySku = new Map();
        const missingParts = [];
        let listingsWithImages = 0;
        for (const listing of listings) {
            const sku = listing.customLabelSku?.trim() ?? '';
            const product = sku ? productsBySku.get(sku.toLowerCase()) : undefined;
            const urls = (0, pipeline_image_matching_util_js_1.mergeImageUrls)((0, pipeline_image_matching_util_js_1.parseImageUrlPipe)(listing.itemPhotoUrl), product?.imageUrls ?? []);
            if (urls.length > 0) {
                listingsWithImages++;
                if (sku)
                    imagesBySku.set(sku.toLowerCase(), urls);
                const imagePipe = urls.join('|');
                if (listing.itemPhotoUrl !== imagePipe) {
                    listing.itemPhotoUrl = imagePipe;
                    await this.listingRepo.save(listing);
                }
                continue;
            }
            missingParts.push({
                sku: sku || null,
                partNumber: listing.cManufacturerPartNumber?.trim() ||
                    listing.cOeOemPartNumber?.trim() ||
                    null,
            });
        }
        const output = await this.pipelineOutputImages.applyResolvedImagesToOutputDir(jobId, outputDir, imagesBySku);
        const latestJob = await this.jobRepo.findOneBy({ id: jobId });
        const stageDetails = latestJob?.stageDetails ?? {};
        const currentImageDrive = stageDetails.imageDrive &&
            typeof stageDetails.imageDrive === 'object' &&
            !Array.isArray(stageDetails.imageDrive)
            ? stageDetails.imageDrive
            : {};
        await this.jobRepo.update(jobId, {
            stageDetails: {
                ...stageDetails,
                imageDrive: {
                    ...currentImageDrive,
                    imageCoverage: {
                        totalListings: listings.length,
                        listingsWithImages,
                        listingsMissingImages: missingParts.length,
                        outputFilesUpdated: output.filesUpdated,
                        outputRowsUpdated: output.rowsUpdated,
                        missingParts: missingParts.slice(0, 50),
                        missingPartsTruncated: missingParts.length > 50,
                        synchronizedAt: new Date().toISOString(),
                    },
                },
            },
        });
        if (missingParts.length > 0) {
            this.logger.warn('Job ' +
                jobId +
                ': Image coverage is ' +
                listingsWithImages +
                '/' +
                listings.length +
                '; ' +
                missingParts.length +
                ' listing(s) have no catalog or Image Drive image');
        }
    }
    async syncPipelineImageDrive(jobId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        const stageDetails = job?.stageDetails ?? {};
        const sourceListingIds = stageDetails.sourceListingIds;
        const uploadedAssetIds = stageDetails.uploadedAssetIds;
        if (sourceListingIds?.length || uploadedAssetIds?.length)
            return;
        const pipelineListings = await this.listingRepo.find({
            where: { pipelineJobId: jobId },
        });
        const partNumbersNeeded = pipelineListings
            .flatMap((listing) => [
            listing.cManufacturerPartNumber?.trim(),
            listing.cOeOemPartNumber?.trim(),
            listing.customLabelSku?.trim(),
        ])
            .filter((partNumber) => Boolean(partNumber));
        if (partNumbersNeeded.length === 0)
            return;
        try {
            const driveResults = await this.imageDriveService.findByPartNumbers(partNumbersNeeded);
            const products = await this.productRepo.find({
                where: { pipelineJobId: jobId },
            });
            const productsBySku = new Map();
            const productsByPartNumber = new Map();
            for (const product of products) {
                const sku = product.sku?.trim();
                if (sku)
                    productsBySku.set(sku, product);
                for (const rawPartNumber of [
                    product.mpn,
                    product.mpnNormalized,
                    product.oemPartNumber,
                ]) {
                    const normalizedPartNumber = rawPartNumber
                        ? image_drive_service_js_1.ImageDriveService.normalizePartNumber(rawPartNumber)
                        : '';
                    if (normalizedPartNumber) {
                        productsByPartNumber.set(normalizedPartNumber, product);
                    }
                }
            }
            const driveMatchedParts = new Set();
            let driveMatchedListings = 0;
            let driveLinked = 0;
            let driveCatalogLinked = 0;
            for (const listing of pipelineListings) {
                const normalizedPartNumbers = [
                    listing.cManufacturerPartNumber?.trim(),
                    listing.cOeOemPartNumber?.trim(),
                    listing.customLabelSku?.trim(),
                ]
                    .filter((partNumber) => Boolean(partNumber))
                    .map((partNumber) => image_drive_service_js_1.ImageDriveService.normalizePartNumber(partNumber))
                    .filter((partNumber, index, all) => partNumber.length > 0 && all.indexOf(partNumber) === index);
                const driveUrls = (0, pipeline_image_matching_util_js_1.mergeImageUrls)([], normalizedPartNumbers.flatMap((normalizedPartNumber) => {
                    const images = driveResults[normalizedPartNumber] ?? [];
                    if (images.length > 0)
                        driveMatchedParts.add(normalizedPartNumber);
                    return images.map((image) => image.cdnUrl);
                }));
                if (driveUrls.length === 0)
                    continue;
                driveMatchedListings++;
                const mergedListingUrls = (0, pipeline_image_matching_util_js_1.mergeImageUrls)((0, pipeline_image_matching_util_js_1.parseImageUrlPipe)(listing.itemPhotoUrl), driveUrls);
                const mergedListingPipe = mergedListingUrls.join('|');
                if (mergedListingPipe && listing.itemPhotoUrl !== mergedListingPipe) {
                    listing.itemPhotoUrl = mergedListingPipe;
                    await this.listingRepo.save(listing);
                    driveLinked++;
                }
                const product = productsBySku.get(listing.customLabelSku?.trim() || '') ||
                    normalizedPartNumbers
                        .map((normalizedPartNumber) => productsByPartNumber.get(normalizedPartNumber))
                        .find((candidate) => Boolean(candidate));
                if (!product)
                    continue;
                const mergedProductUrls = (0, pipeline_image_matching_util_js_1.mergeImageUrls)(product.imageUrls ?? [], driveUrls);
                if (mergedProductUrls.join('|') !== (product.imageUrls ?? []).join('|')) {
                    product.imageUrls = mergedProductUrls;
                    await this.productRepo.save(product);
                    driveCatalogLinked++;
                }
            }
            if (driveMatchedParts.size > 0) {
                const latestJob = await this.jobRepo.findOneBy({ id: jobId });
                await this.jobRepo.update(jobId, {
                    stageDetails: {
                        ...(latestJob?.stageDetails ?? {}),
                        imageDrive: {
                            matchedPartNumbers: driveMatchedParts.size,
                            matchedListings: driveMatchedListings,
                            listingsLinked: driveLinked,
                            catalogProductsLinked: driveCatalogLinked,
                        },
                    },
                });
            }
            this.logger.log(`Job ${jobId}: Image Drive matched ${driveMatchedListings} listing(s) and attached images to ${driveLinked} listing(s) and ${driveCatalogLinked} catalog product(s) across ${driveMatchedParts.size} part number(s)`);
        }
        catch (err) {
            this.logger.warn(`Job ${jobId}: Image Drive synchronization failed: ${err instanceof Error ? err.message : err}`);
        }
    }
    async saveToCatalog(jobId, outputDir, originalFilename) {
        const dbJob = await this.jobRepo.findOneBy({ id: jobId });
        const jobMarketplace = (0, pipeline_marketplaces_js_1.isPipelineMarketplaceCode)(dbJob?.marketplace ?? '')
            ? dbJob.marketplace
            : null;
        const marketplaces = (0, pipeline_marketplaces_js_1.resolveJobOutputMarketplaces)(jobMarketplace);
        let catalogUpserted = false;
        for (const marketplace of marketplaces) {
            const didUpsertCatalog = await this.saveMarketplaceToCatalog(jobId, outputDir, marketplace, originalFilename, !catalogUpserted);
            if (didUpsertCatalog)
                catalogUpserted = true;
        }
    }
    async saveMarketplaceToCatalog(jobId, outputDir, marketplace, originalFilename, upsertCatalogProducts = false) {
        const dbJob = await this.jobRepo.findOneBy({ id: jobId });
        const jobTeamId = dbJob?.teamId ?? null;
        const uploadConditionLabel = dbJob?.conditionLabel ?? null;
        const jobMarketplace = (0, pipeline_marketplaces_js_1.isPipelineMarketplaceCode)(dbJob?.marketplace ?? '')
            ? dbJob.marketplace
            : null;
        const jobProfiles = {
            shipping: dbJob?.shippingProfileName?.trim() || null,
            return: dbJob?.returnProfileName?.trim() || null,
            payment: dbJob?.paymentProfileName?.trim() || null,
        };
        const applyToOutput = (0, pipeline_marketplaces_js_1.shouldApplyJobProfilesToOutput)(marketplace, jobMarketplace);
        const applyToCatalogMaster = upsertCatalogProducts &&
            (0, pipeline_marketplaces_js_1.shouldApplyJobProfilesToCatalogMaster)(jobMarketplace, marketplace);
        const resolveProfile = (rowValue, jobDefault, applyDefault) => {
            const trimmed = rowValue?.trim();
            if (trimmed)
                return trimmed;
            if (applyDefault && jobDefault)
                return jobDefault;
            return null;
        };
        const uploadConditionId = uploadConditionLabel
            ? ({ Used: '3000', New: '1000', Refurbished: '2500' }[uploadConditionLabel] ?? null)
            : null;
        const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
        const matchesMarketplace = (f) => {
            const lower = f.toLowerCase();
            if (marketplace === 'US')
                return lower.includes('us-motors') || lower.includes('us_motors');
            if (marketplace === 'UK')
                return lower.startsWith('uk-') || lower.startsWith('uk_');
            if (marketplace === 'AU')
                return lower.startsWith('au-') || lower.startsWith('au_');
            return lower.startsWith('de-') || lower.startsWith('de_');
        };
        const candidates = files.filter(matchesMarketplace);
        const mktFile = candidates.length > 1
            ? candidates
                .map((f) => ({
                f,
                mtime: fs.statSync(path.join(outputDir, f)).mtimeMs,
            }))
                .sort((a, b) => b.mtime - a.mtime)[0].f
            : candidates[0];
        if (!mktFile) {
            this.logger.warn(`Job ${jobId}: No ${marketplace} output file found for catalog save`);
            return false;
        }
        const mktPath = path.join(outputDir, mktFile);
        try {
            this.scheduleCatalogImportProgress(jobId, { phase: 'parsing', marketplace, processed: 0, total: 1 }, true);
            const wb = XLSX.readFile(mktPath);
            const ws = wb.Sheets['Listings'] ?? wb.Sheets[wb.SheetNames[0]];
            if (!ws) {
                this.logger.warn(`Job ${jobId}: No Listings sheet in ${marketplace} output`);
                return false;
            }
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            let headerIdx = -1;
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const row = rows[i];
                if (row?.some((h) => h && /title/i.test(String(h)) && !/info/i.test(String(h)))) {
                    headerIdx = i;
                    break;
                }
            }
            if (headerIdx === -1) {
                this.logger.warn(`Job ${jobId}: Could not find header row in ${marketplace} output`);
                return false;
            }
            const headers = rows[headerIdx].map((h) => String(h ?? '').trim());
            const colIdx = (name) => {
                const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return headers.findIndex((h) => h
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '')
                    .includes(norm));
            };
            const colExact = (pattern) => headers.findIndex((h) => pattern.test(String(h ?? '').trim()));
            const isDE = marketplace === 'DE';
            const iAction = colIdx('Action');
            const iSku = colIdx('Customlabel');
            const iCategoryId = colIdx('CategoryID');
            const iCategoryName = colIdx('CategoryName');
            const iTitle = colIdx('Title');
            const iPrice = colIdx('Startprice');
            const iQty = colIdx('Quantity');
            const iConditionId = colIdx('ConditionID');
            const iDesc = colIdx('Description');
            const iFormat = colIdx('Format');
            const iDuration = colIdx('Duration');
            const iLocation = colIdx('Location');
            const iPicUrl = headers.findIndex((h) => /picurl|item\s*photo\s*url/i.test(h));
            const iShipping = colIdx('Shippingprofilename');
            const iReturn = colIdx('Returnprofilename');
            const iPayment = colIdx('Paymentprofilename');
            const iBrand = !isDE
                ? headers.findIndex((h) => /^C:Brand$/i.test(h))
                : headers.findIndex((h) => /^C:Hersteller$/i.test(h));
            const iType = !isDE
                ? headers.findIndex((h) => /^C:Type$/i.test(h))
                : headers.findIndex((h) => /^C:Produktart$/i.test(h));
            const iMpn = !isDE
                ? headers.findIndex((h) => /C:Manufacturer\s*Part\s*Number/i.test(h))
                : headers.findIndex((h) => /C:Herstellernummer/i.test(h));
            const iOem = !isDE
                ? headers.findIndex((h) => /C:OE.*OEM.*Part.*Number/i.test(h))
                : headers.findIndex((h) => /C:OE.*OEM.*Referenznummer/i.test(h));
            const iPlacement = !isDE
                ? headers.findIndex((h) => /C:Placement/i.test(h))
                : headers.findIndex((h) => /C:Einbauposition/i.test(h));
            const iMaterial = !isDE
                ? headers.findIndex((h) => /^C:Material$/i.test(h))
                : headers.findIndex((h) => /^C:Material$|^C:Material\b/i.test(h));
            const iFeatures = !isDE
                ? headers.findIndex((h) => /^C:Features$/i.test(h))
                : headers.findIndex((h) => /^C:Merkmale$|^C:Features$/i.test(h));
            const iCountry = !isDE
                ? headers.findIndex((h) => /C:Country/i.test(h))
                : headers.findIndex((h) => /C:Herstellungsland/i.test(h));
            const iRelationship = colExact(/^Relationship$/i);
            const iRelationshipDetails = colExact(/^Relationship\s*details$/i);
            const get = (row, idx) => idx >= 0 && row[idx] != null ? String(row[idx]).trim() : '';
            const sanitizeSku = (raw) => {
                let s = raw.trim();
                if (!s)
                    return '';
                if ((s.startsWith('"') && s.endsWith('"')) ||
                    (s.startsWith("'") && s.endsWith("'"))) {
                    s = s.slice(1, -1);
                }
                return s
                    .replace(/[\r\n\t]+/g, '')
                    .replace(/\s+/g, '')
                    .trim();
            };
            const products = [];
            const listingRecords = [];
            const compatibilities = new Map();
            let currentProductIdx = -1;
            for (let i = headerIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0)
                    continue;
                const relationship = get(row, iRelationship);
                if (relationship === 'Compatibility') {
                    if (currentProductIdx >= 0) {
                        const details = get(row, iRelationshipDetails);
                        if (details) {
                            const parts = {};
                            details.split('|').forEach((pair) => {
                                const [k, ...v] = pair.split('=');
                                if (k && v.length)
                                    parts[k.trim()] = v.join('=').trim();
                            });
                            const make = parts['Make'] || '';
                            const model = parts['Model'] || '';
                            const year = parts['Year'] || '';
                            if (make && model && year) {
                                if (!compatibilities.has(currentProductIdx))
                                    compatibilities.set(currentProductIdx, []);
                                compatibilities.get(currentProductIdx).push({
                                    Make: make,
                                    Model: model,
                                    Year: year,
                                    ...(parts['Trim'] ? { Trim: parts['Trim'] } : {}),
                                    ...(parts['Engine'] ? { Engine: parts['Engine'] } : {}),
                                    ...(parts['Submodel'] ? { Submodel: parts['Submodel'] } : {}),
                                });
                            }
                        }
                    }
                    continue;
                }
                const action = get(row, iAction).toLowerCase();
                if (!action || action === 'info')
                    continue;
                const title = get(row, iTitle);
                if (!title)
                    continue;
                const sku = sanitizeSku(get(row, iSku));
                const priceStr = get(row, iPrice);
                const price = priceStr ? parseFloat(priceStr) : null;
                const qtyStr = get(row, iQty);
                const quantity = qtyStr ? parseInt(qtyStr, 10) : null;
                const picUrl = get(row, iPicUrl);
                const imageUrls = picUrl ? picUrl.split('|').filter(Boolean) : [];
                for (let ai = 0; ai <= 22; ai++) {
                    const colName = ai === 0 ? 'AdditionalPicURL' : `AdditionalPicURL${ai}`;
                    const addIdx = headers.indexOf(colName);
                    if (addIdx >= 0) {
                        const url = get(row, addIdx);
                        if (url)
                            imageUrls.push(url);
                    }
                }
                const brandRaw = get(row, iBrand);
                const brand = brandRaw ? (0, listing_guards_js_1.normalizeBrand)(brandRaw) : '';
                const mpn = get(row, iMpn);
                const { make: extractedMake, model: extractedModel } = (0, extract_make_model_from_title_js_1.extractMakeModelFromTitle)(title || null);
                currentProductIdx = products.length;
                products.push({
                    sku: sku || null,
                    title,
                    description: get(row, iDesc) || null,
                    brand: brand || null,
                    brandNormalized: brand ? brand.toLowerCase().trim() : null,
                    mpn: mpn || null,
                    mpnNormalized: mpn ? mpn.toLowerCase().replace(/[\s\-]/g, '') : null,
                    partType: get(row, iType) || null,
                    placement: get(row, iPlacement) || null,
                    material: get(row, iMaterial) || null,
                    features: get(row, iFeatures) || null,
                    countryOfOrigin: get(row, iCountry) || null,
                    oemPartNumber: get(row, iOem) || null,
                    price,
                    quantity,
                    conditionId: get(row, iConditionId) || uploadConditionId || null,
                    conditionLabel: uploadConditionLabel || null,
                    categoryId: get(row, iCategoryId) || null,
                    categoryName: get(row, iCategoryName) || null,
                    imageUrls,
                    location: get(row, iLocation) || null,
                    format: get(row, iFormat) || null,
                    duration: get(row, iDuration) || null,
                    shippingProfile: resolveProfile(get(row, iShipping), jobProfiles.shipping, applyToOutput || applyToCatalogMaster),
                    returnProfile: resolveProfile(get(row, iReturn), jobProfiles.return, applyToOutput || applyToCatalogMaster),
                    paymentProfile: resolveProfile(get(row, iPayment), jobProfiles.payment, applyToOutput || applyToCatalogMaster),
                    sourceFile: originalFilename ?? mktFile,
                    sourceRow: i,
                    pipelineJobId: jobId,
                    teamId: jobTeamId,
                });
                listingRecords.push({
                    sourceFileName: mktFile,
                    sourceFilePath: mktPath,
                    origin: listing_record_entity_js_1.ListingOrigin.PIPELINE_IMPORT,
                    sheetName: `Pipeline ${jobId.slice(0, 8)}`,
                    sourceRowNumber: i,
                    action: 'Add',
                    customLabelSku: sku || null,
                    categoryId: get(row, iCategoryId) || null,
                    categoryName: get(row, iCategoryName) || null,
                    title,
                    startPrice: priceStr || null,
                    startPriceNum: price,
                    quantity: qtyStr || null,
                    quantityNum: quantity,
                    itemPhotoUrl: imageUrls.join('|') || null,
                    conditionId: get(row, iConditionId) || uploadConditionId || null,
                    description: get(row, iDesc) || null,
                    format: get(row, iFormat) || null,
                    duration: get(row, iDuration) || null,
                    location: get(row, iLocation) || null,
                    shippingProfileName: resolveProfile(get(row, iShipping), jobProfiles.shipping, applyToOutput || applyToCatalogMaster),
                    returnProfileName: resolveProfile(get(row, iReturn), jobProfiles.return, applyToOutput || applyToCatalogMaster),
                    paymentProfileName: resolveProfile(get(row, iPayment), jobProfiles.payment, applyToOutput || applyToCatalogMaster),
                    cBrand: brand || null,
                    cType: get(row, iType) || null,
                    cFeatures: get(row, iFeatures) || null,
                    cManufacturerPartNumber: mpn || null,
                    cOeOemPartNumber: get(row, iOem) || null,
                    extractedMake,
                    extractedModel,
                });
            }
            for (const lr of listingRecords) {
                lr.pipelineJobId = jobId;
                lr.marketplace = marketplace;
                lr.teamId = jobTeamId;
                lr.version = 1;
            }
            for (const [idx, fitments] of compatibilities) {
                if (products[idx]) {
                    products[idx].fitmentData = fitments;
                }
            }
            const importTotal = Math.max(products.length, listingRecords.length);
            this.scheduleCatalogImportProgress(jobId, {
                phase: 'parsing',
                marketplace,
                processed: importTotal,
                total: importTotal,
            }, true);
            const categoryConcurrency = Math.max(1, Number(process.env.PIPELINE_CATEGORY_GUARD_CONCURRENCY ?? '8') || 8);
            let categoryCorrections = 0;
            await this.mapWithConcurrency(products, categoryConcurrency, async (product, index) => {
                const resolved = await this.enterpriseListingIntelligence.resolvePublishableCategory(product);
                const changed = product.categoryId !== resolved.categoryId ||
                    product.categoryName !== resolved.categoryName;
                product.categoryId = resolved.categoryId;
                product.categoryName = resolved.categoryName;
                if (listingRecords[index]) {
                    listingRecords[index].categoryId = resolved.categoryId;
                    listingRecords[index].categoryName = resolved.categoryName;
                }
                if (changed)
                    categoryCorrections++;
            });
            if (categoryCorrections > 0) {
                this.logger.warn(`Job ${jobId} [${marketplace}]: category guard corrected ${categoryCorrections}/${products.length} rows before persistence`);
            }
            let mvlRejectedTotal = 0;
            let mvlValidatedTotal = 0;
            const skipMvlOnImport = await this.shouldSkipMvlOnImport();
            if (!skipMvlOnImport) {
                let mvlProcessed = 0;
                const mvlConcurrency = Math.max(1, Number(process.env.PIPELINE_MVL_IMPORT_CONCURRENCY ?? '8') || 8);
                const treeId = (0, ebay_marketplace_tree_util_js_1.resolveCategoryTreeId)(marketplace);
                await this.mapWithConcurrency(products, mvlConcurrency, async (product) => {
                    const rawFitment = product.fitmentData;
                    if (Array.isArray(rawFitment) && rawFitment.length > 0) {
                        const categoryId = product.categoryId?.trim() ||
                            ebay_mvl_service_js_1.EbayMvlService.MOTORS_PARTS_CATEGORY;
                        try {
                            const mvlResult = await this.mvlService.validateFitmentData(rawFitment, categoryId, { treeId });
                            product.fitmentData = mvlResult.accepted;
                            mvlRejectedTotal += mvlResult.rejectedCount;
                            mvlValidatedTotal += mvlResult.validCount;
                            if (mvlResult.apiUnavailable) {
                                this.logger.warn(`Job ${jobId} [${marketplace}]: eBay MVL API unavailable — fitment kept as needs_review where possible`);
                            }
                        }
                        catch (err) {
                            this.logger.warn(`Job ${jobId} [${marketplace}]: MVL validation failed for SKU ${product.sku ?? '?'}: ${err instanceof Error ? err.message : err}`);
                        }
                    }
                    mvlProcessed++;
                    if (mvlProcessed % 10 === 0 || mvlProcessed === products.length) {
                        this.scheduleCatalogImportProgress(jobId, {
                            phase: 'mvl',
                            marketplace,
                            processed: mvlProcessed,
                            total: products.length,
                        });
                    }
                });
            }
            else {
                this.logger.log(`Job ${jobId} [${marketplace}]: PIPELINE_SKIP_MVL_ON_IMPORT — using fitment from pipeline output as-is`);
                if (products.length > 0) {
                    this.scheduleCatalogImportProgress(jobId, {
                        phase: 'mvl',
                        marketplace,
                        processed: products.length,
                        total: products.length,
                    }, true);
                }
            }
            if (mvlRejectedTotal > 0 || mvlValidatedTotal > 0) {
                this.logger.log(`Job ${jobId} [${marketplace}]: MVL validation — ${mvlValidatedTotal} valid, ${mvlRejectedTotal} rejected`);
            }
            this.logger.log(`Job ${jobId} [${marketplace}]: Parsed ${products.length} products, ${listingRecords.length} listing records from ${mktFile}`);
            if (products.length > 0 && upsertCatalogProducts) {
                const CHUNK = 500;
                const skusToMerge = products
                    .map((p) => p.sku?.trim())
                    .filter((s) => Boolean(s));
                if (skusToMerge.length > 0) {
                    const existingProducts = await this.productRepo.find({
                        where: { sku: (0, typeorm_2.In)(skusToMerge) },
                    });
                    const existingBySku = new Map(existingProducts.map((p) => [p.sku, p]));
                    for (const product of products) {
                        if ((!product.imageUrls || product.imageUrls.length === 0) &&
                            product.sku) {
                            const existing = existingBySku.get(product.sku);
                            if (existing?.imageUrls?.length) {
                                product.imageUrls = existing.imageUrls;
                            }
                        }
                    }
                }
                const upsertColumns = [
                    'title',
                    'description',
                    'brand',
                    'brand_normalized',
                    'mpn',
                    'mpn_normalized',
                    'part_type',
                    'placement',
                    'material',
                    'features',
                    'country_of_origin',
                    'oem_part_number',
                    'price',
                    'quantity',
                    'condition_id',
                    'category_id',
                    'category_name',
                    'image_urls',
                    'location',
                    'format',
                    'duration',
                    'shipping_profile',
                    'return_profile',
                    'payment_profile',
                    'source_file',
                    'source_row',
                    'pipeline_job_id',
                    'fitment_data',
                ];
                const dedupedProductMap = new Map();
                const productsNoSku = [];
                for (const p of products) {
                    const s = p.sku?.trim();
                    if (s)
                        dedupedProductMap.set(s, p);
                    else
                        productsNoSku.push(p);
                }
                const dedupedProducts = [
                    ...dedupedProductMap.values(),
                    ...productsNoSku,
                ];
                if (dedupedProducts.length < products.length) {
                    this.logger.warn(`Job ${jobId} [${marketplace}]: Deduplicated ${products.length} → ${dedupedProducts.length} catalog products by SKU`);
                }
                const withFitment = dedupedProducts.filter((p) => Array.isArray(p.fitmentData) &&
                    p.fitmentData.length > 0).length;
                for (let i = 0; i < dedupedProducts.length; i += CHUNK) {
                    const batch = dedupedProducts.slice(i, i + CHUNK);
                    const withSku = batch.filter((p) => p.sku?.trim());
                    const withoutSku = batch.filter((p) => !p.sku?.trim());
                    if (withSku.length > 0) {
                        await this.productRepo
                            .createQueryBuilder()
                            .insert()
                            .into(catalog_product_entity_js_1.CatalogProduct)
                            .values(withSku)
                            .orUpdate([...upsertColumns], ['sku'])
                            .execute();
                    }
                    if (withoutSku.length > 0) {
                        await this.productRepo
                            .createQueryBuilder()
                            .insert()
                            .into(catalog_product_entity_js_1.CatalogProduct)
                            .values(withoutSku)
                            .orIgnore()
                            .execute();
                    }
                    this.scheduleCatalogImportProgress(jobId, {
                        phase: 'saving',
                        marketplace,
                        processed: Math.min(i + batch.length, dedupedProducts.length),
                        total: importTotal,
                    });
                }
                this.logger.log(`Job ${jobId} [${marketplace}]: Saved ${dedupedProducts.length} products to catalog (${withFitment} with fitment rows)`);
            }
            else if (products.length > 0) {
                this.logger.log(`Job ${jobId} [${marketplace}]: Skipped catalog_products upsert (master catalog uses US output only)`);
            }
            if (listingRecords.length > 0) {
                if (!(products.length > 0 && upsertCatalogProducts)) {
                    this.scheduleCatalogImportProgress(jobId, {
                        phase: 'saving',
                        marketplace,
                        processed: 0,
                        total: importTotal,
                    }, true);
                }
                const batchSkus = Array.from(new Set(listingRecords
                    .map((lr) => lr.customLabelSku?.trim())
                    .filter((s) => Boolean(s))));
                const existingRows = batchSkus.length > 0
                    ? await this.listingRepo.query(`SELECT id, "customLabelSku" FROM "listing_records" WHERE "marketplace" = $1 AND "customLabelSku" = ANY($2) AND "deletedAt" IS NULL`, [marketplace, batchSkus])
                    : [];
                const activeIdBySku = (0, pipeline_listing_routing_util_js_1.buildActiveIdBySku)(existingRows);
                const { rowsToUpdate, rowsToInsert, droppedDuplicates } = (0, pipeline_listing_routing_util_js_1.routePipelineListingRecords)(listingRecords, activeIdBySku);
                this.logger.log(`Job ${jobId} [${marketplace}]: listing record routing — ${listingRecords.length} parsed, ${batchSkus.length} unique SKUs, ${existingRows.length} active in DB, ${rowsToUpdate.length} to update, ${rowsToInsert.length} to insert (new or after soft-delete), ${droppedDuplicates} dropped (dupes)`);
                let updatedCount = 0;
                const UPDATE_CONCURRENCY = 10;
                for (let i = 0; i < rowsToUpdate.length; i += UPDATE_CONCURRENCY) {
                    const slice = rowsToUpdate.slice(i, i + UPDATE_CONCURRENCY);
                    await Promise.all(slice.map(async ({ id, lr }) => {
                        const patch = {
                            ...lr,
                        };
                        delete patch.version;
                        if (!String(patch.itemPhotoUrl ?? '').trim())
                            delete patch.itemPhotoUrl;
                        try {
                            await this.listingRepo.update({ id }, patch);
                            updatedCount++;
                        }
                        catch (updErr) {
                            this.logger.error(`Job ${jobId} [${marketplace}]: listing update failed for row ${lr.sourceRowNumber}: ${updErr instanceof Error ? updErr.message : updErr}`);
                        }
                    }));
                    this.scheduleCatalogImportProgress(jobId, {
                        phase: 'saving',
                        marketplace,
                        processed: Math.min(i + UPDATE_CONCURRENCY, rowsToUpdate.length),
                        total: importTotal,
                    });
                }
                let insertedCount = 0;
                const CHUNK = 500;
                const PROP_TO_COL = {
                    sourceFileName: 'sourceFileName',
                    sourceFilePath: 'sourceFilePath',
                    origin: 'origin',
                    sheetName: 'sheetName',
                    sourceRowNumber: 'sourceRowNumber',
                    action: 'action',
                    customLabelSku: 'customLabelSku',
                    categoryId: 'categoryId',
                    categoryName: 'categoryName',
                    title: 'title',
                    startPrice: 'startPrice',
                    startPriceNum: 'startPriceNum',
                    quantity: 'quantity',
                    quantityNum: 'quantityNum',
                    itemPhotoUrl: 'itemPhotoUrl',
                    conditionId: 'conditionId',
                    description: 'description',
                    format: 'format',
                    duration: 'duration',
                    location: 'location',
                    shippingProfileName: 'shippingProfileName',
                    returnProfileName: 'returnProfileName',
                    paymentProfileName: 'paymentProfileName',
                    cBrand: 'cBrand',
                    cType: 'cType',
                    cFeatures: 'cFeatures',
                    cManufacturerPartNumber: 'cManufacturerPartNumber',
                    cOeOemPartNumber: 'cOeOemPartNumber',
                    extractedMake: 'extractedMake',
                    extractedModel: 'extractedModel',
                    pipelineJobId: 'pipeline_job_id',
                    marketplace: 'marketplace',
                    teamId: 'team_id',
                    version: 'version',
                };
                const ALL_COLS = Object.values(PROP_TO_COL);
                for (let i = 0; i < rowsToInsert.length; i += CHUNK) {
                    try {
                        const batch = rowsToInsert.slice(i, i + CHUNK);
                        const values = [];
                        const rowsSql = [];
                        let paramIdx = 0;
                        for (const lr of batch) {
                            const rowParams = [];
                            for (const [prop] of Object.entries(PROP_TO_COL)) {
                                paramIdx++;
                                rowParams.push(`$${paramIdx}`);
                                values.push(lr[prop] ?? null);
                            }
                            rowsSql.push(`(${rowParams.join(', ')})`);
                        }
                        const colList = ALL_COLS.map((c) => `"${c}"`).join(', ');
                        const sql = `
              INSERT INTO "listing_records" (${colList})
              VALUES ${rowsSql.join(',\n')}
              ON CONFLICT ("sourceFileName", "sheetName", "sourceRowNumber") DO NOTHING
              RETURNING id
            `;
                        const result = await this.listingRepo.query(sql, values);
                        insertedCount += result?.length ?? 0;
                    }
                    catch (insertErr) {
                        const batchEnd = Math.min(i + CHUNK, rowsToInsert.length);
                        this.logger.error(`Job ${jobId} [${marketplace}]: Listing insert failed (offset ${i}-${batchEnd} of ${rowsToInsert.length}): ${insertErr instanceof Error ? insertErr.message : insertErr}`);
                        if (insertErr instanceof Error && insertErr.stack) {
                            this.logger.error(`Stack: ${insertErr.stack.slice(0, 500)}`);
                        }
                        if (rowsToInsert[i]) {
                            const sample = rowsToInsert[i];
                            this.logger.error(`Sample row: sku=${sample.customLabelSku}, sourceFileName=${sample.sourceFileName}, sheetName=${sample.sheetName}, sourceRowNumber=${sample.sourceRowNumber}`);
                        }
                    }
                    this.scheduleCatalogImportProgress(jobId, {
                        phase: 'saving',
                        marketplace,
                        processed: Math.min(i + CHUNK, rowsToInsert.length),
                        total: importTotal,
                    });
                }
                this.logger.log(`Job ${jobId} [${marketplace}]: listing records — updated ${updatedCount}, inserted ${insertedCount} (of ${listingRecords.length})`);
                if (jobTeamId && batchSkus.length > 0) {
                    const synced = await this.listingRepo.query(`UPDATE "listing_records" SET team_id = $1
             WHERE "customLabelSku" = ANY($2) AND "deletedAt" IS NULL AND team_id IS DISTINCT FROM $1
             RETURNING id`, [jobTeamId, batchSkus]);
                    if (synced?.length) {
                        this.logger.log(`Job ${jobId} [${marketplace}]: synced team_id to ${synced.length} sibling row(s) across other marketplaces`);
                    }
                }
            }
            else {
                this.logger.warn(`Job ${jobId} [${marketplace}]: No listing records to insert (0 valid rows parsed)`);
            }
            if (importTotal > 0) {
                this.scheduleCatalogImportProgress(jobId, {
                    phase: 'saving',
                    marketplace,
                    processed: importTotal,
                    total: importTotal,
                }, true);
            }
            return upsertCatalogProducts && products.length > 0;
        }
        catch (err) {
            this.logger.error(`Job ${jobId} [${marketplace}]: Failed to save to catalog: ${err instanceof Error ? err.message : err}`);
            return false;
        }
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
};
exports.PipelineProcessor = PipelineProcessor;
exports.PipelineProcessor = PipelineProcessor = PipelineProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('pipeline', {
        concurrency: PIPELINE_WORKER_CONCURRENCY,
        lockDuration: 120 * 60 * 1000,
    }),
    __param(0, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __param(1, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(2, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(3, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __param(4, (0, bullmq_2.InjectQueue)('pipeline')),
    __param(5, (0, bullmq_2.InjectQueue)('listing-optimization')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository, Function, Function, pipeline_output_image_service_js_1.PipelineOutputImageService,
        ebay_mvl_service_js_1.EbayMvlService,
        ebay_mvl_store_service_js_1.EbayMvlStoreService,
        enterprise_listing_intelligence_service_js_1.EnterpriseListingIntelligenceService,
        image_drive_service_js_1.ImageDriveService])
], PipelineProcessor);
//# sourceMappingURL=pipeline.processor.js.map