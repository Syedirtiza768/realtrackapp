import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MotorsProduct,
  MotorsProductStatus,
  MotorsFeedbackLog,
  FeedbackType,
} from '../entities';
import { ChannelsService } from '../../channels/channels.service';
import { ListingsService } from '../../listings/listings.service';

@Injectable()
export class MotorsPublisherService {
  private readonly logger = new Logger(MotorsPublisherService.name);

  constructor(
    @InjectRepository(MotorsProduct)
    private readonly motorsProductRepo: Repository<MotorsProduct>,
    @InjectRepository(MotorsFeedbackLog)
    private readonly feedbackLogRepo: Repository<MotorsFeedbackLog>,
    private readonly channelsService: ChannelsService,
    private readonly listingsService: ListingsService,
  ) {}

  /**
   * Publish a Motors product to eBay.
   * Creates or links a ListingRecord and uses existing eBay adapter.
   */
  async publishToEbay(
    motorsProductId: string,
    connectionId: string,
  ): Promise<{ success: boolean; ebayListingId?: string; error?: string }> {
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: motorsProductId },
    });

    // Validate publishability
    if (product.status !== MotorsProductStatus.APPROVED) {
      return {
        success: false,
        error: `Product status is ${product.status}, must be 'approved' to publish`,
      };
    }

    try {
      product.status = MotorsProductStatus.PUBLISHING;
      await this.motorsProductRepo.save(product);

      // Create or update the ListingRecord to maintain backward compatibility
      const listingData = this.buildListingData(product);

      let listingId = product.listingId;
      if (!listingId) {
        // Create new listing record
        const result = await this.listingsService.create(listingData as any);
        listingId = result.listing.id;
        product.listingId = listingId;
        await this.motorsProductRepo.save(product);
      } else {
        // Update existing listing record
        await this.listingsService.update(listingId, listingData as any);
      }

      // Use existing channel publish flow
      await this.channelsService.enqueuePublish(connectionId, listingId!);

      // Mark as published (the actual publish happens async via queue)
      product.status = MotorsProductStatus.PUBLISHED;
      product.publishedAt = new Date();
      await this.motorsProductRepo.save(product);

      return { success: true };
    } catch (error) {
      this.logger.error(`Publish failed for ${motorsProductId}: ${error.message}`);

      product.status = MotorsProductStatus.FAILED;
      product.publishError = error.message;
      await this.motorsProductRepo.save(product);

      // Log the failure for feedback learning
      await this.feedbackLogRepo.save(
        this.feedbackLogRepo.create({
          motorsProductId,
          feedbackType: FeedbackType.EBAY_API_ERROR,
          context: {
            error: error.message,
            connectionId,
          },
        }),
      );

      return { success: false, error: error.message };
    }
  }

  private buildListingData(product: MotorsProduct): Record<string, any> {
    const specifics = product.generatedItemSpecifics || {};

    return {
      title: product.generatedTitle || '',
      description: product.generatedHtmlDescription || '',
      categoryId: product.ebayCategoryId || '',
      categoryName: product.ebayCategoryName || '',
      startPrice: product.price ? String(product.price) : '',
      quantity: product.quantity ? String(product.quantity) : '1',
      conditionId: this.mapConditionToId(product.condition),
      itemPhotoUrl: (product.imageUrls || []).join('|'),
      format: 'FixedPrice',
      duration: 'GTC',
      customLabelSku: product.mpn || '',
      cBrand: specifics['Brand'] || product.brand || '',
      cManufacturerPartNumber: specifics['Manufacturer Part Number'] || product.mpn || '',
      cType: specifics['Type'] || product.productType || '',
      cOeOemPartNumber: specifics['OE/OEM Part Number'] || product.oemPartNumber || '',
      pUpc: product.upc || '',
      pEpid: product.epid || '',
      status: 'ready',
    };
  }

  private mapConditionToId(condition: string | null): string {
    switch (condition?.toLowerCase()) {
      case 'new': return '1000';
      case 'remanufactured': return '2000';
      case 'used': return '3000';
      case 'for parts or not working': return '7000';
      default: return '1000'; // Default to New
    }
  }
}
