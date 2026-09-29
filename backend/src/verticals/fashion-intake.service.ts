import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DataSource, In } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
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
    private readonly stores: StoreAccessService,
    private readonly listings: FashionListingsService,
    private readonly images: FashionImageAnalysisService,
    @InjectQueue(FASHION_INTAKE_QUEUE) private readonly queue: Queue,
  ) {}

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
    return repo.save(
      repo.create({
        organizationId: org.organizationId,
        code,
        name: dto.name.trim(),
        countryCode: dto.countryCode?.toUpperCase() ?? null,
        active: dto.active ?? true,
      }),
    );
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
    return repo.save(warehouse);
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
    if (dto.ebayAccountId) {
      const account = await this.listings.account(
        dto.ebayAccountId,
        org.organizationId,
      );
      await this.stores.assertStoreAccess(
        user,
        account.primaryStoreId,
        'operate',
      );
    }

    const attributes: ProductAttributes = {
      categoryFamily: dto.categoryFamily ?? 'clothing',
      _intakeSource: 'capture',
      _intakeCreatedBy: user.id,
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
    if (dto.ebayAccountId) attributes._intakeAccountId = dto.ebayAccountId;
    if (dto.marketplaceId) attributes._intakeMarketplaceId = dto.marketplaceId;
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

    if (dto.identify !== false)
      await this.enqueue(product.id, org.organizationId);
    return product;
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

    const accountIds = [
      ...new Set(
        products
          .map((product) =>
            stringValue(product.verticalAttributes?._intakeAccountId),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const accounts = accountIds.length
      ? await this.db.getRepository(ConnectedEbayAccount).find({
          where: { id: In(accountIds), organizationId: org.organizationId },
        })
      : [];
    const accountNames = new Map(
      accounts.map((account) => [account.id, accountLabel(account)]),
    );
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
        const accountId = stringValue(attrs._intakeAccountId);
        return {
          id: product.id,
          sku: product.sku,
          title: product.title,
          batch: stringValue(attrs._intakeBatch),
          warehouseCode: stringValue(attrs._warehouseCode),
          warehouseName: stringValue(attrs._warehouseName),
          accountId,
          accountName: accountId ? (accountNames.get(accountId) ?? null) : null,
          marketplaceId: stringValue(attrs._intakeMarketplaceId),
          imageCount: (product.imageUrls ?? []).length,
          primaryImageUrl: product.imageUrls?.[0] ?? null,
          analysisStatus: stringValue(attrs._analysisStatus),
          validationStatus: product.verticalValidationStatus,
          reviewStatus: reviewStatus.get(product.id) ?? 'pending',
          hasSizeChart: Boolean(stringValue(attrs._sizeChartImageUrl)),
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        };
      }),
    };
  }
}

function accountLabel(account: ConnectedEbayAccount): string {
  return (
    stringValue(account.accountDisplayName) ??
    stringValue(account.ebayUsername) ??
    account.id
  );
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
