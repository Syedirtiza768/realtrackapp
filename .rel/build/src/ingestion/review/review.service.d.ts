import { DataSource, Repository } from 'typeorm';
import { IngestionJob } from '../entities/ingestion-job.entity.js';
import { AiResult } from '../entities/ai-result.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import type { ReviewDecisionDto } from '../dto/review-decision.dto.js';
export declare class ReviewService {
    private readonly jobRepo;
    private readonly aiResultRepo;
    private readonly listingRepo;
    private readonly dataSource;
    private readonly logger;
    constructor(jobRepo: Repository<IngestionJob>, aiResultRepo: Repository<AiResult>, listingRepo: Repository<ListingRecord>, dataSource: DataSource);
    listForReview(limit?: number): Promise<IngestionJob[]>;
    approve(jobId: string, dto: ReviewDecisionDto, reviewerId?: string): Promise<{
        job: IngestionJob;
        listing: ListingRecord;
    }>;
    reject(jobId: string, dto: ReviewDecisionDto, reviewerId?: string): Promise<IngestionJob>;
}
