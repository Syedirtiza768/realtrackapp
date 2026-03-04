import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from '../orders.service.js';
import { Order } from '../entities/order.entity.js';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { EbayAdapter } from '../../channels/adapters/ebay/ebay.adapter.js';
import { ShopifyAdapter } from '../../channels/adapters/shopify/shopify.adapter.js';
import { AmazonAdapter } from '../../channels/adapters/amazon/amazon.adapter.js';
import { WalmartAdapter } from '../../channels/adapters/walmart/walmart.adapter.js';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import type { TokenSet, ChannelOrder, ChannelAdapter } from '../../channels/channel-adapter.interface.js';

@Processor('orders', { concurrency: 1 })
export class OrderImportProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderImportProcessor.name);

  constructor(
    private readonly ordersService: OrdersService,
    @InjectRepository(ChannelConnection)
    private readonly connRepo: Repository<ChannelConnection>,
    private readonly ebayAdapter: EbayAdapter,
    private readonly shopifyAdapter: ShopifyAdapter,
    private readonly amazonAdapter: AmazonAdapter,
    private readonly walmartAdapter: WalmartAdapter,
    private readonly encryption: TokenEncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'import-from-channels':
        await this.importFromAllChannels();
        break;

      case 'auto-complete':
        await this.autoComplete();
        break;

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async importFromAllChannels(): Promise<void> {
    const connections = await this.connRepo.find({
      where: { status: 'active' },
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    for (const conn of connections) {
      try {
        const tokens: TokenSet = JSON.parse(this.encryption.decrypt(conn.encryptedTokens));
        let channelOrders: ChannelOrder[] = [];

        const adapterMap: Record<string, ChannelAdapter> = {
          ebay: this.ebayAdapter,
          shopify: this.shopifyAdapter,
          amazon: this.amazonAdapter,
          walmart: this.walmartAdapter,
        };

        const adapter = adapterMap[conn.channel];
        if (adapter) {
          channelOrders = await adapter.getRecentOrders(tokens, since);
        } else {
          this.logger.warn(`No adapter for channel: ${conn.channel}`);
          continue;
        }

        for (const co of channelOrders) {
          try {
            const imported = await this.ordersService.importOrder({
              channel: conn.channel,
              connectionId: conn.id,
              externalOrderId: co.externalOrderId,
              buyer: { username: co.buyerUsername },
              financials: {
                subtotal: String(co.totalPrice),
                total: String(co.totalPrice),
                currency: co.currency,
              },
              items: [{
                externalItemId: co.externalListingId,
                title: `Order item from ${conn.channel}`,
                quantity: co.quantity,
                unitPrice: String(co.totalPrice / co.quantity),
              }],
              orderedAt: co.orderedAt,
            });

            // Emit new order event for notifications
            this.eventEmitter.emit('order.new', {
              orderId: imported.id,
              channel: conn.channel,
              total: String(co.totalPrice),
            });
          } catch (error: any) {
            this.logger.warn(
              `Failed to import order ${co.externalOrderId}: ${error.message}`,
            );
          }
        }

        conn.lastSyncAt = new Date();
        await this.connRepo.save(conn);
        this.logger.log(`Imported ${channelOrders.length} orders from ${conn.channel}:${conn.id}`);
      } catch (error: any) {
        this.logger.error(`Failed to fetch orders from ${conn.channel}:${conn.id}: ${error.message}`);
      }
    }
  }

  private async autoComplete(): Promise<void> {
    // Auto-complete orders delivered > 14 days ago
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    // Using direct query for efficiency
    const delivered = await this.connRepo.manager.find(Order, {
      where: { status: 'delivered' },
    });

    let completed = 0;
    for (const order of delivered) {
      if (order.deliveredAt && order.deliveredAt < cutoff) {
        try {
          await this.ordersService.transitionStatus(order.id, 'completed', 'Auto-completed: 14 days since delivery');
          completed++;
        } catch {
          // Skip if transition fails
        }
      }
    }

    if (completed > 0) {
      this.logger.log(`Auto-completed ${completed} orders delivered > 14 days ago`);
    }
  }
}
