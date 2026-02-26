import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { InventoryLedger } from './entities/inventory-ledger.entity.js';
import { InventoryEvent } from './entities/inventory-event.entity.js';
import { InventoryService } from './inventory.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventorySyncProcessor } from './processors/inventory-sync.processor.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryLedger, InventoryEvent]),
    BullModule.registerQueue({ name: 'inventory' }),
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventorySyncProcessor],
  exports: [InventoryService],
})
export class InventoryModule {}
