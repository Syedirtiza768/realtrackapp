import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  InventoryItem,
  InventoryUnit,
  InventoryUnitStatus,
  StockDocument,
  StockDocumentLine,
  StockDocumentType,
  Warehouse,
  WarehouseLocation,
} from './entities/index.js';
import {
  AdjustDto,
  CreateAdjustmentDocDto,
  CreateCountDto,
  CreateTransferDto,
  DamageDto,
  DocumentsQueryDto,
  MovementsQueryDto,
  MoveDto,
  ReceiveDocumentDto,
  ReceiveDto,
  RecordCountDto,
} from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService, StockMovementCommand } from './stock-ledger.service.js';

export const STOCK_RECEIVED_EVENT = 'stock.received';

/** Adjustments/count variances larger than this (units, absolute) need stock.adjust.approve. */
export const ADJUST_APPROVAL_QTY = Number(process.env.STOCK_ADJUST_APPROVAL_QTY ?? 10);

const DOC_PREFIX: Record<StockDocumentType, string> = {
  receipt: 'RCV',
  transfer: 'TRF',
  adjustment: 'ADJ',
  count: 'CNT',
  purchase_order: 'PO',
};

export interface OperationPerms {
  canApprove: boolean;
}

@Injectable()
export class StockOperationsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: StockAccessService,
    private readonly ledger: StockLedgerService,
    private readonly events: EventEmitter2,
  ) {}

  /* ── Shared helpers ─────────────────────────────────────────────── */

  async nextDocNumber(em: EntityManager, type: StockDocumentType): Promise<string> {
    const [{ n }] = (await em.query(`SELECT nextval('stock_document_seq')::bigint AS n`)) as Array<{ n: string }>;
    return `${DOC_PREFIX[type]}-${String(n).padStart(6, '0')}`;
  }

  async loadItem(em: EntityManager, scope: StockScope, itemId: string): Promise<InventoryItem> {
    const item = await em.getRepository(InventoryItem).findOneBy({ id: itemId, organizationId: scope.organizationId });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async loadWarehouse(em: EntityManager, scope: StockScope, warehouseId: string): Promise<Warehouse> {
    const w = await em.getRepository(Warehouse).findOneBy({ id: warehouseId, organizationId: scope.organizationId });
    if (!w) throw new NotFoundException('Warehouse not found');
    this.access.assertWarehouse(scope, w.id);
    if (!w.active) throw new BadRequestException(`Warehouse ${w.code} is inactive`);
    return w;
  }

  async assertLocation(em: EntityManager, warehouseId: string, locationId?: string | null) {
    if (!locationId) return null;
    const loc = await em.getRepository(WarehouseLocation).findOneBy({ id: locationId, warehouseId });
    if (!loc) throw new BadRequestException('Bin does not belong to this warehouse');
    if (!loc.active) throw new BadRequestException(`Bin ${loc.code} is inactive`);
    return loc;
  }

  /** Locks and returns `qty` units of an item in a warehouse/bin with one of the given statuses (oldest first). */
  async pickUnits(
    em: EntityManager,
    itemId: string,
    warehouseId: string,
    locationId: string | null | undefined,
    statuses: InventoryUnitStatus[],
    qty: number,
    preferred?: string | null,
  ): Promise<InventoryUnit[]> {
    const params: unknown[] = [itemId, warehouseId, statuses, qty];
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
    const rows = (await em.query(
      `SELECT id FROM inventory_units
        WHERE inventory_item_id = $1 AND warehouse_id = $2 AND status = ANY($3) ${locSql}
        ORDER BY ${order} LIMIT $4 FOR UPDATE`,
      params,
    )) as Array<{ id: string }>;
    if (rows.length < qty)
      throw new BadRequestException(
        `Only ${rows.length} matching unit(s) found for this item${locationId !== undefined ? ' in that bin' : ''}; ${qty} needed`,
      );
    return em.getRepository(InventoryUnit).findBy({ id: In(rows.map((r) => r.id)) });
  }

  private isUnitTracked(item: InventoryItem) {
    return item.trackingMode === 'serial' || item.trackingMode === 'one_off';
  }

  /** Creates units for received stock and returns one movement command per unit. */
  async createReceivedUnits(
    em: EntityManager,
    scope: StockScope,
    item: InventoryItem,
    base: Omit<StockMovementCommand, 'onHand' | 'unitId' | 'unitPatch'>,
    quantity: number,
    opts: { serials?: string[]; lotCode?: string | null; conditionId?: string | null; unitCost?: number | null; sourceRef?: string | null },
  ): Promise<StockMovementCommand[]> {
    const serials = (opts.serials ?? []).map((s) => s.trim()).filter(Boolean);
    if (item.trackingMode === 'serial' && serials.length !== quantity)
      throw new BadRequestException(`Serial-tracked item: provide exactly ${quantity} serial number(s)`);
    if (new Set(serials).size !== serials.length) throw new BadRequestException('Duplicate serial numbers');
    const repo = em.getRepository(InventoryUnit);
    const units = await repo.save(
      Array.from({ length: quantity }, (_, i) =>
        repo.create({
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
        }),
      ),
    ).catch((err: { code?: string }) => {
      if (err?.code === '23505') throw new BadRequestException('A serial number is already registered in this workspace');
      throw err;
    });
    return units.map((u) => ({ ...base, onHand: 1, unitId: u.id }));
  }

  /* ── Quick operations ───────────────────────────────────────────── */

  /** Receive stock that arrived without a purchase order (intake, found stock, returns). */
  async receive(scope: StockScope, dto: ReceiveDto) {
    const opKey = dto.idempotencyKey ? `receive:${scope.organizationId}:${dto.idempotencyKey}` : null;
    const result = await this.db.transaction('READ COMMITTED', async (em) => {
      if (opKey) {
        const replay = await this.ledger.findByOperation(em, scope.organizationId, opKey);
        if (replay.length) return { documentId: replay[0].documentId, replayed: true, itemId: dto.itemId };
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
      await em.getRepository(StockDocumentLine).save({
        documentId: doc.id,
        inventoryItemId: item.id,
        locationId: dto.locationId ?? null,
        quantity: dto.quantity,
        processedQty: dto.quantity,
        unitCost: dto.unitCost != null ? String(dto.unitCost) : null,
        serials: dto.serials ?? [],
      });
      const base: StockMovementCommand = {
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
      if (dto.unitCost != null) await this.updateAverageCost(em, item, dto.quantity, dto.unitCost);
      return { documentId: doc.id, replayed: false, itemId: item.id };
    });
    if (!result.replayed) this.afterReceipt(scope.organizationId, [dto.itemId]);
    return result;
  }

  afterReceipt(organizationId: string, itemIds: string[]) {
    this.ledger.emitChanged(organizationId, itemIds.map((itemId) => ({ itemId })));
    this.events.emit(STOCK_RECEIVED_EVENT, { organizationId, itemIds });
  }

  /** Weighted-average cost: new = (onHandBefore × cost + qty × unitCost) / (onHandBefore + qty). */
  async updateAverageCost(em: EntityManager, item: InventoryItem, qty: number, unitCost: number) {
    const [{ onHand }] = (await em.query(
      `SELECT COALESCE(SUM(on_hand),0)::int "onHand" FROM stock_levels WHERE inventory_item_id = $1`,
      [item.id],
    )) as Array<{ onHand: number }>;
    const before = Math.max(0, onHand - qty);
    const current = item.unitCost != null ? Number(item.unitCost) : unitCost;
    const avg = before + qty > 0 ? (before * current + qty * unitCost) / (before + qty) : unitCost;
    await em.query(`UPDATE inventory_items SET unit_cost = $2, updated_at = now() WHERE id = $1`, [item.id, avg.toFixed(4)]);
  }

  async adjust(scope: StockScope, dto: AdjustDto, perms: OperationPerms) {
    if (dto.quantity === 0) throw new BadRequestException('Quantity must not be zero');
    if (Math.abs(dto.quantity) > ADJUST_APPROVAL_QTY && !perms.canApprove) {
      // Above threshold: park it as an adjustment document awaiting a manager.
      return this.createAdjustmentDocument(
        scope,
        {
          warehouseId: dto.warehouseId,
          reasonCode: dto.reasonCode,
          note: dto.note,
          lines: [{ itemId: dto.itemId, locationId: dto.locationId, unitId: dto.unitId, quantity: dto.quantity }],
        },
        perms,
      );
    }
    const opKey = dto.idempotencyKey ? `adjust:${scope.organizationId}:${dto.idempotencyKey}` : null;
    const res = await this.db.transaction('READ COMMITTED', async (em) => {
      if (opKey) {
        const replay = await this.ledger.findByOperation(em, scope.organizationId, opKey);
        if (replay.length) return { status: 'completed', replayed: true };
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
    if (!res.replayed) this.afterAdjust(scope.organizationId, [dto.itemId], dto.quantity);
    return res;
  }

  private afterAdjust(organizationId: string, itemIds: string[], qty: number) {
    if (qty > 0) this.afterReceipt(organizationId, itemIds);
    else this.ledger.emitChanged(organizationId, itemIds.map((itemId) => ({ itemId })));
  }

  /** Builds ledger commands for a signed adjustment, handling unit-tracked items. */
  async adjustmentCommands(
    em: EntityManager,
    scope: StockScope,
    item: InventoryItem,
    a: {
      warehouseId: string;
      locationId: string | null;
      unitId: string | null;
      quantity: number;
      reasonCode: string | null;
      note: string | null;
      type: 'adjustment' | 'count_variance';
      documentId: string | null;
    },
  ): Promise<StockMovementCommand[]> {
    const base: StockMovementCommand = {
      itemId: item.id,
      warehouseId: a.warehouseId,
      locationId: a.locationId,
      type: a.type,
      reasonCode: a.reasonCode,
      note: a.note,
      documentId: a.documentId,
    };
    if (!this.isUnitTracked(item)) return [{ ...base, onHand: a.quantity }];
    if (a.quantity > 0) {
      if (item.trackingMode === 'serial')
        throw new BadRequestException('Serial-tracked items gain stock through Receive, which records each serial number');
      return this.createReceivedUnits(em, scope, item, base, a.quantity, { lotCode: null });
    }
    const units = await this.pickUnits(em, item.id, a.warehouseId, a.locationId, ['available'], -a.quantity, a.unitId);
    return units.map((u) => ({ ...base, onHand: -1, unitId: u.id, unitPatch: { status: 'written_off' as const, warehouseId: null, locationId: null } }));
  }

  async move(scope: StockScope, dto: MoveDto) {
    const from = dto.fromLocationId ?? null;
    const to = dto.toLocationId ?? null;
    if (from === to) throw new BadRequestException('Source and destination bins are the same');
    const opKey = dto.idempotencyKey ? `move:${scope.organizationId}:${dto.idempotencyKey}` : null;
    await this.db.transaction('READ COMMITTED', async (em) => {
      const item = await this.loadItem(em, scope, dto.itemId);
      await this.loadWarehouse(em, scope, dto.warehouseId);
      await this.assertLocation(em, dto.warehouseId, from);
      await this.assertLocation(em, dto.warehouseId, to);
      const base = { itemId: item.id, warehouseId: dto.warehouseId, type: 'putaway' as const };
      let commands: StockMovementCommand[];
      if (this.isUnitTracked(item)) {
        const units = await this.pickUnits(em, item.id, dto.warehouseId, from, ['available'], dto.quantity, dto.unitId);
        commands = units.flatMap((u) => [
          { ...base, locationId: from, onHand: -1, unitId: u.id },
          { ...base, locationId: to, onHand: 1, unitId: u.id, unitPatch: { locationId: to } },
        ]);
      } else {
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

  async damage(scope: StockScope, dto: DamageDto) {
    if (dto.quantity === 0) throw new BadRequestException('Quantity must not be zero');
    await this.db.transaction('READ COMMITTED', async (em) => {
      const item = await this.loadItem(em, scope, dto.itemId);
      await this.loadWarehouse(em, scope, dto.warehouseId);
      await this.assertLocation(em, dto.warehouseId, dto.locationId);
      const base = { itemId: item.id, warehouseId: dto.warehouseId, locationId: dto.locationId ?? null, type: 'damage' as const, note: dto.note ?? null };
      let commands: StockMovementCommand[] = [{ ...base, damaged: dto.quantity }];
      if (this.isUnitTracked(item)) {
        const from: InventoryUnitStatus[] = dto.quantity > 0 ? ['available'] : ['quarantined'];
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

  /* ── Documents ──────────────────────────────────────────────────── */

  async createDocument(em: EntityManager, scope: StockScope, data: Partial<StockDocument> & { docType: StockDocumentType; warehouseId: string }) {
    const repo = em.getRepository(StockDocument);
    return repo.save(
      repo.create({
        organizationId: scope.organizationId,
        docNumber: await this.nextDocNumber(em, data.docType),
        createdBy: scope.userId,
        metadata: {},
        ...data,
      }),
    );
  }

  async listDocuments(scope: StockScope, q: DocumentsQueryDto) {
    const params: unknown[] = [scope.organizationId];
    const where = ['d.organization_id = $1'];
    if (q.type) { params.push(q.type); where.push(`d.doc_type = $${params.length}`); }
    if (q.status) { params.push(q.status.split(',')); where.push(`d.status = ANY($${params.length})`); }
    if (q.warehouseId) { params.push(q.warehouseId); where.push(`(d.warehouse_id = $${params.length} OR d.dest_warehouse_id = $${params.length})`); }
    if (q.supplierId) { params.push(q.supplierId); where.push(`d.supplier_id = $${params.length}`); }
    if (scope.warehouseIds) {
      params.push(scope.warehouseIds);
      where.push(`(d.warehouse_id = ANY($${params.length}::uuid[]) OR d.dest_warehouse_id = ANY($${params.length}::uuid[]))`);
    }
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const rows = await this.db.query(
      `SELECT d.id, d.doc_type AS "docType", d.doc_number AS "docNumber", d.status, d.reason_code AS "reasonCode",
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
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return { total: rows[0]?.totalCount ?? 0, items: rows };
  }

  async getDocument(scope: StockScope, id: string) {
    const doc = await this.db.getRepository(StockDocument).findOneBy({ id, organizationId: scope.organizationId });
    if (!doc) throw new NotFoundException('Document not found');
    this.access.assertWarehouse(scope, doc.warehouseId);
    const lines = await this.db.query(
      `SELECT l.id, l.inventory_item_id AS "itemId", i.sku, i.title, i.image_url AS "imageUrl",
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
        ORDER BY fl.code NULLS LAST, i.sku`,
      [id],
    );
    const [refs] = (await this.db.query(
      `SELECT (SELECT json_build_object('id', id, 'code', code, 'name', name) FROM warehouses WHERE id = $1) AS warehouse,
              (SELECT json_build_object('id', id, 'code', code, 'name', name) FROM warehouses WHERE id = $2) AS "destWarehouse",
              (SELECT json_build_object('id', id, 'code', code, 'name', name, 'email', email) FROM suppliers WHERE id = $3) AS supplier`,
      [doc.warehouseId, doc.destWarehouseId, doc.supplierId],
    )) as Array<Record<string, unknown>>;
    return { ...doc, ...refs, lines };
  }

  async cancelDocument(scope: StockScope, id: string) {
    const doc = await this.db.getRepository(StockDocument).findOneBy({ id, organizationId: scope.organizationId });
    if (!doc) throw new NotFoundException('Document not found');
    this.access.assertWarehouse(scope, doc.warehouseId);
    if (!['draft', 'pending_approval'].includes(doc.status))
      throw new BadRequestException(`A ${doc.status.replace('_', ' ')} document cannot be cancelled here`);
    doc.status = 'cancelled';
    return this.db.getRepository(StockDocument).save(doc);
  }

  /* ── Adjustment documents (approval workflow) ───────────────────── */

  async createAdjustmentDocument(scope: StockScope, dto: CreateAdjustmentDocDto, perms: OperationPerms) {
    const needsApproval = dto.lines.some((l) => Math.abs(l.quantity) > ADJUST_APPROVAL_QTY);
    const doc = await this.db.transaction(async (em) => {
      await this.loadWarehouse(em, scope, dto.warehouseId);
      for (const l of dto.lines) {
        if (l.quantity === 0) throw new BadRequestException('Adjustment lines must not be zero');
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
      await em.getRepository(StockDocumentLine).save(
        dto.lines.map((l) => ({
          documentId: d.id,
          inventoryItemId: l.itemId,
          locationId: l.locationId ?? null,
          unitId: l.unitId ?? null,
          quantity: l.quantity,
          note: l.note ?? null,
        })),
      );
      return d;
    });
    if (!needsApproval || perms.canApprove) return this.approveAdjustment(scope, doc.id, perms);
    return { ...doc, status: 'pending_approval', message: `Adjustments over ${ADJUST_APPROVAL_QTY} units need manager approval` };
  }

  async approveAdjustment(scope: StockScope, id: string, perms: OperationPerms) {
    const itemIds: string[] = [];
    let net = 0;
    const doc = await this.db.transaction('READ COMMITTED', async (em) => {
      const d = await em.getRepository(StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!d) throw new NotFoundException('Document not found');
      this.access.assertWarehouse(scope, d.warehouseId);
      if (d.docType !== 'adjustment' && d.docType !== 'count') throw new BadRequestException('Not an adjustment or count');
      if (d.status !== 'pending_approval') throw new BadRequestException(`Document is ${d.status}`);
      const lines = await em.getRepository(StockDocumentLine).findBy({ documentId: id });
      const deltas = lines.map((l) => ({
        line: l,
        delta: d.docType === 'count' ? (l.countedQty ?? 0) - (l.systemQty ?? 0) : l.quantity,
      }));
      if (deltas.some((x) => Math.abs(x.delta) > ADJUST_APPROVAL_QTY) && !perms.canApprove)
        throw new ForbiddenException('Manager approval (stock.adjust.approve) is required');
      const commands: StockMovementCommand[] = [];
      for (const { line, delta } of deltas) {
        if (delta === 0) continue;
        const item = await this.loadItem(em, scope, line.inventoryItemId);
        commands.push(
          ...(await this.adjustmentCommands(em, scope, item, {
            warehouseId: d.warehouseId,
            locationId: line.locationId,
            unitId: line.unitId,
            quantity: delta,
            reasonCode: d.reasonCode ?? (d.docType === 'count' ? 'count' : null),
            note: line.note ?? d.note,
            type: d.docType === 'count' ? 'count_variance' : 'adjustment',
            documentId: d.id,
          })),
        );
        itemIds.push(item.id);
        net += delta;
        line.processedQty = delta;
      }
      await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `doc-complete:${d.id}` }, commands, em);
      await em.getRepository(StockDocumentLine).save(lines);
      d.status = 'completed';
      d.approvedBy = scope.userId;
      d.completedBy = scope.userId;
      d.completedAt = new Date();
      return em.getRepository(StockDocument).save(d);
    });
    if (itemIds.length) this.afterAdjust(scope.organizationId, [...new Set(itemIds)], net);
    return doc;
  }

  /* ── Transfers ──────────────────────────────────────────────────── */

  async createTransfer(scope: StockScope, dto: CreateTransferDto) {
    if (dto.warehouseId === dto.destWarehouseId)
      throw new BadRequestException('Use a bin move to relocate stock inside one warehouse');
    return this.db.transaction(async (em) => {
      await this.loadWarehouse(em, scope, dto.warehouseId);
      await this.loadWarehouse(em, scope, dto.destWarehouseId);
      for (const l of dto.lines) {
        if (l.quantity <= 0) throw new BadRequestException('Transfer quantities must be positive');
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
      await em.getRepository(StockDocumentLine).save(
        dto.lines.map((l) => ({
          documentId: d.id,
          inventoryItemId: l.itemId,
          locationId: l.locationId ?? null,
          destLocationId: l.destLocationId ?? null,
          unitId: l.unitId ?? null,
          quantity: l.quantity,
          note: l.note ?? null,
        })),
      );
      return d;
    });
  }

  /** Takes stock out of the source warehouse and books it as inbound at the destination. */
  async shipTransfer(scope: StockScope, id: string) {
    const itemIds: string[] = [];
    const doc = await this.db.transaction('READ COMMITTED', async (em) => {
      const d = await em.getRepository(StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!d || d.docType !== 'transfer') throw new NotFoundException('Transfer not found');
      this.access.assertWarehouse(scope, d.warehouseId);
      if (d.status !== 'draft') throw new BadRequestException(`Transfer is ${d.status}`);
      const lines = await em.getRepository(StockDocumentLine).findBy({ documentId: id });
      const commands: StockMovementCommand[] = [];
      for (const line of lines) {
        const item = await this.loadItem(em, scope, line.inventoryItemId);
        itemIds.push(item.id);
        const out = { itemId: item.id, warehouseId: d.warehouseId, locationId: line.locationId, type: 'transfer_out' as const, documentId: d.id };
        // Destination books the shipped quantity as inbound until it is received.
        const inbound = { itemId: item.id, warehouseId: d.destWarehouseId!, locationId: null, type: 'transfer_in' as const, documentId: d.id, inbound: line.quantity };
        if (this.isUnitTracked(item)) {
          const units = await this.pickUnits(em, item.id, d.warehouseId, line.locationId ?? undefined, ['available'], line.quantity, line.unitId);
          // For unit-tracked transfer lines, `serials` holds the shipped unit IDs.
          line.serials = units.map((u) => u.id);
          commands.push(...units.map((u) => ({ ...out, onHand: -1, unitId: u.id, unitPatch: { status: 'picked' as const, locationId: null } })));
        } else {
          commands.push({ ...out, onHand: -line.quantity });
        }
        commands.push(inbound);
      }
      await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `transfer-ship:${d.id}` }, commands, em);
      await em.getRepository(StockDocumentLine).save(lines);
      d.status = 'in_transit';
      d.metadata = { ...d.metadata, shippedAt: new Date().toISOString(), shippedBy: scope.userId };
      return em.getRepository(StockDocument).save(d);
    });
    this.ledger.emitChanged(scope.organizationId, itemIds.map((itemId) => ({ itemId })));
    return doc;
  }

  async receiveTransfer(scope: StockScope, id: string, dto: ReceiveDocumentDto) {
    const itemIds: string[] = [];
    const doc = await this.db.transaction('READ COMMITTED', async (em) => {
      const d = await em.getRepository(StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!d || d.docType !== 'transfer') throw new NotFoundException('Transfer not found');
      this.access.assertWarehouse(scope, d.destWarehouseId);
      if (!['in_transit', 'partially_received'].includes(d.status)) throw new BadRequestException(`Transfer is ${d.status}`);
      const lines = await em.getRepository(StockDocumentLine).findBy({ documentId: id });
      const byId = new Map(lines.map((l) => [l.id, l]));
      const commands: StockMovementCommand[] = [];
      for (const r of dto.lines) {
        const line = byId.get(r.lineId);
        if (!line) throw new BadRequestException('Unknown transfer line');
        if (r.quantity === 0) continue;
        if (line.processedQty + r.quantity > line.quantity)
          throw new BadRequestException(`Receiving more than was shipped for line ${line.id}`);
        const dest = r.locationId ?? line.destLocationId ?? null;
        await this.assertLocation(em, d.destWarehouseId!, dest);
        const item = await this.loadItem(em, scope, line.inventoryItemId);
        itemIds.push(item.id);
        const base = { itemId: item.id, warehouseId: d.destWarehouseId!, type: 'transfer_in' as const, documentId: d.id };
        commands.push({ ...base, locationId: null, inbound: -r.quantity });
        if (this.isUnitTracked(item)) {
          const unitIds = line.serials.slice(line.processedQty, line.processedQty + r.quantity);
          commands.push(
            ...unitIds.map((unitId) => ({
              ...base,
              locationId: dest,
              onHand: 1,
              unitId,
              unitPatch: { status: 'available' as const, warehouseId: d.destWarehouseId!, locationId: dest },
            })),
          );
        } else {
          commands.push({ ...base, locationId: dest, onHand: r.quantity });
        }
        line.processedQty += r.quantity;
      }
      if (!commands.length) throw new BadRequestException('Nothing to receive');
      await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId }, commands, em);
      await em.getRepository(StockDocumentLine).save(lines);
      const done = lines.every((l) => l.processedQty >= l.quantity);
      d.status = done ? 'completed' : 'partially_received';
      if (done) { d.completedAt = new Date(); d.completedBy = scope.userId; }
      return em.getRepository(StockDocument).save(d);
    });
    this.afterReceipt(scope.organizationId, [...new Set(itemIds)]);
    return doc;
  }

  /* ── Cycle counts ───────────────────────────────────────────────── */

  async createCount(scope: StockScope, dto: CreateCountDto) {
    return this.db.transaction(async (em) => {
      await this.loadWarehouse(em, scope, dto.warehouseId);
      const params: unknown[] = [dto.warehouseId];
      const where = ['sl.warehouse_id = $1', 'sl.on_hand > 0'];
      if (dto.locationIds?.length) { params.push(dto.locationIds); where.push(`sl.location_id = ANY($${params.length}::uuid[])`); }
      if (dto.itemIds?.length) { params.push(dto.itemIds); where.push(`sl.inventory_item_id = ANY($${params.length}::uuid[])`); }
      const levels = (await em.query(
        `SELECT sl.inventory_item_id, sl.location_id, sl.on_hand FROM stock_levels sl WHERE ${where.join(' AND ')}`,
        params,
      )) as Array<{ inventory_item_id: string; location_id: string | null; on_hand: number }>;
      if (!levels.length && !dto.locationIds?.length) throw new BadRequestException('Nothing with stock to count in that scope');
      const d = await this.createDocument(em, scope, {
        docType: 'count',
        status: 'draft',
        warehouseId: dto.warehouseId,
        note: dto.note ?? null,
        metadata: { locationIds: dto.locationIds ?? null, itemIds: dto.itemIds ?? null, blind: true },
      });
      await em.getRepository(StockDocumentLine).save(
        levels.map((l) => ({
          documentId: d.id,
          inventoryItemId: l.inventory_item_id,
          locationId: l.location_id,
          quantity: 0,
          systemQty: l.on_hand,
        })),
      );
      return d;
    });
  }

  /** Records counted quantities. System quantities stay hidden from counters until submission (blind count). */
  async recordCount(scope: StockScope, id: string, dto: RecordCountDto) {
    return this.db.transaction(async (em) => {
      const d = await em.getRepository(StockDocument).findOneBy({ id, organizationId: scope.organizationId });
      if (!d || d.docType !== 'count') throw new NotFoundException('Count not found');
      this.access.assertWarehouse(scope, d.warehouseId);
      if (d.status !== 'draft') throw new BadRequestException(`Count is ${d.status}`);
      const repo = em.getRepository(StockDocumentLine);
      for (const r of dto.lines) {
        if (r.lineId) {
          const line = await repo.findOneBy({ id: r.lineId, documentId: id });
          if (!line) throw new BadRequestException('Unknown count line');
          line.countedQty = r.countedQty;
          await repo.save(line);
        } else if (r.itemId) {
          await this.loadItem(em, scope, r.itemId);
          await this.assertLocation(em, d.warehouseId, r.locationId);
          const existing = await repo.findOne({ where: { documentId: id, inventoryItemId: r.itemId, locationId: r.locationId ?? undefined } });
          if (existing && (existing.locationId ?? null) === (r.locationId ?? null)) {
            existing.countedQty = r.countedQty;
            await repo.save(existing);
          } else {
            await repo.save({ documentId: id, inventoryItemId: r.itemId, locationId: r.locationId ?? null, quantity: 0, systemQty: null, countedQty: r.countedQty, note: 'Found during count' });
          }
        } else {
          throw new BadRequestException('Each counted line needs lineId or itemId');
        }
      }
      return { saved: dto.lines.length };
    });
  }

  /** Snapshots current system quantity, computes variances and applies or parks them for approval. */
  async submitCount(scope: StockScope, id: string, perms: OperationPerms) {
    const d = await this.db.transaction(async (em) => {
      const doc = await em.getRepository(StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
      if (!doc || doc.docType !== 'count') throw new NotFoundException('Count not found');
      this.access.assertWarehouse(scope, doc.warehouseId);
      if (doc.status !== 'draft') throw new BadRequestException(`Count is ${doc.status}`);
      const lines = await em.getRepository(StockDocumentLine).findBy({ documentId: id });
      const uncounted = lines.filter((l) => l.countedQty === null);
      if (uncounted.length) throw new BadRequestException(`${uncounted.length} line(s) have not been counted yet`);
      for (const l of lines) {
        const [row] = (await em.query(
          `SELECT on_hand FROM stock_levels WHERE inventory_item_id = $1 AND warehouse_id = $2 AND location_id IS NOT DISTINCT FROM $3::uuid`,
          [l.inventoryItemId, doc.warehouseId, l.locationId],
        )) as Array<{ on_hand: number }>;
        l.systemQty = row?.on_hand ?? 0;
      }
      await em.getRepository(StockDocumentLine).save(lines);
      doc.status = 'pending_approval';
      return em.getRepository(StockDocument).save(doc);
    });
    const lines = await this.db.getRepository(StockDocumentLine).findBy({ documentId: id });
    const variances = lines.filter((l) => (l.countedQty ?? 0) !== (l.systemQty ?? 0));
    const needsApproval = variances.some((l) => Math.abs((l.countedQty ?? 0) - (l.systemQty ?? 0)) > ADJUST_APPROVAL_QTY);
    if (!needsApproval || perms.canApprove) return this.approveAdjustment(scope, id, perms);
    return { ...d, variances: variances.length, message: `Variances over ${ADJUST_APPROVAL_QTY} units need manager approval` };
  }

  /* ── Ledger browsing ────────────────────────────────────────────── */

  async listMovements(scope: StockScope, q: MovementsQueryDto) {
    const params: unknown[] = [scope.organizationId];
    const where = ['m.organization_id = $1'];
    if (q.itemId) { params.push(q.itemId); where.push(`m.inventory_item_id = $${params.length}`); }
    if (q.warehouseId) { params.push(q.warehouseId); where.push(`m.warehouse_id = $${params.length}`); }
    if (q.type) { params.push(q.type.split(',')); where.push(`m.movement_type = ANY($${params.length})`); }
    if (q.orderId) { params.push(q.orderId); where.push(`m.order_id = $${params.length}`); }
    if (q.documentId) { params.push(q.documentId); where.push(`m.document_id = $${params.length}`); }
    if (q.from) { params.push(q.from); where.push(`m.created_at >= $${params.length}`); }
    if (q.to) { params.push(q.to); where.push(`m.created_at < $${params.length}`); }
    where.push(this.access.warehouseFilter(scope, 'm.warehouse_id', params));
    const limit = q.limit ?? 100;
    const offset = q.offset ?? 0;
    const rows = await this.db.query(
      `SELECT m.id, m.movement_type AS "type", m.inventory_item_id AS "itemId", i.sku, i.title,
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
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return { total: rows[0]?.totalCount ?? 0, items: rows };
  }
}
