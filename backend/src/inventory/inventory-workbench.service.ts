import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ImageAsset } from '../storage/entities/image-asset.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PartFitment } from '../fitment/entities/part-fitment.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { SingleListingFormService } from '../ingestion/services/single-listing-form.service.js';
import type { PartLookupResult } from '../ingestion/services/single-listing-form.service.js';
import { PipelineService } from '../ingestion/pipeline.service.js';
import { InventoryAutoTriggerService } from './inventory-auto-trigger.service.js';
import type { EnrichmentStatus } from './inventory-auto-trigger.service.js';
import type { InventoryListingsQueryDto } from './dto/inventory-workbench.dto.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { EnrichmentPipeline } from '../common/openai/pipelines/enrichment.pipeline.js';

export interface InventoryMarketplaceVariant {
  listingId: string;
  marketplace: string | null;
  status: string;
  ebayListingId?: string;
  pipelineJobId?: string;
}

export interface InventoryStoreListing {
  storeId: string;
  storeName: string;
  marketplaceId: string;
  offerId: string | null;
  ebayListingId: string | null;
  listingUrl: string | null;
  price: number | null;
  quantity: number | null;
  status: string;
  publishedAt: string | null;
  lastSyncedAt: string | null;
}

export interface InventoryListingItem {
  id: string;
  sku: string;
  title: string;
  brand: string;
  price: number;
  quantity: number;
  condition: string;
  imageUrl: string;
  imageUrls: string[];
  categoryName: string;
  status: 'draft' | 'ready' | 'publishing' | 'published' | 'error';
  ebayListingId?: string;
  fitmentCount: number;
  missingFields: string[];
  errorMessage?: string;
  pipelineJobId?: string;
  pipelineJobStatus?: string;
  hasCompletedPipelineJob: boolean;
  enrichmentStatus: EnrichmentStatus;
  intakeSource?: boolean;
  marketplaceVariants: InventoryMarketplaceVariant[];
  storeListings: InventoryStoreListing[];
  importedAt?: string;
}

export interface InventoryRequeueWarning {
  listingId: string;
  sku: string;
  jobId: string;
  completedAt: string | null;
}

function parseImageUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split('|')
    .map((u) => u.trim())
    .filter(Boolean);
}

function computeMissingFields(listing: ListingRecord): string[] {
  const missing: string[] = [];
  if (!listing.title?.trim()) missing.push('Title');
  if (!listing.cBrand?.trim()) missing.push('Brand');
  if (!listing.cOeOemPartNumber?.trim() && !listing.cManufacturerPartNumber?.trim()) {
    missing.push('OEM/MPN');
  }
  if (parseImageUrls(listing.itemPhotoUrl).length < 2) {
    missing.push('Images (min 2)');
  }
  if (!listing.startPrice?.trim() && listing.startPriceNum == null) {
    missing.push('Price');
  }
  if (!listing.quantity?.trim() && listing.quantityNum == null) {
    missing.push('Quantity');
  }
  if (!listing.categoryId?.trim() && !listing.categoryName?.trim()) {
    missing.push('Category');
  }
  if (!listing.description?.trim()) {
    missing.push('Description');
  }
  return missing;
}

function mapListingStatus(
  listing: ListingRecord,
): InventoryListingItem['status'] {
  if (listing.status === 'published') return 'published';
  if (listing.status === 'ready') return 'ready';
  return 'draft';
}

@Injectable()
export class InventoryWorkbenchService {
  private readonly logger = new Logger(InventoryWorkbenchService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(PartFitment)
    private readonly fitmentRepo: Repository<PartFitment>,
    @InjectRepository(PipelineJob)
    private readonly pipelineJobRepo: Repository<PipelineJob>,
    @InjectRepository(ImageAsset)
    private readonly imageAssetRepo: Repository<ImageAsset>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly singleListingForm: SingleListingFormService,
    private readonly pipelineService: PipelineService,
    private readonly autoTrigger: InventoryAutoTriggerService,
    private readonly listingGenPipeline: ListingGenerationPipeline,
    private readonly enrichmentPipeline: EnrichmentPipeline,
  ) {}

