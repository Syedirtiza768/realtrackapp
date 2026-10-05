import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { StockLedgerService } from './stock-ledger.service.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockOperationsService } from './stock-operations.service.js';
import { ReservationsService } from './reservations.service.js';
import { WarehousesService } from './warehouses.service.js';
import { ProcurementService } from './procurement.service.js';
import { OrderStockService } from './order-stock.service.js';
import { ChannelStockSyncService } from './channel-stock-sync.service.js';
import { createStockTestDb, seedBasics, STOCK_IT_URL } from './testing/stock-test-db.js';

const describeIt = STOCK_IT_URL ? describe : describe.skip;

/**
 * Order ↔ stock ↔ procurement flows against PostgreSQL, including stock that is not on hand
 * and must be acquired from a supplier (purchase order or dropship).
 */
describeIt('Order stock flows (PostgreSQL integration)', () => {
  let ds: DataSource;
  let close: () => Promise<void>;
  let ops: StockOperationsService;
  let procurement: ProcurementService;
  let orders: OrderStockService;
  let channel: ChannelStockSyncService;
  const notifications = { create: jest.fn(async () => ({})) };

  beforeAll(async () => {
    ({ ds, close } = await createStockTestDb());
    const events = new EventEmitter2();
    const ledger = new StockLedgerService(ds, events);
    const access = new StockAccessService(ds, {} as never);
    const warehouses = new WarehousesService(ds, access, ledger);
    ops = new StockOperationsService(ds, access, ledger, events);
    const reservations = new ReservationsService(ledger, ops);
    procurement = new ProcurementService(ds, access, ledger, ops, reservations, warehouses, events);
    orders = new OrderStockService(ds, access, ledger, reservations, procurement, warehouses, notifications as never);
    channel = new ChannelStockSyncService(ds, { isEnabled: async () => false } as never, {} as never, {} as never, {} as never, {} as never, { add: jest.fn() } as never);
  }, 60_000);
  afterAll(async () => close?.());

  async function setup() {
    const s = await seedBasics(ds);
    const scope: StockScope = { organizationId: s.orgId, userId: null, warehouseIds: null };
    const [{ id: storeId }] = await ds.query(`INSERT INTO stores (organization_id) VALUES ($1) RETURNING id`, [s.orgId]);
    await ds.query(`INSERT INTO store_warehouse_links (organization_id, store_id, warehouse_id) VALUES ($1,$2,$3)`, [s.orgId, storeId, s.warehouseId]);
    const [{ id: supplierId }] = await ds.query(
      `INSERT INTO suppliers (organization_id, code, name, supports_dropship) VALUES ($1, 'NAPA', 'NAPA', true) RETURNING id`,
      [s.orgId],
    );
    return { ...s, scope, storeId, supplierId };
  }

  async function placeOrder(storeId: string, sku: string, quantity: number) {
    const [{ id: orderId }] = await ds.query(`INSERT INTO orders (store_id, external_order_id) VALUES ($1, 'EBAY-' || floor(random()*1e9)) RETURNING id`, [storeId]);
    const [{ id: lineId }] = await ds.query(`INSERT INTO order_items (order_id, sku, quantity) VALUES ($1,$2,$3) RETURNING id`, [orderId, sku, quantity]);
    return { orderId, lineId };
  }

  const lineStatus = async (lineId: string) =>
    (await ds.query(`SELECT stock_status FROM order_items WHERE id = $1`, [lineId]))[0].stock_status;
  const totals = async (itemId: string) =>
    (await ds.query(
      `SELECT COALESCE(SUM(on_hand),0)::int on_hand, COALESCE(SUM(reserved),0)::int reserved, COALESCE(SUM(inbound),0)::int inbound
         FROM stock_levels WHERE inventory_item_id = $1`,
      [itemId],
    ))[0];

  it('reserves what is on hand and raises a procurement request for the rest, then receives it to the order', async () => {
    const s = await setup();
    await ds.query(`INSERT INTO inventory_item_sources (organization_id, inventory_item_id, supplier_id, unit_cost, available_qty) VALUES ($1,$2,$3, 12.5, 10)`, [s.orgId, s.itemId, s.supplierId]);
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, locationId: s.locationId, quantity: 2 });

    const { orderId, lineId } = await placeOrder(s.storeId, 'SKU-1', 3);
    await orders.allocateOrder(orderId);
    expect(await lineStatus(lineId)).toBe('awaiting_procurement');
    expect(await totals(s.itemId)).toMatchObject({ on_hand: 2, reserved: 2 });

    const { items: requests } = await procurement.listRequests(s.scope, { status: 'open' });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ quantity: 1, supplierName: 'NAPA', orderId });

    // Re-running allocation must not double-cover the line.
    await orders.allocateOrder(orderId);
    expect((await procurement.listRequests(s.scope, { status: 'open' })).items).toHaveLength(1);

    const [po] = await procurement.purchaseOrdersFromRequests(s.scope, { requestIds: [requests[0].id] });
    await procurement.orderPurchaseOrder(s.scope, po.id);
    expect(await totals(s.itemId)).toMatchObject({ inbound: 1 });

    const doc = await ops.getDocument(s.scope, po.id);
    await procurement.receivePurchaseOrder(s.scope, po.id, { lines: [{ lineId: (doc.lines as Array<{ id: string }>)[0].id, quantity: 1, locationId: s.locationId }] });
    expect(await totals(s.itemId)).toMatchObject({ on_hand: 3, reserved: 3, inbound: 0 });
    await ds.transaction((em) => orders.refreshLineStatus(em, lineId));
    expect(await lineStatus(lineId)).toBe('reserved');

    await orders.shipOrder(orderId, null);
    expect(await totals(s.itemId)).toMatchObject({ on_hand: 0, reserved: 0 });
    expect(await lineStatus(lineId)).toBe('shipped');
    // order.shipped can fire twice; the second time is a no-op.
    await orders.shipOrder(orderId, null);
    expect(await totals(s.itemId)).toMatchObject({ on_hand: 0, reserved: 0 });
  });

  it('backorders a stocked item with no supplier and fills it when stock arrives', async () => {
    const s = await setup();
    const { orderId, lineId } = await placeOrder(s.storeId, 'SKU-1', 1);
    await orders.allocateOrder(orderId);
    expect(await lineStatus(lineId)).toBe('backorder');

    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, quantity: 1 });
    await orders.allocateBackorders(s.orgId, [s.itemId]);
    expect(await lineStatus(lineId)).toBe('reserved');
  });

  it('dropships on-demand items that are never held in stock', async () => {
    const s = await setup();
    await ds.query(`UPDATE inventory_items SET sourcing_mode = 'on_demand' WHERE id = $1`, [s.itemId]);
    await ds.query(
      `INSERT INTO inventory_item_sources (organization_id, inventory_item_id, supplier_id, available_qty, fulfillment_mode) VALUES ($1,$2,$3, 8, 'dropship')`,
      [s.orgId, s.itemId, s.supplierId],
    );
    const desired = await channel.computeDesired(s.storeId, s.itemId);
    expect(desired).toMatchObject({ onHandAvailable: 0, sourceable: 5, desired: 5 }); // capped by max_sourceable_qty default 5

    const { orderId, lineId } = await placeOrder(s.storeId, 'SKU-1', 2);
    await orders.allocateOrder(orderId);
    expect(await lineStatus(lineId)).toBe('awaiting_procurement');
    const { items: [req] } = await procurement.listRequests(s.scope, {});
    expect(req.fulfillmentMode).toBe('dropship');
    expect((await channel.computeDesired(s.storeId, s.itemId)).sourceable).toBe(5); // 8 - 2 open = 6, capped at 5

    await procurement.markDropshipped(s.scope, req.id, { supplierTracking: '1Z999' });
    await ds.transaction((em) => orders.refreshLineStatus(em, lineId));
    expect(await lineStatus(lineId)).toBe('dropshipped');
    expect(await totals(s.itemId)).toMatchObject({ on_hand: 0, reserved: 0 });

    await orders.shipOrder(orderId, null);
    const [{ status }] = await ds.query(`SELECT status FROM procurement_requests WHERE id = $1`, [req.id]);
    expect(status).toBe('fulfilled');
  });

  it('releases reservations and keeps already-ordered purchases as stock when an order is cancelled', async () => {
    const s = await setup();
    await ds.query(`INSERT INTO inventory_item_sources (organization_id, inventory_item_id, supplier_id) VALUES ($1,$2,$3)`, [s.orgId, s.itemId, s.supplierId]);
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, quantity: 1 });
    const { orderId, lineId } = await placeOrder(s.storeId, 'SKU-1', 3);
    await orders.allocateOrder(orderId);
    const { items: [req] } = await procurement.listRequests(s.scope, { status: 'open' });
    const [po] = await procurement.purchaseOrdersFromRequests(s.scope, { requestIds: [req.id] });
    await procurement.orderPurchaseOrder(s.scope, po.id);

    await ds.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [orderId]);
    await orders.releaseOrder(orderId, null);
    expect(await totals(s.itemId)).toMatchObject({ on_hand: 1, reserved: 0, inbound: 2 });
    expect(await lineStatus(lineId)).toBe('released');
    const [r] = await ds.query(`SELECT status, reason, order_id FROM procurement_requests WHERE id = $1`, [req.id]);
    expect(r).toMatchObject({ status: 'ordered', reason: 'reorder', order_id: null });
  });

  it('tracks one-off units through reserve, pick and ship', async () => {
    const s = await setup();
    await ds.query(`UPDATE inventory_items SET tracking_mode = 'one_off' WHERE id = $1`, [s.itemId]);
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, locationId: s.locationId, quantity: 1, lotCode: 'VIN123' });
    const { orderId, lineId } = await placeOrder(s.storeId, 'SKU-1', 1);
    await orders.allocateOrder(orderId);
    let [unit] = await ds.query(`SELECT status, reservation_id FROM inventory_units WHERE inventory_item_id = $1`, [s.itemId]);
    expect(unit.status).toBe('reserved');
    await orders.pickOrder(s.scope, orderId);
    expect(await lineStatus(lineId)).toBe('picked');
    await orders.shipOrder(orderId, null);
    [unit] = await ds.query(`SELECT status, warehouse_id FROM inventory_units WHERE inventory_item_id = $1`, [s.itemId]);
    expect(unit).toMatchObject({ status: 'shipped', warehouse_id: null });
  });

  it('moves stock between warehouses through an in-transit transfer', async () => {
    const s = await setup();
    const [{ id: dest }] = await ds.query(`INSERT INTO warehouses (organization_id, code, name) VALUES ($1, 'UK_LU7', 'Luton') RETURNING id`, [s.orgId]);
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, quantity: 4 });
    const tr = await ops.createTransfer(s.scope, { warehouseId: s.warehouseId, destWarehouseId: dest, lines: [{ itemId: s.itemId, quantity: 3 }] });
    await ops.shipTransfer(s.scope, tr.id);
    const doc = await ops.getDocument(s.scope, tr.id);
    const lineId = (doc.lines as Array<{ id: string }>)[0].id;
    await ops.receiveTransfer(s.scope, tr.id, { lines: [{ lineId, quantity: 2 }] });
    const rows = await ds.query(
      `SELECT w.code, SUM(on_hand)::int on_hand, SUM(inbound)::int inbound FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE inventory_item_id = $1 GROUP BY w.code ORDER BY w.code`,
      [s.itemId],
    );
    expect(rows).toEqual([
      { code: 'MAIN', on_hand: 1, inbound: 0 },
      { code: 'UK_LU7', on_hand: 2, inbound: 1 },
    ]);
  });

  it('computes channel quantity in shadow mode and pushes absolute quantities when enabled', async () => {
    const s = await setup();
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, quantity: 7 });
    await ds.query(`INSERT INTO ebay_published_listings (store_id, sku, offer_id, quantity_available) VALUES ($1, 'SKU-1', 'OFFER-1', 3)`, [s.storeId]);
    await ds.query(`INSERT INTO ebay_published_listings (store_id, sku, ebay_item_id, quantity_available) VALUES ($1, 'SKU-1', '1234567890', 3)`, [s.storeId]);
    await ds.query(`INSERT INTO store_stock_policies (store_id, organization_id, buffer_qty) VALUES ($1, $2, 2)`, [s.storeId, s.orgId]);
    await ds.query(`UPDATE channel_stock_sync_state SET dirty = true WHERE store_id = $1`, [s.storeId]);

    // Shadow: kill switch off.
    await channel.sweep(s.orgId);
    let [row] = await ds.query(`SELECT status, desired_qty, channel_qty, pushed_qty FROM channel_stock_sync_state WHERE store_id = $1 AND inventory_item_id = $2`, [s.storeId, s.itemId]);
    expect(row).toEqual({ status: 'shadow', desired_qty: 5, channel_qty: 3, pushed_qty: null });

    // Push: flag on + store policy on.
    const ebayInventory = { bulkUpdatePriceQuantity: jest.fn(async () => ({ responses: [{ statusCode: 200, offerId: 'OFFER-1' }] })) };
    const ebayTrading = { reviseFixedPriceItem: jest.fn(async () => undefined) };
    const pushing = new ChannelStockSyncService(ds, { isEnabled: async () => true } as never, {} as never, ebayInventory as never, ebayTrading as never, {} as never, { add: jest.fn() } as never);
    await ds.query(`UPDATE store_stock_policies SET push_enabled = true WHERE store_id = $1`, [s.storeId]);
    await ds.query(`UPDATE channel_stock_sync_state SET dirty = true WHERE store_id = $1`, [s.storeId]);
    await pushing.sweep(s.orgId);
    expect(ebayInventory.bulkUpdatePriceQuantity).toHaveBeenCalledWith(s.storeId, [{ offers: [{ offerId: 'OFFER-1', availableQuantity: 5 }] }]);
    expect(ebayTrading.reviseFixedPriceItem).toHaveBeenCalledWith(s.storeId, '1234567890', { quantity: 5 }, 'EBAY_US');
    [row] = await ds.query(`SELECT status, desired_qty, channel_qty, pushed_qty, dirty FROM channel_stock_sync_state WHERE store_id = $1 AND inventory_item_id = $2`, [s.storeId, s.itemId]);
    expect(row).toEqual({ status: 'synced', desired_qty: 5, channel_qty: 5, pushed_qty: 5, dirty: false });
    const snap = await ds.query(`SELECT DISTINCT quantity_available FROM ebay_published_listings WHERE store_id = $1`, [s.storeId]);
    expect(snap).toEqual([{ quantity_available: 5 }]);

    // A failing channel is recorded and retried later, not lost.
    ebayInventory.bulkUpdatePriceQuantity.mockRejectedValueOnce(new Error('eBay 500'));
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, quantity: 1 });
    await pushing.sweep(s.orgId);
    [row] = await ds.query(`SELECT status, attempts, last_error, dirty FROM channel_stock_sync_state WHERE store_id = $1 AND inventory_item_id = $2`, [s.storeId, s.itemId]);
    expect(row).toEqual({ status: 'failed', attempts: 1, last_error: 'eBay 500', dirty: true });
  });

  it('pushes PartsBazar360 quantities through the lazily resolved integration', async () => {
    const s = await setup();
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, quantity: 4 });
    const [{ id: pbStore }] = await ds.query(`INSERT INTO stores (organization_id, channel) VALUES ($1, 'partsbazar360') RETURNING id`, [s.orgId]);
    await ds.query(`INSERT INTO store_warehouse_links (organization_id, store_id, warehouse_id) VALUES ($1,$2,$3)`, [s.orgId, pbStore, s.warehouseId]);
    await ds.query(`INSERT INTO store_stock_policies (store_id, organization_id, push_enabled) VALUES ($1, $2, true)`, [pbStore, s.orgId]);
    await ds.query(`INSERT INTO listing_channel_instances (listing_id, connection_id, store_id, channel) VALUES ($1, gen_random_uuid(), $2, 'partsbazar360')`, [s.catalogProductId, pbStore]);
    await ds.query(`INSERT INTO channel_stock_sync_state (store_id, inventory_item_id, organization_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [pbStore, s.itemId, s.orgId]);
    const pb = { publish: jest.fn(async () => ({})), end: jest.fn(async () => ({})) };
    const moduleRef = { get: jest.fn(() => pb) };
    const pushing = new ChannelStockSyncService(ds, { isEnabled: async () => true } as never, {} as never, {} as never, {} as never, moduleRef as never, { add: jest.fn() } as never);
    await pushing.sweep(s.orgId);
    expect(pb.publish).toHaveBeenCalledWith(expect.any(String), s.catalogProductId, { quantity: 4 });
    const [row] = await ds.query(`SELECT status, pushed_qty FROM channel_stock_sync_state WHERE store_id = $1`, [pbStore]);
    expect(row).toEqual({ status: 'synced', pushed_qty: 4 });
  });

  it('applies count variances, parking large ones for approval', async () => {
    const s = await setup();
    await ops.receive(s.scope, { itemId: s.itemId, warehouseId: s.warehouseId, locationId: s.locationId, quantity: 30 });
    const count = await ops.createCount(s.scope, { warehouseId: s.warehouseId });
    const doc = await ops.getDocument(s.scope, count.id);
    await ops.recordCount(s.scope, count.id, { lines: [{ lineId: (doc.lines as Array<{ id: string }>)[0].id, countedQty: 12 }] });
    const parked = await ops.submitCount(s.scope, count.id, { canApprove: false });
    expect(parked.status).toBe('pending_approval');
    expect((await totals(s.itemId)).on_hand).toBe(30);
    await ops.approveAdjustment(s.scope, count.id, { canApprove: true });
    expect((await totals(s.itemId)).on_hand).toBe(12);
  });
});
