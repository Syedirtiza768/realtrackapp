/* ─── Phase 0: Stores Service Regression Tests ─────────────
 *  Baseline tests for multi-store publish flow.
 *  Covers: createStore, publishInstance, publishToMultipleStores,
 *  endInstance, getListingChannelOverview, deleteStore.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { StoresService } from './stores.service';
import { Store } from './entities/store.entity';
import { ListingChannelInstance } from './entities/listing-channel-instance.entity';
import { DemoSimulationLog } from './entities/demo-simulation-log.entity';
import { ChannelConnection } from './entities/channel-connection.entity';
import { ListingRecord } from '../listings/listing-record.entity';

const mockStore = (overrides: Partial<Store> = {}): Store =>
  ({
    id: 'store-1',
    connectionId: 'conn-1',
    channel: 'ebay',
    storeName: 'My eBay Store',
    storeUrl: null,
    externalStoreId: null,
    status: 'active',
    isPrimary: true,
    config: {},
    metricsCache: {},
    listingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Store;

const mockInstance = (overrides: Partial<ListingChannelInstance> = {}): ListingChannelInstance =>
  ({
    id: 'inst-1',
    listingId: 'listing-1',
    connectionId: 'conn-1',
    storeId: 'store-1',
    channel: 'ebay',
    externalId: null,
    externalUrl: null,
    overridePrice: null,
    overrideQuantity: null,
    overrideTitle: null,
    channelSpecificData: {},
    syncStatus: 'draft',
    lastPushedVersion: null,
    lastSyncedAt: null,
    lastError: null,
    retryCount: 0,
    isDemo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    store: mockStore(),
    ...overrides,
  }) as ListingChannelInstance;

describe('StoresService (regression)', () => {
  let service: StoresService;
  let storeRepo: Record<string, jest.Mock>;
  let instanceRepo: Record<string, jest.Mock>;
  let demoLogRepo: Record<string, jest.Mock>;
  let connectionRepo: Record<string, jest.Mock>;
  let listingRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    storeRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ id: 'store-new', ...d })),
      save: jest.fn((d) => Promise.resolve(d)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    };

    instanceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ id: 'inst-new', ...d })),
      save: jest.fn((d) => Promise.resolve(d)),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    demoLogRepo = {
      create: jest.fn((d) => ({ id: 'log-1', ...d })),
      save: jest.fn((d) => Promise.resolve(d)),
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
    };

    connectionRepo = {
      findOneBy: jest.fn(),
    };

    listingRepo = {
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: getRepositoryToken(Store), useValue: storeRepo },
        { provide: getRepositoryToken(ListingChannelInstance), useValue: instanceRepo },
        { provide: getRepositoryToken(DemoSimulationLog), useValue: demoLogRepo },
        { provide: getRepositoryToken(ChannelConnection), useValue: connectionRepo },
        { provide: getRepositoryToken(ListingRecord), useValue: listingRepo },
        { provide: DataSource, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'true' } }, // demo mode
      ],
    }).compile();

    service = module.get(StoresService);
  });

  /* ─── Store CRUD ─── */

  it('getStores returns all stores', async () => {
    storeRepo.find.mockResolvedValue([mockStore()]);
    const result = await service.getStores();
    expect(result).toHaveLength(1);
  });

  it('createStore creates and returns store', async () => {
    connectionRepo.findOneBy.mockResolvedValue({ id: 'conn-1' });
    const result = await service.createStore({
      connectionId: 'conn-1',
      channel: 'ebay',
      storeName: 'New Store',
    });
    expect(storeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'ebay', storeName: 'New Store' }),
    );
  });

  it('createStore throws if connection not found', async () => {
    connectionRepo.findOneBy.mockResolvedValue(null);
    await expect(
      service.createStore({ connectionId: 'bad', channel: 'ebay', storeName: 'X' }),
    ).rejects.toThrow('not found');
  });

  it('deleteStore removes store', async () => {
    storeRepo.delete.mockResolvedValue({ affected: 1 });
    await expect(service.deleteStore('store-1')).resolves.toBeUndefined();
  });

  it('deleteStore throws if not found', async () => {
    storeRepo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.deleteStore('bad')).rejects.toThrow('not found');
  });

  /* ─── Publish Instance ─── */

  it('publishInstance in demo mode sets synced status', async () => {
    const inst = mockInstance({ syncStatus: 'draft' });
    instanceRepo.findOne.mockResolvedValue(inst);
    instanceRepo.save.mockImplementation((d) => Promise.resolve(d));
    instanceRepo.count.mockResolvedValue(1);

    const result = await service.publishInstance('inst-1');
    expect(result.syncStatus).toBe('synced');
    expect(result.isDemo).toBe(true);
    expect(result.externalId).toBeTruthy();
  });

  it('publishInstance rejects already published', async () => {
    const inst = mockInstance({ syncStatus: 'synced' });
    instanceRepo.findOne.mockResolvedValue(inst);
    await expect(service.publishInstance('inst-1')).rejects.toThrow('already published');
  });

  /* ─── publishToMultipleStores ─── */

  it('publishToMultipleStores creates and publishes instances', async () => {
    storeRepo.findOneBy.mockResolvedValue(mockStore());
    listingRepo.findOneBy.mockResolvedValue({ id: 'listing-1' });
    instanceRepo.findOneBy.mockResolvedValue(null); // no existing instance
    instanceRepo.findOne.mockImplementation(async (opts) => {
      // For getInstance in publishInstance
      return mockInstance({ syncStatus: 'draft' });
    });
    instanceRepo.save.mockImplementation((d) => Promise.resolve({ ...d, id: d.id || 'inst-new' }));
    instanceRepo.count.mockResolvedValue(1);

    const result = await service.publishToMultipleStores('listing-1', ['store-1']);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].storeId).toBe('store-1');
  });

  /* ─── endInstance ─── */

  it('endInstance sets ended status', async () => {
    const inst = mockInstance({ syncStatus: 'synced' });
    instanceRepo.findOne.mockResolvedValue(inst);
    instanceRepo.save.mockImplementation((d) => Promise.resolve(d));
    instanceRepo.count.mockResolvedValue(0);

    const result = await service.endInstance('inst-1');
    expect(result.syncStatus).toBe('ended');
  });

  /* ─── getListingChannelOverview ─── */

  it('getListingChannelOverview groups by channel', async () => {
    instanceRepo.find.mockResolvedValue([
      mockInstance({ channel: 'ebay', syncStatus: 'synced' }),
      mockInstance({ id: 'inst-2', channel: 'shopify', storeId: 'store-2', syncStatus: 'pending' }),
    ]);

    const result = await service.getListingChannelOverview('listing-1');
    expect(result.instances).toHaveLength(2);
    expect(result.channelSummary).toHaveLength(2);
  });
});
