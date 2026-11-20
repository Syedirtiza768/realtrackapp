"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrderStockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStockService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("typeorm");
const index_js_1 = require("./entities/index.js");
const stock_access_service_js_1 = require("./stock-access.service.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
const reservations_service_js_1 = require("./reservations.service.js");
const procurement_service_js_1 = require("./procurement.service.js");
const stock_operations_service_js_1 = require("./stock-operations.service.js");
const warehouses_service_js_1 = require("./warehouses.service.js");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
const CLOSED_ORDER_STATUSES = new Set(['cancelled', 'refunded']);
let OrderStockService = OrderStockService_1 = class OrderStockService {
    db;
    access;
    ledger;
    reservations;
    procurement;
    warehouses;
    notifications;
    logger = new common_1.Logger(OrderStockService_1.name);
    constructor(db, access, ledger, reservations, procurement, warehouses, notifications) {
        this.db = db;
        this.access = access;
        this.ledger = ledger;
        this.reservations = reservations;
        this.procurement = procurement;
        this.warehouses = warehouses;
        this.notifications = notifications;
    }
    async onOrderNew(payload) {
        await this.safe('allocate', payload.orderId, () => this.allocateOrder(payload.orderId));
    }
    async onOrderCancelled(payload) {
        await this.safe('release', payload.orderId, () => this.releaseOrder(payload.orderId, null));
    }
    async onOrderShipped(payload) {
        await this.safe('ship', payload.orderId, () => this.shipOrder(payload.orderId, null));
    }
    async onStockReceived(payload) {
        await this.safe('backorders', payload.organizationId, () => this.allocateBackorders(payload.organizationId, payload.itemIds));
    }
    async onLineUpdated(payload) {
        await this.safe('line-status', payload.orderItemId, () => this.db.transaction((em) => this.refreshLineStatus(em, payload.orderItemId)));
    }
    async safe(what, id, fn) {
        try {
            await fn();
        }
        catch (err) {
            this.logger.error(`Stock ${what} failed for ${id}: ${err.message}`, err.stack);
        }
    }
    async allocateOrder(orderId, opts = {}) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await this.allocateOnce(orderId, opts);
            }
            catch (err) {
                if (err instanceof stock_ledger_service_js_1.InsufficientStockException && attempt < 3)
                    continue;
                throw err;
            }
        }
    }
    async allocateOnce(orderId, opts) {
        const touched = [];
        const alerts = [];
        let order;
        await this.db.transaction('READ COMMITTED', async (em) => {
            [order] = (await em.query(`SELECT o.id, o.store_id, o.status, o.channel, o.external_order_id, s.organization_id
           FROM orders o LEFT JOIN stores s ON s.id = o.store_id
          WHERE o.id = $1 FOR UPDATE OF o`, [orderId]));
            if (!order)
                throw new common_1.NotFoundException('Order not found');
            if (order.channel === 'motoark')
                throw new common_1.BadRequestException('Use the MotoArk order-events contract to allocate external order stock');
            if (CLOSED_ORDER_STATUSES.has(order.status))
                return;
            const lines = (await em.query(`SELECT id, listing_id, external_listing_id, sku, quantity, inventory_item_id, stock_status
           FROM order_items WHERE order_id = $1 ORDER BY created_at FOR UPDATE`, [orderId]));
            if (!order.organization_id) {
                await em.query(`UPDATE order_items SET stock_status = 'unmatched' WHERE order_id = $1 AND stock_status IS NULL`, [orderId]);
                return;
            }
            const org = order.organization_id;
            for (const line of lines) {
                if (['shipped', 'dropshipped', 'released'].includes(line.stock_status ?? ''))
                    continue;
                const item = await this.resolveItem(em, org, line);
                if (!item) {
                    await em.query(`UPDATE order_items SET stock_status = 'unmatched' WHERE id = $1`, [line.id]);
                    alerts.push({ status: 'unmatched', sku: line.sku });
                    continue;
                }
                if (line.inventory_item_id !== item.id)
                    await em.query(`UPDATE order_items SET inventory_item_id = $2 WHERE id = $1`, [line.id, item.id]);
                if (opts.reclaimOpenRequests)
                    await this.reclaimOpenRequests(em, org, item, line, order.store_id);
                const covered = await this.coveredQty(em, line.id);
                const needed = line.quantity - covered;
                if (needed > 0) {
                    const reserved = await this.reservations.allocate(em, org, null, item, needed, {
                        orderId,
                        orderItemId: line.id,
                        storeId: order.store_id,
                    });
                    const short = needed - reserved;
                    if (reserved > 0)
                        touched.push(item.id);
                    if (short > 0 && (await this.canSource(em, item))) {
                        await this.procurement.requestForOrderLine(em, org, item, short, {
                            orderId,
                            orderItemId: line.id,
                            storeId: order.store_id,
                            warehouseId: await this.receivingWarehouseFor(em, org, order.store_id),
                        });
                    }
                }
                const status = await this.refreshLineStatus(em, line.id);
                if (status === 'backorder' || status === 'awaiting_procurement')
                    alerts.push({ status, sku: item.sku });
            }
        });
        if (order?.organization_id && touched.length)
            this.ledger.emitChanged(order.organization_id, touched.map((itemId) => ({ itemId })));
        if (order)
            await this.notifyLines(order, alerts);
        return { orderId, alerts };
    }
    async coveredQty(em, orderItemId) {
        const [{ n }] = (await em.query(`SELECT (
         COALESCE((SELECT SUM(quantity) FROM stock_reservations
                    WHERE order_item_id = $1 AND status IN ('active','picked','shipped')), 0)
       + COALESCE((SELECT SUM(CASE WHEN status IN ('dropshipped','fulfilled') THEN quantity
                                   ELSE quantity - received_qty END)
                     FROM procurement_requests
                    WHERE order_item_id = $1 AND status IN ('open','ordered','dropshipped','fulfilled')), 0)
       )::int AS n`, [orderItemId]));
        return n;
    }
    async canSource(em, item) {
        if (item.sourcingMode !== 'stocked')
            return true;
        const [row] = (await em.query(`SELECT 1 FROM inventory_item_sources x JOIN suppliers s ON s.id = x.supplier_id AND s.active
        WHERE x.inventory_item_id = $1 AND x.active LIMIT 1`, [item.id]));
        return !!row;
    }
    async receivingWarehouseFor(em, org, storeId) {
        if (storeId) {
            const [link] = (await em.query(`SELECT l.warehouse_id FROM store_warehouse_links l JOIN warehouses w ON w.id = l.warehouse_id AND w.active
          WHERE l.store_id = $1 AND l.active ORDER BY l.priority LIMIT 1`, [storeId]));
            if (link)
                return link.warehouse_id;
        }
        return (await this.warehouses.ensureDefault(org, em)).id;
    }
    async reclaimOpenRequests(em, org, item, line, storeId) {
        const open = await em.getRepository(index_js_1.ProcurementRequest).find({
            where: { orderItemId: line.id, status: 'open' },
            order: { createdAt: 'ASC' },
            lock: { mode: 'pessimistic_write' },
        });
        if (!open.length)
            return;
        const candidates = await this.reservations.candidates(em, org, item.id, storeId, 1);
        let available = candidates.reduce((n, c) => n + c.available, 0);
        for (const r of open) {
            const remaining = r.quantity - r.receivedQty;
            if (remaining > available)
                break;
            r.status = 'cancelled';
            r.note = [r.note, 'Covered by stock received before ordering'].filter(Boolean).join('\n');
            available -= remaining;
        }
        await em.getRepository(index_js_1.ProcurementRequest).save(open);
    }
    async resolveItem(em, org, line) {
        const repo = em.getRepository(index_js_1.InventoryItem);
        if (line.inventory_item_id) {
            const linked = await repo.findOneBy({ id: line.inventory_item_id, organizationId: org });
            if (linked)
                return linked;
        }
        if (line.listing_id) {
            const byListing = (await repo.findOneBy({ organizationId: org, listingRecordId: line.listing_id })) ??
                (await repo.findOneBy({ organizationId: org, catalogProductId: line.listing_id }));
            if (byListing)
                return byListing;
        }
        if (line.sku?.trim()) {
            const bySku = await repo.findOneBy({ organizationId: org, sku: line.sku.trim() });
            if (bySku)
                return bySku;
        }
        if (line.external_listing_id) {
            const published = (await em.query(`SELECT catalog_product_id, sku FROM ebay_published_listings
          WHERE organization_id = $1 AND ebay_item_id = $2
          ORDER BY (catalog_product_id IS NULL), updated_at DESC LIMIT 1`, [org, line.external_listing_id]));
            const listing = published[0];
            if (listing?.catalog_product_id) {
                const byProduct = await repo.findOneBy({ organizationId: org, catalogProductId: listing.catalog_product_id });
                if (byProduct)
                    return byProduct;
            }
            if (listing?.sku?.trim() && listing.sku.trim() !== line.sku?.trim()) {
                return repo.findOneBy({ organizationId: org, sku: listing.sku.trim() });
            }
        }
        return null;
    }
    async refreshLineStatus(em, orderItemId) {
        const [row] = (await em.query(`SELECT oi.quantity, oi.inventory_item_id, o.status AS order_status,
              COALESCE((SELECT SUM(quantity) FROM stock_reservations WHERE order_item_id = oi.id AND status = 'active'),0)::int AS active,
              COALESCE((SELECT SUM(quantity) FROM stock_reservations WHERE order_item_id = oi.id AND status = 'picked'),0)::int AS picked,
              COALESCE((SELECT SUM(quantity) FROM stock_reservations WHERE order_item_id = oi.id AND status = 'shipped'),0)::int AS shipped,
              COALESCE((SELECT SUM(quantity) FROM procurement_requests WHERE order_item_id = oi.id AND status IN ('dropshipped','fulfilled')),0)::int AS dropshipped,
              COALESCE((SELECT SUM(quantity - received_qty) FROM procurement_requests WHERE order_item_id = oi.id AND status IN ('open','ordered')),0)::int AS pending
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.id = $1`, [orderItemId]));
        if (!row)
            throw new common_1.NotFoundException('Order line not found');
        let status;
        if (!row.inventory_item_id)
            status = 'unmatched';
        else if (CLOSED_ORDER_STATUSES.has(row.order_status) && row.shipped + row.dropshipped === 0)
            status = 'released';
        else if (row.shipped + row.dropshipped >= row.quantity)
            status = row.shipped > 0 ? 'shipped' : 'dropshipped';
        else if (row.active + row.picked + row.shipped + row.dropshipped >= row.quantity)
            status = row.active === 0 ? 'picked' : 'reserved';
        else if (row.pending > 0)
            status = 'awaiting_procurement';
        else
            status = 'backorder';
        await em.query(`UPDATE order_items SET stock_status = $2 WHERE id = $1`, [orderItemId, status]);
        return status;
    }
    async allocateBackorders(organizationId, itemIds) {
        if (!itemIds.length)
            return { orders: 0 };
        const rows = (await this.db.query(`SELECT DISTINCT o.id, o.ordered_at
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN stores s ON s.id = o.store_id
        WHERE s.organization_id = $1 AND oi.inventory_item_id = ANY($2::uuid[])
          AND oi.stock_status IN ('backorder','awaiting_procurement')
          AND o.status NOT IN ('cancelled','refunded','shipped','delivered','completed')
        ORDER BY o.ordered_at
        LIMIT 200`, [organizationId, itemIds]));
        for (const r of rows)
            await this.allocateOrder(r.id, { reclaimOpenRequests: true });
        return { orders: rows.length };
    }
    async releaseOrder(orderId, actorUserId) {
        let org = null;
        const itemIds = [];
        await this.db.transaction('READ COMMITTED', async (em) => {
            const [order] = (await em.query(`SELECT o.id, o.channel, s.organization_id FROM orders o LEFT JOIN stores s ON s.id = o.store_id WHERE o.id = $1 FOR UPDATE OF o`, [orderId]));
            if (!order?.organization_id)
                return;
            if (order.channel === 'motoark')
                throw new common_1.BadRequestException('Use the MotoArk order-events contract to release external order stock');
            org = order.organization_id;
            const reservations = await em.getRepository(index_js_1.StockReservation).find({
                where: { orderId, status: (0, typeorm_1.In)(['active', 'picked']) },
                lock: { mode: 'pessimistic_write' },
            });
            itemIds.push(...(await this.reservations.release(em, org, actorUserId, reservations, 'Order cancelled')));
            await em.query(`UPDATE procurement_requests SET status = 'cancelled', note = concat_ws(E'\\n', note, 'Order cancelled'), updated_at = now()
          WHERE order_id = $1 AND status = 'open'`, [orderId]);
            await em.query(`UPDATE procurement_requests
            SET reason = 'reorder', order_id = NULL, order_item_id = NULL, store_id = NULL,
                note = concat_ws(E'\\n', note, 'Order cancelled after purchase; will be received as stock'), updated_at = now()
          WHERE order_id = $1 AND status = 'ordered'`, [orderId]);
            const lines = (await em.query(`SELECT id FROM order_items WHERE order_id = $1`, [orderId]));
            for (const l of lines)
                await this.refreshLineStatus(em, l.id);
        });
        if (org && itemIds.length) {
            this.ledger.emitChanged(org, itemIds.map((itemId) => ({ itemId })));
            await this.allocateBackorders(org, [...new Set(itemIds)]);
        }
        return { released: itemIds.length };
    }
    async pickOrder(scope, orderId) {
        return this.db.transaction('READ COMMITTED', async (em) => {
            await this.assertOrderInScope(em, scope, orderId);
            const reservations = await em.getRepository(index_js_1.StockReservation).find({
                where: { orderId, status: 'active', organizationId: scope.organizationId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!reservations.length)
                throw new common_1.BadRequestException('Nothing reserved to pick for this order');
            for (const r of reservations)
                this.access.assertWarehouse(scope, r.warehouseId);
            const commands = reservations.map((r) => ({
                itemId: r.inventoryItemId,
                warehouseId: r.warehouseId,
                locationId: r.locationId,
                type: 'pick',
                orderId: r.orderId,
                orderItemId: r.orderItemId,
                storeId: r.storeId,
            }));
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `pick:${orderId}:${reservations.map((r) => r.id).sort().join(',').slice(0, 120)}` }, commands, em);
            for (const r of reservations)
                r.status = 'picked';
            await em.getRepository(index_js_1.StockReservation).save(reservations);
            await em.query(`UPDATE inventory_units SET status = 'picked', updated_at = now() WHERE reservation_id = ANY($1::uuid[])`, [reservations.map((r) => r.id)]);
            const lineIds = [...new Set(reservations.map((r) => r.orderItemId).filter(Boolean))];
            for (const id of lineIds)
                await this.refreshLineStatus(em, id);
            return { picked: reservations.length };
        });
    }
    async shipOrder(orderId, actorUserId) {
        let org = null;
        const itemIds = [];
        const warnings = [];
        await this.db.transaction('READ COMMITTED', async (em) => {
            const [order] = (await em.query(`SELECT o.id, o.channel, o.external_order_id, s.organization_id FROM orders o LEFT JOIN stores s ON s.id = o.store_id WHERE o.id = $1 FOR UPDATE OF o`, [orderId]));
            if (!order?.organization_id)
                return;
            if (order.channel === 'motoark')
                throw new common_1.BadRequestException('Use the MotoArk order-events contract to ship external order stock');
            org = order.organization_id;
            const reservations = await em.getRepository(index_js_1.StockReservation).find({
                where: { orderId, status: (0, typeorm_1.In)(['active', 'picked']) },
                lock: { mode: 'pessimistic_write' },
            });
            for (const r of reservations) {
                const units = (await em.query(`SELECT id FROM inventory_units WHERE reservation_id = $1`, [r.id]));
                const base = {
                    itemId: r.inventoryItemId,
                    warehouseId: r.warehouseId,
                    locationId: r.locationId,
                    type: 'ship',
                    orderId: r.orderId,
                    orderItemId: r.orderItemId,
                    storeId: r.storeId,
                };
                const commands = units.length
                    ? units.map((u) => ({ ...base, onHand: -1, reserved: -1, unitId: u.id, unitPatch: { status: 'shipped', warehouseId: null, locationId: null } }))
                    : [{ ...base, onHand: -r.quantity, reserved: -r.quantity }];
                await this.ledger.apply({ organizationId: org, actorUserId, operationKey: `ship:${r.id}` }, commands, em);
                r.status = 'shipped';
                itemIds.push(r.inventoryItemId);
            }
            await em.getRepository(index_js_1.StockReservation).save(reservations);
            await em.query(`UPDATE procurement_requests SET status = 'fulfilled', updated_at = now() WHERE order_id = $1 AND status = 'dropshipped'`, [orderId]);
            const pending = (await em.query(`SELECT count(*)::int n FROM procurement_requests WHERE order_id = $1 AND status IN ('open','ordered') AND fulfillment_mode = 'ship_to_warehouse'`, [orderId]));
            if (pending[0].n > 0)
                warnings.push(`Order ${order.external_order_id ?? orderId} was marked shipped while ${pending[0].n} item(s) were still being acquired from a supplier.`);
            const lines = (await em.query(`SELECT id FROM order_items WHERE order_id = $1`, [orderId]));
            for (const l of lines)
                await this.refreshLineStatus(em, l.id);
        });
        if (org && itemIds.length)
            this.ledger.emitChanged(org, itemIds.map((itemId) => ({ itemId })));
        for (const w of warnings) {
            await this.notifications.create({ type: 'stock_ship_before_receipt', title: 'Shipped before stock arrived', body: w, severity: 'warning', entityType: 'order', entityId: orderId, actionUrl: '/orders' }).catch(() => undefined);
        }
        return { shipped: itemIds.length, warnings };
    }
    async assertOrderInScope(em, scope, orderId) {
        const [row] = (await em.query(`SELECT o.id FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = $1 AND s.organization_id = $2`, [orderId, scope.organizationId]));
        if (!row)
            throw new common_1.NotFoundException('Order not found in this workspace');
    }
    async orderStock(scope, orderId) {
        await this.assertOrderInScope(this.db.manager, scope, orderId);
        const lines = await this.db.query(`SELECT oi.id, oi.sku, oi.title, oi.quantity, oi.stock_status AS "stockStatus",
              oi.inventory_item_id AS "itemId", i.sku AS "itemSku", i.sourcing_mode AS "sourcingMode",
              COALESCE((SELECT json_agg(json_build_object('id', r.id, 'status', r.status, 'quantity', r.quantity,
                         'warehouseCode', w.code, 'locationCode', l.code))
                  FROM stock_reservations r JOIN warehouses w ON w.id = r.warehouse_id
                  LEFT JOIN warehouse_locations l ON l.id = r.location_id
                 WHERE r.order_item_id = oi.id), '[]') AS reservations,
              COALESCE((SELECT json_agg(json_build_object('id', p.id, 'status', p.status, 'quantity', p.quantity,
                         'receivedQty', p.received_qty, 'fulfillmentMode', p.fulfillment_mode, 'supplierName', s.name,
                         'purchaseOrderNumber', d.doc_number, 'supplierTracking', p.supplier_tracking, 'neededBy', p.needed_by))
                  FROM procurement_requests p LEFT JOIN suppliers s ON s.id = p.supplier_id
                  LEFT JOIN stock_documents d ON d.id = p.purchase_order_id
                 WHERE p.order_item_id = oi.id AND p.status <> 'cancelled'), '[]') AS procurement
         FROM order_items oi LEFT JOIN inventory_items i ON i.id = oi.inventory_item_id
        WHERE oi.order_id = $1 ORDER BY oi.created_at`, [orderId]);
        return { orderId, lines };
    }
    async exceptions(scope) {
        return this.db.query(`SELECT oi.id AS "orderItemId", oi.order_id AS "orderId", o.external_order_id AS "externalOrderId",
              o.status AS "orderStatus", o.ordered_at AS "orderedAt", st.store_name AS "storeName",
              oi.sku, oi.title, oi.quantity, oi.stock_status AS "stockStatus", oi.inventory_item_id AS "itemId"
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN stores st ON st.id = o.store_id
        WHERE st.organization_id = $1
          AND oi.stock_status IN ('unmatched','backorder','awaiting_procurement')
          AND o.status NOT IN ('cancelled','refunded')
        ORDER BY o.ordered_at
        LIMIT 500`, [scope.organizationId]);
    }
    async linkLine(scope, orderId, orderItemId, itemId) {
        await this.db.transaction(async (em) => {
            await this.assertOrderInScope(em, scope, orderId);
            const item = await em.getRepository(index_js_1.InventoryItem).findOneBy({ id: itemId, organizationId: scope.organizationId });
            if (!item)
                throw new common_1.NotFoundException('Inventory item not found');
            const rows = (await em.query(`UPDATE order_items SET inventory_item_id = $3, stock_status = NULL WHERE id = $1 AND order_id = $2 RETURNING id`, [orderItemId, orderId, itemId]));
            const updated = Array.isArray(rows[0]) ? rows[0] : rows;
            if (!updated.length)
                throw new common_1.NotFoundException('Order line not found');
        });
        return this.allocateOrder(orderId);
    }
    async pickList(scope, warehouseId) {
        const params = [scope.organizationId];
        const where = ['r.organization_id = $1', `r.status IN ('active','picked')`, `o.status NOT IN ('cancelled','refunded','shipped','delivered','completed')`];
        if (warehouseId) {
            this.access.assertWarehouse(scope, warehouseId);
            params.push(warehouseId);
            where.push(`r.warehouse_id = $${params.length}`);
        }
        where.push(this.access.warehouseFilter(scope, 'r.warehouse_id', params));
        return this.db.query(`SELECT r.id AS "reservationId", r.status, r.quantity, r.order_id AS "orderId", o.external_order_id AS "externalOrderId",
              o.buyer_username AS "buyerUsername", o.shipping_name AS "shippingName", o.shipping_country AS "shippingCountry",
              o.ordered_at AS "orderedAt", st.store_name AS "storeName",
              r.warehouse_id AS "warehouseId", w.code AS "warehouseCode", l.code AS "locationCode",
              i.id AS "itemId", i.sku, i.title, i.image_url AS "imageUrl",
              (SELECT string_agg(COALESCE(u.serial_public, u.lot_code, left(u.id::text, 8)), ', ')
                 FROM inventory_units u WHERE u.reservation_id = r.id) AS units
         FROM stock_reservations r
         JOIN orders o ON o.id = r.order_id
         LEFT JOIN stores st ON st.id = o.store_id
         JOIN warehouses w ON w.id = r.warehouse_id
         LEFT JOIN warehouse_locations l ON l.id = r.location_id
         JOIN inventory_items i ON i.id = r.inventory_item_id
        WHERE ${where.join(' AND ')}
        ORDER BY w.code, l.code NULLS LAST, o.ordered_at`, params);
    }
    async notifyLines(order, alerts) {
        if (!alerts.length)
            return;
        const ref = order.external_order_id ?? order.id.slice(0, 8);
        const groups = {};
        for (const a of alerts)
            (groups[a.status] ??= []).push(a.sku ?? '(no SKU)');
        const copy = {
            unmatched: { title: 'Order line not matched to stock', severity: 'error' },
            backorder: { title: 'Order is backordered', severity: 'error' },
            awaiting_procurement: { title: 'Stock must be acquired for an order', severity: 'warning' },
        };
        for (const [status, skus] of Object.entries(groups)) {
            const c = copy[status];
            if (!c)
                continue;
            await this.notifications
                .create({ type: `stock_${status}`, title: c.title, body: `Order ${ref}: ${skus.join(', ')}`, severity: c.severity, entityType: 'order', entityId: order.id, actionUrl: '/orders' })
                .catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
        }
    }
};
exports.OrderStockService = OrderStockService;
__decorate([
    (0, event_emitter_1.OnEvent)('order.new', { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderStockService.prototype, "onOrderNew", null);
__decorate([
    (0, event_emitter_1.OnEvent)('order.cancelled', { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderStockService.prototype, "onOrderCancelled", null);
__decorate([
    (0, event_emitter_1.OnEvent)('order.shipped', { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderStockService.prototype, "onOrderShipped", null);
__decorate([
    (0, event_emitter_1.OnEvent)(stock_operations_service_js_1.STOCK_RECEIVED_EVENT, { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderStockService.prototype, "onStockReceived", null);
__decorate([
    (0, event_emitter_1.OnEvent)(procurement_service_js_1.ORDER_LINE_STOCK_EVENT, { async: true, promisify: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderStockService.prototype, "onLineUpdated", null);
exports.OrderStockService = OrderStockService = OrderStockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        stock_access_service_js_1.StockAccessService,
        stock_ledger_service_js_1.StockLedgerService,
        reservations_service_js_1.ReservationsService,
        procurement_service_js_1.ProcurementService,
        warehouses_service_js_1.WarehousesService,
        notifications_service_js_1.NotificationsService])
], OrderStockService);
//# sourceMappingURL=order-stock.service.js.map