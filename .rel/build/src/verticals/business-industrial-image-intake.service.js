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
var BusinessIndustrialImageIntakeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessIndustrialImageIntakeService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const bullmq_2 = require("bullmq");
const XLSX = __importStar(require("xlsx"));
const typeorm_2 = require("typeorm");
const node_crypto_1 = require("node:crypto");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const image_processor_service_js_1 = require("../storage/image-processor.service.js");
const openai_service_js_1 = require("../common/openai/openai.service.js");
const ai_run_log_service_js_1 = require("../common/openai/ai-run-log.service.js");
const model_router_js_1 = require("../common/openai/model-router.js");
const ebay_taxonomy_api_service_js_1 = require("../channels/ebay/ebay-taxonomy-api.service.js");
const ebay_browse_api_service_js_1 = require("../channels/ebay/ebay-browse-api.service.js");
const pricing_analysis_pipeline_js_1 = require("../common/openai/pipelines/pricing-analysis.pipeline.js");
const business_industrial_service_js_1 = require("./business-industrial.service.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const business_industrial_config_js_1 = require("./business-industrial.config.js");
const business_industrial_image_intake_asset_entity_js_1 = require("./entities/business-industrial-image-intake-asset.entity.js");
const business_industrial_image_intake_group_entity_js_1 = require("./entities/business-industrial-image-intake-group.entity.js");
const business_industrial_image_intake_job_entity_js_1 = require("./entities/business-industrial-image-intake-job.entity.js");
const business_industrial_image_intake_util_js_1 = require("./business-industrial-image-intake.util.js");
const MAX_BATCH_FILES = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_JOB_IMAGES = 5000;
const MAX_VISION_IMAGES = 12;
const DRIVE_FOLDER_CONCURRENCY = 2;
const DRIVE_IMAGE_CONCURRENCY = 4;
const GROUP_PROCESSING_CONCURRENCY = 2;
const DRIVE_DOWNLOAD_ATTEMPTS = 3;
const STALE_GROUP_PROCESSING_MS = 15 * 60 * 1000;
const LUNA_MODEL = 'openai/gpt-5.6-luna-20260709';
const PROMPT_VERSION = 'business-industrial-image-intake-v1';
const ENRICHMENT_PROMPT_VERSION = 'bi-listing-enrichment-v1';
const PRICING_PROMPT_VERSION = 'bi-pricing-v1';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_API_ROOT = 'https://www.googleapis.com/drive/v3/files';
const CATEGORY_FAMILY_IDS = new Set(business_industrial_config_js_1.BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES.map((family) => family.id));
const ENRICHMENT_SYSTEM_PROMPT = `You prepare a truthful, eBay-ready Business & Industrial listing from an evidence-backed identification.
Return JSON only:
{"optimizedTitle":string,"optimizedDescription":string,"keywords":string[],"itemSpecifics":object,"seoScore":number,"readinessScore":number,"warnings":string[]}
The title must be concise, searchable, and no more than 80 characters. Use only the supplied evidence. Do not invent compatibility, certifications, ratings, dimensions, condition, warranty, testing results, or included accessories. Keep uncertain facts out of the title and itemSpecifics. The description must clearly separate observed facts, condition, included items, missing items, and testing status. Scores are 0-100 and must reflect missing evidence; a high score never overrides compliance review.`;
const VISION_SYSTEM_PROMPT = `You identify photographed Business & Industrial inventory for an e-commerce listing draft. This is not automotive fitment classification.

Return JSON only with this shape:
{"title":string|null,"brand":string|null,"model":string|null,"mpn":string|null,"oemPartNumber":string|null,"partType":string|null,"categoryFamily":string|null,"categorySearchQuery":string|null,"conditionLabel":"NEW"|"USED"|"REFURBISHED"|"FOR_PARTS"|"UNKNOWN","description":string|null,"visibleText":string[],"features":string[],"warnings":string[],"includedComponents":string[],"missingParts":string[],"testing":string|null,"verticalAttributes":object,"confidence":{"overall":number,"brand":number,"mpn":number,"category":number,"condition":number,"technical":number},"priceEstimate":number|null}

Use only evidence visible in the images and the supplied folder name. Never invent an exact part number, model, compatibility claim, certification, technical specification, condition, or price. Put uncertain or unreadable values in warnings and use null/UNKNOWN. Choose categoryFamily only from these deliberate families: industrial_automation, electrical_equipment, machinery_tooling, hydraulics_pneumatics, test_measurement, material_handling, commercial_equipment, construction_safety, medical_laboratory, hazmat_chemical. Restricted families still require manual compliance review. Keep verticalAttributes flat and use explicit units for numeric fields when visible.`;
let BusinessIndustrialImageIntakeService = BusinessIndustrialImageIntakeService_1 = class BusinessIndustrialImageIntakeService {
    config;
    userOrgs;
    storage;
    imageProcessor;
    openai;
    aiRunLogs;
    modelRouter;
    taxonomy;
    businessIndustrial;
    ebayBrowse;
    pricingPipeline;
    intakeQueue;
    jobRepo;
    groupRepo;
    assetRepo;
    userRepo;
    listingRepo;
    catalogProductRepo;
    logger = new common_1.Logger(BusinessIndustrialImageIntakeService_1.name);
    constructor(config, userOrgs, storage, imageProcessor, openai, aiRunLogs, modelRouter, taxonomy, businessIndustrial, ebayBrowse, pricingPipeline, intakeQueue, jobRepo, groupRepo, assetRepo, userRepo, listingRepo, catalogProductRepo) {
        this.config = config;
        this.userOrgs = userOrgs;
        this.storage = storage;
        this.imageProcessor = imageProcessor;
        this.openai = openai;
        this.aiRunLogs = aiRunLogs;
        this.modelRouter = modelRouter;
        this.taxonomy = taxonomy;
        this.businessIndustrial = businessIndustrial;
        this.ebayBrowse = ebayBrowse;
        this.pricingPipeline = pricingPipeline;
        this.intakeQueue = intakeQueue;
        this.jobRepo = jobRepo;
        this.groupRepo = groupRepo;
        this.assetRepo = assetRepo;
        this.userRepo = userRepo;
        this.listingRepo = listingRepo;
        this.catalogProductRepo = catalogProductRepo;
    }
    async createJob(user, dto, organizationId) {
        await this.businessIndustrial.assertEnabled();
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const job = await this.jobRepo.save(this.jobRepo.create({
            organizationId: org.organizationId,
            createdByUserId: user.id,
            sourceRootName: dto.sourceRootName.trim(),
            sourceReferenceUrl: dto.sourceReferenceUrl?.trim() || null,
            status: 'pending',
            totalFolders: 0,
            totalImages: 0,
            processedFolders: 0,
            processedImages: 0,
            groupedParts: 0,
            failedFolders: 0,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
        }));
        return this.jobSummary(job);
    }
    async createDriveJob(user, dto, organizationId) {
        await this.businessIndustrial.assertEnabled();
        const folderId = this.parseDriveFolderId(dto.folderUrl);
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const job = await this.jobRepo.save(this.jobRepo.create({
            organizationId: org.organizationId,
            createdByUserId: user.id,
            sourceRootName: 'Google Drive import ' + folderId,
            sourceReferenceUrl: dto.folderUrl.trim(),
            status: 'processing',
            totalFolders: 0,
            totalImages: 0,
            processedFolders: 0,
            processedImages: 0,
            groupedParts: 0,
            failedFolders: 0,
            errorMessage: null,
            startedAt: new Date(),
            completedAt: null,
        }));
        try {
            await this.intakeQueue.add('import-drive', {
                jobId: job.id,
                maxItems: dto.maxItems,
                autoCreateDrafts: dto.autoCreateDrafts ?? true,
                skipFolderNames: dto.skipFolderNames ?? [],
            }, {
                jobId: 'bi-drive-intake-' + job.id,
                attempts: 2,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { count: 50 },
                removeOnFail: { count: 100 },
            });
        }
        catch (error) {
            job.status = 'failed';
            job.errorMessage =
                error instanceof Error ? error.message : 'Unable to queue Drive import';
            await this.jobRepo.save(job);
            throw error;
        }
        return this.jobSummary(job);
    }
    async listJobs(user, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const jobs = await this.jobRepo.find({
            where: { organizationId: org.organizationId },
            order: { createdAt: 'DESC' },
            take: 50,
        });
        return {
            jobs: await Promise.all(jobs.map((job) => this.jobSummary(job))),
        };
    }
    async getJob(user, id, organizationId) {
        return this.jobSummary(await this.findJob(user, id, organizationId));
    }
    async refreshBusinessIndustrialPrices(user, organizationId, limit = 200, onProgress, onlyMissing = false) {
        await this.businessIndustrial.assertEnabled();
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const productQuery = this.catalogProductRepo
            .createQueryBuilder('product')
            .where('product.organizationId = :organizationId', {
            organizationId: org.organizationId,
        })
            .andWhere('product.vertical = :vertical', {
            vertical: 'business_industrial',
        })
            .orderBy('product.updatedAt', 'ASC')
            .take(Math.min(Math.max(Number(limit) || 200, 1), 200));
        if (onlyMissing)
            productQuery.andWhere('(product.price IS NULL OR product.price <= 0)');
        const products = await productQuery.getMany();
        const results = [];
        let updated = 0;
        const startedAt = Date.now();
        for (const product of products) {
            const pricing = await this.getOptimalPrice({
                title: product.title,
                partNumber: product.mpn ?? product.oemPartNumber,
                brand: product.brand,
                condition: product.conditionLabel,
                fallbackPrice: null,
                model: LUNA_MODEL,
                sku: product.sku,
                partType: product.partType ?? 'business_industrial',
            });
            if (pricing.price === null) {
                results.push({
                    sku: product.sku,
                    catalogProductId: product.id,
                    status: 'skipped',
                    currentPrice: product.price,
                    pricing,
                });
                const processed = results.length;
                const rate = processed / Math.max((Date.now() - startedAt) / 1000, 1);
                onProgress?.({
                    processed,
                    total: products.length,
                    updated,
                    skipped: processed - updated,
                    etaSeconds: rate > 0
                        ? Math.max(0, Math.ceil((products.length - processed) / rate))
                        : null,
                });
                continue;
            }
            product.price = pricing.price;
            product.optimizationPayload = {
                ...asRecord(product.optimizationPayload),
                pricing,
            };
            await this.catalogProductRepo.save(product);
            await this.syncInventoryProjectionFromCatalogProduct(product);
            updated++;
            results.push({
                sku: product.sku,
                catalogProductId: product.id,
                status: 'updated',
                price: pricing.price,
                pricing,
            });
            const processed = results.length;
            const rate = processed / Math.max((Date.now() - startedAt) / 1000, 1);
            onProgress?.({
                processed,
                total: products.length,
                updated,
                skipped: processed - updated,
                etaSeconds: rate > 0
                    ? Math.max(0, Math.ceil((products.length - processed) / rate))
                    : null,
            });
        }
        return {
            organizationId: org.organizationId,
            processed: products.length,
            updated,
            skipped: products.length - updated,
            results,
        };
    }
    async uploadBatch(user, id, files, rawFilePaths, organizationId) {
        const job = await this.findJob(user, id, organizationId);
        if (['processing', 'completed'].includes(job.status))
            throw new common_1.BadRequestException('This intake run is already processing or complete');
        if (!files?.length || files.length > MAX_BATCH_FILES)
            throw new common_1.BadRequestException(`Upload between 1 and ${MAX_BATCH_FILES} images per batch`);
        let paths;
        try {
            paths = JSON.parse(rawFilePaths);
        }
        catch {
            throw new common_1.BadRequestException('filePaths must be a JSON array matching the uploaded files');
        }
        if (!Array.isArray(paths) ||
            paths.length !== files.length ||
            paths.some((path) => typeof path !== 'string'))
            throw new common_1.BadRequestException('filePaths must be a JSON array matching the uploaded files');
        const currentImageCount = await this.assetRepo.count({
            where: { jobId: job.id, organizationId: job.organizationId },
        });
        if (currentImageCount + files.length > MAX_JOB_IMAGES)
            throw new common_1.BadRequestException(`An intake run cannot contain more than ${MAX_JOB_IMAGES} images`);
        let uploaded = 0;
        let skipped = 0;
        const errors = [];
        for (const [index, file] of files.entries()) {
            const rawPath = paths[index];
            try {
                const relativePath = (0, business_industrial_image_intake_util_js_1.safeIntakePath)(rawPath);
                if (!(0, business_industrial_image_intake_util_js_1.isSupportedBusinessIndustrialImage)(file.originalname || relativePath, file.mimetype))
                    throw new Error('Only supported image files are accepted');
                if (!file.buffer || file.size > MAX_FILE_BYTES)
                    throw new Error('Each image must be present in memory and no larger than 25 MB');
                if (await this.assetRepo.findOne({
                    where: { jobId: job.id, relativePath },
                })) {
                    skipped++;
                    continue;
                }
                const sourceFolderName = (0, business_industrial_image_intake_util_js_1.partFolderFromRelativePath)(relativePath, job.sourceRootName);
                const parsedFolder = (0, business_industrial_image_intake_util_js_1.parseInstanceFolderName)(sourceFolderName);
                const basePartNormalized = (0, business_industrial_image_intake_util_js_1.normalizeImageIntakePartName)(parsedFolder.rawFolderName);
                if (!basePartNormalized || basePartNormalized === 'unassigned')
                    throw new Error('The image is not inside a part folder');
                let group = await this.groupRepo.findOne({
                    where: { jobId: job.id, basePartNormalized },
                });
                if (!group)
                    group = this.groupRepo.create({
                        id: (0, node_crypto_1.randomUUID)(),
                        organizationId: job.organizationId,
                        jobId: job.id,
                        basePartName: parsedFolder.rawFolderName,
                        basePartNormalized,
                        rawFolderNames: [],
                        instanceSuffixes: [],
                        instanceCount: 0,
                        detectionStatus: 'pending',
                        detection: {},
                        confidence: null,
                        catalogProductId: null,
                        errorMessage: null,
                    });
                if (group?.catalogProductId)
                    throw new Error('This part group already created a draft; add images to the draft instead');
                const rawFolders = new Set(group.rawFolderNames ?? []);
                rawFolders.add(parsedFolder.rawFolderName);
                group.rawFolderNames = [...rawFolders];
                group.instanceSuffixes = [];
                group.instanceCount = 1;
                group.errorMessage = null;
                await this.groupRepo.save(group);
                const canonical = await this.imageProcessor.convertBufferToWebp(file.buffer);
                const sourceFilename = file.originalname || relativePath.split('/').pop() || 'image';
                const s3Key = this.storage.buildDurableKey(`business-industrial/intake/${job.id}/${basePartNormalized}/${(0, node_crypto_1.randomUUID)()}.webp`);
                await this.storage.putObject(s3Key, canonical.buffer, 'image/webp');
                await this.assetRepo.save(this.assetRepo.create({
                    id: (0, node_crypto_1.randomUUID)(),
                    organizationId: job.organizationId,
                    jobId: job.id,
                    groupId: group.id,
                    sourceFolderName: parsedFolder.rawFolderName,
                    relativePath,
                    filename: sourceFilename.replace(/.[^.]+$/, '') + '.webp',
                    s3Bucket: this.storage.getBucket(),
                    s3Key,
                    cdnUrl: this.storage.getCdnUrl(s3Key),
                    mimeType: 'image/webp',
                    fileSizeBytes: canonical.buffer.length,
                }));
                void this.storage.queueVariantGeneration(s3Key);
                uploaded++;
            }
            catch (error) {
                errors.push(`${rawPath}: ${error instanceof Error ? error.message : 'upload failed'}`);
            }
        }
        const groups = await this.groupRepo.find({
            where: { jobId: job.id, organizationId: job.organizationId },
        });
        job.totalImages = await this.assetRepo.count({
            where: { jobId: job.id, organizationId: job.organizationId },
        });
        job.totalFolders = groups.reduce((sum, group) => sum + (group.rawFolderNames?.length ?? 0), 0);
        job.groupedParts = groups.length;
        job.status = 'pending';
        job.errorMessage = errors.length ? errors.slice(0, 10).join('; ') : null;
        await this.jobRepo.save(job);
        return { uploaded, skipped, errors, job: this.jobSummary(job) };
    }
    async startJob(user, id, organizationId) {
        const job = await this.findJob(user, id, organizationId);
        const staleJob = job.status === 'processing' &&
            this.isStaleProcessingTimestamp(job.updatedAt ?? job.startedAt);
        if (job.status === 'processing' && !staleJob)
            return this.jobSummary(job);
        const groups = await this.groupRepo.find({
            where: { jobId: job.id, organizationId: job.organizationId },
        });
        if (!groups.length)
            throw new common_1.BadRequestException('Upload at least one part folder before starting detection');
        await this.resetStaleProcessingGroups(groups);
        const retryable = groups.filter((group) => ['pending', 'failed'].includes(group.detectionStatus));
        if (!retryable.length) {
            if (job.status !== 'completed') {
                job.status = 'completed';
                job.completedAt = job.completedAt ?? new Date();
                await this.jobRepo.save(job);
            }
            return this.jobSummary(job);
        }
        job.status = 'processing';
        job.startedAt = new Date();
        job.completedAt = null;
        job.errorMessage = null;
        await this.jobRepo.save(job);
        try {
            await this.intakeQueue.add('detect', { jobId: job.id }, {
                jobId: `bi-image-intake-${job.id}-${job.startedAt.getTime()}`,
                attempts: 2,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: { count: 50 },
                removeOnFail: { count: 100 },
            });
        }
        catch (error) {
            job.status = 'failed';
            job.errorMessage =
                error instanceof Error ? error.message : 'Unable to queue detection';
            await this.jobRepo.save(job);
            throw error;
        }
        return this.jobSummary(job);
    }
    async listGroups(user, jobId, organizationId) {
        const job = await this.findJob(user, jobId, organizationId);
        const groups = await this.groupRepo.find({
            where: { jobId: job.id, organizationId: job.organizationId },
            order: { basePartName: 'ASC' },
        });
        return { groups: groups.map((group) => this.groupSummary(group)) };
    }
    async getGroup(user, id, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const group = await this.groupRepo.findOne({
            where: { id, organizationId: org.organizationId },
        });
        if (!group)
            throw new common_1.NotFoundException('Business & Industrial image group not found');
        const assets = await this.assetRepo.find({
            where: { groupId: group.id, organizationId: org.organizationId },
            order: { createdAt: 'ASC' },
        });
        return {
            ...this.groupSummary(group),
            assets: assets.map((asset) => this.assetSummary(asset)),
        };
    }
    async applyGroup(user, id, dto, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const group = await this.groupRepo.findOne({
            where: { id, organizationId: org.organizationId },
        });
        if (!group)
            throw new common_1.NotFoundException('Business & Industrial image group not found');
        if (group.catalogProductId)
            return { catalogProductId: group.catalogProductId, created: false };
        const job = await this.jobRepo.findOne({
            where: { id: group.jobId, organizationId: org.organizationId },
        });
        if (!job)
            throw new common_1.NotFoundException('Business & Industrial intake run not found');
        const detail = asRecord(group.detection);
        const candidate = asRecord(detail.candidate);
        const category = asRecord(detail.category);
        const enrichment = asRecord(detail.enrichment);
        const categoryFamily = dto.categoryFamily ?? stringValue(candidate.categoryFamily);
        if (!categoryFamily || !CATEGORY_FAMILY_IDS.has(categoryFamily))
            throw new common_1.BadRequestException('Choose a deliberate Business & Industrial category family before creating a draft');
        const candidateAttributes = asRecord(candidate.verticalAttributes);
        const enrichedItemSpecifics = asRecord(enrichment.itemSpecifics);
        const overrideAttributes = asRecord(dto.verticalAttributes);
        const resolvedMpn = dto.mpn?.trim() ||
            stringValue(candidate.mpn) ||
            stringValue(candidate.model) ||
            'Does Not Apply';
        const attributes = (0, business_industrial_image_intake_util_js_1.applyBusinessIndustrialFulfillmentDefaults)((0, business_industrial_image_intake_util_js_1.normalizeDetectedBusinessIndustrialAttributes)({
            ...candidateAttributes,
            ...enrichedItemSpecifics,
            ...overrideAttributes,
            categoryFamily,
            ...((dto.brand ?? stringValue(candidate.brand))
                ? { manufacturer: dto.brand ?? stringValue(candidate.brand) }
                : {}),
            ...((dto.model ?? stringValue(candidate.model))
                ? { model: dto.model ?? stringValue(candidate.model) }
                : {}),
            ...(stringValue(candidate.partType)
                ? { partType: stringValue(candidate.partType) }
                : {}),
            mpn: resolvedMpn,
            inventoryMode: overrideAttributes.inventoryMode ??
                candidateAttributes.inventoryMode ??
                'single',
            shippingMode: overrideAttributes.shippingMode ??
                candidateAttributes.shippingMode ??
                'parcel',
        }), {
            dispatchLocation: this.config.get('BUSINESS_INDUSTRIAL_DEFAULT_DISPATCH_LOCATION', 'United States'),
            shippingCoverage: this.config.get('BUSINESS_INDUSTRIAL_DEFAULT_SHIPPING_COVERAGE', 'United States'),
        });
        const validation = (0, business_industrial_config_js_1.validateBusinessIndustrialAttributes)(attributes);
        if (validation.errors.length)
            throw new common_1.BadRequestException({
                message: 'Detected B&I attributes need correction before draft creation',
                errors: validation.errors,
            });
        const imageUrls = (await this.assetRepo.find({
            where: { groupId: group.id, organizationId: org.organizationId },
            order: { createdAt: 'ASC' },
        })).map((asset) => asset.cdnUrl);
        const resolvedCategoryId = dto.categoryId ?? stringValue(category.categoryId) ?? undefined;
        const optimalPrice = dto.price ??
            numberValue(enrichment.optimalPrice) ??
            numberValue(candidate.priceEstimate) ??
            (await this.catalogMedianPrice(org.organizationId, resolvedCategoryId ?? null)) ??
            undefined;
        const sourceMarker = {
            jobId: job.id,
            groupId: group.id,
            sourceReferenceUrl: job.sourceReferenceUrl,
            sourceFolderName: group.basePartName,
        };
        const intakeSku = await this.resolveCatalogSku(this.catalogSkuFromFolderName(group.basePartName), group.organizationId, sourceMarker);
        const draft = {
            sku: (dto.sku?.trim() || intakeSku).slice(0, 160),
            title: (dto.title?.trim() ||
                stringValue(enrichment.optimizedTitle) ||
                stringValue(candidate.title) ||
                group.basePartName).slice(0, 200),
            description: dto.description ??
                stringValue(enrichment.optimizedDescription) ??
                stringValue(candidate.description) ??
                undefined,
            brand: dto.brand ?? stringValue(candidate.brand) ?? undefined,
            model: dto.model ?? stringValue(candidate.model) ?? undefined,
            mpn: resolvedMpn,
            conditionId: dto.conditionId?.trim() ||
                conditionIdForLabel(stringValue(candidate.conditionLabel)) ||
                undefined,
            conditionLabel: dto.conditionLabel ??
                stringValue(candidate.conditionLabel) ??
                undefined,
            price: optimalPrice,
            quantity: dto.quantity ?? group.instanceCount,
            imageUrls,
            categoryId: resolvedCategoryId,
            categoryName: dto.categoryName ?? stringValue(category.categoryName) ?? undefined,
            verticalAttributes: attributes,
            optimizedTitle: stringValue(enrichment.optimizedTitle) ??
                stringValue(candidate.title) ??
                undefined,
            optimizedDescription: stringValue(enrichment.optimizedDescription) ??
                stringValue(candidate.description) ??
                undefined,
            optimizationPayload: {
                ...enrichment,
                __businessIndustrialIntake: sourceMarker,
            },
            seoScore: scoreValue(enrichment.seoScore),
            readinessScore: scoreValue(enrichment.readinessScore),
        };
        const existing = await this.findExistingCatalogProduct(group.organizationId, group.basePartNormalized, job.sourceReferenceUrl, group.basePartName);
        if (existing) {
            existing.sku = draft.sku;
            existing.title = draft.title;
            existing.description = draft.description ?? null;
            existing.brand = draft.brand ?? null;
            existing.mpn = draft.mpn ?? null;
            existing.partType = stringValue(attributes.partType);
            existing.features = jsonText(attributes.features);
            existing.oemPartNumber = stringValue(attributes.oemPartNumber);
            existing.conditionId = draft.conditionId ?? null;
            existing.conditionLabel = draft.conditionLabel ?? null;
            existing.price = draft.price ?? existing.price;
            existing.quantity = draft.quantity ?? 1;
            existing.categoryId = draft.categoryId ?? null;
            existing.categoryName = draft.categoryName ?? null;
            existing.imageUrls = imageUrls;
            existing.imagesVariantsGeneratedAt = null;
            existing.verticalAttributes = attributes;
            existing.optimizedTitle = draft.optimizedTitle ?? null;
            existing.optimizedDescription = draft.optimizedDescription ?? null;
            existing.optimizationPayload = draft.optimizationPayload ?? null;
            existing.optimizationStatus = 'completed';
            existing.optimizationVersion = (existing.optimizationVersion ?? 0) + 1;
            existing.optimizedAt = new Date();
            existing.optimizationErrors = [];
            existing.optimizationWarnings = stringArray(enrichment.warnings).map((message) => ({ message }));
            existing.seoScore =
                draft.seoScore === undefined ? null : draft.seoScore / 100;
            existing.readinessScore =
                draft.readinessScore === undefined ? null : draft.readinessScore / 100;
            existing.fitmentStatus = 'not_applicable';
            existing.ebayValidationStatus = null;
            existing.manualReview = false;
            existing.verticalValidationStatus =
                existing.verticalValidationStatus === 'approved'
                    ? 'approved'
                    : 'needs_review';
            await this.catalogProductRepo.save(existing);
            await this.syncInventoryProjectionFromCatalogProduct(existing);
            await this.ensureInventoryProjection(group.jobId, group, existing);
            group.catalogProductId = existing.id;
            group.detectionStatus = 'draft_created';
            group.errorMessage = null;
            await this.groupRepo.save(group);
            return {
                catalogProductId: existing.id,
                created: false,
                overwritten: true,
            };
        }
        const listing = await this.businessIndustrial.createListing(user, draft, org.organizationId);
        const catalogProductId = stringValue(asRecord(listing).id);
        if (!catalogProductId)
            throw new Error('B&I draft was created without a catalog product ID');
        await this.ensureInventoryProjection(group.jobId, group, listing);
        group.catalogProductId = catalogProductId;
        group.detectionStatus = 'draft_created';
        await this.groupRepo.save(group);
        return { catalogProductId, created: true, listing };
    }
    async exportJob(user, id, organizationId) {
        const job = await this.findJob(user, id, organizationId);
        const groups = await this.groupRepo.find({
            where: { jobId: job.id, organizationId: job.organizationId },
            order: { basePartName: 'ASC' },
        });
        const assets = await this.assetRepo.find({
            where: { jobId: job.id, organizationId: job.organizationId },
            order: { createdAt: 'ASC' },
        });
        const assetsByGroup = new Map();
        for (const asset of assets)
            assetsByGroup.set(asset.groupId, [
                ...(assetsByGroup.get(asset.groupId) ?? []),
                asset,
            ]);
        const listings = groups.map((group) => {
            const candidate = asRecord(asRecord(group.detection).candidate);
            const category = asRecord(asRecord(group.detection).category);
            return {
                'Base Part': group.basePartName,
                Quantity: group.instanceCount,
                'Raw Folders': (group.rawFolderNames ?? []).join(', '),
                'Image Count': (assetsByGroup.get(group.id) ?? []).length,
                Title: stringValue(candidate.title) ?? '',
                Brand: stringValue(candidate.brand) ?? '',
                Model: stringValue(candidate.model) ?? '',
                MPN: stringValue(candidate.mpn) ?? '',
                'Part Type': stringValue(candidate.partType) ?? '',
                Condition: stringValue(candidate.conditionLabel) ?? '',
                'Category Family': stringValue(candidate.categoryFamily) ?? '',
                'eBay Category ID': stringValue(category.categoryId) ?? '',
                'eBay Category Name': stringValue(category.categoryName) ?? '',
                'Price Estimate': numberValue(candidate.priceEstimate) ?? '',
                Description: stringValue(candidate.description) ?? '',
                'Technical Specifications': jsonText(candidate.verticalAttributes),
                Testing: stringValue(candidate.testing) ?? '',
                Warnings: stringArray(asRecord(group.detection).warnings).join(' | '),
                Confidence: group.confidence ?? '',
                'Detection Status': group.detectionStatus,
                'Catalog Product ID': group.catalogProductId ?? '',
            };
        });
        const sourceFolders = groups.flatMap((group) => (group.rawFolderNames ?? []).map((folder) => ({
            'Job ID': job.id,
            'Group ID': group.id,
            'Base Part': group.basePartName,
            'Raw Folder': folder,
            'Instance Suffix': (0, business_industrial_image_intake_util_js_1.parseInstanceFolderName)(folder).instanceSuffix ?? '',
        })));
        const imageRows = assets.map((asset) => ({
            'Group ID': asset.groupId,
            'Source Folder': asset.sourceFolderName,
            Filename: asset.filename,
            'Relative Path': asset.relativePath,
            'CDN URL': asset.cdnUrl,
            'S3 Key': asset.s3Key,
        }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(listings), 'Listings');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sourceFolders), 'Source Folders');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(imageRows), 'Image Assets');
        return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    }
    async processDriveJob(jobId, maxItems, autoCreateDrafts, skipFolderNames = []) {
        const job = await this.jobRepo.findOne({ where: { id: jobId } });
        if (!job)
            return;
        try {
            const rootId = this.parseDriveFolderId(job.sourceReferenceUrl ?? '');
            const directChildren = await this.listDriveChildren(rootId);
            const directFolders = directChildren
                .filter((file) => file.mimeType === DRIVE_FOLDER_MIME)
                .sort((a, b) => this.naturalCompare(a.name, b.name));
            const excludedFolderNames = new Set(skipFolderNames.map(normalizeDriveFolderName));
            const candidates = directFolders.filter((folder) => !excludedFolderNames.has(normalizeDriveFolderName(folder.name)));
            const selectedItemLimit = maxItems
                ? Math.max(maxItems, 1)
                : candidates.length;
            let selectedFolders = 0;
            let processWrite = Promise.resolve();
            await (0, business_industrial_image_intake_util_js_1.mapWithConcurrency)(candidates, DRIVE_FOLDER_CONCURRENCY, async (folder) => {
                const images = await this.collectDriveImages(folder.id, folder.name, job.sourceRootName);
                if (!images.length || selectedFolders >= selectedItemLimit)
                    return;
                selectedFolders += 1;
                let ingestWrite = Promise.resolve();
                const retained = await (0, business_industrial_image_intake_util_js_1.mapWithConcurrency)(images, DRIVE_IMAGE_CONCURRENCY, async (image) => {
                    const existing = await this.assetRepo.findOne({
                        where: { jobId: job.id, relativePath: image.relativePath },
                    });
                    if (existing)
                        return { image, error: null };
                    try {
                        const buffer = await this.downloadDriveImage(image);
                        const write = ingestWrite.then(() => this.ingestImageBuffer(job, image.relativePath, image.name, image.mimeType, buffer));
                        ingestWrite = write.catch(() => undefined);
                        await write;
                        return { image, error: null };
                    }
                    catch (error) {
                        return {
                            image,
                            error: error instanceof Error
                                ? error.message
                                : 'download or ingest failed',
                        };
                    }
                });
                await ingestWrite;
                const failures = retained.filter((result) => result.error);
                const group = await this.groupRepo.findOne({
                    where: {
                        jobId: job.id,
                        basePartNormalized: (0, business_industrial_image_intake_util_js_1.normalizeImageIntakePartName)(folder.name),
                    },
                });
                if (failures.length) {
                    if (group) {
                        group.errorMessage =
                            failures.length +
                                ' image(s) could not be retained; retry this folder';
                        await this.groupRepo.save(group);
                    }
                    for (const failure of failures)
                        this.logger.warn(`Drive image ${failure.image.name} failed: ${failure.error}`);
                    return;
                }
                if (!group)
                    throw new Error('Drive folder did not create an image group');
                if (group.detectionStatus !== 'draft_created') {
                    processWrite = processWrite.then(() => this.processJob(job.id, autoCreateDrafts, false, [group.id]));
                    await processWrite;
                }
            });
            await processWrite;
            if (!selectedFolders)
                throw new Error('No supported images were found in the selected public Google Drive folder');
            await this.processJob(job.id, autoCreateDrafts, true, []);
        }
        catch (error) {
            job.status = 'failed';
            job.errorMessage =
                error instanceof Error ? error.message : 'Google Drive import failed';
            job.completedAt = new Date();
            await this.jobRepo.save(job);
            this.logger.error(`B&I Drive intake ${job.id} failed: ${job.errorMessage}`);
        }
    }
    async processJob(jobId, autoCreateDrafts = false, finalize = true, onlyGroupIds) {
        const job = await this.jobRepo.findOne({ where: { id: jobId } });
        if (!job)
            return;
        const groups = await this.groupRepo.find({
            where: { jobId: job.id, organizationId: job.organizationId },
            order: { createdAt: 'ASC' },
        });
        if (!groups.length) {
            job.status = 'failed';
            job.errorMessage = 'No part groups were uploaded';
            job.completedAt = new Date();
            await this.jobRepo.save(job);
            return;
        }
        await this.resetStaleProcessingGroups(groups, onlyGroupIds);
        const retryable = groups.filter((group) => group.detectionStatus === 'pending' ||
            group.detectionStatus === 'failed');
        const scopedRetryable = retryable.filter((group) => !onlyGroupIds || onlyGroupIds.includes(group.id));
        const preserved = groups.filter((group) => !retryable.includes(group));
        job.status = 'processing';
        job.completedAt = null;
        job.totalFolders = groups.reduce((sum, group) => sum + (group.rawFolderNames?.length ?? 0), 0);
        job.totalImages = await this.assetRepo.count({
            where: { jobId: job.id, organizationId: job.organizationId },
        });
        job.groupedParts = groups.length;
        job.processedFolders = preserved.reduce((sum, group) => sum + (group.rawFolderNames?.length ?? 0), 0);
        job.processedImages = 0;
        for (const group of preserved)
            job.processedImages += await this.assetRepo.count({
                where: { groupId: group.id, organizationId: job.organizationId },
            });
        job.failedFolders = 0;
        await this.jobRepo.save(job);
        const creator = autoCreateDrafts && job.createdByUserId
            ? await this.userRepo.findOne({ where: { id: job.createdByUserId } })
            : null;
        for (const group of scopedRetryable) {
            try {
                await this.detectGroup(job, group);
                if (autoCreateDrafts && creator && ['detected', 'needs_review'].includes(group.detectionStatus)) {
                    try {
                        await this.applyGroup(creator, group.id, {}, job.organizationId);
                    }
                    catch (error) {
                        group.detectionStatus = 'failed';
                        group.errorMessage =
                            error instanceof Error
                                ? `Enrichment completed; draft creation needs review: ${error.message}`
                                : 'Enrichment completed; draft creation needs review';
                        await this.groupRepo.save(group);
                    }
                }
            }
            catch (error) {
                group.detectionStatus = 'failed';
                group.errorMessage =
                    error instanceof Error ? error.message : 'AI detection failed';
                await this.groupRepo.save(group);
                job.failedFolders += 1;
                this.logger.error(`B&I image group ${group.id} failed: ${group.errorMessage}`);
            }
            job.processedFolders += group.rawFolderNames?.length ?? 0;
            job.processedImages += await this.assetRepo.count({
                where: { groupId: group.id, organizationId: job.organizationId },
            });
            await this.jobRepo.save(job);
        }
        if (!finalize) {
            job.failedFolders = await this.groupRepo.count({
                where: {
                    jobId: job.id,
                    organizationId: job.organizationId,
                    detectionStatus: 'failed',
                },
            });
            job.errorMessage = null;
            await this.jobRepo.save(job);
            return;
        }
        const failed = await this.groupRepo.count({
            where: {
                jobId: job.id,
                organizationId: job.organizationId,
                detectionStatus: 'failed',
            },
        });
        const unresolved = autoCreateDrafts &&
            groups.filter((group) => group.detectionStatus !== 'draft_created').length;
        const pendingGroups = groups.filter((group) => ['pending', 'processing'].includes(group.detectionStatus)).length;
        job.status = !finalize
            ? 'processing'
            : failed === groups.length
                ? 'failed'
                : failed || unresolved || pendingGroups
                    ? 'partial'
                    : 'completed';
        job.failedFolders = failed;
        job.completedAt = finalize ? new Date() : null;
        job.errorMessage = null;
        if (finalize && !failed && (unresolved || pendingGroups))
            job.errorMessage =
                (unresolved || pendingGroups) +
                    ' part group(s) need retry or manual review';
        if (finalize && failed)
            job.errorMessage = `${failed} part group(s) need retry or manual review`;
        await this.jobRepo.save(job);
    }
    async detectGroup(job, group) {
        group.detectionStatus = 'processing';
        group.errorMessage = null;
        await this.groupRepo.save(group);
        const assets = await this.assetRepo.find({
            where: { groupId: group.id, organizationId: job.organizationId },
            order: { createdAt: 'ASC' },
        });
        if (!assets.length)
            throw new Error('Part group has no images');
        const route = this.modelRouter.selectVisionRoute({
            sku: group.basePartName,
            partName: group.basePartName,
            partType: 'business_industrial_image_intake',
            marketplace: 'US',
        }, 'bulk');
        const model = this.config.get('BUSINESS_INDUSTRIAL_AI_MODEL', LUNA_MODEL) || LUNA_MODEL;
        this.modelRouter.assertAllowed(model);
        const visionUrls = await Promise.all(assets.slice(0, MAX_VISION_IMAGES).map((asset) => this.storage.generateDownloadUrl(asset.s3Key)));
        const response = await this.openai.chat({
            model,
            costLane: route.lane,
            imageUrls: visionUrls,
            systemPrompt: VISION_SYSTEM_PROMPT,
            userPrompt: JSON.stringify({
                basePartName: group.basePartName,
                sourceFolderNames: group.rawFolderNames,
                imageCount: assets.length,
                instruction: 'Treat this exact source folder as one independent listing. Preserve its exact folder name and do not merge it with similarly named folders or interpret a dot suffix as quantity.',
            }),
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 2500,
        });
        const candidate = asRecord(response.content);
        if (!Object.keys(candidate).length)
            throw new Error('AI returned no structured identification');
        const category = await this.resolveCategory(candidate, group.basePartName);
        const enrichment = await this.enrichListing(job, group, candidate, category, model);
        const overallConfidence = confidenceValue(candidate.confidence);
        const warnings = stringArray(candidate.warnings);
        if (!category.categoryId)
            warnings.push('eBay leaf category could not be resolved automatically; choose one during review');
        if (!stringValue(candidate.categoryFamily))
            warnings.push('Choose a deliberate B&I category family during review');
        if (!stringValue(candidate.mpn))
            warnings.push('Exact part number was not confirmed from the images');
        group.detection = {
            candidate: this.publicCandidate(candidate),
            category,
            sourceFolderNames: group.rawFolderNames,
            imageCount: assets.length,
            warnings: [...new Set(warnings)],
            promptVersion: PROMPT_VERSION,
            routing: {
                lane: route.lane,
                model,
                segmentKey: route.segmentKey,
            },
            enrichment,
        };
        group.confidence = overallConfidence;
        group.detectionStatus =
            overallConfidence >= 0.85 &&
                Boolean(category.categoryId) &&
                Boolean(stringValue(candidate.categoryFamily))
                ? 'detected'
                : 'needs_review';
        await this.groupRepo.save(group);
        try {
            await this.aiRunLogs.logRun({
                sku: group.basePartName,
                partNumber: stringValue(candidate.mpn),
                partType: stringValue(candidate.partType) ?? 'business_industrial_image_intake',
                marketplace: 'US',
                batchId: job.id,
                lane: route.lane,
                model: response.model,
                promptVersion: PROMPT_VERSION,
                routingPolicyVersion: route.policyVersion,
                inputTokens: response.usage.promptTokens,
                outputTokens: response.usage.completionTokens,
                costUsd: response.estimatedCostUsd,
                latencyMs: response.latencyMs,
                validationScore: Math.round(overallConfidence * 100),
                softFails: [...new Set(warnings)],
                passedGate: group.detectionStatus === 'detected',
            });
        }
        catch (error) {
            this.logger.warn(`Unable to write B&I image AI audit log: ${error instanceof Error ? error.message : error}`);
        }
    }
    async resolveCategory(candidate, basePartName) {
        const queries = this.businessIndustrialCategoryQueries(candidate, basePartName);
        if (!queries.length)
            return {
                categoryId: null,
                categoryName: null,
                marketplaceId: 'EBAY_US',
                aspects: [],
                warnings: ['No category search query was available'],
            };
        try {
            const treeId = await this.taxonomy.getDefaultCategoryTreeId('EBAY_US');
            for (const query of queries) {
                const suggestions = await this.taxonomy.getCategorySuggestions(query.slice(0, 200), treeId);
                for (const suggestion of suggestions.slice(0, 5)) {
                    const categoryId = suggestion.category?.categoryId;
                    if (!categoryId)
                        continue;
                    try {
                        const subtree = await this.taxonomy.getCategorySubtree(categoryId, treeId);
                        if (!subtree.categorySubtreeNode?.leafCategoryTreeNode)
                            continue;
                        const aspects = await this.taxonomy.getItemAspectsForCategory(categoryId, treeId);
                        return {
                            categoryId,
                            categoryName: suggestion.category.categoryName,
                            marketplaceId: 'EBAY_US',
                            relevancy: suggestion.relevancy,
                            ancestors: suggestion.categoryTreeNodeAncestors,
                            aspects: aspects.map((aspect) => ({
                                name: aspect.localizedAspectName,
                                required: aspect.aspectConstraint?.aspectRequired ?? false,
                                usage: aspect.aspectConstraint?.aspectUsage ?? 'OPTIONAL',
                                values: aspect.aspectValues
                                    ?.map((value) => value.localizedValue)
                                    .slice(0, 100) ?? [],
                            })),
                        };
                    }
                    catch {
                    }
                }
            }
            return {
                categoryId: null,
                categoryName: null,
                marketplaceId: 'EBAY_US',
                aspects: [],
                warnings: ['No ranked suggestion was a verified leaf category'],
            };
        }
        catch (error) {
            return {
                categoryId: null,
                categoryName: null,
                marketplaceId: 'EBAY_US',
                aspects: [],
                warnings: [
                    `eBay taxonomy unavailable: ${error instanceof Error ? error.message : 'request failed'}`,
                ],
            };
        }
    }
    businessIndustrialCategoryQueries(candidate, basePartName) {
        const family = stringValue(candidate.categoryFamily);
        const familyLabel = family
            ? business_industrial_config_js_1.BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES.find((item) => item.id === family)?.label
            : null;
        const values = [
            stringValue(candidate.categorySearchQuery),
            [
                stringValue(candidate.brand),
                stringValue(candidate.model),
                stringValue(candidate.partType),
                familyLabel,
            ]
                .filter(Boolean)
                .join(' '),
            [stringValue(candidate.partType), familyLabel].filter(Boolean).join(' '),
            [stringValue(candidate.model), stringValue(candidate.partType)]
                .filter(Boolean)
                .join(' '),
            [basePartName, familyLabel].filter(Boolean).join(' '),
        ];
        return [
            ...new Set(values.flatMap((value) => {
                const trimmed = value?.trim();
                return trimmed ? [trimmed] : [];
            })),
        ];
    }
    async enrichListing(job, group, candidate, category, model) {
        const route = this.modelRouter.selectTextRoute({
            sku: group.basePartName,
            partName: group.basePartName,
            partType: stringValue(candidate.partType) ?? 'business_industrial',
            marketplace: 'US',
        }, 'bulk');
        const response = await this.openai.chat({
            model,
            costLane: route.lane,
            systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
            userPrompt: JSON.stringify({
                sourceFolder: group.basePartName,
                identification: this.publicCandidate(candidate),
                ebayCategory: category,
                instruction: 'Create a reviewable listing draft. Keep any unknown value out of the title and item specifics.',
            }),
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 1400,
        });
        const raw = asRecord(response.content);
        const pricing = await this.getOptimalPrice({
            title: stringValue(raw.optimizedTitle) ??
                stringValue(candidate.title) ??
                group.basePartName,
            partNumber: stringValue(candidate.mpn) ?? stringValue(candidate.oemPartNumber),
            brand: stringValue(candidate.brand),
            condition: stringValue(candidate.conditionLabel),
            fallbackPrice: numberValue(candidate.priceEstimate),
            model,
            sku: group.basePartName,
            partType: stringValue(candidate.partType) ?? 'business_industrial',
            batchId: job.id,
        });
        const warnings = [
            ...stringArray(raw.warnings),
            ...(pricing.warning ? [pricing.warning] : []),
        ];
        const optimizedTitle = (stringValue(raw.optimizedTitle) ??
            stringValue(candidate.title) ??
            group.basePartName).slice(0, 80);
        const optimizedDescription = stringValue(raw.optimizedDescription) ??
            stringValue(candidate.description) ??
            'Please verify the photographed item, condition, included components, and testing status before publishing.';
        const enrichment = {
            optimizedTitle,
            optimizedDescription,
            keywords: stringArray(raw.keywords),
            itemSpecifics: asRecord(raw.itemSpecifics),
            seoScore: scoreValue(raw.seoScore),
            readinessScore: scoreValue(raw.readinessScore),
            warnings: [...new Set(warnings)],
            optimalPrice: pricing.price,
            pricing,
            model: response.model,
            promptVersion: ENRICHMENT_PROMPT_VERSION,
        };
        try {
            await this.aiRunLogs.logRun({
                sku: group.basePartName,
                partNumber: stringValue(candidate.mpn),
                partType: stringValue(candidate.partType) ?? 'business_industrial',
                marketplace: 'US',
                batchId: job.id,
                lane: route.lane,
                model: response.model,
                promptVersion: ENRICHMENT_PROMPT_VERSION,
                routingPolicyVersion: route.policyVersion,
                inputTokens: response.usage.promptTokens,
                outputTokens: response.usage.completionTokens,
                costUsd: response.estimatedCostUsd,
                latencyMs: response.latencyMs,
                validationScore: Math.round(enrichment.readinessScore),
                softFails: warnings,
                passedGate: false,
            });
        }
        catch (error) {
            this.logger.warn('Unable to write B&I listing enrichment audit log: ' +
                (error instanceof Error ? error.message : error));
        }
        return enrichment;
    }
    async getOptimalPrice(input) {
        const emptyMarket = {
            items: [],
            total: 0,
            avgPrice: null,
            medianPrice: null,
            minPrice: null,
            maxPrice: null,
        };
        const title = input.title.trim();
        const partNumber = input.partNumber?.trim() || '';
        const identifyingQuery = [input.brand?.trim(), partNumber].filter(Boolean).join(' ') || title;
        const fallbackQuery = [input.brand?.trim(), title].filter(Boolean).join(' ') || title;
        const condition = pricingCondition(input.condition);
        let market = emptyMarket;
        let marketWarning;
        try {
            market = await this.ebayBrowse.getCompetitorPricing(identifyingQuery.slice(0, 200), condition, 25);
            if (!market.items.some((item) => (numberValue(item.price?.value) ?? 0) > 0) &&
                fallbackQuery.toLowerCase() !== identifyingQuery.toLowerCase()) {
                market = await this.ebayBrowse.getCompetitorPricing(fallbackQuery.slice(0, 200), condition, 25);
            }
        }
        catch (error) {
            marketWarning =
                'Live eBay competitor pricing was unavailable: ' +
                    (error instanceof Error ? error.message : 'request failed');
            this.logger.warn(marketWarning);
        }
        const competitors = market.items
            .map((item) => ({
            seller: item.seller?.username || 'eBay seller',
            price: numberValue(item.price?.value) ?? 0,
            condition: item.condition || 'UNKNOWN',
            title: item.title,
        }))
            .filter((item) => item.price > 0);
        const marketSummary = {
            totalListings: market.total || competitors.length,
            avgPrice: market.avgPrice,
            medianPrice: market.medianPrice,
            minPrice: market.minPrice,
            maxPrice: market.maxPrice,
        };
        if (competitors.length) {
            try {
                const route = this.modelRouter.selectTextRoute({
                    sku: input.sku ?? title,
                    partName: title,
                    partType: input.partType,
                    marketplace: 'US',
                }, 'bulk');
                const suggestion = await this.pricingPipeline.suggestPrice({
                    model: input.model || LUNA_MODEL,
                    productTitle: title,
                    partNumber: partNumber || title,
                    brand: input.brand ?? '',
                    condition: input.condition ?? 'UNKNOWN',
                    costPrice: null,
                    retailPrice: null,
                    mapPrice: null,
                    competitors,
                    marketSummary,
                });
                if (input.batchId) {
                    try {
                        await this.aiRunLogs.logRun({
                            sku: input.sku,
                            partNumber: partNumber || null,
                            partType: input.partType,
                            marketplace: 'US',
                            batchId: input.batchId,
                            lane: route.lane,
                            model: suggestion.rawResponse.model,
                            promptVersion: PRICING_PROMPT_VERSION,
                            routingPolicyVersion: route.policyVersion,
                            inputTokens: suggestion.rawResponse.usage.promptTokens,
                            outputTokens: suggestion.rawResponse.usage.completionTokens,
                            costUsd: suggestion.rawResponse.estimatedCostUsd,
                            latencyMs: suggestion.rawResponse.latencyMs,
                            validationScore: Math.round(Math.max(0, Math.min(1, suggestion.confidence)) * 100),
                            softFails: marketWarning ? [marketWarning] : [],
                            passedGate: false,
                        });
                    }
                    catch (error) {
                        this.logger.warn('Unable to write B&I pricing AI audit log: ' +
                            (error instanceof Error ? error.message : error));
                    }
                }
                const suggestedPrice = positivePrice(suggestion.suggestedPrice);
                if (suggestedPrice !== null) {
                    return {
                        price: suggestedPrice,
                        source: 'market_ai',
                        confidence: numberValue(suggestion.confidence),
                        competitorCount: competitors.length,
                        marketSummary,
                        reasoning: suggestion.reasoning || null,
                        ...(marketWarning ? { warning: marketWarning } : {}),
                    };
                }
            }
            catch (error) {
                marketWarning =
                    'AI pricing analysis was unavailable: ' +
                        (error instanceof Error ? error.message : 'request failed');
                this.logger.warn(marketWarning);
            }
        }
        const fallbackPrice = positivePrice(input.fallbackPrice);
        if (fallbackPrice !== null) {
            return {
                price: fallbackPrice,
                source: 'vision_estimate',
                confidence: null,
                competitorCount: competitors.length,
                marketSummary,
                reasoning: 'Used the evidence-bound vision estimate because no live AI market price was available.',
                warning: marketWarning ??
                    'No usable live eBay pricing analysis was available; verify the estimate before publishing.',
            };
        }
        return {
            price: null,
            source: 'unavailable',
            confidence: null,
            competitorCount: competitors.length,
            marketSummary,
            reasoning: null,
            warning: marketWarning ??
                'No usable eBay competitor price or evidence-bound estimate was available.',
        };
    }
    async ensureInventoryProjection(jobId, group, listing) {
        const product = asRecord(listing);
        const sku = stringValue(product.sku);
        if (!sku)
            return;
        const projectionOrganizationId = stringValue(product.organizationId) ?? group.organizationId;
        const existing = await this.listingRepo.findOne({
            where: {
                organizationId: projectionOrganizationId,
                customLabelSku: sku,
                vertical: 'business_industrial',
            },
        });
        if (existing)
            return;
        const attributes = asRecord(product.verticalAttributes);
        const assets = await this.assetRepo.find({
            where: { groupId: group.id, organizationId: group.organizationId },
            order: { createdAt: 'ASC' },
        });
        const price = numberValue(product.price);
        const quantity = numberValue(product.quantity);
        const record = this.listingRepo.create({
            organizationId: projectionOrganizationId,
            vertical: 'business_industrial',
            verticalAttributes: attributes,
            sourceFileName: 'business-industrial-intake-' + jobId,
            sourceFilePath: 'business-industrial-intake:' + jobId,
            sheetName: group.id,
            sourceRowNumber: 1,
            origin: listing_record_entity_js_1.ListingOrigin.ADD_PART,
            action: 'Add',
            customLabelSku: sku,
            categoryId: stringValue(product.categoryId),
            categoryName: stringValue(product.categoryName),
            title: stringValue(product.title),
            startPrice: price === null ? null : String(price),
            startPriceNum: price,
            quantity: quantity === null ? null : String(quantity),
            quantityNum: quantity,
            itemPhotoUrl: assets.map((asset) => asset.cdnUrl).join('|') || null,
            conditionId: stringValue(product.conditionId),
            conditionLabel: stringValue(product.conditionLabel),
            description: stringValue(product.description),
            format: 'FixedPrice',
            duration: 'GTC',
            cBrand: stringValue(product.brand),
            cType: stringValue(attributes.partType),
            cFeatures: jsonText(attributes.features),
            cManufacturerPartNumber: stringValue(product.mpn),
            cOeOemPartNumber: stringValue(attributes.oemPartNumber),
            status: 'draft',
            enrichmentStage: 'completed',
        });
        await this.listingRepo.save(record);
    }
    async findExistingCatalogProduct(organizationId, basePartNormalized, sourceReferenceUrl, sourceFolderName) {
        void basePartNormalized;
        if (!sourceReferenceUrl)
            return null;
        return this.catalogProductRepo
            .createQueryBuilder('product')
            .where('product.organizationId = :organizationId', { organizationId })
            .andWhere('product.vertical = :vertical', {
            vertical: 'business_industrial',
        })
            .andWhere(`product.optimizationPayload -> '__businessIndustrialIntake' ->> 'sourceReferenceUrl' = :sourceReferenceUrl`, { sourceReferenceUrl })
            .andWhere(`product.optimizationPayload -> '__businessIndustrialIntake' ->> 'sourceFolderName' = :sourceFolderName`, { sourceFolderName })
            .orderBy('product.updatedAt', 'DESC')
            .take(5)
            .getOne();
    }
    async resolveCatalogSku(baseSku, organizationId, sourceMarker) {
        const existing = await this.catalogProductRepo.findOne({
            where: {
                organizationId,
                vertical: 'business_industrial',
                sku: baseSku,
            },
        });
        if (!existing || this.matchesIntakeSource(existing, sourceMarker))
            return baseSku;
        const sourceReferenceUrl = stringValue(sourceMarker.sourceReferenceUrl);
        const driveToken = sourceReferenceUrl
            ? /\/folders\/([^/?#]+)/.exec(sourceReferenceUrl)?.[1]
            : null;
        const token = (driveToken || stringValue(sourceMarker.groupId) || 'intake')
            .replace(/[^a-zA-Z0-9]+/g, '')
            .slice(0, 12)
            .toLowerCase() || 'intake';
        const stem = baseSku.slice(0, Math.max(1, 160 - token.length - 1));
        let candidate = `${stem}-${token}`;
        let counter = 2;
        while (await this.catalogProductRepo.findOne({
            where: {
                organizationId,
                vertical: 'business_industrial',
                sku: candidate,
            },
        })) {
            const suffix = `-${token}-${counter++}`;
            candidate = `${baseSku.slice(0, 160 - suffix.length)}${suffix}`;
        }
        return candidate;
    }
    matchesIntakeSource(product, sourceMarker) {
        const marker = asRecord(asRecord(product.optimizationPayload).__businessIndustrialIntake);
        return (stringValue(marker.sourceReferenceUrl) ===
            stringValue(sourceMarker.sourceReferenceUrl) &&
            stringValue(marker.sourceFolderName) ===
                stringValue(sourceMarker.sourceFolderName));
    }
    isStaleProcessingTimestamp(value) {
        return Boolean(value && Date.now() - value.getTime() > STALE_GROUP_PROCESSING_MS);
    }
    async resetStaleProcessingGroups(groups, onlyGroupIds) {
        for (const group of groups) {
            if (group.detectionStatus !== 'processing' ||
                (onlyGroupIds && !onlyGroupIds.includes(group.id)) ||
                !this.isStaleProcessingTimestamp(group.updatedAt))
                continue;
            group.detectionStatus = 'pending';
            group.errorMessage = 'Recovered after an interrupted intake worker';
            await this.groupRepo.save(group);
            this.logger.warn(`Recovered stale B&I image group ${group.id} (${group.basePartName})`);
        }
    }
    async catalogMedianPrice(organizationId, categoryId) {
        const load = async (restrictCategory) => {
            const query = this.catalogProductRepo
                .createQueryBuilder('product')
                .select('product.price', 'price')
                .where('product.organizationId = :organizationId', { organizationId })
                .andWhere('product.vertical = :vertical', {
                vertical: 'business_industrial',
            })
                .andWhere('product.price > 0')
                .orderBy('product.price', 'ASC')
                .take(500);
            if (restrictCategory && categoryId)
                query.andWhere('product.categoryId = :categoryId', { categoryId });
            const prices = (await query.getRawMany())
                .map((row) => Number(row.price))
                .filter((price) => Number.isFinite(price) && price > 0);
            if (!prices.length)
                return null;
            const middle = Math.floor(prices.length / 2);
            const median = prices.length % 2
                ? prices[middle]
                : (prices[middle - 1] + prices[middle]) / 2;
            return Math.round(median * 100) / 100;
        };
        return (categoryId ? await load(true) : null) ?? load(false);
    }
    async syncInventoryProjectionFromCatalogProduct(product) {
        if (!product.organizationId || !product.sku)
            return;
        const records = await this.listingRepo.find({
            where: {
                organizationId: product.organizationId,
                vertical: 'business_industrial',
                customLabelSku: product.sku,
            },
        });
        if (!records.length)
            return;
        const attributes = asRecord(product.verticalAttributes);
        for (const record of records) {
            record.verticalAttributes = attributes;
            record.title = product.title;
            record.description = product.description;
            record.startPrice =
                product.price === null ? null : String(product.price);
            record.startPriceNum = product.price;
            record.quantity =
                product.quantity === null ? null : String(product.quantity);
            record.quantityNum = product.quantity;
            record.categoryId = product.categoryId;
            record.categoryName = product.categoryName;
            record.itemPhotoUrl = product.imageUrls?.join('|') || null;
            record.conditionId = product.conditionId;
            record.conditionLabel = product.conditionLabel;
            record.cBrand = product.brand;
            record.cType = product.partType;
            record.cFeatures = jsonText(attributes.features);
            record.cManufacturerPartNumber = product.mpn;
            record.cOeOemPartNumber = stringValue(attributes.oemPartNumber);
        }
        await this.listingRepo.save(records);
    }
    async ingestImageBuffer(job, rawPath, originalName, mimeType, buffer) {
        const relativePath = (0, business_industrial_image_intake_util_js_1.safeIntakePath)(rawPath);
        if (!(0, business_industrial_image_intake_util_js_1.isSupportedBusinessIndustrialImage)(originalName, mimeType))
            throw new Error('Only supported image files are accepted');
        if (!buffer.length || buffer.length > MAX_FILE_BYTES)
            throw new Error('Each image must be present and no larger than 25 MB');
        if (await this.assetRepo.findOne({
            where: { jobId: job.id, relativePath },
        }))
            return;
        const sourceFolderName = (0, business_industrial_image_intake_util_js_1.partFolderFromRelativePath)(relativePath, job.sourceRootName);
        const parsedFolder = (0, business_industrial_image_intake_util_js_1.parseInstanceFolderName)(sourceFolderName);
        const basePartNormalized = (0, business_industrial_image_intake_util_js_1.normalizeImageIntakePartName)(parsedFolder.rawFolderName);
        if (!basePartNormalized || basePartNormalized === 'unassigned')
            throw new Error('The image is not inside a part folder');
        let group = await this.groupRepo.findOne({
            where: { jobId: job.id, basePartNormalized },
        });
        if (!group)
            group = this.groupRepo.create({
                id: (0, node_crypto_1.randomUUID)(),
                organizationId: job.organizationId,
                jobId: job.id,
                basePartName: parsedFolder.rawFolderName,
                basePartNormalized,
                rawFolderNames: [],
                instanceSuffixes: [],
                instanceCount: 0,
                detectionStatus: 'pending',
                detection: {},
                confidence: null,
                catalogProductId: null,
                errorMessage: null,
            });
        if (group.catalogProductId)
            throw new Error('This part group already has a draft');
        const rawFolders = new Set(group.rawFolderNames ?? []);
        rawFolders.add(parsedFolder.rawFolderName);
        group.rawFolderNames = [...rawFolders];
        group.instanceSuffixes = [];
        group.instanceCount = 1;
        group.errorMessage = null;
        await this.groupRepo.save(group);
        const canonical = await this.imageProcessor.convertBufferToWebp(buffer);
        const filename = originalName.replace(/.[^.]+$/, '') + '.webp';
        const s3Key = this.storage.buildDurableKey('business-industrial/intake/' +
            job.id +
            '/' +
            basePartNormalized +
            '/' +
            (0, node_crypto_1.randomUUID)() +
            '.webp');
        await this.storage.putObject(s3Key, canonical.buffer, 'image/webp');
        await this.assetRepo.save(this.assetRepo.create({
            id: (0, node_crypto_1.randomUUID)(),
            organizationId: job.organizationId,
            jobId: job.id,
            groupId: group.id,
            sourceFolderName: parsedFolder.rawFolderName,
            relativePath,
            filename,
            s3Bucket: this.storage.getBucket(),
            s3Key,
            cdnUrl: this.storage.getCdnUrl(s3Key),
            mimeType: 'image/webp',
            fileSizeBytes: canonical.buffer.length,
        }));
        void this.storage.queueVariantGeneration(s3Key);
    }
    parseDriveFolderId(reference) {
        let url;
        try {
            url = new URL(reference);
        }
        catch {
            throw new common_1.BadRequestException('Provide a valid Google Drive folder URL');
        }
        if (!['drive.google.com', 'www.drive.google.com'].includes(url.hostname))
            throw new common_1.BadRequestException('Only drive.google.com folder links are supported');
        const match = /\/folders\/([^/?#]+)/.exec(url.pathname);
        if (!match?.[1])
            throw new common_1.BadRequestException('The Google Drive URL must point to a folder');
        return decodeURIComponent(match[1]);
    }
    getDriveApiKey() {
        const key = this.config.get('GOOGLE_DRIVE_API_KEY')?.trim();
        if (!key)
            throw new Error('GOOGLE_DRIVE_API_KEY is not configured on the server; public Drive import is unavailable');
        return key;
    }
    async listDriveChildren(folderId) {
        const files = [];
        let pageToken;
        do {
            const params = new URLSearchParams({
                q: "'" +
                    folderId.replace(/'/g, "\\'") +
                    "' in parents and trashed = false",
                fields: 'nextPageToken,files(id,name,mimeType,size,webContentLink)',
                pageSize: '1000',
                key: this.getDriveApiKey(),
            });
            if (pageToken)
                params.set('pageToken', pageToken);
            const response = await fetch(DRIVE_API_ROOT + '?' + params.toString());
            if (!response.ok)
                throw new Error('Google Drive listing failed (' +
                    response.status +
                    '); confirm the folder is public and the server API key is enabled');
            const body = (await response.json());
            files.push(...(body.files ?? []));
            pageToken = body.nextPageToken;
        } while (pageToken);
        return files;
    }
    async collectDriveImages(folderId, folderPath, rootName, visited = new Set()) {
        if (visited.has(folderId))
            return [];
        visited.add(folderId);
        const images = [];
        for (const file of await this.listDriveChildren(folderId)) {
            if (file.mimeType === DRIVE_FOLDER_MIME) {
                images.push(...(await this.collectDriveImages(file.id, folderPath + '/' + file.name, rootName, visited)));
            }
            else if ((0, business_industrial_image_intake_util_js_1.isSupportedBusinessIndustrialImage)(file.name, file.mimeType)) {
                const safeName = file.name.replace(/[\\/]/g, '_');
                images.push({
                    ...file,
                    relativePath: [rootName, folderPath, safeName].join('/'),
                });
            }
        }
        return images;
    }
    async downloadDriveImage(file) {
        let lastError;
        for (let attempt = 1; attempt <= DRIVE_DOWNLOAD_ATTEMPTS; attempt++) {
            try {
                return await this.downloadDriveImageOnce(file);
            }
            catch (error) {
                lastError = error;
                if (attempt < DRIVE_DOWNLOAD_ATTEMPTS)
                    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
            }
        }
        throw lastError instanceof Error ? lastError : new Error('download failed');
    }
    async downloadDriveImageOnce(file) {
        if (file.webContentLink) {
            const publicResponse = await fetch(file.webContentLink);
            const publicContentType = publicResponse.headers.get('content-type')?.toLowerCase() ?? '';
            if (publicResponse.ok && !publicContentType.includes('text/html')) {
                return this.readDriveImageResponse(publicResponse);
            }
        }
        const params = new URLSearchParams({
            alt: 'media',
            key: this.getDriveApiKey(),
        });
        const response = await fetch(DRIVE_API_ROOT + '/' + encodeURIComponent(file.id) + '?' + params);
        if (!response.ok)
            throw new Error('Google Drive image download failed (' + response.status + ')');
        return this.readDriveImageResponse(response);
    }
    async readDriveImageResponse(response) {
        const declaredSize = Number(response.headers.get('content-length') ?? 0);
        if (declaredSize > MAX_FILE_BYTES)
            throw new Error('Google Drive image is larger than 25 MB');
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_FILE_BYTES)
            throw new Error('Google Drive image is larger than 25 MB');
        return buffer;
    }
    naturalCompare(left, right) {
        return left.localeCompare(right, undefined, {
            numeric: true,
            sensitivity: 'base',
        });
    }
    async findJob(user, id, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const job = await this.jobRepo.findOne({
            where: { id, organizationId: org.organizationId },
        });
        if (!job)
            throw new common_1.NotFoundException('Business & Industrial image intake run not found');
        return job;
    }
    catalogSkuFromFolderName(folderName) {
        const normalized = (0, business_industrial_image_intake_util_js_1.normalizeImageIntakePartName)(folderName);
        const suffix = normalized.startsWith('bni') ? normalized.slice(3) : normalized;
        return `BNI-${(suffix || 'unassigned').slice(0, 156)}`;
    }
    jobSummary(job) {
        return {
            id: job.id,
            sourceRootName: job.sourceRootName,
            sourceReferenceUrl: job.sourceReferenceUrl,
            status: job.status,
            totalFolders: job.totalFolders,
            totalImages: job.totalImages,
            processedFolders: job.processedFolders,
            processedImages: job.processedImages,
            groupedParts: job.groupedParts,
            failedFolders: job.failedFolders,
            errorMessage: job.errorMessage,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            webpStorage: true,
        };
    }
    groupSummary(group) {
        const detail = asRecord(group.detection);
        const candidate = asRecord(detail.candidate);
        const category = asRecord(detail.category);
        return {
            id: group.id,
            jobId: group.jobId,
            basePartName: group.basePartName,
            rawFolderNames: group.rawFolderNames,
            instanceSuffixes: group.instanceSuffixes,
            instanceCount: group.instanceCount,
            detectionStatus: group.detectionStatus,
            confidence: group.confidence,
            catalogProductId: group.catalogProductId,
            errorMessage: group.errorMessage,
            detected: {
                title: stringValue(candidate.title),
                brand: stringValue(candidate.brand),
                model: stringValue(candidate.model),
                mpn: stringValue(candidate.mpn),
                partType: stringValue(candidate.partType),
                conditionLabel: stringValue(candidate.conditionLabel),
                categoryFamily: stringValue(candidate.categoryFamily),
                categoryId: stringValue(category.categoryId),
                categoryName: stringValue(category.categoryName),
                warnings: stringArray(detail.warnings),
            },
        };
    }
    assetSummary(asset) {
        return {
            id: asset.id,
            sourceFolderName: asset.sourceFolderName,
            relativePath: asset.relativePath,
            filename: asset.filename,
            cdnUrl: asset.cdnUrl,
            mimeType: asset.mimeType,
            fileSizeBytes: Number(asset.fileSizeBytes),
            createdAt: asset.createdAt,
        };
    }
    publicCandidate(candidate) {
        return {
            title: stringValue(candidate.title),
            brand: stringValue(candidate.brand),
            model: stringValue(candidate.model),
            mpn: stringValue(candidate.mpn),
            oemPartNumber: stringValue(candidate.oemPartNumber),
            partType: stringValue(candidate.partType),
            categoryFamily: CATEGORY_FAMILY_IDS.has(stringValue(candidate.categoryFamily) ?? '')
                ? stringValue(candidate.categoryFamily)
                : null,
            categorySearchQuery: stringValue(candidate.categorySearchQuery),
            conditionLabel: stringValue(candidate.conditionLabel) ?? 'UNKNOWN',
            description: stringValue(candidate.description),
            visibleText: stringArray(candidate.visibleText),
            features: stringArray(candidate.features),
            warnings: stringArray(candidate.warnings),
            includedComponents: stringArray(candidate.includedComponents),
            missingParts: stringArray(candidate.missingParts),
            testing: stringValue(candidate.testing),
            verticalAttributes: asRecord(candidate.verticalAttributes),
            confidence: asRecord(candidate.confidence),
            priceEstimate: numberValue(candidate.priceEstimate),
        };
    }
    fileExtension(filename) {
        const match = /\.(avif|bmp|gif|heic|jpeg|jpg|png|tif|tiff|webp)$/i.exec(filename);
        return match ? `.${match[1].toLowerCase()}` : '.img';
    }
};
exports.BusinessIndustrialImageIntakeService = BusinessIndustrialImageIntakeService;
exports.BusinessIndustrialImageIntakeService = BusinessIndustrialImageIntakeService = BusinessIndustrialImageIntakeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(11, (0, bullmq_1.InjectQueue)('business-industrial-image-intake')),
    __param(12, (0, typeorm_1.InjectRepository)(business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob)),
    __param(13, (0, typeorm_1.InjectRepository)(business_industrial_image_intake_group_entity_js_1.BusinessIndustrialImageIntakeGroup)),
    __param(14, (0, typeorm_1.InjectRepository)(business_industrial_image_intake_asset_entity_js_1.BusinessIndustrialImageIntakeAsset)),
    __param(15, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __param(16, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(17, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        user_organization_service_js_1.UserOrganizationService,
        storage_service_js_1.StorageService,
        image_processor_service_js_1.ImageProcessorService,
        openai_service_js_1.OpenAiService,
        ai_run_log_service_js_1.AiRunLogService,
        model_router_js_1.ModelRouter,
        ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        business_industrial_service_js_1.BusinessIndustrialService,
        ebay_browse_api_service_js_1.EbayBrowseApiService,
        pricing_analysis_pipeline_js_1.PricingAnalysisPipeline,
        bullmq_2.Queue,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], BusinessIndustrialImageIntakeService);
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function stringValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function numberValue(value) {
    const number = typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
            ? Number(value)
            : NaN;
    return Number.isFinite(number) ? number : null;
}
function positivePrice(value) {
    const number = numberValue(value);
    if (number === null || number <= 0)
        return null;
    return Math.round(number * 100) / 100;
}
function pricingCondition(value) {
    const normalized = stringValue(value)?.toUpperCase();
    if (normalized === 'NEW')
        return 'NEW';
    if (normalized === 'USED' ||
        normalized === 'REFURBISHED' ||
        normalized === 'FOR_PARTS')
        return 'USED';
    return undefined;
}
function conditionIdForLabel(value) {
    switch (value?.trim().toUpperCase()) {
        case 'NEW':
            return '1000';
        case 'REFURBISHED':
            return '2500';
        case 'FOR_PARTS':
            return '7000';
        case 'USED':
        case 'UNKNOWN':
            return '3000';
        default:
            return null;
    }
}
function stringArray(value) {
    return Array.isArray(value)
        ? value
            .filter((item) => typeof item === 'string' && Boolean(item.trim()))
            .map((item) => item.trim())
            .slice(0, 100)
        : [];
}
function confidenceValue(value) {
    const record = asRecord(value);
    const raw = numberValue(record.overall) ?? numberValue(value);
    if (raw === null)
        return 0;
    return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
}
function scoreValue(value) {
    const score = numberValue(value);
    if (score === null)
        return 0;
    return Math.max(0, Math.min(100, score <= 1 ? score * 100 : score));
}
function normalizeDriveFolderName(value) {
    return value.trim().toLowerCase();
}
function jsonText(value) {
    try {
        return JSON.stringify(value ?? {}) ?? '{}';
    }
    catch {
        return '{}';
    }
}
//# sourceMappingURL=business-industrial-image-intake.service.js.map