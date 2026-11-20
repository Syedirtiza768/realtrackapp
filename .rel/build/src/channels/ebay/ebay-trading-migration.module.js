"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayTradingMigrationModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const channel_connection_entity_js_1 = require("../entities/channel-connection.entity.js");
const store_entity_js_1 = require("../entities/store.entity.js");
const token_encryption_service_js_1 = require("../token-encryption.service.js");
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const ebay_inventory_api_service_js_1 = require("./ebay-inventory-api.service.js");
const ebay_trading_api_service_js_1 = require("./ebay-trading-api.service.js");
const ebay_marketplace_config_service_js_1 = require("../../integrations/ebay/services/ebay-marketplace-config.service.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../../integrations/ebay/entities/ebay-listing-channel.entity.js");
const sellerpundit_token_sync_service_js_1 = require("../../integrations/sellerpundit/sellerpundit-token-sync.service.js");
const ebay_published_listing_entity_js_1 = require("../../published-listings/entities/ebay-published-listing.entity.js");
const ebay_trading_quota_service_js_1 = require("../../integrations/ebay/services/ebay-trading-quota.service.js");
let EbayTradingMigrationModule = class EbayTradingMigrationModule {
};
exports.EbayTradingMigrationModule = EbayTradingMigrationModule;
exports.EbayTradingMigrationModule = EbayTradingMigrationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'postgres',
                    host: config.get('DB_HOST', 'postgres'),
                    port: Number(config.get('DB_PORT', '5432')),
                    username: config.get('DB_USER', 'postgres'),
                    password: config.get('DB_PASSWORD', 'postgres'),
                    database: config.get('DB_NAME', 'listingpro'),
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
            typeorm_1.TypeOrmModule.forFeature([
                channel_connection_entity_js_1.ChannelConnection,
                store_entity_js_1.Store,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                ebay_listing_channel_entity_js_1.EbayListingChannel,
                ebay_published_listing_entity_js_1.EbayPublishedListing,
            ]),
        ],
        providers: [
            token_encryption_service_js_1.TokenEncryptionService,
            ebay_auth_service_js_1.EbayAuthService,
            ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
            ebay_inventory_api_service_js_1.EbayInventoryApiService,
            ebay_trading_api_service_js_1.EbayTradingApiService,
            ebay_trading_quota_service_js_1.EbayTradingQuotaService,
            {
                provide: sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
                useValue: {
                    ensureFreshAccessToken: () => Promise.reject(new Error('SellerPundit token refresh is not enabled in the Trading migration runner')),
                },
            },
        ],
    })
], EbayTradingMigrationModule);
//# sourceMappingURL=ebay-trading-migration.module.js.map