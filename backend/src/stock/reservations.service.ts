import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InventoryItem, StockReservation } from './entities/index.js';
import { StockLedgerService, StockMovementCommand } from './stock-ledger.service.js';
import { StockOperationsService } from './stock-operations.service.js';

export interface ReservationTarget {
  orderId: string | null;
  orderItemId: string | null;
  storeId: string | null;
}

export interface CandidateLevel {
  warehouseId: string;
  locationId: string | null;
  available: number;
  priority: number;
  isPickable: boolean;
}

/**
 * Allocation primitive: turns "N units of item X for order line Y" into stock_reservations
 * rows plus `reserve` ledger movements. Always runs inside the caller's transaction.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly ledger: StockLedgerService,
    private readonly ops: StockOperationsService,
  ) {}

  /**
   * Bins that can supply the item, best first:
   * warehouses linked to the selling store (by link priority), else every sellable
   * warehouse (default first); a warehouse that can fill the whole line wins;
   * inside a warehouse, pickable storage bins with the most available stock first.
   */
  async candidates(
    em: EntityManager,
    organizationId: string,
    itemId: string,
    storeId: string | null,
    needed: number,
  ): Promise<CandidateLevel[]> {
    const rows = (await em.query(
      `WITH linked AS (
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
                 priority, "isPickable" DESC, sl.available DESC`,
      [organizationId, itemId, storeId, needed],
    )) as Array<CandidateLevel & { wh_total: number }>;
    return rows.filter((r) => r.isPickable);
  }

  /** Reserves up to `needed` units; returns how many were reserved. */
  async allocate(
    em: EntityManager,
    organizationId: string,
    actorUserId: string | null,
    item: InventoryItem,
    needed: number,
    target: ReservationTarget,
    restrictTo?: { warehouseId: string; locationId: string | null },
  ): Promise<number> {
    if (needed <= 0) return 0;
    const levels = restrictTo
      ? [{ ...restrictTo, available: needed, priority: 0, isPickable: true }]
      : await this.candidates(em, organizationId, item.id, target.storeId, needed);
    let remaining = needed;
    for (const lvl of levels) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lvl.available);
      if (take <= 0) continue;
      await this.reserveAt(em, organizationId, actorUserId, item, lvl.warehouseId, lvl.locationId, take, target);
      remaining -= take;
    }
    return needed - remaining;
  }

  async reserveAt(
    em: EntityManager,
    organizationId: string,
    actorUserId: string | null,
    item: InventoryItem,
    warehouseId: string,
    locationId: string | null,
    qty: number,
    target: ReservationTarget,
  ): Promise<StockReservation> {
    const repo = em.getRepository(StockReservation);
    const reservation = await repo.save(
      repo.create({
        organizationId,
        inventoryItemId: item.id,
        warehouseId,
        locationId,
        orderId: target.orderId,
        orderItemId: target.orderItemId,
        storeId: target.storeId,
        quantity: qty,
        status: 'active',
      }),
    );
    const base: StockMovementCommand = {
      itemId: item.id,
      warehouseId,
      locationId,
      type: 'reserve',
      orderId: target.orderId,
      orderItemId: target.orderItemId,
      storeId: target.storeId,
    };
    let commands: StockMovementCommand[] = [{ ...base, reserved: qty }];
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
        unitPatch: { status: 'reserved' as const, reservationId: reservation.id },
      }));
    }
    await this.ledger.apply({ organizationId, actorUserId }, commands, em);
    return reservation;
  }

  /** Releases active/picked reservations back to available stock. */
  async release(
    em: EntityManager,
    organizationId: string,
    actorUserId: string | null,
    reservations: StockReservation[],
    note: string,
  ): Promise<string[]> {
    const itemIds: string[] = [];
    for (const r of reservations) {
      if (r.status !== 'active' && r.status !== 'picked') continue;
      const units = (await em.query(
        `SELECT id FROM inventory_units WHERE reservation_id = $1 FOR UPDATE`,
        [r.id],
      )) as Array<{ id: string }>;
      const base: StockMovementCommand = {
        itemId: r.inventoryItemId,
        warehouseId: r.warehouseId,
        locationId: r.locationId,
        type: 'release',
        orderId: r.orderId,
        orderItemId: r.orderItemId,
        storeId: r.storeId,
        note,
      };
      const commands: StockMovementCommand[] = units.length
        ? units.map((u) => ({ ...base, reserved: -1, unitId: u.id, unitPatch: { status: 'available' as const, reservationId: null } }))
        : [{ ...base, reserved: -r.quantity }];
      await this.ledger.apply({ organizationId, actorUserId, operationKey: `release:${r.id}` }, commands, em);
      r.status = 'released';
      await em.getRepository(StockReservation).save(r);
      itemIds.push(r.inventoryItemId);
    }
    return itemIds;
  }
}
