import { Organization } from '../../auth/entities/organization.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { EbayPublishedListingBulkJobItem } from './ebay-published-listing-bulk-job-item.entity.js';
export type BulkJobAction = 'update_price' | 'update_quantity' | 'update_title' | 'update_description' | 'update_policies' | 'end_listing' | 'sync' | 'health_check' | 'competitor_pricing';
export type BulkJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';
export declare class EbayPublishedListingBulkJob {
    id: string;
    organizationId: string;
    organization: Organization;
    requestedByUserId: string;
    requestedByUser: User;
    actionType: BulkJobAction;
    status: BulkJobStatus;
    actionPayload: Record<string, unknown> | null;
    totalItems: number;
    successCount: number;
    failureCount: number;
    items: EbayPublishedListingBulkJobItem[];
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
}
