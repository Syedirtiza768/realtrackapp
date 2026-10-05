import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { InventoryItem, SourcingMode, TrackingMode } from './entities/index.js';
import { CreateItemDto, ItemsQueryDto, UpdateItemDto } from './dto/stock.dto.js';
import { StockAccessService, StockScope } from './stock-access.service.js';
import { StockLedgerService, isUniqueViolation } from './stock-ledger.service.js';

export interface ProductRef {
  sku: string;
  vertical?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  catalogProductId?: string | null;
  listingRecordId?: string | null;
  productVariantId?: string | null;
  trackingMode?: TrackingMode;
  sourcingMode?: SourcingMode;
}

/** Columns of the `rows` CTE in list(). */
const SORTS: Record<string, string> = {
  sku: 'sku',
  title: 'title',
  on_hand: 'on_hand',
  available: 'available',
  updated: 'updated_at',
};

@Injectable()
export class InventoryItemsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: StockAccessService,
    private readonly ledger: StockLedgerService,
  ) {}

  /** Stock overview: one row per SKU with on-hand / reserved / available / inbound / sourceable. */
  async list(scope: StockScope, q: ItemsQueryDto, canSeeCost: boolean) {
    const params: unknown[] = [scope.organizationId];
    const where: string[] = ['i.organization_id = $1'];
    const levelFilters: string[] = [];
    const whScope = this.access.warehouseFilter(scope, 'sl.warehouse_id', params);
    levelFilters.push(whScope);
    if (q.warehouseId) {
      this.access.assertWarehouse(scope, q.warehouseId);
      params.push(q.warehouseId);
      levelFilters.push(`sl.warehouse_id = $${params.length}`);
    }
    if (q.q?.trim()) {
      params.push(`%${q.q.trim().replace(/[%_]/g, (m) => `\\${m}`)}%`);
      where.push(`(i.sku ILIKE $${params.length} OR i.title ILIKE $${params.length} OR i.barcode ILIKE $${params.length})`);
    }
    if (q.sourcingMode) {
      params.push(q.sourcingMode);
      where.push(`i.sourcing_mode = $${params.length}`);
    }
    params.push(q.status ?? 'active');
    where.push(`i.status = $${params.length}`);
    if (q.vertical) {
      params.push(q.vertical);
      where.push(`i.vertical = $${params.length}`);
    }

    const having: string[] = [];
    switch (q.filter) {
      case 'in_stock': having.push('available > 0'); break;
      case 'out_of_stock': having.push('available <= 0'); break;
      case 'low_stock': having.push('available <= low_stock_threshold'); break;
      case 'reserved': having.push('reserved > 0'); break;
      case 'inbound': having.push('inbound > 0'); break;
      case 'sourceable': having.push('sourceable > 0'); break;
      case 'unlinked': where.push('i.catalog_product_id IS NULL AND i.listing_record_id IS NULL AND i.product_variant_id IS NULL'); break;
    }

    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    const sort = SORTS[q.sort ?? 'sku'] ?? 'sku';
    const dir = q.dir === 'desc' ? 'DESC' : 'ASC';

    const base = `
      WITH lv AS (
        SELECT sl.inventory_item_id,
               SUM(sl.on_hand)::int on_hand, SUM(sl.reserved)::int reserved, SUM(sl.damaged)::int damaged,
               SUM(sl.inbound)::int inbound, SUM(sl.available)::int available,
               json_agg(json_build_object('warehouseId', w.id, 'code', w.code, 'onHand', sl.on_hand,
                        'available', sl.available, 'bin', l.code) ORDER BY w.code, l.code)
                 FILTER (WHERE sl.on_hand > 0 OR sl.inbound > 0) AS breakdown,
               MAX(sl.last_received_at) last_received_at
          FROM stock_levels sl
          JOIN warehouses w ON w.id = sl.warehouse_id
          LEFT JOIN warehouse_locations l ON l.id = sl.location_id
         WHERE sl.organization_id = $1 AND ${levelFilters.join(' AND ')}
         GROUP BY sl.inventory_item_id
      ), src AS (
        SELECT inventory_item_id, COALESCE(SUM(available_qty) FILTER (WHERE active), 0)::int sourceable,
               COUNT(*) FILTER (WHERE active)::int source_count,
               MIN(unit_cost) FILTER (WHERE active) best_cost
          FROM inventory_item_sources WHERE organization_id = $1 GROUP BY inventory_item_id
      ), pr AS (
        SELECT inventory_item_id,
               SUM(quantity - received_qty) FILTER (WHERE status IN ('open','ordered'))::int pending_procurement
          FROM procurement_requests WHERE organization_id = $1 GROUP BY inventory_item_id
      ), rows AS (
        SELECT i.*, COALESCE(lv.on_hand,0) on_hand, COALESCE(lv.reserved,0) reserved,
               COALESCE(lv.damaged,0) damaged, COALESCE(lv.inbound,0) inbound,
               COALESCE(lv.available,0) available, lv.breakdown, lv.last_received_at,
               COALESCE(src.sourceable,0) sourceable, COALESCE(src.source_count,0) source_count,
               src.best_cost, COALESCE(pr.pending_procurement,0) pending_procurement
          FROM inventory_items i
          LEFT JOIN lv ON lv.inventory_item_id = i.id
          LEFT JOIN src ON src.inventory_item_id = i.id
          LEFT JOIN pr ON pr.inventory_item_id = i.id
         WHERE ${where.join(' AND ')}
      )`;
    const filtered = `SELECT * FROM rows ${having.length ? `WHERE ${having.join(' AND ')}` : ''}`;

    const [{ total }] = (await this.db.query(
      `${base} SELECT count(*)::int total FROM (${filtered}) f`,
      params,
    )) as Array<{ total: number }>;
    const rows = (await this.db.query(
      `${base} SELECT * FROM (${filtered}) f ORDER BY ${sort} ${dir} NULLS LAST, id LIMIT ${limit} OFFSET ${offset}`,
      params,
    )) as Array<Record<string, unknown>>;

    return {
      total,
      limit,
      offset,
      items: rows.map((r) => this.mapListRow(r, canSeeCost)),
    };
  }

  private mapListRow(r: Record<string, unknown>, canSeeCost: boolean) {
    return {
      id: r.id,
      sku: r.sku,
      title: r.title,
      imageUrl: r.image_url,
      vertical: r.vertical,
      trackingMode: r.tracking_mode,
      sourcingMode: r.sourcing_mode,
      status: r.status,
      catalogProductId: r.catalog_product_id,
      listingRecordId: r.listing_record_id,
      productVariantId: r.product_variant_id,
      onHand: r.on_hand,
      reserved: r.reserved,
      damaged: r.damaged,
      inbound: r.inbound,
      available: r.available,
      sourceable: r.sourceable,
      sourceCount: r.source_count,
      pendingProcurement: r.pending_procurement,
      lowStockThreshold: r.low_stock_threshold,
      reorderPoint: r.reorder_point,
      breakdown: r.breakdown ?? [],
      lastReceivedAt: r.last_received_at,
      unitCost: canSeeCost ? r.unit_cost : undefined,
      bestSourceCost: canSeeCost ? r.best_cost : undefined,
      updatedAt: r.updated_at,
    };
  }

  async get(scope: StockScope, id: string) {
    const item = await this.db
      .getRepository(InventoryItem)
      .findOneBy({ id, organizationId: scope.organizationId });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async detail(scope: StockScope, id: string, opts: { canSeeCost: boolean; canSeePrivateSerials: boolean }) {
    const item = await this.get(scope, id);
    const params: unknown[] = [id];
    const whFilter = this.access.warehouseFilter(scope, 'sl.warehouse_id', params);
    const levels = await this.db.query(
      `SELECT sl.id, sl.warehouse_id AS "warehouseId", w.code AS "warehouseCode", w.name AS "warehouseName",
              w.is_sellable AS "isSellable", sl.location_id AS "locationId", l.code AS "locationCode",
              l.type AS "locationType", sl.on_hand AS "onHand", sl.reserved, sl.damaged, sl.inbound,
              sl.available, sl.last_received_at AS "lastReceivedAt", sl.updated_at AS "updatedAt"
         FROM stock_levels sl
         JOIN warehouses w ON w.id = sl.warehouse_id
         LEFT JOIN warehouse_locations l ON l.id = sl.location_id
        WHERE sl.inventory_item_id = $1 AND ${whFilter}
          AND (sl.on_hand > 0 OR sl.inbound > 0 OR sl.reserved > 0)
        ORDER BY w.code, l.code NULLS FIRST`,
      params,
    );
    const units = await this.db.query(
      `SELECT u.id, u.status, u.serial_public AS "serialPublic",
              ${opts.canSeePrivateSerials ? 'u.serial_private' : 'NULL'} AS "serialPrivate",
              u.lot_code AS "lotCode", u.condition_id AS "conditionId",
              u.warehouse_id AS "warehouseId", w.code AS "warehouseCode",
              u.location_id AS "locationId", l.code AS "locationCode",
              u.received_at AS "receivedAt", u.reservation_id AS "reservationId"
              ${opts.canSeeCost ? ', u.unit_cost AS "unitCost"' : ''}
         FROM inventory_units u
         LEFT JOIN warehouses w ON w.id = u.warehouse_id
         LEFT JOIN warehouse_locations l ON l.id = u.location_id
        WHERE u.inventory_item_id = $1
        ORDER BY (u.status IN ('available','reserved','picked')) DESC, u.received_at DESC NULLS LAST
        LIMIT 500`,
      [id],
    );
    const reservations = await this.db.query(
      `SELECT r.id, r.status, r.quantity, r.order_id AS "orderId", r.order_item_id AS "orderItemId",
              r.store_id AS "storeId", o.external_order_id AS "externalOrderId", o.status AS "orderStatus",
              w.code AS "warehouseCode", l.code AS "locationCode", r.created_at AS "createdAt"
         FROM stock_reservations r
         JOIN warehouses w ON w.id = r.warehouse_id
         LEFT JOIN warehouse_locations l ON l.id = r.location_id
         LEFT JOIN orders o ON o.id = r.order_id
        WHERE r.inventory_item_id = $1 AND r.status IN ('active','picked')
        ORDER BY r.created_at`,
      [id],
    );
    const procurement = await this.db.query(
      `SELECT p.id, p.status, p.quantity, p.received_qty AS "receivedQty", p.reason,
              p.fulfillment_mode AS "fulfillmentMode", s.name AS "supplierName",
              d.doc_number AS "purchaseOrderNumber", p.purchase_order_id AS "purchaseOrderId",
              p.order_id AS "orderId", o.external_order_id AS "externalOrderId", p.created_at AS "createdAt"
         FROM procurement_requests p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN stock_documents d ON d.id = p.purchase_order_id
         LEFT JOIN orders o ON o.id = p.order_id
        WHERE p.inventory_item_id = $1 AND p.status IN ('open','ordered')
        ORDER BY p.created_at`,
      [id],
    );
    const channels = await this.db.query(
      `SELECT c.store_id AS "storeId", s.store_name AS "storeName", s.channel, c.status,
              c.desired_qty AS "desiredQty", c.pushed_qty AS "pushedQty", c.channel_qty AS "channelQty",
              c.last_error AS "lastError", c.last_pushed_at AS "lastPushedAt", c.targets, c.updated_at AS "updatedAt"
         FROM channel_stock_sync_state c JOIN stores s ON s.id = c.store_id
        WHERE c.inventory_item_id = $1 ORDER BY s.store_name`,
      [id],
    );
    const movements = await this.db.query(
      `SELECT m.id, m.movement_type AS "type", m.qty_on_hand AS "qtyOnHand", m.qty_reserved AS "qtyReserved",
              m.qty_damaged AS "qtyDamaged", m.qty_inbound AS "qtyInbound", m.on_hand_after AS "onHandAfter",
              m.reason_code AS "reasonCode", m.note, w.code AS "warehouseCode", l.code AS "locationCode",
              d.doc_number AS "documentNumber", m.document_id AS "documentId", m.order_id AS "orderId",
              u.email AS "actorEmail", m.created_at AS "createdAt"
         FROM stock_movements m
         JOIN warehouses w ON w.id = m.warehouse_id
         LEFT JOIN warehouse_locations l ON l.id = m.location_id
         LEFT JOIN stock_documents d ON d.id = m.document_id
         LEFT JOIN users u ON u.id = m.actor_user_id
        WHERE m.inventory_item_id = $1
        ORDER BY m.created_at DESC LIMIT 100`,
      [id],
    );
    const [links] = (await this.db.query(
      `SELECT
         (SELECT json_build_object('id', id, 'title', title, 'quantity', quantity) FROM catalog_products WHERE id = $1) AS "catalogProduct",
         (SELECT json_build_object('id', id, 'title', title, 'quantity', "quantityNum", 'status', status) FROM listing_records WHERE id = $2) AS "listingRecord",
         (SELECT json_build_object('id', id, 'sku', sku, 'quantity', quantity) FROM product_variants WHERE id = $3) AS "productVariant"`,
      [item.catalogProductId, item.listingRecordId, item.productVariantId],
    )) as Array<Record<string, unknown>>;

    return {
      item: { ...item, unitCost: opts.canSeeCost ? item.unitCost : undefined },
      levels,
      units,
      reservations,
      procurement,
      channels,
      movements,
      links,
    };
  }

  async create(scope: StockScope, dto: CreateItemDto) {
    const sku = dto.sku.trim();
    if (!sku) throw new BadRequestException('SKU is required');
    await this.assertLinksInOrg(this.db.manager, scope.organizationId, dto);
    const repo = this.db.getRepository(InventoryItem);
    try {
      return await repo.save(
        repo.create({
          organizationId: scope.organizationId,
          sku,
          title: dto.title?.trim() || null,
          vertical: dto.vertical ?? 'automotive',
          catalogProductId: dto.catalogProductId ?? null,
          listingRecordId: dto.listingRecordId ?? null,
          productVariantId: dto.productVariantId ?? null,
          trackingMode: dto.trackingMode ?? 'quantity',
          sourcingMode: dto.sourcingMode ?? 'stocked',
          unitCost: dto.unitCost !== undefined ? String(dto.unitCost) : null,
          barcode: dto.barcode?.trim() || null,
          lowStockThreshold: dto.lowStockThreshold ?? 1,
          reorderPoint: dto.reorderPoint ?? 0,
          reorderQty: dto.reorderQty ?? 0,
        }),
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`SKU ${sku} already exists in stock`);
      throw err;
    }
  }

  async update(scope: StockScope, id: string, dto: UpdateItemDto) {
    const item = await this.get(scope, id);
    await this.assertLinksInOrg(this.db.manager, scope.organizationId, dto);
    if (dto.trackingMode && dto.trackingMode !== item.trackingMode) {
      const [{ onHand }] = (await this.db.query(
        `SELECT COALESCE(SUM(on_hand),0)::int "onHand" FROM stock_levels WHERE inventory_item_id = $1`,
        [id],
      )) as Array<{ onHand: number }>;
      if (onHand > 0 && (dto.trackingMode === 'serial' || item.trackingMode === 'serial'))
        throw new BadRequestException('Change serial tracking only when the item has no stock on hand');
    }
    const sourcingChanged = dto.sourcingMode !== undefined && dto.sourcingMode !== item.sourcingMode;
    Object.assign(item, {
      ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
      ...(dto.catalogProductId !== undefined ? { catalogProductId: dto.catalogProductId } : {}),
      ...(dto.listingRecordId !== undefined ? { listingRecordId: dto.listingRecordId } : {}),
      ...(dto.productVariantId !== undefined ? { productVariantId: dto.productVariantId } : {}),
      ...(dto.trackingMode !== undefined ? { trackingMode: dto.trackingMode } : {}),
      ...(dto.sourcingMode !== undefined ? { sourcingMode: dto.sourcingMode } : {}),
      ...(dto.unitCost !== undefined ? { unitCost: dto.unitCost === null ? null : String(dto.unitCost) } : {}),
      ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}),
      ...(dto.lowStockThreshold !== undefined ? { lowStockThreshold: dto.lowStockThreshold } : {}),
      ...(dto.reorderPoint !== undefined ? { reorderPoint: dto.reorderPoint } : {}),
      ...(dto.reorderQty !== undefined ? { reorderQty: dto.reorderQty } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });
    const saved = await this.db.getRepository(InventoryItem).save(item);
    if (sourcingChanged || dto.status !== undefined) {
      await this.ledger.markChannelDirty(this.db.manager, scope.organizationId, [id]);
      this.ledger.emitChanged(scope.organizationId, [{ itemId: id }]);
    }
    return saved;
  }

  private async assertLinksInOrg(
    em: EntityManager,
    org: string,
    dto: { catalogProductId?: string | null; listingRecordId?: string | null; productVariantId?: string | null },
  ) {
    const check = async (sql: string, id: string | null | undefined, label: string) => {
      if (!id) return;
      const [row] = (await em.query(sql, [id, org])) as unknown[];
      if (!row) throw new BadRequestException(`${label} not found in this workspace`);
    };
    await check(`SELECT 1 FROM catalog_products WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`, dto.catalogProductId, 'Catalog product');
    await check(`SELECT 1 FROM listing_records WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`, dto.listingRecordId, 'Listing');
    await check(`SELECT 1 FROM product_variants WHERE id = $1 AND organization_id = $2`, dto.productVariantId, 'Product variant');
  }

  /**
   * Finds the SKU-master row for a product, creating it if needed and filling in any
   * missing links. Used by vertical intake hooks, order matching, and the bootstrap.
   */
  async findOrCreate(em: EntityManager, organizationId: string, ref: ProductRef): Promise<InventoryItem> {
    const repo = em.getRepository(InventoryItem);
    const sku = ref.sku.trim();
    let item = await repo.findOneBy({ organizationId, sku });
    if (!item) {
      await em.query(
        `INSERT INTO inventory_items (organization_id, sku, vertical, title, image_url, catalog_product_id,
                                      listing_record_id, product_variant_id, tracking_mode, sourcing_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (organization_id, sku) DO NOTHING`,
        [
          organizationId,
          sku,
          ref.vertical ?? 'automotive',
          ref.title ?? null,
          ref.imageUrl ?? null,
          ref.catalogProductId ?? null,
          ref.listingRecordId ?? null,
          ref.productVariantId ?? null,
          ref.trackingMode ?? 'quantity',
          ref.sourcingMode ?? 'stocked',
        ],
      );
      item = await repo.findOneByOrFail({ organizationId, sku });
      return item;
    }
    let changed = false;
    if (!item.catalogProductId && ref.catalogProductId) { item.catalogProductId = ref.catalogProductId; changed = true; }
    if (!item.listingRecordId && ref.listingRecordId) { item.listingRecordId = ref.listingRecordId; changed = true; }
    if (!item.productVariantId && ref.productVariantId) { item.productVariantId = ref.productVariantId; changed = true; }
    if (!item.title && ref.title) { item.title = ref.title; changed = true; }
    if (!item.imageUrl && ref.imageUrl) { item.imageUrl = ref.imageUrl; changed = true; }
    return changed ? repo.save(item) : item;
  }

  /** Resolves a scanned barcode to an item, bin, or serialized unit. */
  async scan(scope: StockScope, code: string, canSeePrivateSerials: boolean) {
    const c = code.trim();
    if (!c) throw new BadRequestException('Empty code');
    const items = await this.db.query(
      `SELECT id, sku, title, image_url AS "imageUrl", tracking_mode AS "trackingMode"
         FROM inventory_items WHERE organization_id = $1 AND (barcode = $2 OR upper(sku) = upper($2)) LIMIT 5`,
      [scope.organizationId, c],
    );
    const params: unknown[] = [scope.organizationId, c];
    const whFilter = this.access.warehouseFilter(scope, 'l.warehouse_id', params);
    const locations = await this.db.query(
      `SELECT l.id, l.code, l.warehouse_id AS "warehouseId", w.code AS "warehouseCode"
         FROM warehouse_locations l JOIN warehouses w ON w.id = l.warehouse_id
        WHERE l.organization_id = $1 AND (l.barcode = $2 OR upper(l.code) = upper($2)) AND l.active AND ${whFilter}
        LIMIT 5`,
      params,
    );
    const units = await this.db.query(
      `SELECT u.id, u.inventory_item_id AS "itemId", i.sku, u.status, u.serial_public AS "serialPublic",
              u.warehouse_id AS "warehouseId", u.location_id AS "locationId"
         FROM inventory_units u JOIN inventory_items i ON i.id = u.inventory_item_id
        WHERE u.organization_id = $1
          AND (u.serial_public = $2 ${canSeePrivateSerials ? 'OR u.serial_private = $2' : ''})
        LIMIT 5`,
      [scope.organizationId, c],
    );
    return { code: c, items, locations, units };
  }
}
