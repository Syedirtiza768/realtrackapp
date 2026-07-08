import type { Queue } from 'bullmq';
import type { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { InventoryRealtimeSyncService } from './inventory-realtime-sync.service.js';

/* ── Helpers ── */

function mockQueue() {
  return { add: jest.fn().mockResolvedValue({}), remove: jest.fn() };
}

function mockFeatureFlags(enabled = true) {
  return { isEnabled: jest.fn().mockResolvedValue(enabled) };
}

/* ── Tests ── */

describe('InventoryRealtimeSyncService', () => {
  let svc: InventoryRealtimeSyncService;
  let queue: ReturnType<typeof mockQueue>;
  let flags: ReturnType<typeof mockFeatureFlags>;

  beforeEach(() => {
    queue = mockQueue();
    flags = mockFeatureFlags(true);
    svc = new InventoryRealtimeSyncService(
      queue as unknown as Queue,
      flags as unknown as FeatureFlagService,
    );
  });

  describe('handleInventoryChange', () => {
    it('enqueues reconcile job with correct payload', async () => {
      await svc.handleInventoryChange({
        channel: 'ebay',
        externalId: 'item-123',
        sku: 'SKU-001',
        quantityAvailable: 5,
        source: 'webhook',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.objectContaining({
          trigger: 'webhook',
          channel: 'ebay',
          externalId: 'item-123',
          sku: 'SKU-001',
          quantityAvailable: 5,
        }),
        expect.objectContaining({
          delay: 2000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      );
    });

    it('skips when feature flag disabled', async () => {
      flags.isEnabled = jest.fn().mockResolvedValue(false);
      svc = new InventoryRealtimeSyncService(
        queue as unknown as Queue,
        flags as unknown as FeatureFlagService,
      );

      await svc.handleInventoryChange({
        channel: 'ebay',
        externalId: 'item-123',
        source: 'webhook',
      });

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('uses 2s delay for debounce', async () => {
      await svc.handleInventoryChange({
        channel: 'ebay',
        externalId: 'item-123',
        source: 'webhook',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.any(Object),
        expect.objectContaining({ delay: 2000 }),
      );
    });

    it('job ID includes channel and externalId', async () => {
      await svc.handleInventoryChange({
        channel: 'shopify',
        externalId: 'prod-456',
        source: 'webhook',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.any(Object),
        expect.objectContaining({
          jobId: expect.stringContaining('webhook-inv-shopify-prod-456'),
        }),
      );
    });
  });

  describe('handleOrderCreated', () => {
    it('enqueues reconcile with trigger=order_created', async () => {
      await svc.handleOrderCreated({
        orderId: 'order-1',
        channel: 'ebay',
        total: '99.99',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.objectContaining({
          trigger: 'order_created',
          channel: 'ebay',
          orderId: 'order-1',
        }),
        expect.any(Object),
      );
    });

    it('skips when feature flag disabled', async () => {
      flags.isEnabled = jest.fn().mockResolvedValue(false);
      svc = new InventoryRealtimeSyncService(
        queue as unknown as Queue,
        flags as unknown as FeatureFlagService,
      );

      await svc.handleOrderCreated({
        orderId: 'order-1',
        channel: 'ebay',
        total: '99.99',
      });
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('processEbayInventoryWebhook', () => {
    it('extracts itemId and availableQuantity from notification', async () => {
      await svc.processEbayInventoryWebhook({
        metadata: { topic: 'INVENTORY.ITEM' },
        notification: { itemId: 'ebay-item-1', availableQuantity: 10 },
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.objectContaining({
          channel: 'ebay',
          externalId: 'ebay-item-1',
          quantityAvailable: 10,
        }),
        expect.any(Object),
      );
    });

    it('ignores non-inventory topics', async () => {
      await svc.processEbayInventoryWebhook({
        metadata: { topic: 'ORDER.PAID' },
        notification: { itemId: 'item-1' },
      });

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('ignores missing notification', async () => {
      await svc.processEbayInventoryWebhook({
        metadata: { topic: 'INVENTORY.ITEM' },
      });

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('processShopifyInventoryWebhook', () => {
    it('extracts inventory_item_id and available', async () => {
      await svc.processShopifyInventoryWebhook('inventory_items/update', {
        inventory_item_id: 'inv-789',
        sku: 'SHOP-SKU-1',
        available: 3,
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.objectContaining({
          channel: 'shopify',
          externalId: 'inv-789',
          sku: 'SHOP-SKU-1',
          quantityAvailable: 3,
        }),
        expect.any(Object),
      );
    });

    it('ignores non-inventory topics', async () => {
      await svc.processShopifyInventoryWebhook('orders/create', {
        id: 'order-1',
      });
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('processAmazonInventoryWebhook', () => {
    it('extracts SellerSKU and FulfillableQuantity', async () => {
      await svc.processAmazonInventoryWebhook({
        detail: { SellerSKU: 'AMZ-SKU-1', FulfillableQuantity: 15 },
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.objectContaining({
          channel: 'amazon',
          externalId: 'AMZ-SKU-1',
          sku: 'AMZ-SKU-1',
          quantityAvailable: 15,
        }),
        expect.any(Object),
      );
    });

    it('ignores body without detail', async () => {
      await svc.processAmazonInventoryWebhook({});
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('processWalmartInventoryWebhook', () => {
    it('extracts sku and quantity.amount', async () => {
      await svc.processWalmartInventoryWebhook({
        sku: 'WMT-SKU-1',
        quantity: { amount: 20 },
      });

      expect(queue.add).toHaveBeenCalledWith(
        'reconcile',
        expect.objectContaining({
          channel: 'walmart',
          externalId: 'WMT-SKU-1',
          sku: 'WMT-SKU-1',
          quantityAvailable: 20,
        }),
        expect.any(Object),
      );
    });
  });
});
