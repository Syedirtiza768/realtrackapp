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
exports.ReservationsService = void 0;
const common_1 = require("@nestjs/common");
const index_js_1 = require("./entities/index.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
const stock_operations_service_js_1 = require("./stock-operations.service.js");
let ReservationsService = class ReservationsService {
    ledger;
    ops;
    constructor(ledger, ops) {
        this.ledger = ledger;
        this.ops = ops;
    }
    async candidates(em, organizationId, itemId, storeId, needed) {
        const rows = (await em.query(`WITH linked AS (
         SELECT warehouse_id, priority FROM store_warehouse_links
          WHERE store_id = $3 AND active
       )
       SELECT sl.warehouse_id AS "warehouseId", sl.location_id AS "locationId", sl.available,
              COALESCE(lk.priority, CASE WHEN w.is_default THEN 1000 ELSE 2000 END) AS priority,
              COALESCE(l.is_pickable AND l.type IN ('storage','staging','receiving'), true) AS "isPickable",
              SUM(sl.available) OVER (PARTITION BY sl.warehouse_id) AS wh_total
         FROM stock_levels sl
         JOIN warehouses w ON w.id = sl.warehouse_id AND w.active AND w.is_sellable
         LEFT JOIN linked lk ON lk.warehouse_id = sl.warehouse_id
         LEFT JOIN warehouse_locations l ON l.id = sl.location_id
        WHERE sl.organization_id = $1 AND sl.inventory_item_id = $2 AND sl.available > 0
          AND (lk.warehouse_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM linked))
        ORDER BY (SUM(sl.available) OVER (PARTITION BY sl.warehouse_id) >= $4) DESC,
                 priority, "isPickable" DESC, sl.available DESC`, [organizationId, itemId, storeId, needed]));
        return rows.filter((r) => r.isPickable);
    }
    async allocate(em, organizationId, actorUserId, item, needed, target, restrictTo) {
        if (needed <= 0)
            return 0;
        const levels = restrictTo
            ? [{ ...restrictTo, available: needed, priority: 0, isPickable: true }]
            : await this.candidates(em, organizationId, item.id, target.storeId, needed);
        let remaining = needed;
        for (const lvl of levels) {
            if (remaining <= 0)
                break;
            const take = Math.min(remaining, lvl.available);
            if (take <= 0)
                continue;
            await this.reserveAt(em, organizationId, actorUserId, item, lvl.warehouseId, lvl.locationId, take, target);
            remaining -= take;
        }
        return needed - remaining;
    }
    async reserveAt(em, organizationId, actorUserId, item, warehouseId, locationId, qty, target) {
        const repo = em.getRepository(index_js_1.StockReservation);
        const reservation = await repo.save(repo.create({
            organizationId,
            inventoryItemId: item.id,
            warehouseId,
            locationId,
            orderId: target.orderId,
            orderItemId: target.orderItemId,
            storeId: target.storeId,
            quantity: qty,
            status: 'active',
        }));
        const base = {
            itemId: item.id,
            warehouseId,
            locationId,
            type: 'reserve',
            orderId: target.orderId,
            orderItemId: target.orderItemId,
            storeId: target.storeId,
        };
        let commands = [{ ...base, reserved: qty }];
        if (item.trackingMode !== 'quantity') {
            const units = await this.ops.pickUnits(em, item.id, warehouseId, locationId, ['available'], qty);
            if (units.length === 1) {
                reservation.unitId = units[0].id;
                await repo.save(reservation);
            }
            commands = units.map((u) => ({
                ...base,
                reserved: 1,
                unitId: u.id,
                unitPatch: { status: 'reserved', reservationId: reservation.id },
            }));
        }
        await this.ledger.apply({ organizationId, actorUserId }, commands, em);
        return reservation;
    }
    async release(em, organizationId, actorUserId, reservations, note) {
        const itemIds = [];
        for (const r of reservations) {
            if (r.status !== 'active' && r.status !== 'picked')
                continue;
            const units = (await em.query(`SELECT id FROM inventory_units WHERE reservation_id = $1 FOR UPDATE`, [r.id]));
            const base = {
                itemId: r.inventoryItemId,
                warehouseId: r.warehouseId,
                locationId: r.locationId,
                type: 'release',
                orderId: r.orderId,
                orderItemId: r.orderItemId,
                storeId: r.storeId,
                note,
            };
            const commands = units.length
                ? units.map((u) => ({ ...base, reserved: -1, unitId: u.id, unitPatch: { status: 'available', reservationId: null } }))
                : [{ ...base, reserved: -r.quantity }];
            await this.ledger.apply({ organizationId, actorUserId, operationKey: `release:${r.id}` }, commands, em);
            r.status = 'released';
            await em.getRepository(index_js_1.StockReservation).save(r);
            itemIds.push(r.inventoryItemId);
        }
        return itemIds;
    }
};
exports.ReservationsService = ReservationsService;
exports.ReservationsService = ReservationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stock_ledger_service_js_1.StockLedgerService,
        stock_operations_service_js_1.StockOperationsService])
], ReservationsService);
//# sourceMappingURL=reservations.service.js.map