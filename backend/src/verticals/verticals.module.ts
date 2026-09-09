import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ProductFamily } from './entities/product-family.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { VariantMarketplaceMapping } from './entities/variant-marketplace-mapping.entity.js';
import { ProductMarketplaceCategory } from './entities/product-marketplace-category.entity.js';
import { FashionReview } from './entities/fashion-review.entity.js';
import { UserStoreAssignment } from '../channels/entities/user-store-assignment.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { BusinessIndustrialReview } from './entities/business-industrial-review.entity.js';
import { BusinessIndustrialUnit } from './entities/business-industrial-unit.entity.js';
import { BusinessIndustrialIncident } from './entities/business-industrial-incident.entity.js';
import { FashionController } from './fashion.controller.js';
import { FashionUsersService } from './fashion-users.service.js';
import { FashionListingsService } from './fashion-listings.service.js';
import { BusinessIndustrialController } from './business-industrial.controller.js';
import { VerticalsController } from './verticals.controller.js';
import { VerticalsService } from './verticals.service.js';
import { EbayVariantPublishingService } from './ebay-variant-publishing.service.js';
import { BusinessIndustrialService } from './business-industrial.service.js';
import { BusinessIndustrialIncidentNotifications } from './business-industrial-incident-notifications.js';

@Module({
  imports: [
    AuthModule,
    ChannelsModule,
    FeatureFlagModule,
    NotificationsModule,
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
      OrganizationMember,
      User,
      UserStoreAssignment,
      EbayListingChannel,
      BusinessIndustrialReview,
      BusinessIndustrialUnit,
      BusinessIndustrialIncident,
    ]),
  ],
  controllers: [VerticalsController, FashionController, BusinessIndustrialController],
  providers: [VerticalsService, EbayVariantPublishingService, FashionUsersService, FashionListingsService, BusinessIndustrialService, BusinessIndustrialIncidentNotifications],
  exports: [VerticalsService, EbayVariantPublishingService, FashionListingsService, BusinessIndustrialService],
})
export class VerticalsModule {}
