import { Module } from '@nestjs/common';
import { ChannelsModule } from '../../channels/channels.module.js';
import { RbacModule } from '../../rbac/rbac.module.js';
import { StockModule } from '../../stock/stock.module.js';
import { PublishedListingsModule } from '../../published-listings/published-listings.module.js';
import { EbayIntegrationsModule } from '../ebay/ebay-integrations.module.js';
import { MotoarkController } from './motoark.controller.js';
import { MotoarkService } from './motoark.service.js';
import { MotoarkStockService } from './motoark-stock.service.js';

@Module({
  imports: [
    ChannelsModule,
    RbacModule,
    StockModule,
    PublishedListingsModule,
    EbayIntegrationsModule,
  ],
  controllers: [MotoarkController],
  providers: [MotoarkService, MotoarkStockService],
})
export class MotoarkModule {}
