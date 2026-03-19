import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingRecord } from './listing-record.entity';
import { ListingRevision } from './listing-revision.entity';
import { ListingCompliance } from './listing-compliance.entity';
import { MasterProduct } from './entities/master-product.entity';
import { EbayOffer } from './entities/ebay-offer.entity';
import { CrossReference } from './entities/cross-reference.entity';
import { EbayCategory } from './entities/ebay-category.entity';
import { CompetitorPrice } from './entities/competitor-price.entity';
import { MarketSnapshot } from './entities/market-snapshot.entity';
import { ExportRule } from './entities/export-rule.entity';
import { ListingsController } from './listings.controller';
import { ListingsV2Controller } from './listings-v2.controller';
import { ExportRuleController } from './export-rule.controller';
import { ListingGenerationController } from './listing-generation.controller';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';
import { ExportRuleService } from './export-rule.service';
import { ListingGenerationService } from './listing-generation.service';
import { ChannelsModule } from '../channels/channels.module';
import { TemplateModule } from '../templates/template.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ListingRecord,
      ListingRevision,
      ListingCompliance,
      MasterProduct,
      EbayOffer,
      CrossReference,
      EbayCategory,
      CompetitorPrice,
      MarketSnapshot,
      ExportRule,
    ]),
    ChannelsModule,
    TemplateModule,
  ],
  controllers: [ListingsController, ListingsV2Controller, ExportRuleController, ListingGenerationController],
  providers: [ListingsService, SearchService, ExportRuleService, ListingGenerationService],
  exports: [ListingsService, SearchService, ExportRuleService, ListingGenerationService],
})
export class ListingsModule {}