  async listListings(
    query: InventoryListingsQueryDto,
  ): Promise<{ items: InventoryListingItem[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const params: unknown[] = [];
    let paramIdx = 1;
    const whereClauses = ['l."deletedAt" IS NULL'];

    if (query.status) {
      whereClauses.push(`l.status = $${paramIdx++}`);
      params.push(query.status);
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      whereClauses.push(
        `(l."customLabelSku" ILIKE $${paramIdx} OR l.title ILIKE $${paramIdx} OR l."cBrand" ILIKE $${paramIdx} OR l."cOeOemPartNumber" ILIKE $${paramIdx} OR l."cManufacturerPartNumber" ILIKE $${paramIdx})`,
      );
      params.push(term);
      paramIdx++;
    }

    if (query.missingImages) {
      whereClauses.push(
        `(l."itemPhotoUrl" IS NULL OR TRIM(l."itemPhotoUrl") = '' OR l."itemPhotoUrl" NOT LIKE '%|%')`,
      );
    }

    if (query.dateAddedFrom) {
      whereClauses.push(`l."importedAt" >= $${paramIdx++}::timestamptz`);
      params.push(query.dateAddedFrom);
    }

    if (query.dateAddedTo) {
      whereClauses.push(`l."importedAt" <= $${paramIdx++}::timestamptz`);
      params.push(query.dateAddedTo);
    }

    if (query.brand?.trim()) {
      whereClauses.push(`l."cBrand" ILIKE $${paramIdx++}`);
      params.push(`%${query.brand.trim()}%`);
    }

    if (query.make?.trim()) {
      whereClauses.push(`l."extractedMake" ILIKE $${paramIdx++}`);
      params.push(`%${query.make.trim()}%`);
    }

    if (query.model?.trim()) {
      whereClauses.push(`l."extractedModel" ILIKE $${paramIdx++}`);
      params.push(`%${query.model.trim()}%`);
    }

    if (query.category?.trim()) {
      whereClauses.push(`l."categoryName" ILIKE $${paramIdx++}`);
      params.push(`%${query.category.trim()}%`);
    }

    const whereSql = whereClauses.join(' AND ');

    const countSql = `
      WITH filtered AS (
        SELECT l.*
        FROM listing_records l
        WHERE ${whereSql}
      ),
      ranked AS (
        SELECT f.id,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY
              CASE WHEN f."sourceFileName" = 'warehouse-intake' THEN 0 ELSE 1 END,
              CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END,
              f."importedAt" DESC
          ) AS rn
        FROM filtered f
      )
      SELECT COUNT(*)::int AS count FROM ranked WHERE rn = 1
    `;

    const countRow = await this.listingRepo.query(countSql, params);
    const total = Number(countRow[0]?.count ?? 0);

    if (total === 0) {
      return { items: [], total: 0 };
    }

    const listSql = `
      WITH filtered AS (
        SELECT l.*
        FROM listing_records l
        WHERE ${whereSql}
      ),
      ranked AS (
        SELECT f.id, f."importedAt",
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(f."customLabelSku", f.id::text)
            ORDER BY
              CASE WHEN f."sourceFileName" = 'warehouse-intake' THEN 0 ELSE 1 END,
              CASE WHEN f.marketplace IS NULL THEN 0 ELSE 1 END,
              f."importedAt" DESC
          ) AS rn
        FROM filtered f
      )
      SELECT id FROM ranked
      WHERE rn = 1
      ORDER BY "importedAt" DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const idRows: Array<{ id: string }> = await this.listingRepo.query(listSql, [
      ...params,
      limit,
      offset,
    ]);

    if (idRows.length === 0) {
      return { items: [], total };
    }

    const ids = idRows.map((r) => r.id);
    const found = await this.listingRepo.find({ where: { id: In(ids) } });
    const byId = new Map(found.map((l) => [l.id, l]));
    const listings = ids
      .map((id) => byId.get(id))
      .filter((l): l is ListingRecord => Boolean(l));
    const skus = [
      ...new Set(listings.map((l) => l.customLabelSku).filter(Boolean)),
    ] as string[];

    const [fitmentRows, siblings] = await Promise.all([
      this.fitmentRepo
        .createQueryBuilder('f')
        .select('f.listingId', 'listingId')
        .addSelect('COUNT(*)', 'count')
        .where('f.listingId IN (:...ids)', { ids })
        .groupBy('f.listingId')
        .getRawMany<{ listingId: string; count: string }>(),
      skus.length
        ? this.listingRepo.find({
            where: { customLabelSku: In(skus), deletedAt: IsNull() },
            select: [
              'id',
              'customLabelSku',
              'marketplace',
              'status',
              'ebayListingId',
              'pipelineJobId',
            ],
          })
        : Promise.resolve([] as ListingRecord[]),
    ]);

    const pipelineJobs = await this.loadPipelineJobsForListings(listings, siblings);
    const storeListingsBySku = await this.loadStoreListingsBySkus(skus);

    const fitmentByListing = new Map(
      fitmentRows.map((r) => [r.listingId, Number(r.count)]),
    );

    const siblingsBySku = new Map<string, ListingRecord[]>();
    for (const s of siblings) {
      const key = s.customLabelSku ?? s.id;
      const group = siblingsBySku.get(key) ?? [];
      group.push(s);
      siblingsBySku.set(key, group);
    }

    const items: InventoryListingItem[] = listings.map((listing) => {
      const imageUrls = parseImageUrls(listing.itemPhotoUrl);
      const price =
        listing.startPriceNum ??
        (listing.startPrice ? parseFloat(listing.startPrice) : 0);
      const quantity =
        listing.quantityNum ??
        (listing.quantity ? parseInt(listing.quantity, 10) : 0);

      const skuKey = listing.customLabelSku ?? listing.id;
      const variantRows = siblingsBySku.get(skuKey) ?? [listing];
      const marketplaceVariants: InventoryMarketplaceVariant[] = variantRows.map(
        (v) => ({
          listingId: v.id,
          marketplace: v.marketplace,
          status: v.status,
          ebayListingId: v.ebayListingId ?? undefined,
          pipelineJobId: v.pipelineJobId ?? undefined,
        }),
      );

      const jobIds = new Set(
        variantRows
          .map((v) => v.pipelineJobId)
          .filter((id): id is string => Boolean(id)),
      );
      const hasCompletedPipelineJob = [...jobIds].some(
        (jid) => pipelineJobs.get(jid)?.status === 'completed',
      );
      const primaryJob = listing.pipelineJobId
        ? pipelineJobs.get(listing.pipelineJobId)
        : undefined;

      // Compute enrichment status from current state (no extra DB queries)
      const enrichmentStatus = this.autoTrigger.deriveStatus(listing, primaryJob);

      return {
        id: listing.id,
        sku: listing.customLabelSku ?? '',
        title: listing.title ?? listing.cOeOemPartNumber ?? '',
        brand: listing.cBrand ?? 'Generic',
        price: Number.isFinite(price) ? price : 0,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        condition: listing.conditionId ?? 'Used',
        imageUrl: imageUrls[0] ?? '',
        imageUrls,
        categoryName: listing.categoryName ?? '',
        status: mapListingStatus(listing),
        ebayListingId: listing.ebayListingId ?? undefined,
        fitmentCount: fitmentByListing.get(listing.id) ?? 0,
        missingFields: computeMissingFields(listing),
        pipelineJobId: listing.pipelineJobId ?? undefined,
        pipelineJobStatus: primaryJob?.status,
        hasCompletedPipelineJob,
        enrichmentStatus,
        intakeSource: listing.sourceFileName === 'warehouse-intake',
        marketplaceVariants,
        storeListings: listing.customLabelSku
          ? storeListingsBySku.get(listing.customLabelSku) ?? []
          : [],
        importedAt: listing.importedAt
          ? new Date(listing.importedAt).toISOString()
          : undefined,
      };
    });

    return { items, total };
  }

  private async loadPipelineJobsForListings(
    listings: ListingRecord[],
    siblings: ListingRecord[],
  ): Promise<Map<string, PipelineJob>> {
    const jobIds = new Set<string>();
    for (const l of [...listings, ...siblings]) {
      if (l.pipelineJobId) jobIds.add(l.pipelineJobId);
    }
    if (jobIds.size === 0) return new Map();

    const jobs = await this.pipelineJobRepo.find({
      where: { id: In([...jobIds]) },
    });
    return new Map(jobs.map((j) => [j.id, j]));
  }

  async getListingDetail(listingId: string) {
    const listing = await this.getListingOrThrow(listingId);
    const sku = listing.customLabelSku;

    const [fitments, siblings, pipelineJob] = await Promise.all([
      this.fitmentRepo.find({
        where: { listingId },
        relations: ['make', 'model', 'submodel', 'engine'],
        order: { yearStart: 'ASC' },
      }),
      sku
        ? this.listingRepo.find({
            where: { customLabelSku: sku, deletedAt: IsNull() },
          })
        : Promise.resolve([listing]),
      listing.pipelineJobId
        ? this.pipelineJobRepo.findOne({ where: { id: listing.pipelineJobId } })
        : Promise.resolve(null),
    ]);

    const priorJobs = await this.getCompletedJobsForSku(sku, listing.id);
    const storeListings = sku
      ? (await this.loadStoreListingsBySkus([sku])).get(sku) ?? []
      : [];

    return {
      listing: this.serializeListing(listing),
      fitments: fitments.map((f) => ({
        id: f.id,
        make: f.make?.name ?? null,
        model: f.model?.name ?? null,
        submodel: f.submodel?.name ?? null,
        engine: f.engine?.code ?? null,
        yearStart: f.yearStart,
        yearEnd: f.yearEnd,
        source: f.source,
        confidence: f.confidence,
        verified: f.verified,
        notes: f.notes,
      })),
      marketplaceVariants: siblings.map((s) => ({
        listingId: s.id,
        marketplace: s.marketplace,
        status: s.status,
        ebayListingId: s.ebayListingId,
        pipelineJobId: s.pipelineJobId,
        title: s.title,
        importedAt: s.importedAt,
      })),
      pipelineJob: pipelineJob
        ? {
            id: pipelineJob.id,
            status: pipelineJob.status,
            originalFilename: pipelineJob.originalFilename,
            completedAt: pipelineJob.completedAt,
            createdAt: pipelineJob.createdAt,
            totalParts: pipelineJob.totalParts,
            enrichedCount: pipelineJob.enrichedCount,
          }
        : null,
      enrichmentStatus: this.autoTrigger.deriveStatus(listing, pipelineJob),
      priorCompletedJobs: priorJobs,
      missingFields: computeMissingFields(listing),
      imageUrls: parseImageUrls(listing.itemPhotoUrl),
      storeListings,
    };
  }

  private async loadStoreListingsBySkus(
    skus: string[],
  ): Promise<Map<string, InventoryStoreListing[]>> {
    const result = new Map<string, InventoryStoreListing[]>();
    if (skus.length === 0) return result;

    const products = await this.productRepo.find({
      where: { sku: In(skus) },
      select: ['id', 'sku'],
    });
    if (products.length === 0) return result;

    const skuByProductId = new Map(
      products.filter((p) => p.sku).map((p) => [p.id, p.sku!]),
    );
    const productIds = products.map((p) => p.id);

    const channels = await this.channelRepo.find({
      where: { catalogProductId: In(productIds) },
      relations: ['ebayAccount'],
    });

    const storeIds = new Set<string>();
    for (const ch of channels) {
      if (ch.ebayAccount?.primaryStoreId) {
        storeIds.add(ch.ebayAccount.primaryStoreId);
      }
    }

    const stores =
      storeIds.size > 0
        ? await this.storeRepo.find({ where: { id: In([...storeIds]) } })
        : [];
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    for (const ch of channels) {
      const sku = skuByProductId.get(ch.catalogProductId);
      if (!sku) continue;

      const account = ch.ebayAccount;
      const storeId = account?.primaryStoreId ?? '';
      const store = storeMap.get(storeId);

      const entry: InventoryStoreListing = {
        storeId,
        storeName: store?.storeName ?? account?.ebayUserId ?? 'Unknown store',
        marketplaceId: ch.marketplaceId,
        offerId: ch.offerId,
        ebayListingId: ch.listingId,
        listingUrl: ch.listingUrl,
        price: ch.channelPrice != null ? Number(ch.channelPrice) : null,
        quantity: ch.channelQuantity,
        status: ch.listingStatus,
        publishedAt: ch.publishedAt ? ch.publishedAt.toISOString() : null,
        lastSyncedAt: ch.lastSyncedAt ? ch.lastSyncedAt.toISOString() : null,
      };

      const list = result.get(sku) ?? [];
      list.push(entry);
      result.set(sku, list);
    }

    return result;
  }

  private async getCompletedJobsForSku(
    sku: string | null,
    excludeListingId: string,
  ): Promise<
    Array<{ jobId: string; completedAt: string | null; listingId: string }>
  > {
    if (!sku) return [];

    const related = await this.listingRepo.find({
      where: { customLabelSku: sku, deletedAt: IsNull() },
      select: ['id', 'pipelineJobId'],
    });

    const jobIds = [
      ...new Set(
        related
          .filter((r) => r.id !== excludeListingId && r.pipelineJobId)
          .map((r) => r.pipelineJobId as string),
      ),
    ];
    if (jobIds.length === 0) return [];

    const jobs = await this.pipelineJobRepo.find({
      where: { id: In(jobIds), status: 'completed' },
    });

    return jobs.map((j) => {
      const linked = related.find((r) => r.pipelineJobId === j.id);
      return {
        jobId: j.id,
        completedAt: j.completedAt ? j.completedAt.toISOString() : null,
        listingId: linked?.id ?? excludeListingId,
      };
    });
  }

  private serializeListing(listing: ListingRecord) {
    return {
      id: listing.id,
      customLabelSku: listing.customLabelSku,
      title: listing.title,
      description: listing.description,
      cBrand: listing.cBrand,
      cType: listing.cType,
      cManufacturerPartNumber: listing.cManufacturerPartNumber,
      cOeOemPartNumber: listing.cOeOemPartNumber,
      cFeatures: listing.cFeatures,
      categoryId: listing.categoryId,
      categoryName: listing.categoryName,
      conditionId: listing.conditionId,
      startPrice: listing.startPrice,
      startPriceNum: listing.startPriceNum,
      quantity: listing.quantity,
      quantityNum: listing.quantityNum,
      itemPhotoUrl: listing.itemPhotoUrl,
      pUpc: listing.pUpc,
      pEpid: listing.pEpid,
      location: listing.location,
      format: listing.format,
      sourceFileName: listing.sourceFileName,
      marketplace: listing.marketplace,
      status: listing.status,
      ebayListingId: listing.ebayListingId,
      pipelineJobId: listing.pipelineJobId,
      extractedMake: listing.extractedMake,
      extractedModel: listing.extractedModel,
      enrichmentStage: listing.enrichmentStage,
      importedAt: listing.importedAt,
      updatedAt: listing.updatedAt,
      publishedAt: listing.publishedAt,
    };
  }

  async lookupPartForListing(
    listingId: string,
  ): Promise<{ listing: ListingRecord; lookup: PartLookupResult }> {
    return this.singleListingForm.lookupAndApplyToListing(listingId);
  }

  /**
   * Inline enrichment: full pipeline-grade enrichment with stage tracking.
   * Stages: vision_lookup → enrichment → generating_us → generating_au → generating_de → completed
   */
  async inlineEnrichListing(
    listingId: string,
  ): Promise<{
    baseListing: ListingRecord;
    marketplaceListings: Array<{ marketplace: string; listingId: string; title: string }>;
  }> {
    const setStage = async (stage: string) => {
      try {
        await this.listingRepo.update(listingId, {
          enrichmentStage: stage,
        } as any);
      } catch { /* non-critical — don't fail enrichment if stage write fails */ }
    };

    // Stage 1: Vision part lookup (identifies part from images)
    this.logger.log(`Inline enrich [vision_lookup]: listing ${listingId}`);
    await setStage('vision_lookup');
    await this.singleListingForm.lookupAndApplyToListing(listingId);

    // Read the updated base listing
    const baseListing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!baseListing || baseListing.deletedAt) {
      throw new NotFoundException(`Listing ${listingId} not found after lookup`);
    }

    const sku = baseListing.customLabelSku;
    if (!sku) {
      await setStage('failed');
      throw new BadRequestException('Listing has no SKU — cannot enrich');
    }

    const imageUrls = parseImageUrls(baseListing.itemPhotoUrl);

    // Stage 2: Full AI enrichment (EnrichmentPipeline)
    this.logger.log(`Inline enrich [enrichment]: listing ${listingId}`);
    await setStage('enrichment');
    try {
      const enrichInput: Record<string, unknown> = {
        sku: baseListing.customLabelSku,
        partNumber: baseListing.cManufacturerPartNumber || baseListing.cOeOemPartNumber,
        partName: baseListing.title,
        partType: baseListing.cType,
        brand: baseListing.cBrand,
        price: baseListing.startPriceNum,
        description: baseListing.description,
        features: baseListing.cFeatures,
        categoryName: baseListing.categoryName,
        categoryId: baseListing.categoryId,
        condition: baseListing.conditionId,
        donorMake: baseListing.extractedMake,
        donorModel: baseListing.extractedModel,
        imageUrls,
        image_count: imageUrls.length,
      };
      const enrichmentResult = await this.enrichmentPipeline.enrich(enrichInput);

      // Apply enrichment results back to the base listing
      if (enrichmentResult.title) baseListing.title = enrichmentResult.title.slice(0, 80);
      if (enrichmentResult.brand) baseListing.cBrand = enrichmentResult.brand;
      if (enrichmentResult.description) baseListing.description = enrichmentResult.description;
      if (enrichmentResult.partType) baseListing.cType = enrichmentResult.partType;
      if (enrichmentResult.mpn) baseListing.cManufacturerPartNumber = enrichmentResult.mpn;
      if (enrichmentResult.oemNumber) baseListing.cOeOemPartNumber = enrichmentResult.oemNumber;
      if (enrichmentResult.features?.length) baseListing.cFeatures = enrichmentResult.features.join(' | ');
      if (enrichmentResult.suggestedCategory && !baseListing.categoryName) {
        baseListing.categoryName = enrichmentResult.suggestedCategory;
      }

      this.logger.log(
        `Inline enrich [enrichment]: done for listing ${listingId} title="${enrichmentResult.title}" ` +
        `model=${enrichmentResult.model} score=${enrichmentResult.validationScore}`,
      );
    } catch (err) {
      this.logger.warn(
        `Inline enrich [enrichment]: AI enrichment failed for listing ${listingId}: ` +
        `${err instanceof Error ? err.message : err} — continuing with vision lookup data`,
      );
    }

    // Save enrichment results to base listing
    await this.listingRepo.save(baseListing);

    // Stage 3: Generate marketplace content for US, AU, DE
    const marketplaceListings: Array<{ marketplace: string; listingId: string; title: string }> = [];
    const MARKETPLACES: Array<'US' | 'AU' | 'DE'> = ['US', 'AU', 'DE'];

    for (const mkt of MARKETPLACES) {
      const stageName = `generating_${mkt.toLowerCase()}`;
      this.logger.log(`Inline enrich [${stageName}]: listing ${listingId}`);
      await setStage(stageName);

      // Check if marketplace listing already exists
      const existing = await this.listingRepo.findOne({
        where: { customLabelSku: sku, marketplace: mkt, deletedAt: IsNull() },
      });
      if (existing) {
        marketplaceListings.push({ marketplace: mkt, listingId: existing.id, title: existing.title ?? '' });
        continue;
      }

      const productData: Record<string, unknown> = {
        sku: baseListing.customLabelSku,
        brand: baseListing.cBrand,
        mpn: baseListing.cManufacturerPartNumber,
        oem_number: baseListing.cOeOemPartNumber,
        title: baseListing.title,
        part_type: baseListing.cType,
        placement: null,
        material: null,
        features: baseListing.cFeatures,
        image_count: imageUrls.length,
        extracted_make: baseListing.extractedMake,
        extracted_model: baseListing.extractedModel,
        price: baseListing.startPriceNum,
        description: baseListing.description,
      };

      try {
        const sellerCountry = mkt === 'DE' ? 'DE' : 'US';
        const aiResult = await this.listingGenPipeline.generate(
          productData,
          baseListing.categoryName ?? 'eBay Motors Parts & Accessories',
          baseListing.conditionId ?? 'Used',
          { marketplace: mkt, sellerCountry },
        );

        const newListing = this.listingRepo.create({
          sourceFileName: `inline-enrich-${mkt.toLowerCase()}`,
          sourceFilePath: `inline-enrich:${listingId}/${mkt}`,
          sheetName: `Inline Enrich ${mkt}`,
          sourceRowNumber: baseListing.sourceRowNumber,
          action: 'Add',
          customLabelSku: sku,
          categoryId: baseListing.categoryId,
          categoryName: baseListing.categoryName,
          title: aiResult.title.slice(0, 80),
          description: aiResult.description,
          startPrice: baseListing.startPrice,
          startPriceNum: baseListing.startPriceNum,
          quantity: baseListing.quantity,
          quantityNum: baseListing.quantityNum,
          itemPhotoUrl: baseListing.itemPhotoUrl,
          conditionId: baseListing.conditionId,
          format: baseListing.format,
          duration: baseListing.duration,
          location: baseListing.location,
          shippingProfileName: baseListing.shippingProfileName,
          returnProfileName: baseListing.returnProfileName,
          paymentProfileName: baseListing.paymentProfileName,
          cBrand: baseListing.cBrand,
          cType: baseListing.cType,
          cFeatures: baseListing.cFeatures,
          cManufacturerPartNumber: baseListing.cManufacturerPartNumber,
          cOeOemPartNumber: baseListing.cOeOemPartNumber,
          extractedMake: baseListing.extractedMake,
          extractedModel: baseListing.extractedModel,
          marketplace: mkt,
          version: 1,
        });

        const saved = await this.listingRepo.save(newListing);
        marketplaceListings.push({ marketplace: mkt, listingId: saved.id, title: aiResult.title });
        this.logger.log(`Inline enrich [${stageName}]: created ${mkt} listing for SKU ${sku}`);
      } catch (err) {
        this.logger.error(
          `Inline enrich [${stageName}]: failed for ${mkt} (SKU ${sku}): ${err instanceof Error ? err.message : err}`,
        );
        const fallbackListing = this.listingRepo.create({
          sourceFileName: `inline-enrich-${mkt.toLowerCase()}`,
          sourceFilePath: `inline-enrich:${listingId}/${mkt}`,
          sheetName: `Inline Enrich ${mkt}`,
          sourceRowNumber: baseListing.sourceRowNumber,
          action: 'Add',
          customLabelSku: sku,
          categoryId: baseListing.categoryId,
          categoryName: baseListing.categoryName,
          title: baseListing.title,
          description: baseListing.description,
          startPrice: baseListing.startPrice,
          startPriceNum: baseListing.startPriceNum,
          quantity: baseListing.quantity,
          quantityNum: baseListing.quantityNum,
          itemPhotoUrl: baseListing.itemPhotoUrl,
          conditionId: baseListing.conditionId,
          format: baseListing.format,
          duration: baseListing.duration,
          location: baseListing.location,
          cBrand: baseListing.cBrand,
          cType: baseListing.cType,
          cFeatures: baseListing.cFeatures,
          cManufacturerPartNumber: baseListing.cManufacturerPartNumber,
          cOeOemPartNumber: baseListing.cOeOemPartNumber,
          extractedMake: baseListing.extractedMake,
          extractedModel: baseListing.extractedModel,
          marketplace: mkt,
          version: 1,
        });
        const saved = await this.listingRepo.save(fallbackListing);
        marketplaceListings.push({ marketplace: mkt, listingId: saved.id, title: saved.title ?? '' });
      }
    }

    // Mark base listing as 'ready'
    if (baseListing.status === 'draft') {
      baseListing.status = 'ready';
      await this.listingRepo.save(baseListing);
    }

    // Final stage: completed
    await setStage('completed');

    this.logger.log(
      `Inline enrich [completed]: listing ${listingId} (SKU ${sku}) — ${marketplaceListings.length} marketplace listing(s)`,
    );

    return { baseListing, marketplaceListings };
  }

  async updateListingImages(
    listingId: string,
    imageUrls: string[],
    uploadedAssetIds?: string[],
  ) {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    const incoming = imageUrls.map((u) => u.trim()).filter(Boolean);
    if (incoming.length === 0) {
      throw new BadRequestException('At least one image URL is required');
    }

    const existing = parseImageUrls(listing.itemPhotoUrl);
    const merged = [...existing];
    for (const url of incoming) {
      if (!merged.includes(url)) merged.push(url);
    }

    listing.itemPhotoUrl = merged.join('|');
    await this.listingRepo.save(listing);

    if (uploadedAssetIds?.length) {
      await this.imageAssetRepo.update(
        { id: In(uploadedAssetIds) },
        { listingId: listing.id },
      );
    }

    // Auto-trigger enrichment when 2+ images are attached and listing has part number + brand
    if (merged.length >= 2) {
      // Fire and forget — the background job handles failures gracefully
      this.autoTrigger.enqueueAutoEnrich(listingId).catch((err) => {
        this.logger.warn(
          `Failed to enqueue auto-enrich for listing ${listingId}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }

    return this.getListingDetail(listingId);
  }

