import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayFulfillmentApiService } from '../channels/ebay/ebay-fulfillment-api.service.js';
import { OrdersService } from './orders.service.js';
import { Order } from './entities/order.entity.js';
import type {
  EbayOrder,
  EbayLineItem,
} from '../channels/ebay/ebay-api.types.js';

/** First import for a store looks back this far. */
const FIRST_RUN_WINDOW_MS = 60 * 60_000;
/**
 * Each run re-reads this far behind the watermark: eBay can surface an order a
 * few minutes after its creationDate. Re-reading is safe — import is idempotent.
 */
const LOOKBACK_MS = 10 * 60_000;
/** An order that keeps failing holds the watermark back at most this long. */
const MAX_RETRY_WINDOW_MS = 7 * 24 * 60 * 60_000;

/**
 * EbayOrderImportService — Pulls orders from eBay via Fulfillment API
 * and imports them into the local Order table (idempotent).
 *
 * Phase 4 core service:
 *  - Scheduled import (ORDER_IMPORT_CRON, default every 5 min)
 *  - Manual trigger via controller
 *  - Per-store import with since-date windowing
 *  - New orders trigger 'order.new' (emitted by OrdersService.importOrder) for stock allocation
 */
@Injectable()
export class EbayOrderImportService {
  private readonly logger = new Logger(EbayOrderImportService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly connectedAccountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly fulfillmentApi: EbayFulfillmentApiService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Import orders from every eBay store we should poll (see resolveStoresToPoll).
   * Called by the scheduler (ORDER_IMPORT_CRON, default every 5 minutes).
   */
  async importFromAllStores(): Promise<
    { storeId: string; imported: number; errors: number }[]
  > {
    const stores = await this.resolveStoresToPoll();

    const results: { storeId: string; imported: number; errors: number }[] = [];

    for (const store of stores) {
      try {
        const result = await this.importFromStore(store.id);
        results.push(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to import orders from store ${store.id}: ${msg}`,
        );
        results.push({ storeId: store.id, imported: 0, errors: 1 });
      }
    }

    return results;
  }

  /**
   * Active eBay stores, plus the primary store of every active connected eBay
   * account even when that store row is paused/suspended — sales still happen on
   * eBay and must reach Omni. Archived stores are never polled.
   */
  private async resolveStoresToPoll(): Promise<Store[]> {
    const active = await this.storeRepo.find({
      where: { channel: 'ebay', status: 'active' },
    });
    const known = new Set(active.map((s) => s.id));
    const accounts = await this.connectedAccountRepo.find({
      where: { connectionStatus: 'active' },
    });
    const missing = [
      ...new Set(
        accounts
          .map((a) => a.primaryStoreId)
          .filter((id): id is string => !!id && !known.has(id)),
      ),
    ];
    if (!missing.length) return active;
    const extra = await this.storeRepo.find({
      where: { id: In(missing), channel: 'ebay', status: Not('archived') },
    });
    return [...active, ...extra];
  }

  /**
   * Import orders for an org-scoped connected eBay account (uses bridged primary_store_id).
   */
  async importFromConnectedAccount(
    ebayAccountId: string,
    organizationId: string,
  ): Promise<{ storeId: string; imported: number; errors: number }> {
    const account = await this.connectedAccountRepo.findOne({
      where: { id: ebayAccountId, organizationId },
    });
    if (!account) {
      throw new NotFoundException(
        'eBay account not found for this organization',
      );
    }
    if (account.connectionStatus !== 'active') {
      throw new NotFoundException(
        `eBay account is not active (${account.connectionStatus})`,
      );
    }
    return this.importFromStore(account.primaryStoreId);
  }

  /**
   * Import orders from a specific eBay store since its watermark.
   *
   * stores.last_sync_at is the order-import watermark: every eBay order created
   * before it has been imported. It only moves past an order once that order is
   * saved — a failed order holds it back so the next run retries it.
   */
  async importFromStore(
    storeId: string,
  ): Promise<{ storeId: string; imported: number; errors: number }> {
    const store = await this.storeRepo.findOneBy({ id: storeId });
    if (!store) throw new Error(`Store ${storeId} not found`);

    const runStartedAt = new Date();
    const watermark =
      store.lastSyncAt ??
      new Date(runStartedAt.getTime() - FIRST_RUN_WINDOW_MS);
    const since = new Date(watermark.getTime() - LOOKBACK_MS);

    this.logger.log(
      `Importing eBay orders for store ${store.storeName} since ${since.toISOString()}`,
    );

    let imported = 0;
    let errors = 0;
    let earliestFailure: Date | null = null;
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const filter = `creationdate:[${since.toISOString()}..] `;
      const page = await this.fulfillmentApi.getOrders(storeId, {
        filter,
        limit,
        offset,
      });
      const orders = page.orders ?? [];

      for (const ebayOrder of orders) {
        try {
          const wasNew = await this.importSingleOrder(ebayOrder, store);
          if (wasNew) imported++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Failed to import eBay order ${ebayOrder.orderId} for store ${store.storeName} (will retry next run): ${msg}`,
          );
          errors++;
          const createdAt = new Date(ebayOrder.creationDate);
          if (
            !Number.isNaN(createdAt.getTime()) &&
            (!earliestFailure || createdAt < earliestFailure)
          ) {
            earliestFailure = createdAt;
          }
        }
      }

      offset += limit;
      hasMore = orders.length === limit && offset < (page.total ?? 0);
    }

    await this.storeRepo.update(store.id, {
      lastSyncAt: this.nextWatermark(store, runStartedAt, earliestFailure),
    });

    this.logger.log(
      `Store ${store.storeName}: imported ${imported} new orders, ${errors} errors`,
    );

    return { storeId, imported, errors };
  }

