import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OrganizationMember } from '../../auth/entities/organization-member.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { ImageAsset } from '../../storage/entities/image-asset.entity.js';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { ChannelsModule } from '../../channels/channels.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { OrdersModule } from '../../orders/orders.module.js';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { InternalStore } from './entities/internal-store.entity.js';
import { ConnectedEbayAccount } from './entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from './entities/ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from './entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from './entities/ebay-business-policy.entity.js';
import { ListingStoreOverride } from './entities/listing-store-override.entity.js';
import { EbayListingChannel } from './entities/ebay-listing-channel.entity.js';
import { EbayListingJob } from './entities/ebay-listing-job.entity.js';
import { EbayListingJobTarget } from './entities/ebay-listing-job-target.entity.js';
import { EbayApiError } from './entities/ebay-api-error.entity.js';
import { ListingActionLog } from './entities/listing-action-log.entity.js';
import { InventoryMovement } from './entities/inventory-movement.entity.js';
import { EbayIntegrationsRedisConnection, EBAY_INTEGRATIONS_REDIS } from './ebay-integrations-redis.connection.js';
import { EbayOAuthStateStore } from './services/ebay-oauth-state.store.js';
import { EbayAccountTokenService } from './services/ebay-account-token.service.js';
import { EbayIntegrationsOAuthService } from './services/ebay-integrations-oauth.service.js';
import { EbayIntegrationPermissionsService } from './services/ebay-integration-permissions.service.js';
import { EbayIntegrationAccountService } from './services/ebay-integration-account.service.js';
import { EbayMarketplaceConfigService } from './services/ebay-marketplace-config.service.js';
import { EbayListingValidationService } from './services/ebay-listing-validation.service.js';
import { ListingBuilderService } from './services/listing-builder.service.js';
import { CatalogPublishResolverService } from './services/catalog-publish-resolver.service.js';
import { ListingActionLogWriterService } from './services/listing-action-log-writer.service.js';
import { EbayMultiStoreListingService } from './services/ebay-multi-store-listing.service.js';
import { EbayPolicySyncService } from './services/ebay-policy-sync.service.js';
import { EbaySellAccountApiService } from './services/ebay-sell-account-api.service.js';
import { EbayListingPublishProcessor } from './processors/ebay-listing-publish.processor.js';
import { EbayInventorySyncProcessor } from './processors/ebay-inventory-sync.processor.js';
import { EbayOrderSyncProcessor } from './processors/ebay-order-sync.processor.js';
import { EbayApiAuditLog } from './entities/ebay-api-audit-log.entity.js';
import { EbayListingSyncLog } from './entities/ebay-listing-sync-log.entity.js';
import { EbayApiAuditService } from './services/ebay-api-audit.service.js';
import { EbaySyncService } from './services/ebay-sync.service.js';
import { IntegrationsEbayController } from './controllers/integrations-ebay.controller.js';
import { EbayMultiStoreController } from './controllers/ebay-multi-store.controller.js';
import { SellerpunditModule } from '../sellerpundit/sellerpundit.module.js';
import { SellerpunditEbayController } from '../sellerpundit/sellerpundit-ebay.controller.js';
import { FitmentModule } from '../../fitment/fitment.module.js';

@Module({
  imports: [
    SellerpunditModule,
    TypeOrmModule.forFeature([
      InternalStore,
      ConnectedEbayAccount,
      EbayOAuthToken,
      EbayAccountMarketplace,
      EbayBusinessPolicy,
      ListingStoreOverride,
      EbayListingChannel,
      EbayListingJob,
      EbayListingJobTarget,
      EbayApiError,
      ListingActionLog,
      InventoryMovement,
      EbayApiAuditLog,
      EbayListingSyncLog,
      OrganizationMember,
      User,
      CatalogProduct,
      ListingRecord,
      ImageAsset,
      ChannelConnection,
      Store,
    ]),
    BullModule.registerQueue(
      { name: 'ebay-listing-publish' },
      { name: 'ebay-listing-validation' },
      { name: 'ebay-listing-revision' },
      { name: 'ebay-listing-ending' },
      { name: 'ebay-policy-sync' },
      { name: 'ebay-order-sync' },
      { name: 'ebay-inventory-sync' },
    ),
    ChannelsModule,
    AuthModule,
    OrdersModule,
    FitmentModule,
  ],
  controllers: [
    IntegrationsEbayController,
    EbayMultiStoreController,
    SellerpunditEbayController,
  ],
  providers: [
    EbayIntegrationsRedisConnection,
    {
      provide: EBAY_INTEGRATIONS_REDIS,
      useFactory: (c: EbayIntegrationsRedisConnection) => c.client,
      inject: [EbayIntegrationsRedisConnection],
    },
    EbayOAuthStateStore,
    EbayAccountTokenService,
    EbayIntegrationsOAuthService,
    EbayIntegrationPermissionsService,
    EbayIntegrationAccountService,
    EbayMarketplaceConfigService,
    EbayListingValidationService,
    CatalogPublishResolverService,
    ListingBuilderService,
    ListingActionLogWriterService,
    EbayMultiStoreListingService,
    EbayPolicySyncService,
    EbaySellAccountApiService,
    EbayListingPublishProcessor,
    EbayInventorySyncProcessor,
    EbayOrderSyncProcessor,
    EbayApiAuditService,
    EbaySyncService,
  ],
  exports: [
    EbayAccountTokenService,
    EbayMarketplaceConfigService,
    EbayMultiStoreListingService,
    EbaySyncService,
    EbayApiAuditService,
  ],
})
export class EbayIntegrationsModule {}
