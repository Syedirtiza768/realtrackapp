import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterProduct } from '../listings/entities/master-product.entity.js';
import { EbayOffer } from '../listings/entities/ebay-offer.entity.js';
import { CompetitorPrice } from '../listings/entities/competitor-price.entity.js';
import { MarketSnapshot } from '../listings/entities/market-snapshot.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { PriceMonitorService } from './price-monitor.service.js';
import { AutoRepriceService } from './auto-reprice.service.js';
import { PricingIntelligenceController } from './pricing-intelligence.controller.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';

/**
 * PricingIntelligenceModule — Phase 5: Market Intelligence & Dynamic Pricing.
 *
 * Provides:
 *  - PriceMonitorService  → scheduled competitor price collection via eBay Browse API
 *  - AutoRepriceService   → AI-powered pricing + eBay offer update
 *
 * Dependencies:
 *  - ChannelsModule   → EbayBrowseApiService, EbayInventoryApiService, Store entity
 *  - OpenAiModule     → CompetitiveAnalysisPipeline, PricingAnalysisPipeline (global)
 *  - FeatureFlagModule → pricing_intelligence gate
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MasterProduct,
      EbayOffer,
      CompetitorPrice,
      MarketSnapshot,
      Store,
    ]),
    ChannelsModule,
    FeatureFlagModule,
  ],
  controllers: [PricingIntelligenceController],
  providers: [PriceMonitorService, AutoRepriceService],
  exports: [PriceMonitorService, AutoRepriceService],
})
export class PricingIntelligenceModule {}
