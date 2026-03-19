import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Store } from '../channels/entities/store.entity.js';
import { EbayFulfillmentApiService } from '../channels/ebay/ebay-fulfillment-api.service.js';
import { OrdersService } from './orders.service.js';
import { Order } from './entities/order.entity.js';
import type { EbayOrder, EbayLineItem } from '../channels/ebay/ebay-api.types.js';

/**
 * EbayOrderImportService — Pulls orders from eBay via Fulfillment API
 * and imports them into the local Order table (idempotent).
 *
 * Phase 4 core service:
 *  - Scheduled import (every 15min via scheduler)
 *  - Manual trigger via controller
 *  - Per-store import with since-date windowing
 *  - Emits 'order.new' event for inventory deduction
 */
@Injectable()
export class EbayOrderImportService {
  private readonly logger = new Logger(EbayOrderImportService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly fulfillmentApi: EbayFulfillmentApiService,
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Import orders from all active eBay stores.
   * Typically called by the scheduler every 15 minutes.
   */
  async importFromAllStores(): Promise<{ storeId: string; imported: number; errors: number }[]> {
    const stores = await this.storeRepo.find({
      where: { channel: 'ebay', status: 'active' },
    });

    const results: { storeId: string; imported: number; errors: number }[] = [];

    for (const store of stores) {
      try {
        const result = await this.importFromStore(store.id);
        results.push(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to import orders from store ${store.id}: ${msg}`);
        results.push({ storeId: store.id, imported: 0, errors: 1 });
      }
    }

    return results;
  }

  /**
   * Import orders from a specific eBay store since its last sync.
   */
  async importFromStore(storeId: string): Promise<{ storeId: string; imported: number; errors: number }> {
    const store = await this.storeRepo.findOneBy({ id: storeId });
    if (!store) throw new Error(`Store ${storeId} not found`);

    // Default to 1 hour ago if no previous sync
    const since = store.lastSyncAt ?? new Date(Date.now() - 60 * 60 * 1000);

    this.logger.log(`Importing eBay orders for store ${store.storeName} since ${since.toISOString()}`);

    let imported = 0;
    let errors = 0;
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const filter = `creationdate:[${since.toISOString()}..] `;
      const page = await this.fulfillmentApi.getOrders(storeId, { filter, limit, offset });
      const orders = page.orders ?? [];

      for (const ebayOrder of orders) {
        try {
          const wasNew = await this.importSingleOrder(ebayOrder, store);
          if (wasNew) imported++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to import eBay order ${ebayOrder.orderId}: ${msg}`);
          errors++;
        }
      }

      offset += limit;
      hasMore = orders.length === limit && offset < (page.total ?? 0);
    }

    // Update store's last sync timestamp
    await this.storeRepo.update(store.id, { lastSyncAt: new Date() });

    this.logger.log(
      `Store ${store.storeName}: imported ${imported} new orders, ${errors} errors`,
    );

    return { storeId, imported, errors };
  }

  /**
   * Import a single eBay order. Returns true if it was new (not a duplicate).
   */
  private async importSingleOrder(ebayOrder: EbayOrder, store: Store): Promise<boolean> {
    // Idempotency: check if already imported
    const existing = await this.orderRepo.findOne({
      where: { channel: 'ebay', externalOrderId: ebayOrder.orderId },
    });
    if (existing) return false;

    // Extract shipping from fulfillmentStartInstructions
    const shipTo = ebayOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo as
      | Record<string, unknown>
      | undefined;
    const contactAddress = shipTo?.contactAddress as Record<string, string> | undefined;
    const fullName = shipTo?.fullName as string | undefined;

    const shipping: Record<string, string> = {};
    if (fullName) shipping.name = fullName;
    if (contactAddress) {
      if (contactAddress.addressLine1) shipping.address1 = contactAddress.addressLine1;
      if (contactAddress.addressLine2) shipping.address2 = contactAddress.addressLine2;
      if (contactAddress.city) shipping.city = contactAddress.city;
      if (contactAddress.stateOrProvince) shipping.state = contactAddress.stateOrProvince;
      if (contactAddress.postalCode) shipping.zip = contactAddress.postalCode;
      if (contactAddress.countryCode) shipping.country = contactAddress.countryCode;
    }

    // Map line items
    const items = ebayOrder.lineItems.map((li: EbayLineItem) => ({
      externalItemId: li.lineItemId,
      sku: li.sku ?? undefined,
      title: li.title,
      quantity: li.quantity,
      unitPrice: li.lineItemCost.value,
    }));

    // Calculate financials
    const subtotal = ebayOrder.pricingSummary.subtotal?.value ?? ebayOrder.pricingSummary.total.value;
    const deliveryCost = ebayOrder.pricingSummary.deliveryCost?.value ?? '0';
    const total = ebayOrder.pricingSummary.total.value;
    const currency = ebayOrder.pricingSummary.total.currency;

    const order = await this.ordersService.importOrder({
      channel: 'ebay',
      connectionId: store.connectionId,
      storeId: store.id,
      externalOrderId: ebayOrder.orderId,
      buyer: { username: ebayOrder.buyer.username },
      shipping,
      financials: {
        subtotal,
        shippingCost: deliveryCost,
        total,
        currency,
      },
      items,
      orderedAt: new Date(ebayOrder.creationDate),
    });

    // Emit event for inventory deduction
    this.eventEmitter.emit('order.new', {
      orderId: order.id,
      storeId: store.id,
      channel: 'ebay',
      total,
    });

    return true;
  }
}
