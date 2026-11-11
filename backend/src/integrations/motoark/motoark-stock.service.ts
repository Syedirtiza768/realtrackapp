import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InventoryItem, StockReservation } from '../../stock/entities/index.js';
import { ReservationsService } from '../../stock/reservations.service.js';
import {
  StockLedgerService,
  StockMovementCommand,
} from '../../stock/stock-ledger.service.js';
import type { MotoarkReturnRow } from './motoark.types.js';
import type { MotoarkLineDto } from './motoark.dto.js';

export interface MotoarkStockLine {
  id: string;
  inventory_item_id: string;
  order_item_id: string;
  quantity: number;
  shipped: number;
  cancelled: number;
}
export interface MotoarkStockContext {
  organizationId: string;
  actorUserId: string;
  storeId: string;
  orderId: string;
  eventKey: string;
}

@Injectable()
export class MotoarkStockService {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly ledger: StockLedgerService,
  ) {}

  async reserve(
    em: EntityManager,
    ctx: MotoarkStockContext,
    line: MotoarkStockLine,
  ) {
    const item = await em.getRepository(InventoryItem).findOneByOrFail({
      id: line.inventory_item_id,
      organizationId: ctx.organizationId,
    });
    const n = await this.reservations.allocate(
      em,
      ctx.organizationId,
      ctx.actorUserId,
      item,
      line.quantity,
      {
        orderId: ctx.orderId,
        orderItemId: line.order_item_id,
        storeId: ctx.storeId,
      },
    );
    if (n !== line.quantity)
      throw new BadRequestException(
        'Insufficient mapped warehouse stock; event will remain pending',
      );
  }

  async consume(
    em: EntityManager,
    ctx: MotoarkStockContext,
    line: MotoarkStockLine,
    quantity: number,
    ship: boolean,
  ) {
    if (quantity > line.quantity - line.shipped - line.cancelled)
      throw new BadRequestException(
        'Quantity exceeds unshipped, uncancelled order quantity',
      );
    const rows = await em.getRepository(StockReservation).find({
      where: {
        orderItemId: line.order_item_id,
        organizationId: ctx.organizationId,
      },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const commands: StockMovementCommand[] = [];
    let remaining = quantity;
    for (const r of rows) {
      if (!remaining || !['active', 'picked'].includes(r.status)) continue;
      const take = Math.min(remaining, r.quantity);
      const units = await em.query<Array<{ id: string }>>(
        `SELECT id FROM inventory_units WHERE reservation_id=$1 AND status IN ('reserved','picked') ORDER BY id FOR UPDATE`,
        [r.id],
      );
      let consumed = r;
      if (take < r.quantity) {
        consumed = await em.getRepository(StockReservation).save(
          em.getRepository(StockReservation).create({
            organizationId: r.organizationId,
            inventoryItemId: r.inventoryItemId,
            warehouseId: r.warehouseId,
            locationId: r.locationId,
            orderId: r.orderId,
            orderItemId: r.orderItemId,
            storeId: r.storeId,
            quantity: take,
            status: ship ? 'shipped' : 'released',
          }),
        );
        r.quantity -= take;
      } else r.status = ship ? 'shipped' : 'released';
      await em.getRepository(StockReservation).save(r);
      const base: StockMovementCommand = {
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
          throw new BadRequestException(
            'Reservation unit identity is inconsistent',
          );
        commands.push(
          ...units.slice(0, take).map((u) => ({
            ...base,
            onHand: ship ? -1 : 0,
            reserved: -1,
            unitId: u.id,
            unitPatch: {
              status: ship ? ('shipped' as const) : ('available' as const),
              reservationId: ship ? consumed.id : null,
              ...(ship ? { warehouseId: null, locationId: null } : {}),
            },
          })),
        );
      } else {
        const item = await em
          .getRepository(InventoryItem)
          .findOneByOrFail({ id: line.inventory_item_id });
        if (item.trackingMode !== 'quantity')
          throw new BadRequestException(
            'Tracked reservation is missing physical units',
          );
        commands.push(base);
      }
      remaining -= take;
    }
    if (remaining)
      throw new BadRequestException(
        'Order reservation quantity is inconsistent',
      );
    await this.apply(em, ctx, line, commands);
  }

  async returnAction(
    em: EntityManager,
    ctx: MotoarkStockContext,
    line: MotoarkStockLine,
    dto: MotoarkLineDto,
    returnId: string,
    action: string,
  ) {
    const [ret] = await em.query<MotoarkReturnRow[]>(
      `SELECT * FROM motoark_returns WHERE order_line_id=$1 AND external_return_id=$2 FOR UPDATE`,
      [line.id, returnId],
    );
    if (action === 'return.requested') {
      if (ret)
        throw new BadRequestException('Return ID already exists for this line');
      const [{ n }] = await em.query<Array<{ n: number }>>(
        `SELECT COALESCE(sum(requested),0)::int AS n FROM motoark_returns WHERE order_line_id=$1`,
        [line.id],
      );
      if (n + dto.quantity > line.shipped)
        throw new BadRequestException(
          'Return request exceeds shipped quantity remaining eligible for return',
        );
      await em.query(
        `INSERT INTO motoark_returns(order_line_id,external_return_id,requested) VALUES($1,$2,$3)`,
        [line.id, returnId, dto.quantity],
      );
      return;
    }
    if (!ret)
      throw new BadRequestException('Original return request has not arrived');
    const receipt = action === 'return.received';
    const dispose = action === 'return.disposed';
    if (
      receipt
        ? ret.received + dto.quantity > ret.requested
        : ret.restocked + ret.disposed + dto.quantity > ret.received
    ) {
      throw new BadRequestException(
        'Return quantity exceeds its remaining balance',
      );
    }
    const item = await em.getRepository(InventoryItem).findOneByOrFail({
      id: line.inventory_item_id,
      organizationId: ctx.organizationId,
    });
    const units = dto.unitIds ?? [];
    if (item.trackingMode !== 'quantity' && units.length !== dto.quantity)
      throw new BadRequestException(
        'One physical unit ID is required per returned tracked item',
      );
    if (item.trackingMode === 'quantity' && units.length)
      throw new BadRequestException('Counted stock must not specify unit IDs');
    if (
      receipt &&
      ret.warehouse_id &&
      (ret.warehouse_id !== dto.warehouseId ||
        ret.location_id !== (dto.locationId ?? null))
    ) {
      throw new BadRequestException(
        'Partial receipts for a return must use its original quarantine location',
      );
    }
    if (!dispose)
      await this.validateWarehouse(
        em,
        ctx,
        dto.warehouseId,
        dto.locationId,
        !receipt,
      );
    if (!receipt)
      await this.validateWarehouse(
        em,
        ctx,
        ret.warehouse_id,
        ret.location_id,
        false,
      );
    if (units.length) {
      const found = await em.query<Array<{ id: string }>>(
        `SELECT u.id FROM inventory_units u WHERE u.id=ANY($1::uuid[])
        AND u.organization_id=$2 AND u.inventory_item_id=$3 AND u.status=$4
        AND ${
          receipt
            ? `EXISTS(SELECT 1 FROM stock_movements m WHERE m.unit_id=u.id AND m.order_item_id=$5 AND m.movement_type='ship')`
            : `u.id=ANY($5::uuid[]) AND u.warehouse_id=$6 AND u.location_id IS NOT DISTINCT FROM $7::uuid`
        }
        ORDER BY u.id FOR UPDATE OF u`,
        receipt
          ? [units, ctx.organizationId, item.id, 'shipped', line.order_item_id]
          : [
              units,
              ctx.organizationId,
              item.id,
              'quarantined',
              ret.unit_ids,
              ret.warehouse_id,
              ret.location_id,
            ],
      );
      if (found.length !== units.length)
        throw new BadRequestException(
          'Unit IDs do not belong to the shipped line or pending physical return',
        );
    }
    const base: StockMovementCommand = {
      itemId: item.id,
      warehouseId: receipt ? dto.warehouseId! : ret.warehouse_id!,
      locationId: receipt ? (dto.locationId ?? null) : ret.location_id,
      type: receipt ? 'return_receipt' : dispose ? 'write_off' : 'transfer_out',
      onHand: receipt ? dto.quantity : -dto.quantity,
      orderId: ctx.orderId,
      orderItemId: line.order_item_id,
      sourceChannel: 'motoark',
      storeId: ctx.storeId,
    };
    const commands: StockMovementCommand[] = [];
    const ids: Array<string | null> = units.length ? units : [null];
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
                  ? ('quarantined' as const)
                  : ('written_off' as const),
                warehouseId: receipt ? dto.warehouseId! : null,
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
          warehouseId: dto.warehouseId!,
          locationId: dto.locationId ?? null,
          onHand: amount,
          unitId: id,
          ...(id
            ? {
                unitPatch: {
                  status: 'available' as const,
                  warehouseId: dto.warehouseId!,
                  locationId: dto.locationId ?? null,
                  reservationId: null,
                },
              }
            : {}),
        });
    }
    await this.apply(em, ctx, line, commands);
    if (receipt)
      await em.query(
        `UPDATE motoark_returns SET received=received+$2, warehouse_id=$3, location_id=$4, unit_ids=unit_ids||$5::uuid[] WHERE id=$1`,
        [ret.id, dto.quantity, dto.warehouseId, dto.locationId ?? null, units],
      );
    else
      await em.query(
        `UPDATE motoark_returns SET ${dispose ? 'disposed=disposed' : 'restocked=restocked'}+$2 WHERE id=$1`,
        [ret.id, dto.quantity],
      );
  }

  private async validateWarehouse(
    em: EntityManager,
    ctx: MotoarkStockContext,
    warehouseId: string | null | undefined,
    locationId: string | null | undefined,
    sellable: boolean,
  ) {
    const [row] = await em.query<Array<{ id: string }>>(
      `SELECT w.id FROM warehouses w WHERE w.id=$1 AND w.organization_id=$2 AND w.active AND w.is_sellable=$3
      AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM warehouse_locations l WHERE l.id=$4 AND l.warehouse_id=w.id AND l.organization_id=$2 AND ($3=false OR (l.is_pickable AND l.type IN ('storage','staging','receiving')))))
      AND (NOT EXISTS(SELECT 1 FROM user_warehouse_assignments a WHERE a.user_id=$5 AND a.organization_id=$2)
        OR EXISTS(SELECT 1 FROM user_warehouse_assignments a WHERE a.user_id=$5 AND a.organization_id=$2 AND a.warehouse_id=w.id))`,
      [
        warehouseId ?? null,
        ctx.organizationId,
        sellable,
        locationId ?? null,
        ctx.actorUserId,
      ],
    );
    if (!row)
      throw new BadRequestException(
        sellable
          ? 'An accessible sellable warehouse/bin is required for inspected stock'
          : 'An accessible non-sellable quarantine warehouse is required',
      );
  }

  private async apply(
    em: EntityManager,
    ctx: MotoarkStockContext,
    line: MotoarkStockLine,
    commands: StockMovementCommand[],
  ) {
    await this.ledger.apply(
      {
        organizationId: ctx.organizationId,
        actorUserId: ctx.actorUserId,
        operationKey: `${ctx.eventKey}:${line.id}`,
      },
      commands,
      em,
    );
  }
}
