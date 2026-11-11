import { createHmac, randomBytes } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import type { User } from '../../auth/entities/user.entity.js';
interface TestDbRow {
  id: string;
  n: number;
  key: string;
  status: string;
  event_type: string;
  listing_status: string;
  quantity_available: number;
  on_hand: number;
  reserved: number;
  available: number;
}
import {
  createStockTestDb,
  seedBasics,
  STOCK_IT_URL,
} from '../../stock/testing/stock-test-db.js';
import { StockAccessService } from '../../stock/stock-access.service.js';
import { StockLedgerService } from '../../stock/stock-ledger.service.js';
import { StockOperationsService } from '../../stock/stock-operations.service.js';
import { ReservationsService } from '../../stock/reservations.service.js';
import { ChannelStockSyncService } from '../../stock/channel-stock-sync.service.js';
import { ChannelWebhookLog } from '../../channels/entities/channel-webhook-log.entity.js';
import { PublishedListingsService } from '../../published-listings/services/published-listings.service.js';
import { PrimemotiveListingChangesService } from '../../published-listings/services/primemotive-listing-changes.service.js';
import { PrimemotiveListingChangeFeed1791400000000 } from '../../migrations/1791400000000-PrimemotiveListingChangeFeed.js';
import { MotoarkOrderLifecycle1791500000000 } from '../../migrations/1791500000000-MotoarkOrderLifecycle.js';
import { PrimemotiveOrderedChanges1791600000000 } from '../../migrations/1791600000000-PrimemotiveOrderedChanges.js';
import { MotoarkOrderEventDto } from './motoark.dto.js';
import { MotoarkStockService } from './motoark-stock.service.js';
import { MotoarkService } from './motoark.service.js';
import { payloadHash, verifyWebhook } from './webhook-signature.js';

