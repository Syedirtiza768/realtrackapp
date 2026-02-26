import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { ChannelConnection } from '../channels/entities/channel-connection.entity.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { OrderImportProcessor } from './processors/order-import.processor.js';
import { EbayAdapter } from '../channels/adapters/ebay/ebay.adapter.js';
import { ShopifyAdapter } from '../channels/adapters/shopify/shopify.adapter.js';
import { TokenEncryptionService } from '../channels/token-encryption.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ChannelConnection]),
    BullModule.registerQueue({ name: 'orders' }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderImportProcessor,
    EbayAdapter,
    ShopifyAdapter,
    TokenEncryptionService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
