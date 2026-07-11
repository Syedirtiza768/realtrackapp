import { BadRequestException } from '@nestjs/common';
import { EbayMultiStoreListingService } from './ebay-multi-store-listing.service.js';

function queryBuilder(count: number) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
  };
}

describe('EbayMultiStoreListingService bulk publish', () => {
  function setup(todayCount = 0) {
    const jobRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'job-1' })),
    };
    const targetRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (values) =>
        values.map((value: Record<string, unknown>, index: number) => ({
          ...value,
          id: `target-${index + 1}`,
        })),
      ),
      createQueryBuilder: jest.fn(() => queryBuilder(todayCount)),
    };
    const accountRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'account-1',
          primaryStoreId: 'store-1',
          primaryStore: { ebayMarketplaceId: 'EBAY_US', config: {} },
        },
        {
          id: 'account-2',
          primaryStoreId: 'store-2',
          primaryStore: { ebayMarketplaceId: 'EBAY_US', config: {} },
        },
      ]),
    };
    const publishResolver = {
      resolve: jest.fn(async (id: string) => ({
        snapshot: { catalogProductId: `catalog-${id}` },
      })),
    };
    const publishQueue = { addBulk: jest.fn().mockResolvedValue([]) };
    const service = new EbayMultiStoreListingService(
      jobRepo as any,
      targetRepo as any,
      accountRepo as any,
      { get: jest.fn((_key, fallback) => fallback) } as any,
      {} as any,
      publishResolver as any,
      publishQueue as any,
    );
    return { service, targetRepo, publishQueue };
  }

  it('creates one durable target per listing and store', async () => {
    const { service, publishQueue } = setup();

    const result = await service.createBulkPublishJob({
      organizationId: 'org-1',
      requestedByUserId: 'user-1',
      listingIds: ['listing-1', 'listing-2'],
      storeIds: ['store-1', 'store-2'],
      idempotencyKey: 'bulk-1',
    });

    expect(result.targetCount).toBe(4);
    expect(result.dailyLimit).toBe(5_000);
    expect(publishQueue.addBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'publish-target',
          opts: expect.objectContaining({ attempts: 4 }),
        }),
      ]),
    );
  });

  it('enforces the 5,000 daily listing/store target quota', async () => {
    const { service } = setup(4_999);

    await expect(
      service.createBulkPublishJob({
        organizationId: 'org-1',
        requestedByUserId: 'user-1',
        listingIds: ['listing-1'],
        storeIds: ['store-1', 'store-2'],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
