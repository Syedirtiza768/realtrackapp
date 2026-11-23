import { CrossStoreSaleSyncService } from './cross-store-sale-sync.service';
import {
  isSamePart,
  marketplaceForTradingSite,
  samePartVerdict,
  MAX_TARGETS_PER_SKU,
  planTarget,
  rejectSku,
  tradingAvailable,
} from './cross-store-sale-sync.util';

describe('cross-store sale sync rules', () => {
  it('ends a single-quantity copy and lowers a stocked one', () => {
    expect(planTarget(1, 1)).toEqual({
      action: 'end',
      available: 1,
      remaining: 0,
    });
    expect(planTarget(10, 1)).toEqual({
      action: 'set_quantity',
      available: 10,
      remaining: 9,
    });
    expect(planTarget(2, 3)).toEqual({
      action: 'end',
      available: 2,
      remaining: 0,
    });
  });

  it('leaves a copy with nothing available alone', () => {
    expect(planTarget(0, 1)).toEqual({
      action: 'none',
      reason: 'already_zero',
      available: 0,
    });
  });

  it('rejects missing and too-generic SKUs', () => {
    expect(rejectSku(null)).toBe('no_sku');
    expect(rejectSku('A1')).toBe('sku_too_short');
    expect(rejectSku('BU2-6529')).toBeNull();
  });

  it('computes Trading available as quantity minus sold', () => {
    expect(tradingAvailable(5, 2)).toBe(3);
    expect(tradingAvailable(1, 1)).toBe(0);
    expect(tradingAvailable(null, null)).toBe(0);
  });
});

type Target = {
  id: string;
  store_id: string;
  store_name: string;
  ebay_account_id: string;
  marketplace_id: string;
  ebay_item_id: string | null;
  offer_id: string | null;
  title: string | null;
  account_status: string | null;
};

function target(over: Partial<Target>): Target {
  return {
    id: 'pl-x',
    store_id: 'store-b',
    store_name: 'Store B',
    ebay_account_id: 'acct-b',
    marketplace_id: 'EBAY_US',
    ebay_item_id: '200',
    offer_id: null,
    title: '1999-2002 Audi A4 Radio Doble DIN Jaula 8D0858005Q',
    account_status: 'active',
    ...over,
  };
}

