import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity.js';
import { StoreAccessService } from '../../channels/store-access.service.js';
import { SchedulerLeaderService } from '../../common/scheduler/scheduler-leader.service.js';
import { PublishedListingsQueryDto } from '../dto/published-listings.dto.js';
import { EbayPublishedListingChange } from '../entities/ebay-published-listing-change.entity.js';
import { PublishedListingsService } from './published-listings.service.js';
export declare class PrimemotiveListingChangesService {
    private readonly changeRepo;
    private readonly storeAccess;
    private readonly leader;
    private readonly listings;
    private readonly logger;
    private missingSecretWarned;
    constructor(changeRepo: Repository<EbayPublishedListingChange>, storeAccess: StoreAccessService, leader: SchedulerLeaderService, listings: PublishedListingsService);
    listChanges(organizationId: string, user: User, query: PublishedListingsQueryDto): Promise<{
        items: any;
        total: any;
        limit: number;
        nextSequence: any;
        throughSequence: any;
        hasMore: boolean;
    } | {
        items: {
            eventId: string;
            eventType: import("../entities/ebay-published-listing-change.entity.js").PrimemotiveListingChangeType;
            occurredAt: string;
            listingId: string;
            sequence: string | null;
            revision: {};
            listing: Record<string, unknown>;
        }[];
        total: number;
        page: number;
        limit: number;
        nextUpdatedAfter: string;
    }>;
    promoteCommittedChanges(): Promise<void>;
    private listBySequence;
    dispatchWebhooks(): Promise<void>;
    private deliverDueChanges;
    private claimDueChanges;
    private deliverOne;
}
