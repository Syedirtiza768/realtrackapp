import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import { DataSource, In, SelectQueryBuilder } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayListingJobTarget } from '../integrations/ebay/entities/ebay-listing-job-target.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { FashionReview } from './entities/fashion-review.entity.js';
import { FashionWarehouse } from './entities/fashion-warehouse.entity.js';
import { FashionListingsService } from './fashion-listings.service.js';
import { FashionImageAnalysisService } from './fashion-image-analysis.service.js';
import {
  fashionMeasurementTemplate,
  parseFashionMeasurement,
} from './fashion-measurements.js';
import {
  isFashionMetaKey,
  mergeFashionSuggestions,
  validateFashionAttributes,
} from './fashion.config.js';
import type {
  CreateFashionIntakeDto,
  FashionWarehouseDto,
  NextFashionSkuDto,
  UpdateFashionWarehouseDto,
} from './fashion.dto.js';
import type { ProductAttributes } from './vertical.types.js';

export const FASHION_INTAKE_QUEUE = 'fashion-intake-analysis';

export type FashionIntakeJob = { productId: string; organizationId: string };

export type FashionAnalysisStatus =
  | 'queued'
  | 'processing'
  | 'suggested'
  | 'failed'
  | 'skipped';

/** Photo slot order is the eBay picture order: front is the primary image. */
const PHOTO_ROLE_ORDER = [
  'front',
  'back',
  'tag',
  'additional',
  'sizeChart',
] as const;
export type FashionPhotoRole = (typeof PHOTO_ROLE_ORDER)[number];

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

/** Placeholder until background identification writes a real title. */
export function pendingFashionTitle(sku: string) {
  return `Pending identification — ${sku}`.slice(0, 200);
}

@Injectable()
export class FashionIntakeService {
  private readonly logger = new Logger(FashionIntakeService.name);

