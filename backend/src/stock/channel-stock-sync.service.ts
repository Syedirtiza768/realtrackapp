import { Injectable, Logger, NotFoundException, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { SchedulerLeaderService } from '../common/scheduler/scheduler-leader.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../channels/ebay/ebay-trading-api.service.js';
import { ChannelSyncStatus } from './entities/index.js';
import { STOCK_CHANGED_EVENT } from './stock-ledger.service.js';
import { StockScope } from './stock-access.service.js';

export const STOCK_CHANNEL_SYNC_QUEUE = 'stock-channel-sync';
/** Global kill switch. Even when on, each store's policy.push_enabled must also be on. */
export const STOCK_CHANNEL_PUSH_FLAG = 'stock_channel_push';
/** Same value as PARTSBAZAR360_CHANNEL; kept local so StockModule builds without that integration. */
const PARTSBAZAR360_CHANNEL = 'partsbazar360';

interface PartsBazarQuantityPush {
  publish(connectionId: string, listingId: string, overrides: { quantity: number }): Promise<unknown>;
  end(listingId: string): Promise<unknown>;
}

export type ChannelTarget =
  | { kind: 'ebay_offer'; offerId: string; sku: string | null; publishedListingId: string; channelQty: number }
  | { kind: 'ebay_item'; itemId: string; marketplaceId: string; publishedListingId: string; channelQty: number }
  | { kind: 'pb360'; connectionId: string; listingId: string; channelQty: number | null };

export interface DesiredQuantity {
  desired: number;
  onHandAvailable: number;
  sourceable: number;
  bufferQty: number;
  maxQty: number | null;
  pushEnabled: boolean;
  itemActive: boolean;
}

type SyncRow = { store_id: string; inventory_item_id: string; organization_id: string; pushed_qty: number | null; attempts: number };

/**
 * Advertised quantity per store:
 *   desired = max(0, Σ available in active sellable warehouses linked to the store − buffer)
 *           + sourceable                      (on_demand / hybrid items only)
 *   sourceable = clamp(Σ active supplier available_qty − open unordered requests, 0, max_sourceable_qty)
 *   capped at max_qty.
 * Channels are always sent the absolute number, never a delta.
 */
@Injectable()
export class ChannelStockSyncService {
  private readonly logger = new Logger(ChannelStockSyncService.name);

  constructor(
    private readonly db: DataSource,
    private readonly flags: FeatureFlagService,
    private readonly leader: SchedulerLeaderService,
    private readonly ebayInventory: EbayInventoryApiService,
    private readonly ebayTrading: EbayTradingApiService,
    private readonly moduleRef: ModuleRef,
    @InjectQueue(STOCK_CHANNEL_SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  /** Debounced: rapid stock changes collapse into one sweep a few seconds later. */
  @OnEvent(STOCK_CHANGED_EVENT)
  async onStockChanged(payload: { organizationId: string }) {
    try {
      await this.queue.add(
        'sweep',
        { organizationId: payload.organizationId },
        { jobId: `sweep-${payload.organizationId}`, delay: 3_000, removeOnComplete: true, removeOnFail: 50 },
      );
    } catch (err) {
      this.logger.warn(`Could not enqueue channel stock sweep: ${(err as Error).message}`);
    }
  }

  /** Safety net for changes committed inside callers' transactions and for retries. */
  @Cron('*/2 * * * *', { name: 'stock-channel-sync-sweep' })
  async cronSweep() {
    await this.leader.runIfLeader('stock-channel-sync-sweep', 100_000, async () => {
      await this.queue.add('sweep', {}, { jobId: `sweep-cron-${Math.floor(Date.now() / 120_000)}`, removeOnComplete: true, removeOnFail: 50 });
    });
  }

  /** Nightly: refresh channel_qty from the eBay snapshot and flag drift. */
  @Cron('30 2 * * *', { name: 'stock-channel-drift-check' })
  async cronDrift() {
    await this.leader.runIfLeader('stock-channel-drift-check', 3_600_000, async () => {
      await this.queue.add('drift', {}, { jobId: `drift-${new Date().toISOString().slice(0, 10)}`, removeOnComplete: true, removeOnFail: 20 });
    });
  }

  async computeDesired(storeId: string, itemId: string): Promise<DesiredQuantity> {
    const [row] = (await this.db.query(
      `SELECT i.status, i.sourcing_mode,
              COALESCE(p.push_enabled, false) AS push_enabled, COALESCE(p.buffer_qty, 0) AS buffer_qty,
              p.max_qty, COALESCE(p.include_sourceable, true) AS include_sourceable,
              COALESCE(p.max_sourceable_qty, 5) AS max_sourceable_qty,
              COALESCE((SELECT SUM(sl.available) FROM stock_levels sl
                          JOIN warehouses w ON w.id = sl.warehouse_id AND w.active AND w.is_sellable
                          JOIN store_warehouse_links l ON l.warehouse_id = w.id AND l.store_id = $1 AND l.active
                         WHERE sl.inventory_item_id = i.id), 0)::int AS on_hand_available,
              COALESCE((SELECT SUM(x.available_qty) FROM inventory_item_sources x
                          JOIN suppliers s ON s.id = x.supplier_id AND s.active
                         WHERE x.inventory_item_id = i.id AND x.active), 0)::int AS supplier_available,
              COALESCE((SELECT SUM(r.quantity - r.received_qty) FROM procurement_requests r
                         WHERE r.inventory_item_id = i.id AND r.status = 'open'), 0)::int AS open_requests
         FROM inventory_items i
         LEFT JOIN store_stock_policies p ON p.store_id = $1
        WHERE i.id = $2`,
      [storeId, itemId],
    )) as Array<Record<string, unknown>>;
    if (!row) throw new NotFoundException('Inventory item not found');
    const itemActive = row.status === 'active';
    const bufferQty = Number(row.buffer_qty);
    const maxQty = row.max_qty == null ? null : Number(row.max_qty);
    const onHandAvailable = Number(row.on_hand_available);
    const sourceable =
      row.include_sourceable && row.sourcing_mode !== 'stocked'
        ? Math.max(0, Math.min(Number(row.supplier_available) - Number(row.open_requests), Number(row.max_sourceable_qty)))
        : 0;
    let desired = itemActive ? Math.max(0, onHandAvailable - bufferQty) + sourceable : 0;
    if (maxQty != null) desired = Math.min(desired, maxQty);
    return { desired, onHandAvailable, sourceable, bufferQty, maxQty, pushEnabled: !!row.push_enabled, itemActive };
  }

  async findTargets(storeId: string, itemId: string): Promise<ChannelTarget[]> {
    const [store] = (await this.db.query(`SELECT channel FROM stores WHERE id = $1`, [storeId])) as Array<{ channel: string }>;
    if (!store) return [];
    if (store.channel === PARTSBAZAR360_CHANNEL) {
      const rows = (await this.db.query(
        `SELECT c.connection_id, c.listing_id, c.override_quantity
           FROM listing_channel_instances c JOIN inventory_items i ON i.id = $2
          WHERE c.store_id = $1 AND c.channel = $3
            AND c.listing_id IN (i.listing_record_id, i.catalog_product_id)
            AND c.sync_status NOT IN ('ended')`,
        [storeId, itemId, PARTSBAZAR360_CHANNEL],
      )) as Array<{ connection_id: string; listing_id: string; override_quantity: number | null }>;
      return rows.map((r) => ({ kind: 'pb360', connectionId: r.connection_id, listingId: r.listing_id, channelQty: r.override_quantity }));
    }
    const rows = (await this.db.query(
      `SELECT p.id, p.offer_id, p.ebay_item_id, p.sku, p.marketplace_id, p.quantity_available
         FROM ebay_published_listings p JOIN inventory_items i ON i.id = $2
        WHERE p.store_id = $1 AND p.listing_status IN ('active','out_of_stock')
          AND (p.sku = i.sku OR (i.catalog_product_id IS NOT NULL AND p.catalog_product_id = i.catalog_product_id))`,
      [storeId, itemId],
    )) as Array<{ id: string; offer_id: string | null; ebay_item_id: string | null; sku: string | null; marketplace_id: string; quantity_available: number }>;
    return rows.flatMap<ChannelTarget>((r) =>
      r.offer_id
        ? [{ kind: 'ebay_offer', offerId: r.offer_id, sku: r.sku, publishedListingId: r.id, channelQty: r.quantity_available }]
        : r.ebay_item_id
          ? [{ kind: 'ebay_item', itemId: r.ebay_item_id, marketplaceId: r.marketplace_id, publishedListingId: r.id, channelQty: r.quantity_available }]
          : [],
    );
  }

  /** Claims dirty rows (SKIP LOCKED so parallel workers never double-push) and processes them. */
  async sweep(organizationId?: string, limit = 200): Promise<{ processed: number; pushed: number; failed: number }> {
    const pushGlobal = await this.flags.isEnabled(STOCK_CHANNEL_PUSH_FLAG).catch(() => false);
    const rows = (await this.db.transaction(async (em) => {
      const claimed = (await em.query(
        `SELECT store_id, inventory_item_id, organization_id, pushed_qty, attempts
           FROM channel_stock_sync_state
          WHERE dirty ${organizationId ? 'AND organization_id = $2' : ''}
            -- failed rows back off 2, 4, 6, 8 minutes between attempts
            AND (status <> 'failed' OR updated_at < now() - attempts * interval '2 minutes')
          ORDER BY updated_at
          LIMIT $1 FOR UPDATE SKIP LOCKED`,
        organizationId ? [limit, organizationId] : [limit],
      )) as SyncRow[];
      for (const r of claimed)
        await em.query(`UPDATE channel_stock_sync_state SET dirty = false WHERE store_id = $1 AND inventory_item_id = $2`, [r.store_id, r.inventory_item_id]);
      return claimed;
    })) as SyncRow[];

    let pushed = 0;
    let failed = 0;
    for (const r of rows) {
      const outcome = await this.processRow(r, pushGlobal);
      if (outcome === 'synced') pushed++;
      if (outcome === 'failed') failed++;
    }
    if (rows.length) this.logger.log(`Channel stock sweep: ${rows.length} rows, ${pushed} pushed, ${failed} failed`);
    return { processed: rows.length, pushed, failed };
  }

  private async processRow(r: SyncRow, pushGlobal: boolean): Promise<ChannelSyncStatus> {
    let status: ChannelSyncStatus = 'pending';
    let error: string | null = null;
    let desired: number | null = null;
    let channelQty: number | null = null;
    let targets: ChannelTarget[] = [];
    try {
      const d = await this.computeDesired(r.store_id, r.inventory_item_id);
      desired = d.desired;
      targets = await this.findTargets(r.store_id, r.inventory_item_id);
      channelQty = targets.length ? targets.map((t) => t.channelQty ?? 0).reduce((a, b) => Math.min(a, b)) : null;
      if (!targets.length) status = 'no_target';
      else if (!pushGlobal || !d.pushEnabled) status = 'shadow';
      else if (targets.every((t) => t.channelQty === desired) && r.pushed_qty === desired) status = 'synced';
      else {
        await this.push(r.store_id, targets, desired);
        status = 'synced';
        channelQty = desired;
      }
    } catch (err) {
      status = 'failed';
      error = (err as Error).message?.slice(0, 2000) ?? String(err);
      this.logger.warn(`Stock push failed store=${r.store_id} item=${r.inventory_item_id}: ${error}`);
    }
    const retry = status === 'failed' && r.attempts + 1 < 5;
    await this.db.query(
      `UPDATE channel_stock_sync_state
          SET status = $3::varchar, desired_qty = $4::int, channel_qty = $5::int, last_error = $6::text, targets = $7::jsonb,
              attempts = CASE WHEN $3::varchar = 'failed' THEN attempts + 1 ELSE 0 END,
              pushed_qty = CASE WHEN $3::varchar = 'synced' THEN $4::int ELSE pushed_qty END,
              last_pushed_at = CASE WHEN $3::varchar = 'synced' AND $8::boolean THEN now() ELSE last_pushed_at END,
              dirty = dirty OR $9::boolean, updated_at = now()
        WHERE store_id = $1 AND inventory_item_id = $2`,
      [r.store_id, r.inventory_item_id, status, desired, channelQty, error, JSON.stringify(targets), status === 'synced', retry],
    );
    return status;
  }

  private async push(storeId: string, targets: ChannelTarget[], qty: number) {
    const offers = targets.filter((t): t is Extract<ChannelTarget, { kind: 'ebay_offer' }> => t.kind === 'ebay_offer');
    for (let i = 0; i < offers.length; i += 25) {
      const chunk = offers.slice(i, i + 25);
      const res = await this.ebayInventory.bulkUpdatePriceQuantity(storeId, [
        { offers: chunk.map((o) => ({ offerId: o.offerId, availableQuantity: qty })) },
      ]);
      const failures = (res?.responses ?? []).filter((x) => x.statusCode >= 400);
      if (failures.length)
        throw new Error(failures.map((f) => f.errors?.map((e) => e.message).join('; ') || `HTTP ${f.statusCode}`).join(' | '));
    }
    for (const t of targets) {
      if (t.kind === 'ebay_item') await this.reviseTradingQuantity(storeId, t.itemId, qty, t.marketplaceId);
      if (t.kind === 'pb360') {
        const pb360 = this.partsBazar();
        if (qty > 0) await pb360.publish(t.connectionId, t.listingId, { quantity: qty });
        else await pb360.end(t.listingId);
      }
    }
    const published = targets.filter((t) => t.kind !== 'pb360').map((t) => (t as { publishedListingId: string }).publishedListingId);
    if (published.length)
      await this.db.query(`UPDATE ebay_published_listings SET quantity_available = $2, updated_at = now() WHERE id = ANY($1::uuid[])`, [published, qty]);
  }

  /**
   * PartsBazar360 is an optional integration: it is resolved lazily (same module instance
   * Nest registered) so StockModule also builds and runs in deployments without it.
   */
  private partsBazar(): PartsBazarQuantityPush {
    const specifier = '../channels/partsbazar360/partsbazar360.service.js';
    let cls: Type<unknown> | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cls = (require(specifier) as { PartsBazar360Service?: Type<unknown> }).PartsBazar360Service;
    } catch {
      cls = undefined;
    }
    if (!cls) throw new Error('The PartsBazar360 integration is not available in this build');
    return this.moduleRef.get(cls, { strict: false }) as PartsBazarQuantityPush;
  }

  /**
   * Trading-API (item-ID tracked) listings are revised with ReviseFixedPriceItem. That method
   * ships with the Trading revise support in EbayTradingApiService; builds without it fail
   * the push with a clear error instead of failing to compile.
   */
  private async reviseTradingQuantity(storeId: string, itemId: string, qty: number, marketplaceId: string) {
    const trading = this.ebayTrading as unknown as {
      reviseFixedPriceItem?: (storeId: string, itemId: string, input: { quantity: number }, marketplaceId?: string | null) => Promise<void>;
    };
    if (typeof trading.reviseFixedPriceItem !== 'function')
      throw new Error('This build cannot revise Trading-API listing quantities (ReviseFixedPriceItem is unavailable)');
    await trading.reviseFixedPriceItem(storeId, itemId, { quantity: qty }, marketplaceId);
  }

  /** Compares the last eBay snapshot with desired quantity and re-queues mismatches. */
  async driftCheck(organizationId?: string) {
    const params: unknown[] = [];
    const orgFilter = organizationId ? (params.push(organizationId), `AND c.organization_id = $1`) : '';
    const res = (await this.db.query(
      `WITH snap AS (
         SELECT c.store_id, c.inventory_item_id, MIN(p.quantity_available) AS qty
           FROM channel_stock_sync_state c
           JOIN inventory_items i ON i.id = c.inventory_item_id
           JOIN ebay_published_listings p ON p.store_id = c.store_id AND p.listing_status IN ('active','out_of_stock')
                AND (p.sku = i.sku OR (i.catalog_product_id IS NOT NULL AND p.catalog_product_id = i.catalog_product_id))
          WHERE TRUE ${orgFilter}
          GROUP BY c.store_id, c.inventory_item_id
       )
       UPDATE channel_stock_sync_state c
          SET channel_qty = snap.qty,
              dirty = c.dirty OR (c.desired_qty IS DISTINCT FROM snap.qty),
              updated_at = now()
         FROM snap
        WHERE c.store_id = snap.store_id AND c.inventory_item_id = snap.inventory_item_id
        RETURNING (c.desired_qty IS DISTINCT FROM snap.qty) AS drift`,
      params,
    )) as [Array<{ drift: boolean }>, number] | Array<{ drift: boolean }>;
    const rows = (Array.isArray(res[0]) ? res[0] : res) as Array<{ drift: boolean }>;
    return { checked: rows.length, drift: rows.filter((r) => r.drift).length };
  }

  /* ── API helpers ────────────────────────────────────────────────── */

  async list(scope: StockScope, q: { storeId?: string; status?: string; driftOnly?: boolean; limit?: number; offset?: number }) {
    const params: unknown[] = [scope.organizationId];
    const where = ['c.organization_id = $1'];
    if (q.storeId) { params.push(q.storeId); where.push(`c.store_id = $${params.length}`); }
    if (q.status) { params.push(q.status.split(',')); where.push(`c.status = ANY($${params.length})`); }
    if (q.driftOnly) where.push(`c.channel_qty IS DISTINCT FROM c.desired_qty AND c.status <> 'no_target'`);
    const limit = Math.min(q.limit ?? 100, 500);
    const offset = q.offset ?? 0;
    const rows = await this.db.query(
      `SELECT c.store_id AS "storeId", s.store_name AS "storeName", s.channel, c.inventory_item_id AS "itemId",
              i.sku, i.title, i.sourcing_mode AS "sourcingMode", c.status, c.dirty, c.desired_qty AS "desiredQty",
              c.pushed_qty AS "pushedQty", c.channel_qty AS "channelQty", c.attempts, c.last_error AS "lastError",
              c.last_pushed_at AS "lastPushedAt", c.updated_at AS "updatedAt",
              jsonb_array_length(c.targets) AS "targetCount", count(*) OVER()::int AS "totalCount"
         FROM channel_stock_sync_state c
         JOIN stores s ON s.id = c.store_id
         JOIN inventory_items i ON i.id = c.inventory_item_id
        WHERE ${where.join(' AND ')}
        ORDER BY (c.status = 'failed') DESC, (c.channel_qty IS DISTINCT FROM c.desired_qty) DESC, c.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    return { total: rows[0]?.totalCount ?? 0, items: rows };
  }

  async summary(scope: StockScope) {
    const [row] = (await this.db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'synced')::int synced,
              COUNT(*) FILTER (WHERE status = 'shadow')::int shadow,
              COUNT(*) FILTER (WHERE status = 'failed')::int failed,
              COUNT(*) FILTER (WHERE status = 'no_target')::int "noTarget",
              COUNT(*) FILTER (WHERE dirty)::int pending,
              COUNT(*) FILTER (WHERE status <> 'no_target' AND channel_qty IS DISTINCT FROM desired_qty)::int drift
         FROM channel_stock_sync_state WHERE organization_id = $1`,
      [scope.organizationId],
    )) as Array<Record<string, number>>;
    const pushGlobal = await this.flags.isEnabled(STOCK_CHANNEL_PUSH_FLAG).catch(() => false);
    return { ...row, pushGloballyEnabled: pushGlobal };
  }

  /** Marks every item for a store (or the whole org) dirty and runs a sweep now. */
  async resync(scope: StockScope, storeId?: string) {
    const params: unknown[] = [scope.organizationId];
    let storeFilter = '';
    if (storeId) { params.push(storeId); storeFilter = `AND s.id = $2`; }
    await this.db.query(
      `INSERT INTO channel_stock_sync_state (store_id, inventory_item_id, organization_id, dirty, status, updated_at)
       SELECT s.id, i.id, $1::uuid, true, 'pending', now()
         FROM stores s
         JOIN inventory_items i ON i.organization_id = $1 AND i.status = 'active'
        WHERE s.organization_id = $1 ${storeFilter}
          AND EXISTS (SELECT 1 FROM store_warehouse_links l WHERE l.store_id = s.id AND l.active)
          AND (EXISTS (SELECT 1 FROM stock_levels sl WHERE sl.inventory_item_id = i.id)
               OR EXISTS (SELECT 1 FROM inventory_item_sources x WHERE x.inventory_item_id = i.id AND x.active))
       ON CONFLICT (store_id, inventory_item_id) DO UPDATE SET dirty = true, updated_at = now()`,
      params,
    );
    return this.sweep(scope.organizationId, 1000);
  }
}
