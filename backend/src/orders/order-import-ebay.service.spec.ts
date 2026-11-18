import { In, Not } from 'typeorm';
import { EbayOrderImportService } from './order-import-ebay.service';
import type { EbayOrder } from '../channels/ebay/ebay-api.types';

const HOUR = 60 * 60_000;

const ebayOrder = (
  orderId: string,
  creationDate: string,
  overrides: Partial<EbayOrder> = {},
): EbayOrder =>
  ({
    orderId,
    creationDate,
    buyer: { username: 'buyer1' },
    pricingSummary: {
      subtotal: { value: '20.00', currency: 'USD' },
      deliveryCost: { value: '5.00', currency: 'USD' },
      total: { value: '25.00', currency: 'USD' },
    },
    lineItems: [
      {
        lineItemId: `LI-${orderId}`,
        legacyItemId: `ITEM-${orderId}`,
        sku: 'SKU-1',
        title: 'Brake pad',
        quantity: 1,
        lineItemCost: { value: '20.00', currency: 'USD' },
      },
    ],
    ...overrides,
  }) as unknown as EbayOrder;

describe('EbayOrderImportService', () => {
  const store = {
    id: 'store-1',
    storeName: 'Main',
    connectionId: 'conn-1',
    channel: 'ebay',
    status: 'active',
    lastSyncAt: null as Date | null,
  };
  let storeRepo: { find: jest.Mock; findOneBy: jest.Mock; update: jest.Mock };
  let accountRepo: { find: jest.Mock; findOne: jest.Mock };
  let orderRepo: { findOne: jest.Mock };
  let fulfillmentApi: { getOrders: jest.Mock };
  let ordersService: { importOrder: jest.Mock };
  let service: EbayOrderImportService;

  beforeEach(() => {
    store.lastSyncAt = new Date(Date.now() - 2 * HOUR);
    storeRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(() => Promise.resolve({ ...store })),
      update: jest.fn(() => Promise.resolve(undefined)),
    };
    accountRepo = {
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(),
    };
    orderRepo = { findOne: jest.fn(() => Promise.resolve(null)) };
    fulfillmentApi = { getOrders: jest.fn() };
    ordersService = { importOrder: jest.fn(() => Promise.resolve({})) };
    service = new EbayOrderImportService(
      storeRepo as never,
      accountRepo as never,
      orderRepo as never,
      fulfillmentApi as never,
      ordersService as never,
    );
  });

  const savedWatermark = (): Date =>
    (storeRepo.update.mock.calls as Array<[string, { lastSyncAt: Date }]>)[0][1]
      .lastSyncAt;

  it('saves the eBay item number on each line and keeps lineItemId for fulfillment', async () => {
    fulfillmentApi.getOrders.mockResolvedValue({
      orders: [ebayOrder('O1', new Date().toISOString())],
      total: 1,
    });

    await service.importFromStore('store-1');

    expect(ordersService.importOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        externalOrderId: 'O1',
        items: [
          expect.objectContaining({
            externalItemId: 'LI-O1',
            externalListingId: 'ITEM-O1',
            sku: 'SKU-1',
          }),
        ],
      }),
    );
  });

  it('re-reads a little before the watermark so late-appearing orders are not missed', async () => {
    const lastSyncAt = store.lastSyncAt!;
    fulfillmentApi.getOrders.mockResolvedValue({ orders: [], total: 0 });

    await service.importFromStore('store-1');

    const [[, { filter }]] = fulfillmentApi.getOrders.mock.calls as Array<
      [string, { filter: string }]
    >;
    const since = new Date(filter.match(/creationdate:\[(.+)\.\.\]/)![1]);
    expect(since.getTime()).toBe(lastSyncAt.getTime() - 10 * 60_000);
  });

  it('moves the watermark to the run start when every order imports', async () => {
    fulfillmentApi.getOrders.mockResolvedValue({
      orders: [ebayOrder('O1', new Date().toISOString())],
      total: 1,
    });
    const before = Date.now();

    const result = await service.importFromStore('store-1');

    expect(result).toEqual({ storeId: 'store-1', imported: 1, errors: 0 });
    expect(savedWatermark().getTime()).toBeGreaterThanOrEqual(before);
    expect(savedWatermark().getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('holds the watermark at the earliest failed order so the next run retries it', async () => {
    const failedAt = new Date(Date.now() - 90 * 60_000);
    fulfillmentApi.getOrders.mockResolvedValue({
      orders: [
        ebayOrder('OK', new Date(Date.now() - 100 * 60_000).toISOString()),
        ebayOrder('BAD', failedAt.toISOString()),
        ebayOrder('OK2', new Date(Date.now() - 10 * 60_000).toISOString()),
      ],
      total: 3,
    });
    ordersService.importOrder.mockImplementation(
      (d: { externalOrderId: string }) =>
        d.externalOrderId === 'BAD'
          ? Promise.reject(
              new Error('value too long for type character varying(100)'),
            )
          : Promise.resolve({}),
    );

    const result = await service.importFromStore('store-1');

    expect(result).toEqual({ storeId: 'store-1', imported: 2, errors: 1 });
    expect(savedWatermark().getTime()).toBe(failedAt.getTime());
  });

  it('stops holding the watermark for an order that has failed for over 7 days', async () => {
    store.lastSyncAt = new Date(Date.now() - 8 * 24 * HOUR);
    fulfillmentApi.getOrders.mockResolvedValue({
      orders: [
        ebayOrder('BAD', new Date(Date.now() - 8 * 24 * HOUR).toISOString()),
      ],
      total: 1,
    });
    ordersService.importOrder.mockRejectedValue(new Error('boom'));
    const before = Date.now();

    await service.importFromStore('store-1');

    const floor = before - 7 * 24 * HOUR;
    expect(savedWatermark().getTime()).toBeGreaterThanOrEqual(floor);
    expect(savedWatermark().getTime()).toBeLessThanOrEqual(
      Date.now() - 7 * 24 * HOUR + 1000,
    );
  });

  it('does not move the watermark when the eBay call itself fails', async () => {
    fulfillmentApi.getOrders.mockRejectedValue(new Error('eBay 500'));

    await expect(service.importFromStore('store-1')).rejects.toThrow(
      'eBay 500',
    );
    expect(storeRepo.update).not.toHaveBeenCalled();
  });

  it('also polls the primary store of an active connected account whose store is not active', async () => {
    storeRepo.find
      .mockResolvedValueOnce([{ ...store }])
      .mockResolvedValueOnce([
        { ...store, id: 'store-paused', status: 'paused' },
      ]);
    accountRepo.find.mockResolvedValue([
      { primaryStoreId: 'store-1' },
      { primaryStoreId: 'store-paused' },
    ]);
    storeRepo.findOneBy.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ ...store, id }),
    );
    fulfillmentApi.getOrders.mockResolvedValue({ orders: [], total: 0 });

    const results = await service.importFromAllStores();

    expect(accountRepo.find).toHaveBeenCalledWith({
      where: { connectionStatus: 'active' },
    });
    expect(storeRepo.find).toHaveBeenLastCalledWith({
      where: {
        id: In(['store-paused']),
        channel: 'ebay',
        status: Not('archived'),
      },
    });
    expect(results.map((r) => r.storeId)).toEqual(['store-1', 'store-paused']);
  });
});
