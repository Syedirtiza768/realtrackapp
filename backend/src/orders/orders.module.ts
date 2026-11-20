import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { OrderImportProcessor } from './processors/order-import.processor.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { EbayOrderImportService } from './order-import-ebay.service.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CrossStoreSaleSyncService } from './cross-store-sale-sync.service.js';
import { CrossStoreSaleSyncController } from './cross-store-sale-sync.controller.js';
import { CrossStoreSaleSyncProcessor } from './processors/cross-store-sale-sync.processor.js';
import { CROSS_STORE_SALE_SYNC_QUEUE } from './cross-store-sale-sync.util.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Store, ConnectedEbayAccount]),
    BullModule.registerQueue({ name: 'orders' }),
    BullModule.registerQueue({ name: CROSS_STORE_SALE_SYNC_QUEUE }),
    ChannelsModule,
    FeatureFlagModule,
    NotificationsModule,
  ],
  controllers: [OrdersController, CrossStoreSaleSyncController],
  providers: [
    OrdersService,
    OrderImportProcessor,
    OrderFulfillmentService,
    EbayOrderImportService,
    CrossStoreSaleSyncService,
    CrossStoreSaleSyncProcessor,
  ],
  exports: [OrdersService, OrderFulfillmentService, EbayOrderImportService],
})
export class OrdersModule {}
