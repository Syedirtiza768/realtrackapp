import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelsService } from '../channels.service.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { ChannelConnection } from '../entities/channel-connection.entity.js';
import { Store } from '../entities/store.entity.js';
import { EbayPublishService } from '../ebay/ebay-publish.service.js';
import { sanitizeEbayImageUrls } from '../ebay/ebay-listing-images.util.js';
import { mapToEbayConditionEnum } from '../ebay/ebay-listing-condition.util.js';

/**
 * BullMQ processor for the `channels` queue.
 * Routes jobs by name: publish, sync-inventory, update.
 * Emits lifecycle events consumed by NotificationTriggers.
 */
@Processor('channels', { concurrency: 2 })
export class ChannelPublishProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelPublishProcessor.name);

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly ebayPublish: EbayPublishService,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'publish':
        await this.handlePublish(job);
        break;

      case 'sync-inventory':
        await this.handleSyncInventory(job);
        break;

      case 'update':
        await this.handleUpdate(job);
        break;

      default:
        this.logger.warn(`Unknown channel job type: ${job.name}`);
    }
  }

  /* ─── publish ─── */

  private async handlePublish(
    job: Job<{
      connectionId: string;
      listingId: string;
      overrides?: { price?: number; title?: string; quantity?: number };
    }>,
  ): Promise<void> {
    const { connectionId, listingId, overrides } = job.data;
    this.logger.log(
      `Publishing listing ${listingId} to connection ${connectionId}`,
    );

    const listing = await this.listingRepo.findOneBy({ id: listingId });
    if (!listing) {
      throw new Error(`Listing ${listingId} not found`);
    }

    const conn = await this.connectionRepo.findOneBy({ id: connectionId });

    try {
      if (conn?.channel === 'ebay') {
        const store = await this.storeRepo.findOne({
          where: { connectionId },
          order: { isPrimary: 'DESC', createdAt: 'ASC' },
        });
        if (!store) {
          throw new Error(`No eBay store found for connection ${connectionId}`);
        }
        const stub = this.ebayPublish.stubPublishRequest(listingId, [store.id]);
        if (overrides?.title) stub.title = overrides.title;
        if (overrides?.price != null) stub.price = overrides.price;
        if (overrides?.quantity != null) stub.quantity = overrides.quantity;
        const results = await this.ebayPublish.publish(stub);
        const result = results[0];
        if (!result?.success) {
          throw new Error(result?.error ?? 'eBay publish failed');
        }
        await this.channelsService.recordEbayPublishSuccess(
          connectionId,
          listingId,
          store.id,
          result,
        );
      } else {
        const listingData: Record<string, unknown> = {
          title: overrides?.title ?? listing.title,
          description: listing.description,
          sku: listing.customLabelSku,
          price: overrides?.price ?? listing.startPrice,
          quantity: overrides?.quantity ?? 1,
          categoryId: listing.categoryId,
          condition: mapToEbayConditionEnum(listing.conditionId),
          brand: listing.cBrand,
          mpn: listing.cManufacturerPartNumber,
          imageUrls: listing.itemPhotoUrl
            ? sanitizeEbayImageUrls([listing.itemPhotoUrl]).imageUrls
            : [],
        };
        await this.channelsService.publishListing(
          connectionId,
          listingId,
          listingData,
        );
      }

      // Update listing with published status
      listing.publishedAt = new Date();
      await this.listingRepo.save(listing);

      // Emit event for notification system
      this.eventEmitter.emit('listing.published', {
        listingId,
        channel: 'unknown', // resolved downstream
        title: listing.title,
      });

      this.logger.log(`Published listing ${listingId} successfully`);
    } catch (error: any) {
      this.eventEmitter.emit('channel.error', {
        channel: 'unknown',
        connectionId,
        error: error.message,
      });
      throw error;
    }
  }

  /* ─── sync-inventory ─── */

  private async handleSyncInventory(
    job: Job<{
      connectionId?: string;
      trigger?: string;
      ruleId?: string;
      channel?: string | null;
    }>,
  ): Promise<void> {
    const { connectionId, trigger, channel } = job.data;
    this.logger.log(
      `Syncing inventory (trigger=${trigger ?? 'manual'}, connection=${connectionId ?? 'all'}, channel=${channel ?? 'all'})`,
    );

    try {
      if (connectionId) {
        // Single connection sync
        await this.channelsService.syncConnectionInventory(connectionId);
      } else {
        // Full sync across all active connections (optionally filtered by channel)
        await this.channelsService.syncAllInventory(channel ?? undefined);
      }

      this.eventEmitter.emit('inventory.synced', {
        trigger,
        connectionId,
        channel,
      });

      this.logger.log('Inventory sync completed successfully');
    } catch (error: any) {
      this.logger.error(`Inventory sync failed: ${error.message}`);
      throw error;
    }
  }

  /* ─── update ─── */

  private async handleUpdate(
    job: Job<{
      connectionId: string;
      listingId: string;
      channelListingId: string;
    }>,
  ): Promise<void> {
    const { connectionId, listingId, channelListingId } = job.data;
    this.logger.log(
      `Updating channel listing ${channelListingId} for listing ${listingId}`,
    );

    const listing = await this.listingRepo.findOneBy({ id: listingId });
    if (!listing) {
      throw new Error(`Listing ${listingId} not found`);
    }

    const listingData: Record<string, unknown> = {
      title: listing.title,
      description: listing.description,
      sku: listing.customLabelSku,
      price: listing.startPrice,
      quantity: 1,
      categoryId: listing.categoryId,
      condition: mapToEbayConditionEnum(listing.conditionId),
      brand: listing.cBrand,
      mpn: listing.cManufacturerPartNumber,
      imageUrls: listing.itemPhotoUrl
        ? sanitizeEbayImageUrls([listing.itemPhotoUrl]).imageUrls
        : [],
    };

    // Re-publish acts as update for most channel adapters
    await this.channelsService.publishListing(
      connectionId,
      listingId,
      listingData,
    );

    this.logger.log(`Updated channel listing ${channelListingId} successfully`);
  }
}