  /**
   * Clean run → the run's start time. A failed order → that order's creation
   * time, so the next run fetches it again; capped at MAX_RETRY_WINDOW_MS so
   * one permanently broken order cannot pin the window forever.
   */
  private nextWatermark(
    store: Store,
    runStartedAt: Date,
    earliestFailure: Date | null,
  ): Date {
    if (!earliestFailure) return runStartedAt;
    const floor = new Date(runStartedAt.getTime() - MAX_RETRY_WINDOW_MS);
    if (earliestFailure < floor) {
      this.logger.error(
        `Store ${store.storeName}: giving up retrying eBay orders created before ${floor.toISOString()} — import them manually`,
      );
      return floor;
    }
    return earliestFailure;
  }

  /**
   * Import a single eBay order. Returns true if it was new (not a duplicate).
   */
  private async importSingleOrder(
    ebayOrder: EbayOrder,
    store: Store,
  ): Promise<boolean> {
    // Idempotency: check if already imported
    const existing = await this.orderRepo.findOne({
      where: { channel: 'ebay', externalOrderId: ebayOrder.orderId },
    });
    if (existing) return false;

    // Extract shipping from fulfillmentStartInstructions
    const shipTo =
      ebayOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
    const contactAddress = shipTo?.contactAddress as
      | Record<string, string>
      | undefined;
    const fullName = shipTo?.fullName as string | undefined;

    const shipping: Record<string, string> = {};
    if (fullName) shipping.name = fullName;
    if (contactAddress) {
      if (contactAddress.addressLine1)
        shipping.address1 = contactAddress.addressLine1;
      if (contactAddress.addressLine2)
        shipping.address2 = contactAddress.addressLine2;
      if (contactAddress.city) shipping.city = contactAddress.city;
      if (contactAddress.stateOrProvince)
        shipping.state = contactAddress.stateOrProvince;
      if (contactAddress.postalCode) shipping.zip = contactAddress.postalCode;
      if (contactAddress.countryCode)
        shipping.country = contactAddress.countryCode;
    }

    // Map line items
    const items = ebayOrder.lineItems.map((li: EbayLineItem) => ({
      // lineItemId is what shipping fulfillment sends back to eBay.
      externalItemId: li.lineItemId,
      // eBay item number — joins to ebay_published_listings.ebay_item_id.
      externalListingId: li.legacyItemId ?? undefined,
      sku: li.sku ?? undefined,
      title: li.title,
      quantity: li.quantity,
      unitPrice: li.lineItemCost.value,
    }));

    // Calculate financials
    const subtotal =
      ebayOrder.pricingSummary.subtotal?.value ??
      ebayOrder.pricingSummary.total.value;
    const deliveryCost = ebayOrder.pricingSummary.deliveryCost?.value ?? '0';
    const total = ebayOrder.pricingSummary.total.value;
    const currency = ebayOrder.pricingSummary.total.currency;

    await this.ordersService.importOrder({
      channel: 'ebay',
      connectionId: store.connectionId,
      storeId: store.id,
      externalOrderId: ebayOrder.orderId,
      buyer: { username: ebayOrder.buyer?.username },
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

    // OrdersService.importOrder emits 'order.new' (stock allocation) for new orders.

    return true;
  }
}