function setup(opts: {
  line?: {
    sku: string | null;
    external_listing_id: string | null;
    quantity: number;
    title?: string;
  };
  targets?: Target[];
  live?: Record<
    string,
    { quantity: number; quantitySold: number; listingStatus?: string }
  >;
  alreadyDone?: string[];
  /** Earlier finished pairs as [target_key, target_item_id]. */
  alreadyDoneItems?: Array<[string, string]>;
  /** Active connected stores asked live by SKU (none by default). */
  liveStores?: Array<{ store_id: string; store_name: string }>;
  /** findLiveItemsBySku answer per store id; an Error makes it throw. */
  liveSku?: Record<
    string,
    | Error
    | Array<{
        itemId: string;
        title?: string | null;
        sku: string | null;
        listingStatus?: string;
        site?: string | null;
      }>
  >;
  flags?: Record<string, boolean>;
  pushManagedStores?: string[];
}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const live = { ...(opts.live ?? {}) };
  const db = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('FROM orders WHERE id')) {
        return [
          {
            id: 'order-1',
            channel: 'ebay',
            status: 'paid',
            store_id: 'store-a',
            external_order_id: '12-345',
          },
        ];
      }
      if (sql.includes('FROM order_items WHERE order_id')) {
        return [
          {
            id: 'line-1',
            title: '1999-2002 Audi A4 Double DIN Radio Cage 8D0858005Q',
            ...(opts.line ?? {
              sku: 'BU2-6529',
              external_listing_id: '100',
              quantity: 1,
            }),
          },
        ];
      }
      if (sql.includes('SELECT sku FROM ebay_published_listings'))
        return [{ sku: 'FROM-MIRROR' }];
      if (sql.includes('FROM ebay_published_listings p'))
        return opts.targets ?? [];
      if (sql.includes('SELECT target_key, target_item_id FROM')) {
        return [
          ...(opts.alreadyDone ?? []).map((k) => ({
            target_key: k,
            target_item_id: null,
          })),
          ...(opts.alreadyDoneItems ?? []).map(([k, item]) => ({
            target_key: k,
            target_item_id: item,
          })),
        ];
      }
      if (sql.includes('FROM connected_ebay_accounts a')) {
        return (opts.liveStores ?? []).map((st) => ({
          ...st,
          ebay_account_id: `acct-${st.store_id}`,
          marketplace_id: 'EBAY_US',
        }));
      }
      if (sql.includes('FROM store_stock_policies')) {
        return (opts.pushManagedStores ?? []).map((s) => ({ store_id: s }));
      }
      return [];
    }),
  };
  const flags = {
    isEnabled: jest.fn(
      async (k: string) =>
        (opts.flags ?? { ebay_cross_store_sale_sync: true })[k] ?? false,
    ),
  };
  const trading = {
    getItemDetails: jest.fn(async (_store: string, itemId: string) => {
      const l = live[itemId];
      if (!l) throw new Error(`no live item ${itemId}`);
      return {
        quantity: l.quantity,
        quantitySold: l.quantitySold,
        listingStatus: l.listingStatus ?? 'Active',
      };
    }),
    findLiveItemsBySku: jest.fn(async (storeId: string) => {
      const answer = opts.liveSku?.[storeId] ?? [];
      if (answer instanceof Error) throw answer;
      return answer.map((a) => ({
        title: '1999-2002 Audi A4 Radio Cage 8D0858005Q',
        listingStatus: 'Active',
        site: 'US',
        ...a,
      }));
    }),
    endFixedPriceItem: jest.fn(async () => undefined),
    reviseFixedPriceItem: jest.fn(
      async (_s: string, itemId: string, input: { quantity: number }) => {
        // eBay semantics: Quantity on revise is the listing total (sold + available).
        live[itemId] = { ...live[itemId], quantity: input.quantity };
      },
    ),
  };
  const inventory = {
    getOffer: jest.fn(),
    withdrawOffer: jest.fn(async () => undefined),
    bulkUpdatePriceQuantity: jest.fn(async () => ({
      responses: [{ statusCode: 200 }],
    })),
  };
  const notifications = { create: jest.fn(async () => ({})) };
  const queue = { add: jest.fn(async () => ({})) };
  const service = new CrossStoreSaleSyncService(
    db as never,
    flags as never,
    trading as never,
    inventory as never,
    notifications as never,
    queue as never,
  );
  const recorded = () =>
    queries
      .filter((q) => q.sql.includes('INSERT INTO ebay_cross_store_sale_syncs'))
      .map((q) => ({
        targetKey: q.params[2],
        status: q.params[10],
        action: q.params[9],
        reason: q.params[11],
      }));
  const recordedIds = () =>
    queries
      .filter((q) => q.sql.includes('INSERT INTO ebay_cross_store_sale_syncs'))
      .map((q) => ({
        targetKey: q.params[2],
        targetListingId: q.params[3],
        targetStoreId: q.params[4],
        targetItemId: q.params[5],
      }));
  const mirrorUpdates = () =>
    queries
      .filter((q) => q.sql.includes('UPDATE ebay_published_listings'))
      .map((q) => q.params);
  return {
    service,
    db,
    trading,
    inventory,
    notifications,
    queue,
    recorded,
    recordedIds,
    queries,
    mirrorUpdates,
    live,
  };
}

