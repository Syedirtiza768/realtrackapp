import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  InventoryItem,
  InventoryItemSource,
  ProcurementRequest,
  StockDocument,
  StockDocumentLine,
  Supplier,
} from './entities/index.js';
import {
  CreateProcurementRequestDto,
  CreatePurchaseOrderDto,
  DropshipDto,
  FromRequestsDto,
  ProcurementQueryDto,
  ReceiveDocumentDto,
  UpdateProcurementRequestDto,
} from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService, StockMovementCommand } from './stock-ledger.service.js';
import { StockOperationsService } from './stock-operations.service.js';
import { ReservationsService } from './reservations.service.js';
import { WarehousesService } from './warehouses.service.js';

export const ORDER_LINE_STOCK_EVENT = 'stock.order-line.updated';

/**
 * Acquiring stock that is not on hand.
 *
 *   order line short → procurement request (open)
 *     ├─ ship_to_warehouse: grouped into a purchase order → ordered (inbound += qty)
 *     │    → received (on_hand += qty, inbound -= qty) → reserved for the waiting order
 *     └─ dropship: supplier ships straight to the buyer → dropshipped → fulfilled on order ship
 */
@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly db: DataSource,
    private readonly access: StockAccessService,
    private readonly ledger: StockLedgerService,
    private readonly ops: StockOperationsService,
    private readonly reservations: ReservationsService,
    private readonly warehouses: WarehousesService,
    private readonly events: EventEmitter2,
  ) {}

  /* ── Sources ────────────────────────────────────────────────────── */

  /** Best supplier offer: in stock at the supplier first, then priority, then cost. */
  async bestSource(em: EntityManager, itemId: string, mode?: 'ship_to_warehouse' | 'dropship') {
    const params: unknown[] = [itemId];
    if (mode) params.push(mode);
    const [row] = (await em.query(
      `SELECT x.* FROM inventory_item_sources x JOIN suppliers s ON s.id = x.supplier_id AND s.active
        WHERE x.inventory_item_id = $1 AND x.active ${mode ? 'AND x.fulfillment_mode = $2' : ''}
        ORDER BY (COALESCE(x.available_qty, 0) > 0) DESC, x.priority, x.unit_cost NULLS LAST
        LIMIT 1`,
      params,
    )) as Array<Record<string, unknown>>;
    if (!row) return null;
    return em.getRepository(InventoryItemSource).findOneBy({ id: row.id as string });
  }

  /** Creates a request for an order line shortfall (called inside the order allocation transaction). */
  async requestForOrderLine(
    em: EntityManager,
    organizationId: string,
    item: InventoryItem,
    qty: number,
    target: { orderId: string; orderItemId: string; storeId: string | null; warehouseId: string | null },
  ): Promise<ProcurementRequest> {
    const source = await this.bestSource(em, item.id);
    let leadDays: number | null = source?.leadTimeDays ?? null;
    if (source && leadDays == null) {
      const s = await em.getRepository(Supplier).findOneBy({ id: source.supplierId });
      leadDays = s?.defaultLeadTimeDays ?? null;
    }
    const repo = em.getRepository(ProcurementRequest);
    return repo.save(
      repo.create({
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
      }),
    );
  }

  /* ── Requests ───────────────────────────────────────────────────── */

  async listRequests(scope: StockScope, q: ProcurementQueryDto) {
    const params: unknown[] = [scope.organizationId];
    const where = ['p.organization_id = $1'];
    if (q.status) { params.push(q.status.split(',')); where.push(`p.status = ANY($${params.length})`); }
    if (q.supplierId) { params.push(q.supplierId); where.push(`p.supplier_id = $${params.length}`); }
    if (q.itemId) { params.push(q.itemId); where.push(`p.inventory_item_id = $${params.length}`); }
    const limit = q.limit ?? 100;
    const offset = q.offset ?? 0;
    const rows = await this.db.query(
      `SELECT p.id, p.status, p.reason, p.quantity, p.received_qty AS "receivedQty",
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
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return { total: rows[0]?.totalCount ?? 0, items: rows };
  }

  async createRequest(scope: StockScope, dto: CreateProcurementRequestDto) {
    return this.db.transaction(async (em) => {
      const item = await this.ops.loadItem(em, scope, dto.itemId);
      if (dto.warehouseId) await this.ops.loadWarehouse(em, scope, dto.warehouseId);
      let source: InventoryItemSource | null = null;
      if (dto.supplierId) {
        source = await em.getRepository(InventoryItemSource).findOneBy({ inventoryItemId: item.id, supplierId: dto.supplierId });
        const supplier = await em.getRepository(Supplier).findOneBy({ id: dto.supplierId, organizationId: scope.organizationId });
        if (!supplier) throw new NotFoundException('Supplier not found');
      } else {
        source = await this.bestSource(em, item.id, dto.fulfillmentMode);
      }
      const repo = em.getRepository(ProcurementRequest);
      const saved = await repo.save(
        repo.create({
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
        }),
      );
      return saved;
    });
  }

  async updateRequest(scope: StockScope, id: string, dto: UpdateProcurementRequestDto) {
    return this.db.transaction(async (em) => {
      const req = await this.lockRequest(em, scope, id);
      if (req.status !== 'open') throw new BadRequestException('Only open requests can be edited');
      if (dto.supplierId) {
        const supplier = await em.getRepository(Supplier).findOneBy({ id: dto.supplierId, organizationId: scope.organizationId });
        if (!supplier) throw new NotFoundException('Supplier not found');
        req.supplierId = supplier.id;
        const source = await em.getRepository(InventoryItemSource).findOneBy({ inventoryItemId: req.inventoryItemId, supplierId: supplier.id });
        req.sourceId = source?.id ?? null;
        if (source?.unitCost && dto.estimatedUnitCost === undefined) req.estimatedUnitCost = source.unitCost;
      }
      if (dto.warehouseId) { await this.ops.loadWarehouse(em, scope, dto.warehouseId); req.warehouseId = dto.warehouseId; }
      if (dto.fulfillmentMode) {
        if (dto.fulfillmentMode === 'dropship' && !req.orderId)
          throw new BadRequestException('Only order-driven requests can be dropshipped');
        req.fulfillmentMode = dto.fulfillmentMode;
      }
      if (dto.estimatedUnitCost !== undefined) req.estimatedUnitCost = String(dto.estimatedUnitCost);
      if (dto.note !== undefined) req.note = dto.note;
      return em.getRepository(ProcurementRequest).save(req);
    });
  }

  async cancelRequest(scope: StockScope, id: string) {
    const req = await this.db.transaction(async (em) => {
      const r = await this.lockRequest(em, scope, id);
      if (r.status !== 'open') throw new BadRequestException(`A ${r.status} request cannot be cancelled; cancel or close its purchase order instead`);
      r.status = 'cancelled';
      return em.getRepository(ProcurementRequest).save(r);
    });
    if (req.orderItemId) this.events.emit(ORDER_LINE_STOCK_EVENT, { orderItemId: req.orderItemId });
    return req;
  }

  private async lockRequest(em: EntityManager, scope: StockScope, id: string) {
    const r = await em.getRepository(ProcurementRequest).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
    if (!r) throw new NotFoundException('Procurement request not found');
    return r;
  }

  /** Supplier shipped an order-driven request straight to the buyer. */
  async markDropshipped(scope: StockScope, id: string, dto: DropshipDto) {
    const req = await this.db.transaction('READ COMMITTED', async (em) => {
      const r = await this.lockRequest(em, scope, id);
      if (!['open', 'ordered'].includes(r.status)) throw new BadRequestException(`Request is ${r.status}`);
      if (!r.orderId) throw new BadRequestException('Only order-driven requests can be dropshipped');
      r.fulfillmentMode = 'dropship';
      r.status = 'dropshipped';
      r.receivedQty = r.quantity;
      r.supplierTracking = dto.supplierTracking?.trim() || null;
      if (dto.unitCost !== undefined) r.estimatedUnitCost = String(dto.unitCost);
      if (dto.note) r.note = [r.note, dto.note].filter(Boolean).join('\n');
      const warehouseId = r.warehouseId ?? (await this.warehouses.ensureDefault(scope.organizationId, em)).id;
      // Zero-quantity audit entry: dropshipped goods never touch our stock.
      await this.ledger.apply(
        { organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `dropship:${r.id}` },
        [{
          itemId: r.inventoryItemId,
          warehouseId,
          type: 'dropship',
          orderId: r.orderId,
          orderItemId: r.orderItemId,
          storeId: r.storeId,
          unitCost: r.estimatedUnitCost,
          note: [dto.carrier, dto.supplierTracking].filter(Boolean).join(' ') || 'Dropshipped by supplier',
        }],
        em,
      );
      return em.getRepository(ProcurementRequest).save(r);
    });
    if (req.orderItemId) this.events.emit(ORDER_LINE_STOCK_EVENT, { orderItemId: req.orderItemId });
    return req;
  }

  /* ── Purchase orders ────────────────────────────────────────────── */

  async createPurchaseOrder(scope: StockScope, dto: CreatePurchaseOrderDto) {
    if (!dto.requestIds?.length && !dto.lines?.length)
      throw new BadRequestException('Add procurement requests or lines to the purchase order');
    return this.db.transaction(async (em) => {
      const supplier = await em.getRepository(Supplier).findOneBy({ id: dto.supplierId, organizationId: scope.organizationId });
      if (!supplier) throw new NotFoundException('Supplier not found');
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
      const lineRepo = em.getRepository(StockDocumentLine);
      const requests = dto.requestIds?.length
        ? await em.getRepository(ProcurementRequest).find({
            where: { id: In(dto.requestIds), organizationId: scope.organizationId },
            lock: { mode: 'pessimistic_write' },
          })
        : [];
      if (requests.length !== (dto.requestIds?.length ?? 0)) throw new BadRequestException('Unknown procurement request');
      for (const r of requests) {
        if (r.status !== 'open') throw new BadRequestException(`Request ${r.id} is ${r.status}`);
        if (r.fulfillmentMode === 'dropship') throw new BadRequestException('Dropship requests are not received into a warehouse; mark them dropshipped instead');
        if (r.supplierId && r.supplierId !== supplier.id) throw new BadRequestException('A request is assigned to a different supplier');
      }
      // One PO line per item; requests are linked to it.
      const byItem = new Map<string, ProcurementRequest[]>();
      for (const r of requests) byItem.set(r.inventoryItemId, [...(byItem.get(r.inventoryItemId) ?? []), r]);
      for (const [itemId, reqs] of byItem) {
        const source = await em.getRepository(InventoryItemSource).findOneBy({ inventoryItemId: itemId, supplierId: supplier.id });
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
      await em.getRepository(ProcurementRequest).save(requests);
      for (const l of dto.lines ?? []) {
        if (l.quantity <= 0) throw new BadRequestException('Purchase quantities must be positive');
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

  /** Groups open ship-to-warehouse requests by supplier into one draft PO each. */
  async purchaseOrdersFromRequests(scope: StockScope, dto: FromRequestsDto) {
    const requests = await this.db.getRepository(ProcurementRequest).findBy({ id: In(dto.requestIds), organizationId: scope.organizationId });
    if (requests.length !== dto.requestIds.length) throw new BadRequestException('Unknown procurement request');
    const unassigned = requests.filter((r) => !r.supplierId);
    if (unassigned.length) throw new BadRequestException(`${unassigned.length} request(s) have no supplier yet; choose one first`);
    const bySupplier = new Map<string, ProcurementRequest[]>();
    for (const r of requests) {
      if (r.status !== 'open' || r.fulfillmentMode === 'dropship') continue;
      bySupplier.set(r.supplierId!, [...(bySupplier.get(r.supplierId!) ?? []), r]);
    }
    if (!bySupplier.size) throw new BadRequestException('No open ship-to-warehouse requests selected');
    const created: StockDocument[] = [];
    for (const [supplierId, reqs] of bySupplier) {
      const warehouseId =
        dto.warehouseId ?? reqs.find((r) => r.warehouseId)?.warehouseId ?? (await this.warehouses.ensureDefault(scope.organizationId)).id;
      created.push(await this.createPurchaseOrder(scope, { supplierId, warehouseId, requestIds: reqs.map((r) => r.id) }));
    }
    return created;
  }

  /** Sends the PO: its quantities become inbound at the receiving warehouse. */
  async orderPurchaseOrder(scope: StockScope, id: string) {
    const itemIds: string[] = [];
    const po = await this.db.transaction('READ COMMITTED', async (em) => {
      const d = await this.lockPo(em, scope, id);
      if (d.status !== 'draft') throw new BadRequestException(`Purchase order is ${d.status}`);
      const lines = await em.getRepository(StockDocumentLine).findBy({ documentId: id });
      if (!lines.length) throw new BadRequestException('Purchase order has no lines');
      await this.ledger.apply(
        { organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `po-order:${d.id}` },
        lines.map((l) => ({ itemId: l.inventoryItemId, warehouseId: d.warehouseId, type: 'po_ordered' as const, inbound: l.quantity, documentId: d.id, unitCost: l.unitCost })),
        em,
      );
      itemIds.push(...lines.map((l) => l.inventoryItemId));
      await em.query(`UPDATE procurement_requests SET status = 'ordered', updated_at = now() WHERE purchase_order_id = $1 AND status = 'open'`, [id]);
      d.status = 'ordered';
      d.metadata = { ...d.metadata, orderedAt: new Date().toISOString(), orderedBy: scope.userId };
      return em.getRepository(StockDocument).save(d);
    });
    this.ledger.emitChanged(scope.organizationId, itemIds.map((itemId) => ({ itemId })));
    return po;
  }

  /**
   * Receives PO lines into a bin, then reserves the received units for the orders that
   * were waiting on them (oldest request first). Anything left over becomes free stock.
   */
  async receivePurchaseOrder(scope: StockScope, id: string, dto: ReceiveDocumentDto) {
    const itemIds: string[] = [];
    const touchedOrderLines: string[] = [];
    const po = await this.db.transaction('READ COMMITTED', async (em) => {
      const d = await this.lockPo(em, scope, id);
      if (!['ordered', 'partially_received'].includes(d.status)) throw new BadRequestException(`Purchase order is ${d.status}; mark it ordered first`);
      const lines = await em.getRepository(StockDocumentLine).findBy({ documentId: id });
      const byId = new Map(lines.map((l) => [l.id, l]));
      for (const r of dto.lines) {
        if (r.quantity === 0) continue;
        const line = byId.get(r.lineId);
        if (!line) throw new BadRequestException('Unknown purchase order line');
        if (line.processedQty + r.quantity > line.quantity)
          throw new BadRequestException(`Receiving ${r.quantity} would exceed the ordered quantity (${line.quantity - line.processedQty} outstanding)`);
        const locationId = r.locationId ?? line.locationId ?? null;
        await this.ops.assertLocation(em, d.warehouseId, locationId);
        const item = await this.ops.loadItem(em, scope, line.inventoryItemId);
        itemIds.push(item.id);
        const base: StockMovementCommand = {
          itemId: item.id,
          warehouseId: d.warehouseId,
          locationId,
          type: 'receipt',
          documentId: d.id,
          unitCost: line.unitCost,
        };
        const commands: StockMovementCommand[] = [{ ...base, locationId: null, inbound: -r.quantity }];
        if (item.trackingMode !== 'quantity') {
          commands.push(
            ...(await this.ops.createReceivedUnits(em, scope, item, base, r.quantity, {
              serials: r.serials,
              unitCost: line.unitCost != null ? Number(line.unitCost) : null,
            })),
          );
        } else {
          commands.push({ ...base, onHand: r.quantity });
        }
        await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId }, commands, em);
        if (line.unitCost != null) await this.ops.updateAverageCost(em, item, r.quantity, Number(line.unitCost));
        line.processedQty += r.quantity;

        // Receive-to-order.
        let left = r.quantity;
        const waiting = await em.getRepository(ProcurementRequest).find({
          where: { purchaseOrderLineId: line.id, status: In(['ordered', 'open']) },
          order: { createdAt: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        for (const req of waiting) {
          if (left <= 0) break;
          const take = Math.min(left, req.quantity - req.receivedQty);
          if (take <= 0) continue;
          if (req.orderItemId) {
            await this.reservations.allocate(
              em,
              scope.organizationId,
              scope.userId,
              item,
              take,
              { orderId: req.orderId, orderItemId: req.orderItemId, storeId: req.storeId },
              { warehouseId: d.warehouseId, locationId },
            );
            touchedOrderLines.push(req.orderItemId);
          }
          req.receivedQty += take;
          if (req.receivedQty >= req.quantity) req.status = 'received';
          left -= take;
        }
        await em.getRepository(ProcurementRequest).save(waiting);
      }
      await em.getRepository(StockDocumentLine).save(lines);
      const done = lines.every((l) => l.processedQty >= l.quantity);
      d.status = done ? 'completed' : 'partially_received';
      if (done) { d.completedAt = new Date(); d.completedBy = scope.userId; }
      return em.getRepository(StockDocument).save(d);
    });
    this.ops.afterReceipt(scope.organizationId, [...new Set(itemIds)]);
    for (const orderItemId of new Set(touchedOrderLines)) this.events.emit(ORDER_LINE_STOCK_EVENT, { orderItemId });
    return po;
  }

  /**
   * Draft: cancelled, requests reopen. Ordered / partially received: outstanding quantity
   * is closed short — inbound is reversed and unfilled requests go back to `open`.
   */
  async cancelPurchaseOrder(scope: StockScope, id: string) {
    const itemIds: string[] = [];
    const po = await this.db.transaction('READ COMMITTED', async (em) => {
      const d = await this.lockPo(em, scope, id);
      if (['completed', 'cancelled'].includes(d.status)) throw new BadRequestException(`Purchase order is ${d.status}`);
      const lines = await em.getRepository(StockDocumentLine).findBy({ documentId: id });
      if (d.status !== 'draft') {
        const commands = lines
          .filter((l) => l.quantity > l.processedQty)
          .map((l) => ({ itemId: l.inventoryItemId, warehouseId: d.warehouseId, type: 'po_cancelled' as const, inbound: -(l.quantity - l.processedQty), documentId: d.id }));
        itemIds.push(...commands.map((c) => c.itemId));
        await this.ledger.apply({ organizationId: scope.organizationId, actorUserId: scope.userId, operationKey: `po-cancel:${d.id}` }, commands, em);
      }
      await em.query(
        `UPDATE procurement_requests
            SET status = 'open', purchase_order_id = NULL, purchase_order_line_id = NULL, updated_at = now()
          WHERE purchase_order_id = $1 AND status IN ('open','ordered')`,
        [id],
      );
      const anyReceived = lines.some((l) => l.processedQty > 0);
      d.status = anyReceived ? 'completed' : 'cancelled';
      d.metadata = { ...d.metadata, closedShortAt: new Date().toISOString(), closedBy: scope.userId };
      return em.getRepository(StockDocument).save(d);
    });
    if (itemIds.length) this.ledger.emitChanged(scope.organizationId, itemIds.map((itemId) => ({ itemId })));
    return po;
  }

  private async lockPo(em: EntityManager, scope: StockScope, id: string) {
    const d = await em.getRepository(StockDocument).findOne({ where: { id, organizationId: scope.organizationId }, lock: { mode: 'pessimistic_write' } });
    if (!d || d.docType !== 'purchase_order') throw new NotFoundException('Purchase order not found');
    this.access.assertWarehouse(scope, d.warehouseId);
    return d;
  }

  /* ── Reorder ────────────────────────────────────────────────────── */

  /** Items whose stock position (available + inbound + open requests) is at or below the reorder point. */
  async reorderSuggestions(scope: StockScope, createRequests = false) {
    const rows = (await this.db.query(
      `SELECT i.id, i.sku, i.title, i.reorder_point AS "reorderPoint", i.reorder_qty AS "reorderQty",
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
        LIMIT 500`,
      [scope.organizationId],
    )) as Array<{ id: string; reorderPoint: number; reorderQty: number; position: number }>;
    const suggestions = rows.map((r) => ({ ...r, suggestedQty: Math.max(r.reorderQty, r.reorderPoint - r.position + 1) }));
    if (!createRequests) return { suggestions, created: 0 };
    let created = 0;
    for (const s of suggestions) {
      await this.db.transaction(async (em) => {
        const item = await this.ops.loadItem(em, scope, s.id);
        const source = await this.bestSource(em, item.id, 'ship_to_warehouse');
        await em.getRepository(ProcurementRequest).save({
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

  async summary(scope: StockScope) {
    const [row] = (await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')::int AS open,
         COUNT(*) FILTER (WHERE status = 'open' AND supplier_id IS NULL)::int AS "needsSupplier",
         COUNT(*) FILTER (WHERE status = 'ordered')::int AS ordered,
         COUNT(*) FILTER (WHERE status = 'open' AND fulfillment_mode = 'dropship')::int AS "dropshipPending",
         COUNT(*) FILTER (WHERE status IN ('open','ordered') AND needed_by < now())::int AS overdue
         FROM procurement_requests WHERE organization_id = $1`,
      [scope.organizationId],
    )) as Array<Record<string, number>>;
    return row;
  }

}
