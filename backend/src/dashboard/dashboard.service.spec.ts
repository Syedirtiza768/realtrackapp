/* ─── Phase 0: Dashboard Service Regression Tests ───────────
 *  Baseline tests BEFORE multi-store changes.
 *  Ensures getSummary, getSales, getKpis, getActivity still work.
 * ────────────────────────────────────────────────────────── */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { AuditLog } from './entities/audit-log.entity';
import { DashboardCache } from './entities/dashboard-cache.entity';
import { SalesRecord } from './entities/sales-record.entity';
import { ListingRecord } from '../listings/listing-record.entity';

const createMockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(0),
  create: jest.fn((d: any) => ({ ...d })),
  save: jest.fn((d: any) => Promise.resolve(d)),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ count: '0', revenue: '0', avgPrice: '0' }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
  manager: {
    query: jest.fn().mockResolvedValue([]),
  },
});

describe('DashboardService (regression)', () => {
  let service: DashboardService;
  let auditRepo: ReturnType<typeof createMockRepo>;
  let cacheRepo: ReturnType<typeof createMockRepo>;
  let salesRepo: ReturnType<typeof createMockRepo>;
  let listingRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    auditRepo = createMockRepo();
    cacheRepo = createMockRepo();
    salesRepo = createMockRepo();
    listingRepo = createMockRepo();

    // Sales repo needs manager.query for some dashboard methods
    salesRepo.manager = { query: jest.fn().mockResolvedValue([{ avgDays: '3.5' }]) };
    listingRepo.manager = { query: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: getRepositoryToken(DashboardCache), useValue: cacheRepo },
        { provide: getRepositoryToken(SalesRecord), useValue: salesRepo },
        { provide: getRepositoryToken(ListingRecord), useValue: listingRepo },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  /* ─── getSummary ─── */

  it('getSummary returns computed summary when cache miss', async () => {
    cacheRepo.findOne.mockResolvedValue(null);
    const result = await service.getSummary();
    expect(result).toHaveProperty('totalListings');
    expect(result).toHaveProperty('activeListings');
    expect(result).toHaveProperty('totalSales');
    expect(result).toHaveProperty('revenue');
    expect(result).toHaveProperty('channelBreakdown');
    expect(result).toHaveProperty('computedAt');
  });

  it('getSummary returns cached data when fresh', async () => {
    const cached = {
      metricKey: 'dashboard:summary',
      metricValue: { totalListings: 100, totalSales: 5 },
      computedAt: new Date(), // fresh
    };
    cacheRepo.findOne.mockResolvedValue(cached);
    const result = await service.getSummary();
    expect(result).toEqual({ totalListings: 100, totalSales: 5 });
  });

  /* ─── getSales ─── */

  it('getSales returns structured data', async () => {
    const result = await service.getSales({});
    expect(result).toHaveProperty('salesByDay');
    expect(result).toHaveProperty('salesByChannel');
    expect(result).toHaveProperty('topItems');
  });

  it('getSales accepts channel filter', async () => {
    const result = await service.getSales({ channel: 'ebay' });
    expect(result).toHaveProperty('salesByDay');
  });

  /* ─── getActivity ─── */

  it('getActivity returns paginated logs', async () => {
    const result = await service.getActivity({});
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
  });

  /* ─── getKpis ─── */

  it('getKpis returns key metrics', async () => {
    cacheRepo.findOne.mockResolvedValue(null);
    const result = await service.getKpis();
    expect(result).toHaveProperty('catalogSize');
    expect(result).toHaveProperty('publishedCount');
    expect(result).toHaveProperty('soldCount');
    expect(result).toHaveProperty('avgDaysToSell');
  });

  /* ─── writeAuditLog ─── */

  it('writeAuditLog creates log entry', async () => {
    auditRepo.save.mockResolvedValue({ id: 'log-1' });
    const result = await service.writeAuditLog({
      entityType: 'listing',
      entityId: 'listing-1',
      action: 'published',
    });
    expect(auditRepo.create).toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalled();
  });

  /* ─── getMultiStoreMetrics ─── */

  it('getMultiStoreMetrics returns structured metrics', async () => {
    cacheRepo.findOne.mockResolvedValue(null);
    const result = await service.getMultiStoreMetrics();
    expect(result).toHaveProperty('stores');
    expect(result).toHaveProperty('instances');
    expect(result).toHaveProperty('computedAt');
  });

  /* ─── Multi-Store: getSummary with storeId ─── */

  it('getSummary passes storeId through to cache-key and query', async () => {
    cacheRepo.findOne.mockResolvedValue(null);
    const result = await service.getSummary('store-99');
    // Should still return a valid summary structure
    expect(result).toHaveProperty('totalListings');
    expect(result).toHaveProperty('channelBreakdown');
    // Cache lookup should have been called with the store-scoped key
    expect(cacheRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { metricKey: 'dashboard:summary:store-99' },
      }),
    );
  });

  it('getSummary without storeId uses global cache key', async () => {
    cacheRepo.findOne.mockResolvedValue(null);
    await service.getSummary();
    expect(cacheRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { metricKey: 'dashboard:summary' },
      }),
    );
  });

  /* ─── Multi-Store: getSales with storeId ─── */

  it('getSales accepts storeId filter', async () => {
    const result = await service.getSales({ storeId: 'store-5' });
    expect(result).toHaveProperty('salesByDay');
    expect(result).toHaveProperty('salesByChannel');
    expect(result).toHaveProperty('topItems');
  });
});
