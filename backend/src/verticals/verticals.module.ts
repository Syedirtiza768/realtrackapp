import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ProductFamily } from './entities/product-family.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { VariantMarketplaceMapping } from './entities/variant-marketplace-mapping.entity.js';
import { ProductMarketplaceCategory } from './entities/product-marketplace-category.entity.js';
import { FashionReview } from './entities/fashion-review.entity.js';
import { FashionController } from './fashion.controller.js';
import { FashionUsersService } from './fashion-users.service.js';
import { FashionListingsService } from './fashion-listings.service.js';
import { VerticalsController } from './verticals.controller.js';
import { VerticalsService } from './verticals.service.js';
import { EbayVariantPublishingService } from './ebay-variant-publishing.service.js';

@Module({
  imports: [
    AuthModule,
    ChannelsModule,
    FeatureFlagModule,
    TypeOrmModule.forFeature([
      Store,
      ConnectedEbayAccount,
      CatalogProduct,
      ListingRecord,
      ProductFamily,
      ProductVariant,
      VariantMarketplaceMapping,
      ProductMarketplaceCategory,
      FashionReview,
    ]),
  ],
  controllers: [VerticalsController, FashionController],
  providers: [VerticalsService, EbayVariantPublishingService, FashionUsersService, FashionListingsService],
  exports: [VerticalsService, EbayVariantPublishingService, FashionListingsService],
})
export class VerticalsModule {}
