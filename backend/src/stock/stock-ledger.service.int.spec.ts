import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import {
  InsufficientStockException,
  StockLedgerService,
} from './stock-ledger.service.js';
import {
  createStockTestDb,
  seedBasics,
  STOCK_IT_URL,
} from './testing/stock-test-db.js';

const describeIt = STOCK_IT_URL ? describe : describe.skip;

describeIt('StockLedgerService (PostgreSQL integration)', () => {
  let ds: DataSource;
  let close: () => Promise<void>;
  let ledger: StockLedgerService;
  let events: EventEmitter2;

  beforeAll(async () => {
    ({ ds, close } = await createStockTestDb());
    events = new EventEmitter2();
    ledger = new StockLedgerService(ds, events);
  }, 60_000);
  afterAll(async () => close?.());

  const level = async (itemId: string) =>
    (
      await ds.query(
        `SELECT COALESCE(SUM(on_hand),0)::int AS on_hand, COALESCE(SUM(reserved),0)::int AS reserved,
                COALESCE(SUM(available),0)::int AS available, COALESCE(SUM(inbound),0)::int AS inbound
           FROM stock_levels WHERE inventory_item_id = $1`,
        [itemId],
      )
    )[0];

  it('receives stock, writes movements and projects the legacy quantity', async () => {
    const s = await seedBasics(ds);
    const res = await ledger.apply({ organizationId: s.orgId }, [
      { itemId: s.itemId, warehouseId: s.warehouseId, locationId: s.locationId, type: 'receipt', onHand: 5 },
    ]);
    expect(res.movements).toHaveLength(1);
    expect(res.movements[0].onHandAfter).toBe(5);
    expect(await level(s.itemId)).toMatchObject({ on_hand: 5, available: 5 });
    const [cp] = await ds.query(`SELECT quantity FROM catalog_products WHERE id = $1`, [s.catalogProductId]);
    expect(cp.quantity).toBe(5);
  });

  it('rejects changes that would make stock negative or over-reserve', async () => {
    const s = await seedBasics(ds);
    await ledger.apply({ organizationId: s.orgId }, [
      { itemId: s.itemId, warehouseId: s.warehouseId, type: 'receipt', onHand: 1 },
    ]);
    await expect(
      ledger.apply({ organizationId: s.orgId }, [
        { itemId: s.itemId, warehouseId: s.warehouseId, type: 'reserve', reserved: 2 },
      ]),
    ).rejects.toBeInstanceOf(InsufficientStockException);
    await expect(
      ledger.apply({ organizationId: s.orgId }, [
        { itemId: s.itemId, warehouseId: s.warehouseId, type: 'adjustment', onHand: -2 },
      ]),
    ).rejects.toBeInstanceOf(InsufficientStockException);
    expect(await level(s.itemId)).toMatchObject({ on_hand: 1, reserved: 0 });
  });

  it('is idempotent per operation key, including under concurrent replays', async () => {
    const s = await seedBasics(ds);
    const ctx = { organizationId: s.orgId, operationKey: 'receipt:test-1' };
    const cmd = [{ itemId: s.itemId, warehouseId: s.warehouseId, type: 'receipt' as const, onHand: 3 }];
    const results = await Promise.all([
      ledger.apply(ctx, cmd),
      ledger.apply(ctx, cmd),
      ledger.apply(ctx, cmd),
    ]);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await level(s.itemId)).toMatchObject({ on_hand: 3 });
  });

  it('lets exactly one of many concurrent reservations win the last unit', async () => {
    const s = await seedBasics(ds);
    await ledger.apply({ organizationId: s.orgId }, [
      { itemId: s.itemId, warehouseId: s.warehouseId, type: 'receipt', onHand: 1 },
    ]);
    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        ledger.apply({ organizationId: s.orgId, operationKey: `reserve:${i}` }, [
          { itemId: s.itemId, warehouseId: s.warehouseId, type: 'reserve', reserved: 1 },
        ]),
      ),
    );
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    expect(await level(s.itemId)).toMatchObject({ on_hand: 1, reserved: 1, available: 0 });
  });

  it('keeps Σ movements equal to the projection for random sequences', async () => {
    const s = await seedBasics(ds);
    let expectedOnHand = 0;
    for (let i = 0; i < 60; i++) {
      const delta = Math.floor(Math.random() * 7) - 3;
      try {
        await ledger.apply({ organizationId: s.orgId }, [
          { itemId: s.itemId, warehouseId: s.warehouseId, locationId: i % 2 ? s.locationId : null, type: 'adjustment', onHand: delta },
        ]);
        expectedOnHand += delta;
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientStockException);
      }
    }
    const [{ sum }] = await ds.query(
      `SELECT COALESCE(SUM(qty_on_hand),0)::int AS sum FROM stock_movements WHERE inventory_item_id = $1`,
      [s.itemId],
    );
    expect(sum).toBe(expectedOnHand);
    expect((await level(s.itemId)).on_hand).toBe(expectedOnHand);
  });

  it('marks linked stores dirty in the same transaction', async () => {
    const s = await seedBasics(ds);
    const [{ id: storeId }] = await ds.query(`INSERT INTO stores (organization_id) VALUES ($1) RETURNING id`, [s.orgId]);
    await ds.query(
      `INSERT INTO store_warehouse_links (organization_id, store_id, warehouse_id) VALUES ($1, $2, $3)`,
      [s.orgId, storeId, s.warehouseId],
    );
    await ledger.apply({ organizationId: s.orgId }, [
      { itemId: s.itemId, warehouseId: s.warehouseId, type: 'receipt', onHand: 2 },
    ]);
    const rows = await ds.query(`SELECT dirty FROM channel_stock_sync_state WHERE store_id = $1`, [storeId]);
    expect(rows).toEqual([{ dirty: true }]);
  });

  it('rejects items and warehouses from another organization', async () => {
    const a = await seedBasics(ds);
    const b = await seedBasics(ds);
    await expect(
      ledger.apply({ organizationId: a.orgId }, [
        { itemId: b.itemId, warehouseId: a.warehouseId, type: 'receipt', onHand: 1 },
      ]),
    ).rejects.toThrow(/Unknown inventory item/);
  });

  it('refuses to update or delete ledger rows', async () => {
    const s = await seedBasics(ds);
    await ledger.apply({ organizationId: s.orgId }, [
      { itemId: s.itemId, warehouseId: s.warehouseId, type: 'receipt', onHand: 1 },
    ]);
    await expect(
      ds.query(`UPDATE stock_movements SET qty_on_hand = 99 WHERE inventory_item_id = $1`, [s.itemId]),
    ).rejects.toThrow(/append-only/);
  });
});
