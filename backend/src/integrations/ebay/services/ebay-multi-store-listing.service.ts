import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { EbayListingJob } from '../entities/ebay-listing-job.entity.js';
import { EbayListingJobTarget } from '../entities/ebay-listing-job-target.entity.js';
import { EbayListingValidationService } from './ebay-listing-validation.service.js';

@Injectable()
export class EbayMultiStoreListingService {
  constructor(
    @InjectRepository(EbayListingJob)
    private readonly jobRepo: Repository<EbayListingJob>,
    @InjectRepository(EbayListingJobTarget)
    private readonly targetRepo: Repository<EbayListingJobTarget>,
    private readonly validation: EbayListingValidationService,
    @InjectQueue('ebay-listing-publish') private readonly publishQueue: Queue,
  ) {}

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
  }): Promise<{ job: EbayListingJob; skipped: { ebayAccountId: string; marketplaceId: string; errors: string[] }[] }> {
    if (!input.targets.length) {
      throw new BadRequestException('At least one target store is required');
    }

    const eligible: { ebayAccountId: string; marketplaceId: string }[] = [];
    const skipped: { ebayAccountId: string; marketplaceId: string; errors: string[] }[] = [];
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
        message: 'No targets passed validation — fix errors or deselect blocked stores.',
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
        catalogProductId: input.catalogProductId,
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
    const job = await this.jobRepo.findOne({ where: { id: jobId, organizationId } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async getJobTargets(jobId: string, organizationId: string) {
    const job = await this.getJob(jobId, organizationId);
    return this.targetRepo.find({
      where: { listingJobId: job.id },
      order: { createdAt: 'ASC' },
    });
  }
}