describe('CrossStoreSaleSyncService', () => {
  it('ends a qty-1 copy on another store and records it', async () => {
    const t = setup({
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
      live: { '200': { quantity: 1, quantitySold: 0 } },
    });
    const results = await t.service.syncOrder('order-1');
    expect(t.trading.endFixedPriceItem).toHaveBeenCalledWith(
      'store-b',
      '200',
      'EBAY_US',
    );
    expect(results).toEqual([
      expect.objectContaining({
        action: 'end',
        status: 'done',
        quantityBefore: 1,
        quantityAfter: 0,
      }),
    ]);
    expect(t.recorded()).toEqual([
      { targetKey: 'pl-b', status: 'done', action: 'end', reason: null },
    ]);
    expect(t.mirrorUpdates()).toEqual([['pl-b', 'ended', 0, '200']]);
  });

  it('excludes the listing that sold from the target query', async () => {
    const t = setup({ targets: [] });
    await t.service.syncOrder('order-1');
    const q = (t.db.query.mock.calls as Array<[string, unknown[]]>).find(
      ([sql]) => sql.includes('FROM ebay_published_listings p'),
    );
    expect(q?.[1]).toEqual(['BU2-6529', '100']);
  });

  it('lowers a stocked copy by the sold quantity using the listing total', async () => {
    const t = setup({
      line: { sku: 'TAB-497', external_listing_id: '100', quantity: 2 },
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
      live: { '200': { quantity: 15, quantitySold: 5 } },
    });
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({
        action: 'set_quantity',
        status: 'done',
        quantityBefore: 10,
        quantityAfter: 8,
      }),
    );
    expect(t.trading.reviseFixedPriceItem).toHaveBeenCalledTimes(1);
    expect(t.trading.reviseFixedPriceItem).toHaveBeenCalledWith(
      'store-b',
      '200',
      { quantity: 13 },
      'EBAY_US',
    );
    expect(t.mirrorUpdates()).toEqual([['pl-b', 'active', 8, '200']]);
  });

  it('corrects the revise when eBay applies the number as the available quantity', async () => {
    const t = setup({
      line: { sku: 'TAB-497', external_listing_id: '100', quantity: 1 },
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
      live: { '200': { quantity: 12, quantitySold: 2 } },
    });
    // This eBay treats Quantity as "available": sold count is kept on top of it.
    t.trading.reviseFixedPriceItem.mockImplementation(
      async (_s: string, id: string, input: { quantity: number }) => {
        t.live[id] = {
          ...t.live[id],
          quantity: input.quantity + t.live[id].quantitySold,
        };
      },
    );
    const [r] = await t.service.syncOrder('order-1');
    expect(r.status).toBe('done');
    expect(t.trading.reviseFixedPriceItem.mock.calls.map((c) => c[2])).toEqual([
      { quantity: 11 },
      { quantity: 9 },
    ]);
    expect(t.live['200'].quantity - t.live['200'].quantitySold).toBe(9);
  });

  it('skips copies already ended on eBay and fixes the mirror', async () => {
    const t = setup({
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
      live: {
        '200': { quantity: 1, quantitySold: 1, listingStatus: 'Completed' },
      },
    });
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({ status: 'skipped', reason: 'already_ended' }),
    );
    expect(t.trading.endFixedPriceItem).not.toHaveBeenCalled();
    expect(t.mirrorUpdates()).toEqual([['pl-b', 'ended', 0, '200']]);
  });

  it('does not repeat pairs already done on an earlier attempt', async () => {
    const t = setup({
      targets: [
        target({ id: 'pl-b', ebay_item_id: '200' }),
        target({ id: 'pl-c', store_id: 'store-c', ebay_item_id: '300' }),
      ],
      live: { '300': { quantity: 1, quantitySold: 0 } },
      alreadyDone: ['pl-b'],
    });
    const results = await t.service.syncOrder('order-1');
    expect(results.map((r) => r.targetListingId)).toEqual(['pl-c']);
    expect(t.trading.getItemDetails).toHaveBeenCalledTimes(1);
  });

  it('withdraws Inventory API offers instead of ending the item', async () => {
    const t = setup({
      targets: [target({ id: 'pl-b', ebay_item_id: '200', offer_id: 'off-1' })],
      live: { '200': { quantity: 1, quantitySold: 0 } },
    });
    await t.service.syncOrder('order-1');
    expect(t.inventory.withdrawOffer).toHaveBeenCalledWith('store-b', 'off-1');
    expect(t.trading.endFixedPriceItem).not.toHaveBeenCalled();
  });

  it('leaves disconnected accounts alone and warns about them', async () => {
    const t = setup({
      targets: [
        target({
          id: 'pl-b',
          ebay_item_id: '200',
          account_status: 'reconnect_required',
        }),
      ],
    });
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({
        status: 'skipped',
        reason: 'account_not_connected',
      }),
    );
    expect(t.trading.getItemDetails).not.toHaveBeenCalled();
    expect(t.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cross_store_sale_sync_disconnected' }),
    );
  });

  it('leaves stores whose stock the StockModule pushes', async () => {
    const t = setup({
      flags: { ebay_cross_store_sale_sync: true, stock_channel_push: true },
      pushManagedStores: ['store-b'],
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
    });
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({
        status: 'skipped',
        reason: 'stock_sync_managed',
      }),
    );
    expect(t.trading.getItemDetails).not.toHaveBeenCalled();
  });

  it('refuses a SKU shared by too many listings', async () => {
    const many = Array.from({ length: MAX_TARGETS_PER_SKU + 1 }, (_, i) =>
      target({ id: `pl-${i}`, ebay_item_id: `${i}` }),
    );
    const t = setup({ targets: many });
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({ status: 'skipped', reason: 'sku_too_common' }),
    );
    expect(t.trading.getItemDetails).not.toHaveBeenCalled();
    expect(t.notifications.create).toHaveBeenCalled();
  });

  it('falls back to the sold listing SKU when the order line has none', async () => {
    const t = setup({
      line: { sku: null, external_listing_id: '100', quantity: 1 },
      targets: [],
    });
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({
        sku: 'FROM-MIRROR',
        reason: 'no_other_listings',
      }),
    );
  });

  it('throws after recording a failed eBay call so the queue retries', async () => {
    const t = setup({
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
      live: { '200': { quantity: 1, quantitySold: 0 } },
    });
    t.trading.endFixedPriceItem.mockRejectedValueOnce(new Error('eBay down'));
    await expect(t.service.syncOrder('order-1')).rejects.toThrow(/eBay down/);
    expect(t.recorded()).toEqual([
      { targetKey: 'pl-b', status: 'failed', action: 'end', reason: null },
    ]);
  });

  it('skips a stale mirror row eBay no longer knows instead of failing', async () => {
    const t = setup({
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
    });
    t.trading.getItemDetails.mockRejectedValueOnce(
      new Error(
        'This item cannot be accessed because the listing has been deleted or you are not the seller.',
      ),
    );
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({
        status: 'skipped',
        reason: 'listing_not_found',
      }),
    );
    expect(t.trading.endFixedPriceItem).not.toHaveBeenCalled();
    expect(t.recorded()).toEqual([
      {
        targetKey: 'pl-b',
        status: 'skipped',
        action: 'none',
        reason: 'listing_not_found',
      },
    ]);
  });

  it('dry run reads eBay but changes and records nothing', async () => {
    const t = setup({
      targets: [target({ id: 'pl-b', ebay_item_id: '200' })],
      live: { '200': { quantity: 1, quantitySold: 0 } },
    });
    const [r] = await t.service.syncOrder('order-1', { dryRun: true });
    expect(r).toEqual(
      expect.objectContaining({ status: 'planned', action: 'end' }),
    );
    expect(t.trading.endFixedPriceItem).not.toHaveBeenCalled();
    expect(t.recorded()).toEqual([]);
    expect(t.mirrorUpdates()).toEqual([]);
  });

  it('only queues eBay orders, and only while the flag is on', async () => {
    const on = setup({});
    await on.service.onOrderNew({ orderId: 'o1', channel: 'ebay' });
    await on.service.onOrderNew({ orderId: 'o2', channel: 'partsbazar360' });
    expect(on.queue.add).toHaveBeenCalledTimes(1);
    expect(on.queue.add).toHaveBeenCalledWith(
      'sync-order',
      { orderId: 'o1' },
      expect.objectContaining({ jobId: 'cross-store-o1' }),
    );

    const off = setup({ flags: {} });
    await off.service.onOrderNew({ orderId: 'o1', channel: 'ebay' });
    expect(off.queue.add).not.toHaveBeenCalled();
  });
});

