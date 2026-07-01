import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import {
  PublishedListingsBulkService,
  type PublishedListingsBulkJobPayload,
} from '../services/published-listings-bulk.service.js';
import { PublishedListingsActionService } from '../services/published-listings-action.service.js';
import { PublishedListingsSyncService } from '../services/published-listings-sync.service.js';
import { PublishedListingsHealthService } from '../services/published-listings-health.service.js';
import { PublishedListingsPricingService } from '../services/published-listings-pricing.service.js';
import { EbayPublishedListingBulkJob } from '../entities/ebay-published-listing-bulk-job.entity.js';
import { EbayPublishedListingBulkJobItem } from '../entities/ebay-published-listing-bulk-job-item.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import { User } from '../../auth/entities/user.entity.js';

@Processor('published-listings-bulk')
export class PublishedListingsBulkProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishedListingsBulkProcessor.name);

  constructor(
    @InjectRepository(EbayPublishedListingBulkJob)
    private readonly jobRepo: Repository<EbayPublishedListingBulkJob>,
    @InjectRepository(EbayPublishedListingBulkJobItem)
    private readonly itemRepo: Repository<EbayPublishedListingBulkJobItem>,
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly actions: PublishedListingsActionService,
    private readonly sync: PublishedListingsSyncService,
    private readonly health: PublishedListingsHealthService,
    private readonly pricing: PublishedListingsPricingService,
  ) {
    super();
  }

  async process(job: Job<PublishedListingsBulkJobPayload>) {
    const { bulkJobId, organizationId, userId } = job.data;
    const bulkJob = await this.jobRepo.findOneBy({ id: bulkJobId });
    if (!bulkJob) return;

    bulkJob.status = 'running';
    await this.jobRepo.save(bulkJob);

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      bulkJob.status = 'failed';
      bulkJob.completedAt = new Date();
      await this.jobRepo.save(bulkJob);
      return;
    }

    const items = await this.itemRepo.find({ where: { bulkJobId } });
    let successCount = 0;
    let failureCount = 0;

    for (const item of items) {
      const listing = await this.listingRepo.findOneBy({
        id: item.publishedListingId,
      });
      if (!listing) {
        item.status = 'failed';
        item.errorMessage = 'Listing not found';
        item.processedAt = new Date();
        await this.itemRepo.save(item);
        failureCount += 1;
        continue;
      }

      try {
        await this.processItem(bulkJob, listing, user, organizationId);
        const refreshed = await this.listingRepo.findOneByOrFail({
          id: listing.id,
        });
        item.status = 'success';
        item.afterSnapshot = {
          title: refreshed.title,
          price: refreshed.price,
          quantityAvailable: refreshed.quantityAvailable,
          listingStatus: refreshed.listingStatus,
        };
        item.processedAt = new Date();
        await this.itemRepo.save(item);
        successCount += 1;
      } catch (e) {
        item.status = 'failed';
        item.errorMessage = e instanceof Error ? e.message : String(e);
        item.processedAt = new Date();
        await this.itemRepo.save(item);
        failureCount += 1;
      }
    }

    bulkJob.successCount = successCount;
    bulkJob.failureCount = failureCount;
    bulkJob.status =
      failureCount === 0
        ? 'completed'
        : successCount === 0
          ? 'failed'
          : 'partial';
    bulkJob.completedAt = new Date();
    await this.jobRepo.save(bulkJob);

    this.logger.log(
      `Bulk job ${bulkJobId} finished: ${successCount} ok, ${failureCount} failed`,
    );
  }

  private async processItem(
    job: EbayPublishedListingBulkJob,
    listing: EbayPublishedListing,
    user: User,
    organizationId: string,
  ): Promise<void> {
    const payload = job.actionPayload ?? {};

    switch (job.actionType) {
      case 'update_price': {
        const mode = (payload.mode as string) ?? 'set';
        const value = Number(payload.value ?? 0);
        let newPrice = Number(listing.price ?? 0);
        if (mode === 'set') newPrice = value;
        else if (mode === 'increase_percent') newPrice *= 1 + value / 100;
        else if (mode === 'decrease_percent') newPrice *= 1 - value / 100;
        else if (mode === 'increase_amount') newPrice += value;
        else if (mode === 'decrease_amount') newPrice -= value;
        await this.actions.revise(listing.id, organizationId, user, {
          price: Math.max(0.01, Math.round(newPrice * 100) / 100),
        });
        break;
      }
      case 'update_quantity':
        await this.actions.revise(listing.id, organizationId, user, {
          quantity: Number(payload.quantity ?? payload.value ?? 0),
        });
        break;
      case 'update_title':
        await this.actions.revise(listing.id, organizationId, user, {
          title: String(payload.title ?? ''),
        });
        break;
      case 'update_description':
        await this.actions.revise(listing.id, organizationId, user, {
          description: String(payload.description ?? ''),
        });
        break;
      case 'end_listing':
        await this.actions.endListing(listing.id, organizationId, user);
        break;
      case 'sync':
        await this.sync.syncListingById(listing.id, organizationId);
        break;
      case 'health_check': {
        const refreshed = await this.sync.syncListingById(
          listing.id,
          organizationId,
        );
        refreshed.healthFlags = this.health.computeHealthFlags({
          title: refreshed.title,
          imageUrls: refreshed.imageUrls,
          itemSpecifics: refreshed.itemSpecifics,
          compatibility: refreshed.compatibility,
          quantityAvailable: refreshed.quantityAvailable,
          quantitySold: refreshed.quantitySold,
          performanceMetrics: refreshed.performanceMetrics,
          categoryId: refreshed.categoryId,
          price: refreshed.price,
          competitorPricing: (refreshed.performanceMetrics?.competitorPricing as {
            medianPrice?: number | null;
          }) ?? null,
        });
        await this.listingRepo.save(refreshed);
        break;
      }
      case 'competitor_pricing':
        await this.pricing.refreshCompetitorPricing(listing.id, organizationId);
        break;
      default:
        throw new Error(`Unknown bulk action: ${job.actionType}`);
    }
  }
}
