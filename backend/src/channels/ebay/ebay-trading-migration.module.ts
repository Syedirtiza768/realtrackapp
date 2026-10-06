import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelConnection } from '../entities/channel-connection.entity.js';
import { Store } from '../entities/store.entity.js';
import { TokenEncryptionService } from '../token-encryption.service.js';
import { EbayAuthService } from './ebay-auth.service.js';
import { EbayInventoryApiService } from './ebay-inventory-api.service.js';
import { EbayTradingApiService } from './ebay-trading-api.service.js';
import { EbayMarketplaceConfigService } from '../../integrations/ebay/services/ebay-marketplace-config.service.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { SellerpunditTokenSyncService } from '../../integrations/sellerpundit/sellerpundit-token-sync.service.js';
import { EbayPublishedListing } from '../../published-listings/entities/ebay-published-listing.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'postgres'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'listingpro'),
        entities: [__dirname + '/../../**/*.entity.js'],
        synchronize: false,
        migrationsRun: false,
        logging: false,
        extra: {
          max: 4,
          min: 0,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          statement_timeout: 30_000,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      ChannelConnection,
      Store,
      ConnectedEbayAccount,
      EbayListingChannel,
      EbayPublishedListing,
    ]),
  ],
  providers: [
    TokenEncryptionService,
    EbayAuthService,
    EbayMarketplaceConfigService,
    EbayInventoryApiService,
    EbayTradingApiService,
    {
      provide: SellerpunditTokenSyncService,
      useValue: {
        ensureFreshAccessToken: () =>
          Promise.reject(
            new Error(
              'SellerPundit token refresh is not enabled in the Trading migration runner',
            ),
          ),
      },
    },
  ],
})
export class EbayTradingMigrationModule {}
