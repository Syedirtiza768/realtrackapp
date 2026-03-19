import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { OrderImportProcessor } from './processors/order-import.processor.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { EbayOrderImportService } from './order-import-ebay.service.js';
import { ChannelsModule } from '../channels/channels.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Store]),
    BullModule.registerQueue({ name: 'orders' }),
    ChannelsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderImportProcessor,
    OrderFulfillmentService,
    EbayOrderImportService,
  ],
  exports: [OrdersService, OrderFulfillmentService, EbayOrderImportService],
})
export class OrdersModule {}
