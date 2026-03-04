/* ─── Phase 0: Inventory Service Regression Tests ───────────
 *  Baseline tests BEFORE multi-store changes.
 *  Ensures adjust, reserve, release, reconcile still work.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryService } from './inventory.service';
import { InventoryLedger } from './entities/inventory-ledger.entity';
import { InventoryEvent } from './entities/inventory-event.entity';
import { StoreInventoryAllocation } from './entities/store-inventory-allocation.entity';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service';

const mockLedger = (overrides: Partial<InventoryLedger> = {}): InventoryLedger =>
  ({
    id: 'led-1',
    listingId: 'listing-1',
    quantityTotal: 50,
    quantityReserved: 5,
    quantityAvailable: 45,
    quantityListedEbay: 0,
    quantityListedShopify: 0,
    lowStockThreshold: 2,
    reorderPoint: 0,
    version: 1,
    lastReconciledAt: null,
    updatedAt: new Date(),
    ...overrides,
  }) as InventoryLedger;

const mockEvent = (overrides: Partial<InventoryEvent> = {}): InventoryEvent =>
  ({
    id: 'evt-1',
    listingId: 'listing-1',
    eventType: 'manual_adjust',
    quantityChange: 10,
    quantityBefore: 40,
    quantityAfter: 50,
    sourceChannel: 'manual',
    idempotencyKey: 'idem-1',
    createdAt: new Date(),
    ...overrides,
  }) as InventoryEvent;

// Helper to create a mock entity manager for transaction tests
function createMockEntityManager(ledger: InventoryLedger, existingEvent: InventoryEvent | null = null) {
  return {
    findOne: jest.fn().mockImplementation((_entity, opts) => {
      if (opts?.where?.idempotencyKey) return Promise.resolve(existingEvent);
      return Promise.resolve(null);
    }),
    findOneBy: jest.fn().mockResolvedValue(ledger),
    findOneByOrFail: jest.fn().mockResolvedValue(ledger),
    createQueryBuilder: jest.fn().mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(ledger),
      getOneOrFail: jest.fn().mockResolvedValue(ledger),
    }),
    create: jest.fn((_entity, data) => ({ id: 'new-id', ...data })),
    save: jest.fn((_entity, data) => Promise.resolve(data)),
  };
}

describe('InventoryService (regression)', () => {
  let service: InventoryService;
  let ledgerRepo: Record<string, jest.Mock>;
  let eventRepo: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;

  beforeEach(async () => {
    ledgerRepo = {
      findOneBy: jest.fn(),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn((d) => Promise.resolve({ id: 'led-new', ...d })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    eventRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getRawOne: jest.fn().mockResolvedValue({ total: '50' }),
      })),
    };

    dataSource = {
      transaction: jest.fn(),
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryLedger), useValue: ledgerRepo },
        { provide: getRepositoryToken(InventoryEvent), useValue: eventRepo },
        { provide: getRepositoryToken(StoreInventoryAllocation), useValue: {
          find: jest.fn().mockResolvedValue([]),
        }},
        { provide: DataSource, useValue: dataSource },
        { provide: FeatureFlagService, useValue: { isEnabled: jest.fn().mockResolvedValue(false) } },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  /* ─── getLedger ─── */

  it('getLedger auto-creates ledger on first access', async () => {
    ledgerRepo.findOneBy.mockResolvedValue(null);
    ledgerRepo.save.mockResolvedValue(mockLedger({ quantityTotal: 0 }));
    const result = await service.getLedger('listing-1');
    expect(result.ledger.quantityTotal).toBe(0);
    expect(ledgerRepo.save).toHaveBeenCalled();
  });

  it('getLedger returns existing ledger + recent events', async () => {
    ledgerRepo.findOneBy.mockResolvedValue(mockLedger());
    eventRepo.find.mockResolvedValue([mockEvent()]);
    const result = await service.getLedger('listing-1');
    expect(result.ledger.quantityTotal).toBe(50);
    expect(result.recentEvents).toHaveLength(1);
  });

  /* ─── adjustQuantity ─── */

  it('adjustQuantity applies positive change', async () => {
    const ledger = mockLedger();
    const em = createMockEntityManager(ledger);
    dataSource.transaction.mockImplementation((_iso, cb) => cb(em));

    const result = await service.adjustQuantity('listing-1', 10, 'restock', 'idem-new');
    expect(em.save).toHaveBeenCalled();
  });

  it('adjustQuantity rejects negative change below zero', async () => {
    const ledger = mockLedger({ quantityTotal: 5, quantityReserved: 3 });
    const em = createMockEntityManager(ledger);
    dataSource.transaction.mockImplementation((_iso, cb) => cb(em));

    await expect(
      service.adjustQuantity('listing-1', -10, 'remove', 'idem-neg'),
    ).rejects.toThrow('Insufficient stock');
  });

  it('adjustQuantity is idempotent', async () => {
    const ledger = mockLedger();
    const existingEvent = mockEvent({ idempotencyKey: 'idem-dup' });
    const em = createMockEntityManager(ledger, existingEvent);
    dataSource.transaction.mockImplementation((_iso, cb) => cb(em));

    const result = await service.adjustQuantity('listing-1', 10, 'dup', 'idem-dup');
    expect(result.event.idempotencyKey).toBe('idem-dup');
  });

  /* ─── reserveQuantity ─── */

  it('reserveQuantity succeeds when stock available', async () => {
    const ledger = mockLedger({ quantityTotal: 50, quantityReserved: 5 });
    const em = createMockEntityManager(ledger);
    dataSource.transaction.mockImplementation((_iso, cb) => cb(em));

    const result = await service.reserveQuantity('listing-1', 10, 'order-1');
    expect(em.save).toHaveBeenCalled();
  });

  it('reserveQuantity rejects when insufficient stock', async () => {
    const ledger = mockLedger({ quantityTotal: 10, quantityReserved: 8 });
    const em = createMockEntityManager(ledger);
    dataSource.transaction.mockImplementation((_iso, cb) => cb(em));

    await expect(
      service.reserveQuantity('listing-1', 5, 'order-2'),
    ).rejects.toThrow('Insufficient available stock');
  });

  /* ─── releaseReservation ─── */

  it('releaseReservation succeeds', async () => {
    const ledger = mockLedger({ quantityReserved: 10 });
    const em = createMockEntityManager(ledger);
    dataSource.transaction.mockImplementation((_iso, cb) => cb(em));

    const result = await service.releaseReservation('listing-1', 5, 'order-1');
    expect(em.save).toHaveBeenCalled();
  });

  it('releaseReservation rejects over-release', async () => {
    const ledger = mockLedger({ quantityReserved: 3 });
    const em = createMockEntityManager(ledger);
    dataSource.transaction.mockImplementation((_iso, cb) => cb(em));

    await expect(
      service.releaseReservation('listing-1', 5, 'order-1'),
    ).rejects.toThrow('exceeds reserved');
  });

  /* ─── getLowStock ─── */

  it('getLowStock returns filtered list', async () => {
    const result = await service.getLowStock(5, 10);
    expect(result).toEqual([]);
  });

  /* ─── getEvents ─── */

  it('getEvents returns paginated events', async () => {
    const result = await service.getEvents('listing-1', undefined, undefined, 20, 0);
    expect(result).toEqual({ events: [], total: 0 });
  });

  /* ─── Multi-Store: getAllocations ─── */

  it('getAllocations returns allocations for a listing', async () => {
    const allocationRepo = (service as any).allocationRepo;
    allocationRepo.find.mockResolvedValue([
      { id: 'alloc-1', listingId: 'listing-1', storeId: 'store-1', allocatedQty: 20, reservedQty: 5 },
      { id: 'alloc-2', listingId: 'listing-1', storeId: 'store-2', allocatedQty: 10, reservedQty: 0 },
    ]);

    const result = await service.getAllocations('listing-1');
    expect(result).toHaveLength(2);
    expect(result[0].storeId).toBe('store-1');
  });

  it('getAllocations filters by storeId when provided', async () => {
    const allocationRepo = (service as any).allocationRepo;
    allocationRepo.find.mockResolvedValue([
      { id: 'alloc-1', listingId: 'listing-1', storeId: 'store-1', allocatedQty: 20, reservedQty: 5 },
    ]);

    const result = await service.getAllocations('listing-1', 'store-1');
    expect(allocationRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ listingId: 'listing-1', storeId: 'store-1' }),
      }),
    );
  });

  /* ─── Multi-Store: allocateToStore ─── */

  it('allocateToStore rejects when feature flag is disabled', async () => {
    // featureFlags.isEnabled already returns false by default
    await expect(
      service.allocateToStore('listing-1', 'store-1', 10),
    ).rejects.toThrow('Per-store inventory is not enabled');
  });

  it('allocateToStore succeeds when flag is enabled and pool has capacity', async () => {
    const featureFlags = (service as any).featureFlags;
    featureFlags.isEnabled.mockResolvedValue(true);

    const ledger = mockLedger({ quantityTotal: 100, quantityReserved: 10 });
    const mockEm = {
      createQueryBuilder: jest.fn().mockImplementation((_entity: any, alias: string) => {
        if (alias === 'l') {
          return {
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(ledger),
          };
        }
        if (alias === 'a') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({ total: '30' }),
          };
        }
      }),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: any, data: any) => ({ id: 'alloc-new', ...data })),
      save: jest.fn((_entity: any, data: any) => Promise.resolve(data)),
    };
    dataSource.transaction.mockImplementation((_iso: any, cb: any) => cb(mockEm));

    const result = await service.allocateToStore('listing-1', 'store-1', 20);
    expect(result.allocatedQty).toBe(20);
    expect(result.storeId).toBe('store-1');
  });

  it('allocateToStore rejects when exceeding pool capacity', async () => {
    const featureFlags = (service as any).featureFlags;
    featureFlags.isEnabled.mockResolvedValue(true);

    const ledger = mockLedger({ quantityTotal: 50, quantityReserved: 5 });
    const mockEm = {
      createQueryBuilder: jest.fn().mockImplementation((_entity: any, alias: string) => {
        if (alias === 'l') {
          return {
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(ledger),
          };
        }
        if (alias === 'a') {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({ total: '40' }),
          };
        }
      }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    dataSource.transaction.mockImplementation((_iso: any, cb: any) => cb(mockEm));

    await expect(
      service.allocateToStore('listing-1', 'store-1', 20),
    ).rejects.toThrow('Cannot allocate');
  });

  /* ─── Multi-Store: reserveFromStore ─── */

  it('reserveFromStore rejects when feature flag is disabled', async () => {
    await expect(
      service.reserveFromStore('listing-1', 'store-1', 5, 'order-1'),
    ).rejects.toThrow('Per-store inventory is not enabled');
  });

  it('reserveFromStore succeeds within allocation', async () => {
    const featureFlags = (service as any).featureFlags;
    featureFlags.isEnabled.mockResolvedValue(true);

    const allocation = {
      id: 'alloc-1',
      listingId: 'listing-1',
      storeId: 'store-1',
      allocatedQty: 20,
      reservedQty: 5,
    };
    const mockEm = {
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(allocation),
      }),
      save: jest.fn((_entity: any, data: any) => Promise.resolve(data)),
    };
    dataSource.transaction.mockImplementation((_iso: any, cb: any) => cb(mockEm));

    const result = await service.reserveFromStore('listing-1', 'store-1', 10, 'order-5');
    expect(result.reservedQty).toBe(15); // 5 + 10
  });

  it('reserveFromStore rejects when exceeding allocation', async () => {
    const featureFlags = (service as any).featureFlags;
    featureFlags.isEnabled.mockResolvedValue(true);

    const allocation = {
      id: 'alloc-1',
      listingId: 'listing-1',
      storeId: 'store-1',
      allocatedQty: 20,
      reservedQty: 18,
    };
    const mockEm = {
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(allocation),
      }),
    };
    dataSource.transaction.mockImplementation((_iso: any, cb: any) => cb(mockEm));

    await expect(
      service.reserveFromStore('listing-1', 'store-1', 5, 'order-6'),
    ).rejects.toThrow('Insufficient store allocation');
  });

  it('reserveFromStore rejects for nonexistent allocation', async () => {
    const featureFlags = (service as any).featureFlags;
    featureFlags.isEnabled.mockResolvedValue(true);

    const mockEm = {
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };
    dataSource.transaction.mockImplementation((_iso: any, cb: any) => cb(mockEm));

    await expect(
      service.reserveFromStore('listing-1', 'store-missing', 1, 'order-7'),
    ).rejects.toThrow('No allocation');
  });
});
