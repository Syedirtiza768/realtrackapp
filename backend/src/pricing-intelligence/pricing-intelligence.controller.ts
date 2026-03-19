import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PriceMonitorService } from './price-monitor.service.js';
import { AutoRepriceService } from './auto-reprice.service.js';

class AnalyzeDto {
  productId!: string;
}

class RepriceDto {
  productId!: string;
  storeIds?: string[];
  forceApply?: boolean;
}

class CollectPricesDto {
  productId?: string;
}

@ApiTags('pricing-intelligence')
@Controller('pricing')
export class PricingIntelligenceController {
  constructor(
    private readonly priceMonitor: PriceMonitorService,
    private readonly autoReprice: AutoRepriceService,
  ) {}

  /* ─── Market Data ─── */

  @Get(':productId/snapshot')
  @ApiOperation({ summary: 'Get latest market snapshot for a product' })
  getLatestSnapshot(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.priceMonitor.getLatestSnapshot(productId);
  }

  @Get(':productId/snapshots')
  @ApiOperation({ summary: 'Get market snapshot history for charting' })
  getSnapshotHistory(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('limit') limit?: string,
  ) {
    return this.priceMonitor.getSnapshotHistory(productId, limit ? parseInt(limit, 10) : 30);
  }

  @Get(':productId/competitors')
  @ApiOperation({ summary: 'Get competitor price history for a product' })
  getCompetitorHistory(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('days') days?: string,
  ) {
    return this.priceMonitor.getCompetitorHistory(productId, days ? parseInt(days, 10) : 30);
  }

  /* ─── AI Pricing ─── */

  @Get(':productId/suggestion')
  @ApiOperation({ summary: 'Get AI pricing suggestion for a product (does not apply)' })
  getSuggestion(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.autoReprice.getSuggestion(productId);
  }

  @Post('reprice')
  @ApiOperation({ summary: 'Auto-reprice a product across eBay stores' })
  reprice(@Body() dto: RepriceDto) {
    return this.autoReprice.repriceProduct(dto.productId, {
      storeIds: dto.storeIds,
      forceApply: dto.forceApply,
    });
  }

  /* ─── Data Collection ─── */

  @Post('collect')
  @ApiOperation({ summary: 'Manually trigger competitor price collection' })
  collectPrices(@Body() dto: CollectPricesDto) {
    if (dto.productId) {
      return this.priceMonitor.collectForProduct(dto.productId);
    }
    return this.priceMonitor.collectAllCompetitorPrices();
  }
}
