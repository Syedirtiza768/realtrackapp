import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../ebay/entities/ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from '../ebay/entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../ebay/entities/ebay-business-policy.entity.js';
import { OrganizationSellerpunditConfig } from './entities/organization-sellerpundit-config.entity.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditTokenSyncService } from './sellerpundit-token-sync.service.js';
import { SellerpunditAccountSyncService } from './sellerpundit-account-sync.service.js';
import { SellerpunditPolicySyncService } from './sellerpundit-policy-sync.service.js';
import { SellerpunditListingAdapter } from './sellerpundit-listing.adapter.js';
import { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import { ListingActionLog } from '../ebay/entities/listing-action-log.entity.js';
import { EbayMarketplaceConfigService } from '../ebay/services/ebay-marketplace-config.service.js';
import { ListingActionLogWriterService } from '../ebay/services/listing-action-log-writer.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationSellerpunditConfig,
      ConnectedEbayAccount,
      EbayOAuthToken,
      ChannelConnection,
      Store,
      EbayAccountMarketplace,
      EbayBusinessPolicy,
      ListingActionLog,
    ]),
  ],
  providers: [
    TokenEncryptionService,
    EbayMarketplaceConfigService,
    ListingActionLogWriterService,
    SellerpunditHttpClient,
    SellerpunditAuthService,
    SellerpunditTokenSyncService,
    SellerpunditAccountSyncService,
    SellerpunditPolicySyncService,
    SellerpunditListingAdapter,
    SellerpunditMarketplaceRegistry,
  ],
  exports: [
    SellerpunditAuthService,
    SellerpunditTokenSyncService,
    SellerpunditAccountSyncService,
    SellerpunditPolicySyncService,
    SellerpunditListingAdapter,
  ],
})
export class SellerpunditModule {}
