import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { EbayFulfillmentApiService } from '../channels/ebay/ebay-fulfillment-api.service.js';
import { OrdersService } from './orders.service.js';

/**
 * OrderFulfillmentService — Bridges order "ship" actions with eBay Fulfillment API.
 *
 * Phase 4:
 *  - Mark single order as shipped (+ push tracking to eBay)
 *  - Bulk ship multiple orders
 *  - Parse CSV tracking upload and process each row
 */
@Injectable()
export class OrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly fulfillmentApi: EbayFulfillmentApiService,
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /* ─── Single Ship ─────────────────────────────────────────── */

  /**
   * Mark an order as shipped, push tracking to eBay.
   */
  async markShipped(
    orderId: string,
    tracking: { carrier: string; trackingNumber: string },
  ): Promise<Order> {
    const { order, items } = await this.ordersService.findOne(orderId);

    if (!order.storeId || order.channel !== 'ebay' || !order.externalOrderId) {
      // Not an eBay order — just update locally
      return this.ordersService.updateShipping(orderId, {
        trackingNumber: tracking.trackingNumber,
        trackingCarrier: tracking.carrier,
      });
    }

    // Push to eBay Fulfillment API
    try {
      const lineItems = items.map((item) => ({
        lineItemId: item.externalItemId ?? item.id,
        quantity: item.quantity,
      }));

      await this.fulfillmentApi.createShippingFulfillment(
        order.storeId,
        order.externalOrderId,
        {
          lineItems,
          shippingCarrierCode: tracking.carrier,
          trackingNumber: tracking.trackingNumber,
        },
      );

      this.logger.log(
        `Pushed tracking to eBay for order ${order.externalOrderId}: ${tracking.carrier} ${tracking.trackingNumber}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to push tracking to eBay for order ${orderId}: ${msg}`);
      // Still update locally — eBay sync can retry later
    }

    // Update local order
    const updated = await this.ordersService.updateShipping(orderId, {
      trackingNumber: tracking.trackingNumber,
      trackingCarrier: tracking.carrier,
    });

    this.eventEmitter.emit('order.shipped', {
      orderId: order.id,
      channel: order.channel,
      storeId: order.storeId,
      trackingNumber: tracking.trackingNumber,
      carrier: tracking.carrier,
    });

    return updated;
  }

  /* ─── Bulk Ship ───────────────────────────────────────────── */

  /**
   * Ship multiple orders at once with the same carrier info (or per-order tracking).
   */
  async bulkShip(
    items: Array<{
      orderId: string;
      trackingNumber: string;
      carrier: string;
    }>,
  ): Promise<{ orderId: string; success: boolean; error?: string }[]> {
    const results: { orderId: string; success: boolean; error?: string }[] = [];

    for (const item of items) {
      try {
        await this.markShipped(item.orderId, {
          carrier: item.carrier,
          trackingNumber: item.trackingNumber,
        });
        results.push({ orderId: item.orderId, success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ orderId: item.orderId, success: false, error: msg });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(`Bulk shipped ${successCount}/${items.length} orders`);
    return results;
  }

  /* ─── Bulk Cancel ─────────────────────────────────────────── */

  async bulkCancel(
    orderIds: string[],
    reason = 'Cancelled in bulk',
  ): Promise<{ orderId: string; success: boolean; error?: string }[]> {
    const results: { orderId: string; success: boolean; error?: string }[] = [];

    for (const orderId of orderIds) {
      try {
        await this.ordersService.transitionStatus(orderId, 'cancelled', reason);
        results.push({ orderId, success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ orderId, success: false, error: msg });
      }
    }

    return results;
  }

  /* ─── CSV Tracking Upload ─────────────────────────────────── */

  /**
   * Parse a CSV tracking file and mark orders as shipped.
   * Expected columns: orderId (or externalOrderId), trackingNumber, carrier
   */
  async processTrackingCsv(
    csvContent: string,
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ row: number; orderId: string; error: string }>;
  }> {
    const lines = csvContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    // Parse header
    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map((h) => h.trim());

    const orderIdIdx = headers.findIndex(
      (h) => h === 'orderid' || h === 'order_id' || h === 'externalorderid' || h === 'external_order_id',
    );
    const trackingIdx = headers.findIndex(
      (h) => h === 'trackingnumber' || h === 'tracking_number' || h === 'tracking',
    );
    const carrierIdx = headers.findIndex(
      (h) => h === 'carrier' || h === 'shippingcarriercode' || h === 'shipping_carrier',
    );

    if (orderIdIdx < 0 || trackingIdx < 0) {
      throw new BadRequestException(
        'CSV must include columns: orderId (or externalOrderId), trackingNumber',
      );
    }

    const errors: Array<{ row: number; orderId: string; error: string }> = [];
    let succeeded = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const orderIdValue = cols[orderIdIdx] ?? '';
      const trackingNumber = cols[trackingIdx] ?? '';
      const carrier = carrierIdx >= 0 ? (cols[carrierIdx] ?? 'OTHER') : 'OTHER';

      if (!orderIdValue || !trackingNumber) {
        errors.push({ row: i + 1, orderId: orderIdValue, error: 'Missing orderId or trackingNumber' });
        continue;
      }

      try {
        // Try by UUID first, then by external order ID
        let order = await this.orderRepo.findOneBy({ id: orderIdValue });
        if (!order) {
          order = await this.orderRepo.findOneBy({ externalOrderId: orderIdValue });
        }
        if (!order) {
          errors.push({ row: i + 1, orderId: orderIdValue, error: 'Order not found' });
          continue;
        }

        await this.markShipped(order.id, { carrier, trackingNumber });
        succeeded++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ row: i + 1, orderId: orderIdValue, error: msg });
      }
    }

    const processed = lines.length - 1;
    this.logger.log(
      `CSV tracking upload: ${succeeded}/${processed} succeeded, ${errors.length} errors`,
    );

    return {
      processed,
      succeeded,
      failed: errors.length,
      errors,
    };
  }
}
