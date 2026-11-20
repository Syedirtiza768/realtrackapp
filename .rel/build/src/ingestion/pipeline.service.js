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
var PipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineService = exports.mapPipelineDisplayStatus = exports.PIPELINE_CONDITION_OPTIONS = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const pipeline_job_entity_js_1 = require("./entities/pipeline-job.entity.js");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
const enterprise_listing_intelligence_service_js_1 = require("./enterprise-listing-intelligence.service.js");
const listing_optimization_service_js_1 = require("../listing-optimization/listing-optimization.service.js");
const title_verification_service_js_1 = require("../listing-optimization/title-verification/title-verification.service.js");
const job_visibility_js_1 = require("../common/utils/job-visibility.js");
const heavy_job_limiter_service_js_1 = require("../common/jobs/heavy-job-limiter.service.js");
const single_listing_form_service_js_1 = require("./services/single-listing-form.service.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const teams_service_js_1 = require("../teams/teams.service.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const stores_service_js_1 = require("../channels/stores.service.js");
const pipeline_marketplaces_js_1 = require("../common/marketplaces/pipeline-marketplaces.js");
const pipeline_constants_js_1 = require("./pipeline.constants.js");
const pipeline_paths_util_js_1 = require("./utils/pipeline-paths.util.js");
const pipeline_gridx_format_js_1 = require("./pipeline-gridx-format.js");
const pre_enriched_febest_js_1 = require("./pre-enriched-febest.js");
const vertical_types_js_1 = require("../verticals/vertical.types.js");
const SINGLE_LISTING_DEFAULT_PRICE = 100;
const SINGLE_LISTING_DEFAULT_QUANTITY = 1;
var pipeline_constants_js_2 = require("./pipeline.constants.js");
Object.defineProperty(exports, "PIPELINE_CONDITION_OPTIONS", { enumerable: true, get: function () { return pipeline_constants_js_2.PIPELINE_CONDITION_OPTIONS; } });
Object.defineProperty(exports, "mapPipelineDisplayStatus", { enumerable: true, get: function () { return pipeline_constants_js_2.mapPipelineDisplayStatus; } });
let PipelineService = PipelineService_1 = class PipelineService {
    jobRepo;
    listingRepo;
    pipelineQueue;
    featureFlagService;
    enterpriseListingIntelligence;
    listingOptimization;
    titleVerification;
    heavyJobLimiter;
    singleListingForm;
    teamsService;
    userRepo;
    storesService;
    logger = new common_1.Logger(PipelineService_1.name);
    constructor(jobRepo, listingRepo, pipelineQueue, featureFlagService, enterpriseListingIntelligence, listingOptimization, titleVerification, heavyJobLimiter, singleListingForm, teamsService, userRepo, storesService) {
        this.jobRepo = jobRepo;
        this.listingRepo = listingRepo;
        this.pipelineQueue = pipelineQueue;
        this.featureFlagService = featureFlagService;
        this.enterpriseListingIntelligence = enterpriseListingIntelligence;
        this.listingOptimization = listingOptimization;
        this.titleVerification = titleVerification;
        this.heavyJobLimiter = heavyJobLimiter;
        this.singleListingForm = singleListingForm;
        this.teamsService = teamsService;
        this.userRepo = userRepo;
        this.storesService = storesService;
    }
    async nextUploadCode() {
        const rows = await this.jobRepo.query(`SELECT nextval('pipeline_upload_seq') AS n`);
        const n = Number(rows[0]?.n ?? 1);
        const year = new Date().getFullYear();
        return `UPL-${year}-${String(n).padStart(6, '0')}`;
    }
    pipelineUploadRoot() {
        const projectRoot = (0, pipeline_paths_util_js_1.resolvePipelineProjectRoot)();
        return path.resolve(projectRoot, 'uploads', 'pipeline');
    }
    ensureJobUploadDir(jobId) {
        const dir = path.join(this.pipelineUploadRoot(), jobId);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    async createJobFromUpload(originalFilename, fileBuffer, userId, teamId, conditionLabel, manageAllTeams = false, profileOptions, user, vertical = vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL, importMode = 'legacy_gridx') {
        await this.heavyJobLimiter.assertPipelineSlotAvailable();
        const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
        if (!enabled) {
            throw new common_1.ServiceUnavailableException('Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.');
        }
        if (vertical !== vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL) {
            const multiVerticalEnabled = await this.featureFlagService.isEnabled('multi_vertical_catalog');
            if (!multiVerticalEnabled) {
                throw new common_1.ServiceUnavailableException('The selected product vertical is not enabled for this workspace.');
            }
        }
        if (!teamId) {
            throw new common_1.BadRequestException('teamId is required');
        }
        if (!conditionLabel?.trim()) {
            throw new common_1.BadRequestException('conditionLabel is required');
        }
        if (!pipeline_constants_js_1.PIPELINE_CONDITION_OPTIONS[conditionLabel.trim()]) {
            throw new common_1.BadRequestException(`Invalid conditionLabel. Allowed: ${Object.keys(pipeline_constants_js_1.PIPELINE_CONDITION_OPTIONS).join(', ')}`);
        }
        const normalizedImportMode = importMode?.trim() || 'legacy_gridx';
        if (normalizedImportMode !== 'legacy_gridx' &&
            normalizedImportMode !== pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE) {
            throw new common_1.BadRequestException(`Invalid importMode. Allowed: legacy_gridx, ${pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE}`);
        }
        let hiddenRowsSkipped = 0;
        let preEnrichedSummary;
        try {
            if (normalizedImportMode === pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE) {
                const validation = (0, pre_enriched_febest_js_1.parsePreEnrichedFebestWorkbook)(fileBuffer);
                if (!validation.ok) {
                    throw new common_1.BadRequestException(`Invalid ${pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE} workbook: ${validation.errors
                        .slice(0, 5)
                        .map((issue) => `${issue.sheet}${issue.row ? `:${issue.row}` : ''} ${issue.message}`)
                        .join('; ')}`);
                }
                if (!validation.readyForImport) {
                    throw new common_1.BadRequestException(`${pre_enriched_febest_js_1.PRE_ENRICHED_FEBEST_MODE} workbook is not ready for import. Run the dry-run validator and resolve its blockers before enqueueing.`);
                }
                const manifestMarketplace = validation.manifest.Marketplace;
                if (manifestMarketplace &&
                    manifestMarketplace !== profileOptions?.marketplace &&
                    manifestMarketplace !== 'EBAY_MOTORS_US') {
                    throw new common_1.BadRequestException(`Manifest Marketplace ${manifestMarketplace} does not match upload marketplace ${profileOptions?.marketplace}`);
                }
                preEnrichedSummary = validation.summary;
            }
            else {
                hiddenRowsSkipped = (0, pipeline_gridx_format_js_1.countHiddenDataRowsInUpload)(fileBuffer);
                const rows = (0, pipeline_gridx_format_js_1.parsePipelineUploadRows)(fileBuffer);
                const headerCheck = (0, pipeline_gridx_format_js_1.validatePipelineGridxHeaders)(rows);
                if (!headerCheck.ok) {
                    throw new common_1.BadRequestException(headerCheck.message);
                }
            }
            if (hiddenRowsSkipped > 0) {
                this.logger.warn(`Pipeline upload "${originalFilename}": skipping ${hiddenRowsSkipped} Excel-hidden data row(s); only visible rows will be processed`);
            }
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException)
                throw err;
            throw new common_1.BadRequestException(`Could not read upload as CSV/XLSX. Download the GridX sample template from Pipeline. (${err instanceof Error ? err.message : String(err)})`);
        }
        if (userId) {
            await this.teamsService.assertUserCanAccessTeam(userId, teamId, manageAllTeams);
        }
        if (!profileOptions) {
            throw new common_1.BadRequestException('marketplace, storeId, and shipping/return/payment profiles are required');
        }
        const { marketplace, storeId, shippingProfileName, returnProfileName, paymentProfileName, fulfillmentPolicyId, paymentPolicyId, returnPolicyId, } = profileOptions;
        if (!(0, pipeline_marketplaces_js_1.isPipelineMarketplaceCode)(marketplace)) {
            throw new common_1.BadRequestException(`Invalid marketplace. Allowed: US, UK, AU, DE`);
        }
        if (!shippingProfileName?.trim() ||
            !returnProfileName?.trim() ||
            !paymentProfileName?.trim()) {
            throw new common_1.BadRequestException('shippingProfileName, returnProfileName, and paymentProfileName are required');
        }
        const store = await this.storesService.getStore(storeId);
        if (store.channel !== 'ebay' || store.status !== 'active') {
            throw new common_1.BadRequestException('storeId must be an active eBay store');
        }
        if (!(0, pipeline_marketplaces_js_1.storeMatchesPipelineMarketplace)(store.ebayMarketplaceId, marketplace)) {
            throw new common_1.BadRequestException(`Store "${store.storeName}" does not belong to marketplace ${marketplace}`);
        }
        if (user) {
            const accessible = await this.storesService.getStoresByChannel('ebay', user);
            if (!accessible.some((s) => s.id === storeId)) {
                throw new common_1.ForbiddenException('You do not have access to the selected store');
            }
        }
        const uploadCode = await this.nextUploadCode();
        const placeholder = await this.jobRepo.save(this.jobRepo.create({
            originalFilename,
            storedFilePath: 'pending',
            fileSizeBytes: fileBuffer.length,
            status: 'pending',
            createdBy: userId ?? null,
            teamId,
            conditionLabel: conditionLabel.trim(),
            marketplace,
            vertical,
            storeId,
            shippingProfileName: shippingProfileName.trim(),
            returnProfileName: returnProfileName.trim(),
            paymentProfileName: paymentProfileName.trim(),
            fulfillmentPolicyId: fulfillmentPolicyId?.trim() || null,
            paymentPolicyId: paymentPolicyId?.trim() || null,
            returnPolicyId: returnPolicyId?.trim() || null,
            uploadCode,
            ...(hiddenRowsSkipped > 0
                ? {
                    stageDetails: {
                        importMode: normalizedImportMode,
                        hiddenRowsSkipped,
                        note: 'Excel-hidden rows were detected at upload and will be ignored during enrichment',
                    },
                }
                : {}),
            ...(!hiddenRowsSkipped && preEnrichedSummary
                ? {
                    stageDetails: {
                        importMode: normalizedImportMode,
                        preEnrichedValidation: preEnrichedSummary,
                    },
                }
                : {}),
        }));
        const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storedPath = path.join(this.ensureJobUploadDir(placeholder.id), `${Date.now()}_${safeName}`);
        fs.writeFileSync(storedPath, fileBuffer);
        await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });
        const saved = await this.jobRepo.findOneByOrFail({ id: placeholder.id });
        return this.enqueuePipelineJob(saved, storedPath, originalFilename, normalizedImportMode);
    }
    async createJob(dto, userId) {
        await this.heavyJobLimiter.assertPipelineSlotAvailable();
        const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
        if (!enabled) {
            throw new common_1.ServiceUnavailableException('Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.');
        }
        const job = this.jobRepo.create({
            originalFilename: dto.originalFilename,
            storedFilePath: dto.storedFilePath,
            fileSizeBytes: dto.fileSizeBytes ?? null,
            status: 'pending',
            createdBy: userId ?? null,
        });
        let saved;
        try {
            saved = await this.jobRepo.save(job);
        }
        catch (err) {
            this.logger.error(`Failed to save pipeline job: ${err instanceof Error ? err.message : err}`, err instanceof Error ? err.stack : undefined);
            throw new common_1.InternalServerErrorException('Failed to create pipeline job. Database may be unreachable or schema is out of date.');
        }
        return this.enqueuePipelineJob(saved, dto.storedFilePath, dto.originalFilename);
    }
    async enqueuePipelineJob(saved, filePath, originalFilename, importMode = 'legacy_gridx') {
        try {
            await this.pipelineQueue.add('run-pipeline', {
                jobId: saved.id,
                filePath,
                originalFilename,
                importMode,
            }, {
                jobId: `pipeline-${saved.id}`,
                attempts: 2,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: 50,
                removeOnFail: 100,
            });
        }
        catch (err) {
            this.logger.error(`Failed to enqueue pipeline job ${saved.id}: ${err instanceof Error ? err.message : err}`, err instanceof Error ? err.stack : undefined);
            await this.jobRepo.update(saved.id, {
                status: 'failed',
                lastError: 'Failed to enqueue job. Redis may be unavailable. Try again.',
            });
            throw new common_1.ServiceUnavailableException('Pipeline job created but could not be queued for processing. Redis may be unavailable. Try again.');
        }
        this.logger.log(`Created pipeline job ${saved.id} for file: ${originalFilename}`);
        return saved;
    }
    async createSingleJob(dto, userId) {
        if (!dto.partNumber?.trim()) {
            throw new common_1.BadRequestException('partNumber is required');
        }
        const price = dto.price != null && !Number.isNaN(dto.price)
            ? dto.price
            : SINGLE_LISTING_DEFAULT_PRICE;
        const quantity = dto.quantity != null && !Number.isNaN(dto.quantity)
            ? dto.quantity
            : SINGLE_LISTING_DEFAULT_QUANTITY;
        let sku = dto.sku?.trim();
        if (!sku) {
            sku = await this.singleListingForm.allocateSku();
        }
        const escapeCsv = (val) => {
            const s = val == null ? '' : String(val);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        };
        const headers = [
            'sku',
            'brand',
            'model',
            'vin',
            'category',
            'part number',
            'part name',
            'note',
            'price',
            'quantity',
            'image urls',
        ];
        const row = [
            sku,
            dto.brand ?? '',
            dto.model ?? '',
            dto.vin ?? '',
            dto.category ?? '',
            dto.partNumber ?? '',
            dto.partName ?? '',
            dto.note ?? '',
            price,
            quantity,
            dto.imageUrls ?? '',
        ]
            .map(escapeCsv)
            .join(',');
        const csv = `${headers.join(',')}\n${row}\n`;
        const csvBuffer = Buffer.from(csv, 'utf8');
        const displayName = dto.partName || dto.partNumber || dto.sku || 'Unknown Part';
        const originalFilename = `Single Listing - ${displayName}`;
        await this.heavyJobLimiter.assertPipelineSlotAvailable();
        const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
        if (!enabled) {
            throw new common_1.ServiceUnavailableException('Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.');
        }
        const placeholder = await this.jobRepo.save(this.jobRepo.create({
            originalFilename,
            storedFilePath: 'pending',
            fileSizeBytes: csvBuffer.length,
            status: 'pending',
            createdBy: userId ?? null,
        }));
        const storedPath = path.join(this.ensureJobUploadDir(placeholder.id), `single_${Date.now()}.csv`);
        fs.writeFileSync(storedPath, csvBuffer);
        await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });
        const job = await this.enqueuePipelineJob(await this.jobRepo.findOneByOrFail({ id: placeholder.id }), storedPath, originalFilename);
        if (dto.uploadedAssetIds && dto.uploadedAssetIds.length > 0) {
            await this.jobRepo.update(job.id, {
                stageDetails: {
                    ...(job.stageDetails ?? {}),
                    uploadedAssetIds: dto.uploadedAssetIds,
                },
            });
        }
        return job;
    }
    async createBatchJobFromListings(listingIds, userId, options) {
        const uniqueIds = [...new Set(listingIds)];
        if (uniqueIds.length === 0) {
            throw new common_1.BadRequestException('listingIds must not be empty');
        }
        const listings = await this.listingRepo.find({
            where: { id: (0, typeorm_2.In)(uniqueIds) },
        });
        if (listings.length !== uniqueIds.length) {
            throw new common_1.BadRequestException('One or more listings were not found');
        }
        const escapeCsv = (val) => {
            const s = val == null ? '' : String(val);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        };
        const headers = [
            'sku',
            'brand',
            'model',
            'vin',
            'category',
            'part number',
            'part name',
            'note',
            'price',
            'quantity',
            'image urls',
        ];
        const rows = listings.map((listing) => {
            const partNumber = listing.cOeOemPartNumber?.trim() ||
                listing.cManufacturerPartNumber?.trim() ||
                '';
            const price = listing.startPriceNum ??
                (listing.startPrice
                    ? parseFloat(listing.startPrice)
                    : SINGLE_LISTING_DEFAULT_PRICE);
            const quantity = listing.quantityNum ??
                (listing.quantity
                    ? parseInt(listing.quantity, 10)
                    : SINGLE_LISTING_DEFAULT_QUANTITY);
            const imageUrls = (listing.itemPhotoUrl ?? '')
                .split('|')
                .map((u) => u.trim())
                .filter(Boolean)
                .join('|');
            return [
                listing.customLabelSku ?? '',
                listing.cBrand ?? '',
                listing.extractedModel ?? '',
                '',
                listing.categoryName ?? '',
                partNumber,
                listing.title ?? '',
                listing.description ?? '',
                price,
                quantity,
                imageUrls,
            ]
                .map(escapeCsv)
                .join(',');
        });
        const csv = `${headers.join(',')}\n${rows.join('\n')}\n`;
        const csvBuffer = Buffer.from(csv, 'utf8');
        const originalFilename = `Inventory Batch - ${listings.length} parts`;
        await this.heavyJobLimiter.assertPipelineSlotAvailable();
        const enabled = await this.featureFlagService.isEnabled('pipeline_enrichment');
        if (!enabled) {
            throw new common_1.ServiceUnavailableException('Pipeline enrichment feature is not enabled. Enable the "pipeline_enrichment" feature flag.');
        }
        const placeholder = await this.jobRepo.save(this.jobRepo.create({
            originalFilename,
            storedFilePath: 'pending',
            fileSizeBytes: csvBuffer.length,
            status: 'pending',
            createdBy: userId ?? null,
        }));
        const storedPath = path.join(this.ensureJobUploadDir(placeholder.id), `batch_${Date.now()}.csv`);
        fs.writeFileSync(storedPath, csvBuffer);
        await this.jobRepo.update(placeholder.id, { storedFilePath: storedPath });
        const job = await this.enqueuePipelineJob(await this.jobRepo.findOneByOrFail({ id: placeholder.id }), storedPath, originalFilename);
        await this.jobRepo.update(job.id, {
            stageDetails: {
                ...(job.stageDetails ?? {}),
                sourceListingIds: uniqueIds,
                source: options?.source ?? 'inventory',
                forceVision: options?.forceVision ?? false,
            },
        });
        await this.listingRepo.update({ id: (0, typeorm_2.In)(uniqueIds) }, { pipelineJobId: job.id });
        this.logger.log(`Created batch pipeline job ${job.id} for ${uniqueIds.length} inventory listing(s)`);
        return job;
    }
    async listJobs(status, limit = 20, offset = 0, viewerId, viewAll = true, displayStatus, teamIds) {
        const qb = this.jobRepo
            .createQueryBuilder('j')
            .orderBy('j.createdAt', 'DESC');
        if (status)
            qb.andWhere('j.status = :status', { status });
        if (viewerId) {
            (0, job_visibility_js_1.applyCreatedByVisibility)(qb, 'j', viewerId, viewAll);
        }
        if (!viewAll && viewerId) {
            const accessible = await this.teamsService.getUserTeamIds(viewerId);
            if (accessible.length === 0) {
                qb.andWhere('1 = 0');
            }
            else {
                qb.andWhere('(j.team_id IN (:...accessibleTeams) OR j.team_id IS NULL)', {
                    accessibleTeams: accessible,
                });
            }
        }
        if (teamIds?.length) {
            qb.andWhere('j.team_id IN (:...filterTeamIds)', {
                filterTeamIds: teamIds,
            });
        }
        if (displayStatus) {
            switch (displayStatus) {
                case 'queued':
                    qb.andWhere('j.status = :queuedStatus', { queuedStatus: 'pending' });
                    break;
                case 'uploaded':
                    qb.andWhere('j.status = :uploadedStatus', {
                        uploadedStatus: 'completed',
                    });
                    break;
                case 'failed':
                    qb.andWhere('j.status IN (:...failedStatuses)', {
                        failedStatuses: ['failed', 'cancelled'],
                    });
                    break;
                case 'processing':
                    qb.andWhere('j.status NOT IN (:...terminalStatuses)', {
                        terminalStatuses: ['pending', 'completed', 'failed', 'cancelled'],
                    });
                    break;
                default:
                    break;
            }
        }
        qb.take(limit).skip(offset);
        const [jobs, total] = await qb.getManyAndCount();
        return { jobs: await this.enrichJobList(jobs), total };
    }
    async enrichJobList(jobs) {
        if (jobs.length === 0)
            return [];
        const teamIds = [
            ...new Set(jobs.map((j) => j.teamId).filter(Boolean)),
        ];
        const userIds = [
            ...new Set(jobs.map((j) => j.createdBy).filter(Boolean)),
        ];
        const storeIds = [
            ...new Set(jobs.map((j) => j.storeId).filter(Boolean)),
        ];
        const teamMap = await this.teamsService.findTeamsByIds(teamIds);
        const users = userIds.length
            ? await this.userRepo.find({
                where: { id: (0, typeorm_2.In)(userIds) },
                select: ['id', 'name', 'email'],
            })
            : [];
        const userMap = new Map(users.map((u) => [u.id, u]));
        const stores = storeIds.length
            ? await Promise.all(storeIds.map((id) => this.storesService.getStore(id).catch(() => null)))
            : [];
        const storeMap = new Map(stores
            .filter(Boolean)
            .map((s) => [s.id, { id: s.id, storeName: s.storeName }]));
        return jobs.map((job) => {
            const team = job.teamId ? teamMap.get(job.teamId) : undefined;
            const user = job.createdBy ? userMap.get(job.createdBy) : undefined;
            const store = job.storeId ? storeMap.get(job.storeId) : undefined;
            return {
                id: job.id,
                uploadCode: job.uploadCode,
                status: job.status,
                displayStatus: (0, pipeline_constants_js_1.mapPipelineDisplayStatus)(job.status),
                originalFilename: job.originalFilename,
                totalParts: job.totalParts,
                conditionLabel: job.conditionLabel,
                marketplace: job.marketplace,
                vertical: job.vertical ?? vertical_types_js_1.DEFAULT_PRODUCT_VERTICAL,
                store: store ?? null,
                shippingProfileName: job.shippingProfileName,
                returnProfileName: job.returnProfileName,
                paymentProfileName: job.paymentProfileName,
                team: team ? { id: team.id, name: team.name, color: team.color } : null,
                uploadedBy: user
                    ? { id: user.id, name: user.name || user.email }
                    : null,
                createdAt: job.createdAt,
                fileSizeBytes: job.fileSizeBytes,
            };
        });
    }
    async getJob(id, viewerId, viewAll = true) {
        const job = await this.jobRepo.findOneBy({ id });
        if (!job)
            throw new common_1.NotFoundException(`Pipeline job ${id} not found`);
        if (viewerId && !(0, job_visibility_js_1.canViewJob)(job.createdBy, viewerId, viewAll)) {
            throw new common_1.ForbiddenException('You do not have access to this pipeline job');
        }
        return job;
    }
    async updateProgress(id, update) {
        await this.jobRepo.update(id, update);
        return this.getJob(id);
    }
    async cancelJob(id, actorId, viewAll = true) {
        const job = await this.getJob(id, actorId, viewAll);
        if (job.status === 'completed' || job.status === 'cancelled') {
            throw new common_1.BadRequestException(`Job ${id} cannot be cancelled (current: ${job.status})`);
        }
        job.status = 'cancelled';
        job.completedAt = new Date();
        job.createdBy = (0, job_visibility_js_1.withCreatedByBackfill)(job.createdBy, actorId);
        return this.jobRepo.save(job);
    }
    async retryJob(id, actorId, viewAll = true) {
        const job = await this.getJob(id, actorId, viewAll);
        if (job.status !== 'failed') {
            throw new common_1.BadRequestException(`Job ${id} is not in failed state (current: ${job.status})`);
        }
        job.status = 'pending';
        job.lastError = null;
        job.errorCount = 0;
        job.startedAt = null;
        job.completedAt = null;
        job.createdBy = (0, job_visibility_js_1.withCreatedByBackfill)(job.createdBy, actorId);
        await this.jobRepo.save(job);
        try {
            const existing = await this.pipelineQueue.getJob(`pipeline-${id}`);
            if (existing)
                await existing.remove();
        }
        catch (err) {
            this.logger.warn(`Could not clear prior queue entry for retry ${id}: ${err instanceof Error ? err.message : err}`);
        }
        await this.pipelineQueue.add('run-pipeline', {
            jobId: id,
            filePath: job.storedFilePath,
            originalFilename: job.originalFilename,
        }, {
            jobId: `pipeline-${id}`,
            attempts: 2,
            backoff: { type: 'exponential', delay: 60_000 },
        });
        this.logger.log(`Retrying pipeline job ${id}`);
        return job;
    }
    async deleteJob(id, actorId, viewAll = true) {
        const job = await this.getJob(id, actorId, viewAll);
        try {
            const allJobs = await this.pipelineQueue.getJobs([
                'wait',
                'active',
                'delayed',
                'paused',
            ]);
            for (const entry of allJobs) {
                if (entry.data.jobId === id) {
                    await entry.remove().catch(() => { });
                }
            }
        }
        catch (err) {
            this.logger.warn(`Could not clean BullMQ jobs for ${id}: ${err instanceof Error ? err.message : err}`);
        }
        try {
            if (job.storedFilePath && fs.existsSync(job.storedFilePath)) {
                const dir = path.dirname(job.storedFilePath);
                fs.rmSync(dir, { recursive: true, force: true });
                this.logger.log(`Deleted upload dir for job ${id}: ${dir}`);
            }
        }
        catch (err) {
            this.logger.warn(`Could not delete upload files for ${id}: ${err instanceof Error ? err.message : err}`);
        }
        try {
            const projectRoot = (0, pipeline_paths_util_js_1.resolvePipelineProjectRoot)();
            const outputDir = path.resolve(projectRoot, 'output', `pipeline-${id.slice(0, 8)}`);
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
                this.logger.log(`Deleted output dir for job ${id}: ${outputDir}`);
            }
        }
        catch (err) {
            this.logger.warn(`Could not delete output dir for ${id}: ${err instanceof Error ? err.message : err}`);
        }
        await this.jobRepo.delete(id);
        this.logger.log(`Deleted pipeline job ${id}`);
    }
    async resumeImport(id, actorId, viewAll = true) {
        const job = await this.getJob(id, actorId, viewAll);
        const ACTIVE_STATUSES = [
            'uploading',
            'vin_decode',
            'category_mapping',
            'enrichment',
            'validation',
            'output_generation',
        ];
        if (ACTIVE_STATUSES.includes(job.status)) {
            throw new common_1.BadRequestException(`Job ${id} is currently active (${job.status}) — wait for it to finish`);
        }
        const projectRoot = (0, pipeline_paths_util_js_1.resolvePipelineProjectRoot)();
        const outputDir = path.resolve(projectRoot, 'output', `pipeline-${id.slice(0, 8)}`);
        if (!fs.existsSync(outputDir)) {
            throw new common_1.BadRequestException(`Cannot resume — output directory not found: ${outputDir}. Enrichment output is required.`);
        }
        try {
            const existing = await this.pipelineQueue.getJobs([
                'wait',
                'active',
                'delayed',
                'paused',
            ]);
            for (const entry of existing) {
                if (entry.data.jobId === id) {
                    await entry.remove();
                    this.logger.log(`Removed stale BullMQ job ${entry.id} for ${id} before resume`);
                }
            }
        }
        catch (err) {
            this.logger.warn(`Could not clean stale BullMQ jobs for ${id}: ${err instanceof Error ? err.message : err}`);
        }
        await this.pipelineQueue.add('resume-import', {
            jobId: id,
            filePath: job.storedFilePath ?? '',
            originalFilename: job.originalFilename,
        }, {
            attempts: 1,
            removeOnComplete: 50,
            removeOnFail: 100,
        });
        this.logger.log(`Resuming catalog import for job ${id} (output: ${outputDir})`);
        return job;
    }
    async getStats() {
        const result = await this.jobRepo
            .createQueryBuilder('job')
            .select('job.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(job.processedParts), 0)', 'totalPartsProcessed')
            .addSelect('COALESCE(SUM(job.enrichedCount), 0)', 'totalEnriched')
            .addSelect('COALESCE(SUM(job.openaiTokensUsed), 0)', 'totalTokens')
            .groupBy('job.status')
            .getRawMany();
        const byStatus = {};
        let total = 0;
        let totalPartsProcessed = 0;
        let totalEnriched = 0;
        let totalTokens = 0;
        for (const row of result) {
            const count = parseInt(row.count, 10);
            byStatus[row.status] = count;
            total += count;
            totalPartsProcessed += parseInt(row.totalPartsProcessed, 10) || 0;
            totalEnriched += parseInt(row.totalEnriched, 10) || 0;
            totalTokens += parseInt(row.totalTokens, 10) || 0;
        }
        const pending = byStatus.pending ?? 0;
        const completed = byStatus.completed ?? 0;
        const failed = byStatus.failed ?? 0;
        const cancelled = byStatus.cancelled ?? 0;
        const processing = Object.entries(byStatus)
            .filter(([status]) => !['completed', 'failed', 'cancelled', 'pending'].includes(status))
            .reduce((sum, [, count]) => sum + count, 0);
        return {
            total,
            pending,
            processing,
            completed,
            failed,
            cancelled,
            byStatus,
            totalPartsProcessed,
            totalEnriched,
            totalTokens,
        };
    }
    async generateEnterpriseOptimization(jobId, options) {
        const enterpriseDefaults = this.normalizeEnterpriseOptions(options);
        return this.enterpriseListingIntelligence.generateForPipelineJob(jobId, enterpriseDefaults);
    }
    async runCombinedOptimization(jobId, options) {
        const job = await this.getJob(jobId);
        if (job.status !== 'completed') {
            throw new common_1.BadRequestException(`Pipeline job ${jobId} is ${job.status}. Wait until enrichment pipeline completes.`);
        }
        const marketplace = options?.marketplace ?? 'US';
        await this.listingOptimization.enqueueJobOptimization(jobId, marketplace, undefined, { force: true });
        const status = await this.getOptimizationStatus(jobId);
        const refreshedJob = await this.getJob(jobId);
        return {
            job: refreshedJob,
            enterprise: this.optimizationStatusToEnterpriseResult(jobId, status, marketplace),
        };
    }
    async getOptimizationStatus(jobId, marketplace) {
        return this.listingOptimization.getJobOptimizationStatus(jobId, marketplace);
    }
    async getProductOptimization(productId) {
        return this.listingOptimization.getProductOptimization(productId);
    }
    async rerunProductOptimization(productId, marketplace = 'US') {
        return this.listingOptimization.optimizeProduct(productId, marketplace, {
            force: true,
        });
    }
    async markProductManualReview(productId, enabled = true) {
        return this.listingOptimization.markManualReview(productId, enabled);
    }
    async verifyJobTitles(jobId) {
        return this.titleVerification.verifyJob(jobId);
    }
    async bypassJobOptimization(jobId) {
        return this.listingOptimization.bypassJobOptimization(jobId);
    }
    optimizationStatusToEnterpriseResult(jobId, status, marketplace) {
        return {
            jobId,
            marketplace,
            totalProducts: status.total,
            aiGeneratedCount: status.processed,
            blockedCount: status.blockCount,
            reviewCount: status.reviewCount,
            passCount: status.passCount,
            averageUploadReadiness: status.products.length > 0
                ? Math.round((status.products.reduce((s, p) => s + p.uploadReadinessScore, 0) /
                    status.products.length) *
                    100) / 100
                : 0,
            listings: status.products.map((p) => ({
                productId: p.productId,
                sku: p.sku,
                optimizedTitle: p.optimizedTitle ?? '',
                validationStatus: p.validationStatus,
                uploadReadinessScore: p.uploadReadinessScore,
                complianceWarnings: [...p.errors, ...p.warnings],
                missingDataReport: p.missingDataReport,
                finalUploadPayload: {},
            })),
        };
    }
    normalizeEnterpriseOptions(options) {
        const limit = options?.limit;
        return {
            marketplace: options?.marketplace,
            limit,
            aiBudgetListings: limit,
            listingQualityProfile: options?.listingQualityProfile ?? 'max_seo_comprehensive',
        };
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = PipelineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(2, (0, bullmq_1.InjectQueue)('pipeline')),
    __param(10, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository, Function, feature_flag_service_js_1.FeatureFlagService,
        enterprise_listing_intelligence_service_js_1.EnterpriseListingIntelligenceService,
        listing_optimization_service_js_1.ListingOptimizationService,
        title_verification_service_js_1.TitleVerificationService,
        heavy_job_limiter_service_js_1.HeavyJobLimiterService,
        single_listing_form_service_js_1.SingleListingFormService,
        teams_service_js_1.TeamsService,
        typeorm_2.Repository,
        stores_service_js_1.StoresService])
], PipelineService);
//# sourceMappingURL=pipeline.service.js.map