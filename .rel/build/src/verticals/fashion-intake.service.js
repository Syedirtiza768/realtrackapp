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
var FashionIntakeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FashionIntakeService = exports.FASHION_INTAKE_QUEUE = void 0;
exports.pendingFashionTitle = pendingFashionTitle;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("typeorm");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const ebay_listing_job_target_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-job-target.entity.js");
const listing_action_log_entity_js_1 = require("../integrations/ebay/entities/listing-action-log.entity.js");
const fashion_review_entity_js_1 = require("./entities/fashion-review.entity.js");
const fashion_warehouse_entity_js_1 = require("./entities/fashion-warehouse.entity.js");
const fashion_listings_service_js_1 = require("./fashion-listings.service.js");
const fashion_image_analysis_service_js_1 = require("./fashion-image-analysis.service.js");
const fashion_measurements_js_1 = require("./fashion-measurements.js");
const fashion_config_js_1 = require("./fashion.config.js");
exports.FASHION_INTAKE_QUEUE = 'fashion-intake-analysis';
const PHOTO_ROLE_ORDER = [
    'front',
    'back',
    'tag',
    'additional',
    'sizeChart',
];
const INTAKE_CREATOR_SQL = `COALESCE(
  NULLIF(p.vertical_attributes->>'_intakeCreatedBy', ''),
  NULLIF(p.vertical_attributes->>'_createdByUserId', ''),
  (SELECT log.user_id::text FROM listing_action_logs log
    WHERE log.catalog_product_id = p.id
      AND log.organization_id = p.organization_id
      AND log.action = 'fashion.draft.created'
    ORDER BY log.created_at ASC LIMIT 1)
)`;
const INTAKE_PENDING_SQL = `(
  p.vertical_attributes->>'_intakeSource' = 'capture'
  AND COALESCE(p.vertical_attributes->>'_catalogAdded', 'true') = 'false'
)`;
const CATALOG_ADDER_SQL = `CASE WHEN ${INTAKE_PENDING_SQL} THEN NULL ELSE COALESCE(
  NULLIF(p.vertical_attributes->>'_catalogAddedBy', ''),
  ${INTAKE_CREATOR_SQL}
) END`;
const ACTIVITY_AT_SQL = `COALESCE(
  NULLIF(p.vertical_attributes->>'_catalogAddedAt', '')::timestamptz,
  p.created_at
)`;
function pendingFashionTitle(sku) {
    return `Pending identification — ${sku}`.slice(0, 200);
}
let FashionIntakeService = FashionIntakeService_1 = class FashionIntakeService {
    db;
    organizations;
    listings;
    images;
    queue;
    events;
    logger = new common_1.Logger(FashionIntakeService_1.name);
    constructor(db, organizations, listings, images, queue, events) {
        this.db = db;
        this.organizations = organizations;
        this.listings = listings;
        this.images = images;
        this.queue = queue;
        this.events = events;
    }
    emitWarehouse(organizationId, fashionWarehouseId) {
        this.events?.emit('stock.fashion-warehouse.saved', {
            organizationId,
            fashionWarehouseId,
        });
    }
    async listWarehouses(user, organizationId, includeInactive = false) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        return this.db.getRepository(fashion_warehouse_entity_js_1.FashionWarehouse).find({
            where: {
                organizationId: org.organizationId,
                ...(includeInactive ? {} : { active: true }),
            },
            order: { code: 'ASC' },
        });
    }
    async createWarehouse(user, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const repo = this.db.getRepository(fashion_warehouse_entity_js_1.FashionWarehouse);
        const code = dto.code.trim().toUpperCase();
        if (await repo.existsBy({ organizationId: org.organizationId, code }))
            throw new common_1.ConflictException(`Warehouse ${code} already exists`);
        const saved = await repo.save(repo.create({
            organizationId: org.organizationId,
            code,
            name: dto.name.trim(),
            countryCode: dto.countryCode?.toUpperCase() ?? null,
            active: dto.active ?? true,
        }));
        this.emitWarehouse(org.organizationId, saved.id);
        return saved;
    }
    async updateWarehouse(user, id, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const repo = this.db.getRepository(fashion_warehouse_entity_js_1.FashionWarehouse);
        const warehouse = await repo.findOneBy({
            id,
            organizationId: org.organizationId,
        });
        if (!warehouse)
            throw new common_1.NotFoundException('Warehouse not found');
        if (dto.name !== undefined)
            warehouse.name = dto.name.trim();
        if (dto.countryCode !== undefined)
            warehouse.countryCode = dto.countryCode.toUpperCase();
        if (dto.active !== undefined)
            warehouse.active = dto.active;
        const saved = await repo.save(warehouse);
        this.emitWarehouse(org.organizationId, saved.id);
        return saved;
    }
    async batches(user, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const rows = await this.db.query(`SELECT c.batch, c.last_value,
              COUNT(p.id) AS item_count,
              GREATEST(c.updated_at, MAX(p."createdAt")) AS last_used
         FROM fashion_sku_counters c
         LEFT JOIN catalog_products p
           ON p.organization_id = c.organization_id
          AND p.vertical = 'fashion'
          AND p.vertical_attributes->>'_intakeBatch' = c.batch
        WHERE c.organization_id = $1
        GROUP BY c.batch, c.last_value, c.updated_at
        ORDER BY last_used DESC NULLS LAST
        LIMIT 200`, [org.organizationId]);
        return rows.map((row) => ({
            batch: row.batch,
            lastNumber: Number(row.last_value),
            itemCount: Number(row.item_count),
            lastUsedAt: row.last_used,
        }));
    }
    async nextSku(user, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const batch = dto.batch.trim().toUpperCase();
        const suffix = dto.sizeSuffix?.trim().toUpperCase();
        for (let attempt = 0; attempt < 25; attempt++) {
            const number = await this.reserveNumber(org.organizationId, batch);
            const base = `${batch}-${String(number).padStart(4, '0')}`;
            const sku = suffix ? `${base}-${suffix}` : base;
            const products = this.db.getRepository(catalog_product_entity_js_1.CatalogProduct);
            const taken = await products.createQueryBuilder('p')
                .where('p.sku = :base OR p.sku LIKE :sized', { base, sized: `${base}-%` })
                .getExists();
            if (!taken)
                return { batch, number, sku };
        }
        throw new common_1.ConflictException(`Could not find a free SKU for batch ${batch}. Check for SKUs already using this prefix.`);
    }
    async reserveNumber(organizationId, batch) {
        return this.db.transaction(async (manager) => {
            await manager.query(`SET LOCAL lock_timeout = '5s'`);
            await manager.query(`SET LOCAL statement_timeout = '10s'`);
            await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['fashion-sku', batch]);
            const counters = await manager.query('SELECT MAX(last_value) AS last_value FROM fashion_sku_counters WHERE batch = $1', [batch]);
            let last = Number(counters[0]?.last_value ?? 0);
            if (counters[0]?.last_value == null) {
                const seed = await manager.query(`SELECT MAX(CAST(SUBSTRING(sku FROM $1) AS INTEGER)) AS max_num FROM catalog_products WHERE sku ~ $2`, [`^${batch}-([0-9]{1,9})`, `^${batch}-[0-9]{1,9}(-[A-Z0-9]+)?$`]);
                last = Number(seed[0]?.max_num ?? 0);
            }
            const next = last + 1;
            await manager.query(`INSERT INTO fashion_sku_counters (organization_id, batch, last_value) VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, batch) DO UPDATE SET last_value = EXCLUDED.last_value, updated_at = now()`, [organizationId, batch, next]);
            return next;
        });
    }
    async create(user, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const sku = dto.sku.trim();
        const retry = async () => {
            if (!dto.captureId)
                return null;
            const existing = await this.db.getRepository(catalog_product_entity_js_1.CatalogProduct).findOneBy({
                sku, organizationId: org.organizationId, vertical: 'fashion',
            });
            return existing?.verticalAttributes?._captureId === dto.captureId &&
                existing.verticalAttributes._intakeCreatedBy === user.id
                ? this.listings.publicProduct(existing) : null;
        };
        const existing = await retry();
        if (existing)
            return existing;
        const slots = {
            front: [dto.frontImageUrl],
            back: [dto.backImageUrl],
            tag: dto.tagImageUrls,
            additional: dto.additionalImageUrls ?? [],
            sizeChart: dto.sizeChartImageUrl ? [dto.sizeChartImageUrl] : [],
        };
        const imageUrls = [];
        const roles = [];
        for (const role of PHOTO_ROLE_ORDER) {
            for (const url of slots[role]) {
                const value = url.trim();
                if (!isHttpUrl(value))
                    throw new common_1.BadRequestException(`The ${role} photo must be an uploaded image URL.`);
                if (imageUrls.includes(value))
                    throw new common_1.BadRequestException('The same photo is used in more than one slot.');
                imageUrls.push(value);
                roles.push(`${role}:${value}`);
            }
        }
        let warehouse = null;
        if (dto.warehouseCode?.trim()) {
            warehouse = await this.db.getRepository(fashion_warehouse_entity_js_1.FashionWarehouse).findOneBy({
                organizationId: org.organizationId,
                code: dto.warehouseCode.trim().toUpperCase(),
                active: true,
            });
            if (!warehouse)
                throw new common_1.BadRequestException('Choose an active Fashion warehouse.');
        }
        const attributes = {
            categoryFamily: dto.categoryFamily ?? 'clothing',
            _intakeSource: 'capture',
            _intakeCreatedBy: user.id,
            _catalogAdded: false,
            _photoRoles: roles,
            _analysisStatus: dto.identify === false ? 'skipped' : 'queued',
            ...(dto.captureId ? { _captureId: dto.captureId } : {}),
        };
        const confirmed = ['categoryFamily'];
        if (dto.department?.trim()) {
            attributes.department = dto.department.trim();
            confirmed.push('department');
        }
        if (dto.labelSize?.trim()) {
            attributes.size = dto.labelSize.trim();
            confirmed.push('size');
        }
        if (dto.batch)
            attributes._intakeBatch = dto.batch.trim().toUpperCase();
        if (warehouse) {
            attributes._warehouseCode = warehouse.code;
            attributes._warehouseName = warehouse.name;
        }
        if (dto.sizeChartImageUrl)
            attributes._sizeChartImageUrl = dto.sizeChartImageUrl.trim();
        if (dto.sizeChartTemplate) {
            const template = (0, fashion_measurements_js_1.fashionMeasurementTemplate)(dto.sizeChartTemplate);
            if (!template)
                throw new common_1.BadRequestException('Choose a valid measurement chart.');
            if (!dto.measurementsUnit)
                throw new common_1.BadRequestException('Choose cm or in for the measurements.');
            const values = dto.measurementValues ?? {};
            const missing = [];
            for (const point of template.points) {
                const parsed = (0, fashion_measurements_js_1.parseFashionMeasurement)(values[point.key]);
                if (parsed === null)
                    missing.push(`${point.letter} ${point.label}`);
                else
                    attributes[point.key] = String(parsed);
            }
            if (missing.length)
                throw new common_1.BadRequestException(`Enter every measurement on the ${template.label} chart: ${missing.join(', ')}.`);
            attributes.sizeChartTemplate = template.id;
            attributes.measurementsUnit = dto.measurementsUnit;
            confirmed.push('sizeChartTemplate', 'measurementsUnit', ...template.points.map((point) => point.key));
        }
        attributes._confirmedKeys = confirmed;
        let replayed = false;
        const product = await this.listings.create(user, {
            sku,
            title: pendingFashionTitle(sku),
            conditionId: dto.conditionId?.trim() || undefined,
            price: dto.price,
            quantity: dto.quantity ?? 1,
            imageUrls,
            verticalAttributes: attributes,
        }, org.organizationId).catch(async (error) => {
            if (error instanceof common_1.ConflictException) {
                const saved = await retry();
                if (saved) {
                    replayed = true;
                    return saved;
                }
            }
            throw error;
        });
        if (replayed)
            return product;
        const quantity = dto.quantity ?? 1;
        this.events?.emit('stock.intake.received', {
            organizationId: org.organizationId,
            userId: user.id,
            sku,
            vertical: 'fashion',
            quantity,
            catalogProductId: product.id,
            title: product.title,
            imageUrl: imageUrls[0] ?? null,
            trackingMode: quantity === 1 ? 'one_off' : 'quantity',
            warehouseCode: warehouse?.code ?? null,
            conditionId: dto.conditionId?.trim() || null,
            lotCode: dto.batch?.trim().toUpperCase() || null,
            idempotencyKey: `fashion-intake:${product.id}`,
        });
        if (dto.identify !== false)
            void this.enqueue(product.id, org.organizationId).catch((error) => {
                this.logger.error(`Could not record identification status: ${error instanceof Error ? error.message : 'Unknown error'}`);
            });
        return product;
    }
    async addToCatalog(user, id, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        return this.db.transaction(async (manager) => {
            const repo = manager.getRepository(catalog_product_entity_js_1.CatalogProduct);
            const product = await repo.findOne({
                where: { id, organizationId: org.organizationId, vertical: 'fashion' },
                lock: { mode: 'pessimistic_write' },
            });
            if (!product)
                throw new common_1.NotFoundException('Fashion intake item not found');
            const attributes = product.verticalAttributes ?? {};
            if (attributes._intakeSource !== 'capture')
                throw new common_1.ConflictException('This item is not waiting in Fashion intake.');
            if (!isCapturePending(attributes))
                return { id: product.id, addedToCatalog: true, alreadyAdded: true };
            const analysisStatus = stringValue(attributes._analysisStatus);
            if (!['suggested', 'skipped'].includes(analysisStatus ?? ''))
                throw new common_1.ConflictException('Finish identification or choose manual entry before adding this item to the catalog.');
            if (product.manualReview || product.verticalValidationStatus === 'quarantined')
                throw new common_1.ConflictException('Quarantined items cannot be added to the catalog.');
            const addedAt = new Date().toISOString();
            product.verticalAttributes = {
                ...attributes,
                _catalogAdded: true,
                _catalogAddedBy: user.id,
                _catalogAddedAt: addedAt,
            };
            await repo.save(product);
            await manager.getRepository(listing_action_log_entity_js_1.ListingActionLog).save({
                organizationId: org.organizationId,
                catalogProductId: product.id,
                userId: user.id,
                action: 'fashion.intake.catalog_added',
                result: 'success',
                beforeSnapshot: { addedToCatalog: false },
                afterSnapshot: { addedToCatalog: true, addedAt },
            });
            return { id: product.id, addedToCatalog: true, addedAt, addedByUserId: user.id };
        });
    }
    async requestIdentification(user, id, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        await this.db.transaction(async (manager) => {
            const product = await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).findOne({
                where: { id, organizationId: org.organizationId, vertical: 'fashion' },
                lock: { mode: 'pessimistic_write' },
            });
            if (!product)
                throw new common_1.NotFoundException('Fashion listing not found');
            this.assertIdentifiable(product);
            if (!(product.imageUrls ?? []).length)
                throw new common_1.BadRequestException('Add photos before identification.');
            product.verticalAttributes = {
                ...(product.verticalAttributes ?? {}),
                _analysisStatus: 'queued',
                _analysisQueuedAt: new Date().toISOString(),
            };
            await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).save(product);
        });
        await this.enqueue(id, org.organizationId);
        return { id, analysisStatus: 'queued' };
    }
    async enqueue(productId, organizationId) {
        let deadline;
        try {
            const enqueue = this.queue.add('identify', { productId, organizationId }, { jobId: `fashion-identify-${productId}-${Date.now()}`, attempts: 1 });
            await Promise.race([enqueue, new Promise((_, reject) => {
                    deadline = setTimeout(() => reject(new Error('Identification queue did not respond within 10 seconds.')), 10_000);
                    deadline.unref();
                })]);
        }
        catch (error) {
            this.logger.error(`Could not queue Fashion identification for ${productId}: ${error instanceof Error ? error.message : error}`);
            await this.setStatus(productId, organizationId, 'failed', [
                'Background identification could not be queued. Open the item and retry identification.',
            ]);
        }
        finally {
            if (deadline)
                clearTimeout(deadline);
        }
    }
    assertIdentifiable(product) {
        if (product.manualReview ||
            product.verticalValidationStatus === 'quarantined')
            throw new common_1.ConflictException('Quarantined listings cannot be re-identified.');
        if (!['draft', 'needs_review', 'rejected'].includes(product.verticalValidationStatus))
            throw new common_1.ConflictException('Approved listings are not changed by identification. Edit the item instead.');
    }
    async processIdentification(job) {
        const repo = this.db.getRepository(catalog_product_entity_js_1.CatalogProduct);
        const start = await repo.findOneBy({
            id: job.productId,
            organizationId: job.organizationId,
            vertical: 'fashion',
        });
        if (!start)
            return { skipped: 'not_found' };
        try {
            this.assertIdentifiable(start);
        }
        catch {
            return { skipped: 'not_identifiable' };
        }
        await this.setStatus(start.id, job.organizationId, 'processing');
        const attrs = start.verticalAttributes ?? {};
        const charts = new Set(stringList(attrs._photoRoles)
            .filter((entry) => entry.startsWith('sizeChart:'))
            .map((entry) => entry.slice('sizeChart:'.length)));
        const chartUrl = stringValue(attrs._sizeChartImageUrl);
        if (chartUrl)
            charts.add(chartUrl);
        const photos = (start.imageUrls ?? []).filter((url) => !charts.has(url));
        if (!photos.length) {
            await this.setStatus(start.id, job.organizationId, 'failed', [
                'No garment photos to identify.',
            ]);
            return { status: 'failed' };
        }
        const confirmedKeys = stringList(attrs._confirmedKeys);
        const titleConfirmed = isTitleConfirmed(start);
        const descriptionConfirmed = isTrue(attrs._descriptionConfirmed);
        const result = await this.images.analyzeImages({
            imageUrls: photos,
            currentAttributes: attrs,
            confirmedKeys,
            sku: start.sku ?? undefined,
            currentTitle: titleConfirmed ? start.title : undefined,
            currentDescription: descriptionConfirmed
                ? (start.description ?? undefined)
                : undefined,
            currentBrand: start.brand ?? undefined,
            titleConfirmed,
            descriptionConfirmed,
            marketplaceId: stringValue(attrs._intakeMarketplaceId) ?? undefined,
        });
        return this.db.transaction(async (manager) => {
            const product = await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).findOne({
                where: {
                    id: start.id,
                    organizationId: job.organizationId,
                    vertical: 'fashion',
                },
                lock: { mode: 'pessimistic_write' },
            });
            if (!product)
                return { skipped: 'not_found' };
            try {
                this.assertIdentifiable(product);
            }
            catch {
                return { skipped: 'not_identifiable' };
            }
            const latest = product.verticalAttributes ?? {};
            if (result.status === 'failed') {
                product.verticalAttributes = {
                    ...latest,
                    _analysisStatus: 'failed',
                    _warnings: result.warnings,
                    _lastAnalyzedAt: new Date().toISOString(),
                };
                await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).save(product);
                await this.audit(manager, product, 'fashion.intake.identify', 'failed');
                return { status: 'failed' };
            }
            const latestConfirmed = stringList(latest._confirmedKeys);
            const suggestions = {};
            for (const [key, value] of Object.entries(result.attributes))
                if (!(0, fashion_config_js_1.isFashionMetaKey)(key))
                    suggestions[key] = value;
            const current = {};
            for (const [key, value] of Object.entries(latest))
                if (!(0, fashion_config_js_1.isFashionMetaKey)(key))
                    current[key] = value;
            const merged = (0, fashion_config_js_1.mergeFashionSuggestions)({
                current,
                suggested: suggestions,
                confirmedKeys: latestConfirmed,
            });
            const meta = {};
            for (const [key, value] of Object.entries(latest))
                if ((0, fashion_config_js_1.isFashionMetaKey)(key))
                    meta[key] = value;
            const validated = (0, fashion_config_js_1.validateFashionAttributes)({
                ...merged.attributes,
                ...meta,
                _suggestedKeys: [
                    ...new Set([
                        ...stringList(latest._suggestedKeys),
                        ...merged.suggestedKeys,
                    ]),
                ],
                _conflictKeys: merged.conflicts.map((item) => item.key),
                _conflictNotes: merged.conflicts
                    .map((item) => `${item.key}: current "${item.current}" vs suggested "${item.suggested}"`)
                    .join('; '),
                _warnings: [
                    ...new Set([...result.warnings, ...result.validationErrors]),
                ],
                _multipleItems: result.multipleItems,
                _analysisStatus: 'suggested',
                _lastAnalyzedAt: new Date().toISOString(),
            });
            if (!isTitleConfirmed(product) && result.title.trim())
                product.title = result.title.trim().slice(0, 200);
            if (!isTrue(latest._descriptionConfirmed) && result.description.trim())
                product.description = result.description;
            if (!product.brand && result.brand)
                product.brand = result.brand;
            if (!product.conditionId) {
                const label = (result.conditionLabel ?? '').toUpperCase();
                if (label === 'NEW')
                    product.conditionId = '1000';
                if (label === 'USED')
                    product.conditionId = '3000';
            }
            if (!product.categoryId && result.category.categoryId) {
                product.categoryId = result.category.categoryId;
                product.categoryName = result.category.categoryName;
            }
            product.verticalAttributes = validated.attributes;
            await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).save(product);
            await this.audit(manager, product, 'fashion.intake.identify', 'success');
            return { status: 'suggested' };
        });
    }
    async setStatus(id, organizationId, status, warnings) {
        await this.db.transaction(async (manager) => {
            const product = await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).findOne({
                where: { id, organizationId, vertical: 'fashion' },
                lock: { mode: 'pessimistic_write' },
            });
            if (!product)
                return;
            product.verticalAttributes = {
                ...(product.verticalAttributes ?? {}),
                _analysisStatus: status,
                ...(warnings ? { _warnings: warnings } : {}),
            };
            await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).save(product);
        });
    }
    async audit(manager, product, action, result) {
        await manager.getRepository(listing_action_log_entity_js_1.ListingActionLog).save({
            organizationId: product.organizationId,
            catalogProductId: product.id,
            userId: null,
            action,
            result,
            beforeSnapshot: null,
            afterSnapshot: {
                analysisStatus: product.verticalAttributes?._analysisStatus ?? null,
            },
        });
    }
    async history(user, params) {
        const org = await this.organizations.resolveOrganizationId(user.id, params.organizationId);
        const page = Math.max(Number(params.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(params.pageSize) || 25, 1), 100);
        const query = this.db
            .getRepository(catalog_product_entity_js_1.CatalogProduct)
            .createQueryBuilder('p')
            .where('p.organization_id = :org', { org: org.organizationId })
            .andWhere(`p.vertical = 'fashion'`);
        if (params.source !== 'all')
            query.andWhere(`p.vertical_attributes->>'_intakeSource' = 'capture'`);
        if (params.batch?.trim())
            query.andWhere(`p.vertical_attributes->>'_intakeBatch' = :batch`, {
                batch: params.batch.trim().toUpperCase(),
            });
        if (params.status?.trim())
            query.andWhere(`p.vertical_attributes->>'_analysisStatus' = :status`, {
                status: params.status.trim(),
            });
        if (params.q?.trim())
            query.andWhere('(p.sku ILIKE :q OR p.title ILIKE :q)', {
                q: `%${params.q.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`,
            });
        const [products, total] = await query
            .orderBy('p.createdAt', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();
        const reviews = products.length
            ? await this.db.getRepository(fashion_review_entity_js_1.FashionReview).find({
                where: {
                    organizationId: org.organizationId,
                    catalogProductId: (0, typeorm_1.In)(products.map((product) => product.id)),
                },
            })
            : [];
        const reviewStatus = new Map(reviews.map((review) => [review.catalogProductId, review.status]));
        return {
            page,
            pageSize,
            total,
            items: products.map((product) => {
                const attrs = product.verticalAttributes ?? {};
                return {
                    id: product.id,
                    sku: product.sku,
                    title: product.title,
                    batch: stringValue(attrs._intakeBatch),
                    warehouseCode: stringValue(attrs._warehouseCode),
                    warehouseName: stringValue(attrs._warehouseName),
                    imageCount: (product.imageUrls ?? []).length,
                    primaryImageUrl: product.imageUrls?.[0] ?? null,
                    analysisStatus: stringValue(attrs._analysisStatus),
                    validationStatus: product.verticalValidationStatus,
                    manualReview: product.manualReview,
                    reviewStatus: reviewStatus.get(product.id) ?? 'pending',
                    addedToCatalog: !isCapturePending(attrs),
                    catalogAddedAt: stringValue(attrs._catalogAddedAt),
                    hasSizeChart: Boolean(stringValue(attrs._sizeChartImageUrl)),
                    createdAt: product.createdAt,
                    updatedAt: product.updatedAt,
                };
            }),
        };
    }
    async activityReport(user, params) {
        const org = await this.organizations.resolveOrganizationId(user.id, params.organizationId);
        const query = this.activityQuery(org.organizationId, params);
        const page = Math.max(Number(params.page) || 1, 1);
        const pageSize = Math.min(Math.max(Number(params.pageSize) || 25, 1), 500);
        const [products, total] = await query
            .clone()
            .orderBy(ACTIVITY_AT_SQL, 'DESC')
            .addOrderBy('p.id', 'ASC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();
        const summary = await this.activitySummary(query);
        const items = await this.activityItems(products, org.organizationId);
        const creatorGroups = await query.clone()
            .select(INTAKE_CREATOR_SQL, 'userId')
            .addSelect('COUNT(*)::int', 'itemCount')
            .groupBy(INTAKE_CREATOR_SQL)
            .getRawMany();
        const adderGroups = await query.clone()
            .select(CATALOG_ADDER_SQL, 'userId')
            .addSelect('COUNT(*)::int', 'itemCount')
            .andWhere(`NOT ${INTAKE_PENDING_SQL}`)
            .groupBy(CATALOG_ADDER_SQL)
            .getRawMany();
        const actorIds = [...new Set([
                ...creatorGroups.map((row) => row.userId),
                ...adderGroups.map((row) => row.userId),
                ...items.flatMap((item) => [item.uploadedByUserId, item.addedByUserId, ...item.publicationTargets.map((target) => target.requestedByUserId)]),
            ].filter((id) => Boolean(id)))];
        const users = actorIds.length
            ? await this.db.getRepository(user_entity_js_1.User).find({ where: { id: (0, typeorm_1.In)(actorIds) }, select: ['id', 'name', 'email'] })
            : [];
        const userMap = new Map(users.map((actor) => [actor.id, { id: actor.id, name: actor.name || actor.email, email: actor.email }]));
        const addUserLabels = (rows) => rows
            .filter((row) => Boolean(row.userId))
            .map((row) => ({ user: userMap.get(row.userId) ?? { id: row.userId, name: row.userId, email: '' }, itemCount: Number(row.itemCount) }))
            .sort((a, b) => b.itemCount - a.itemCount);
        return {
            page,
            pageSize,
            total,
            summary,
            uploadedBy: addUserLabels(creatorGroups),
            addedBy: addUserLabels(adderGroups),
            users: [...userMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
            items,
        };
    }
    async exportActivity(user, params) {
        const org = await this.organizations.resolveOrganizationId(user.id, params.organizationId);
        const query = this.activityQuery(org.organizationId, params);
        const total = await query.clone().getCount();
        if (total > 250_000)
            throw new common_1.BadRequestException('Narrow the date range or filters to export at most 250,000 Fashion items at a time.');
        const header = [
            'SKU', 'Title', 'Brand', 'Category', 'Fashion family', 'Condition', 'Price', 'Quantity',
            'Description', 'Images', 'Uploaded by', 'Uploaded at', 'Identification status',
            'Catalog status', 'Added by', 'Added at', 'Review status', 'Publication targets',
            'Fashion attributes',
        ];
        const rows = [header.map(csvCell).join(',')];
        for (let offset = 0; offset < total; offset += 500) {
            const products = await query.clone()
                .orderBy(ACTIVITY_AT_SQL, 'DESC')
                .addOrderBy('p.id', 'ASC')
                .skip(offset)
                .take(500)
                .getMany();
            const items = await this.activityItems(products, org.organizationId);
            for (const item of items)
                rows.push([
                    item.sku, item.title, item.brand, item.categoryName, item.attributes.categoryFamily,
                    item.conditionLabel ?? item.conditionId, item.price, item.quantity, item.description,
                    (item.imageUrls ?? []).join(' | '), item.uploadedBy?.name, item.createdAt,
                    item.analysisStatus, item.addedToCatalog ? 'Added to catalog' : 'Waiting in intake',
                    item.addedBy?.name, item.catalogAddedAt, item.reviewStatus,
                    item.publicationTargets.map((target) => `${target.storeName} (${target.status}; ${JSON.stringify(target.policies)})`).join(' | '),
                    JSON.stringify(item.attributes),
                ].map(csvCell).join(','));
        }
        return rows.join('\r\n');
    }
    activityQuery(organizationId, params) {
        const query = this.db.getRepository(catalog_product_entity_js_1.CatalogProduct).createQueryBuilder('p')
            .where('p.organization_id = :activityOrg', { activityOrg: organizationId })
            .andWhere("p.vertical = 'fashion'")
            .andWhere("p.vertical_validation_status <> 'deleted'");
        const parseDate = (value, name, endOfDay = false) => {
            if (!value)
                return undefined;
            const parsed = new Date(value);
            if (!Number.isFinite(parsed.getTime()))
                throw new common_1.BadRequestException(`${name} must be a valid date.`);
            if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value))
                parsed.setUTCDate(parsed.getUTCDate() + 1);
            return parsed;
        };
        const from = parseDate(params.from, 'from');
        const to = parseDate(params.to, 'to', true);
        if (from && to && from >= to)
            throw new common_1.BadRequestException('from must be earlier than to.');
        if (from)
            query.andWhere(`${ACTIVITY_AT_SQL} >= :activityFrom`, { activityFrom: from });
        if (to)
            query.andWhere(`${ACTIVITY_AT_SQL} < :activityTo`, { activityTo: to });
        if (params.uploadedBy?.trim())
            query.andWhere(`${INTAKE_CREATOR_SQL} = :activityUploader`, { activityUploader: params.uploadedBy.trim() });
        if (params.addedBy?.trim())
            query.andWhere(`${CATALOG_ADDER_SQL} = :activityAdder`, { activityAdder: params.addedBy.trim() });
        if (params.analysisStatus?.trim())
            query.andWhere("p.vertical_attributes->>'_analysisStatus' = :activityAnalysis", { activityAnalysis: params.analysisStatus.trim() });
        if (params.catalogStatus === 'pending')
            query.andWhere(INTAKE_PENDING_SQL);
        if (params.catalogStatus === 'added')
            query.andWhere(`NOT ${INTAKE_PENDING_SQL}`);
        if (params.catalogStatus && !['pending', 'added'].includes(params.catalogStatus))
            throw new common_1.BadRequestException('catalogStatus must be pending or added.');
        if (params.reviewStatus?.trim()) {
            if (params.reviewStatus === 'pending')
                query.andWhere("NOT EXISTS (SELECT 1 FROM fashion_reviews fr WHERE fr.catalog_product_id=p.id AND fr.organization_id=p.organization_id AND fr.status <> 'pending')");
            else
                query.andWhere('EXISTS (SELECT 1 FROM fashion_reviews fr WHERE fr.catalog_product_id=p.id AND fr.organization_id=p.organization_id AND fr.status=:activityReview)', { activityReview: params.reviewStatus.trim() });
        }
        if (params.publicationStatus?.trim())
            query.andWhere(`EXISTS (
      SELECT 1 FROM ebay_listing_job_targets pt
      JOIN ebay_listing_jobs pj ON pj.id=pt.listing_job_id AND pj.organization_id=p.organization_id
      WHERE pt.catalog_product_id=p.id AND pt.vertical='fashion' AND pt.status=:activityPublicationStatus
    )`, { activityPublicationStatus: params.publicationStatus.trim() });
        if (params.storeId?.trim())
            query.andWhere(`EXISTS (
      SELECT 1 FROM ebay_listing_job_targets pt
      JOIN connected_ebay_accounts pa ON pa.id=pt.ebay_account_id
      JOIN ebay_listing_jobs pj ON pj.id=pt.listing_job_id AND pj.organization_id=p.organization_id
      WHERE pt.catalog_product_id=p.id AND pt.vertical='fashion' AND pa.primary_store_id=:activityStoreId
    )`, { activityStoreId: params.storeId.trim() });
        if (params.batch?.trim())
            query.andWhere("p.vertical_attributes->>'_intakeBatch' = :activityBatch", { activityBatch: params.batch.trim().toUpperCase() });
        if (params.q?.trim()) {
            const search = `%${params.q.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`;
            query.andWhere(`(
        p.sku ILIKE :activitySearch ESCAPE '\\'
        OR p.title ILIKE :activitySearch ESCAPE '\\'
        OR p.brand ILIKE :activitySearch ESCAPE '\\'
        OR p.description ILIKE :activitySearch ESCAPE '\\'
        OR p.condition_id ILIKE :activitySearch ESCAPE '\\'
        OR p.condition_label ILIKE :activitySearch ESCAPE '\\'
        OR p.category_id ILIKE :activitySearch ESCAPE '\\'
        OR p.category_name ILIKE :activitySearch ESCAPE '\\'
        OR p.price::text ILIKE :activitySearch ESCAPE '\\'
        OR p.quantity::text ILIKE :activitySearch ESCAPE '\\'
        OR array_to_string(p.image_urls, ' ') ILIKE :activitySearch ESCAPE '\\'
        OR CAST(p.vertical_attributes AS text) ILIKE :activitySearch ESCAPE '\\'
      )`, { activitySearch: search });
        }
        const attributeKey = params.attributeKey?.trim().slice(0, 100);
        const attributeValue = params.attributeValue?.trim().slice(0, 200);
        if (attributeKey && attributeValue)
            query.andWhere(`EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.vertical_attributes -> :activityAttributeKey)='array'
        THEN p.vertical_attributes -> :activityAttributeKey
        ELSE jsonb_build_array(p.vertical_attributes ->> :activityAttributeKey) END) av
      WHERE lower(av) = lower(:activityAttributeValue)
    )`, { activityAttributeKey: attributeKey, activityAttributeValue: attributeValue });
        else if (attributeKey)
            query.andWhere("p.vertical_attributes ? :activityAttributeOnlyKey", { activityAttributeOnlyKey: attributeKey });
        else if (attributeValue)
            query.andWhere('CAST(p.vertical_attributes AS text) ILIKE :activityAttributeSearch', { activityAttributeSearch: `%${attributeValue.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%` });
        return query;
    }
    async activitySummary(query) {
        const raw = await query.clone().select('COUNT(*)::int', 'total')
            .addSelect("COUNT(*) FILTER (WHERE p.vertical_attributes->>'_analysisStatus' IN ('suggested','skipped'))::int", 'processed')
            .addSelect(`COUNT(*) FILTER (WHERE NOT ${INTAKE_PENDING_SQL})::int`, 'catalogAdded')
            .addSelect(`COUNT(*) FILTER (WHERE ${INTAKE_PENDING_SQL})::int`, 'waitingInIntake')
            .addSelect("COUNT(*) FILTER (WHERE p.vertical_attributes->>'_analysisStatus' = 'failed')::int", 'failed')
            .getRawOne();
        return Object.fromEntries(Object.entries(raw ?? {}).map(([key, value]) => [key, Number(value ?? 0)]));
    }
    async activityItems(products, organizationId) {
        if (!products.length)
            return [];
        const ids = products.map((product) => product.id);
        const [creationLogs, targets, reviews] = await Promise.all([
            this.db.getRepository(listing_action_log_entity_js_1.ListingActionLog).find({
                where: { organizationId, catalogProductId: (0, typeorm_1.In)(ids), action: 'fashion.draft.created' },
                order: { createdAt: 'ASC' },
            }),
            this.db.getRepository(ebay_listing_job_target_entity_js_1.EbayListingJobTarget).find({
                where: { catalogProductId: (0, typeorm_1.In)(ids), vertical: 'fashion' },
                relations: { listingJob: true, ebayAccount: { primaryStore: true } },
                order: { createdAt: 'DESC' },
            }),
            this.db.getRepository(fashion_review_entity_js_1.FashionReview).find({
                where: { organizationId, catalogProductId: (0, typeorm_1.In)(ids) },
            }),
        ]);
        const logCreator = new Map();
        for (const log of creationLogs)
            if (log.catalogProductId && log.userId && !logCreator.has(log.catalogProductId))
                logCreator.set(log.catalogProductId, log.userId);
        const targetsByProduct = new Map();
        for (const target of targets) {
            if (!target.catalogProductId)
                continue;
            const rows = targetsByProduct.get(target.catalogProductId) ?? [];
            rows.push(target);
            targetsByProduct.set(target.catalogProductId, rows);
        }
        const reviewByProduct = new Map(reviews.map((review) => [review.catalogProductId, review.status]));
        const actorIds = [...new Set([
                ...products.flatMap((product) => {
                    const attrs = product.verticalAttributes ?? {};
                    return [stringValue(attrs._intakeCreatedBy), stringValue(attrs._createdByUserId), stringValue(attrs._catalogAddedBy), logCreator.get(product.id)];
                }),
                ...targets.map((target) => target.listingJob?.requestedByUserId ?? null),
            ].filter((id) => Boolean(id)))];
        const users = actorIds.length ? await this.db.getRepository(user_entity_js_1.User).find({ where: { id: (0, typeorm_1.In)(actorIds) }, select: ['id', 'name', 'email'] }) : [];
        const userMap = new Map(users.map((actor) => [actor.id, { id: actor.id, name: actor.name || actor.email, email: actor.email }]));
        const actor = (id) => id ? (userMap.get(id) ?? { id, name: id, email: '' }) : null;
        return products.map((product) => {
            const attrs = product.verticalAttributes ?? {};
            const uploadedByUserId = stringValue(attrs._intakeCreatedBy) ?? stringValue(attrs._createdByUserId) ?? logCreator.get(product.id) ?? null;
            const addedToCatalog = !isCapturePending(attrs);
            const addedByUserId = addedToCatalog ? stringValue(attrs._catalogAddedBy) ?? uploadedByUserId : null;
            const publications = (targetsByProduct.get(product.id) ?? []).map((target) => ({
                storeId: target.ebayAccount?.primaryStoreId ?? null,
                storeName: target.ebayAccount?.primaryStore?.storeName ?? target.ebayAccount?.accountDisplayName ?? 'eBay store',
                marketplaceId: target.marketplaceId,
                status: target.status,
                policies: target.resultPayload?.policyOverrides ?? {},
                requestedByUserId: target.listingJob?.requestedByUserId ?? null,
                requestedBy: actor(target.listingJob?.requestedByUserId),
                createdAt: target.createdAt,
            }));
            const attributes = Object.fromEntries(Object.entries(attrs).filter(([key]) => !key.startsWith('_')));
            return {
                id: product.id,
                sku: product.sku,
                title: product.title,
                description: product.description,
                brand: product.brand,
                conditionId: product.conditionId,
                conditionLabel: product.conditionLabel,
                price: product.price,
                quantity: product.quantity,
                imageUrls: product.imageUrls ?? [],
                categoryId: product.categoryId,
                categoryName: product.categoryName,
                attributes,
                uploadedByUserId,
                uploadedBy: actor(uploadedByUserId),
                createdAt: product.createdAt,
                analysisStatus: stringValue(attrs._analysisStatus) ?? 'manual',
                addedToCatalog,
                addedByUserId,
                addedBy: actor(addedByUserId),
                catalogAddedAt: addedToCatalog ? stringValue(attrs._catalogAddedAt) ?? product.createdAt.toISOString() : null,
                validationStatus: product.verticalValidationStatus,
                reviewStatus: reviewByProduct.get(product.id) ?? 'pending',
                batch: stringValue(attrs._intakeBatch),
                publicationTargets: publications,
            };
        });
    }
};
exports.FashionIntakeService = FashionIntakeService;
exports.FashionIntakeService = FashionIntakeService = FashionIntakeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, bullmq_1.InjectQueue)(exports.FASHION_INTAKE_QUEUE)),
    __param(5, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        user_organization_service_js_1.UserOrganizationService,
        fashion_listings_service_js_1.FashionListingsService,
        fashion_image_analysis_service_js_1.FashionImageAnalysisService, Function, event_emitter_1.EventEmitter2])
], FashionIntakeService);
function isTitleConfirmed(product) {
    if (product.sku && product.title === pendingFashionTitle(product.sku))
        return false;
    return isTrue(product.verticalAttributes?._titleConfirmed);
}
function isHttpUrl(value) {
    if (value.startsWith('/api/storage/serve/'))
        return true;
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
    }
    catch {
        return false;
    }
}
function stringValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function stringList(value) {
    if (Array.isArray(value))
        return value.filter((item) => typeof item === 'string');
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
}
function isTrue(value) {
    return value === true || value === 'true';
}
function isCapturePending(attributes) {
    return attributes._intakeSource === 'capture' &&
        (attributes._catalogAdded === false || attributes._catalogAdded === 'false');
}
function csvCell(value) {
    const text = value == null ? '' : typeof value === 'string' ? value : String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
}
//# sourceMappingURL=fashion-intake.service.js.map