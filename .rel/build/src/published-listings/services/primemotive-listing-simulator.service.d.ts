import { Repository } from 'typeorm';
import { SchedulerLeaderService } from '../../common/scheduler/scheduler-leader.service.js';
import { EbayPublishedListing } from '../entities/ebay-published-listing.entity.js';
export declare class PrimemotiveListingSimulatorService {
    private readonly listingRepo;
    private readonly leader;
    private readonly logger;
    constructor(listingRepo: Repository<EbayPublishedListing>, leader: SchedulerLeaderService);
    updateSyntheticListing(): Promise<void>;
    private isEnabled;
    private changeOneSyntheticListing;
}
