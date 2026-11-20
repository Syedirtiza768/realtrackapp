import { Organization } from '../../../auth/entities/organization.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
export type EbayListingSyncType = 'listings' | 'policies' | 'identity' | 'full';
export type EbayListingSyncStatus = 'running' | 'success' | 'partial' | 'failed';
export declare class EbayListingSyncLog {
    id: string;
    organizationId: string;
    organization: Organization;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    marketplaceId: string | null;
    syncType: EbayListingSyncType;
    status: EbayListingSyncStatus;
    itemsProcessed: number;
    itemsUpdated: number;
    itemsFailed: number;
    warnings: Record<string, unknown>[];
    errors: Record<string, unknown>[];
    rawSummary: Record<string, unknown>;
    startedAt: Date;
    finishedAt: Date | null;
    triggeredByUserId: string | null;
    triggeredByUser: User | null;
}
