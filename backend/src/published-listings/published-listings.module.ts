import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ChannelsModule } from '../channels/channels.module.js';
import { EbayIntegrationsModule } from '../integrations/ebay/ebay-integrations.module.js';
import { User } from '../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { EbayPublishedListing } from './entities/ebay-published-listing.entity.js';
import { EbayPublishedListingSyncLog } from './entities/ebay-published-listing-sync-log.entity.js';
import { EbayPublishedListingBulkJob } from './entities/ebay-published-listing-bulk-job.entity.js';
import { EbayPublishedListingBulkJobItem } from './entities/ebay-published-listing-bulk-job-item.entity.js';
import { EbayPublishedListingRevision } from './entities/ebay-published-listing-revision.entity.js';
import { PublishedListingsController } from './published-listings.controller.js';
import { PublishedListingsService } from './services/published-listings.service.js';
import { PublishedListingsSyncService } from './services/published-listings-sync.service.js';
import { PublishedListingsActionService } from './services/published-listings-action.service.js';
import { PublishedListingsBulkService } from './services/published-listings-bulk.service.js';
import { PublishedListingsHealthService } from './services/published-listings-health.service.js';
import { PublishedListingsAuditService } from './services/published-listings-audit.service.js';
import { PublishedListingsSyncProcessor } from './processors/published-listings-sync.processor.js';
import { PublishedListingsBulkProcessor } from './processors/published-listings-bulk.processor.js';
import { PublishedListingsPricingService } from './services/published-listings-pricing.service.js';
import { PublishedListingsSchedulerService } from './services/published-listings-scheduler.service.js';
import { SchedulerModule } from '../common/scheduler/scheduler.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EbayPublishedListing,
      EbayPublishedListingSyncLog,
      EbayPublishedListingBulkJob,
      EbayPublishedListingBulkJobItem,
      EbayPublishedListingRevision,
      ConnectedEbayAccount,
      EbayListingChannel,
      User,
      Store,
    ]),
    BullModule.registerQueue(
      { name: 'published-listings-sync' },
      { name: 'published-listings-bulk' },
    ),
    ChannelsModule,
    EbayIntegrationsModule,
    SchedulerModule,
  ],
  controllers: [PublishedListingsController],
  providers: [
    PublishedListingsService,
    PublishedListingsSyncService,
    PublishedListingsActionService,
    PublishedListingsBulkService,
    PublishedListingsHealthService,
    PublishedListingsAuditService,
    PublishedListingsPricingService,
    PublishedListingsSyncProcessor,
    PublishedListingsBulkProcessor,
    PublishedListingsSchedulerService,
  ],
  exports: [PublishedListingsSyncService, PublishedListingsService],
})
export class PublishedListingsModule {}
