import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity.js';
import { AiResult } from '../entities/ai-result.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import type { ReviewDecisionDto } from '../dto/review-decision.dto.js';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    @InjectRepository(IngestionJob)
    private readonly jobRepo: Repository<IngestionJob>,
    @InjectRepository(AiResult)
    private readonly aiResultRepo: Repository<AiResult>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * List jobs needing human review.
   */
  async listForReview(limit = 20): Promise<IngestionJob[]> {
    return this.jobRepo.find({
      where: { reviewStatus: 'needs_review' },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Approve an ingestion job — creates a draft listing from AI results.
   */
  async approve(
    jobId: string,
    dto: ReviewDecisionDto,
    reviewerId?: string,
  ): Promise<{ job: IngestionJob; listing: ListingRecord }> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const aiResult = await this.aiResultRepo.findOneBy({ jobId });
    if (!aiResult) throw new NotFoundException(`No AI result for job ${jobId}`);

    // Run in a transaction
    return this.dataSource.transaction(async (manager) => {
      // Apply corrections over AI-extracted fields
      const corrections = dto.corrections ?? {};
      const title =
        (corrections['title'] as string) ?? aiResult.extractedTitle ?? 'Untitled Part';
      const brand =
        (corrections['brand'] as string) ?? aiResult.extractedBrand;
      const mpn =
        (corrections['mpn'] as string) ?? aiResult.extractedMpn;

      // Create a draft listing from AI results
      const listing = manager.create(ListingRecord, {
        title,
        cBrand: brand,
        cManufacturerPartNumber: mpn,
        cOeOemPartNumber: aiResult.extractedOemNumber,
        cType: aiResult.extractedPartType,
        conditionId: aiResult.extractedCondition,
        startPrice: aiResult.extractedPriceEstimate?.toString(),
        description: aiResult.extractedDescription,
        status: 'draft',
        sourceFileName: 'ai-ingestion',
        sourceFilePath: 'ai-ingestion',
        sourceRowNumber: 0,
      });
      const savedListing = await manager.save(listing);

      // Update job
      job.status = 'approved';
      job.reviewStatus = 'approved';
      job.reviewedBy = reviewerId ?? null;
      job.reviewedAt = new Date();
      job.reviewNotes = dto.reason ?? null;
      job.listingId = savedListing.id;
      await manager.save(job);

      this.logger.log(
        `Job ${jobId} approved → listing ${savedListing.id} created`,
      );
      return { job, listing: savedListing };
    });
  }

  /**
   * Reject an ingestion job.
   */
  async reject(
    jobId: string,
    dto: ReviewDecisionDto,
    reviewerId?: string,
  ): Promise<IngestionJob> {
    const job = await this.jobRepo.findOneBy({ id: jobId });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    job.status = 'rejected';
    job.reviewStatus = 'rejected';
    job.reviewedBy = reviewerId ?? null;
    job.reviewedAt = new Date();
    job.reviewNotes = dto.reason ?? null;
    await this.jobRepo.save(job);

    this.logger.log(`Job ${jobId} rejected: ${dto.reason ?? 'no reason'}`);
    return job;
  }
}
