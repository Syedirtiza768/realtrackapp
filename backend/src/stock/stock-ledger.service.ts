import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import {
  InventoryUnitStatus,
  StockMovement,
  StockMovementType,
} from './entities/index.js';

/** One change to one stock_levels row (item × warehouse × bin). Deltas may be negative. */
export interface StockMovementCommand {
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  type: StockMovementType;
  onHand?: number;
  reserved?: number;
  damaged?: number;
  inbound?: number;
  unitId?: string | null;
  /** Applied to inventory_units when unitId is set. */
  unitPatch?: {
    status?: InventoryUnitStatus;
    warehouseId?: string | null;
    locationId?: string | null;
    reservationId?: string | null;
  };
  unitCost?: number | string | null;
  reasonCode?: string | null;
  note?: string | null;
  documentId?: string | null;
  sourceChannel?: string | null;
  storeId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
}

export interface LedgerContext {
  organizationId: string;
  actorUserId?: string | null;
  /**
   * Idempotency key for the whole operation. Replaying the same key returns the
   * originally written movements without applying anything again.
   */
  operationKey?: string | null;
}

export interface LedgerResult {
  movements: StockMovement[];
  replayed: boolean;
}

export class InsufficientStockException extends ConflictException {
  constructor(
    readonly details: Array<{
      itemId: string;
      warehouseId: string;
      locationId: string | null;
      onHand: number;
      reserved: number;
      damaged: number;
      inbound: number;
    }>,
  ) {
    super({
      message:
        'Insufficient stock: this change would make on-hand, reserved, or inbound quantity invalid.',
      code: 'INSUFFICIENT_STOCK',
      details,
    });
  }
}

type LevelRow = {
  id: string;
  inventory_item_id: string;
  warehouse_id: string;
  location_id: string | null;
  on_hand: number;
  reserved: number;
  damaged: number;
  inbound: number;
};

const levelKey = (item: string, wh: string, loc: string | null | undefined) =>
  `${item}|${wh}|${loc ?? ''}`;

export const STOCK_CHANGED_EVENT = 'stock.changed';

/**
 * The ONLY writer of stock_levels and stock_movements.
 *
 * - READ COMMITTED + `SELECT … FOR UPDATE` on the affected rows, locked in a fixed
 *   (item, warehouse, location) order so concurrent multi-line operations cannot deadlock.
 * - Invariants (DB CHECKs mirror them): on_hand, reserved, damaged, inbound ≥ 0 and
 *   reserved + damaged ≤ on_hand. Violations throw InsufficientStockException.
 * - Marks channel_stock_sync_state dirty in the same transaction (transactional outbox),
 *   so a channel is never updated for a change that rolled back and never misses one.
 * - Projects the on-hand available quantity onto the legacy product quantity columns for
 *   `stocked` items so pre-existing publish flows read a correct number.
 */
@Injectable()
export class StockLedgerService {
  private readonly logger = new Logger(StockLedgerService.name);

