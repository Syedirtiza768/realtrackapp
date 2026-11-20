import { WorkerHost } from '@nestjs/bullmq';
import { FashionListingsService } from '../../../verticals/fashion-listings.service.js';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { EbayListingJobTarget } from '../entities/ebay-listing-job-target.entity.js';
import { EbayListingJob } from '../entities/ebay-listing-job.entity.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../entities/ebay-listing-channel.entity.js';
import { EbayListingValidationService } from '../services/ebay-listing-validation.service.js';
import { ListingBuilderService } from '../services/listing-builder.service.js';
import { CatalogPublishResolverService } from '../services/catalog-publish-resolver.service.js';
import { EbayPublishService } from '../../../channels/ebay/ebay-publish.service.js';
import { Store } from '../../../channels/entities/store.entity.js';
export declare function isTransientPublishFailure(message: string): boolean;
export declare function extractExistingEbayListingId(message: string): string | null;
export declare class EbayListingPublishProcessor extends WorkerHost {
    private readonly targetRepo;
    private readonly jobRepo;
    private readonly accountRepo;
    private readonly channelRepo;
    private readonly storeRepo;
    private readonly productRepo;
    private readonly validation;
    private readonly builder;
    private readonly publishResolver;
    private readonly ebayPublish;
    private readonly fashion?;
    private readonly logger;
    constructor(targetRepo: Repository<EbayListingJobTarget>, jobRepo: Repository<EbayListingJob>, accountRepo: Repository<ConnectedEbayAccount>, channelRepo: Repository<EbayListingChannel>, storeRepo: Repository<Store>, productRepo: Repository<CatalogProduct>, validation: EbayListingValidationService, builder: ListingBuilderService, publishResolver: CatalogPublishResolverService, ebayPublish: EbayPublishService, fashion?: FashionListingsService | undefined);
    process(job: Job<{
        targetId: string;
    }>): Promise<void>;
    private refreshJobStatus;
}
