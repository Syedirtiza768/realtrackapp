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
var StockLedgerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockLedgerService = exports.STOCK_CHANGED_EVENT = exports.InsufficientStockException = void 0;
exports.isUniqueViolation = isUniqueViolation;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("typeorm");
const index_js_1 = require("./entities/index.js");
class InsufficientStockException extends common_1.ConflictException {
    details;
    constructor(details) {
        super({
            message: 'Insufficient stock: this change would make on-hand, reserved, or inbound quantity invalid.',
            code: 'INSUFFICIENT_STOCK',
            details,
        });
        this.details = details;
    }
}
exports.InsufficientStockException = InsufficientStockException;
const levelKey = (item, wh, loc) => `${item}|${wh}|${loc ?? ''}`;
exports.STOCK_CHANGED_EVENT = 'stock.changed';
let StockLedgerService = StockLedgerService_1 = class StockLedgerService {
    db;
    events;
    logger = new common_1.Logger(StockLedgerService_1.name);
    constructor(db, events) {
        this.db = db;
        this.events = events;
    }
    async apply(ctx, commands, em) {
        if (commands.length === 0)
            return { movements: [], replayed: false };
        this.validateCommands(commands);
        if (em) {
            const result = await this.applyInTransaction(ctx, commands, em);
            return result;
        }
        try {
            const result = await this.db.transaction('READ COMMITTED', (tx) => this.applyInTransaction(ctx, commands, tx));
            if (!result.replayed)
                this.emitChanged(ctx.organizationId, commands);
            return result;
        }
        catch (err) {
            if (ctx.operationKey && isUniqueViolation(err, 'uq_sm_idempotency')) {
                const movements = await this.findByOperation(this.db.manager, ctx.organizationId, ctx.operationKey);
                if (movements.length)
                    return { movements, replayed: true };
            }
            throw err;
        }
    }
    emitChanged(organizationId, commands) {
        const itemIds = [...new Set(commands.map((c) => c.itemId))];
        this.events.emit(exports.STOCK_CHANGED_EVENT, { organizationId, itemIds });
    }
    async findByOperation(em, organizationId, operationKey) {
        return em.getRepository(index_js_1.StockMovement).find({
            where: { organizationId, operationKey },
            order: { idempotencyKey: 'ASC' },
        });
    }
    async markChannelDirty(em, organizationId, itemIds) {
        if (!itemIds.length)
            return;
        await em.query(`INSERT INTO channel_stock_sync_state (store_id, inventory_item_id, organization_id, dirty, status, updated_at)
       SELECT DISTINCT l.store_id, i.id, $1::uuid, true, 'pending', now()
         FROM store_warehouse_links l
         JOIN warehouses w ON w.id = l.warehouse_id AND w.organization_id = $1
         CROSS JOIN unnest($2::uuid[]) AS i(id)
        WHERE l.active
       ON CONFLICT (store_id, inventory_item_id)
       DO UPDATE SET dirty = true, updated_at = now()`, [organizationId, itemIds]);
    }
    validateCommands(commands) {
        for (const c of commands) {
            for (const key of ['onHand', 'reserved', 'damaged', 'inbound']) {
                const v = c[key];
                if (v !== undefined && (!Number.isInteger(v) || Math.abs(v) > 1_000_000))
                    throw new common_1.BadRequestException(`Invalid ${key} delta: ${v}`);
            }
            if (!c.itemId || !c.warehouseId)
                throw new common_1.BadRequestException('itemId and warehouseId are required');
        }
    }
    async applyInTransaction(ctx, commands, em) {
        const org = ctx.organizationId;
        if (ctx.operationKey) {
            const existing = await this.findByOperation(em, org, ctx.operationKey);
            if (existing.length)
                return { movements: existing, replayed: true };
        }
        await this.assertOwnership(em, org, commands);
        const keys = [
            ...new Map(commands.map((c) => [
                levelKey(c.itemId, c.warehouseId, c.locationId),
                {
                    itemId: c.itemId,
                    warehouseId: c.warehouseId,
                    locationId: c.locationId ?? null,
                },
            ])).entries(),
        ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        for (const [, k] of keys) {
            await em.query(`INSERT INTO stock_levels (organization_id, inventory_item_id, warehouse_id, location_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ON CONSTRAINT uq_sl_item_wh_loc DO NOTHING`, [org, k.itemId, k.warehouseId, k.locationId]);
        }
        const rows = new Map();
        for (const [key, k] of keys) {
            const [row] = (await em.query(`SELECT id, inventory_item_id, warehouse_id, location_id, on_hand, reserved, damaged, inbound
           FROM stock_levels
          WHERE inventory_item_id = $1 AND warehouse_id = $2
            AND location_id IS NOT DISTINCT FROM $3::uuid
          FOR UPDATE`, [k.itemId, k.warehouseId, k.locationId]));
            rows.set(key, row);
        }
        const afters = [];
        for (const c of commands) {
            const row = rows.get(levelKey(c.itemId, c.warehouseId, c.locationId));
            row.on_hand += c.onHand ?? 0;
            row.reserved += c.reserved ?? 0;
            row.damaged += c.damaged ?? 0;
            row.inbound += c.inbound ?? 0;
            afters.push({ onHand: row.on_hand, reserved: row.reserved });
        }
        const violations = [...rows.values()].filter((r) => r.on_hand < 0 ||
            r.reserved < 0 ||
            r.damaged < 0 ||
            r.inbound < 0 ||
            r.reserved + r.damaged > r.on_hand);
        if (violations.length) {
            throw new InsufficientStockException(violations.map((r) => ({
                itemId: r.inventory_item_id,
                warehouseId: r.warehouse_id,
                locationId: r.location_id,
                onHand: r.on_hand,
                reserved: r.reserved,
                damaged: r.damaged,
                inbound: r.inbound,
            })));
        }
        const receivedRows = new Set(commands
            .filter((c) => (c.onHand ?? 0) > 0 && RECEIVING_TYPES.has(c.type))
            .map((c) => levelKey(c.itemId, c.warehouseId, c.locationId)));
        for (const [key, row] of rows) {
            await em.query(`UPDATE stock_levels
            SET on_hand = $2, reserved = $3, damaged = $4, inbound = $5,
                version = version + 1, updated_at = now()
                ${receivedRows.has(key) ? ', last_received_at = now()' : ''}
          WHERE id = $1`, [row.id, row.on_hand, row.reserved, row.damaged, row.inbound]);
        }
        const repo = em.getRepository(index_js_1.StockMovement);
        const movements = await repo.save(commands.map((c, i) => repo.create({
            organizationId: org,
            inventoryItemId: c.itemId,
            warehouseId: c.warehouseId,
            locationId: c.locationId ?? null,
            unitId: c.unitId ?? null,
            movementType: c.type,
            qtyOnHand: c.onHand ?? 0,
            qtyReserved: c.reserved ?? 0,
            qtyDamaged: c.damaged ?? 0,
            qtyInbound: c.inbound ?? 0,
            onHandAfter: afters[i].onHand,
            reservedAfter: afters[i].reserved,
            unitCost: c.unitCost === undefined || c.unitCost === null
                ? null
                : String(c.unitCost),
            reasonCode: c.reasonCode ?? null,
            note: c.note ?? null,
            documentId: c.documentId ?? null,
            sourceChannel: c.sourceChannel ?? null,
            storeId: c.storeId ?? null,
            orderId: c.orderId ?? null,
            orderItemId: c.orderItemId ?? null,
            operationKey: ctx.operationKey ?? null,
            idempotencyKey: ctx.operationKey
                ? `${ctx.operationKey}#${String(i).padStart(4, '0')}`
                : null,
            actorUserId: ctx.actorUserId ?? null,
        })));
        for (const c of commands) {
            if (!c.unitId || !c.unitPatch)
                continue;
            const p = c.unitPatch;
            const sets = [];
            const params = [c.unitId, org];
            const push = (col, v) => {
                params.push(v);
                sets.push(`${col} = $${params.length}`);
            };
            if (p.status !== undefined)
                push('status', p.status);
            if (p.warehouseId !== undefined)
                push('warehouse_id', p.warehouseId);
            if (p.locationId !== undefined)
                push('location_id', p.locationId);
            if (p.reservationId !== undefined)
                push('reservation_id', p.reservationId);
            if (!sets.length)
                continue;
            await em.query(`UPDATE inventory_units SET ${sets.join(', ')}, updated_at = now()
          WHERE id = $1 AND organization_id = $2`, params);
        }
        const itemIds = [...new Set(commands.map((c) => c.itemId))];
        await this.markChannelDirty(em, org, itemIds);
        await this.projectLegacyQuantities(em, org, itemIds);
        return { movements, replayed: false };
    }
    async assertOwnership(em, org, commands) {
        const itemIds = [...new Set(commands.map((c) => c.itemId))];
        const whIds = [...new Set(commands.map((c) => c.warehouseId))];
        const locIds = [
            ...new Set(commands.map((c) => c.locationId).filter(Boolean)),
        ];
        const [{ items, whs, locs }] = (await em.query(`SELECT
         (SELECT count(*)::int FROM inventory_items WHERE organization_id = $1 AND id = ANY($2::uuid[])) AS items,
         (SELECT count(*)::int FROM warehouses WHERE organization_id = $1 AND id = ANY($3::uuid[])) AS whs,
         (SELECT count(*)::int FROM warehouse_locations l
            WHERE l.organization_id = $1 AND l.id = ANY($4::uuid[])) AS locs`, [org, itemIds, whIds, locIds]));
        if (items !== itemIds.length)
            throw new common_1.BadRequestException('Unknown inventory item for this workspace');
        if (whs !== whIds.length)
            throw new common_1.BadRequestException('Unknown warehouse for this workspace');
        if (locs !== locIds.length)
            throw new common_1.BadRequestException('Unknown bin location for this workspace');
        if (locIds.length) {
            const mismatched = commands.filter((c) => c.locationId);
            const pairs = (await em.query(`SELECT id, warehouse_id FROM warehouse_locations WHERE id = ANY($1::uuid[])`, [locIds]));
            const byId = new Map(pairs.map((p) => [p.id, p.warehouse_id]));
            for (const c of mismatched) {
                if (byId.get(c.locationId) !== c.warehouseId)
                    throw new common_1.BadRequestException('Bin location does not belong to the given warehouse');
            }
        }
    }
    async projectLegacyQuantities(em, org, itemIds) {
        const totals = (await em.query(`SELECT i.id, i.catalog_product_id, i.listing_record_id, i.product_variant_id,
              COALESCE(SUM(sl.available) FILTER (WHERE w.is_sellable AND w.active), 0)::int AS available
         FROM inventory_items i
         LEFT JOIN stock_levels sl ON sl.inventory_item_id = i.id
         LEFT JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE i.organization_id = $1 AND i.id = ANY($2::uuid[]) AND i.sourcing_mode = 'stocked'
        GROUP BY i.id`, [org, itemIds]));
        for (const t of totals) {
            if (t.catalog_product_id)
                await em.query(`UPDATE catalog_products SET quantity = $2 WHERE id = $1 AND quantity IS DISTINCT FROM $2`, [t.catalog_product_id, t.available]);
            if (t.listing_record_id)
                await em.query(`UPDATE listing_records SET quantity = $2::text, "quantityNum" = $2
            WHERE id = $1 AND "quantityNum" IS DISTINCT FROM $2`, [t.listing_record_id, t.available]);
            if (t.product_variant_id)
                await em.query(`UPDATE product_variants SET quantity = $2 WHERE id = $1 AND quantity IS DISTINCT FROM $2`, [t.product_variant_id, t.available]);
        }
    }
};
exports.StockLedgerService = StockLedgerService;
exports.StockLedgerService = StockLedgerService = StockLedgerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        event_emitter_1.EventEmitter2])
], StockLedgerService);
const RECEIVING_TYPES = new Set([
    'opening_balance',
    'receipt',
    'transfer_in',
    'return_receipt',
]);
function isUniqueViolation(err, constraint) {
    const e = err;
    const code = e?.code ?? e?.driverError?.code;
    const name = e?.constraint ?? e?.driverError?.constraint;
    return code === '23505' && (!constraint || name === constraint);
}
//# sourceMappingURL=stock-ledger.service.js.map