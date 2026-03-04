/* ─── Phase 4: Channels Service — Multi-Store Webhook Tests ─
 *  Tests resolveStoreFromWebhook and logWebhook with storeId.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ChannelsService } from './channels.service';
import { ChannelConnection } from './entities/channel-connection.entity';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity';
import { ChannelWebhookLog } from './entities/channel-webhook-log.entity';
import { TokenEncryptionService } from './token-encryption.service';
import { EbayAdapter } from './adapters/ebay/ebay.adapter';
import { ShopifyAdapter } from './adapters/shopify/shopify.adapter';
import { AmazonAdapter } from './adapters/amazon/amazon.adapter';
import { WalmartAdapter } from './adapters/walmart/walmart.adapter';

const stubAdapter = () => ({
  publishListing: jest.fn(),
  updateListing: jest.fn(),
  endListing: jest.fn(),
  syncInventory: jest.fn(),
  getRecentOrders: jest.fn(),
  refreshTokens: jest.fn(),
});

describe('ChannelsService — multi-store webhooks', () => {
  let service: ChannelsService;
  let webhookLogRepo: Record<string, jest.Mock>;
  let storeRepoMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    storeRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const connectionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((d: any) => ({ ...d })),
      save: jest.fn((d: any) => Promise.resolve(d)),
      manager: {
        getRepository: jest.fn().mockReturnValue(storeRepoMock),
      },
    };

    const instanceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((d: any) => ({ ...d })),
      save: jest.fn((d: any) => Promise.resolve(d)),
    };

    webhookLogRepo = {
      create: jest.fn((d: any) => ({ id: 'wh-log-1', ...d })),
      save: jest.fn((d: any) => Promise.resolve(d)),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: getRepositoryToken(ChannelConnection), useValue: connectionRepo },
        { provide: getRepositoryToken(ListingChannelInstance), useValue: instanceRepo },
        { provide: getRepositoryToken(ChannelWebhookLog), useValue: webhookLogRepo },
        { provide: getQueueToken('channels'), useValue: { add: jest.fn() } },
        { provide: TokenEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn() } },
        { provide: EbayAdapter, useValue: stubAdapter() },
        { provide: ShopifyAdapter, useValue: stubAdapter() },
        { provide: AmazonAdapter, useValue: stubAdapter() },
        { provide: WalmartAdapter, useValue: stubAdapter() },
      ],
    }).compile();

    service = module.get(ChannelsService);
  });

  /* ─── resolveStoreFromWebhook ─── */

  it('resolveStoreFromWebhook returns storeId when store found', async () => {
    storeRepoMock.findOne.mockResolvedValue({ id: 'store-abc' });
    const result = await service.resolveStoreFromWebhook('ebay', 'seller_xyz');
    expect(result).toBe('store-abc');
    expect(storeRepoMock.findOne).toHaveBeenCalledWith({
      where: { channel: 'ebay', externalStoreId: 'seller_xyz' },
    });
  });

  it('resolveStoreFromWebhook returns null when no match', async () => {
    storeRepoMock.findOne.mockResolvedValue(null);
    const result = await service.resolveStoreFromWebhook('shopify', 'unknown-shop.myshopify.com');
    expect(result).toBeNull();
  });

  it('resolveStoreFromWebhook returns null when externalStoreId is undefined', async () => {
    const result = await service.resolveStoreFromWebhook('amazon', undefined);
    expect(result).toBeNull();
    expect(storeRepoMock.findOne).not.toHaveBeenCalled();
  });

  it('resolveStoreFromWebhook returns null when externalStoreId is empty string', async () => {
    const result = await service.resolveStoreFromWebhook('walmart', '');
    expect(result).toBeNull();
  });

  /* ─── logWebhook with storeId ─── */

  it('logWebhook includes storeId in log entry', async () => {
    await service.logWebhook('ebay', 'ITEM_SOLD', { price: 99 }, 'ext-123', 'store-42');
    expect(webhookLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'ebay',
        eventType: 'ITEM_SOLD',
        storeId: 'store-42',
      }),
    );
  });

  it('logWebhook defaults storeId to null when not provided', async () => {
    await service.logWebhook('shopify', 'orders/create', { id: 1 });
    expect(webhookLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'shopify',
        storeId: null,
      }),
    );
  });
});
