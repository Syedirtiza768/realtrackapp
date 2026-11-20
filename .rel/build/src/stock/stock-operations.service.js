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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockOperationsService = exports.ADJUST_APPROVAL_QTY = exports.STOCK_RECEIVED_EVENT = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("typeorm");
const index_js_1 = require("./entities/index.js");
const stock_access_service_js_1 = require("./stock-access.service.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
exports.STOCK_RECEIVED_EVENT = 'stock.received';
exports.ADJUST_APPROVAL_QTY = Number(process.env.STOCK_ADJUST_APPROVAL_QTY ?? 10);
const DOC_PREFIX = {
    receipt: 'RCV',
    transfer: 'TRF',
    adjustment: 'ADJ',
    count: 'CNT',
    purchase_order: 'PO',
};
let StockOperationsService = class StockOperationsService {
    db;
    access;
    ledger;
    events;
    constructor(db, access, ledger, events) {
        this.db = db;
        this.access = access;
        this.ledger = ledger;
        this.events = events;
    }
    async nextDocNumber(em, type) {
        const [{ n }] = (await em.query(`SELECT nextval('stock_document_seq')::bigint AS n`));
        return `${DOC_PREFIX[type]}-${String(n).padStart(6, '0')}`;
    }
    async loadItem(em, scope, itemId) {
        const item = await em.getRepository(index_js_1.InventoryItem).findOneBy({ id: itemId, organizationId: scope.organizationId });
        if (!item)
            throw new common_1.NotFoundException('Inventory item not found');
        return item;
    }
    async loadWarehouse(em, scope, warehouseId) {
        const w = await em.getRepository(index_js_1.Warehouse).findOneBy({ id: warehouseId, organizationId: scope.organizationId });
        if (!w)
            throw new common_1.NotFoundException('Warehouse not found');
        this.access.assertWarehouse(scope, w.id);
        if (!w.active)
            throw new common_1.BadRequestException(`Warehouse ${w.code} is inactive`);
        return w;
    }
    async assertLocation(em, warehouseId, locationId) {
        if (!locationId)
            return null;
        const loc = await em.getRepository(index_js_1.WarehouseLocation).findOneBy({ id: locationId, warehouseId });
        if (!loc)
            throw new common_1.BadRequestException('Bin does not belong to this warehouse');
        if (!loc.active)
            throw new common_1.BadRequestException(`Bin ${loc.code} is inactive`);
        return loc;
    }
    async pickUnits(em, itemId, warehouseId, locationId, statuses, qty, preferred) {
        const params = [itemId, warehouseId, statuses, qty];
        let locSql = '';
        if (locationId !== undefined) {
            params.push(locationId);
            locSql = `AND location_id IS NOT DISTINCT FROM $${params.length}::uuid`;
        }
        let order = 'received_at NULLS LAST, created_at';
        if (preferred) {
            params.push(preferred);
            order = `(id = $${params.length}) DESC, ${order}`;
        }
        const rows = (await em.query(`SELECT id FROM inventory_units
        WHERE inventory_item_id = $1 AND warehouse_id = $2 AND status = ANY($3) ${locSql}
        ORDER BY ${order} LIMIT $4 FOR UPDATE`, params));
        if (rows.length < qty)
            throw new common_1.BadRequestException(`Only ${rows.length} matching unit(s) found for this item${locationId !== undefined ? ' in that bin' : ''}; ${qty} needed`);
        return em.getRepository(index_js_1.InventoryUnit).findBy({ id: (0, typeorm_1.In)(rows.map((r) => r.id)) });
    }
    isUnitTracked(item) {
        return item.trackingMode === 'serial' || item.trackingMode === 'one_off';
    }
    async createReceivedUnits(em, scope, item, base, quantity, opts) {
        const serials = (opts.serials ?? []).map((s) => s.trim()).filter(Boolean);
        if (item.trackingMode === 'serial' && serials.length !== quantity)
            throw new common_1.BadRequestException(`Serial-tracked item: provide exactly ${quantity} serial number(s)`);
        if (new Set(serials).size !== serials.length)
            throw new common_1.BadRequestException('Duplicate serial numbers');
        const repo = em.getRepository(index_js_1.InventoryUnit);
        const units = await repo.save(Array.from({ length: quantity }, (_, i) => repo.create({
            organizationId: scope.organizationId,
            inventoryItemId: item.id,
            warehouseId: base.warehouseId,
            locationId: base.locationId ?? null,
            serialPrivate: serials[i] ?? null,
            serialPublic: null,
            lotCode: opts.lotCode ?? null,
            conditionId: opts.conditionId ?? null,
            status: 'available',
            unitCost: opts.unitCost != null ? String(opts.unitCost) : null,
            sourceRef: quantity === 1 ? opts.sourceRef ?? null : null,
            receivedAt: new Date(),
        }))).catch((err) => {
            if (err?.code === '23505')
                throw new common_1.BadRequestException('A serial number is already registered in this workspace');
            throw err;
        });
        return units.map((u) => ({ ...base, onHand: 1, unitId: u.id }));
    }
    async receive(scope, dto) {
        const opKey = dto.idempotencyKey ? `receive:${scope.organizationId}:${dto.idempotencyKey}` : null;
        const result = await this.db.transaction('READ COMMITTED', async (em) => {
            if (opKey) {
                const replay = await this.ledger.findByOperation(em, scope.organizationId, opKey);
                if (replay.length)
                    return { documentId: replay[0].documentId, replayed: true, itemId: dto.itemId };
            }
            const item = await this.loadItem(em, scope, dto.itemId);
            await this.loadWarehouse(em, scope, dto.warehouseId);
            await this.assertLocation(em, dto.warehouseId, dto.locationId);
            const doc = await this.createDocument(em, scope, {
                docType: 'receipt',
                status: 'completed',
                warehouseId: dto.warehouseId,
                reference: dto.reference ?? null,
                note: dto.note ?? null,
                completedAt: new Date(),
                completedBy: scope.userId,
            });
            await em.getRepository(index_js_1.StockDocumentLine).save({
                documentId: doc.id,
                inventoryItemId: item.id,
                locationId: dto.locationId ?? null,
                quantity: dto.quantity,
                processedQty: dto.quantity,
                unitCost: dto.unitCost != null ? String(dto.unitCost) : null,
                serials: dto.serials ?? [],
            });
            const base = {
                itemId: item.id,
                warehouseId: dto.warehouseId,
                locationId: dto.locationId ?? null,
                type: 'receipt',
                unitCost: dto.unitCost ?? null,
                documentId: doc.id,
                note: dto.note ?? null,
            };
            const commands = this.isUnitTracked(item)
                ? await this.createReceivedUnits(em, scope, item, base, dto.quantity, {
                    serials: dto.serials,
                    lotCode: dto.lotCode,
                    conditionId: dto.conditionId,
                    unitCost: dto.unitCost,
                })
                : [{ ...base, onHand: dto.quantity }];
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: opKey }, commands, em);
            if (dto.unitCost != null)
                await this.updateAverageCost(em, item, dto.quantity, dto.unitCost);
            return { documentId: doc.id, replayed: false, itemId: item.id };
        });
        if (!result.replayed)
            this.afterReceipt(scope.organizationId, [dto.itemId]);
        return result;
    }
    afterReceipt(organizationId, itemIds) {
        this.ledger.emitChanged(organizationId, itemIds.map((itemId) => ({ itemId })));
        this.events.emit(exports.STOCK_RECEIVED_EVENT, { organizationId, itemIds });
    }
    async updateAverageCost(em, item, qty, unitCost) {
        const [{ onHand }] = (await em.query(`SELECT COALESCE(SUM(on_hand),0)::int "onHand" FROM stock_levels WHERE inventory_item_id = $1`, [item.id]));
        const before = Math.max(0, onHand - qty);
        const current = item.unitCost != null ? Number(item.unitCost) : unitCost;
        const avg = before + qty > 0 ? (before * current + qty * unitCost) / (before + qty) : unitCost;
        await em.query(`UPDATE inventory_items SET unit_cost = $2, updated_at = now() WHERE id = $1`, [item.id, avg.toFixed(4)]);
    }
    async adjust(scope, dto, perms) {
        if (dto.quantity === 0)
            throw new common_1.BadRequestException('Quantity must not be zero');
        if (Math.abs(dto.quantity) > exports.ADJUST_APPROVAL_QTY && !perms.canApprove) {
            return this.createAdjustmentDocument(scope, {
                warehouseId: dto.warehouseId,
                reasonCode: dto.reasonCode,
                note: dto.note,
                lines: [{ itemId: dto.itemId, locationId: dto.locationId, unitId: dto.unitId, quantity: dto.quantity }],
            }, perms);
        }
        const opKey = dto.idempotencyKey ? `adjust:${scope.organizationId}:${dto.idempotencyKey}` : null;
        const res = await this.db.transaction('READ COMMITTED', async (em) => {
            if (opKey) {
                const replay = await this.ledger.findByOperation(em, scope.organizationId, opKey);
                if (replay.length)
                    return { status: 'completed', replayed: true };
            }
            const item = await this.loadItem(em, scope, dto.itemId);
            await this.loadWarehouse(em, scope, dto.warehouseId);
            await this.assertLocation(em, dto.warehouseId, dto.locationId);
            const commands = await this.adjustmentCommands(em, scope, item, {
                warehouseId: dto.warehouseId,
                locationId: dto.locationId ?? null,
                unitId: dto.unitId ?? null,
                quantity: dto.quantity,
                reasonCode: dto.reasonCode,
                note: dto.note ?? null,
                type: 'adjustment',
                documentId: null,
            });
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: opKey }, commands, em);
            return { status: 'completed', replayed: false };
        });
        if (!res.replayed)
            this.afterAdjust(scope.organizationId, [dto.itemId], dto.quantity);
        return res;
    }
    afterAdjust(organizationId, itemIds, qty) {
        if (qty > 0)
            this.afterReceipt(organizationId, itemIds);
        else
            this.ledger.emitChanged(organizationId, itemIds.map((itemId) => ({ itemId })));
    }
    async adjustmentCommands(em, scope, item, a) {
        const base = {
            itemId: item.id,
            warehouseId: a.warehouseId,
            locationId: a.locationId,
            type: a.type,
            reasonCode: a.reasonCode,
            note: a.note,
            documentId: a.documentId,
        };
        if (!this.isUnitTracked(item))
            return [{ ...base, onHand: a.quantity }];
        if (a.quantity > 0) {
            if (item.trackingMode === 'serial')
                throw new common_1.BadRequestException('Serial-tracked items gain stock through Receive, which records each serial number');
            return this.createReceivedUnits(em, scope, item, base, a.quantity, { lotCode: null });
        }
        const units = await this.pickUnits(em, item.id, a.warehouseId, a.locationId, ['available'], -a.quantity, a.unitId);
        return units.map((u) => ({ ...base, onHand: -1, unitId: u.id, unitPatch: { status: 'written_off', warehouseId: null, locationId: null } }));
    }
    async move(scope, dto) {
        const from = dto.fromLocationId ?? null;
        const to = dto.toLocationId ?? null;
        if (from === to)
            throw new common_1.BadRequestException('Source and destination bins are the same');
        const opKey = dto.idempotencyKey ? `move:${scope.organizationId}:${dto.idempotencyKey}` : null;
        await this.db.transaction('READ COMMITTED', async (em) => {
            const item = await this.loadItem(em, scope, dto.itemId);
            await this.loadWarehouse(em, scope, dto.warehouseId);
            await this.assertLocation(em, dto.warehouseId, from);
            await this.assertLocation(em, dto.warehouseId, to);
            const base = { itemId: item.id, warehouseId: dto.warehouseId, type: 'putaway' };
            let commands;
            if (this.isUnitTracked(item)) {
                const units = await this.pickUnits(em, item.id, dto.warehouseId, from, ['available'], dto.quantity, dto.unitId);
                commands = units.flatMap((u) => [
                    { ...base, locationId: from, onHand: -1, unitId: u.id },
                    { ...base, locationId: to, onHand: 1, unitId: u.id, unitPatch: { locationId: to } },
                ]);
            }
            else {
                commands = [
                    { ...base, locationId: from, onHand: -dto.quantity },
                    { ...base, locationId: to, onHand: dto.quantity },
                ];
            }
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: opKey }, commands, em);
        });
        this.ledger.emitChanged(scope.organizationId, [{ itemId: dto.itemId }]);
        return { moved: dto.quantity };
    }
    async damage(scope, dto) {
        if (dto.quantity === 0)
            throw new common_1.BadRequestException('Quantity must not be zero');
        await this.db.transaction('READ COMMITTED', async (em) => {
            const item = await this.loadItem(em, scope, dto.itemId);
            await this.loadWarehouse(em, scope, dto.warehouseId);
            await this.assertLocation(em, dto.warehouseId, dto.locationId);
            const base = { itemId: item.id, warehouseId: dto.warehouseId, locationId: dto.locationId ?? null, type: 'damage', note: dto.note ?? null };
            let commands = [{ ...base, damaged: dto.quantity }];
            if (this.isUnitTracked(item)) {
                const from = dto.quantity > 0 ? ['available'] : ['quarantined'];
                const units = await this.pickUnits(em, item.id, dto.warehouseId, dto.locationId ?? null, from, Math.abs(dto.quantity));
                commands = units.map((u) => ({
                    ...base,
                    damaged: dto.quantity > 0 ? 1 : -1,
                    unitId: u.id,
                    unitPatch: { status: dto.quantity > 0 ? 'quarantined' : 'available' },
                }));
            }
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId }, commands, em);
        });
        this.ledger.emitChanged(scope.organizationId, [{ itemId: dto.itemId }]);
        return { ok: true };
    }
    async createDocument(em, scope, data) {
        const repo = em.getRepository(index_js_1.StockDocument);
        return repo.save(repo.create({
            organizationId: scope.organizationId,
            docNumber: await this.nextDocNumber(em, data.docType),
            createdBy: scope.userId,
            metadata: {},
            ...data,
        }));
    }
    async listDocuments(scope, q) {
        const params = [scope.organizationId];
        const where = ['d.organization_id = $1'];
        if (q.type) {
            params.push(q.type);
            where.push(`d.doc_type = $${params.length}`);
        }
        if (q.status) {
            params.push(q.status.split(','));
            where.push(`d.status = ANY($${params.length})`);
        }
        if (q.warehouseId) {
            params.push(q.warehouseId);
            where.push(`(d.warehouse_id = $${params.length} OR d.dest_warehouse_id = $${params.length})`);
        }
        if (q.supplierId) {
            params.push(q.supplierId);
            where.push(`d.supplier_id = $${params.length}`);
        }
        if (scope.warehouseIds) {
            params.push(scope.warehouseIds);
            where.push(`(d.warehouse_id = ANY($${params.length}::uuid[]) OR d.dest_warehouse_id = ANY($${params.length}::uuid[]))`);
        }
        const limit = q.limit ?? 50;
        const offset = q.offset ?? 0;
        const rows = await this.db.query(`SELECT d.id, d.doc_type AS "docType", d.doc_number AS "docNumber", d.status, d.reason_code AS "reasonCode",
              d.reference, d.note, d.expected_at AS "expectedAt", d.created_at AS "createdAt", d.completed_at AS "completedAt",
              w.code AS "warehouseCode", dw.code AS "destWarehouseCode", s.name AS "supplierName",
              d.warehouse_id AS "warehouseId", d.dest_warehouse_id AS "destWarehouseId", d.supplier_id AS "supplierId",
              (SELECT count(*)::int FROM stock_document_lines l WHERE l.document_id = d.id) AS "lineCount",
              (SELECT COALESCE(SUM(abs(l.quantity)),0)::int FROM stock_document_lines l WHERE l.document_id = d.id) AS "totalQty",
              (SELECT COALESCE(SUM(l.processed_qty),0)::int FROM stock_document_lines l WHERE l.document_id = d.id) AS "processedQty",
              u.email AS "createdByEmail", count(*) OVER()::int AS "totalCount"
         FROM stock_documents d
         JOIN warehouses w ON w.id = d.warehouse_id
         LEFT JOIN warehouses dw ON dw.id = d.dest_warehouse_id
         LEFT JOIN suppliers s ON s.id = d.supplier_id
         LEFT JOIN users u ON u.id = d.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY d.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`, params);
        return { total: rows[0]?.totalCount ?? 0, items: rows };
    }
    async getDocument(scope, id) {
        const doc = await this.db.getRepository(index_js_1.StockDocument).findOneBy({ id, organizationId: scope.organizationId });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        this.access.assertWarehouse(scope, doc.warehouseId);
        const lines = await this.db.query(`SELECT l.id, l.inventory_item_id AS "itemId", i.sku, i.title, i.image_url AS "imageUrl",
              i.tracking_mode AS "trackingMode", l.location_id AS "locationId", fl.code AS "locationCode",
              l.dest_location_id AS "destLocationId", tl.code AS "destLocationCode", l.unit_id AS "unitId",
              l.quantity, l.processed_qty AS "processedQty", l.counted_qty AS "countedQty", l.system_qty AS "systemQty",
              l.unit_cost AS "unitCost", l.serials, l.note,
              (SELECT json_agg(json_build_object('id', p.id, 'orderId', p.order_id, 'quantity', p.quantity, 'status', p.status,
                       'fulfillmentMode', p.fulfillment_mode))
                 FROM procurement_requests p WHERE p.purchase_order_line_id = l.id) AS requests
         FROM stock_document_lines l
         JOIN inventory_items i ON i.id = l.inventory_item_id
         LEFT JOIN warehouse_locations fl ON fl.id = l.location_id
         LEFT JOIN warehouse_locations tl ON tl.id = l.dest_location_id
        WHERE l.document_id = $1
        ORDER BY fl.code NULLS LAST, i.sku`, [id]);
        const [refs] = (await this.db.query(`SELECT (SELECT json_build_object('id', id, 'code', code, 'name', name) FROM warehouses WHERE id = $1) AS warehouse,
              (SELECT json_build_object('id', id, 'code', code, 'name', name) FROM warehouses WHERE id = $2) AS "destWarehouse",
              (SELECT json_build_object('id', id, 'code', code, 'name', name, 'email', email) FROM suppliers WHERE id = $3) AS supplier`, [doc.warehouseId, doc.destWarehouseId, doc.supplierId]));
        return { ...doc, ...refs, lines };
    }
    async cancelDocument(scope, id) {
        const doc = await this.db.getRepository(index_js_1.StockDocument).findOneBy({ id, organizationId: scope.organizationId });
        if (!doc)
            throw new common_1.NotFoundException('Document not found');
        this.access.assertWarehouse(scope, doc.warehouseId);
        if (!['draft', 'pending_approval'].includes(doc.status))
            throw new common_1.BadRequestException(`A ${doc.status.replace('_', ' ')} document cannot be cancelled here`);
        doc.status = 'cancelled';
        return this.db.getRepository(index_js_1.StockDocument).save(doc);
    }
    async createAdjustmentDocument(scope, dto, perms) {
        const needsApproval = dto.lines.some((l) => Math.abs(l.quantity) > exports.ADJUST_APPROVAL_QTY);
        const doc = await this.db.transaction(async (em) => {
            await this.loadWarehouse(em, scope, dto.warehouseId);
            for (const l of dto.lines) {
                if (l.quantity === 0)
                    throw new common_1.BadRequestException('Adjustment lines must not be zero');
                await this.loadItem(em, scope, l.itemId);
                await this.assertLocation(em, dto.warehouseId, l.locationId);
            }
            const d = await this.createDocument(em, scope, {
                docType: 'adjustment',
                status: 'pending_approval',
                warehouseId: dto.warehouseId,
                reasonCode: dto.reasonCode,
                note: dto.note ?? null,
            });
            await em.getRepository(index_js_1.StockDocumentLine).save(dto.lines.map((l) => ({
                documentId: d.id,
                inventoryItemId: l.itemId,
                locationId: l.locationId ?? null,
                unitId: l.unitId ?? null,
                quantity: l.quantity,
                note: l.note ?? null,
            })));
            return d;
        });
        if (!needsApproval || perms.canApprove)
            return this.approveAdjustment(scope, doc.id, perms);
        return { ...doc, status: 'pending_approval', message: `Adjustments over ${exports.ADJUST_APPROVAL_QTY} units need manager approval` };
    }
    async approveAdjustment(scope, id, perms) {
        const itemIds = [];
        let net = 0;
        const doc = await this.db.transaction('READ COMMITTED', async (em) => {
            const d = await em.getRepository(index_js_1.StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
            if (!d)
                throw new common_1.NotFoundException('Document not found');
            this.access.assertWarehouse(scope, d.warehouseId);
            if (d.docType !== 'adjustment' && d.docType !== 'count')
                throw new common_1.BadRequestException('Not an adjustment or count');
            if (d.status !== 'pending_approval')
                throw new common_1.BadRequestException(`Document is ${d.status}`);
            const lines = await em.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
            const deltas = lines.map((l) => ({
                line: l,
                delta: d.docType === 'count' ? (l.countedQty ?? 0) - (l.systemQty ?? 0) : l.quantity,
            }));
            if (deltas.some((x) => Math.abs(x.delta) > exports.ADJUST_APPROVAL_QTY) && !perms.canApprove)
                throw new common_1.ForbiddenException('Manager approval (stock.adjust.approve) is required');
            const commands = [];
            for (const { line, delta } of deltas) {
                if (delta === 0)
                    continue;
                const item = await this.loadItem(em, scope, line.inventoryItemId);
                commands.push(...(await this.adjustmentCommands(em, scope, item, {
                    warehouseId: d.warehouseId,
                    locationId: line.locationId,
                    unitId: line.unitId,
                    quantity: delta,
                    reasonCode: d.reasonCode ?? (d.docType === 'count' ? 'count' : null),
                    note: line.note ?? d.note,
                    type: d.docType === 'count' ? 'count_variance' : 'adjustment',
                    documentId: d.id,
                })));
                itemIds.push(item.id);
                net += delta;
                line.processedQty = delta;
            }
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `doc-complete:${d.id}` }, commands, em);
            await em.getRepository(index_js_1.StockDocumentLine).save(lines);
            d.status = 'completed';
            d.approvedBy = scope.userId;
            d.completedBy = scope.userId;
            d.completedAt = new Date();
            return em.getRepository(index_js_1.StockDocument).save(d);
        });
        if (itemIds.length)
            this.afterAdjust(scope.organizationId, [...new Set(itemIds)], net);
        return doc;
    }
    async createTransfer(scope, dto) {
        if (dto.warehouseId === dto.destWarehouseId)
            throw new common_1.BadRequestException('Use a bin move to relocate stock inside one warehouse');
        return this.db.transaction(async (em) => {
            await this.loadWarehouse(em, scope, dto.warehouseId);
            await this.loadWarehouse(em, scope, dto.destWarehouseId);
            for (const l of dto.lines) {
                if (l.quantity <= 0)
                    throw new common_1.BadRequestException('Transfer quantities must be positive');
                await this.loadItem(em, scope, l.itemId);
                await this.assertLocation(em, dto.warehouseId, l.locationId);
                await this.assertLocation(em, dto.destWarehouseId, l.destLocationId);
            }
            const d = await this.createDocument(em, scope, {
                docType: 'transfer',
                status: 'draft',
                warehouseId: dto.warehouseId,
                destWarehouseId: dto.destWarehouseId,
                reference: dto.reference ?? null,
                note: dto.note ?? null,
                expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
            });
            await em.getRepository(index_js_1.StockDocumentLine).save(dto.lines.map((l) => ({
                documentId: d.id,
                inventoryItemId: l.itemId,
                locationId: l.locationId ?? null,
                destLocationId: l.destLocationId ?? null,
                unitId: l.unitId ?? null,
                quantity: l.quantity,
                note: l.note ?? null,
            })));
            return d;
        });
    }
    async shipTransfer(scope, id) {
        const itemIds = [];
        const doc = await this.db.transaction('READ COMMITTED', async (em) => {
            const d = await em.getRepository(index_js_1.StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
            if (!d || d.docType !== 'transfer')
                throw new common_1.NotFoundException('Transfer not found');
            this.access.assertWarehouse(scope, d.warehouseId);
            if (d.status !== 'draft')
                throw new common_1.BadRequestException(`Transfer is ${d.status}`);
            const lines = await em.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
            const commands = [];
            for (const line of lines) {
                const item = await this.loadItem(em, scope, line.inventoryItemId);
                itemIds.push(item.id);
                const out = { itemId: item.id, warehouseId: d.warehouseId, locationId: line.locationId, type: 'transfer_out', documentId: d.id };
                const inbound = { itemId: item.id, warehouseId: d.destWarehouseId, locationId: null, type: 'transfer_in', documentId: d.id, inbound: line.quantity };
                if (this.isUnitTracked(item)) {
                    const units = await this.pickUnits(em, item.id, d.warehouseId, line.locationId ?? undefined, ['available'], line.quantity, line.unitId);
                    line.serials = units.map((u) => u.id);
                    commands.push(...units.map((u) => ({ ...out, onHand: -1, unitId: u.id, unitPatch: { status: 'picked', locationId: null } })));
                }
                else {
                    commands.push({ ...out, onHand: -line.quantity });
                }
                commands.push(inbound);
            }
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `transfer-ship:${d.id}` }, commands, em);
            await em.getRepository(index_js_1.StockDocumentLine).save(lines);
            d.status = 'in_transit';
            d.metadata = { ...d.metadata, shippedAt: new Date().toISOString(), shippedBy: scope.userId };
            return em.getRepository(index_js_1.StockDocument).save(d);
        });
        this.ledger.emitChanged(scope.organizationId, itemIds.map((itemId) => ({ itemId })));
        return doc;
    }
    async receiveTransfer(scope, id, dto) {
        const itemIds = [];
        const doc = await this.db.transaction('READ COMMITTED', async (em) => {
            const d = await em.getRepository(index_js_1.StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
            if (!d || d.docType !== 'transfer')
                throw new common_1.NotFoundException('Transfer not found');
            this.access.assertWarehouse(scope, d.destWarehouseId);
            if (!['in_transit', 'partially_received'].includes(d.status))
                throw new common_1.BadRequestException(`Transfer is ${d.status}`);
            const lines = await em.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
            const byId = new Map(lines.map((l) => [l.id, l]));
            const commands = [];
            for (const r of dto.lines) {
                const line = byId.get(r.lineId);
                if (!line)
                    throw new common_1.BadRequestException('Unknown transfer line');
                if (r.quantity === 0)
                    continue;
                if (line.processedQty + r.quantity > line.quantity)
                    throw new common_1.BadRequestException(`Receiving more than was shipped for line ${line.id}`);
                const dest = r.locationId ?? line.destLocationId ?? null;
                await this.assertLocation(em, d.destWarehouseId, dest);
                const item = await this.loadItem(em, scope, line.inventoryItemId);
                itemIds.push(item.id);
                const base = { itemId: item.id, warehouseId: d.destWarehouseId, type: 'transfer_in', documentId: d.id };
                commands.push({ ...base, locationId: null, inbound: -r.quantity });
                if (this.isUnitTracked(item)) {
                    const unitIds = line.serials.slice(line.processedQty, line.processedQty + r.quantity);
                    commands.push(...unitIds.map((unitId) => ({
                        ...base,
                        locationId: dest,
                        onHand: 1,
                        unitId,
                        unitPatch: { status: 'available', warehouseId: d.destWarehouseId, locationId: dest },
                    })));
                }
                else {
                    commands.push({ ...base, locationId: dest, onHand: r.quantity });
                }
                line.processedQty += r.quantity;
            }
            if (!commands.length)
                throw new common_1.BadRequestException('Nothing to receive');
            await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId }, commands, em);
            await em.getRepository(index_js_1.StockDocumentLine).save(lines);
            const done = lines.every((l) => l.processedQty >= l.quantity);
            d.status = done ? 'completed' : 'partially_received';
            if (done) {
                d.completedAt = new Date();
                d.completedBy = scope.userId;
            }
            return em.getRepository(index_js_1.StockDocument).save(d);
        });
        this.afterReceipt(scope.organizationId, [...new Set(itemIds)]);
        return doc;
    }
    async createCount(scope, dto) {
        return this.db.transaction(async (em) => {
            await this.loadWarehouse(em, scope, dto.warehouseId);
            const params = [dto.warehouseId];
            const where = ['sl.warehouse_id = $1', 'sl.on_hand > 0'];
            if (dto.locationIds?.length) {
                params.push(dto.locationIds);
                where.push(`sl.location_id = ANY($${params.length}::uuid[])`);
            }
            if (dto.itemIds?.length) {
                params.push(dto.itemIds);
                where.push(`sl.inventory_item_id = ANY($${params.length}::uuid[])`);
            }
            const levels = (await em.query(`SELECT sl.inventory_item_id, sl.location_id, sl.on_hand FROM stock_levels sl WHERE ${where.join(' AND ')}`, params));
            if (!levels.length && !dto.locationIds?.length)
                throw new common_1.BadRequestException('Nothing with stock to count in that scope');
            const d = await this.createDocument(em, scope, {
                docType: 'count',
                status: 'draft',
                warehouseId: dto.warehouseId,
                note: dto.note ?? null,
                metadata: { locationIds: dto.locationIds ?? null, itemIds: dto.itemIds ?? null, blind: true },
            });
            await em.getRepository(index_js_1.StockDocumentLine).save(levels.map((l) => ({
                documentId: d.id,
                inventoryItemId: l.inventory_item_id,
                locationId: l.location_id,
                quantity: 0,
                systemQty: l.on_hand,
            })));
            return d;
        });
    }
    async recordCount(scope, id, dto) {
        return this.db.transaction(async (em) => {
            const d = await em.getRepository(index_js_1.StockDocument).findOneBy({ id, organizationId: scope.organizationId });
            if (!d || d.docType !== 'count')
                throw new common_1.NotFoundException('Count not found');
            this.access.assertWarehouse(scope, d.warehouseId);
            if (d.status !== 'draft')
                throw new common_1.BadRequestException(`Count is ${d.status}`);
            const repo = em.getRepository(index_js_1.StockDocumentLine);
            for (const r of dto.lines) {
                if (r.lineId) {
                    const line = await repo.findOneBy({ id: r.lineId, documentId: id });
                    if (!line)
                        throw new common_1.BadRequestException('Unknown count line');
                    line.countedQty = r.countedQty;
                    await repo.save(line);
                }
                else if (r.itemId) {
                    await this.loadItem(em, scope, r.itemId);
                    await this.assertLocation(em, d.warehouseId, r.locationId);
                    const existing = await repo.findOne({ where: { documentId: id, inventoryItemId: r.itemId, locationId: r.locationId ?? undefined } });
                    if (existing && (existing.locationId ?? null) === (r.locationId ?? null)) {
                        existing.countedQty = r.countedQty;
                        await repo.save(existing);
                    }
                    else {
                        await repo.save({ documentId: id, inventoryItemId: r.itemId, locationId: r.locationId ?? null, quantity: 0, systemQty: null, countedQty: r.countedQty, note: 'Found during count' });
                    }
                }
                else {
                    throw new common_1.BadRequestException('Each counted line needs lineId or itemId');
                }
            }
            return { saved: dto.lines.length };
        });
    }
    async submitCount(scope, id, perms) {
        const d = await this.db.transaction(async (em) => {
            const doc = await em.getRepository(index_js_1.StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
            if (!doc || doc.docType !== 'count')
                throw new common_1.NotFoundException('Count not found');
            this.access.assertWarehouse(scope, doc.warehouseId);
            if (doc.status !== 'draft')
                throw new common_1.BadRequestException(`Count is ${doc.status}`);
            const lines = await em.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
            const uncounted = lines.filter((l) => l.countedQty === null);
            if (uncounted.length)
                throw new common_1.BadRequestException(`${uncounted.length} line(s) have not been counted yet`);
            for (const l of lines) {
                const [row] = (await em.query(`SELECT on_hand FROM stock_levels WHERE inventory_item_id = $1 AND warehouse_id = $2 AND location_id IS NOT DISTINCT FROM $3::uuid`, [l.inventoryItemId, doc.warehouseId, l.locationId]));
                l.systemQty = row?.on_hand ?? 0;
            }
            await em.getRepository(index_js_1.StockDocumentLine).save(lines);
            doc.status = 'pending_approval';
            return em.getRepository(index_js_1.StockDocument).save(doc);
        });
        const lines = await this.db.getRepository(index_js_1.StockDocumentLine).findBy({ documentId: id });
        const variances = lines.filter((l) => (l.countedQty ?? 0) !== (l.systemQty ?? 0));
        const needsApproval = variances.some((l) => Math.abs((l.countedQty ?? 0) - (l.systemQty ?? 0)) > exports.ADJUST_APPROVAL_QTY);
        if (!needsApproval || perms.canApprove)
            return this.approveAdjustment(scope, id, perms);
        return { ...d, variances: variances.length, message: `Variances over ${exports.ADJUST_APPROVAL_QTY} units need manager approval` };
    }
    async listMovements(scope, q) {
        const params = [scope.organizationId];
        const where = ['m.organization_id = $1'];
        if (q.itemId) {
            params.push(q.itemId);
            where.push(`m.inventory_item_id = $${params.length}`);
        }
        if (q.warehouseId) {
            params.push(q.warehouseId);
            where.push(`m.warehouse_id = $${params.length}`);
        }
        if (q.type) {
            params.push(q.type.split(','));
            where.push(`m.movement_type = ANY($${params.length})`);
        }
        if (q.orderId) {
            params.push(q.orderId);
            where.push(`m.order_id = $${params.length}`);
        }
        if (q.documentId) {
            params.push(q.documentId);
            where.push(`m.document_id = $${params.length}`);
        }
        if (q.from) {
            params.push(q.from);
            where.push(`m.created_at >= $${params.length}`);
        }
        if (q.to) {
            params.push(q.to);
            where.push(`m.created_at < $${params.length}`);
        }
        where.push(this.access.warehouseFilter(scope, 'm.warehouse_id', params));
        const limit = q.limit ?? 100;
        const offset = q.offset ?? 0;
        const rows = await this.db.query(`SELECT m.id, m.movement_type AS "type", m.inventory_item_id AS "itemId", i.sku, i.title,
              m.qty_on_hand AS "qtyOnHand", m.qty_reserved AS "qtyReserved", m.qty_damaged AS "qtyDamaged",
              m.qty_inbound AS "qtyInbound", m.on_hand_after AS "onHandAfter", m.reserved_after AS "reservedAfter",
              m.reason_code AS "reasonCode", m.note, w.code AS "warehouseCode", l.code AS "locationCode",
              m.document_id AS "documentId", d.doc_number AS "documentNumber", m.order_id AS "orderId",
              o.external_order_id AS "externalOrderId", m.source_channel AS "sourceChannel",
              u.email AS "actorEmail", m.created_at AS "createdAt", count(*) OVER()::int AS "totalCount"
         FROM stock_movements m
         JOIN inventory_items i ON i.id = m.inventory_item_id
         JOIN warehouses w ON w.id = m.warehouse_id
         LEFT JOIN warehouse_locations l ON l.id = m.location_id
         LEFT JOIN stock_documents d ON d.id = m.document_id
         LEFT JOIN orders o ON o.id = m.order_id
         LEFT JOIN users u ON u.id = m.actor_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY m.created_at DESC, m.idempotency_key DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}`, params);
        return { total: rows[0]?.totalCount ?? 0, items: rows };
    }
};
exports.StockOperationsService = StockOperationsService;
exports.StockOperationsService = StockOperationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        stock_access_service_js_1.StockAccessService,
        stock_ledger_service_js_1.StockLedgerService,
        event_emitter_1.EventEmitter2])
], StockOperationsService);
//# sourceMappingURL=stock-operations.service.js.map