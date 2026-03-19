import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import {
  EbayPublishService,
  type PublishRequest,
  type PublishResult,
} from './ebay-publish.service.js';

/* ── DTOs ── */

class PublishDto {
  listingId!: string;
  storeIds!: string[];
  sku!: string;
  title!: string;
  description!: string;
  categoryId!: string;
  condition!: string;
  conditionDescription?: string;
  price!: number;
  currency?: string;
  quantity!: number;
  imageUrls!: string[];
  aspects!: Record<string, string[]>;
  compatibility?: any;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
  listingDuration?: string;
}

class BulkPublishDto {
  items!: PublishDto[];
}

class UpdatePriceQuantityDto {
  storeId!: string;
  offers!: Array<{
    offerId: string;
    price: number;
    quantity: number;
    currency?: string;
  }>;
}

class EndListingDto {
  storeId!: string;
}

/**
 * EbayPublishController — REST API for eBay multi-store publishing.
 *
 * Endpoints:
 *  POST   /channels/ebay/publish           — Publish to one or more stores
 *  POST   /channels/ebay/publish-batch      — Batch publish multiple listings
 *  PATCH  /channels/ebay/offers/price-quantity — Update price & quantity
 *  DELETE /channels/ebay/offers/:offerId    — End a listing (withdraw offer)
 */
@ApiTags('eBay Publish')
@Controller('channels/ebay')
export class EbayPublishController {
  constructor(private readonly publishService: EbayPublishService) {}

  @Post('publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a listing to one or more eBay stores' })
  async publish(@Body() dto: PublishDto) {
    return this.publishService.publish(dto as unknown as PublishRequest);
  }

  @Post('publish-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch publish multiple listings to eBay stores' })
  async publishBatch(@Body() dto: BulkPublishDto) {
    const allResults: Array<{ listingId: string; results: PublishResult[] }> = [];
    for (const item of dto.items) {
      const results = await this.publishService.publish(item as unknown as PublishRequest);
      allResults.push({ listingId: item.listingId, results });
    }
    return allResults;
  }

  @Patch('offers/price-quantity')
  @ApiOperation({ summary: 'Update price and quantity for existing eBay offers' })
  async updatePriceQuantity(@Body() dto: UpdatePriceQuantityDto) {
    return this.publishService.updatePriceQuantity(dto.storeId, dto.offers);
  }

  @Delete('offers/:offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End/withdraw an eBay listing' })
  @ApiParam({ name: 'offerId', type: String })
  async endListing(
    @Param('offerId') offerId: string,
    @Body() dto: EndListingDto,
  ) {
    return this.publishService.endListing(dto.storeId, offerId);
  }
}