  constructor(
    private readonly db: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async apply(
    ctx: LedgerContext,
    commands: StockMovementCommand[],
    em?: EntityManager,
  ): Promise<LedgerResult> {
    if (commands.length === 0) return { movements: [], replayed: false };
    this.validateCommands(commands);

    if (em) {
      const result = await this.applyInTransaction(ctx, commands, em);
      return result;
    }

    try {
      const result = await this.db.transaction('READ COMMITTED', (tx) =>
        this.applyInTransaction(ctx, commands, tx),
      );
      if (!result.replayed) this.emitChanged(ctx.organizationId, commands);
      return result;
    } catch (err) {
      // Lost a race against an identical operation: return what the winner wrote.
      if (ctx.operationKey && isUniqueViolation(err, 'uq_sm_idempotency')) {
        const movements = await this.findByOperation(
          this.db.manager,
          ctx.organizationId,
          ctx.operationKey,
        );
        if (movements.length) return { movements, replayed: true };
      }
      throw err;
    }
  }

  /** Call after the caller's own transaction commits when `apply` was given an EntityManager. */
  emitChanged(organizationId: string, commands: Array<{ itemId: string }>) {
    const itemIds = [...new Set(commands.map((c) => c.itemId))];
    this.events.emit(STOCK_CHANGED_EVENT, { organizationId, itemIds });
  }

  async findByOperation(
    em: EntityManager,
    organizationId: string,
    operationKey: string,
  ): Promise<StockMovement[]> {
    return em.getRepository(StockMovement).find({
      where: { organizationId, operationKey },
      order: { idempotencyKey: 'ASC' },
    });
  }

  /** Marks every store fed by this org's warehouses as needing a quantity recompute. */
  async markChannelDirty(
    em: EntityManager,
    organizationId: string,
    itemIds: string[],
  ): Promise<void> {
    if (!itemIds.length) return;
    await em.query(
      `INSERT INTO channel_stock_sync_state (store_id, inventory_item_id, organization_id, dirty, status, updated_at)
       SELECT DISTINCT l.store_id, i.id, $1::uuid, true, 'pending', now()
         FROM store_warehouse_links l
         JOIN warehouses w ON w.id = l.warehouse_id AND w.organization_id = $1
         CROSS JOIN unnest($2::uuid[]) AS i(id)
        WHERE l.active
       ON CONFLICT (store_id, inventory_item_id)
       DO UPDATE SET dirty = true, updated_at = now()`,
      [organizationId, itemIds],
    );
  }

  /* ─────────────────────────── internals ─────────────────────────── */

  private validateCommands(commands: StockMovementCommand[]) {
    for (const c of commands) {
      for (const key of ['onHand', 'reserved', 'damaged', 'inbound'] as const) {
        const v = c[key];
        if (v !== undefined && (!Number.isInteger(v) || Math.abs(v) > 1_000_000))
          throw new BadRequestException(`Invalid ${key} delta: ${v}`);
      }
      if (!c.itemId || !c.warehouseId)
        throw new BadRequestException('itemId and warehouseId are required');
    }
  }

  private async applyInTransaction(
    ctx: LedgerContext,
    commands: StockMovementCommand[],
    em: EntityManager,
  ): Promise<LedgerResult> {
    const org = ctx.organizationId;

    if (ctx.operationKey) {
      const existing = await this.findByOperation(em, org, ctx.operationKey);
      if (existing.length) return { movements: existing, replayed: true };
    }

    await this.assertOwnership(em, org, commands);

    // 1. Make sure every target row exists, then lock all of them in a stable order.
    const keys = [
      ...new Map(
        commands.map((c) => [
          levelKey(c.itemId, c.warehouseId, c.locationId),
          {
            itemId: c.itemId,
            warehouseId: c.warehouseId,
            locationId: c.locationId ?? null,
          },
        ]),
      ).entries(),
    ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    for (const [, k] of keys) {
      await em.query(
        `INSERT INTO stock_levels (organization_id, inventory_item_id, warehouse_id, location_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ON CONSTRAINT uq_sl_item_wh_loc DO NOTHING`,
        [org, k.itemId, k.warehouseId, k.locationId],
      );
    }

    const rows = new Map<string, LevelRow>();
    for (const [key, k] of keys) {
      const [row] = (await em.query(
        `SELECT id, inventory_item_id, warehouse_id, location_id, on_hand, reserved, damaged, inbound
           FROM stock_levels
          WHERE inventory_item_id = $1 AND warehouse_id = $2
            AND location_id IS NOT DISTINCT FROM $3::uuid
          FOR UPDATE`,
        [k.itemId, k.warehouseId, k.locationId],
      )) as LevelRow[];
      rows.set(key, row);
    }

    // 2. Apply deltas in memory, recording the after-state of each movement.
    const afters: Array<{ onHand: number; reserved: number }> = [];
    for (const c of commands) {
      const row = rows.get(levelKey(c.itemId, c.warehouseId, c.locationId))!;
      row.on_hand += c.onHand ?? 0;
      row.reserved += c.reserved ?? 0;
      row.damaged += c.damaged ?? 0;
      row.inbound += c.inbound ?? 0;
      afters.push({ onHand: row.on_hand, reserved: row.reserved });
    }

    // 3. Validate the final state of every touched row.
    const violations = [...rows.values()].filter(
      (r) =>
        r.on_hand < 0 ||
        r.reserved < 0 ||
        r.damaged < 0 ||
        r.inbound < 0 ||
        r.reserved + r.damaged > r.on_hand,
    );
    if (violations.length) {
      throw new InsufficientStockException(
        violations.map((r) => ({
          itemId: r.inventory_item_id,
          warehouseId: r.warehouse_id,
          locationId: r.location_id,
          onHand: r.on_hand,
          reserved: r.reserved,
          damaged: r.damaged,
          inbound: r.inbound,
        })),
      );
    }

    // 4. Persist projection.
    const receivedRows = new Set(
      commands
        .filter((c) => (c.onHand ?? 0) > 0 && RECEIVING_TYPES.has(c.type))
        .map((c) => levelKey(c.itemId, c.warehouseId, c.locationId)),
    );
    for (const [key, row] of rows) {
      await em.query(
        `UPDATE stock_levels
            SET on_hand = $2, reserved = $3, damaged = $4, inbound = $5,
                version = version + 1, updated_at = now()
                ${receivedRows.has(key) ? ', last_received_at = now()' : ''}
          WHERE id = $1`,
        [row.id, row.on_hand, row.reserved, row.damaged, row.inbound],
      );
    }

    // 5. Append movements.
    const repo = em.getRepository(StockMovement);
    const movements = await repo.save(
      commands.map((c, i) =>
        repo.create({
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
          unitCost:
            c.unitCost === undefined || c.unitCost === null
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
        }),
      ),
    );

    // 6. Serialized / one-off units follow their movements.
    for (const c of commands) {
      if (!c.unitId || !c.unitPatch) continue;
      const p = c.unitPatch;
      const sets: string[] = [];
      const params: unknown[] = [c.unitId, org];
      const push = (col: string, v: unknown) => {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      };
      if (p.status !== undefined) push('status', p.status);
      if (p.warehouseId !== undefined) push('warehouse_id', p.warehouseId);
      if (p.locationId !== undefined) push('location_id', p.locationId);
      if (p.reservationId !== undefined) push('reservation_id', p.reservationId);
      if (!sets.length) continue;
      await em.query(
        `UPDATE inventory_units SET ${sets.join(', ')}, updated_at = now()
          WHERE id = $1 AND organization_id = $2`,
        params,
      );
    }

    // 7. Outbox + legacy projection.
    const itemIds = [...new Set(commands.map((c) => c.itemId))];
    await this.markChannelDirty(em, org, itemIds);
    await this.projectLegacyQuantities(em, org, itemIds);

    return { movements, replayed: false };
  }

  private async assertOwnership(
    em: EntityManager,
    org: string,
    commands: StockMovementCommand[],
  ) {
    const itemIds = [...new Set(commands.map((c) => c.itemId))];
    const whIds = [...new Set(commands.map((c) => c.warehouseId))];
    const locIds = [
      ...new Set(commands.map((c) => c.locationId).filter(Boolean)),
    ] as string[];
    const [{ items, whs, locs }] = (await em.query(
      `SELECT
         (SELECT count(*)::int FROM inventory_items WHERE organization_id = $1 AND id = ANY($2::uuid[])) AS items,
         (SELECT count(*)::int FROM warehouses WHERE organization_id = $1 AND id = ANY($3::uuid[])) AS whs,
         (SELECT count(*)::int FROM warehouse_locations l
            WHERE l.organization_id = $1 AND l.id = ANY($4::uuid[])) AS locs`,
      [org, itemIds, whIds, locIds],
    )) as Array<{ items: number; whs: number; locs: number }>;
    if (items !== itemIds.length)
      throw new BadRequestException('Unknown inventory item for this workspace');
    if (whs !== whIds.length)
      throw new BadRequestException('Unknown warehouse for this workspace');
    if (locs !== locIds.length)
      throw new BadRequestException('Unknown bin location for this workspace');
    if (locIds.length) {
      const mismatched = commands.filter((c) => c.locationId);
      const pairs = (await em.query(
        `SELECT id, warehouse_id FROM warehouse_locations WHERE id = ANY($1::uuid[])`,
        [locIds],
      )) as Array<{ id: string; warehouse_id: string }>;
      const byId = new Map(pairs.map((p) => [p.id, p.warehouse_id]));
      for (const c of mismatched) {
        if (byId.get(c.locationId!) !== c.warehouseId)
          throw new BadRequestException(
            'Bin location does not belong to the given warehouse',
          );
      }
    }
  }

  /**
   * Keeps catalog_products.quantity / listing_records.quantity / product_variants.quantity
   * equal to sellable on-hand availability for `stocked` items. on_demand / hybrid items
   * are advertised through channel sync instead and their legacy quantity is left alone.
   */
  private async projectLegacyQuantities(
    em: EntityManager,
    org: string,
    itemIds: string[],
  ) {
    const totals = (await em.query(
      `SELECT i.id, i.catalog_product_id, i.listing_record_id, i.product_variant_id,
              COALESCE(SUM(sl.available) FILTER (WHERE w.is_sellable AND w.active), 0)::int AS available
         FROM inventory_items i
         LEFT JOIN stock_levels sl ON sl.inventory_item_id = i.id
         LEFT JOIN warehouses w ON w.id = sl.warehouse_id
        WHERE i.organization_id = $1 AND i.id = ANY($2::uuid[]) AND i.sourcing_mode = 'stocked'
        GROUP BY i.id`,
      [org, itemIds],
    )) as Array<{
      id: string;
      catalog_product_id: string | null;
      listing_record_id: string | null;
      product_variant_id: string | null;
      available: number;
    }>;
    for (const t of totals) {
      if (t.catalog_product_id)
        await em.query(
          `UPDATE catalog_products SET quantity = $2 WHERE id = $1 AND quantity IS DISTINCT FROM $2`,
          [t.catalog_product_id, t.available],
        );
      if (t.listing_record_id)
        await em.query(
          `UPDATE listing_records SET quantity = $2::text, "quantityNum" = $2
            WHERE id = $1 AND "quantityNum" IS DISTINCT FROM $2`,
          [t.listing_record_id, t.available],
        );
      if (t.product_variant_id)
        await em.query(
          `UPDATE product_variants SET quantity = $2 WHERE id = $1 AND quantity IS DISTINCT FROM $2`,
          [t.product_variant_id, t.available],
        );
    }
  }
}

const RECEIVING_TYPES = new Set<StockMovementType>([
  'opening_balance',
  'receipt',
  'transfer_in',
  'return_receipt',
]);

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.driverError?.code;
  const name = e?.constraint ?? e?.driverError?.constraint;
  return code === '23505' && (!constraint || name === constraint);
}