  constructor(
    private readonly db: DataSource,
    private readonly organizations: UserOrganizationService,
    private readonly listings: FashionListingsService,
    private readonly images: FashionImageAnalysisService,
    @InjectQueue(FASHION_INTAKE_QUEUE) private readonly queue: Queue,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  /** Mirrors the warehouse into StockModule's `warehouses` table. */
  private emitWarehouse(organizationId: string, fashionWarehouseId: string) {
    this.events?.emit('stock.fashion-warehouse.saved', {
      organizationId,
      fashionWarehouseId,
    });
  }

  /* ── Warehouses ─────────────────────────────────────────────────── */

  async listWarehouses(
    user: User,
    organizationId?: string,
    includeInactive = false,
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.db.getRepository(FashionWarehouse).find({
      where: {
        organizationId: org.organizationId,
        ...(includeInactive ? {} : { active: true }),
      },
      order: { code: 'ASC' },
    });
  }

  async createWarehouse(
    user: User,
    dto: FashionWarehouseDto,
    organizationId?: string,
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const repo = this.db.getRepository(FashionWarehouse);
    const code = dto.code.trim().toUpperCase();
    if (await repo.existsBy({ organizationId: org.organizationId, code }))
      throw new ConflictException(`Warehouse ${code} already exists`);
    const saved = await repo.save(
      repo.create({
        organizationId: org.organizationId,
        code,
        name: dto.name.trim(),
        countryCode: dto.countryCode?.toUpperCase() ?? null,
        active: dto.active ?? true,
      }),
    );
    this.emitWarehouse(org.organizationId, saved.id);
    return saved;
  }

  async updateWarehouse(
    user: User,
    id: string,
    dto: UpdateFashionWarehouseDto,
    organizationId?: string,
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const repo = this.db.getRepository(FashionWarehouse);
    const warehouse = await repo.findOneBy({
      id,
      organizationId: org.organizationId,
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (dto.name !== undefined) warehouse.name = dto.name.trim();
    if (dto.countryCode !== undefined)
      warehouse.countryCode = dto.countryCode.toUpperCase();
    if (dto.active !== undefined) warehouse.active = dto.active;
    const saved = await repo.save(warehouse);
    this.emitWarehouse(org.organizationId, saved.id);
    return saved;
  }

  /* ── Batches and SKUs ───────────────────────────────────────────── */

  async batches(user: User, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const rows = await this.db.query<
      Array<{
        batch: string;
        last_value: number;
        item_count: string;
        last_used: Date | null;
      }>
    >(
      `SELECT c.batch, c.last_value,
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
        LIMIT 200`,
      [org.organizationId],
    );
    return rows.map((row) => ({
      batch: row.batch,
      lastNumber: Number(row.last_value),
      itemCount: Number(row.item_count),
      lastUsedAt: row.last_used,
    }));
  }

  /**
   * Reserves the next SKU for a batch: `<BATCH>-<number>[-<SIZE>]`.
   * The counter is seeded from the highest existing `<BATCH>-<n>` SKU in the catalog
   * and skips numbers already taken (SKUs are globally unique across verticals).
   */
  async nextSku(user: User, dto: NextFashionSkuDto, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const batch = dto.batch.trim().toUpperCase();
    const suffix = dto.sizeSuffix?.trim().toUpperCase();
    for (let attempt = 0; attempt < 25; attempt++) {
      const number = await this.reserveNumber(org.organizationId, batch);
      const base = `${batch}-${String(number).padStart(4, '0')}`;
      const sku = suffix ? `${base}-${suffix}` : base;
      const products = this.db.getRepository(CatalogProduct);
      const taken =
        (await products.existsBy({ sku })) ||
        (await products.existsBy({ sku: base }));
      if (!taken) return { batch, number, sku };
    }
    throw new ConflictException(
      `Could not find a free SKU for batch ${batch}. Check for SKUs already using this prefix.`,
    );
  }

  private async reserveNumber(
    organizationId: string,
    batch: string,
  ): Promise<number> {
    const updated = await this.db.query<Array<{ last_value: number }>>(
      `UPDATE fashion_sku_counters
          SET last_value = last_value + 1, updated_at = now()
        WHERE organization_id = $1 AND batch = $2
        RETURNING last_value`,
      [organizationId, batch],
    );
    // TypeORM returns [rows, affected] for UPDATE … RETURNING on postgres.
    const updatedRows = Array.isArray(updated[0])
      ? (updated[0] as unknown as Array<{ last_value: number }>)
      : updated;
    if (updatedRows[0]?.last_value != null)
      return Number(updatedRows[0].last_value);

    const escaped = batch.replace(/[^A-Z0-9]/g, '');
    const seed = await this.db.query<Array<{ max_num: string | null }>>(
      `SELECT MAX(CAST(SUBSTRING(sku FROM $1) AS INTEGER)) AS max_num
         FROM catalog_products
        WHERE sku ~ $2`,
      [`^${escaped}-([0-9]{1,9})`, `^${escaped}-[0-9]{1,9}(-[A-Z0-9]+)?$`],
    );
    const start = Number(seed[0]?.max_num ?? 0) + 1;
    const inserted = await this.db.query<Array<{ last_value: number }>>(
      `INSERT INTO fashion_sku_counters (organization_id, batch, last_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, batch)
       DO UPDATE SET last_value = fashion_sku_counters.last_value + 1, updated_at = now()
       RETURNING last_value`,
      [organizationId, batch, start],
    );
    return Number(inserted[0].last_value);
  }

  /* ── Quick capture ──────────────────────────────────────────────── */

  async create(
    user: User,
    dto: CreateFashionIntakeDto,
    organizationId?: string,
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const sku = dto.sku.trim();

    const slots: Record<FashionPhotoRole, string[]> = {
      front: [dto.frontImageUrl],
      back: [dto.backImageUrl],
      tag: dto.tagImageUrls,
      additional: dto.additionalImageUrls ?? [],
      sizeChart: dto.sizeChartImageUrl ? [dto.sizeChartImageUrl] : [],
    };
    const imageUrls: string[] = [];
    const roles: string[] = [];
    for (const role of PHOTO_ROLE_ORDER) {
      for (const url of slots[role]) {
        const value = url.trim();
        if (!isHttpUrl(value))
          throw new BadRequestException(
            `The ${role} photo must be an uploaded image URL.`,
          );
        if (imageUrls.includes(value))
          throw new BadRequestException(
            'The same photo is used in more than one slot.',
          );
        imageUrls.push(value);
        roles.push(`${role}:${value}`);
      }
    }

    let warehouse: FashionWarehouse | null = null;
    if (dto.warehouseCode?.trim()) {
      warehouse = await this.db.getRepository(FashionWarehouse).findOneBy({
        organizationId: org.organizationId,
        code: dto.warehouseCode.trim().toUpperCase(),
        active: true,
      });
      if (!warehouse)
        throw new BadRequestException('Choose an active Fashion warehouse.');
    }
    const attributes: ProductAttributes = {
      categoryFamily: dto.categoryFamily ?? 'clothing',
      _intakeSource: 'capture',
      _intakeCreatedBy: user.id,
      _catalogAdded: false,
      _photoRoles: roles,
      _analysisStatus: dto.identify === false ? 'skipped' : 'queued',
    };
    const confirmed: string[] = ['categoryFamily'];
    if (dto.department?.trim()) {
      attributes.department = dto.department.trim();
      confirmed.push('department');
    }
    if (dto.labelSize?.trim()) {
      attributes.size = dto.labelSize.trim();
      confirmed.push('size');
    }
    if (dto.batch) attributes._intakeBatch = dto.batch.trim().toUpperCase();
    if (warehouse) {
      attributes._warehouseCode = warehouse.code;
      attributes._warehouseName = warehouse.name;
    }
    if (dto.sizeChartImageUrl)
      attributes._sizeChartImageUrl = dto.sizeChartImageUrl.trim();

    if (dto.sizeChartTemplate) {
      const template = fashionMeasurementTemplate(dto.sizeChartTemplate);
      if (!template)
        throw new BadRequestException('Choose a valid measurement chart.');
      if (!dto.measurementsUnit)
        throw new BadRequestException('Choose cm or in for the measurements.');
      const values = dto.measurementValues ?? {};
      const missing: string[] = [];
      for (const point of template.points) {
        const parsed = parseFashionMeasurement(values[point.key]);
        if (parsed === null) missing.push(`${point.letter} ${point.label}`);
        else attributes[point.key] = String(parsed);
      }
      if (missing.length)
        throw new BadRequestException(
          `Enter every measurement on the ${template.label} chart: ${missing.join(', ')}.`,
        );
      attributes.sizeChartTemplate = template.id;
      attributes.measurementsUnit = dto.measurementsUnit;
      confirmed.push(
        'sizeChartTemplate',
        'measurementsUnit',
        ...template.points.map((point) => point.key),
      );
    }
    attributes._confirmedKeys = confirmed;

    const product = await this.listings.create(
      user,
      {
        sku,
        title: pendingFashionTitle(sku),
        conditionId: dto.conditionId?.trim() || undefined,
        price: dto.price,
        quantity: dto.quantity ?? 1,
        imageUrls,
        verticalAttributes: attributes,
      },
      org.organizationId,
    );

    // Receive the garment into warehouse stock (ignored until the workspace sets up stock).
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
      await this.enqueue(product.id, org.organizationId);
    return product;
  }

  /** Makes a finished capture visible in the Fashion catalog and records its actor. */
  async addToCatalog(user: User, id: string, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.db.transaction(async (manager) => {
      const repo = manager.getRepository(CatalogProduct);
      const product = await repo.findOne({
        where: { id, organizationId: org.organizationId, vertical: 'fashion' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Fashion intake item not found');
      const attributes = product.verticalAttributes ?? {};
      if (attributes._intakeSource !== 'capture')
        throw new ConflictException('This item is not waiting in Fashion intake.');
      if (!isCapturePending(attributes))
        return { id: product.id, addedToCatalog: true, alreadyAdded: true };
      const analysisStatus = stringValue(attributes._analysisStatus);
      if (!['suggested', 'skipped'].includes(analysisStatus ?? ''))
        throw new ConflictException(
          'Finish identification or choose manual entry before adding this item to the catalog.',
        );
      if (product.manualReview || product.verticalValidationStatus === 'quarantined')
        throw new ConflictException('Quarantined items cannot be added to the catalog.');

      const addedAt = new Date().toISOString();
      product.verticalAttributes = {
        ...attributes,
        _catalogAdded: true,
        _catalogAddedBy: user.id,
        _catalogAddedAt: addedAt,
      };
      await repo.save(product);
      await manager.getRepository(ListingActionLog).save({
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

  /** Queues (or re-queues) background identification for a saved draft. */
  async requestIdentification(user: User, id: string, organizationId?: string) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    await this.db.transaction(async (manager) => {
      const product = await manager.getRepository(CatalogProduct).findOne({
        where: { id, organizationId: org.organizationId, vertical: 'fashion' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Fashion listing not found');
      this.assertIdentifiable(product);
      if (!(product.imageUrls ?? []).length)
        throw new BadRequestException('Add photos before identification.');
      product.verticalAttributes = {
        ...(product.verticalAttributes ?? {}),
        _analysisStatus: 'queued',
        _analysisQueuedAt: new Date().toISOString(),
      };
      await manager.getRepository(CatalogProduct).save(product);
    });
    await this.enqueue(id, org.organizationId);
    return { id, analysisStatus: 'queued' as const };
  }

  private async enqueue(productId: string, organizationId: string) {
    try {
      await this.queue.add(
        'identify',
        { productId, organizationId } satisfies FashionIntakeJob,
        { jobId: `fashion-identify-${productId}-${Date.now()}`, attempts: 1 },
      );
    } catch (error) {
      this.logger.error(
        `Could not queue Fashion identification for ${productId}: ${error instanceof Error ? error.message : error}`,
      );
      await this.setStatus(productId, organizationId, 'failed', [
        'Background identification could not be queued. Open the item and retry identification.',
      ]);
    }
  }

  private assertIdentifiable(product: CatalogProduct) {
    if (
      product.manualReview ||
      product.verticalValidationStatus === 'quarantined'
    )
      throw new ConflictException(
        'Quarantined listings cannot be re-identified.',
      );
    if (
      !['draft', 'needs_review', 'rejected'].includes(
        product.verticalValidationStatus,
      )
    )
      throw new ConflictException(
        'Approved listings are not changed by identification. Edit the item instead.',
      );
  }

  /**
   * Background job body. Runs the same photo identification as the editor, then merges
   * suggestions into the latest saved draft: confirmed values, a confirmed title and a
   * confirmed description are never overwritten, and approval status is not changed.
   */
  async processIdentification(job: FashionIntakeJob) {
    const repo = this.db.getRepository(CatalogProduct);
    const start = await repo.findOneBy({
      id: job.productId,
      organizationId: job.organizationId,
      vertical: 'fashion',
    });
    if (!start) return { skipped: 'not_found' };
    try {
      this.assertIdentifiable(start);
    } catch {
      return { skipped: 'not_identifiable' };
    }
    await this.setStatus(start.id, job.organizationId, 'processing');

    const attrs = start.verticalAttributes ?? {};
    // The size chart is not a photo of the garment; keep it out of vision input.
    const charts = new Set(
      stringList(attrs._photoRoles)
        .filter((entry) => entry.startsWith('sizeChart:'))
        .map((entry) => entry.slice('sizeChart:'.length)),
    );
    const chartUrl = stringValue(attrs._sizeChartImageUrl);
    if (chartUrl) charts.add(chartUrl);
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
      const product = await manager.getRepository(CatalogProduct).findOne({
        where: {
          id: start.id,
          organizationId: job.organizationId,
          vertical: 'fashion',
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) return { skipped: 'not_found' };
      try {
        this.assertIdentifiable(product);
      } catch {
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
        await manager.getRepository(CatalogProduct).save(product);
        await this.audit(manager, product, 'fashion.intake.identify', 'failed');
        return { status: 'failed' };
      }

      // Re-merge onto the latest saved values in case someone edited the draft meanwhile.
      const latestConfirmed = stringList(latest._confirmedKeys);
      const suggestions: ProductAttributes = {};
      for (const [key, value] of Object.entries(result.attributes))
        if (!isFashionMetaKey(key)) suggestions[key] = value;
      const current: ProductAttributes = {};
      for (const [key, value] of Object.entries(latest))
        if (!isFashionMetaKey(key)) current[key] = value;
      const merged = mergeFashionSuggestions({
        current,
        suggested: suggestions,
        confirmedKeys: latestConfirmed,
      });
      const meta: ProductAttributes = {};
      for (const [key, value] of Object.entries(latest))
        if (isFashionMetaKey(key)) meta[key] = value;
      const validated = validateFashionAttributes({
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
          .map(
            (item) =>
              `${item.key}: current "${item.current}" vs suggested "${item.suggested}"`,
          )
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
      if (!product.brand && result.brand) product.brand = result.brand;
      if (!product.conditionId) {
        const label = (result.conditionLabel ?? '').toUpperCase();
        if (label === 'NEW') product.conditionId = '1000';
        if (label === 'USED') product.conditionId = '3000';
      }
      if (!product.categoryId && result.category.categoryId) {
        product.categoryId = result.category.categoryId;
        product.categoryName = result.category.categoryName;
      }
      product.verticalAttributes = validated.attributes;
      await manager.getRepository(CatalogProduct).save(product);
      await this.audit(manager, product, 'fashion.intake.identify', 'success');
      return { status: 'suggested' };
    });
  }

  private async setStatus(
    id: string,
    organizationId: string,
    status: FashionAnalysisStatus,
    warnings?: string[],
  ) {
    await this.db.transaction(async (manager) => {
      const product = await manager.getRepository(CatalogProduct).findOne({
        where: { id, organizationId, vertical: 'fashion' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) return;
      product.verticalAttributes = {
        ...(product.verticalAttributes ?? {}),
        _analysisStatus: status,
        ...(warnings ? { _warnings: warnings } : {}),
      };
      await manager.getRepository(CatalogProduct).save(product);
    });
  }

  private async audit(
    manager: DataSource['manager'],
    product: CatalogProduct,
    action: string,
    result: string,
  ) {
    await manager.getRepository(ListingActionLog).save({
      organizationId: product.organizationId!,
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

  /* ── Intake history ─────────────────────────────────────────────── */

  async history(
    user: User,
    params: {
      organizationId?: string;
      batch?: string;
      status?: string;
      q?: string;
      source?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      params.organizationId,
    );
    const page = Math.max(Number(params.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(params.pageSize) || 25, 1), 100);
    const query = this.db
      .getRepository(CatalogProduct)
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
      ? await this.db.getRepository(FashionReview).find({
          where: {
            organizationId: org.organizationId,
            catalogProductId: In(products.map((product) => product.id)),
          },
        })
      : [];
    const reviewStatus = new Map(
      reviews.map((review) => [review.catalogProductId, review.status]),
    );

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

  async activityReport(
    user: User,
    params: {
      organizationId?: string;
      from?: string;
      to?: string;
      uploadedBy?: string;
      addedBy?: string;
      analysisStatus?: string;
      catalogStatus?: string;
      reviewStatus?: string;
      publicationStatus?: string;
      storeId?: string;
      batch?: string;
      q?: string;
      attributeKey?: string;
      attributeValue?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
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
      .getRawMany<{ userId: string | null; itemCount: number }>();
    const adderGroups = await query.clone()
      .select(CATALOG_ADDER_SQL, 'userId')
      .addSelect('COUNT(*)::int', 'itemCount')
      .andWhere(`NOT ${INTAKE_PENDING_SQL}`)
      .groupBy(CATALOG_ADDER_SQL)
      .getRawMany<{ userId: string | null; itemCount: number }>();
    const actorIds = [...new Set([
      ...creatorGroups.map((row) => row.userId),
      ...adderGroups.map((row) => row.userId),
      ...items.flatMap((item) => [item.uploadedByUserId, item.addedByUserId, ...item.publicationTargets.map((target) => target.requestedByUserId)]),
    ].filter((id): id is string => Boolean(id)))];
    const users = actorIds.length
      ? await this.db.getRepository(User).find({ where: { id: In(actorIds) }, select: ['id', 'name', 'email'] })
      : [];
    const userMap = new Map(users.map((actor) => [actor.id, { id: actor.id, name: actor.name || actor.email, email: actor.email }]));
    const addUserLabels = (rows: Array<{ userId: string | null; itemCount: number }>) => rows
      .filter((row): row is { userId: string; itemCount: number } => Boolean(row.userId))
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

  async exportActivity(
    user: User,
    params: Parameters<FashionIntakeService['activityReport']>[1],
  ) {
    const org = await this.organizations.resolveOrganizationId(user.id, params.organizationId);
    const query = this.activityQuery(org.organizationId, params);
    const total = await query.clone().getCount();
    if (total > 250_000)
      throw new BadRequestException('Narrow the date range or filters to export at most 250,000 Fashion items at a time.');
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
      for (const item of items) rows.push([
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

  private activityQuery(
    organizationId: string,
    params: Parameters<FashionIntakeService['activityReport']>[1],
  ) {
    const query = this.db.getRepository(CatalogProduct).createQueryBuilder('p')
      .where('p.organization_id = :activityOrg', { activityOrg: organizationId })
      .andWhere("p.vertical = 'fashion'")
      .andWhere("p.vertical_validation_status <> 'deleted'");
    const parseDate = (value: string | undefined, name: string, endOfDay = false) => {
      if (!value) return undefined;
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be a valid date.`);
      if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) parsed.setUTCDate(parsed.getUTCDate() + 1);
      return parsed;
    };
    const from = parseDate(params.from, 'from');
    const to = parseDate(params.to, 'to', true);
    if (from && to && from >= to) throw new BadRequestException('from must be earlier than to.');
    if (from) query.andWhere(`${ACTIVITY_AT_SQL} >= :activityFrom`, { activityFrom: from });
    if (to) query.andWhere(`${ACTIVITY_AT_SQL} < :activityTo`, { activityTo: to });
    if (params.uploadedBy?.trim()) query.andWhere(`${INTAKE_CREATOR_SQL} = :activityUploader`, { activityUploader: params.uploadedBy.trim() });
    if (params.addedBy?.trim()) query.andWhere(`${CATALOG_ADDER_SQL} = :activityAdder`, { activityAdder: params.addedBy.trim() });
    if (params.analysisStatus?.trim()) query.andWhere("p.vertical_attributes->>'_analysisStatus' = :activityAnalysis", { activityAnalysis: params.analysisStatus.trim() });
    if (params.catalogStatus === 'pending') query.andWhere(INTAKE_PENDING_SQL);
    if (params.catalogStatus === 'added') query.andWhere(`NOT ${INTAKE_PENDING_SQL}`);
    if (params.catalogStatus && !['pending', 'added'].includes(params.catalogStatus)) throw new BadRequestException('catalogStatus must be pending or added.');
    if (params.reviewStatus?.trim()) {
      if (params.reviewStatus === 'pending')
        query.andWhere("NOT EXISTS (SELECT 1 FROM fashion_reviews fr WHERE fr.catalog_product_id=p.id AND fr.organization_id=p.organization_id AND fr.status <> 'pending')");
      else query.andWhere('EXISTS (SELECT 1 FROM fashion_reviews fr WHERE fr.catalog_product_id=p.id AND fr.organization_id=p.organization_id AND fr.status=:activityReview)', { activityReview: params.reviewStatus.trim() });
    }
    if (params.publicationStatus?.trim()) query.andWhere(`EXISTS (
      SELECT 1 FROM ebay_listing_job_targets pt
      JOIN ebay_listing_jobs pj ON pj.id=pt.listing_job_id AND pj.organization_id=p.organization_id
      WHERE pt.catalog_product_id=p.id AND pt.vertical='fashion' AND pt.status=:activityPublicationStatus
    )`, { activityPublicationStatus: params.publicationStatus.trim() });
    if (params.storeId?.trim()) query.andWhere(`EXISTS (
      SELECT 1 FROM ebay_listing_job_targets pt
      JOIN connected_ebay_accounts pa ON pa.id=pt.ebay_account_id
      JOIN ebay_listing_jobs pj ON pj.id=pt.listing_job_id AND pj.organization_id=p.organization_id
      WHERE pt.catalog_product_id=p.id AND pt.vertical='fashion' AND pa.primary_store_id=:activityStoreId
    )`, { activityStoreId: params.storeId.trim() });
    if (params.batch?.trim()) query.andWhere("p.vertical_attributes->>'_intakeBatch' = :activityBatch", { activityBatch: params.batch.trim().toUpperCase() });
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
    if (attributeKey && attributeValue) query.andWhere(`EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.vertical_attributes -> :activityAttributeKey)='array'
        THEN p.vertical_attributes -> :activityAttributeKey
        ELSE jsonb_build_array(p.vertical_attributes ->> :activityAttributeKey) END) av
      WHERE lower(av) = lower(:activityAttributeValue)
    )`, { activityAttributeKey: attributeKey, activityAttributeValue: attributeValue });
    else if (attributeKey) query.andWhere("p.vertical_attributes ? :activityAttributeOnlyKey", { activityAttributeOnlyKey: attributeKey });
    else if (attributeValue) query.andWhere('CAST(p.vertical_attributes AS text) ILIKE :activityAttributeSearch', { activityAttributeSearch: `%${attributeValue.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%` });
    return query;
  }

  private async activitySummary(query: SelectQueryBuilder<CatalogProduct>) {
    const raw = await query.clone().select('COUNT(*)::int', 'total')
      .addSelect("COUNT(*) FILTER (WHERE p.vertical_attributes->>'_analysisStatus' IN ('suggested','skipped'))::int", 'processed')
      .addSelect(`COUNT(*) FILTER (WHERE NOT ${INTAKE_PENDING_SQL})::int`, 'catalogAdded')
      .addSelect(`COUNT(*) FILTER (WHERE ${INTAKE_PENDING_SQL})::int`, 'waitingInIntake')
      .addSelect("COUNT(*) FILTER (WHERE p.vertical_attributes->>'_analysisStatus' = 'failed')::int", 'failed')
      .getRawOne();
    return Object.fromEntries(Object.entries(raw ?? {}).map(([key, value]) => [key, Number(value ?? 0)]));
  }

  private async activityItems(products: CatalogProduct[], organizationId: string) {
    if (!products.length) return [];
    const ids = products.map((product) => product.id);
    const [creationLogs, targets, reviews] = await Promise.all([
      this.db.getRepository(ListingActionLog).find({
        where: { organizationId, catalogProductId: In(ids), action: 'fashion.draft.created' },
        order: { createdAt: 'ASC' },
      }),
      this.db.getRepository(EbayListingJobTarget).find({
        where: { catalogProductId: In(ids), vertical: 'fashion' },
        relations: { listingJob: true, ebayAccount: { primaryStore: true } },
        order: { createdAt: 'DESC' },
      }),
      this.db.getRepository(FashionReview).find({
        where: { organizationId, catalogProductId: In(ids) },
      }),
    ]);
    const logCreator = new Map<string, string>();
    for (const log of creationLogs) if (log.catalogProductId && log.userId && !logCreator.has(log.catalogProductId)) logCreator.set(log.catalogProductId, log.userId);
    const targetsByProduct = new Map<string, EbayListingJobTarget[]>();
    for (const target of targets) {
      if (!target.catalogProductId) continue;
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
    ].filter((id): id is string => Boolean(id)))];
    const users = actorIds.length ? await this.db.getRepository(User).find({ where: { id: In(actorIds) }, select: ['id', 'name', 'email'] }) : [];
    const userMap = new Map(users.map((actor) => [actor.id, { id: actor.id, name: actor.name || actor.email, email: actor.email }]));
    const actor = (id: string | null | undefined) => id ? (userMap.get(id) ?? { id, name: id, email: '' }) : null;
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
}

/** The capture placeholder title never counts as confirmed, even after an editor save. */
function isTitleConfirmed(product: CatalogProduct) {
  if (product.sku && product.title === pendingFashionTitle(product.sku))
    return false;
  return isTrue(product.verticalAttributes?._titleConfirmed);
}

function isHttpUrl(value: string) {
  if (value.startsWith('/api/storage/serve/')) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === 'string');
  return typeof value === 'string' && value.trim() ? [value.trim()] : [];
}

function isTrue(value: unknown) {
  return value === true || value === 'true';
}

function isCapturePending(attributes: ProductAttributes) {
  return attributes._intakeSource === 'capture' &&
    (attributes._catalogAdded === false || attributes._catalogAdded === 'false');
}

function csvCell(value: unknown) {
  const text = value == null ? '' : typeof value === 'string' ? value : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
