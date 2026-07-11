import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { EbayListingJob } from '../entities/ebay-listing-job.entity.js';
import { EbayListingJobTarget } from '../entities/ebay-listing-job-target.entity.js';
import { EbayListingValidationService } from './ebay-listing-validation.service.js';
import { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';

const MAX_BULK_LISTINGS = 500;
const MAX_DAILY_PUBLISH_TARGETS = 5_000;

@Injectable()
export class EbayMultiStoreListingService {
  constructor(
    @InjectRepository(EbayListingJob)
    private readonly jobRepo: Repository<EbayListingJob>,
    @InjectRepository(EbayListingJobTarget)
    private readonly targetRepo: Repository<EbayListingJobTarget>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    private readonly config: ConfigService,
    private readonly validation: EbayListingValidationService,
    private readonly publishResolver: CatalogPublishResolverService,
    @InjectQueue('ebay-listing-publish') private readonly publishQueue: Queue,
  ) {}

  private dailyTargetLimit(): number {
    const configured = Number(
      this.config.get<string>('EBAY_DAILY_PUBLISH_TARGET_LIMIT', '5000'),
    );
    if (!Number.isFinite(configured)) return MAX_DAILY_PUBLISH_TARGETS;
    return Math.min(
      MAX_DAILY_PUBLISH_TARGETS,
      Math.max(1, Math.floor(configured)),
    );
  }

  private async countTodayTargets(organizationId: string): Promise<number> {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    return this.targetRepo
      .createQueryBuilder('target')
      .innerJoin(EbayListingJob, 'job', 'job.id = target.listingJobId')
      .where('job.organizationId = :organizationId', { organizationId })
      .andWhere('job.jobType = :jobType', { jobType: 'publish' })
      .andWhere('target.createdAt >= :dayStart', { dayStart })
      .getCount();
  }

  async createBulkPublishJob(input: {
    organizationId: string;
    requestedByUserId: string;
    listingIds: string[];
    storeIds: string[];
    idempotencyKey?: string;
  }): Promise<{
    job: EbayListingJob;
    targetCount: number;
    dailyLimit: number;
    dailyUsed: number;
  }> {
    const listingIds = [...new Set(input.listingIds)];
    const storeIds = [...new Set(input.storeIds)];
    if (!listingIds.length || !storeIds.length) {
      throw new BadRequestException(
        'At least one listing and one target store are required',
      );
    }
    if (listingIds.length > MAX_BULK_LISTINGS) {
      throw new BadRequestException(
        `A single bulk publish job supports at most ${MAX_BULK_LISTINGS} listings`,
      );
    }

    if (input.idempotencyKey) {
      const existing = await this.jobRepo.findOne({
        where: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) {
        const targetCount = await this.targetRepo.count({
          where: { listingJobId: existing.id },
        });
        const dailyUsed = await this.countTodayTargets(input.organizationId);
        return {
          job: existing,
          targetCount,
          dailyLimit: this.dailyTargetLimit(),
          dailyUsed,
        };
      }
    }

    const accounts = await this.accountRepo.find({
      where: {
        organizationId: input.organizationId,
        primaryStoreId: In(storeIds),
        connectionStatus: 'active',
      },
      relations: ['primaryStore'],
    });
    const accountByStore = new Map(
      accounts.map((account) => [account.primaryStoreId, account]),
    );
    const missingStores = storeIds.filter((id) => !accountByStore.has(id));
    if (missingStores.length) {
      throw new BadRequestException(
        `${missingStores.length} selected store(s) are not active eBay stores in this organization`,
      );
    }

    const resolvedProducts: Array<{
      sourceListingId: string;
      catalogProductId: string;
    }> = [];
    for (const listingId of listingIds) {
      const resolved = await this.publishResolver.resolve(listingId);
      if (!resolved) {
        throw new BadRequestException(
          `Catalog product or listing record ${listingId} was not found`,
        );
      }
      resolvedProducts.push({
        sourceListingId: listingId,
        catalogProductId: resolved.snapshot.catalogProductId,
      });
    }

    const requestedTargets = resolvedProducts.length * accounts.length;
    const dailyLimit = this.dailyTargetLimit();
    const dailyUsed = await this.countTodayTargets(input.organizationId);
    if (dailyUsed + requestedTargets > dailyLimit) {
      throw new BadRequestException(
        `Daily eBay publish limit exceeded: ${dailyUsed} target(s) already submitted, ${requestedTargets} requested, ${dailyLimit} maximum.`,
      );
    }

    const savedJob = await this.jobRepo.save(
      this.jobRepo.create({
        organizationId: input.organizationId,
        requestedByUserId: input.requestedByUserId,
        jobType: 'publish',
        status: 'pending',
        idempotencyKey: input.idempotencyKey ?? null,
      }),
    );

    const targets = resolvedProducts.flatMap((product) =>
      accounts.map((account) =>
        this.targetRepo.create({
          listingJobId: savedJob.id,
          catalogProductId: product.catalogProductId,
          ebayAccountId: account.id,
          marketplaceId:
            account.primaryStore?.ebayMarketplaceId ??
            (typeof account.primaryStore?.config?.marketplace === 'string'
              ? account.primaryStore.config.marketplace
              : 'EBAY_US'),
          status: 'pending',
          resultPayload: { sourceListingId: product.sourceListingId },
        }),
      ),
    );
    const savedTargets = await this.targetRepo.save(targets, { chunk: 500 });
    await this.publishQueue.addBulk(
      savedTargets.map((target) => ({
        name: 'publish-target',
        data: { targetId: target.id },
        opts: {
          attempts: 4,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      })),
    );

    return {
      job: savedJob,
      targetCount: savedTargets.length,
      dailyLimit,
      dailyUsed: dailyUsed + savedTargets.length,
    };
  }

  /** Resolve catalog browse id (listing or catalog) to a catalog_products FK id. */
  private async resolveCanonicalProductId(
    productRefId: string,
  ): Promise<string> {
    const resolved = await this.publishResolver.resolve(productRefId);
    if (!resolved) {
      throw new BadRequestException(
        'Catalog product or listing record not found',
      );
    }
    return resolved.snapshot.catalogProductId;
  }

  async validateTargets(input: {
    organizationId: string;
    catalogProductId: string;
    targets: { ebayAccountId: string; marketplaceId: string }[];
  }) {
    const results: Record<string, unknown>[] = [];
    for (const t of input.targets) {
      const key = `${t.ebayAccountId}:${t.marketplaceId}`;
      const v = await this.validation.validatePublish({
        organizationId: input.organizationId,
        catalogProductId: input.catalogProductId,
        ebayAccountId: t.ebayAccountId,
        marketplaceId: t.marketplaceId,
      });
      results.push({ key, ...v });
    }
    return { results };
  }

  async createPublishJob(input: {
    organizationId: string;
    requestedByUserId: string;
    catalogProductId: string;
    targets: { ebayAccountId: string; marketplaceId: string }[];
    idempotencyKey?: string;
  }): Promise<{
    job: EbayListingJob;
    skipped: {
      ebayAccountId: string;
      marketplaceId: string;
      errors: string[];
    }[];
  }> {
    if (!input.targets.length) {
      throw new BadRequestException('At least one target store is required');
    }

    const canonicalProductId = await this.resolveCanonicalProductId(
      input.catalogProductId,
    );

    const eligible: { ebayAccountId: string; marketplaceId: string }[] = [];
    const skipped: {
      ebayAccountId: string;
      marketplaceId: string;
      errors: string[];
    }[] = [];
    for (const t of input.targets) {
      const v = await this.validation.validatePublish({
        organizationId: input.organizationId,
        catalogProductId: input.catalogProductId,
        ebayAccountId: t.ebayAccountId,
        marketplaceId: t.marketplaceId,
      });
      if (v.status === 'blocked') {
        skipped.push({
          ebayAccountId: t.ebayAccountId,
          marketplaceId: t.marketplaceId,
          errors: v.errors,
        });
      } else {
        eligible.push(t);
      }
    }
    if (!eligible.length) {
      throw new BadRequestException({
        message:
          'No targets passed validation — fix errors or deselect blocked stores.',
        failures: skipped,
      });
    }

    if (input.idempotencyKey) {
      const existing = await this.jobRepo.findOne({
        where: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) return { job: existing, skipped: [] };
    }

    const job = this.jobRepo.create({
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      jobType: 'publish',
      status: 'pending',
      idempotencyKey: input.idempotencyKey ?? null,
    });
    const savedJob = await this.jobRepo.save(job);

    const targets: EbayListingJobTarget[] = [];
    for (const t of eligible) {
      const row = this.targetRepo.create({
        listingJobId: savedJob.id,
        catalogProductId: canonicalProductId,
        ebayAccountId: t.ebayAccountId,
        marketplaceId: t.marketplaceId,
        status: 'pending',
      });
      targets.push(await this.targetRepo.save(row));
    }

    for (const t of targets) {
      await this.publishQueue.add(
        'publish-target',
        { targetId: t.id },
        { removeOnComplete: 100, removeOnFail: 50 },
      );
    }

    return { job: savedJob, skipped };
  }

  async getJob(jobId: string, organizationId: string): Promise<EbayListingJob> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, organizationId },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async getJobTargets(jobId: string, organizationId: string) {
    const job = await this.getJob(jobId, organizationId);
    const rows = await this.targetRepo.find({
      where: { listingJobId: job.id },
      relations: ['ebayAccount', 'ebayAccount.primaryStore'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((t) => ({
      id: t.id,
      catalogProductId: t.catalogProductId,
      ebayAccountId: t.ebayAccountId,
      marketplaceId: t.marketplaceId,
      storeId: t.ebayAccount?.primaryStoreId ?? null,
      storeName: t.ebayAccount?.primaryStore?.storeName ?? null,
      status: t.status,
      resultPayload: t.resultPayload,
      errorPayload: t.errorPayload,
    }));
  }
}
