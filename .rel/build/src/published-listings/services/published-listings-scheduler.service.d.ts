import { Repository } from 'typeorm';
import { SchedulerLeaderService } from '../../common/scheduler/scheduler-leader.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { PublishedListingsSyncService } from './published-listings-sync.service.js';
export declare class PublishedListingsSchedulerService {
    private readonly accountRepo;
    private readonly sync;
    private readonly leader;
    private readonly logger;
    constructor(accountRepo: Repository<ConnectedEbayAccount>, sync: PublishedListingsSyncService, leader: SchedulerLeaderService);
    scheduleDeltaSync(): Promise<void>;
    scheduleFullSync(): Promise<void>;
    private runSync;
}
