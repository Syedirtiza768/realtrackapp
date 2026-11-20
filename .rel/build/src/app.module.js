"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const jwt_auth_guard_js_1 = require("./auth/guards/jwt-auth.guard.js");
const permissions_guard_js_1 = require("./rbac/guards/permissions.guard.js");
const rbac_module_js_1 = require("./rbac/rbac.module.js");
const event_emitter_1 = require("@nestjs/event-emitter");
const schedule_1 = require("@nestjs/schedule");
const throttler_1 = require("@nestjs/throttler");
const user_throttler_guard_js_1 = require("./common/guards/user-throttler.guard.js");
const app_redis_module_js_1 = require("./common/redis/app-redis.module.js");
const request_timing_interceptor_js_1 = require("./common/observability/request-timing.interceptor.js");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const channels_module_1 = require("./channels/channels.module");
const scheduler_module_1 = require("./common/scheduler/scheduler.module");
const feature_flag_module_1 = require("./common/feature-flags/feature-flag.module");
const automation_module_1 = require("./automation/automation.module");
const template_module_1 = require("./templates/template.module");
const dashboard_module_1 = require("./dashboard/dashboard.module");
const fitment_module_1 = require("./fitment/fitment.module");
const health_module_1 = require("./health/health.module");
const catalog_import_module_1 = require("./catalog-import/catalog-import.module");
const ingestion_module_1 = require("./ingestion/ingestion.module");
const inventory_module_1 = require("./inventory/inventory.module");
const listing_record_entity_1 = require("./listings/listing-record.entity");
const listing_revision_entity_1 = require("./listings/listing-revision.entity");
const listing_compliance_entity_1 = require("./listings/listing-compliance.entity");
const listings_module_1 = require("./listings/listings.module");
const notifications_module_1 = require("./notifications/notifications.module");
const orders_module_1 = require("./orders/orders.module");
const settings_module_1 = require("./settings/settings.module");
const storage_module_1 = require("./storage/storage.module");
const motors_intelligence_module_1 = require("./motors-intelligence/motors-intelligence.module");
const openai_module_1 = require("./common/openai/openai.module");
const pricing_intelligence_module_1 = require("./pricing-intelligence/pricing-intelligence.module");
const ebay_integrations_module_1 = require("./integrations/ebay/ebay-integrations.module");
const client_settings_module_js_1 = require("./client-settings/client-settings.module.js");
const published_listings_module_js_1 = require("./published-listings/published-listings.module.js");
const teams_module_js_1 = require("./teams/teams.module.js");
const verticals_module_js_1 = require("./verticals/verticals.module.js");
const fashion_batch_publish_module_js_1 = require("./fashion-batch-publish/fashion-batch-publish.module.js");
const catalog_module_js_1 = require("./catalog/catalog.module.js");
const stock_module_js_1 = require("./stock/stock.module.js");
const parts_search_module_js_1 = require("./parts-search/parts-search.module.js");
const motoark_module_js_1 = require("./integrations/motoark/motoark.module.js");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            motoark_module_js_1.MotoarkModule,
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                ignoreEnvFile: process.env.IGNORE_ENV_FILE === 'true',
            }),
            app_redis_module_js_1.AppRedisModule,
            event_emitter_1.EventEmitterModule.forRoot(),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                { name: 'short', ttl: 1000, limit: 10 },
                { name: 'medium', ttl: 60000, limit: 100 },
                { name: 'long', ttl: 3600000, limit: 1000 },
            ]),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'postgres',
                    host: config.get('DB_HOST', 'localhost'),
                    port: Number(config.get('DB_PORT', '5432')),
                    username: config.get('DB_USER', 'postgres'),
                    password: config.get('DB_PASSWORD', 'postgres'),
                    database: config.get('DB_NAME', 'listingpro'),
                    autoLoadEntities: true,
                    entities: [listing_record_entity_1.ListingRecord, listing_revision_entity_1.ListingRevision, listing_compliance_entity_1.ListingCompliance],
                    synchronize: config.get('DB_SYNCHRONIZE', 'false') === 'true',
                    migrationsRun: config.get('DB_MIGRATIONS_RUN', 'false') === 'true' &&
                        config.get('DB_MIGRATIONS_AT_ENTRYPOINT', 'false') !== 'true',
                    migrations: [__dirname + '/migrations/*{.ts,.js}'],
                    migrationsTableName: 'typeorm_migrations',
                    extra: {
                        max: Number(config.get('DB_POOL_MAX', '20')),
                        min: Number(config.get('DB_POOL_MIN', '5')),
                        idleTimeoutMillis: 30_000,
                        connectionTimeoutMillis: 5_000,
                        statement_timeout: 30_000,
                    },
                    logging: config.get('DB_LOGGING', 'false') === 'true',
                }),
            }),
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    connection: {
                        host: config.get('REDIS_HOST', 'localhost'),
                        port: Number(config.get('REDIS_PORT', '6379')),
                        password: config.get('REDIS_PASSWORD', '') || undefined,
                    },
                    defaultJobOptions: {
                        attempts: 3,
                        removeOnComplete: { count: 100 },
                        removeOnFail: { count: 200 },
                    },
                }),
            }),
            listings_module_1.ListingsModule,
            health_module_1.HealthModule,
            rbac_module_js_1.RbacModule,
            auth_module_1.AuthModule,
            storage_module_1.StorageModule,
            ingestion_module_1.IngestionModule,
            catalog_import_module_1.CatalogImportModule,
            fitment_module_1.FitmentModule,
            channels_module_1.ChannelsModule,
            inventory_module_1.InventoryModule,
            orders_module_1.OrdersModule,
            dashboard_module_1.DashboardModule,
            settings_module_1.SettingsModule,
            notifications_module_1.NotificationsModule,
            scheduler_module_1.SchedulerModule,
            feature_flag_module_1.FeatureFlagModule,
            automation_module_1.AutomationModule,
            template_module_1.TemplateModule,
            motors_intelligence_module_1.MotorsIntelligenceModule,
            openai_module_1.OpenAiModule,
            pricing_intelligence_module_1.PricingIntelligenceModule,
            ebay_integrations_module_1.EbayIntegrationsModule,
            client_settings_module_js_1.ClientSettingsModule,
            published_listings_module_js_1.PublishedListingsModule,
            teams_module_js_1.TeamsModule,
            verticals_module_js_1.VerticalsModule,
            fashion_batch_publish_module_js_1.FashionBatchPublishModule,
            catalog_module_js_1.CatalogModule,
            stock_module_js_1.StockModule,
            parts_search_module_js_1.PartsSearchModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            { provide: core_1.APP_GUARD, useClass: user_throttler_guard_js_1.UserThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_js_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: permissions_guard_js_1.PermissionsGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: request_timing_interceptor_js_1.RequestTimingInterceptor },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map