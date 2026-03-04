import {
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ListingsService } from './listings.service.js';
import { ListingsQueryDto } from './dto/listings-query.dto.js';
import { SearchService } from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { RedisCacheInterceptor, CacheTTL } from '../common/cache/index.js';

/**
 * API v2 Listings Controller
 *
 * Returns the same data as v1 but with properly typed numeric fields
 * instead of text strings. The v1 endpoints remain unchanged.
 *
 * Key differences:
 * - startPrice, buyItNowPrice, etc. → number | null (instead of string | null)
 * - quantity → number | null
 * - All shipping costs → number | null
 */
@Controller('v2/listings')
@UseInterceptors(RedisCacheInterceptor)
export class ListingsV2Controller {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly searchService: SearchService,
  ) {}

  @Get()
  async findAll(@Query() query: ListingsQueryDto) {
    const result = await this.listingsService.findAll(query);
    return {
      ...result,
      items: result.items.map(toV2Listing),
    };
  }

  @Get('search')
  async search(@Query() query: SearchQueryDto) {
    const result = await this.searchService.search(query);
    return {
      ...result,
      results: (result as any).results?.map((r: any) => ({
        ...r,
        ...toV2PriceFields(r),
      })) ?? [],
    };
  }

  @Get('summary')
  @CacheTTL(30)
  getSummary() {
    return this.listingsService.getSummary();
  }

  @Get('facets')
  @CacheTTL(60)
  getFacets() {
    return this.listingsService.getFacets();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.listingsService.findOne(id);
    return toV2FullListing(result);
  }

  @Get(':id/revisions')
  getRevisions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listingsService.getRevisions(id, Number(limit) || 20, Number(offset) || 0);
  }
}

/* ── v2 transform helpers ── */

/** Safely parse a text price to number */
function parsePrice(val: string | null | undefined): number | null {
  if (val == null || val === '') return null;
  const cleaned = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/** Safely parse a text quantity to integer */
function parseQty(val: string | null | undefined): number | null {
  if (val == null || val === '') return null;
  const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
}

/** Price fields common to both list and detail views */
function toV2PriceFields(record: any) {
  return {
    startPrice: record.startPriceNum ?? parsePrice(record.startPrice),
    quantity: record.quantityNum ?? parseQty(record.quantity),
  };
}

/** Transform a list-view listing to v2 format */
function toV2Listing(record: any) {
  return {
    ...record,
    ...toV2PriceFields(record),
  };
}

/** Transform a full-detail listing to v2 format */
function toV2FullListing(record: any) {
  return {
    ...record,
    startPrice: record.startPriceNum ?? parsePrice(record.startPrice),
    quantity: record.quantityNum ?? parseQty(record.quantity),
    buyItNowPrice: record.buyItNowPriceNum ?? parsePrice(record.buyItNowPrice),
    bestOfferAutoAcceptPrice: record.bestOfferAutoAcceptPriceNum ?? parsePrice(record.bestOfferAutoAcceptPrice),
    minimumBestOfferPrice: record.minimumBestOfferPriceNum ?? parsePrice(record.minimumBestOfferPrice),
    shippingService1Cost: record.shippingService1CostNum ?? parsePrice(record.shippingService1Cost),
    shippingService2Cost: record.shippingService2CostNum ?? parsePrice(record.shippingService2Cost),
  };
}
