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
exports.MotoarkStockService = void 0;
const common_1 = require("@nestjs/common");
const index_js_1 = require("../../stock/entities/index.js");
const reservations_service_js_1 = require("../../stock/reservations.service.js");
const stock_ledger_service_js_1 = require("../../stock/stock-ledger.service.js");
let MotoarkStockService = class MotoarkStockService {
    reservations;
    ledger;
    constructor(reservations, ledger) {
        this.reservations = reservations;
        this.ledger = ledger;
    }
    async reserve(em, ctx, line) {
        const item = await em.getRepository(index_js_1.InventoryItem).findOneByOrFail({
            id: line.inventory_item_id,
            organizationId: ctx.organizationId,
        });
        const n = await this.reservations.allocate(em, ctx.organizationId, ctx.actorUserId, item, line.quantity, {
            orderId: ctx.orderId,
            orderItemId: line.order_item_id,
            storeId: ctx.storeId,
        });
        if (n !== line.quantity)
            throw new common_1.BadRequestException('Insufficient mapped warehouse stock; event will remain pending');
    }
    async consume(em, ctx, line, quantity, ship) {
        if (quantity > line.quantity - line.shipped - line.cancelled)
            throw new common_1.BadRequestException('Quantity exceeds unshipped, uncancelled order quantity');
        const rows = await em.getRepository(index_js_1.StockReservation).find({
            where: {
                orderItemId: line.order_item_id,
                organizationId: ctx.organizationId,
            },
            order: { id: 'ASC' },
            lock: { mode: 'pessimistic_write' },
        });
        const commands = [];
        let remaining = quantity;
        for (const r of rows) {
            if (!remaining || !['active', 'picked'].includes(r.status))
                continue;
            const take = Math.min(remaining, r.quantity);
            const units = await em.query(`SELECT id FROM inventory_units WHERE reservation_id=$1 AND status IN ('reserved','picked') ORDER BY id FOR UPDATE`, [r.id]);
            let consumed = r;
            if (take < r.quantity) {
                consumed = await em.getRepository(index_js_1.StockReservation).save(em.getRepository(index_js_1.StockReservation).create({
                    organizationId: r.organizationId,
                    inventoryItemId: r.inventoryItemId,
                    warehouseId: r.warehouseId,
                    locationId: r.locationId,
                    orderId: r.orderId,
                    orderItemId: r.orderItemId,
                    storeId: r.storeId,
                    quantity: take,
                    status: ship ? 'shipped' : 'released',
                }));
                r.quantity -= take;
            }
            else
                r.status = ship ? 'shipped' : 'released';
            await em.getRepository(index_js_1.StockReservation).save(r);
            const base = {
                itemId: r.inventoryItemId,
                warehouseId: r.warehouseId,
                locationId: r.locationId,
                type: ship ? 'ship' : 'release',
                onHand: ship ? -take : 0,
                reserved: -take,
                orderId: ctx.orderId,
                orderItemId: line.order_item_id,
                sourceChannel: 'motoark',
                storeId: ctx.storeId,
            };
            if (units.length) {
                if (units.length < take)
                    throw new common_1.BadRequestException('Reservation unit identity is inconsistent');
                commands.push(...units.slice(0, take).map((u) => ({
                    ...base,
                    onHand: ship ? -1 : 0,
                    reserved: -1,
                    unitId: u.id,
                    unitPatch: {
                        status: ship ? 'shipped' : 'available',
                        reservationId: ship ? consumed.id : null,
                        ...(ship ? { warehouseId: null, locationId: null } : {}),
                    },
                })));
            }
            else {
                const item = await em
                    .getRepository(index_js_1.InventoryItem)
                    .findOneByOrFail({ id: line.inventory_item_id });
                if (item.trackingMode !== 'quantity')
                    throw new common_1.BadRequestException('Tracked reservation is missing physical units');
                commands.push(base);
            }
            remaining -= take;
        }
        if (remaining)
            throw new common_1.BadRequestException('Order reservation quantity is inconsistent');
        await this.apply(em, ctx, line, commands);
    }
    async returnAction(em, ctx, line, dto, returnId, action) {
        const [ret] = await em.query(`SELECT * FROM motoark_returns WHERE order_line_id=$1 AND external_return_id=$2 FOR UPDATE`, [line.id, returnId]);
        if (action === 'return.requested') {
            if (ret)
                throw new common_1.BadRequestException('Return ID already exists for this line');
            const [{ n }] = await em.query(`SELECT COALESCE(sum(requested),0)::int AS n FROM motoark_returns WHERE order_line_id=$1`, [line.id]);
            if (n + dto.quantity > line.shipped)
                throw new common_1.BadRequestException('Return request exceeds shipped quantity remaining eligible for return');
            await em.query(`INSERT INTO motoark_returns(order_line_id,external_return_id,requested) VALUES($1,$2,$3)`, [line.id, returnId, dto.quantity]);
            return;
        }
        if (!ret)
            throw new common_1.BadRequestException('Original return request has not arrived');
        const receipt = action === 'return.received';
        const dispose = action === 'return.disposed';
        if (receipt
            ? ret.received + dto.quantity > ret.requested
            : ret.restocked + ret.disposed + dto.quantity > ret.received) {
            throw new common_1.BadRequestException('Return quantity exceeds its remaining balance');
        }
        const item = await em.getRepository(index_js_1.InventoryItem).findOneByOrFail({
            id: line.inventory_item_id,
            organizationId: ctx.organizationId,
        });
        const units = dto.unitIds ?? [];
        if (item.trackingMode !== 'quantity' && units.length !== dto.quantity)
            throw new common_1.BadRequestException('One physical unit ID is required per returned tracked item');
        if (item.trackingMode === 'quantity' && units.length)
            throw new common_1.BadRequestException('Counted stock must not specify unit IDs');
        if (receipt &&
            ret.warehouse_id &&
            (ret.warehouse_id !== dto.warehouseId ||
                ret.location_id !== (dto.locationId ?? null))) {
            throw new common_1.BadRequestException('Partial receipts for a return must use its original quarantine location');
        }
        if (!dispose)
            await this.validateWarehouse(em, ctx, dto.warehouseId, dto.locationId, !receipt);
        if (!receipt)
            await this.validateWarehouse(em, ctx, ret.warehouse_id, ret.location_id, false);
        if (units.length) {
            const found = await em.query(`SELECT u.id FROM inventory_units u WHERE u.id=ANY($1::uuid[])
        AND u.organization_id=$2 AND u.inventory_item_id=$3 AND u.status=$4
        AND ${receipt
                ? `EXISTS(SELECT 1 FROM stock_movements m WHERE m.unit_id=u.id AND m.order_item_id=$5 AND m.movement_type='ship')`
                : `u.id=ANY($5::uuid[]) AND u.warehouse_id=$6 AND u.location_id IS NOT DISTINCT FROM $7::uuid`}
        ORDER BY u.id FOR UPDATE OF u`, receipt
                ? [units, ctx.organizationId, item.id, 'shipped', line.order_item_id]
                : [
                    units,
                    ctx.organizationId,
                    item.id,
                    'quarantined',
                    ret.unit_ids,
                    ret.warehouse_id,
                    ret.location_id,
                ]);
            if (found.length !== units.length)
                throw new common_1.BadRequestException('Unit IDs do not belong to the shipped line or pending physical return');
        }
        const base = {
            itemId: item.id,
            warehouseId: receipt ? dto.warehouseId : ret.warehouse_id,
            locationId: receipt ? (dto.locationId ?? null) : ret.location_id,
            type: receipt ? 'return_receipt' : dispose ? 'write_off' : 'transfer_out',
            onHand: receipt ? dto.quantity : -dto.quantity,
            orderId: ctx.orderId,
            orderItemId: line.order_item_id,
            sourceChannel: 'motoark',
            storeId: ctx.storeId,
        };
        const commands = [];
        const ids = units.length ? units : [null];
        for (const id of ids) {
            const amount = id ? 1 : dto.quantity;
            commands.push({
                ...base,
                onHand: receipt ? amount : -amount,
                unitId: id,
                ...(id && (receipt || dispose)
                    ? {
                        unitPatch: {
                            status: receipt
                                ? 'quarantined'
                                : 'written_off',
                            warehouseId: receipt ? dto.warehouseId : null,
                            locationId: receipt ? (dto.locationId ?? null) : null,
                            reservationId: null,
                        },
                    }
                    : {}),
            });
            if (!receipt && !dispose)
                commands.push({
                    ...base,
                    type: 'transfer_in',
                    warehouseId: dto.warehouseId,
                    locationId: dto.locationId ?? null,
                    onHand: amount,
                    unitId: id,
                    ...(id
                        ? {
                            unitPatch: {
                                status: 'available',
                                warehouseId: dto.warehouseId,
                                locationId: dto.locationId ?? null,
                                reservationId: null,
                            },
                        }
                        : {}),
                });
        }
        await this.apply(em, ctx, line, commands);
        if (receipt)
            await em.query(`UPDATE motoark_returns SET received=received+$2, warehouse_id=$3, location_id=$4, unit_ids=unit_ids||$5::uuid[] WHERE id=$1`, [ret.id, dto.quantity, dto.warehouseId, dto.locationId ?? null, units]);
        else
            await em.query(`UPDATE motoark_returns SET ${dispose ? 'disposed=disposed' : 'restocked=restocked'}+$2 WHERE id=$1`, [ret.id, dto.quantity]);
    }
    async validateWarehouse(em, ctx, warehouseId, locationId, sellable) {
        const [row] = await em.query(`SELECT w.id FROM warehouses w WHERE w.id=$1 AND w.organization_id=$2 AND w.active AND w.is_sellable=$3
      AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM warehouse_locations l WHERE l.id=$4 AND l.warehouse_id=w.id AND l.organization_id=$2 AND ($3=false OR (l.is_pickable AND l.type IN ('storage','staging','receiving')))))
      AND (NOT EXISTS(SELECT 1 FROM user_warehouse_assignments a WHERE a.user_id=$5 AND a.organization_id=$2)
        OR EXISTS(SELECT 1 FROM user_warehouse_assignments a WHERE a.user_id=$5 AND a.organization_id=$2 AND a.warehouse_id=w.id))`, [
            warehouseId ?? null,
            ctx.organizationId,
            sellable,
            locationId ?? null,
            ctx.actorUserId,
        ]);
        if (!row)
            throw new common_1.BadRequestException(sellable
                ? 'An accessible sellable warehouse/bin is required for inspected stock'
                : 'An accessible non-sellable quarantine warehouse is required');
    }
    async apply(em, ctx, line, commands) {
        await this.ledger.apply({
            organizationId: ctx.organizationId,
            actorUserId: ctx.actorUserId,
            operationKey: `${ctx.eventKey}:${line.id}`,
        }, commands, em);
    }
};
exports.MotoarkStockService = MotoarkStockService;
exports.MotoarkStockService = MotoarkStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reservations_service_js_1.ReservationsService,
        stock_ledger_service_js_1.StockLedgerService])
], MotoarkStockService);
//# sourceMappingURL=motoark-stock.service.js.map