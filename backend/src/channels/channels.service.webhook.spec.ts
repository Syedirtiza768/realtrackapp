/* ─── Phase 4: Channels Service — Multi-Store Webhook Tests ─
 *  Tests resolveStoreFromWebhook and logWebhook with storeId.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelsService } from './channels.service';
import { ChannelConnection } from './entities/channel-connection.entity';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity';
import { ChannelWebhookLog } from './entities/channel-webhook-log.entity';
import { Store } from './entities/store.entity';
import { TokenEncryptionService } from './token-encryption.service';
import { EbayAdapter } from './adapters/ebay/ebay.adapter';
import { PartsBazar360Service } from './partsbazar360/partsbazar360.service';

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
  let connectionRepoMock: Record<string, jest.Mock>;
  let instanceRepoMock: Record<string, jest.Mock>;
  let queueMock: { add: jest.Mock };
  let partsbazar: Record<string, jest.Mock>;

  beforeEach(async () => {
    storeRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const connectionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
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

    connectionRepoMock = connectionRepo as unknown as Record<string, jest.Mock>;
    instanceRepoMock = instanceRepo as unknown as Record<string, jest.Mock>;
    queueMock = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    partsbazar = {
      end: jest.fn().mockResolvedValue({ success: true }),
      testConnection: jest.fn().mockResolvedValue({ ok: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        {
          provide: getRepositoryToken(ChannelConnection),
          useValue: connectionRepo,
        },
        {
          provide: getRepositoryToken(ListingChannelInstance),
          useValue: instanceRepo,
        },
        {
          provide: getRepositoryToken(ChannelWebhookLog),
          useValue: webhookLogRepo,
        },
        { provide: getRepositoryToken(Store), useValue: storeRepoMock },
        { provide: getQueueToken('channels'), useValue: queueMock },
        {
          provide: TokenEncryptionService,
          useValue: { encrypt: jest.fn(), decrypt: jest.fn() },
        },
        { provide: EbayAdapter, useValue: stubAdapter() },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('true') },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: PartsBazar360Service, useValue: partsbazar },
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
    const result = await service.resolveStoreFromWebhook(
      'shopify',
      'unknown-shop.myshopify.com',
    );
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
    await service.logWebhook(
      'ebay',
      'ITEM_SOLD',
      { price: 99 },
      'ext-123',
      'store-42',
    );
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

  /* ─── PartsBazar360 push channel ─── */

  describe('PartsBazar360 channel', () => {
    const pbConnection = { id: 'conn-pb', channel: 'partsbazar360', status: 'active' };
    const pbStore = { id: 'store-pb', connectionId: 'conn-pb', channel: 'partsbazar360' };

    it('publishMulti targets the requested store, not the latest connection', async () => {
      storeRepoMock.findOne.mockResolvedValue(pbStore);
      connectionRepoMock.findOne.mockResolvedValue(pbConnection);
      instanceRepoMock.findOne.mockResolvedValue(null);

      const result = await service.publishMulti(
        'listing-1',
        ['partsbazar360'],
        undefined,
        'store-pb',
      );

      expect(storeRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'store-pb', channel: 'partsbazar360' },
      });
      expect(connectionRepoMock.findOne).toHaveBeenCalledWith({
        where: { id: 'conn-pb', status: 'active' },
      });
      expect(queueMock.add).toHaveBeenCalledWith(
        'publish',
        expect.objectContaining({ connectionId: 'conn-pb', storeId: 'store-pb' }),
        expect.any(Object),
      );
      expect(instanceRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: 'store-pb', channel: 'partsbazar360' }),
      );
      expect(result.results).toEqual([{ channel: 'partsbazar360', jobId: 'job-1' }]);
    });

    it('publishMulti refuses a store that belongs to another channel', async () => {
      storeRepoMock.findOne.mockResolvedValue(null);
      const result = await service.publishMulti(
        'listing-1',
        ['partsbazar360'],
        undefined,
        'some-ebay-store',
      );
      expect(queueMock.add).not.toHaveBeenCalled();
      expect(result.results[0].error).toMatch(/not a partsbazar360 store/);
    });

    it('endChannelListing takes the listing off PartsBazar360 instead of only flagging it locally', async () => {
      instanceRepoMock.findOne.mockResolvedValue({ id: 'i1', syncStatus: 'synced' });
      await expect(
        service.endChannelListing('listing-1', 'partsbazar360'),
      ).resolves.toEqual({ success: true });
      expect(partsbazar.end).toHaveBeenCalledWith('listing-1');
      expect(instanceRepoMock.save).not.toHaveBeenCalled();
    });

    it('testConnection delegates to a live PartsBazar360 health check', async () => {
      connectionRepoMock.findOneBy.mockResolvedValue(pbConnection);
      await expect(service.testConnection('conn-pb', 'user-1')).resolves.toEqual({
        ok: true,
      });
      expect(partsbazar.testConnection).toHaveBeenCalledWith('conn-pb');
    });

    it('inventory sync is a no-op so placeholder quantities never overwrite real stock', async () => {
      connectionRepoMock.findOneBy.mockResolvedValue(pbConnection);
      await expect(service.syncConnectionInventory('conn-pb')).resolves.toEqual({
        succeeded: 0,
        failed: 0,
      });
      expect(instanceRepoMock.find).not.toHaveBeenCalled();
    });

    it('has no OAuth flow and says how to connect instead', () => {
      expect(() => service.getAuthUrl('partsbazar360', 'state')).toThrow(
        'POST /channels/partsbazar360/connect',
      );
    });
  });
});