describe('same-part check (real prod title pairs)', () => {
  const same = (a: string, b: string) => isSamePart(samePartVerdict(a, b));

  it('accepts translated copies of one item', () => {
    expect(
      same(
        'FEBEST HYUNDAI Shaft Assembly, Outer Cv Joint 2214-K2700',
        'FEBEST HYUNDAI Wellenbaugruppe, äußeres CV-Gelenk 2214-K2700',
      ),
    ).toBe(true);
    expect(
      same(
        '2012-2016 Audi A6 A7 Front Right Output Shaft / Stub Shaft Used OEM 0B4409344A',
        'Abtriebswelle / Wellenstummel vorne rechts Audi A6 A7 2012-2016 gebraucht OEM...',
      ),
    ).toBe(true);
    expect(
      same(
        "Levi's Women's Blue Denim Shirt Dress S Long Sleeve Knee Length",
        'Levi&apos;s Damen Blau Jeanshemd Kleid S Langarm Knielang',
      ),
    ).toBe(true);
    expect(
      same(
        "Burberry Men's Shirt | Cotton | Size: Xl",
        'Camicia Burberry | Cotone | Taglia: Xl',
      ),
    ).toBe(true);
    expect(
      same(
        'Hauteur du siège moteur électrique Porsche Cayenne 2008 occasion OEM 95562432100',
        'Altura del asiento del motor eléctrico Porsche Cayenne 2008 usado OEM 9556243...',
      ),
    ).toBe(true);
    expect(
      same(
        '2007-2009 Mercedes-Benz S63 punto ciego radar distronic sensor A0025408417',
        'Mercedes-Benz CL550 W216 2007-2010 Toter Winkel Radar Distronic Sensor...',
      ),
    ).toBe(true);
  });

  it('rejects different items that reuse one SKU label', () => {
    expect(
      samePartVerdict(
        '2011-2016 BMW 520i Glove Box Compartment Black USED OEM 51169205976',
        '2007 Audi Q7 Glove Box Assembly  Used OEM 4L1857104 4L0880330',
      ),
    ).toBe('different_part_number');
    expect(
      samePartVerdict(
        'Cadillac Brougham Wiper Motor , Sun Visors left and right and AC vent',
        '2005-2007 BMW 320i Left and right Headlight',
      ),
    ).toBe('different_make');
    expect(
      samePartVerdict(
        "Brooks Brothers Men's Charcoal Gray Merino Wool Polo Sweater Long Sleeve Size M",
        'Brooks Brothers Men Charcoal Gray Lambswool Button Sweater XL Classic',
      ),
    ).toBe('different_size');
    expect(
      samePartVerdict(
        '2009-2018 Volkswagen Tiguan Park Assist Control Module 3AA919475S OEM Used',
        '2013 Volkswagen Tiguan License Plate Frame Cover Used OEM 5N0807287E9B9',
      ),
    ).toBe('different_part_number');
  });
});