const describeDb = STOCK_IT_URL ? describe : describe.skip;
jest.setTimeout(120_000);
describeDb('MotoArk lifecycle against PostgreSQL', () => {
  let db: DataSource,
    close: () => Promise<void>,
    ledger: StockLedgerService,
    ops: StockOperationsService;
  let stock: MotoarkStockService,
    service: MotoarkService,
    changes: PrimemotiveListingChangesService;
  const secret = randomBytes(32).toString('hex');
  const oldSecret = process.env.MOTOARK_ORDER_WEBHOOK_SECRET;
  const authority = new Set([
    'motoark.returns.receive',
    'motoark.returns.restock',
  ]);
  let channel: ChannelStockSyncService;
  beforeAll(async () => {
    process.env.MOTOARK_ORDER_WEBHOOK_SECRET = secret;
    ({ ds: db, close } = await createStockTestDb([ChannelWebhookLog]));
    await db.query<
      TestDbRow[]
    >(`CREATE TABLE permissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text UNIQUE,label text,module text,description text);
      CREATE TABLE roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text);
      CREATE TABLE role_permissions("roleId" uuid,"permissionId" uuid,PRIMARY KEY("roleId","permissionId"));
      INSERT INTO roles(slug) VALUES('api_published_listings_reader'),('admin');
      ALTER TABLE orders ADD COLUMN subtotal numeric(10,2) DEFAULT 0, ADD COLUMN shipping_cost numeric(10,2) DEFAULT 0,
        ADD COLUMN tax_amount numeric(10,2) DEFAULT 0, ADD COLUMN total_amount numeric(10,2) DEFAULT 0,
        ADD COLUMN currency varchar(3), ADD COLUMN paid_at timestamptz, ADD COLUMN updated_at timestamptz,
        ADD COLUMN refund_amount numeric(10,2) DEFAULT 0, ADD COLUMN refunded_at timestamptz;
      CREATE UNIQUE INDEX test_order_external ON orders(channel,external_order_id);
      ALTER TABLE order_items ADD COLUMN unit_price numeric(10,2),ADD COLUMN total_price numeric(10,2),ADD COLUMN fulfilled boolean DEFAULT false;
      ALTER TABLE ebay_published_listings ADD COLUMN organization_id uuid,ADD COLUMN title text DEFAULT 'Part',ADD COLUMN description text,
        ADD COLUMN price numeric(10,2) DEFAULT 10,ADD COLUMN currency text DEFAULT 'USD',ADD COLUMN quantity_sold int DEFAULT 0,
        ADD COLUMN listing_format text,ADD COLUMN condition text,ADD COLUMN category_id text,ADD COLUMN category_name text,
        ADD COLUMN listing_url text,ADD COLUMN image_urls jsonb DEFAULT '[]',ADD COLUMN item_specifics jsonb DEFAULT '{}';
      CREATE TABLE channel_webhook_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),channel varchar(30),event_type varchar(100),external_id varchar(200),payload jsonb,
        processing_status varchar(20),processing_error text,processed_at timestamptz,created_at timestamptz DEFAULT now());`);
    const qr = db.createQueryRunner();
    await new PrimemotiveListingChangeFeed1791400000000().up(qr);
    await new MotoarkOrderLifecycle1791500000000().up(qr);
    await new PrimemotiveOrderedChanges1791600000000().up(qr);
    await qr.release();
    const events = new EventEmitter2();
    ledger = new StockLedgerService(db, events);
    ops = new StockOperationsService(
      db,
      new StockAccessService(db, {} as never),
      ledger,
      events,
    );
    stock = new MotoarkStockService(
      new ReservationsService(ledger, ops),
      ledger,
    );
    const listings = {
      resolvePrimemotiveStoreId: async (org: string) =>
        (
          await db.query<TestDbRow[]>(
            `SELECT id FROM stores WHERE organization_id=$1 AND store_name='Primemotive'`,
            [org],
          )
        )[0].id,
    };
    channel = new ChannelStockSyncService(
      db,
      { isEnabled: () => Promise.resolve(false) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    service = new MotoarkService(
      db,
      listings as never,
      {
        getAccessibleStoreIds: () => Promise.resolve(new Set<string>()),
      } as never,
      { getPermissionKeysForUser: () => Promise.resolve(authority) } as never,
      stock,
      ledger,
      channel,
    );
    changes = new PrimemotiveListingChangesService(
      { manager: db.manager } as never,
      {} as never,
      {} as never,
      listings as never,
    );
  }, 90_000);
  afterAll(async () => {
    if (oldSecret === undefined)
      delete process.env.MOTOARK_ORDER_WEBHOOK_SECRET;
    else process.env.MOTOARK_ORDER_WEBHOOK_SECRET = oldSecret;
    await close?.();
  });

  async function setup(quantity = 5, tracked = false) {
    const s = await seedBasics(db);
    const [{ id: userId }] = await db.query<TestDbRow[]>(
      `INSERT INTO users(email) VALUES('integration-test') RETURNING id`,
    );
    const [{ id: storeId }] = await db.query<TestDbRow[]>(
      `INSERT INTO stores(organization_id,store_name) VALUES($1,'Primemotive') RETURNING id`,
      [s.orgId],
    );
    await db.query<TestDbRow[]>(
      `INSERT INTO store_warehouse_links(organization_id,store_id,warehouse_id) VALUES($1,$2,$3)`,
      [s.orgId, storeId, s.warehouseId],
    );
    const [{ id: quarantineId }] = await db.query<TestDbRow[]>(
      `INSERT INTO warehouses(organization_id,code,name,is_sellable) VALUES($1,'RET','Returns',false) RETURNING id`,
      [s.orgId],
    );
    if (tracked)
      await db.query<TestDbRow[]>(
        `UPDATE inventory_items SET tracking_mode='one_off' WHERE id=$1`,
        [s.itemId],
      );
    await ops.receive(
      { organizationId: s.orgId, userId, warehouseIds: null },
      {
        itemId: s.itemId,
        warehouseId: s.warehouseId,
        locationId: s.locationId,
        quantity,
      },
    );
    const [{ id: listingId }] = await db.query<TestDbRow[]>(
      `INSERT INTO ebay_published_listings(organization_id,store_id,sku,catalog_product_id,ebay_item_id,quantity_available) VALUES($1,$2,'SKU-1',$3,'123456',$4) RETURNING id`,
      [s.orgId, storeId, s.catalogProductId, quantity],
    );
    return {
      ...s,
      storeId,
      quarantineId,
      listingId,
      user: { id: userId, storeAccessAll: true } as User,
    };
  }
  type Setup = Awaited<ReturnType<typeof setup>>;
  function paid(
    s: Setup,
    orderId = 'purchase',
    quantity = 2,
  ): MotoarkOrderEventDto {
    return {
      schemaVersion: 1,
      eventId: `${orderId}-paid`,
      eventType: 'order.paid',
      occurredAt: new Date().toISOString(),
      externalOrderId: orderId,
      orderVersion: 1,
      currency: 'USD',
      lines: [
        {
          externalLineId: 'line1',
          listingId: s.listingId,
          quantity,
          unitPrice: '50.00',
        },
      ],
    };
  }
  async function send(s: Setup, dto: MotoarkOrderEventDto) {
    const body = Buffer.from(JSON.stringify(dto)),
      timestamp = String(Math.floor(Date.now() / 1000));
    return service.accept(
      s.orgId,
      s.user,
      dto,
      body,
      timestamp,
      `sha256=${createHmac('sha256', secret).update(timestamp).update('.').update(body).digest('hex')}`,
    );
  }
  async function levels(s: Setup) {
    return (
      await db.query<TestDbRow[]>(
        `SELECT sum(on_hand)::int AS on_hand,sum(reserved)::int AS reserved,
      COALESCE(sum(available) FILTER(WHERE warehouse_id=$2),0)::int AS available FROM stock_levels WHERE inventory_item_id=$1`,
        [s.itemId, s.warehouseId],
      )
    )[0];
  }
  const next = (
    base: MotoarkOrderEventDto,
    version: number,
    eventType: MotoarkOrderEventDto['eventType'],
    quantity = 1,
  ): MotoarkOrderEventDto => ({
    ...base,
    eventId: `${base.externalOrderId}-${version}`,
    eventType,
    orderVersion: version,
    lines: [{ externalLineId: 'line1', quantity }],
  });

  it('atomically deduplicates concurrent delivery and rejects changed payloads', async () => {
    const s = await setup(),
      dto = paid(s);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => send(s, dto)),
    );
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(await levels(s)).toMatchObject({
      on_hand: 5,
      reserved: 2,
      available: 3,
    });
    expect(
      (
        await db.query<TestDbRow[]>(
          `SELECT count(*)::int n FROM motoark_orders WHERE organization_id=$1`,
          [s.orgId],
        )
      )[0].n,
    ).toBe(1);
    await expect(
      send(s, { ...dto, lines: [{ ...dto.lines![0], quantity: 3 }] }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('handles partial shipping, cancellation, physical returns, inspection, disposal and independent refunds', async () => {
    const s = await setup(),
      base = paid(s, 'lifecycle', 3);
    expect((await send(s, base)).status).toBe('applied');
    expect((await send(s, next(base, 2, 'order.shipped', 2))).status).toBe(
      'applied',
    );
    expect(await levels(s)).toMatchObject({
      on_hand: 3,
      reserved: 1,
      available: 2,
    });
    expect((await send(s, next(base, 3, 'order.cancelled'))).status).toBe(
      'applied',
    );
    expect(await levels(s)).toMatchObject({
      on_hand: 3,
      reserved: 0,
      available: 3,
    });
    expect(
      (
        await send(s, {
          ...next(base, 4, 'return.requested', 2),
          returnId: 'r1',
        })
      ).status,
    ).toBe('applied');
    expect(
      (
        await send(s, {
          ...next(base, 5, 'return.received', 2),
          returnId: 'r1',
          lines: [
            {
              externalLineId: 'line1',
              quantity: 2,
              warehouseId: s.quarantineId,
            },
          ],
        })
      ).status,
    ).toBe('applied');
    expect(await levels(s)).toMatchObject({
      on_hand: 5,
      reserved: 0,
      available: 3,
    });
    expect(
      (
        await send(s, {
          ...next(base, 6, 'refund.completed'),
          lines: undefined,
          refundId: 'refund1',
          amount: '10.00',
        })
      ).status,
    ).toBe('applied');
    expect(await levels(s)).toMatchObject({ available: 3 });
    expect(
      (
        await send(s, {
          ...next(base, 7, 'return.restocked'),
          returnId: 'r1',
          lines: [
            {
              externalLineId: 'line1',
              quantity: 1,
              warehouseId: s.warehouseId,
              locationId: s.locationId,
            },
          ],
        })
      ).status,
    ).toBe('applied');
    expect(
      (await send(s, { ...next(base, 8, 'return.disposed'), returnId: 'r1' }))
        .status,
    ).toBe('applied');
    expect(await levels(s)).toMatchObject({
      on_hand: 4,
      reserved: 0,
      available: 4,
    });
    const qty = await service.quantity(s.orgId, s.user, s.listingId);
    expect(qty).toMatchObject({
      mapped: true,
      quantityAvailable: 4,
      marketplaceQuantity: 5,
    });
    await channel.sweep(s.orgId);
    expect(
      (await service.quantity(s.orgId, s.user, s.listingId)).channelSyncStatus,
    ).toBe('shadow');
  });
  it('holds out-of-order events and applies them after the original purchase', async () => {
    const s = await setup(),
      base = paid(s, 'out-of-order');
    expect((await send(s, next(base, 2, 'order.cancelled', 2))).status).toBe(
      'pending',
    );
    await send(s, base);
    const [event] = await db.query<TestDbRow[]>(
      `SELECT id FROM motoark_order_events WHERE organization_id=$1 AND event_id=$2`,
      [s.orgId, 'out-of-order-2'],
    );
    await service.process(event.id);
    expect((await service.get(s.orgId, s.user, 'out-of-order-2')).status).toBe(
      'applied',
    );
    expect(await levels(s)).toMatchObject({ reserved: 0, available: 5 });
  });
  it('allows exactly one concurrent purchase of the last unit', async () => {
    const s = await setup(1);
    const results = await Promise.all([
      send(s, paid(s, 'last-a', 1)),
      send(s, paid(s, 'last-b', 1)),
    ]);
    expect(results.map((x) => x.status).sort()).toEqual(['applied', 'pending']);
    expect(await levels(s)).toMatchObject({
      on_hand: 1,
      reserved: 1,
      available: 0,
    });
  });
  it('rolls back stock and order balances after a processor failure, then retries once', async () => {
    const s = await setup(),
      base = paid(s, 'crash');
    await send(s, base);
    const original = stock.consume.bind(
      stock,
    ) as MotoarkStockService['consume'];
    const fault = jest
      .spyOn(stock, 'consume')
      .mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new Error('test crash after ledger write');
      });
    const shipment = next(base, 2, 'order.shipped', 2);
    expect((await send(s, shipment)).status).toBe('pending');
    expect(await levels(s)).toMatchObject({ on_hand: 5, reserved: 2 });
    fault.mockRestore();
    expect((await send(s, shipment)).status).toBe('applied');
    expect(await levels(s)).toMatchObject({ on_hand: 3, reserved: 0 });
  });
  it('preserves one-off physical identity through partial shipment and return', async () => {
    const s = await setup(3, true),
      base = paid(s, 'tracked', 2);
    await send(s, base);
    await send(s, next(base, 2, 'order.shipped'));
    const [{ id: unitId }] = await db.query<TestDbRow[]>(
      `SELECT id FROM inventory_units WHERE inventory_item_id=$1 AND status='shipped'`,
      [s.itemId],
    );
    await send(s, {
      ...next(base, 3, 'return.requested'),
      returnId: 'tracked-return',
    });
    expect(
      (
        await send(s, {
          ...next(base, 4, 'return.received'),
          returnId: 'tracked-return',
          lines: [
            {
              externalLineId: 'line1',
              quantity: 1,
              warehouseId: s.quarantineId,
              unitIds: [unitId],
            },
          ],
        })
      ).status,
    ).toBe('applied');
    expect(
      (
        await db.query<TestDbRow[]>(
          `SELECT status FROM inventory_units WHERE id=$1`,
          [unitId],
        )
      )[0].status,
    ).toBe('quarantined');
    expect(
      (
        await send(s, {
          ...next(base, 5, 'return.restocked'),
          returnId: 'tracked-return',
          lines: [
            {
              externalLineId: 'line1',
              quantity: 1,
              warehouseId: s.warehouseId,
              unitIds: [unitId],
            },
          ],
        })
      ).status,
    ).toBe('applied');
    expect(
      (
        await db.query<TestDbRow[]>(
          `SELECT count(*)::int n FROM inventory_units WHERE inventory_item_id=$1`,
          [s.itemId],
        )
      )[0].n,
    ).toBe(3);
  });
  it('rejects over-cancellation, over-refund, unsafe quarantine, and unauthorized physical receipt', async () => {
    const s = await setup(),
      base = paid(s, 'limits');
    await send(s, base);
    expect((await send(s, next(base, 2, 'order.cancelled', 3))).status).toBe(
      'rejected',
    );
    expect(
      (
        await send(s, {
          ...next(base, 2, 'refund.completed'),
          eventId: 'over-refund',
          lines: undefined,
          refundId: 'r',
          amount: '100.01',
        })
      ).status,
    ).toBe('rejected');
    await send(s, {
      ...next(base, 2, 'order.shipped', 2),
      eventId: 'ship-after-rejection',
    });
    await send(s, { ...next(base, 3, 'return.requested'), returnId: 'return' });
    const receipt = {
      ...next(base, 4, 'return.received'),
      returnId: 'return',
      lines: [
        { externalLineId: 'line1', quantity: 1, warehouseId: s.warehouseId },
      ],
    };
    expect((await send(s, receipt)).status).toBe('rejected');
    authority.delete('motoark.returns.receive');
    try {
      await expect(
        send(s, { ...receipt, eventId: 'unauthorized' }),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      authority.add('motoark.returns.receive');
    }
  });
  it('isolates organizations and excludes mirror-only synthetic inventory from channel writes', async () => {
    const a = await setup(),
      b = await setup();
    await expect(
      service.quantity(a.orgId, a.user, b.listingId),
    ).rejects.toMatchObject({ status: 404 });
    expect((await send(a, paid(a, 'same-order'))).status).toBe('applied');
    expect((await send(b, paid(b, 'same-order'))).status).toBe('applied');
    await db.query<TestDbRow[]>(
      `UPDATE ebay_published_listings SET is_test_listing=true,ebay_item_id='SIM-PRIME-01' WHERE id=$1`,
      [b.listingId],
    );
    expect((await send(b, paid(b, 'synthetic'))).status).toBe('rejected');
    await expect(
      service.quantity(
        a.orgId,
        { id: a.user['id'], storeAccessAll: false } as never,
        a.listingId,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('does not let late source commits fall behind an already-issued change cursor', async () => {
    const s = await setup();
    await changes.promoteCommittedChanges();
    const slow = db.createQueryRunner();
    await slow.connect();
    await slow.startTransaction();
    try {
      await slow.query(
        `UPDATE ebay_published_listings SET quantity_available=4 WHERE id=$1`,
        [s.listingId],
      );
      await changes.promoteCommittedChanges();
      const first = await changes.listChanges(s.orgId, s.user, {
        afterSequence: '0',
        limit: 200,
      });
      const cursor = (first as { nextSequence: string }).nextSequence;
      await slow.commitTransaction();
      await changes.promoteCommittedChanges();
      const after = await changes.listChanges(s.orgId, s.user, {
        afterSequence: cursor,
        limit: 200,
      });
      expect(after.items).toHaveLength(1);
      expect(
        (after.items as Array<{ listing: Record<string, unknown> }>)[0].listing,
      ).toMatchObject({
        quantityAvailable: 4,
        revision: '2',
      });
    } finally {
      if (slow.isTransactionActive) await slow.rollbackTransaction();
      await slow.release();
    }
  });
  it('filters outbound claims by organization and holds later events behind an undelivered predecessor', async () => {
    const a = await setup(),
      b = await setup();
    await db.query<TestDbRow[]>(
      'UPDATE ebay_published_listings SET quantity_available=quantity_available-1 WHERE id=ANY($1::uuid[])',
      [[a.listingId, b.listingId]],
    );
    await changes.promoteCommittedChanges();
    const claimed = await changes['claimDueChanges'](a.orgId, a.storeId);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].organization_id).toBe(a.orgId);
    await db.query<TestDbRow[]>(
      'UPDATE ebay_published_listing_changes SET delivered_at=now() WHERE id=$1',
      [claimed[0].id],
    );
    const nextBatch = await changes['claimDueChanges'](a.orgId, a.storeId);
    expect(nextBatch).toHaveLength(1);
    expect(BigInt(nextBatch[0].sequence)).toBeGreaterThan(
      BigInt(claimed[0].sequence),
    );
  });
  it('publishes absolute quantity and emits removal/reactivation after successful channel acknowledgement', async () => {
    const s = await setup();
    await db.query<TestDbRow[]>(
      'INSERT INTO store_stock_policies(store_id,organization_id,push_enabled) VALUES($1,$2,true)',
      [s.storeId, s.orgId],
    );
    const reviseFixedPriceItem = jest.fn().mockResolvedValue(undefined);
    const push = new ChannelStockSyncService(
      db,
      { isEnabled: () => Promise.resolve(true) } as never,
      {} as never,
      {} as never,
      { reviseFixedPriceItem } as never,
      {} as never,
      {} as never,
    );
    const base = paid(s, 'all-stock', 5);
    await send(s, base);
    await push.sweep(s.orgId);
    expect(reviseFixedPriceItem).toHaveBeenCalledWith(
      s.storeId,
      '123456',
      { quantity: 0 },
      'EBAY_US',
    );
    expect(
      (
        await db.query<TestDbRow[]>(
          'SELECT listing_status,quantity_available FROM ebay_published_listings WHERE id=$1',
          [s.listingId],
        )
      )[0],
    ).toMatchObject({ listing_status: 'out_of_stock', quantity_available: 0 });
    await send(s, next(base, 2, 'order.cancelled', 5));
    await push.sweep(s.orgId);
    expect(
      (
        await db.query<TestDbRow[]>(
          'SELECT listing_status,quantity_available FROM ebay_published_listings WHERE id=$1',
          [s.listingId],
        )
      )[0],
    ).toMatchObject({ listing_status: 'active', quantity_available: 5 });
    const events = await db.query<TestDbRow[]>(
      'SELECT event_type FROM ebay_published_listing_changes WHERE listing_id=$1 ORDER BY occurred_at,id',
      [s.listingId],
    );
    expect(events.map((e) => e.event_type)).toEqual([
      'listing.added',
      'listing.removed',
      'listing.added',
    ]);
  });
  it('rolls additive migrations down/up inside an isolated rollback transaction and limits external physical-return grants', async () => {
    const grants = await db.query<TestDbRow[]>(
      `SELECT p.key FROM permissions p JOIN role_permissions rp ON rp."permissionId"=p.id JOIN roles r ON r.id=rp."roleId" WHERE r.slug='api_published_listings_reader' ORDER BY p.key`,
    );
    expect(grants.map((g) => g.key)).toEqual([
      'motoark.orders.notify',
      'motoark.orders.view',
    ]);
    const qr = db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const ordered = new PrimemotiveOrderedChanges1791600000000(),
        lifecycle = new MotoarkOrderLifecycle1791500000000();
      await ordered.down(qr);
      await lifecycle.down(qr);
      await lifecycle.up(qr);
      await ordered.up(qr);
      expect(
        (
          (await qr.query(
            "SELECT count(*)::int n FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='ebay_published_listings' AND column_name='revision'",
          )) as Array<{ n: number }>
        )[0].n,
      ).toBe(1);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });
  it('keeps legacy sale receipt atomic and receipt-only under concurrent retries', async () => {
    const s = await setup();
    const dto = {
      eventType: 'listing.sold' as const,
      eventId: 'legacy',
      listingId: s.listingId,
      soldAt: new Date().toISOString(),
      quantity: 1,
    };
    const old = process.env.PRIMEMOTIVE_SALES_WEBHOOK_SECRET;
    process.env.PRIMEMOTIVE_SALES_WEBHOOK_SECRET = secret;
    const published = new PublishedListingsService(
      {
        findOne: () =>
          Promise.resolve({
            id: s.listingId,
            storeId: s.storeId,
            store: { channel: 'ebay', storeName: 'Primemotive' },
          }),
      } as never,
      {} as never,
      db.getRepository(ChannelWebhookLog),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const body = Buffer.from(JSON.stringify(dto)),
      timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret)
      .update(timestamp)
      .update('.')
      .update(body)
      .digest('hex');
    try {
      const result = await Promise.all(
        Array.from({ length: 6 }, () =>
          published.recordPrimemotiveSaleEvent(
            s.orgId,
            s.user,
            dto,
            body,
            timestamp,
            signature,
          ),
        ),
      );
      expect(result.filter((r) => r.status === 'accepted')).toHaveLength(1);
      expect(await levels(s)).toMatchObject({ reserved: 0, available: 5 });
    } finally {
      if (old === undefined)
        delete process.env.PRIMEMOTIVE_SALES_WEBHOOK_SECRET;
      else process.env.PRIMEMOTIVE_SALES_WEBHOOK_SECRET = old;
    }
  });
});

describe('MotoArk input and signatures', () => {
  it('rejects stale signatures, changed raw bytes, and unconfigured receivers', () => {
    const body = Buffer.from('{"a":1}'),
      ts = String(Math.floor(Date.now() / 1000));
    const sig = createHmac('sha256', 'test-key')
      .update(`${ts}.${body.toString('utf8')}`)
      .digest('hex');
    expect(() => verifyWebhook('test-key', body, ts, sig)).not.toThrow();
    expect(() =>
      verifyWebhook('test-key', Buffer.from('{ "a":1}'), ts, sig),
    ).toThrow();
    expect(() => verifyWebhook('test-key', body, '1000000000', sig)).toThrow();
    expect(() => verifyWebhook(undefined, body, ts, sig)).toThrow();
    expect(payloadHash({ b: 2, a: 1 })).toBe(payloadHash({ a: 1, b: 2 }));
  });
  it('rejects unknown fields, fractional quantities, repeated line IDs and floating-point prices', async () => {
    const errors = await validate(
      plainToInstance(MotoarkOrderEventDto, {
        schemaVersion: 1,
        eventId: '',
        eventType: 'listing.sold',
        occurredAt: 'bad',
        externalOrderId: 'order',
        orderVersion: 0,
        currency: 'US',
        unexpected: true,
        lines: [
          { externalLineId: 'same', quantity: 1.2, unitPrice: 2.3 },
          { externalLineId: 'same', quantity: 1 },
        ],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining([
        'eventId',
        'eventType',
        'occurredAt',
        'orderVersion',
        'currency',
        'unexpected',
        'lines',
      ]),
    );
  });
});