  async bulkLookupParts(listingIds: string[]): Promise<{
    results: Array<{
      listingId: string;
      success: boolean;
      lookup?: PartLookupResult;
      error?: string;
    }>;
  }> {
    const results: Array<{
      listingId: string;
      success: boolean;
      lookup?: PartLookupResult;
      error?: string;
    }> = [];

    for (const listingId of listingIds) {
      try {
        const { lookup } = await this.singleListingForm.lookupAndApplyToListing(listingId);
        results.push({ listingId, success: true, lookup });
      } catch (err) {
        results.push({
          listingId,
          success: false,
          error: err instanceof Error ? err.message : 'Lookup failed',
        });
      }
    }

    return { results };
  }

  async buildRequeueWarnings(listingIds: string[]): Promise<InventoryRequeueWarning[]> {
    const uniqueIds = [...new Set(listingIds)];
    const listings = await this.listingRepo.find({
      where: { id: In(uniqueIds) },
    });

    const warnings: InventoryRequeueWarning[] = [];
    const warnedSkus = new Set<string>();

    for (const listing of listings) {
      const skuKey = listing.customLabelSku ?? listing.id;
      if (warnedSkus.has(skuKey)) continue;

      const related = listing.customLabelSku
        ? await this.listingRepo.find({
            where: { customLabelSku: listing.customLabelSku, deletedAt: IsNull() },
            select: ['id', 'pipelineJobId'],
          })
        : [{ id: listing.id, pipelineJobId: listing.pipelineJobId }];

      const jobIds = [
        ...new Set(
          related
            .map((r) => r.pipelineJobId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (jobIds.length === 0) continue;

      const completedJobs = await this.pipelineJobRepo.find({
        where: { id: In(jobIds), status: 'completed' },
        order: { completedAt: 'DESC' },
      });

      if (completedJobs.length > 0) {
        warnedSkus.add(skuKey);
        const job = completedJobs[0];
        warnings.push({
          listingId: listing.id,
          sku: listing.customLabelSku ?? '',
          jobId: job.id,
          completedAt: job.completedAt ? job.completedAt.toISOString() : null,
        });
      }
    }

    return warnings;
  }

  async sendToPipeline(
    listingIds: string[],
    userId?: string,
  ): Promise<{
    job: Awaited<ReturnType<PipelineService['createBatchJobFromListings']>>;
    warnings: InventoryRequeueWarning[];
  }> {
    const uniqueIds = [...new Set(listingIds)];
    const listings = await this.listingRepo.find({
      where: { id: In(uniqueIds) },
    });

    if (listings.length !== uniqueIds.length) {
      throw new BadRequestException('One or more listings were not found');
    }

    for (const listing of listings) {
      const images = parseImageUrls(listing.itemPhotoUrl);
      if (images.length < 2) {
        throw new BadRequestException(
          `Listing ${listing.customLabelSku ?? listing.id} needs at least 2 photos before sending to pipeline`,
        );
      }
      const partNumber =
        listing.cOeOemPartNumber?.trim() || listing.cManufacturerPartNumber?.trim();
      if (!partNumber) {
        throw new BadRequestException(
          `Listing ${listing.customLabelSku ?? listing.id} is missing an OEM/part number`,
        );
      }
      if (!listing.cBrand?.trim()) {
        throw new BadRequestException(
          `Listing ${listing.customLabelSku ?? listing.id} is missing a brand`,
        );
      }
    }

    const warnings = await this.buildRequeueWarnings(uniqueIds);

    const job = await this.pipelineService.createBatchJobFromListings(uniqueIds, userId, {
      source: 'inventory',
      forceVision: true,
    });

    return { job, warnings };
  }

  /** @deprecated Use sendToPipeline */
  async enrichListings(
    listingIds: string[],
    userId?: string,
  ): Promise<{
    job: Awaited<ReturnType<PipelineService['createBatchJobFromListings']>>;
    warnings: InventoryRequeueWarning[];
  }> {
    return this.sendToPipeline(listingIds, userId);
  }

  async getListingOrThrow(listingId: string): Promise<ListingRecord> {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }
    return listing;
  }

  /* ── Filter metadata ─────────────────────────────────────── */

  async getFilterBrands(): Promise<string[]> {
    const rows = await this.listingRepo
      .createQueryBuilder('l')
      .select('DISTINCT l."cBrand"', 'brand')
      .where('l."cBrand" IS NOT NULL AND TRIM(l."cBrand") != \'\'')
      .andWhere('l."deletedAt" IS NULL')
      .orderBy('l."cBrand"', 'ASC')
      .getRawMany<{ brand: string }>();
    return rows.map((r) => r.brand);
  }

  async getFilterMakes(): Promise<string[]> {
    const rows = await this.listingRepo
      .createQueryBuilder('l')
      .select('DISTINCT l."extractedMake"', 'make')
      .where('l."extractedMake" IS NOT NULL AND TRIM(l."extractedMake") != \'\'')
      .andWhere('l."deletedAt" IS NULL')
      .orderBy('l."extractedMake"', 'ASC')
      .getRawMany<{ make: string }>();
    return rows.map((r) => r.make);
  }

  async getFilterModels(make?: string): Promise<string[]> {
    const qb = this.listingRepo
      .createQueryBuilder('l')
      .select('DISTINCT l."extractedModel"', 'model')
      .where('l."extractedModel" IS NOT NULL AND TRIM(l."extractedModel") != \'\'')
      .andWhere('l."deletedAt" IS NULL');

    if (make?.trim()) {
      qb.andWhere('l."extractedMake" ILIKE :make', { make: `%${make.trim()}%` });
    }

    qb.orderBy('l."extractedModel"', 'ASC');
    const rows = await qb.getRawMany<{ model: string }>();
    return rows.map((r) => r.model);
  }

  async getFilterCategories(): Promise<string[]> {
    const rows = await this.listingRepo
      .createQueryBuilder('l')
      .select('DISTINCT l."categoryName"', 'category')
      .where('l."categoryName" IS NOT NULL AND TRIM(l."categoryName") != \'\'')
      .andWhere('l."deletedAt" IS NULL')
      .orderBy('l."categoryName"', 'ASC')
      .getRawMany<{ category: string }>();
    return rows.map((r) => r.category);
  }

  /* ── Send to Catalog ─────────────────────────────────────── */

  async sendToCatalog(listingIds: string[]): Promise<{
    results: Array<{ listingId: string; sku: string; catalogProductId: string | null; success: boolean; error?: string }>;
  }> {
    const uniqueIds = [...new Set(listingIds)];
    const listings = await this.listingRepo.find({ where: { id: In(uniqueIds) } });

    const results: Array<{
      listingId: string;
      sku: string;
      catalogProductId: string | null;
      success: boolean;
      error?: string;
    }> = [];

    for (const listing of listings) {
      const sku = listing.customLabelSku;
      if (!sku) {
        results.push({ listingId: listing.id, sku: '', catalogProductId: null, success: false, error: 'No SKU' });
        continue;
      }

      try {
        const imageUrls = parseImageUrls(listing.itemPhotoUrl);

        // Check if catalog product already exists for this SKU
        let product = await this.productRepo.findOne({ where: { sku } });

        if (product) {
          // Update existing
          product.title = listing.title ?? product.title;
          product.brand = listing.cBrand ?? product.brand;
          product.description = listing.description ?? product.description;
          product.categoryName = listing.categoryName ?? product.categoryName;
          product.categoryId = listing.categoryId ?? product.categoryId;
          product.price = listing.startPriceNum ?? product.price;
          product.quantity = listing.quantityNum ?? product.quantity;
          product.conditionId = listing.conditionId ?? product.conditionId;
          product.mpn = listing.cManufacturerPartNumber ?? product.mpn;
          product.oemPartNumber = listing.cOeOemPartNumber ?? product.oemPartNumber;
          product.partType = listing.cType ?? product.partType;
          product.features = listing.cFeatures ?? product.features;
          if (imageUrls.length > 0) product.imageUrls = imageUrls;
          if (listing.extractedMake) (product as any).donorMake = listing.extractedMake;
          product.optimizationStatus = 'completed';
          await this.productRepo.save(product);
        } else {
          // Create new catalog product
          const newProduct = this.productRepo.create({
            sku,
            title: listing.title ?? `SKU ${sku}`,
            brand: listing.cBrand,
            mpn: listing.cManufacturerPartNumber,
            oemPartNumber: listing.cOeOemPartNumber,
            description: listing.description,
            categoryName: listing.categoryName,
            categoryId: listing.categoryId,
            price: listing.startPriceNum ?? 0,
            quantity: listing.quantityNum ?? 1,
            conditionId: listing.conditionId ?? 'Used',
            partType: listing.cType,
            features: listing.cFeatures,
            importId: `inline:${listing.id}`,
            sourceFile: listing.sourceFileName,
            sourceRow: listing.sourceRowNumber,
            optimizationStatus: 'completed',
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          } as any);
          product = await this.productRepo.save(newProduct as any) as any;
        }

        results.push({
          listingId: listing.id,
          sku,
          catalogProductId: product!.id,
          success: true,
        });

        this.logger.log(`Send to catalog: ${product ? 'updated' : 'created'} product for SKU ${sku}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Send to catalog failed for listing ${listing.id} (SKU ${sku}): ${msg}`);
        results.push({ listingId: listing.id, sku: sku ?? '', catalogProductId: null, success: false, error: msg });
      }
    }

    return { results };
  }
}
