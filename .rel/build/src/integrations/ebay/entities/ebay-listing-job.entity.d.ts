import { Organization } from '../../../auth/entities/organization.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { EbayListingJobTarget } from './ebay-listing-job-target.entity.js';
export type EbayListingJobType = 'publish' | 'revise' | 'end' | 'delete' | 'sync';
export type EbayListingJobStatus = 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';
export declare class EbayListingJob {
    id: string;
    organizationId: string;
    organization: Organization;
    requestedByUserId: string | null;
    requestedByUser: User | null;
    jobType: EbayListingJobType;
    status: EbayListingJobStatus;
    idempotencyKey: string | null;
    targets: EbayListingJobTarget[];
    createdAt: Date;
    updatedAt: Date;
}
