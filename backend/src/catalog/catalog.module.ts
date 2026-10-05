import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { VerticalsModule } from '../verticals/verticals.module.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { BusinessIndustrialReview } from '../verticals/entities/business-industrial-review.entity.js';
import { FashionReview } from '../verticals/entities/fashion-review.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { CatalogWorkspaceService } from './catalog-workspace.service.js';
import {
  BusinessIndustrialCatalogWorkspaceController,
  FashionCatalogWorkspaceController,
} from './catalog-workspace.controller.js';

@Module({
  imports: [
    AuthModule,
    ChannelsModule,
    RbacModule,
    TeamsModule,
    VerticalsModule,
    TypeOrmModule.forFeature([
      CatalogProduct,
      ConnectedEbayAccount,
      EbayListingChannel,
      ListingActionLog,
      BusinessIndustrialReview,
      FashionReview,
      Team,
    ]),
  ],
  controllers: [
    FashionCatalogWorkspaceController,
    BusinessIndustrialCatalogWorkspaceController,
  ],
  providers: [CatalogWorkspaceService],
})
export class CatalogModule {}
