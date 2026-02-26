import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelsService } from '../channels.service.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';

@Processor('channels', { concurrency: 2 })
export class ChannelPublishProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelPublishProcessor.name);

  constructor(
    private readonly channelsService: ChannelsService,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
  ) {
    super();
  }

  async process(
    job: Job<{ connectionId: string; listingId: string }>,
  ): Promise<void> {
    const { connectionId, listingId } = job.data;
    this.logger.log(
      `Publishing listing ${listingId} to connection ${connectionId}`,
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
      condition: listing.conditionId,
      brand: listing.cBrand,
      mpn: listing.cManufacturerPartNumber,
      imageUrls: listing.itemPhotoUrl ? [listing.itemPhotoUrl] : [],
    };

    await this.channelsService.publishListing(
      connectionId,
      listingId,
      listingData,
    );

    // Update listing with published status
    listing.publishedAt = new Date();
    await this.listingRepo.save(listing);

    this.logger.log(`Published listing ${listingId} successfully`);
  }
}
