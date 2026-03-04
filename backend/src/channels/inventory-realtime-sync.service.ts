import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';

/**
 * Inventory Real-Time Sync Service — Phase 2.
 *
 * Bridges channel webhooks → inventory queue.
 * Listens for webhook-based stock change events and enqueues
 * inventory reconciliation jobs.
 *
 * Gated by the `inventory_real_time_sync` feature flag.
 */
@Injectable()
export class InventoryRealtimeSyncService {
  private readonly logger = new Logger(InventoryRealtimeSyncService.name);

  constructor(
    @InjectQueue('inventory')
    private readonly inventoryQueue: Queue,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  /**
   * Handle stock change events from any channel webhook.
   * Event shape: { channel, externalId, sku?, quantityAvailable?, source }
   */
  @OnEvent('webhook.inventory_change')
  async handleInventoryChange(payload: {
    channel: string;
    externalId: string;
    sku?: string;
    quantityAvailable?: number;
    source: string;
  }): Promise<void> {
    const enabled = await this.featureFlags.isEnabled('inventory_real_time_sync');
    if (!enabled) {
      this.logger.debug('inventory_real_time_sync flag disabled — skipping');
      return;
    }

    this.logger.log(
      `Inventory change from ${payload.channel}: ${payload.externalId} → qty=${payload.quantityAvailable ?? '?'}`,
    );

    await this.inventoryQueue.add(
      'reconcile',
      {
        trigger: 'webhook',
        channel: payload.channel,
        externalId: payload.externalId,
        sku: payload.sku,
        quantityAvailable: payload.quantityAvailable,
        listingIds: [], // Resolved by the processor from externalId
      },
      {
        jobId: `webhook-inv-${payload.channel}-${payload.externalId}-${Date.now()}`,
        delay: 2000, // 2s debounce to batch rapid changes
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    );
  }

  /**
   * Handle order-based inventory deductions (any channel).
   * Emitted when a new order is imported and stock should be reserved.
   */
  @OnEvent('order.new')
  async handleOrderCreated(payload: {
    orderId: string;
    channel: string;
    total: string;
  }): Promise<void> {
    const enabled = await this.featureFlags.isEnabled('inventory_real_time_sync');
    if (!enabled) return;

    this.logger.log(`New order ${payload.orderId} from ${payload.channel} — enqueuing reconcile`);

    await this.inventoryQueue.add(
      'reconcile',
      {
        trigger: 'order_created',
        channel: payload.channel,
        orderId: payload.orderId,
        listingIds: [], // Resolved by processor from order items
      },
      {
        jobId: `order-inv-${payload.orderId}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    );
  }

  /**
   * Handle eBay-specific inventory webhook payloads.
   * Called directly by the channels controller webhook handler.
   */
  async processEbayInventoryWebhook(body: Record<string, unknown>): Promise<void> {
    const metadata = body['metadata'] as Record<string, unknown> | undefined;
    const notification = body['notification'] as Record<string, unknown> | undefined;

    if (!notification) return;

    const topic = (metadata?.['topic'] as string) ?? '';
    if (!topic.includes('INVENTORY') && !topic.includes('ITEM')) return;

    const itemId = (notification['itemId'] as string) ?? '';
    const quantity = notification['availableQuantity'] as number | undefined;

    if (itemId) {
      await this.handleWebhookPayload('ebay', itemId, undefined, quantity);
    }
  }

  /**
   * Handle Shopify-specific inventory webhook payloads.
   */
  async processShopifyInventoryWebhook(
    topic: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    if (!topic.includes('inventory') && !topic.includes('products')) return;

    const inventoryItemId = body['inventory_item_id'] as string | undefined;
    const sku = body['sku'] as string | undefined;
    const available = body['available'] as number | undefined;
    const externalId = inventoryItemId ?? (body['id'] ? String(body['id']) : '');

    if (externalId) {
      await this.handleWebhookPayload('shopify', externalId, sku, available);
    }
  }

  /**
   * Handle Amazon EventBridge notification payloads.
   */
  async processAmazonInventoryWebhook(body: Record<string, unknown>): Promise<void> {
    const detail = body['detail'] as Record<string, unknown> | undefined;
    if (!detail) return;

    const sku = (detail['SellerSKU'] as string) ?? '';
    const available = detail['FulfillableQuantity'] as number | undefined;

    if (sku) {
      await this.handleWebhookPayload('amazon', sku, sku, available);
    }
  }

  /**
   * Handle Walmart webhook inventory payloads.
   */
  async processWalmartInventoryWebhook(body: Record<string, unknown>): Promise<void> {
    const sku = (body['sku'] as string) ?? '';
    const quantity = body['quantity'] as Record<string, unknown> | undefined;
    const available = quantity?.['amount'] as number | undefined;

    if (sku) {
      await this.handleWebhookPayload('walmart', sku, sku, available);
    }
  }

  /* ─── Common webhook → event bridge ─── */

  private async handleWebhookPayload(
    channel: string,
    externalId: string,
    sku: string | undefined,
    quantityAvailable: number | undefined,
  ): Promise<void> {
    // Emit the standardized event that @OnEvent('webhook.inventory_change') will pick up
    // We call the handler directly to avoid circular event emission
    await this.handleInventoryChange({
      channel,
      externalId,
      sku,
      quantityAvailable,
      source: 'webhook',
    });
  }
}
