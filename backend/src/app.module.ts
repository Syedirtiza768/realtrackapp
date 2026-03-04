import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { SchedulerModule } from './common/scheduler/scheduler.module';
import { FeatureFlagModule } from './common/feature-flags/feature-flag.module';
import { AutomationModule } from './automation/automation.module';
import { TemplateModule } from './templates/template.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FitmentModule } from './fitment/fitment.module';
import { HealthModule } from './health/health.module';
import { CatalogImportModule } from './catalog-import/catalog-import.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { InventoryModule } from './inventory/inventory.module';
import { ListingRecord } from './listings/listing-record.entity';
import { ListingRevision } from './listings/listing-revision.entity';
import { ListingCompliance } from './listings/listing-compliance.entity';
import { ListingsModule } from './listings/listings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'listingpro'),
        autoLoadEntities: true,
        entities: [ListingRecord, ListingRevision, ListingCompliance],
        synchronize: false,
        migrationsRun: config.get<string>('DB_MIGRATIONS_RUN', 'false') === 'true',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsTableName: 'typeorm_migrations',
        // ─── Connection pool tuning ───
        extra: {
          max: Number(config.get<string>('DB_POOL_MAX', '20')),
          min: Number(config.get<string>('DB_POOL_MIN', '5')),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          statement_timeout: 30_000,
        },
        logging: config.get<string>('DB_LOGGING', 'false') === 'true',
      }),
    }),
    // ─── BullMQ (Redis) for background job queues ───
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<string>('REDIS_PORT', '6379')),
          password: config.get<string>('REDIS_PASSWORD', '') || undefined,
        },
      }),
    }),
    ListingsModule,
    HealthModule,
    AuthModule,
    StorageModule,
    IngestionModule,
    CatalogImportModule,
    FitmentModule,
    ChannelsModule,
    InventoryModule,
    OrdersModule,
    DashboardModule,
    SettingsModule,
    NotificationsModule,
    SchedulerModule,
    FeatureFlagModule,
    AutomationModule,
    TemplateModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
