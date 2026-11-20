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
var FashionBatchPublishService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FashionBatchPublishService = exports.MAX_BATCH_SIZE = exports.FASHION_BATCH_QUEUE = void 0;
exports.listingSnapshot = listingSnapshot;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const ebay_hosted_image_entity_js_1 = require("../integrations/ebay/entities/ebay-hosted-image.entity.js");
const ebay_listing_job_target_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-job-target.entity.js");
const listing_action_log_entity_js_1 = require("../integrations/ebay/entities/listing-action-log.entity.js");
const ebay_multi_store_listing_service_js_1 = require("../integrations/ebay/services/ebay-multi-store-listing.service.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const listing_builder_service_js_1 = require("../integrations/ebay/services/listing-builder.service.js");
const fashion_listings_service_js_1 = require("../verticals/fashion-listings.service.js");
const verticals_service_js_1 = require("../verticals/verticals.service.js");
const fashion_publish_entities_js_1 = require("./entities/fashion-publish.entities.js");
const fashion_compliance_rules_js_1 = require("./fashion-compliance.rules.js");
const fashion_ebay_images_util_js_1 = require("./fashion-ebay-images.util.js");
const fashion_build_preflight_util_js_1 = require("./fashion-build-preflight.util.js");
const fashion_image_pipeline_service_js_1 = require("./fashion-image-pipeline.service.js");
const fashion_vision_check_service_js_1 = require("./fashion-vision-check.service.js");
exports.FASHION_BATCH_QUEUE = 'fashion-batch-publish';
exports.MAX_BATCH_SIZE = 500;
const DRY_RUN_FINAL = ['READY', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED'];
const LIVE_FINAL = ['PUBLISHED', 'NEEDS_REVIEW', 'BLOCKED', 'FAILED'];
const SYNC_DELAY_MS = 15_000;
const SYNC_MAX_ATTEMPTS = 120;
const attr = (p) => (p.verticalAttributes ?? {});
function firstString(v) {
    if (typeof v === 'string')
        return v.trim() || null;
    if (Array.isArray(v))
        return firstString(v[0]);
    return null;
}
function listingSnapshot(p) {
    const a = attr(p);
    const specifics = (a._sourceItemSpecifics ?? {});
    return {
        title: p.title ?? '',
        description: p.description ?? null,
        brand: p.brand ?? null,
        brandSpecific: firstString(a.brand) ?? firstString(specifics.Brand) ?? null,
        price: p.price != null ? Number(p.price) : null,
        categoryId: p.categoryId ?? null,
        categoryName: p.categoryName ?? null,
    };
}
function csvCell(value) {
    const s = value == null ? '' : String(value);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
let FashionBatchPublishService = FashionBatchPublishService_1 = class FashionBatchPublishService {
    db;
    queue;
    pipelineRepo;
    batchRepo;
    itemRepo;
    configRepo;
    productRepo;
    auditRepo;
    targetRepo;
    hostedImageRepo;
    userRepo;
    organizations;
    stores;
    rbac;
    verticals;
    fashion;
    listings;
    builder;
    imagePipeline;
    vision;
    logger = new common_1.Logger(FashionBatchPublishService_1.name);
    constructor(db, queue, pipelineRepo, batchRepo, itemRepo, configRepo, productRepo, auditRepo, targetRepo, hostedImageRepo, userRepo, organizations, stores, rbac, verticals, fashion, listings, builder, imagePipeline, vision) {
        this.db = db;
        this.queue = queue;
        this.pipelineRepo = pipelineRepo;
        this.batchRepo = batchRepo;
        this.itemRepo = itemRepo;
        this.configRepo = configRepo;
        this.productRepo = productRepo;
        this.auditRepo = auditRepo;
        this.targetRepo = targetRepo;
        this.hostedImageRepo = hostedImageRepo;
        this.userRepo = userRepo;
        this.organizations = organizations;
        this.stores = stores;
        this.rbac = rbac;
        this.verticals = verticals;
        this.fashion = fashion;
        this.listings = listings;
        this.builder = builder;
        this.imagePipeline = imagePipeline;
        this.vision = vision;
    }
    async createBatch(user, dto) {
        const { organizationId } = await this.organizations.resolveOrganizationId(user.id, dto.organizationId);
        await this.verticals.assertFeatureEnabled();
        const size = Math.floor(Number(dto.size));
        if (!(size >= 1 && size <= exports.MAX_BATCH_SIZE))
            throw new common_1.BadRequestException(`Batch size must be 1–${exports.MAX_BATCH_SIZE}`);
        let marketplaceId = null;
        let ebayAccountId = null;
        let confirmedByUserId = null;
        if (dto.ebayAccountId) {
            const account = await this.fashion.account(dto.ebayAccountId, organizationId);
            await this.stores.assertStoreAccess(user, account.primaryStoreId, 'operate');
            marketplaceId = dto.marketplaceId || account.primaryStore.ebayMarketplaceId || null;
            if (!marketplaceId ||
                !account.marketplaces.some((m) => m.enabled && m.marketplaceId === marketplaceId))
                throw new common_1.BadRequestException('Marketplace is not enabled for this Fashion seller account');
            if (!dto.dryRun && account.connectionStatus !== 'active')
                throw new common_1.BadRequestException(`The eBay account for ${account.primaryStore.storeName} needs to be reconnected before publishing`);
            ebayAccountId = account.id;
        }
        if (!ebayAccountId)
            throw new common_1.BadRequestException('Choose the eBay store for every batch: publish readiness is checked against its policies and condition rules');
        if (!dto.dryRun) {
            if (dto.confirmAuthenticity !== true)
                throw new common_1.BadRequestException('A live batch needs a reviewer to confirm authenticity for listings that pass the compliance check');
            for (const key of ['fashion.review', 'fashion.authenticity.review'])
                if (!(await this.rbac.userHasPermission(user.id, key)))
                    throw new common_1.ForbiddenException('Only a Fashion reviewer can confirm authenticity for a live batch');
            confirmedByUserId = user.id;
        }
        const result = await this.db.transaction(async (manager) => {
            await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
                `fashion-batch-publish:${organizationId}`,
            ]);
            const batch = await manager.getRepository(fashion_publish_entities_js_1.FashionPublishBatch).save(manager.getRepository(fashion_publish_entities_js_1.FashionPublishBatch).create({
                organizationId,
                requestedByUserId: user.id,
                requestedSize: size,
                dryRun: dto.dryRun,
                ebayAccountId,
                marketplaceId,
                confirmedByUserId,
                status: 'queued',
            }));
            const states = dto.dryRun ? ['UNPUBLISHED'] : ['UNPUBLISHED', 'READY'];
            const rows = await manager.query(`SELECT p.id
           FROM catalog_products p
           LEFT JOIN fashion_listing_pipeline f ON f.catalog_product_id = p.id
          WHERE p.organization_id = $1
            AND p.vertical = 'fashion'
            AND p.ebay_item_id IS NULL
            AND p.manual_review = false
            AND COALESCE(p.vertical_validation_status, '') NOT IN ('deleted', 'quarantined', 'rejected')
            AND NOT EXISTS (
              SELECT 1 FROM ebay_listing_channels c
               WHERE c.catalog_product_id = p.id
                 AND c.listing_status IN ('published', 'active'))
            AND (f.catalog_product_id IS NULL
                 OR (f.active_batch_id IS NULL AND f.state = ANY($2)))
          ORDER BY p."createdAt" ASC, p.id ASC
          LIMIT $3
          FOR UPDATE OF p SKIP LOCKED`, [organizationId, states, size]);
            if (!rows.length) {
                batch.status = 'completed';
                batch.completedAt = new Date();
                await manager.getRepository(fashion_publish_entities_js_1.FashionPublishBatch).save(batch);
                return { batch, itemIds: [] };
            }
            const ids = rows.map((r) => r.id);
            await manager.query(`INSERT INTO fashion_listing_pipeline (catalog_product_id, organization_id, state, active_batch_id, last_batch_id)
         SELECT unnest($1::uuid[]), $2, 'UNPUBLISHED', $3, $3
         ON CONFLICT (catalog_product_id) DO UPDATE
           SET active_batch_id = EXCLUDED.active_batch_id,
               last_batch_id = EXCLUDED.last_batch_id,
               updated_at = now()`, [ids, organizationId, batch.id]);
            const items = await manager.getRepository(fashion_publish_entities_js_1.FashionPublishBatchItem).save(ids.map((catalogProductId, position) => manager.getRepository(fashion_publish_entities_js_1.FashionPublishBatchItem).create({
                batchId: batch.id,
                organizationId,
                catalogProductId,
                position,
                state: 'UNPUBLISHED',
            })));
            return { batch, itemIds: items.map((i) => i.id) };
        });
        if (result.itemIds.length) {
            await this.queue.addBulk(result.itemIds.map((itemId) => ({
                name: 'process',
                data: { kind: 'process', itemId },
                opts: { jobId: `fbp-process-${itemId}` },
            })));
            await this.batchRepo.update(result.batch.id, { status: 'running' });
        }
        return {
            batchId: result.batch.id,
            picked: result.itemIds.length,
            dryRun: dto.dryRun,
            message: result.itemIds.length
                ? `${result.itemIds.length} listing(s) queued`
                : 'No unpublished Fashion listings left to pick',
        };
    }
    async processItem(itemId) {
        const item = await this.itemRepo.findOneBy({ id: itemId });
        if (!item)
            return;
        const batch = await this.batchRepo.findOneByOrFail({ id: item.batchId });
        const finals = batch.dryRun ? DRY_RUN_FINAL : LIVE_FINAL;
        if (finals.includes(item.state) || item.state === 'PUBLISHING')
            return;
        try {
            const product = await this.productRepo.findOneBy({ id: item.catalogProductId });
            if (!product || product.vertical !== 'fashion')
                throw new Error('Fashion catalog product no longer exists');
            const pipeline = await this.pipelineRepo.findOneByOrFail({
                catalogProductId: product.id,
            });
            let evaluation;
            {
                await this.setState(item, pipeline, 'IMAGES_PROCESSING');
                const images = await this.imagePipeline.process(product.id, product.imageUrls ?? [], pipeline.images);
                pipeline.images = images.images;
                pipeline.ebayMasterUrls = images.masterUrls;
                await this.setState(item, pipeline, 'IMAGES_READY');
                await this.audit(product, null, 'fashion.batch.images', images.masterUrls.length ? 'success' : 'failed', undefined, {
                    batchId: batch.id,
                    processed: images.images.length,
                    usable: images.masterUrls.length,
                    reused: images.images.filter((i) => i.reused).length,
                    lowQuality: images.images.filter((i) => i.flags.includes('low_quality')).length,
                    failed: images.images.filter((i) => i.error).map((i) => ({ index: i.index, error: i.error })),
                });
                await this.setState(item, pipeline, 'COMPLIANCE_CHECK');
                const config = await this.config(product.organizationId);
                evaluation = await this.evaluate(product, pipeline, config);
                this.storeEvaluation(pipeline, evaluation);
                if (!batch.dryRun && evaluation.decision !== 'BLOCKED')
                    await this.applyFixesToProduct(product, evaluation, batch.id, null);
                if (evaluation.decision === 'PASS' || evaluation.decision === 'AUTO_FIXED') {
                    const buildIssues = await this.buildPreflight(product, batch);
                    if (buildIssues.length) {
                        evaluation.issues = [...evaluation.issues, ...buildIssues];
                        evaluation.decision = (0, fashion_compliance_rules_js_1.decide)(evaluation.issues);
                        evaluation.risk = (0, fashion_compliance_rules_js_1.riskScore)(evaluation.issues);
                        this.storeEvaluation(pipeline, evaluation);
                    }
                }
                await this.audit(product, null, 'fashion.batch.compliance', evaluation.decision.toLowerCase(), undefined, {
                    batchId: batch.id,
                    dryRun: batch.dryRun,
                    riskScore: evaluation.risk,
                    issues: evaluation.issues,
                    fixes: evaluation.fixes,
                    visionModel: evaluation.vision?.model ?? null,
                });
            }
            const decision = evaluation.decision;
            const next = decision === 'BLOCKED' ? 'BLOCKED' : decision === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'READY';
            if (batch.dryRun || next !== 'READY') {
                await this.finish(item, pipeline, next, null);
                return;
            }
            await this.setState(item, pipeline, 'READY');
            await this.publish(item, pipeline, batch, product);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Batch item ${itemId} failed: ${message}`);
            const pipeline = await this.pipelineRepo.findOneBy({ catalogProductId: item.catalogProductId });
            if (pipeline) {
                await this.finish(item, pipeline, 'FAILED', message.slice(0, 2000));
                const product = await this.productRepo.findOneBy({ id: item.catalogProductId });
                if (product)
                    await this.audit(product, null, 'fashion.batch.failed', 'failed', undefined, { batchId: item.batchId, message });
            }
        }
    }
    async publish(item, pipeline, batch, product) {
        const reviewer = await this.userRepo.findOneByOrFail({ id: batch.confirmedByUserId });
        const review = await this.fashion.getReview(reviewer, product.id, batch.organizationId);
        if (review.status !== 'approved' || !review.authenticityConfirmed) {
            await this.fashion.review(reviewer, product.id, {
                decision: 'approved',
                authenticityConfirmed: true,
                notes: `Approved via Fashion batch ${batch.id}: compliance ${pipeline.complianceResult} (risk ${pipeline.riskScore}); reviewer confirmed authenticity for passing listings.`,
            }, batch.organizationId);
        }
        pipeline.approvedByUserId = reviewer.id;
        pipeline.ebayAccountId = batch.ebayAccountId;
        pipeline.marketplaceId = batch.marketplaceId;
        await this.setState(item, pipeline, 'PUBLISHING');
        const { job } = await this.listings.createPublishJob({
            organizationId: batch.organizationId,
            requestedByUserId: reviewer.id,
            catalogProductId: product.id,
            targets: [{ ebayAccountId: batch.ebayAccountId, marketplaceId: batch.marketplaceId }],
            idempotencyKey: `fbp:${product.id}:${batch.ebayAccountId}:${batch.marketplaceId}:${pipeline.publishAttempt}`,
        });
        pipeline.listingJobId = job.id;
        await this.pipelineRepo.save(pipeline);
        await this.audit(product, reviewer.id, 'fashion.batch.publish.queued', 'processing', undefined, {
            batchId: batch.id,
            listingJobId: job.id,
            ebayAccountId: batch.ebayAccountId,
            marketplaceId: batch.marketplaceId,
            masterImages: pipeline.ebayMasterUrls.length,
        });
        await this.queue.add('sync', { kind: 'sync', itemId: item.id, attempt: 1 }, { delay: SYNC_DELAY_MS, jobId: `fbp-sync-${item.id}-${pipeline.publishAttempt}-1` });
    }
    async syncItem(itemId, attempt) {
        const item = await this.itemRepo.findOneBy({ id: itemId });
        if (!item || item.state !== 'PUBLISHING')
            return;
        const done = await this.syncPublishing(item);
        if (done)
            return;
        if (attempt >= SYNC_MAX_ATTEMPTS) {
            const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
            await this.finish(item, pipeline, 'FAILED', 'Timed out waiting for the eBay publish job; check the job and retry');
            return;
        }
        const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
        await this.queue.add('sync', { kind: 'sync', itemId, attempt: attempt + 1 }, { delay: SYNC_DELAY_MS, jobId: `fbp-sync-${itemId}-${pipeline.publishAttempt}-${attempt + 1}` });
    }
    async syncPublishing(item) {
        const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
        if (!pipeline.listingJobId)
            return false;
        const target = await this.targetRepo.findOne({
            where: { listingJobId: pipeline.listingJobId, catalogProductId: item.catalogProductId },
            relations: ['ebayAccount'],
        });
        if (!target || target.status === 'pending' || target.status === 'processing')
            return false;
        const product = await this.productRepo.findOneByOrFail({ id: item.catalogProductId });
        const payload = (target.resultPayload ?? {});
        if (target.status === 'success' || target.status === 'skipped') {
            const listingId = (typeof payload.listingId === 'string' && payload.listingId) ||
                (typeof payload.duplicateExistingListingId === 'string' && payload.duplicateExistingListingId) ||
                product.ebayItemId;
            pipeline.ebayItemId = listingId || null;
            pipeline.ebayOfferId = typeof payload.offerId === 'string' ? payload.offerId : null;
            pipeline.publishedAt = new Date();
            const storeId = target.ebayAccount?.primaryStoreId;
            if (storeId && pipeline.ebayMasterUrls.length) {
                const hosted = await this.hostedImageRepo.find({
                    where: { storeId, sourceUrl: (0, typeorm_2.In)(pipeline.ebayMasterUrls) },
                });
                const bySource = new Map(hosted.map((h) => [h.sourceUrl, h.hostedUrl]));
                pipeline.ebayImageUrls = pipeline.ebayMasterUrls
                    .map((u) => bySource.get(u))
                    .filter((u) => !!u);
            }
            item.ebayItemId = pipeline.ebayItemId;
            await this.finish(item, pipeline, 'PUBLISHED', null);
            await this.audit(product, pipeline.approvedByUserId, 'fashion.batch.publish.success', 'success', undefined, {
                batchId: item.batchId,
                ebayItemId: pipeline.ebayItemId,
                offerId: pipeline.ebayOfferId,
                ebayImageUrls: pipeline.ebayImageUrls,
                duplicate: target.status === 'skipped',
            });
            return true;
        }
        const err = (target.errorPayload ?? {});
        const errors = Array.isArray(err.errors) ? err.errors.filter((e) => typeof e === 'string') : [];
        const message = [typeof err.message === 'string' ? err.message : null, ...errors].filter(Boolean).join(' — ') ||
            `eBay publish ${target.status}`;
        await this.finish(item, pipeline, 'FAILED', message.slice(0, 2000));
        await this.audit(product, pipeline.approvedByUserId, 'fashion.batch.publish.failed', 'failed', undefined, {
            batchId: item.batchId,
            listingJobId: pipeline.listingJobId,
            message,
        });
        return true;
    }
    async evaluate(product, pipeline, config, opts = {}) {
        const text = (0, fashion_compliance_rules_js_1.checkListingText)(listingSnapshot(product), config);
        const issues = [...text.issues];
        const fixes = [...text.fixes];
        const images = pipeline.images.map((i) => ({
            ...i,
            excluded: i.excluded && !['IMAGE_WATERMARK', 'IMAGE_OFF_PRODUCT', 'IMAGE_COLLAGE', 'IMAGE_TEXT_OVERLAY'].includes(i.excluded.code)
                ? i.excluded
                : null,
        }));
        for (const img of images) {
            if (img.error)
                issues.push({ code: 'IMAGE_FETCH_FAILED', severity: 'warn', field: 'images', source: 'image', imageIndex: img.index, message: `Photo ${img.index + 1} could not be processed: ${img.error}` });
            else if (img.excluded?.code === 'IMAGE_TOO_SMALL')
                issues.push({ code: 'IMAGE_TOO_SMALL', severity: 'warn', field: 'images', source: 'image', imageIndex: img.index, autoFixed: true, message: `${img.excluded.reason}; removed from the eBay photo set` });
            else if (img.flags.includes('low_quality'))
                issues.push({ code: 'IMAGE_LOW_RESOLUTION', severity: 'info', field: 'images', source: 'image', imageIndex: img.index, message: `Photo ${img.index + 1} is ${Math.max(img.width ?? 0, img.height ?? 0)}px on its longest side (under 1600px)` });
        }
        let vision = null;
        let fingerprint = null;
        const usable = images.filter((i) => !i.excluded && !i.error);
        if (usable.length && !opts.skipVision) {
            const input = {
                title: text.fixed.title,
                description: product.description,
                brand: text.declaredBrand,
                categoryName: product.categoryName,
                color: firstString(attr(product).color),
                textIssues: text.issues,
                images: usable,
            };
            fingerprint = this.vision.fingerprint(input);
            if (pipeline.visionFingerprint === fingerprint && pipeline.visionResult) {
                vision = pipeline.visionResult;
            }
            else {
                try {
                    vision = await this.vision.check(input);
                }
                catch (error) {
                    issues.push({
                        code: 'VISION_CHECK_UNAVAILABLE',
                        severity: 'review',
                        field: 'images',
                        source: 'vision',
                        message: `Image check could not run (${error instanceof Error ? error.message : error}); review the photos manually`,
                    });
                    fingerprint = null;
                }
            }
        }
        else if (opts.skipVision && pipeline.visionResult) {
            vision = pipeline.visionResult;
            fingerprint = pipeline.visionFingerprint;
        }
        if (vision) {
            const v = (0, fashion_vision_check_service_js_1.visionIssues)(vision, images);
            issues.push(...v.issues);
            for (const [index, reason] of v.dropIndexes) {
                const img = images.find((i) => i.index === index);
                if (img)
                    img.excluded = reason;
            }
            if (v.dropIndexes.size)
                fixes.push({
                    field: 'images',
                    before: usable.map((i) => i.index),
                    after: images.filter((i) => !i.excluded && !i.error).map((i) => i.index),
                    reason: [...v.dropIndexes.values()].map((d) => d.reason).join('; '),
                });
        }
        const masterUrls = (0, fashion_image_pipeline_service_js_1.ebayMasterUrls)(images);
        if (!masterUrls.length)
            issues.push({ code: 'NO_USABLE_IMAGES', severity: 'review', field: 'images', source: 'image', message: 'No photo is usable for eBay (at least one is required)' });
        const decision = (0, fashion_compliance_rules_js_1.decide)(issues);
        let suggestion = null;
        if (decision === 'NEEDS_REVIEW' && vision?.suggestedFix) {
            const s = vision.suggestedFix;
            const after = {
                title: s.title ?? text.fixed.title,
                description: s.description ?? product.description,
                brand: s.brand ?? text.fixed.brandSpecific ?? product.brand,
            };
            const before = { title: text.fixed.title, description: product.description, brand: text.fixed.brandSpecific ?? product.brand };
            if (JSON.stringify(after) !== JSON.stringify(before))
                suggestion = { before, after, rationale: s.rationale, model: vision.model ?? null, status: 'pending', createdAt: new Date().toISOString() };
        }
        return {
            decision,
            risk: (0, fashion_compliance_rules_js_1.riskScore)(issues),
            issues,
            fixes,
            fixed: text.fixed,
            images,
            masterUrls,
            suggestion,
            vision,
            fingerprint,
        };
    }
    storeEvaluation(pipeline, e) {
        pipeline.complianceResult = e.decision;
        pipeline.riskScore = e.risk;
        pipeline.issues = e.issues;
        pipeline.fixes = e.fixes;
        pipeline.images = e.images;
        pipeline.ebayMasterUrls = e.masterUrls;
        if (!pipeline.suggestion || pipeline.suggestion.status === 'pending' || e.suggestion)
            pipeline.suggestion = e.suggestion ?? (pipeline.suggestion?.status === 'pending' ? null : pipeline.suggestion);
        pipeline.visionResult = e.vision ?? null;
        pipeline.visionFingerprint = e.fingerprint;
        pipeline.checkedAt = new Date();
    }
    async buildPreflight(product, batch) {
        if (!batch.ebayAccountId || !batch.marketplaceId)
            return [{ code: 'BUILD_NOT_CHECKED', severity: 'review', message: 'No eBay store selected, so publish readiness was not checked' }];
        try {
            const account = await this.fashion.account(batch.ebayAccountId, batch.organizationId);
            const built = await this.builder.build({
                catalogProductId: product.id,
                ebayAccountId: batch.ebayAccountId,
                marketplaceId: batch.marketplaceId,
                listingRecordId: product.id,
                storeId: account.primaryStoreId,
                vertical: 'fashion',
                readOnly: true,
            });
            return (0, fashion_build_preflight_util_js_1.preflightIssuesFromErrors)(built.blockingErrors);
        }
        catch (error) {
            return [{
                    code: 'BUILD_CHECK_FAILED',
                    severity: 'review',
                    message: `Publish readiness could not be checked: ${error instanceof Error ? error.message : String(error)}`,
                }];
        }
    }
    async applyFixesToProduct(product, e, batchId, userId) {
        const before = { title: product.title, brand: product.brand, brandSpecific: listingSnapshot(product).brandSpecific };
        const attrs = { ...attr(product) };
        let changed = false;
        if (e.fixed.title && e.fixed.title !== product.title) {
            product.title = e.fixed.title;
            changed = true;
        }
        if (e.fixes.some((f) => f.field === 'brand') && e.fixed.brandSpecific) {
            attrs.brand = e.fixed.brandSpecific;
            if (!product.brand)
                product.brand = e.fixed.brandSpecific;
            changed = true;
        }
        Object.assign(attrs, (0, fashion_ebay_images_util_js_1.ebayMasterAttributes)(e.masterUrls, product.imageUrls ?? []));
        product.verticalAttributes = attrs;
        await this.productRepo.save(product);
        if (changed)
            await this.audit(product, userId, 'fashion.batch.autofix', 'success', before, {
                title: product.title,
                brand: product.brand,
                brandSpecific: attrs.brand ?? null,
                fixes: e.fixes,
            });
    }
    async setState(item, pipeline, state) {
        item.state = state;
        pipeline.state = state;
        item.complianceResult = pipeline.complianceResult;
        item.riskScore = pipeline.riskScore;
        item.issueCodes = [...new Set((pipeline.issues ?? []).filter((i) => i.severity !== 'info').map((i) => i.code))];
        await this.pipelineRepo.save(pipeline);
        await this.itemRepo.save(item);
    }
    async finish(item, pipeline, state, error) {
        pipeline.activeBatchId = null;
        pipeline.lastError = error;
        item.error = error;
        item.finishedAt = new Date();
        await this.setState(item, pipeline, state);
        await this.refreshBatchStatus(item.batchId);
    }
    async refreshBatchStatus(batchId) {
        const open = await this.itemRepo
            .createQueryBuilder('i')
            .where('i.batch_id = :batchId', { batchId })
            .andWhere('i.finished_at IS NULL')
            .getCount();
        if (!open)
            await this.batchRepo.update({ id: batchId, status: (0, typeorm_2.In)(['queued', 'running']) }, { status: 'completed', completedAt: new Date() });
    }
    async audit(product, userId, action, result, before, after) {
        try {
            await this.auditRepo.save(this.auditRepo.create({
                organizationId: product.organizationId,
                catalogProductId: product.id,
                userId,
                action,
                result,
                beforeSnapshot: before ?? null,
                afterSnapshot: after ?? null,
            }));
        }
        catch (error) {
            this.logger.warn(`Audit write failed for ${product.id}: ${error instanceof Error ? error.message : error}`);
        }
    }
    async config(organizationId) {
        const row = await this.configRepo.findOneBy({ organizationId });
        return (0, fashion_compliance_rules_js_1.mergeComplianceConfig)(row?.config);
    }
    async org(user, organizationId) {
        return (await this.organizations.resolveOrganizationId(user.id, organizationId)).organizationId;
    }
    async listBatches(user, organizationId) {
        const org = await this.org(user, organizationId);
        const batches = await this.batchRepo.find({
            where: { organizationId: org },
            order: { createdAt: 'DESC' },
            take: 50,
        });
        const counts = await this.stateCounts(batches.map((b) => b.id));
        return batches.map((b) => ({ ...b, counts: counts.get(b.id) ?? {} }));
    }
    async stateCounts(batchIds) {
        const out = new Map();
        if (!batchIds.length)
            return out;
        const rows = await this.db.query(`SELECT batch_id, state, count(*) n FROM fashion_publish_batch_items WHERE batch_id = ANY($1) GROUP BY 1, 2`, [batchIds]);
        for (const r of rows) {
            const m = out.get(r.batch_id) ?? {};
            m[r.state] = Number(r.n);
            out.set(r.batch_id, m);
        }
        return out;
    }
    async getBatch(user, id, organizationId) {
        const org = await this.org(user, organizationId);
        const batch = await this.batchRepo.findOneBy({ id, organizationId: org });
        if (!batch)
            throw new common_1.NotFoundException('Batch not found');
        const publishing = await this.itemRepo.find({ where: { batchId: id, state: 'PUBLISHING' } });
        for (const item of publishing)
            await this.syncPublishing(item).catch(() => false);
        const items = await this.db.query(`SELECT i.id, i.position, i.catalog_product_id AS "catalogProductId", i.state, i.compliance_result AS "complianceResult",
              i.risk_score AS "riskScore", i.issue_codes AS "issueCodes", i.ebay_item_id AS "ebayItemId", i.error,
              i.finished_at AS "finishedAt", p.sku, p.title, p.brand, p.price,
              f.ebay_master_urls AS "ebayMasterUrls", f.images->0->'urls'->>'thumb' AS "thumbUrl"
         FROM fashion_publish_batch_items i
         JOIN catalog_products p ON p.id = i.catalog_product_id
         LEFT JOIN fashion_listing_pipeline f ON f.catalog_product_id = i.catalog_product_id
        WHERE i.batch_id = $1
        ORDER BY i.position`, [id]);
        const counts = (await this.stateCounts([id])).get(id) ?? {};
        const issueTotals = new Map();
        for (const it of items)
            for (const code of it.issueCodes ?? [])
                issueTotals.set(code, (issueTotals.get(code) ?? 0) + 1);
        return {
            ...batch,
            status: (await this.batchRepo.findOneBy({ id })).status,
            counts,
            topIssues: [...issueTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([code, count]) => ({ code, count })),
            items,
        };
    }
    async reportCsv(user, id, organizationId) {
        const org = await this.org(user, organizationId);
        const batch = await this.batchRepo.findOneBy({ id, organizationId: org });
        if (!batch)
            throw new common_1.NotFoundException('Batch not found');
        const rows = await this.db.query(`SELECT i.catalog_product_id, p.sku, p.title, i.state, i.compliance_result, i.risk_score,
              f.issues, i.ebay_item_id, f.published_at, i.error
         FROM fashion_publish_batch_items i
         JOIN catalog_products p ON p.id = i.catalog_product_id
         LEFT JOIN fashion_listing_pipeline f ON f.catalog_product_id = i.catalog_product_id
        WHERE i.batch_id = $1 ORDER BY i.position`, [id]);
        const header = ['listing_id', 'sku', 'title', 'status', 'compliance_result', 'risk_score', 'issues', 'ebay_item_id', 'published_at', 'error'];
        const lines = rows.map((r) => {
            const issues = (r.issues ?? [])
                .filter((i) => i.severity !== 'info')
                .map((i) => `${i.code}${i.autoFixed ? ' (fixed)' : ''}: ${i.message}`)
                .join(' | ');
            return [r.catalog_product_id, r.sku, r.title, r.state, r.compliance_result, r.risk_score, issues, r.ebay_item_id, r.published_at ? new Date(r.published_at).toISOString() : '', r.error]
                .map(csvCell)
                .join(',');
        });
        return [header.join(','), ...lines].join('\r\n') + '\r\n';
    }
    async reviewQueue(user, state, organizationId, limit = 100) {
        const org = await this.org(user, organizationId);
        const rows = await this.pipelineRepo.find({
            where: { organizationId: org, state, activeBatchId: (0, typeorm_2.IsNull)() },
            order: { riskScore: 'DESC', updatedAt: 'ASC' },
            take: Math.min(Math.max(limit, 1), 200),
        });
        const products = await this.productRepo.find({ where: { id: (0, typeorm_2.In)(rows.map((r) => r.catalogProductId)) } });
        const byId = new Map(products.map((p) => [p.id, p]));
        return rows
            .filter((r) => byId.has(r.catalogProductId))
            .map((r) => this.reviewView(r, byId.get(r.catalogProductId)));
    }
    async reviewItem(user, productId, organizationId) {
        const { pipeline, product } = await this.loadForReview(user, productId, organizationId);
        return this.reviewView(pipeline, product);
    }
    reviewView(r, p) {
        const snap = listingSnapshot(p);
        return {
            catalogProductId: r.catalogProductId,
            state: r.state,
            complianceResult: r.complianceResult,
            riskScore: r.riskScore,
            issues: r.issues,
            fixes: r.fixes,
            suggestion: r.suggestion,
            images: r.images.map((i) => ({
                index: i.index,
                thumb: i.urls.small ?? i.urls.thumb ?? null,
                width: i.width,
                height: i.height,
                flags: i.flags,
                excluded: i.excluded,
                error: i.error,
            })),
            ebayMasterUrls: r.ebayMasterUrls,
            checkedAt: r.checkedAt,
            lastError: r.lastError,
            listing: {
                id: p.id,
                sku: p.sku,
                title: p.title,
                description: p.description,
                brand: p.brand,
                brandSpecific: snap.brandSpecific,
                price: p.price,
                categoryName: p.categoryName,
                verticalValidationStatus: p.verticalValidationStatus,
            },
        };
    }
    async auditLog(user, productId, organizationId) {
        const org = await this.org(user, organizationId);
        return this.auditRepo.find({
            where: { organizationId: org, catalogProductId: productId },
            order: { createdAt: 'DESC' },
            take: 200,
        });
    }
    async loadForReview(user, productId, organizationId) {
        const org = await this.org(user, organizationId);
        const pipeline = await this.pipelineRepo.findOneBy({ catalogProductId: productId, organizationId: org });
        const product = await this.productRepo.findOneBy({ id: productId, organizationId: org, vertical: 'fashion' });
        if (!pipeline || !product)
            throw new common_1.NotFoundException('Listing is not in the publish pipeline');
        if (pipeline.activeBatchId)
            throw new common_1.ConflictException('A batch is processing this listing right now');
        return { org, pipeline, product };
    }
    async applySuggestion(user, productId, edits, organizationId) {
        const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
        if (!['NEEDS_REVIEW', 'BLOCKED'].includes(pipeline.state))
            throw new common_1.ConflictException('Only listings that need review can be fixed here');
        const s = pipeline.suggestion;
        const title = (edits.title ?? s?.after.title ?? product.title).trim();
        if (!title)
            throw new common_1.BadRequestException('Title cannot be blank');
        if (title.length > 80)
            throw new common_1.BadRequestException('eBay titles are limited to 80 characters');
        const description = edits.description !== undefined ? edits.description : (s?.after.description ?? product.description);
        const brand = (edits.brand !== undefined ? edits.brand : (s?.after.brand ?? product.brand))?.trim() || null;
        const before = { title: product.title, description: product.description, brand: product.brand, brandSpecific: listingSnapshot(product).brandSpecific };
        product.title = title;
        product.description = description?.trim() || null;
        product.brand = brand;
        const nextAttrs = { ...attr(product) };
        if (brand)
            nextAttrs.brand = brand;
        else
            delete nextAttrs.brand;
        product.verticalAttributes = nextAttrs;
        await this.productRepo.save(product);
        const edited = !!s && (title !== s.after.title || brand !== s.after.brand || (description ?? null) !== (s.after.description ?? null));
        if (s)
            pipeline.suggestion = { ...s, status: edited ? 'edited' : 'applied' };
        await this.audit(product, user.id, s ? `fashion.review.suggestion.${edited ? 'edited' : 'applied'}` : 'fashion.review.edited', 'success', before, { title, description: product.description, brand });
        await this.pipelineRepo.save(pipeline);
        void org;
        return this.recheck(user, productId, organizationId);
    }
    async recheck(user, productId, organizationId) {
        const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
        const images = await this.imagePipeline.process(product.id, product.imageUrls ?? [], pipeline.images);
        pipeline.images = images.images;
        const evaluation = await this.evaluate(product, pipeline, await this.config(org));
        this.storeEvaluation(pipeline, evaluation);
        pipeline.state = evaluation.decision === 'BLOCKED' ? 'BLOCKED' : evaluation.decision === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'READY';
        pipeline.lastError = null;
        if (evaluation.decision !== 'BLOCKED')
            await this.applyFixesToProduct(product, evaluation, null, user.id);
        pipeline.checkedAt = new Date();
        await this.pipelineRepo.save(pipeline);
        await this.audit(product, user.id, 'fashion.batch.compliance.recheck', evaluation.decision.toLowerCase(), undefined, {
            riskScore: evaluation.risk,
            issues: evaluation.issues,
            fixes: evaluation.fixes,
        });
        return this.reviewView(pipeline, product);
    }
    async approve(user, productId, dto, organizationId) {
        const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
        if (pipeline.state === 'BLOCKED')
            throw new common_1.ConflictException('Blocked listings cannot be approved. Fix the listing and re-run the check first');
        if (pipeline.state !== 'NEEDS_REVIEW' && pipeline.state !== 'READY')
            throw new common_1.ConflictException(`Listing is ${pipeline.state}; nothing to approve`);
        if (dto.authenticityConfirmed !== true)
            throw new common_1.BadRequestException('Explicit authenticity confirmation is required');
        if (!pipeline.ebayMasterUrls.length)
            throw new common_1.ConflictException('The listing has no usable eBay photo');
        await this.fashion.review(user, productId, {
            decision: 'approved',
            authenticityConfirmed: true,
            notes: dto.notes?.trim() || `Approved in the compliance review queue (risk ${pipeline.riskScore}).`,
        }, org);
        pipeline.state = 'READY';
        pipeline.approvedByUserId = user.id;
        await this.pipelineRepo.save(pipeline);
        await this.audit(product, user.id, 'fashion.review.approved', 'success', { state: 'NEEDS_REVIEW' }, { state: 'READY', notes: dto.notes ?? null, openIssues: pipeline.issues.filter((i) => !i.autoFixed && i.severity === 'review').map((i) => i.code) });
        return this.reviewView(pipeline, product);
    }
    async reject(user, productId, dto, organizationId) {
        const { org, pipeline, product } = await this.loadForReview(user, productId, organizationId);
        if (!dto.notes?.trim())
            throw new common_1.BadRequestException('Add a reason before rejecting');
        await this.fashion.review(user, productId, { decision: 'rejected', authenticityConfirmed: false, notes: dto.notes.trim() }, org);
        pipeline.state = 'BLOCKED';
        pipeline.lastError = `Rejected by reviewer: ${dto.notes.trim()}`;
        if (pipeline.suggestion?.status === 'pending')
            pipeline.suggestion = { ...pipeline.suggestion, status: 'rejected' };
        await this.pipelineRepo.save(pipeline);
        await this.audit(product, user.id, 'fashion.review.rejected', 'blocked', undefined, { notes: dto.notes.trim() });
        return this.reviewView(pipeline, product);
    }
    async rejectSuggestion(user, productId, organizationId) {
        const { pipeline, product } = await this.loadForReview(user, productId, organizationId);
        if (pipeline.suggestion)
            pipeline.suggestion = { ...pipeline.suggestion, status: 'rejected' };
        await this.pipelineRepo.save(pipeline);
        await this.audit(product, user.id, 'fashion.review.suggestion.rejected', 'success');
        return this.reviewView(pipeline, product);
    }
    async retryItem(user, itemId, organizationId) {
        const org = await this.org(user, organizationId);
        const item = await this.itemRepo.findOneBy({ id: itemId, organizationId: org });
        if (!item)
            throw new common_1.NotFoundException('Batch item not found');
        if (item.state !== 'FAILED')
            throw new common_1.ConflictException('Only failed items can be retried');
        const pipeline = await this.pipelineRepo.findOneByOrFail({ catalogProductId: item.catalogProductId });
        if (pipeline.activeBatchId && pipeline.activeBatchId !== item.batchId)
            throw new common_1.ConflictException('Another batch is processing this listing');
        if (pipeline.state === 'PUBLISHED')
            throw new common_1.ConflictException('Listing is already published');
        if (pipeline.listingJobId)
            pipeline.publishAttempt += 1;
        pipeline.listingJobId = null;
        pipeline.activeBatchId = item.batchId;
        pipeline.state = 'UNPUBLISHED';
        pipeline.lastError = null;
        item.state = 'UNPUBLISHED';
        item.error = null;
        item.finishedAt = null;
        await this.pipelineRepo.save(pipeline);
        await this.itemRepo.save(item);
        await this.batchRepo.update(item.batchId, { status: 'running', completedAt: null });
        await this.queue.add('process', { kind: 'process', itemId }, { jobId: `fbp-process-${itemId}-retry-${Date.now()}` });
        return { itemId, state: item.state };
    }
    async getConfig(user, organizationId) {
        const org = await this.org(user, organizationId);
        const row = await this.configRepo.findOneBy({ organizationId: org });
        return { effective: await this.config(org), override: row?.config ?? {}, updatedAt: row?.updatedAt ?? null };
    }
    async putConfig(user, override, organizationId) {
        const org = await this.org(user, organizationId);
        const allowed = ['blockTerms', 'blockTermExceptions', 'reviewPhrases', 'fillerTerms', 'protectedBrands', 'knownBrands', 'ambiguousBrands', 'authenticityGuarantee'];
        const clean = {};
        for (const key of allowed)
            if (Array.isArray(override?.[key]))
                clean[key] = override[key];
        await this.configRepo.save({ organizationId: org, config: clean, updatedByUserId: user.id });
        return this.getConfig(user, organizationId);
    }
};
exports.FashionBatchPublishService = FashionBatchPublishService;
exports.FashionBatchPublishService = FashionBatchPublishService = FashionBatchPublishService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)(exports.FASHION_BATCH_QUEUE)),
    __param(2, (0, typeorm_1.InjectRepository)(fashion_publish_entities_js_1.FashionListingPipeline)),
    __param(3, (0, typeorm_1.InjectRepository)(fashion_publish_entities_js_1.FashionPublishBatch)),
    __param(4, (0, typeorm_1.InjectRepository)(fashion_publish_entities_js_1.FashionPublishBatchItem)),
    __param(5, (0, typeorm_1.InjectRepository)(fashion_publish_entities_js_1.FashionComplianceConfigRow)),
    __param(6, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(7, (0, typeorm_1.InjectRepository)(listing_action_log_entity_js_1.ListingActionLog)),
    __param(8, (0, typeorm_1.InjectRepository)(ebay_listing_job_target_entity_js_1.EbayListingJobTarget)),
    __param(9, (0, typeorm_1.InjectRepository)(ebay_hosted_image_entity_js_1.EbayHostedImage)),
    __param(10, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __metadata("design:paramtypes", [typeorm_2.DataSource, Function, typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        user_organization_service_js_1.UserOrganizationService,
        store_access_service_js_1.StoreAccessService,
        rbac_service_js_1.RbacService,
        verticals_service_js_1.VerticalsService,
        fashion_listings_service_js_1.FashionListingsService,
        ebay_multi_store_listing_service_js_1.EbayMultiStoreListingService,
        listing_builder_service_js_1.ListingBuilderService,
        fashion_image_pipeline_service_js_1.FashionImagePipelineService,
        fashion_vision_check_service_js_1.FashionVisionCheckService])
], FashionBatchPublishService);
//# sourceMappingURL=fashion-batch-publish.service.js.map