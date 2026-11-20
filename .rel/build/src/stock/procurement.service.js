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
var ProcurementService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcurementService = exports.ORDER_LINE_STOCK_EVENT = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("typeorm");
const index_js_1 = require("./entities/index.js");
const stock_access_service_js_1 = require("./stock-access.service.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
const stock_operations_service_js_1 = require("./stock-operations.service.js");
const reservations_service_js_1 = require("./reservations.service.js");
const warehouses_service_js_1 = require("./warehouses.service.js");
exports.ORDER_LINE_STOCK_EVENT = 'stock.order-line.updated';
let ProcurementService = ProcurementService_1 = class ProcurementService {
    db;
    access;
    ledger;
    ops;
    reservations;
    warehouses;
    events;
    logger = new common_1.Logger(ProcurementService_1.name);
    constructor(db, access, ledger, ops, reservations, warehouses, events) {
        this.db = db;
        this.access = access;
        this.ledger = ledger;
        this.ops = ops;
        this.reservations = reservations;
        this.warehouses = warehouses;
        this.events = events;
    }
    async bestSource(em, itemId, mode) {
        const params = [itemId];
        if (mode)
            params.push(mode);
        const [row] = (await em.query(`SELECT x.* FROM inventory_item_sources x JOIN suppliers s ON s.id = x.supplier_id AND s.active
        WHERE x.inventory_item_id = $1 AND x.active ${mode ? 'AND x.fulfillment_mode = $2' : ''}
        ORDER BY (COALESCE(x.available_qty, 0) > 0) DESC, x.priority, x.unit_cost NULLS LAST
        LIMIT 1`, params));
        if (!row)
            return null;
        return em.getRepository(index_js_1.InventoryItemSource).findOneBy({ id: row.id });
    }
    async requestForOrderLine(em, organizationId, item, qty, target) {
        const source = await this.bestSource(em, item.id);
        let leadDays = source?.leadTimeDays ?? null;
        if (source && leadDays == null) {
            const s = await em.getRepository(index_js_1.Supplier).findOneBy({ id: source.supplierId });
            leadDays = s?.defaultLeadTimeDays ?? null;
        }
        const repo = em.getRepository(index_js_1.ProcurementRequest);
        return repo.save(repo.create({
            organizationId,
            inventoryItemId: item.id,
            quantity: qty,
            status: 'open',
            reason: 'order',
            fulfillmentMode: source?.fulfillmentMode ?? 'ship_to_warehouse',
            supplierId: source?.supplierId ?? null,
            sourceId: source?.id ?? null,
            warehouseId: target.warehouseId,
            orderId: target.orderId,
            orderItemId: target.orderItemId,
            storeId: target.storeId,
            estimatedUnitCost: source?.unitCost ?? item.unitCost ?? null,
            neededBy: leadDays != null ? new Date(Date.now() + leadDays * 86_400_000) : null,
        }));
    }
    async listRequests(scope, q) {
        const params = [scope.organizationId];
        const where = ['p.organization_id = $1'];
        if (q.status) {
            params.push(q.status.split(','));
            where.push(`p.status = ANY($${params.length})`);
        }
        if (q.supplierId) {
            params.push(q.supplierId);
            where.push(`p.supplier_id = $${params.length}`);
        }
        if (q.itemId) {
            params.push(q.itemId);
            where.push(`p.inventory_item_id = $${params.length}`);
        }
        const limit = q.limit ?? 100;
        const offset = q.offset ?? 0;
        const rows = await this.db.query(`SELECT p.id, p.status, p.reason, p.quantity, p.received_qty AS "receivedQty",
              p.fulfillment_mode AS "fulfillmentMode", p.inventory_item_id AS "itemId", i.sku, i.title,
              i.image_url AS "imageUrl", p.supplier_id AS "supplierId", s.name AS "supplierName",
              x.supplier_sku AS "supplierSku", x.url AS "sourceUrl", x.available_qty AS "supplierAvailable",
              p.estimated_unit_cost AS "estimatedUnitCost", p.warehouse_id AS "warehouseId", w.code AS "warehouseCode",
              p.purchase_order_id AS "purchaseOrderId", d.doc_number AS "purchaseOrderNumber",
              p.order_id AS "orderId", o.external_order_id AS "externalOrderId", o.status AS "orderStatus",
              o.buyer_username AS "buyerUsername", st.store_name AS "storeName",
              p.needed_by AS "neededBy", p.supplier_tracking AS "supplierTracking", p.note,
              p.created_at AS "createdAt", count(*) OVER()::int AS "totalCount"
         FROM procurement_requests p
         JOIN inventory_items i ON i.id = p.inventory_item_id
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN inventory_item_sources x ON x.id = p.source_id
         LEFT JOIN warehouses w ON w.id = p.warehouse_id
         LEFT JOIN stock_documents d ON d.id = p.purchase_order_id
         LEFT JOIN orders o ON o.id = p.order_id
         LEFT JOIN stores st ON st.id = p.store_id
        WHERE ${where.join(' AND ')}
        ORDER BY (p.status = 'open') DESC, p.needed_by NULLS LAST, p.created_at
        LIMIT ${limit} OFFSET ${offset}`, params);
        return { total: rows[0]?.totalCount ?? 0, items: rows };
    }
    async createRequest(scope, dto) {
        return this.db.transaction(async (em) => {
            const item = await this.ops.loadItem(em, scope, dto.itemId);
            if (dto.warehouseId)
                await this.ops.loadWarehouse(em, scope, dto.warehouseId);
            let source = null;
            if (dto.supplierId) {
                source = await em.getRepository(index_js_1.InventoryItemSource).findOneBy({ inventoryItemId: item.id, supplierId: dto.supplierId });
                const supplier = await em.getRepository(index_js_1.Supplier).findOneBy({ id: dto.supplierId, organizationId: scope.organizationId });
                if (!supplier)
                    throw new common_1.NotFoundException('Supplier not found');
            }
            else {
                source = await this.bestSource(em, item.id, dto.fulfillmentMode);
            }
            const repo = em.getRepository(index_js_1.ProcurementRequest);
            const saved = await repo.save(repo.create({
                organizationId: scope.organizationId,
                inventoryItemId: item.id,
                quantity: dto.quantity,
                reason: 'manual',
                status: 'open',
                fulfillmentMode: dto.fulfillmentMode ?? source?.fulfillmentMode ?? 'ship_to_warehouse',
                supplierId: dto.supplierId ?? source?.supplierId ?? null,
                sourceId: source?.id ?? null,
                warehouseId: dto.warehouseId ?? (await this.warehouses.ensureDefault(scope.organizationId, em)).id,
                estimatedUnitCost: source?.unitCost ?? item.unitCost ?? null,
                neededBy: dto.neededBy ? new Date(dto.neededBy) : null,
                note: dto.note ?? null,
                createdBy: scope.userId,
            }));
            return saved;
        });
    }
    async updateRequest(scope, id, dto) {
        return this.db.transaction(async (em) => {
            const req = await this.lockRequest(em, scope, id);
            if (req.status !== 'open')
                throw new common_1.BadRequestException('Only open requests can be edited');
            if (dto.supplierId) {
                const supplier = await em.getRepository(index_js_1.Supplier).findOneBy({ id: dto.supplierId, organizationId: scope.organizationId });
                if (!supplier)
                    throw new common_1.NotFoundException('Supplier not found');
                req.supplierId = supplier.id;
                const source = await em.getRepository(index_js_1.InventoryItemSource).findOneBy({ inventoryItemId: req.inventoryItemId, supplierId: supplier.id });
                req.sourceId = source?.id ?? null;
                if (source?.unitCost && dto.estimatedUnitCost === undefined)
                    req.estimatedUnitCost = source.unitCost;
            }
            if (dto.warehouseId) {
                await this.ops.loadWarehouse(em, scope, dto.warehouseId);
                req.warehouseId = dto.warehouseId;
            }
            if (dto.fulfillmentMode) {
                if (dto.fulfillmentMode === 'dropship' && !req.orderId)
                    throw new common_1.BadRequestException('Only order-driven requests can be dropshipped');
                req.fulfillmentMode = dto.fulfillmentMode;
            }
            if (dto.estimatedUnitCost !== undefined)
                req.estimatedUnitCost = String(dto.estimatedUnitCost);
            if (dto.note !== undefined)
                req.note = dto.note;
            return em.getRepository(index_js_1.ProcurementRequest).save(req);
        });
    }
    async cancelRequest(scope, id) {
        const req = await this.db.transaction(async (em) => {
            const r = await this.lockRequest(em, scope, id);
            if (r.status !== 'open')
                throw new common_1.BadRequestException(`A ${r.status} request cannot be cancelled; cancel or close its purchase order instead`);
            r.status = 'cancelled';
            return em.getRepository(index_js_1.ProcurementRequest).save(r);
        });
        if (req.orderItemId)
            this.events.emit(exports.ORDER_LINE_STOCK_EVENT, { orderItemId: req.orderItemId });
        return req;
    }
    async lockRequest(em, scope, id) {
        const r = await em.getRepository(index_js_1.ProcurementRequest).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
        if (!r)
            throw new common_1.NotFoundException('Procurement request not found');
        return r;
    }
    async markDropshipped(scope, id, dto) {
        const req = await this.db.transaction('READ COMMITTED', async (em) => {
            const r = await this.lockRequest(em, scope, id);
            if (!['open', 'ordered'].includes(r.status))
                throw new common_1.BadRequestException(`Request is ${r.status}`);
            if (!r.orderId)
                throw new common_1.BadRequestException('Only order-driven requests can be dropshipped');
            r.fulfillmentMode = 'dropship';
            r.status = 'dropshipped';
            r.receivedQty = r.quantity;
            r.supplierTracking = dto.supplierTracking?.trim() || null;
            if (dto.unitCost !== undefined)
                r.estimatedUnitCost = String(dto.unitCost);
            if (dto.note)
                r.note = [r.note, dto.note].filter(Boolean).join('\n');
            const warehouseId = r.warehouseId ?? (await this.warehouses.ensureDefault(scope.organizationId, em)).id;
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `dropship:${r.id}` }, [{
                    itemId: r.inventoryItemId,
                    warehouseId,
                    type: 'dropship',
                    orderId: r.orderId,
                    orderItemId: r.orderItemId,
                    storeId: r.storeId,
                    unitCost: r.estimatedUnitCost,
                    note: [dto.carrier, dto.supplierTracking].filter(Boolean).join(' ') || 'Dropshipped by supplier',
                }], em);
            return em.getRepository(index_js_1.ProcurementRequest).save(r);
        });
        if (req.orderItemId)
            this.events.emit(exports.ORDER_LINE_STOCK_EVENT, { orderItemId: req.orderItemId });
        return req;
    }
    async createPurchaseOrder(scope, dto) {
        if (!dto.requestIds?.length && !dto.lines?.length)
            throw new common_1.BadRequestException('Add procurement requests or lines to the purchase order');
        return this.db.transaction(async (em) => {
            const supplier = await em.getRepository(index_js_1.Supplier).findOneBy({ id: dto.supplierId, organizationId: scope.organizationId });
            if (!supplier)
                throw new common_1.NotFoundException('Supplier not found');
            await this.ops.loadWarehouse(em, scope, dto.warehouseId);
            const po = await this.ops.createDocument(em, scope, {
                docType: 'purchase_order',
                status: 'draft',
                warehouseId: dto.warehouseId,
                supplierId: supplier.id,
                reference: dto.reference ?? null,
                note: dto.note ?? null,
                currency: supplier.currency,
                expectedAt: dto.expectedAt
                    ? new Date(dto.expectedAt)
                    : new Date(Date.now() + supplier.defaultLeadTimeDays * 86_400_000),
            });
            const lineRepo = em.getRepository(index_js_1.StockDocumentLine);
            const requests = dto.requestIds?.length
                ? await em.getRepository(index_js_1.ProcurementRequest).find({
                    where: { id: (0, typeorm_1.In)(dto.requestIds), organizationId: scope.organizationId },
                    lock: { mode: 'pessimistic_write' },
                })
                : [];
            if (requests.length !== (dto.requestIds?.length ?? 0))
                throw new common_1.BadRequestException('Unknown procurement request');
            for (const r of requests) {
                if (r.status !== 'open')
                    throw new common_1.BadRequestException(`Request ${r.id} is ${r.status}`);
                if (r.fulfillmentMode === 'dropship')
                    throw new common_1.BadRequestException('Dropship requests are not received into a warehouse; mark them dropshipped instead');
                if (r.supplierId && r.supplierId !== supplier.id)
                    throw new common_1.BadRequestException('A request is assigned to a different supplier');
            }
            const byItem = new Map();
            for (const r of requests)
                byItem.set(r.inventoryItemId, [...(byItem.get(r.inventoryItemId) ?? []), r]);
            for (const [itemId, reqs] of byItem) {
                const source = await em.getRepository(index_js_1.InventoryItemSource).findOneBy({ inventoryItemId: itemId, supplierId: supplier.id });
                const qty = reqs.reduce((n, r) => n + (r.quantity - r.receivedQty), 0);
                const line = await lineRepo.save({
                    documentId: po.id,
                    inventoryItemId: itemId,
                    quantity: qty,
                    unitCost: source?.unitCost ?? reqs[0].estimatedUnitCost ?? null,
                    note: source?.supplierSku ? `Supplier SKU ${source.supplierSku}` : null,
                });
                for (const r of reqs) {
                    r.purchaseOrderId = po.id;
                    r.purchaseOrderLineId = line.id;
                    r.supplierId = supplier.id;
                    r.warehouseId = dto.warehouseId;
                }
            }
            await em.getRepository(index_js_1.ProcurementRequest).save(requests);
            for (const l of dto.lines ?? []) {
                if (l.quantity <= 0)
                    throw new common_1.BadRequestException('Purchase quantities must be positive');
                await this.ops.loadItem(em, scope, l.itemId);
                await this.ops.assertLocation(em, dto.warehouseId, l.locationId);
                await lineRepo.save({
                    documentId: po.id,
                    inventoryItemId: l.itemId,
                    locationId: l.locationId ?? null,
                    quantity: l.quantity,
                    unitCost: l.unitCost != null ? String(l.unitCost) : null,
                    note: l.note ?? null,
                });
            }
            return po;
        });
    }
    async purchaseOrdersFromRequests(scope, dto) {
        const requests = await this.db.getRepository(index_js_1.ProcurementRequest).findBy({ id: (0, typeorm_1.In)(dto.requestIds), organizationId: scope.organizationId });
        if (requests.length !== dto.requestIds.length)
            throw new common_1.BadRequestException('Unknown procurement request');
        const unassigned = requests.filter((r) => !r.supplierId);
        if (unassigned.length)
            throw new common_1.BadRequestException(`${unassigned.length} request(s) have no supplier yet; choose one first`);
        const bySupplier = new Map();
        for (const r of requests) {
            if (r.status !== 'open' || r.fulfillmentMode === 'dropship')
                continue;
            bySupplier.set(r.supplierId, [...(bySupplier.get(r.supplierId) ?? []), r]);
        }
        if (!bySupplier.size)
            throw new common_1.BadRequestException('No open ship-to-warehouse requests selected');
        const created = [];
        for (const [supplierId, reqs] of bySupplier) {
            const warehouseId = dto.warehouseId ?? reqs.find((r) => r.warehouseId)?.warehouseId ?? (await this.warehouses.ensureDefault(scope.organizationId)).id;
            created.push(await this.createPurchaseOrder(scope, { supplierId, warehouseId, requestIds: reqs.map((r) => r.id) }));
        }
        return created;
    }
    async orderPurchaseOrder(scope, id) {
        const itemIds = [];
        const po = await this.db.transaction('READ COMMITTED', async (em) => {
            const d = await this.lockPo(em, scope, id);
            if (d.status !== 'draft')
                throw new common_1.BadRequestException(`Purchase order is ${d.status}`);
            const lines = await em.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
            if (!lines.length)
                throw new common_1.BadRequestException('Purchase order has no lines');
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `po-order:${d.id}` }, lines.map((l) => ({ itemId: l.inventoryItemId, warehouseId: d.warehouseId, type: 'po_ordered', inbound: l.quantity, documentId: d.id, unitCost: l.unitCost })), em);
            itemIds.push(...lines.map((l) => l.inventoryItemId));
            await em.query(`UPDATE procurement_requests SET status = 'ordered', updated_at = now() WHERE purchase_order_id = $1 AND status = 'open'`, [id]);
            d.status = 'ordered';
            d.metadata = { ...d.metadata, orderedAt: new Date().toISOString(), orderedBy: scope.userId };
            return em.getRepository(index_js_1.StockDocument).save(d);
        });
        this.ledger.emitChanged(scope.organizationId, itemIds.map((itemId) => ({ itemId })));
        return po;
    }
    async receivePurchaseOrder(scope, id, dto) {
        const itemIds = [];
        const touchedOrderLines = [];
        const po = await this.db.transaction('READ COMMITTED', async (em) => {
            const d = await this.lockPo(em, scope, id);
            if (!['ordered', 'partially_received'].includes(d.status))
                throw new common_1.BadRequestException(`Purchase order is ${d.status}; mark it ordered first`);
            const lines = await em.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
            const byId = new Map(lines.map((l) => [l.id, l]));
            for (const r of dto.lines) {
                if (r.quantity === 0)
                    continue;
                const line = byId.get(r.lineId);
                if (!line)
                    throw new common_1.BadRequestException('Unknown purchase order line');
                if (line.processedQty + r.quantity > line.quantity)
                    throw new common_1.BadRequestException(`Receiving ${r.quantity} would exceed the ordered quantity (${line.quantity - line.processedQty} outstanding)`);
                const locationId = r.locationId ?? line.locationId ?? null;
                await this.ops.assertLocation(em, d.warehouseId, locationId);
                const item = await this.ops.loadItem(em, scope, line.inventoryItemId);
                itemIds.push(item.id);
                const base = {
                    itemId: item.id,
                    warehouseId: d.warehouseId,
                    locationId,
                    type: 'receipt',
                    documentId: d.id,
                    unitCost: line.unitCost,
                };
                const commands = [{ ...base, locationId: null, inbound: -r.quantity }];
                if (item.trackingMode !== 'quantity') {
                    commands.push(...(await this.ops.createReceivedUnits(em, scope, item, base, r.quantity, {
                        serials: r.serials,
                        unitCost: line.unitCost != null ? Number(line.unitCost) : null,
                    })));
                }
                else {
                    commands.push({ ...base, onHand: r.quantity });
                }
                await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId }, commands, em);
                if (line.unitCost != null)
                    await this.ops.updateAverageCost(em, item, r.quantity, Number(line.unitCost));
                line.processedQty += r.quantity;
                let left = r.quantity;
                const waiting = await em.getRepository(index_js_1.ProcurementRequest).find({
                    where: { purchaseOrderLineId: line.id, status: (0, typeorm_1.In)(['ordered', 'open']) },
                    order: { createdAt: 'ASC' },
                    lock: { mode: 'pessimistic_write' },
                });
                for (const req of waiting) {
                    if (left <= 0)
                        break;
                    const take = Math.min(left, req.quantity - req.receivedQty);
                    if (take <= 0)
                        continue;
                    if (req.orderItemId) {
                        await this.reservations.allocate(em, scope.organizationId, scope.userId, item, take, { orderId: req.orderId, orderItemId: req.orderItemId, storeId: req.storeId }, { warehouseId: d.warehouseId, locationId });
                        touchedOrderLines.push(req.orderItemId);
                    }
                    req.receivedQty += take;
                    if (req.receivedQty >= req.quantity)
                        req.status = 'received';
                    left -= take;
                }
                await em.getRepository(index_js_1.ProcurementRequest).save(waiting);
            }
            await em.getRepository(index_js_1.StockDocumentLine).save(lines);
            const done = lines.every((l) => l.processedQty >= l.quantity);
            d.status = done ? 'completed' : 'partially_received';
            if (done) {
                d.completedAt = new Date();
                d.completedBy = scope.userId;
            }
            return em.getRepository(index_js_1.StockDocument).save(d);
        });
        this.ops.afterReceipt(scope.organizationId, [...new Set(itemIds)]);
        for (const orderItemId of new Set(touchedOrderLines))
            this.events.emit(exports.ORDER_LINE_STOCK_EVENT, { orderItemId });
        return po;
    }
    async cancelPurchaseOrder(scope, id) {
        const itemIds = [];
        const po = await this.db.transaction('READ COMMITTED', async (em) => {
            const d = await this.lockPo(em, scope, id);
            if (['completed', 'cancelled'].includes(d.status))
                throw new common_1.BadRequestException(`Purchase order is ${d.status}`);
            const lines = await em.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
            if (d.status !== 'draft') {
                const commands = lines
                    .filter((l) => l.quantity > l.processedQty)
                    .map((l) => ({ itemId: l.inventoryItemId, warehouseId: d.warehouseId, type: 'po_cancelled', inbound: -(l.quantity - l.processedQty), documentId: d.id }));
                itemIds.push(...commands.map((c) => c.itemId));
                await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `po-cancel:${d.id}` }, commands, em);
            }
            await em.query(`UPDATE procurement_requests
            SET status = 'open', purchase_order_id = NULL, purchase_order_line_id = NULL, updated_at = now()
          WHERE purchase_order_id = $1 AND status IN ('open','ordered')`, [id]);
            const anyReceived = lines.some((l) => l.processedQty > 0);
            d.status = anyReceived ? 'completed' : 'cancelled';
            d.metadata = { ...d.metadata, closedShortAt: new Date().toISOString(), closedBy: scope.userId };
            return em.getRepository(index_js_1.StockDocument).save(d);
        });
        if (itemIds.length)
            this.ledger.emitChanged(scope.organizationId, itemIds.map((itemId) => ({ itemId })));
        return po;
    }
    async lockPo(em, scope, id) {
        const d = await em.getRepository(index_js_1.StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
        if (!d || d.docType !== 'purchase_order')
            throw new common_1.NotFoundException('Purchase order not found');
        this.access.assertWarehouse(scope, d.warehouseId);
        return d;
    }
    async reorderSuggestions(scope, createRequests = false) {
        const rows = (await this.db.query(`SELECT i.id, i.sku, i.title, i.reorder_point AS "reorderPoint", i.reorder_qty AS "reorderQty",
              COALESCE(sl.available,0)::int AS available, COALESCE(sl.inbound,0)::int AS inbound,
              COALESCE(pr.open_qty,0)::int AS "openRequests",
              (COALESCE(sl.available,0) + COALESCE(sl.inbound,0) + COALESCE(pr.open_qty,0))::int AS position
         FROM inventory_items i
         LEFT JOIN (SELECT inventory_item_id, SUM(available) available, SUM(inbound) inbound
                      FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id AND w.active
                     GROUP BY inventory_item_id) sl ON sl.inventory_item_id = i.id
         LEFT JOIN (SELECT inventory_item_id, SUM(quantity - received_qty) open_qty
                      FROM procurement_requests WHERE status = 'open' GROUP BY inventory_item_id) pr ON pr.inventory_item_id = i.id
        WHERE i.organization_id = $1 AND i.status = 'active' AND i.sourcing_mode <> 'on_demand'
          AND i.reorder_point > 0
          AND COALESCE(sl.available,0) + COALESCE(sl.inbound,0) + COALESCE(pr.open_qty,0) <= i.reorder_point
        ORDER BY position, i.sku
        LIMIT 500`, [scope.organizationId]));
        const suggestions = rows.map((r) => ({ ...r, suggestedQty: Math.max(r.reorderQty, r.reorderPoint - r.position + 1) }));
        if (!createRequests)
            return { suggestions, created: 0 };
        let created = 0;
        for (const s of suggestions) {
            await this.db.transaction(async (em) => {
                const item = await this.ops.loadItem(em, scope, s.id);
                const source = await this.bestSource(em, item.id, 'ship_to_warehouse');
                await em.getRepository(index_js_1.ProcurementRequest).save({
                    organizationId: scope.organizationId,
                    inventoryItemId: item.id,
                    quantity: s.suggestedQty,
                    reason: 'reorder',
                    status: 'open',
                    fulfillmentMode: 'ship_to_warehouse',
                    supplierId: source?.supplierId ?? null,
                    sourceId: source?.id ?? null,
                    warehouseId: (await this.warehouses.ensureDefault(scope.organizationId, em)).id,
                    estimatedUnitCost: source?.unitCost ?? item.unitCost ?? null,
                    createdBy: scope.userId,
                });
                created++;
            });
        }
        return { suggestions, created };
    }
    async summary(scope) {
        const [row] = (await this.db.query(`SELECT
         COUNT(*) FILTER (WHERE status = 'open')::int AS open,
         COUNT(*) FILTER (WHERE status = 'open' AND supplier_id IS NULL)::int AS "needsSupplier",
         COUNT(*) FILTER (WHERE status = 'ordered')::int AS ordered,
         COUNT(*) FILTER (WHERE status = 'open' AND fulfillment_mode = 'dropship')::int AS "dropshipPending",
         COUNT(*) FILTER (WHERE status IN ('open','ordered') AND needed_by < now())::int AS overdue
         FROM procurement_requests WHERE organization_id = $1`, [scope.organizationId]));
        return row;
    }
};
exports.ProcurementService = ProcurementService;
exports.ProcurementService = ProcurementService = ProcurementService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        stock_access_service_js_1.StockAccessService,
        stock_ledger_service_js_1.StockLedgerService,
        stock_operations_service_js_1.StockOperationsService,
        reservations_service_js_1.ReservationsService,
        warehouses_service_js_1.WarehousesService,
        event_emitter_1.EventEmitter2])
], ProcurementService);
//# sourceMappingURL=procurement.service.js.map