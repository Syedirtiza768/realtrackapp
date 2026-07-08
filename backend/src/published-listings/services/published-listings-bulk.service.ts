import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository, In } from 'typeorm';
import type { Queue } from 'bullmq';
import { User } from '../../auth/entities/user.entity.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
import {
  EbayPublishedListingBulkJob,
  type BulkJobAction,
} from '../entities/ebay-published-listing-bulk-job.entity.js';
import { EbayPublishedListingBulkJobItem } from '../entities/ebay-published-listing-bulk-job-item.entity.js';
import type { BulkPublishedListingsDto } from '../dto/published-listings.dto.js';

export interface PublishedListingsBulkJobPayload {
  bulkJobId: string;
  organizationId: string;
  userId: string;
}

@Injectable()
export class PublishedListingsBulkService {
  constructor(
    @InjectRepository(EbayPublishedListing)
    private readonly listingRepo: Repository<EbayPublishedListing>,
    @InjectRepository(EbayPublishedListingBulkJob)
    private readonly jobRepo: Repository<EbayPublishedListingBulkJob>,
    @InjectRepository(EbayPublishedListingBulkJobItem)
    private readonly itemRepo: Repository<EbayPublishedListingBulkJobItem>,
    @InjectQueue('published-listings-bulk')
    private readonly bulkQueue: Queue<PublishedListingsBulkJobPayload>,
  ) {}

  async createBulkJob(
    organizationId: string,
    user: User,
    dto: BulkPublishedListingsDto,
  ): Promise<EbayPublishedListingBulkJob> {
    if (!dto.listingIds.length) {
      throw new BadRequestException('At least one listing is required');
    }

    const listings = await this.listingRepo.find({
      where: {
        id: In(dto.listingIds),
        organizationId,
      },
    });
    if (listings.length !== dto.listingIds.length) {
      throw new NotFoundException('One or more listings not found');
    }

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        organizationId,
        requestedByUserId: user.id,
        actionType: dto.action,
        status: 'pending',
        actionPayload: dto.payload ?? null,
        totalItems: listings.length,
      }),
    );

    for (const listing of listings) {
      await this.itemRepo.save(
        this.itemRepo.create({
          bulkJobId: job.id,
          publishedListingId: listing.id,
          status: 'pending',
          beforeSnapshot: this.snapshot(listing),
        }),
      );
    }

    await this.bulkQueue.add(
      'process-bulk',
      { bulkJobId: job.id, organizationId, userId: user.id },
      { jobId: `pub-bulk-${job.id}`, removeOnComplete: 100, removeOnFail: 200 },
    );

    return job;
  }

  async getJob(
    jobId: string,
    organizationId: string,
  ): Promise<{
    job: EbayPublishedListingBulkJob;
    items: EbayPublishedListingBulkJobItem[];
  }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, organizationId },
    });
    if (!job) throw new NotFoundException('Bulk job not found');
    const items = await this.itemRepo.find({
      where: { bulkJobId: job.id },
      order: { createdAt: 'ASC' },
    });
    return { job, items };
  }

  private snapshot(listing: EbayPublishedListing): Record<string, unknown> {
    return {
      title: listing.title,
      price: listing.price,
      quantityAvailable: listing.quantityAvailable,
      listingStatus: listing.listingStatus,
    };
  }
}
