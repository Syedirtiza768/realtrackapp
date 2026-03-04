import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { InventoryLedger } from './entities/inventory-ledger.entity.js';
import { InventoryEvent } from './entities/inventory-event.entity.js';
import { StoreInventoryAllocation } from './entities/store-inventory-allocation.entity.js';
import { InventoryService } from './inventory.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventorySyncProcessor } from './processors/inventory-sync.processor.js';
import { FeatureFlagModule } from '../common/feature-flags/feature-flag.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryLedger, InventoryEvent, StoreInventoryAllocation]),
    BullModule.registerQueue({ name: 'inventory' }),
    FeatureFlagModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventorySyncProcessor],
  exports: [InventoryService],
})
export class InventoryModule {}
