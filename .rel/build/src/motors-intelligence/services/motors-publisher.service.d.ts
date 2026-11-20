import { Repository } from 'typeorm';
import { MotorsProduct, MotorsFeedbackLog } from '../entities';
import { ChannelsService } from '../../channels/channels.service';
import { ListingsService } from '../../listings/listings.service';
export declare class MotorsPublisherService {
    private readonly motorsProductRepo;
    private readonly feedbackLogRepo;
    private readonly channelsService;
    private readonly listingsService;
    private readonly logger;
    constructor(motorsProductRepo: Repository<MotorsProduct>, feedbackLogRepo: Repository<MotorsFeedbackLog>, channelsService: ChannelsService, listingsService: ListingsService);
    publishToEbay(motorsProductId: string, connectionId: string): Promise<{
        success: boolean;
        ebayListingId?: string;
        error?: string;
    }>;
    private buildListingData;
    private mapConditionToId;
}
