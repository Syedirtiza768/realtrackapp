import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ChannelConnection } from './entities/channel-connection.entity.js';
import { ChannelListing } from './entities/channel-listing.entity.js';
import { ChannelWebhookLog } from './entities/channel-webhook-log.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { ChannelsService } from './channels.service.js';
import { ChannelsController } from './channels.controller.js';
import { TokenEncryptionService } from './token-encryption.service.js';
import { EbayAdapter } from './adapters/ebay/ebay.adapter.js';
import { ShopifyAdapter } from './adapters/shopify/shopify.adapter.js';
import { ChannelPublishProcessor } from './processors/channel-publish.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelConnection,
      ChannelListing,
      ChannelWebhookLog,
      ListingRecord,
    ]),
    BullModule.registerQueue({ name: 'channels' }),
  ],
  controllers: [ChannelsController],
  providers: [
    ChannelsService,
    TokenEncryptionService,
    EbayAdapter,
    ShopifyAdapter,
    ChannelPublishProcessor,
  ],
  exports: [ChannelsService],
})
export class ChannelsModule {}
