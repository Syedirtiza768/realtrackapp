import type { Repository } from 'typeorm';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { AutoRepriceService } from './auto-reprice.service.js';
import type { MasterProduct } from '../listings/entities/master-product.entity.js';
import type { EbayOffer } from '../listings/entities/ebay-offer.entity.js';
import type { CompetitorPrice } from '../listings/entities/competitor-price.entity.js';
import type { MarketSnapshot } from '../listings/entities/market-snapshot.entity.js';
import type { Store } from '../channels/entities/store.entity.js';
import type { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import type { PricingAnalysisPipeline } from '../common/openai/pipelines/pricing-analysis.pipeline.js';

/* ── Helpers ── */

function createRepo<T extends Record<string, unknown>>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn(),
    create: jest.fn((d: Partial<T>) => ({ id: 'new-id', ...d }) as T),
    save: jest.fn((d: T) => Promise.resolve(d)),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  } as unknown as Repository<T>;
}

/* ── Tests ── */

describe('AutoRepriceService', () => {
  let svc: AutoRepriceService;
  let productRepo: ReturnType<typeof createRepo<MasterProduct>>;
  let offerRepo: ReturnType<typeof createRepo<EbayOffer>>;
  let competitorRepo: ReturnType<typeof createRepo<CompetitorPrice>>;
  let snapshotRepo: ReturnType<typeof createRepo<MarketSnapshot>>;
  let storeRepo: ReturnType<typeof createRepo<Store>>;
  let inventoryApi: {
    updateOffer: jest.Mock;
    bulkUpdatePriceQuantity: jest.Mock;
  };
  let pricingPipeline: { suggestPrice: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    productRepo = createRepo<MasterProduct>();
    offerRepo = createRepo<EbayOffer>();
    competitorRepo = createRepo<CompetitorPrice>();
    snapshotRepo = createRepo<MarketSnapshot>();
    storeRepo = createRepo<Store>();
    inventoryApi = {
      updateOffer: jest.fn().mockResolvedValue(undefined),
      bulkUpdatePriceQuantity: jest.fn(),
    };
    pricingPipeline = { suggestPrice: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    svc = new AutoRepriceService(
      productRepo,
      offerRepo,
      competitorRepo,
      snapshotRepo,
      storeRepo,
      inventoryApi as unknown as EbayInventoryApiService,
      pricingPipeline as unknown as PricingAnalysisPipeline,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  describe('getSuggestion', () => {
    it('returns pricing suggestion from pipeline', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'prod-1',
        title: 'Brake Pad',
        mpn: 'BP-123',
        brand: 'TRW',
        condition: 'Used',
        costPrice: 10,
        retailPrice: 50,
        mapPrice: 25,
      });

      const mockSuggestion = {
        suggestedPrice: 39.99,
        confidence: 0.85,
        pricingStrategy: 'competitive',
        reasoning: 'Market analysis',
      };
      pricingPipeline.suggestPrice.mockResolvedValue(mockSuggestion);

      const result = await svc.getSuggestion('prod-1');
      expect(result).toEqual(mockSuggestion);
      expect(pricingPipeline.suggestPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          productTitle: 'Brake Pad',
          partNumber: 'BP-123',
          brand: 'TRW',
          costPrice: 10,
          retailPrice: 50,
          mapPrice: 25,
        }),
      );
    });

    it('builds market summary from competitor data when no snapshot', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'prod-1',
        title: 'Part',
        mpn: 'MPN-1',
        brand: 'Brand',
        condition: 'New',
      });

      competitorRepo.createQueryBuilder = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { price: 30, seller: 'A', condition: 'New', title: 'Part A' },
          { price: 40, seller: 'B', condition: 'New', title: 'Part B' },
        ]),
      }));
      snapshotRepo.findOne = jest.fn().mockResolvedValue(null);

      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 35,
        confidence: 0.8,
      });
      await svc.getSuggestion('prod-1');

      expect(pricingPipeline.suggestPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          marketSummary: expect.objectContaining({
            totalListings: 2,
            avgPrice: 35,
            minPrice: 30,
            maxPrice: 40,
          }),
        }),
      );
    });

    it('uses snapshot stats when available', async () => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'prod-1',
        title: 'Part',
        mpn: 'MPN-1',
        brand: 'Brand',
        condition: 'New',
      });
      snapshotRepo.findOne = jest.fn().mockResolvedValue({
        totalListings: 100,
        avgPrice: 45.5,
        medianPrice: 42,
        minPrice: 20,
        maxPrice: 80,
      });

      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 40,
        confidence: 0.9,
      });
      await svc.getSuggestion('prod-1');

      expect(pricingPipeline.suggestPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          marketSummary: expect.objectContaining({
            totalListings: 100,
            avgPrice: 45.5,
            medianPrice: 42,
          }),
        }),
      );
    });
  });

  describe('repriceProduct', () => {
    beforeEach(() => {
      productRepo.findOneByOrFail = jest.fn().mockResolvedValue({
        id: 'prod-1',
        title: 'Part',
        mpn: 'MPN-1',
        brand: 'Brand',
        condition: 'New',
        costPrice: 10,
      });
      competitorRepo.createQueryBuilder = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }));
      snapshotRepo.findOne = jest.fn().mockResolvedValue(null);
    });

    it('skips when confidence below 0.7 threshold', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 39.99,
        confidence: 0.5,
        pricingStrategy: 'value',
      });

      const { suggestion, results } = await svc.repriceProduct('prod-1');
      expect(results).toHaveLength(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pricing.review_needed',
        expect.any(Object),
      );
    });

    it('applies price when confidence >= 0.7', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 39.99,
        confidence: 0.85,
        pricingStrategy: 'competitive',
      });

      offerRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'offer-1',
          storeId: 'store-1',
          ebayOfferId: 'ebay-offer-1',
          price: 49.99,
        },
      ]);
      storeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'store-1', storeName: 'My Store' });

      const { results } = await svc.repriceProduct('prod-1');
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('repriced');
      expect(inventoryApi.updateOffer).toHaveBeenCalledWith(
        'store-1',
        'ebay-offer-1',
        expect.any(Object),
      );
      expect(offerRepo.update).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({ price: 39.99 }),
      );
    });

    it('skips unchanged prices (< $0.01 diff)', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 49.995,
        confidence: 0.9,
        pricingStrategy: 'match',
      });

      offerRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'offer-1',
          storeId: 'store-1',
          ebayOfferId: 'ebay-offer-1',
          price: 49.99,
        },
      ]);
      storeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'store-1', storeName: 'My Store' });

      const { results } = await svc.repriceProduct('prod-1');
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('unchanged');
      expect(inventoryApi.updateOffer).not.toHaveBeenCalled();
    });

    it('emits pricing.repriced audit event', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 39.99,
        confidence: 0.85,
        pricingStrategy: 'competitive',
      });

      offerRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'offer-1',
          storeId: 'store-1',
          ebayOfferId: 'ebay-offer-1',
          price: 49.99,
        },
      ]);
      storeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'store-1', storeName: 'My Store' });

      await svc.repriceProduct('prod-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'pricing.repriced',
        expect.objectContaining({
          productId: 'prod-1',
          results: expect.any(Array),
        }),
      );
    });

    it('forces apply with forceApply flag even below threshold', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 39.99,
        confidence: 0.4,
        pricingStrategy: 'value',
      });

      offerRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'offer-1',
          storeId: 'store-1',
          ebayOfferId: 'ebay-offer-1',
          price: 49.99,
        },
      ]);
      storeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'store-1', storeName: 'My Store' });

      const { results } = await svc.repriceProduct('prod-1', {
        forceApply: true,
      });
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('repriced');
    });

    it('handles API errors gracefully per-offer', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 39.99,
        confidence: 0.85,
        pricingStrategy: 'competitive',
      });

      offerRepo.find = jest.fn().mockResolvedValue([
        {
          id: 'offer-1',
          storeId: 'store-1',
          ebayOfferId: 'ebay-offer-1',
          price: 49.99,
        },
        {
          id: 'offer-2',
          storeId: 'store-2',
          ebayOfferId: 'ebay-offer-2',
          price: 55.0,
        },
      ]);
      storeRepo.findOneBy = jest
        .fn()
        .mockResolvedValueOnce({ id: 'store-1', storeName: 'Store A' })
        .mockResolvedValueOnce({ id: 'store-2', storeName: 'Store B' });
      inventoryApi.updateOffer = jest
        .fn()
        .mockResolvedValueOnce(undefined) // first succeeds
        .mockRejectedValueOnce(new Error('API timeout')); // second fails

      const { results } = await svc.repriceProduct('prod-1');
      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('repriced');
      expect(results[1].action).toBe('error');
      expect(results[1].error).toContain('API timeout');
    });

    it('filters by storeIds when provided', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 39.99,
        confidence: 0.85,
        pricingStrategy: 'competitive',
      });

      offerRepo.find = jest.fn().mockResolvedValue([]);
      storeRepo.findOneBy = jest.fn().mockResolvedValue(null);

      await svc.repriceProduct('prod-1', { storeIds: ['store-1'] });
      expect(offerRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({ storeId: expect.any(Object) }),
      });
    });

    it('handles empty offers list', async () => {
      pricingPipeline.suggestPrice.mockResolvedValue({
        suggestedPrice: 39.99,
        confidence: 0.85,
        pricingStrategy: 'competitive',
      });
      offerRepo.find = jest.fn().mockResolvedValue([]);

      const { results } = await svc.repriceProduct('prod-1');
      expect(results).toHaveLength(0);
    });
  });
});
