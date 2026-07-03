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
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsObject,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EbayPublishService,
  type PublishRequest,
  type PublishResult,
} from './ebay-publish.service.js';

/* --- DTOs --- */

class PublishDto {
  @IsString()
  listingId!: string;

  @IsArray()
  @IsString({ each: true })
  storeIds!: string[];

  @IsString()
  sku!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  condition!: string;

  @IsOptional()
  @IsString()
  conditionDescription?: string;

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  quantity!: number;

  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  @IsObject()
  aspects!: Record<string, string[]>;

  @IsOptional()
  compatibility?: unknown;

  @IsOptional()
  @IsString()
  fulfillmentPolicyId?: string;

  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @IsOptional()
  @IsString()
  returnPolicyId?: string;

  @IsOptional()
  @IsString()
  merchantLocationKey?: string;

  @IsOptional()
  @IsIn(['FIXED_PRICE', 'AUCTION'])
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';

  @IsOptional()
  @IsString()
  listingDuration?: string;

  @IsOptional()
  @IsString()
  requestedFulfillmentPolicyName?: string;

  @IsOptional()
  @IsString()
  requestedReturnPolicyName?: string;

  @IsOptional()
  @IsString()
  requestedPaymentPolicyName?: string;
}

class PublishOfferDto {
  @IsString()
  offerId!: string;

  @IsNumber()
  price!: number;

  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

class BulkPublishDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublishDto)
  items!: PublishDto[];
}

class PublishByListingIdsDto {
  @IsArray()
  @IsString({ each: true })
  listingIds!: string[];

  @IsArray()
  @IsString({ each: true })
  storeIds!: string[];

  @IsOptional()
  @IsString()
  fulfillmentPolicyId?: string;

  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @IsOptional()
  @IsString()
  returnPolicyId?: string;

  @IsOptional()
  @IsString()
  shippingProfileName?: string;

  @IsOptional()
  @IsString()
  returnProfileName?: string;

  @IsOptional()
  @IsString()
  paymentProfileName?: string;
}

class UpdatePriceQuantityDto {
  @IsString()
  storeId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublishOfferDto)
  offers!: PublishOfferDto[];
}

class EndListingDto {
  @IsString()
  storeId!: string;
}

/**
 * EbayPublishController - REST API for eBay multi-store publishing.
 *
 * Endpoints:
 *  POST   /channels/ebay/publish           - Publish to one or more stores
 *  POST   /channels/ebay/publish-batch      - Batch publish multiple listings
 *  PATCH  /channels/ebay/offers/price-quantity - Update price and quantity
 *  DELETE /channels/ebay/offers/:offerId    - End a listing (withdraw offer)
 */
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';

@ApiTags('eBay Publish')
@Controller('channels/ebay')
@RequirePermissions('ebay.publish')
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

  @Post('publish-by-listings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish listing records by ID; backend enriches SKU, images, condition, and policies',
  })
  async publishByListingIds(@Body() dto: PublishByListingIdsDto) {
    return this.publishService.publishByListingIds(dto.listingIds, dto.storeIds, {
      fulfillmentPolicyId: dto.fulfillmentPolicyId,
      paymentPolicyId: dto.paymentPolicyId,
      returnPolicyId: dto.returnPolicyId,
      shippingProfileName: dto.shippingProfileName,
      returnProfileName: dto.returnProfileName,
      paymentProfileName: dto.paymentProfileName,
    });
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
