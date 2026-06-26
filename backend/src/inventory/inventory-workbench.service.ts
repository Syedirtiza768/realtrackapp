import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { PartFitment } from '../fitment/entities/part-fitment.entity.js';
import { PipelineJob } from '../ingestion/entities/pipeline-job.entity.js';
import { SingleListingFormService } from '../ingestion/services/single-listing-form.service.js';
import type { PartLookupResult } from '../ingestion/services/single-listing-form.service.js';
import { PipelineService } from '../ingestion/pipeline.service.js';
import type { InventoryListingsQueryDto } from './dto/inventory-workbench.dto.js';

export interface InventoryMarketplaceVariant {
  listingId: string;
  marketplace: string | null;
  status: string;
  ebayListingId?: string;
  pipelineJobId?: string;
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
  intakeSource?: boolean;
  marketplaceVariants: InventoryMarketplaceVariant[];
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
  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(PartFitment)
    private readonly fitmentRepo: Repository<PartFitment>,
    @InjectRepository(PipelineJob)
    private readonly pipelineJobRepo: Repository<PipelineJob>,
    private readonly singleListingForm: SingleListingFormService,
    private readonly pipelineService: PipelineService,
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
        intakeSource: listing.sourceFileName === 'warehouse-intake',
        marketplaceVariants,
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
      priorCompletedJobs: priorJobs,
      missingFields: computeMissingFields(listing),
      imageUrls: parseImageUrls(listing.itemPhotoUrl),
    };
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
}
