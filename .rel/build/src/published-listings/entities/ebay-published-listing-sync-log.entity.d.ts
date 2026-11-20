import { Organization } from '../../auth/entities/organization.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
export type PublishedListingSyncStatus = 'pending' | 'running' | 'completed' | 'failed';
export declare class EbayPublishedListingSyncLog {
    id: string;
    organizationId: string;
    organization: Organization;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    marketplaceId: string | null;
    trigger: 'manual' | 'scheduled' | 'single';
    status: PublishedListingSyncStatus;
    triggeredByUserId: string | null;
    triggeredByUser: User | null;
    startedAt: Date;
    completedAt: Date | null;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsFailed: number;
    errors: Record<string, unknown>[];
    warnings: Record<string, unknown>[];
}
