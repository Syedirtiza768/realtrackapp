import { PublishedListingsHealthService } from './services/published-listings-health.service.js';
import { PublishedListingsActionService } from './services/published-listings-action.service.js';
import { PublishedListingsService } from './services/published-listings.service.js';

describe('PublishedListingsHealthService', () => {
  const service = new PublishedListingsHealthService();

  it('flags missing images as critical', () => {
    const flags = service.computeHealthFlags({
      title: 'Brake Pad Set Front',
      imageUrls: [],
      itemSpecifics: { Brand: ['TRW'] },
      compatibility: null,
      quantityAvailable: 5,
      quantitySold: 0,
      performanceMetrics: {},
      categoryId: '33567',
    });
    expect(flags.some((f) => f.code === 'missing_images')).toBe(true);
  });

  it('flags low stock', () => {
    const flags = service.computeHealthFlags({
      title: 'Test Part With Long Enough Title Here',
      imageUrls: ['a', 'b', 'c'],
      itemSpecifics: { Brand: ['OEM'] },
      compatibility: null,
      quantityAvailable: 2,
      quantitySold: 0,
      performanceMetrics: {},
      categoryId: '123',
    });
    expect(flags.some((f) => f.code === 'low_stock')).toBe(true);
  });

  it('flags missing description and stale sync', () => {
    const flags = service.computeHealthFlags({
      title: 'Test Part With Long Enough Title Here',
      imageUrls: ['a', 'b', 'c'],
      itemSpecifics: { Brand: ['OEM'] },
      compatibility: { compatibleProducts: [] },
      quantityAvailable: 5,
      quantitySold: 0,
      performanceMetrics: {},
      categoryId: '123',
      description: null,
      lastSyncedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    expect(flags.some((f) => f.code === 'missing_description')).toBe(true);
    expect(flags.some((f) => f.code === 'sync_stale')).toBe(true);
  });

  it('maps published offer status', () => {
    expect(
      service.mapOfferStatus({
        sku: 'x',
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        categoryId: '1',
        pricingSummary: { price: { value: '1', currency: 'USD' } },
        status: 'PUBLISHED',
        listingId: '123',
        availableQuantity: 5,
      }),
    ).toBe('active');
  });

  it('maps out of stock published offer', () => {
    expect(
      service.mapOfferStatus({
        sku: 'x',
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        categoryId: '1',
        pricingSummary: { price: { value: '1', currency: 'USD' } },
        status: 'PUBLISHED',
        listingId: '123',
        availableQuantity: 0,
      }),
    ).toBe('out_of_stock');
  });
});

describe('Primemotive snapshot UUID cursor', () => {
  const nil = '00000000-0000-0000-0000-000000000000';
  function setupCursor() {
    const qb = { andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[{id:'00000000-0000-4000-8000-000000000001'}],2]) };
    const service = new PublishedListingsService({} as never,{} as never,{} as never,{} as never,{} as never,{} as never,
      {getAccessibleStoreIds:()=>Promise.resolve(new Set<string>())} as never,{} as never,{} as never);
    jest.spyOn(service as unknown as {buildListQuery:()=>Promise<typeof qb>},'buildListQuery').mockResolvedValue(qb);
    return {qb,service};
  }
  it('uses stable UUID ordering and returns a continuation instead of an offset', async()=>{
    const {qb,service}=setupCursor();
    const result=await service.list('org',{} as never,{afterId:nil,limit:1},{requirePublishedActiveRecord:true});
    expect(qb.andWhere).toHaveBeenCalledWith('l.id > :afterId',{afterId:nil});
    expect(qb.orderBy).toHaveBeenCalledWith('l.id','ASC');
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(result).toMatchObject({nextId:'00000000-0000-4000-8000-000000000001',hasMore:true});
  });
  it('rejects cursor use on unscoped feeds and mixed offset/sort requests',async()=>{
    const {service}=setupCursor();
    await expect(service.list('org',{} as never,{afterId:nil})).rejects.toThrow('afterId requires');
    await expect(service.list('org',{} as never,{afterId:nil,page:2},{requirePublishedActiveRecord:true})).rejects.toThrow('afterId requires');
  });
});

describe('PublishedListingsActionService offer resolve', () => {
  it('resolves missing offerId from listing channel before price revise', async () => {
    const listing = {
      id: 'pl-1',
      organizationId: 'org-1',
      sku: 'BLA-18699',
      storeId: 'store-1',
      ebayAccountId: 'acct-1',
      // Inventory-API listing: a Trading item ID would deliberately use the Trading revision path.
      ebayItemId: null,
      offerId: null as string | null,
      ebayListingChannelId: 'ch-1',
      currency: 'USD',
      title: 'Part',
      description: null,
      price: '100',
      quantityAvailable: 1,
      imageUrls: [],
      itemSpecifics: {},
      marketplaceId: 'EBAY_MOTORS_US',
    };

    const listingRepo = {
      findOne: jest.fn().mockResolvedValue(listing),
      findOneByOrFail: jest.fn().mockResolvedValue({ ...listing, price: '59' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(),
    };
    const channelRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'ch-1', offerId: 'offer-99' }),
    };
    const inventoryApi = {
      getItem: jest.fn(),
      createOrReplaceItem: jest.fn(),
      updateOffer: jest.fn(),
      bulkUpdatePriceQuantity: jest.fn().mockResolvedValue({}),
      getOffersBySku: jest.fn(),
    };
    const sync = {
      syncListingById: jest.fn().mockResolvedValue(listing),
    };
    const audit = { writeRevision: jest.fn() };
    const actionLog = { write: jest.fn() };

    const svc = new PublishedListingsActionService(
      listingRepo as never,
      channelRepo as never,
      inventoryApi as never,
      {} as never,
      {} as never,
      {} as never,
      audit as never,
      actionLog as never,
      sync as never,
    );

    await svc.revise('pl-1', 'org-1', { id: 'user-1' } as never, {
      price: 59,
    });

    expect(channelRepo.findOne).toHaveBeenCalled();
    expect(listingRepo.update).toHaveBeenCalledWith('pl-1', {
      offerId: 'offer-99',
    });
    expect(inventoryApi.bulkUpdatePriceQuantity).toHaveBeenCalledWith(
      'store-1',
      [
        {
          offers: [
            {
              offerId: 'offer-99',
              price: { value: '59', currency: 'USD' },
            },
          ],
        },
      ],
    );
  });
});
