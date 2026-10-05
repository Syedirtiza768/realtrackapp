import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StockAccessService, StockScope } from './stock-access.service.js';

@Injectable()
export class StockReportsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: StockAccessService,
  ) {}

  /** Headline numbers for the Stock overview. Cost figures only when allowed. */
  async summary(scope: StockScope, canSeeCost: boolean) {
    const params: unknown[] = [scope.organizationId];
    const wh = this.access.warehouseFilter(scope, 'sl.warehouse_id', params);
    const [stock] = (await this.db.query(
      `SELECT COUNT(DISTINCT sl.inventory_item_id) FILTER (WHERE sl.on_hand > 0)::int AS "skusInStock",
              COALESCE(SUM(sl.on_hand),0)::int AS "onHand", COALESCE(SUM(sl.reserved),0)::int AS reserved,
              COALESCE(SUM(sl.available),0)::int AS available, COALESCE(SUM(sl.inbound),0)::int AS inbound,
              COALESCE(SUM(sl.damaged),0)::int AS damaged
              ${canSeeCost ? ', COALESCE(SUM(sl.on_hand * i.unit_cost),0)::numeric(14,2) AS "stockValue"' : ''}
         FROM stock_levels sl JOIN inventory_items i ON i.id = sl.inventory_item_id
        WHERE sl.organization_id = $1 AND ${wh}`,
      params,
    )) as Array<Record<string, unknown>>;
    const [counts] = (await this.db.query(
      `SELECT (SELECT count(*)::int FROM inventory_items WHERE organization_id = $1 AND status = 'active') AS "activeSkus",
              (SELECT count(*)::int FROM inventory_items WHERE organization_id = $1 AND status = 'active' AND sourcing_mode <> 'stocked') AS "sourceableSkus",
              (SELECT count(*)::int FROM (
                 SELECT i.id FROM inventory_items i LEFT JOIN stock_levels sl ON sl.inventory_item_id = i.id
                  WHERE i.organization_id = $1 AND i.status = 'active' AND i.sourcing_mode <> 'on_demand'
                  GROUP BY i.id, i.low_stock_threshold
                 HAVING COALESCE(SUM(sl.available),0) <= i.low_stock_threshold AND COALESCE(SUM(sl.on_hand),0) > 0) x) AS "lowStock",
              (SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN stores s ON s.id = o.store_id
                WHERE s.organization_id = $1 AND oi.stock_status IN ('backorder','unmatched')
                  AND o.status NOT IN ('cancelled','refunded')) AS "orderExceptions",
              (SELECT count(*)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN stores s ON s.id = o.store_id
                WHERE s.organization_id = $1 AND oi.stock_status = 'awaiting_procurement'
                  AND o.status NOT IN ('cancelled','refunded')) AS "awaitingProcurement",
              (SELECT count(*)::int FROM stock_reservations WHERE organization_id = $1 AND status = 'active') AS "toPick",
              (SELECT count(*)::int FROM stock_documents WHERE organization_id = $1 AND status = 'pending_approval') AS "pendingApprovals",
              (SELECT count(*)::int FROM stock_documents WHERE organization_id = $1 AND doc_type = 'transfer' AND status IN ('in_transit','partially_received')) AS "transfersInTransit",
              (SELECT count(*)::int FROM stock_documents WHERE organization_id = $1 AND doc_type = 'purchase_order' AND status IN ('ordered','partially_received')) AS "openPurchaseOrders"`,
      [scope.organizationId],
    )) as Array<Record<string, number>>;
    return { ...stock, ...counts };
  }

  /** Stock value per warehouse at weighted-average cost. */
  async valuation(scope: StockScope) {
    const params: unknown[] = [scope.organizationId];
    const wh = this.access.warehouseFilter(scope, 'w.id', params);
    return this.db.query(
      `SELECT w.id AS "warehouseId", w.code, w.name,
              COALESCE(SUM(sl.on_hand),0)::int AS "onHand",
              COALESCE(SUM(sl.on_hand * i.unit_cost),0)::numeric(14,2) AS value,
              COUNT(DISTINCT sl.inventory_item_id) FILTER (WHERE sl.on_hand > 0 AND i.unit_cost IS NULL)::int AS "unCostedSkus"
         FROM warehouses w
         LEFT JOIN stock_levels sl ON sl.warehouse_id = w.id
         LEFT JOIN inventory_items i ON i.id = sl.inventory_item_id
        WHERE w.organization_id = $1 AND ${wh}
        GROUP BY w.id ORDER BY w.code`,
      params,
    );
  }

  /** On-hand stock bucketed by days since it was last received. */
  async aging(scope: StockScope) {
    const params: unknown[] = [scope.organizationId];
    const wh = this.access.warehouseFilter(scope, 'sl.warehouse_id', params);
    const buckets = await this.db.query(
      `SELECT CASE WHEN age < 30 THEN '0-29' WHEN age < 90 THEN '30-89' WHEN age < 180 THEN '90-179' ELSE '180+' END AS bucket,
              COUNT(DISTINCT inventory_item_id)::int AS skus, SUM(on_hand)::int AS units
         FROM (SELECT sl.inventory_item_id, sl.on_hand,
                      EXTRACT(day FROM now() - COALESCE(sl.last_received_at, sl.updated_at))::int AS age
                 FROM stock_levels sl WHERE sl.organization_id = $1 AND sl.on_hand > 0 AND ${wh}) x
        GROUP BY 1 ORDER BY min(age)`,
      params,
    );
    const oldest = await this.db.query(
      `SELECT i.id, i.sku, i.title, SUM(sl.on_hand)::int AS "onHand",
              MIN(COALESCE(sl.last_received_at, sl.updated_at)) AS "since"
         FROM stock_levels sl JOIN inventory_items i ON i.id = sl.inventory_item_id
        WHERE sl.organization_id = $1 AND sl.on_hand > 0 AND ${wh}
        GROUP BY i.id ORDER BY "since" LIMIT 25`,
      params,
    );
    return { buckets, oldest };
  }
}
