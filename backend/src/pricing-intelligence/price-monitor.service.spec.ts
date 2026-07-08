import type { Repository } from 'typeorm';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { MasterProduct } from '../listings/entities/master-product.entity.js';
import type { CompetitorPrice } from '../listings/entities/competitor-price.entity.js';
import type { MarketSnapshot } from '../listings/entities/market-snapshot.entity.js';
import type { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import type { CompetitiveAnalysisPipeline } from '../common/openai/pipelines/competitive-analysis.pipeline.js';
import type { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { PriceMonitorService } from './price-monitor.service.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn(),
    create: jest.fn((d: Partial<T>) => ({ id: 'snap-1', ...d }) as T),
    save: jest.fn((d: T) => Promise.resolve({ id: 'saved-1', ...d } as T)),
  } as unknown as Repository<T>;
}

/* ── Tests ── */

describe('PriceMonitorService', () => {
  let svc: PriceMonitorService;
  let productRepo: ReturnType<typeof createRepo<MasterProduct>>;
  let competitorRepo: ReturnType<typeof createRepo<CompetitorPrice>>;
  let snapshotRepo: ReturnType<typeof createRepo<MarketSnapshot>>;
  let browseApi: { getCompetitorPricing: jest.Mock };
  let analysisPipeline: { analyze: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    productRepo = createRepo<MasterProduct>();
    competitorRepo = createRepo<CompetitorPrice>();
    snapshotRepo = createRepo<MarketSnapshot>();
    browseApi = { getCompetitorPricing: jest.fn() };
    analysisPipeline = { analyze: jest.fn() };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };
    eventEmitter = { emit: jest.fn() };

    svc = new PriceMonitorService(
      productRepo,
      competitorRepo,
      snapshotRepo,
      browseApi as unknown as EbayBrowseApiService,
      analysisPipeline as unknown as CompetitiveAnalysisPipeline,
      featureFlags as unknown as FeatureFlagService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('collectAllCompetitorPrices', () => {
    it('skips when feature flag disabled', async () => {
      featureFlags.isEnabled.mockResolvedValue(false);

      const result = await svc.collectAllCompetitorPrices();
      expect(result.processed).toBe(0);
      expect(result.collected).toBe(0);
      expect(browseApi.getCompetitorPricing).not.toHaveBeenCalled();
    });

    it('iterates all published products with MPN', async () => {
      productRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'p-1',
          title: 'Part A',
          brand: 'TRW',
          mpn: 'BP-123',
          condition: 'Used',
        },
      ]);
      browseApi.getCompetitorPricing.mockResolvedValue({
        items: [],
        total: 0,
        avgPrice: null,
        medianPrice: null,
        minPrice: null,
        maxPrice: null,
      });

      const result = await svc.collectAllCompetitorPrices();
      expect(result.processed).toBe(1);
    });
  });

  describe('collectForProduct', () => {
    it('stores competitor prices', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'p-1',
        title: 'Brake Pad',
        brand: 'TRW',
        mpn: 'BP-123',
        retailPrice: 50,
        condition: 'Used',
      });
      browseApi.getCompetitorPricing.mockResolvedValue({
        items: [
          {
            itemId: 'ebay-1',
            title: 'TRW Brake Pad',
            price: { value: '35.00', currency: 'USD' },
            seller: { username: 'seller1' },
            condition: 'Used',
          },
          {
            itemId: 'ebay-2',
            title: 'TRW Brake Pad New',
            price: { value: '42.00', currency: 'USD' },
            seller: { username: 'seller2' },
            condition: 'New',
          },
        ],
        total: 2,
        avgPrice: 38.5,
        medianPrice: 38.5,
        minPrice: 35,
        maxPrice: 42,
      });

      const result = await svc.collectForProduct('p-1');
      expect(result.pricesCollected).toBe(2);
      expect(competitorRepo.save).toHaveBeenCalledTimes(2);
    });

    it('generates AI snapshot when >= 3 prices', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'p-1',
        title: 'Part',
        brand: 'TRW',
        mpn: 'BP-123',
        retailPrice: 50,
        condition: 'Used',
      });
      browseApi.getCompetitorPricing.mockResolvedValue({
        items: [
          {
            itemId: '1',
            price: { value: '30' },
            seller: { username: 'a' },
            condition: 'Used',
          },
          {
            itemId: '2',
            price: { value: '35' },
            seller: { username: 'b' },
            condition: 'Used',
          },
          {
            itemId: '3',
            price: { value: '40' },
            seller: { username: 'c' },
            condition: 'Used',
          },
        ],
        total: 3,
        avgPrice: 35,
        medianPrice: 35,
        minPrice: 30,
        maxPrice: 40,
      });
      analysisPipeline.analyze.mockResolvedValue({
        marketSummary: {
          totalListings: 3,
          avgPrice: 35,
          medianPrice: 35,
          minPrice: 30,
          maxPrice: 40,
        },
        recommendedPricing: { competitive: 32, premium: 45, aggressive: 25 },
        marketInsights: ['Insight 1'],
        confidence: 0.8,
        rawResponse: { estimatedCostUsd: 0.005 },
      });

      const result = await svc.collectForProduct('p-1');
      expect(analysisPipeline.analyze).toHaveBeenCalled();
      expect(result.snapshot).toBeDefined();
    });

    it('stores basic stats when < 3 prices', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'p-1',
        title: 'Part',
        brand: 'TRW',
        mpn: 'BP-123',
        retailPrice: 50,
        condition: 'Used',
      });
      browseApi.getCompetitorPricing.mockResolvedValue({
        items: [
          {
            itemId: '1',
            price: { value: '35' },
            seller: { username: 'a' },
            condition: 'Used',
          },
        ],
        total: 1,
        avgPrice: 35,
        medianPrice: 35,
        minPrice: 35,
        maxPrice: 35,
      });

      const result = await svc.collectForProduct('p-1');
      expect(result.pricesCollected).toBe(1);
      expect(analysisPipeline.analyze).not.toHaveBeenCalled();
      expect(snapshotRepo.save).toHaveBeenCalled();
    });

    it('emits pricing.significant_change on > 15% shift', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'p-1',
        title: 'Part',
        brand: 'TRW',
        mpn: 'BP-123',
        retailPrice: 100,
        condition: 'Used',
      });
      browseApi.getCompetitorPricing.mockResolvedValue({
        items: [
          {
            itemId: '1',
            price: { value: '50' },
            seller: { username: 'a' },
            condition: 'Used',
          },
          {
            itemId: '2',
            price: { value: '55' },
            seller: { username: 'b' },
            condition: 'Used',
          },
          {
            itemId: '3',
            price: { value: '60' },
            seller: { username: 'c' },
            condition: 'Used',
          },
        ],
        total: 3,
        avgPrice: 55,
        medianPrice: 55,
        minPrice: 50,
        maxPrice: 60,
      });
      analysisPipeline.analyze.mockResolvedValue({
        marketSummary: {
          totalListings: 3,
          avgPrice: 55,
          medianPrice: 55,
          minPrice: 50,
          maxPrice: 60,
        },
        recommendedPricing: { competitive: 52, premium: 65, aggressive: 40 },
        marketInsights: [],
        confidence: 0.8,
        rawResponse: { estimatedCostUsd: 0.005 },
      });

      await svc.collectForProduct('p-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pricing.significant_change',
        expect.objectContaining({ productId: 'p-1' }),
      );
    });

    it('handles no MPN gracefully', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'p-1',
        title: 'Part',
        brand: null,
        mpn: null,
        condition: 'Used',
      });

      const result = await svc.collectForProduct('p-1');
      expect(result.pricesCollected).toBe(0);
    });
  });
});