describe('CrossStoreSaleSyncService same-part guard', () => {
  it('never touches a listing that shares the SKU but is a different part', async () => {
    const t = setup({
      line: {
        sku: 'GLB-001',
        external_listing_id: '100',
        quantity: 1,
        title: '2011-2016 BMW 520i Glove Box Compartment USED OEM 51169205976',
      },
      targets: [
        target({
          id: 'pl-b',
          ebay_item_id: '200',
          title: '2007 Audi Q7 Glove Box Assembly Used OEM 4L1857104',
        }),
      ],
      live: { '200': { quantity: 1, quantitySold: 0 } },
    });
    const [r] = await t.service.syncOrder('order-1');
    expect(r).toEqual(
      expect.objectContaining({
        status: 'skipped',
        reason: 'different_part_number',
      }),
    );
    expect(t.trading.getItemDetails).not.toHaveBeenCalled();
    expect(t.trading.endFixedPriceItem).not.toHaveBeenCalled();
  });
});

describe('CrossStoreSaleSyncService live SKU lookup', () => {
  const stores = [
    { store_id: 'store-a', store_name: 'Store A' },
    { store_id: 'store-c', store_name: 'Store C' },
  ];

  it('ends a live listing the mirror has not synced yet', async () => {
    const t = setup({
      targets: [],
      liveStores: stores,
      liveSku: {
        // The sold listing itself comes back too; it is left alone.
        'store-a': [{ itemId: '100', sku: 'BU2-6529' }],
        'store-c': [{ itemId: '206', sku: 'BU2-6529' }],
      },
      live: { '206': { quantity: 1, quantitySold: 0 } },
    });
    const results = await t.service.syncOrder('order-1');
    expect(t.trading.findLiveItemsBySku).toHaveBeenCalledWith(
      'store-c',
      'BU2-6529',
      'EBAY_US',
    );
    expect(t.trading.endFixedPriceItem).toHaveBeenCalledTimes(1);
    expect(t.trading.endFixedPriceItem).toHaveBeenCalledWith(
      'store-c',
      '206',
      'EBAY_US',
    );
    expect(results).toEqual([
      expect.objectContaining({
        targetListingId: null,
        targetStoreName: 'Store C',
        targetItemId: '206',
        action: 'end',
        status: 'done',
      }),
    ]);
    expect(t.recordedIds()).toEqual([
      {
        targetKey: 'item:206',
        targetListingId: null,
        targetStoreId: 'store-c',
        targetItemId: '206',
      },
    ]);
    // Mirror row by item number only: no mirror id for a live-only find.
    expect(t.mirrorUpdates()).toEqual([[null, 'ended', 0, '206']]);
  });

  it('does not act twice on a listing the mirror already has', async () => {
    const t = setup({
      targets: [
        target({ id: 'pl-b', store_id: 'store-c', ebay_item_id: '206' }),
      ],
      liveStores: stores,
      liveSku: { 'store-c': [{ itemId: '206', sku: 'BU2-6529' }] },
      live: { '206': { quantity: 1, quantitySold: 0 } },
    });
    await t.service.syncOrder('order-1');
    expect(t.trading.endFixedPriceItem).toHaveBeenCalledTimes(1);
    expect(t.recorded().map((r) => r.targetKey)).toEqual(['pl-b']);
  });

  it('ignores other SKUs and listings that are not live', async () => {
    const t = setup({
      targets: [],
      liveStores: stores,
      liveSku: {
        'store-c': [
          { itemId: '301', sku: 'BU2-6529-B' },
          { itemId: '302', sku: 'BU2-6529', listingStatus: 'Completed' },
        ],
      },
    });
    const results = await t.service.syncOrder('order-1');
    expect(results).toEqual([
      expect.objectContaining({
        status: 'skipped',
        reason: 'no_other_listings',
      }),
    ]);
    expect(t.trading.getItemDetails).not.toHaveBeenCalled();
  });

  it('skips a listing already handled for this sale under another key', async () => {
    const t = setup({
      targets: [
        target({ id: 'pl-new', store_id: 'store-c', ebay_item_id: '206' }),
      ],
      alreadyDoneItems: [['item:206', '206']],
      live: { '206': { quantity: 1, quantitySold: 0 } },
    });
    const results = await t.service.syncOrder('order-1');
    expect(results).toEqual([]);
    expect(t.trading.getItemDetails).not.toHaveBeenCalled();
  });

  it('still syncs the other stores when one lookup fails, then retries', async () => {
    const t = setup({
      targets: [],
      liveStores: stores,
      liveSku: {
        'store-a': new Error('eBay timeout'),
        'store-c': [{ itemId: '206', sku: 'BU2-6529' }],
      },
      live: { '206': { quantity: 1, quantitySold: 0 } },
    });
    await expect(t.service.syncOrder('order-1')).rejects.toThrow(
      /failed for 1 listing/,
    );
    expect(t.trading.endFixedPriceItem).toHaveBeenCalledWith(
      'store-c',
      '206',
      'EBAY_US',
    );
    expect(t.recorded()).toEqual([
      {
        targetKey: 'lookup:store-a',
        status: 'failed',
        action: 'none',
        reason: 'live_lookup_failed',
      },
      { targetKey: 'item:206', status: 'done', action: 'end', reason: null },
    ]);
  });

  it('can be switched off with CROSS_STORE_SALE_SYNC_LIVE_LOOKUP=0', async () => {
    process.env.CROSS_STORE_SALE_SYNC_LIVE_LOOKUP = '0';
    try {
      const t = setup({
        targets: [],
        liveStores: stores,
        liveSku: { 'store-c': [{ itemId: '206', sku: 'BU2-6529' }] },
      });
      await t.service.syncOrder('order-1');
      expect(t.trading.findLiveItemsBySku).not.toHaveBeenCalled();
    } finally {
      delete process.env.CROSS_STORE_SALE_SYNC_LIVE_LOOKUP;
    }
  });

  it('maps Trading sites to marketplaces', () => {
    expect(marketplaceForTradingSite('US')).toBe('EBAY_US');
    expect(marketplaceForTradingSite('Germany')).toBe('EBAY_DE');
    expect(marketplaceForTradingSite('UK')).toBe('EBAY_GB');
    expect(marketplaceForTradingSite(null)).toBeNull();
  });
});
