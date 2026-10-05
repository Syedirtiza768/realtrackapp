import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';
import { SchedulerModule } from '../common/scheduler/scheduler.module.js';
import { STOCK_ENTITIES } from './entities/index.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockAccessService } from './stock-access.service.js';
import { WarehousesService } from './warehouses.service.js';
import { SuppliersService } from './suppliers.service.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { StockOperationsService } from './stock-operations.service.js';
import { ReservationsService } from './reservations.service.js';
import { ProcurementService } from './procurement.service.js';
import { OrderStockService } from './order-stock.service.js';
import {
  ChannelStockSyncService,
  STOCK_CHANNEL_SYNC_QUEUE,
} from './channel-stock-sync.service.js';
import { ChannelStockSyncProcessor } from './channel-stock-sync.processor.js';
import { StockSetupService } from './stock-setup.service.js';
import { StockReportsService } from './stock-reports.service.js';
import { StockIntakeListener } from './stock-intake.listener.js';
import { StockController } from './stock.controller.js';
import { StockProcurementController } from './stock-procurement.controller.js';

/**
 * Warehouse inventory: SKU master, warehouses/bins, append-only stock ledger, documents
 * (receipts, transfers, adjustments, counts, purchase orders), order reservations,
 * procurement of stock that is not on hand, and channel quantity sync.
 * See docs/architecture/WAREHOUSE_INVENTORY.md.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(STOCK_ENTITIES),
    BullModule.registerQueue({ name: STOCK_CHANNEL_SYNC_QUEUE }),
    AuthModule,
    ChannelsModule,
    NotificationsModule,
    FeatureFlagModule,
    SchedulerModule,
  ],
  controllers: [StockController, StockProcurementController],
  providers: [
    StockLedgerService,
    StockAccessService,
    WarehousesService,
    SuppliersService,
    InventoryItemsService,
    StockOperationsService,
    ReservationsService,
    ProcurementService,
    OrderStockService,
    ChannelStockSyncService,
    ChannelStockSyncProcessor,
    StockSetupService,
    StockReportsService,
    StockIntakeListener,
  ],
  exports: [StockLedgerService, InventoryItemsService, OrderStockService],
})
export class StockModule {}
