import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelsService } from '../channels.service.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { ChannelConnection } from '../entities/channel-connection.entity.js';
import { Store } from '../entities/store.entity.js';
import { EbayPublishService } from '../ebay/ebay-publish.service.js';
import { PartsBazar360Service } from '../partsbazar360/partsbazar360.service.js';
export declare class ChannelPublishProcessor extends WorkerHost {
    private readonly channelsService;
    private readonly ebayPublish;
    private readonly partsbazar;
    private readonly listingRepo;
    private readonly connectionRepo;
    private readonly storeRepo;
    private readonly eventEmitter;
    private readonly logger;
    constructor(channelsService: ChannelsService, ebayPublish: EbayPublishService, partsbazar: PartsBazar360Service, listingRepo: Repository<ListingRecord>, connectionRepo: Repository<ChannelConnection>, storeRepo: Repository<Store>, eventEmitter: EventEmitter2);
    process(job: Job): Promise<void>;
    private handlePublish;
    private handleSyncInventory;
    private handleUpdate;
}
