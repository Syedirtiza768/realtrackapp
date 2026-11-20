import { ReviewService } from './review.service.js';
import { ReviewDecisionDto } from '../dto/review-decision.dto.js';
import { User } from '../../auth/entities/user.entity.js';
export declare class ReviewController {
    private readonly reviewService;
    constructor(reviewService: ReviewService);
    listForReview(limit?: number): Promise<{
        jobs: import("../entities/ingestion-job.entity.js").IngestionJob[];
    }>;
    approve(id: string, dto: ReviewDecisionDto, user: User): Promise<{
        job: import("../entities/ingestion-job.entity.js").IngestionJob;
        listing: import("../../listings/listing-record.entity.js").ListingRecord;
    }>;
    reject(id: string, dto: ReviewDecisionDto, user: User): Promise<{
        job: import("../entities/ingestion-job.entity.js").IngestionJob;
    }>;
}
