import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EbayTradingApiService } from '../channels/ebay/ebay-trading-api.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  CROSS_STORE_SALE_SYNC_FLAG,
  CROSS_STORE_SALE_SYNC_QUEUE,
  MAX_TARGETS_PER_SKU,
  isListingNotFoundError,
  isLiveTradingStatus,
  isSamePart,
  samePartVerdict,
  normalizeSku,
  planTarget,
  rejectSku,
  tradingAvailable,
  type TargetPlan,
} from './cross-store-sale-sync.util.js';

/** Same key as the StockModule's flag; kept local so OrdersModule does not import StockModule. */
const STOCK_CHANNEL_PUSH_FLAG = 'stock_channel_push';
const LINE_TARGET_KEY = 'line';

export type CrossStoreSyncStatus = 'done' | 'skipped' | 'failed' | 'planned';

export interface CrossStoreSyncResult {
  orderId: string;
  orderItemId: string;
  sku: string | null;
  soldItemId: string | null;
  soldQty: number;
  targetListingId: string | null;
  targetStoreId: string | null;
  targetStoreName: string | null;
  targetItemId: string | null;
  action: 'end' | 'set_quantity' | 'none';
  status: CrossStoreSyncStatus;
  reason: string | null;
  quantityBefore: number | null;
  quantityAfter: number | null;
  error: string | null;
}

type OrderRow = {
  id: string;
  channel: string;
  status: string;
  store_id: string | null;
  external_order_id: string | null;
};
type LineRow = {
  id: string;
  sku: string | null;
  external_listing_id: string | null;
  title: string | null;
  quantity: number;
};
type TargetRow = {
  id: string;
  store_id: string;
  store_name: string;
  ebay_account_id: string;
  marketplace_id: string;
  ebay_item_id: string | null;
  offer_id: string | null;
  title: string | null;
  account_status: string | null;
};

/**
 * Cross-store sale sync. A sale imported from any eBay store (order.new)
 * removes the sold quantity from every other live eBay listing with the same
 * SKU, in every connected store: listings left with nothing are ended, others
 * are lowered. Quantities are read live from eBay before acting, and each
 * (order line, listing) pair is recorded in ebay_cross_store_sale_syncs so a
 * retried or repeated run never takes the same sale off a listing twice.
 *
 * Off switch: feature flag `ebay_cross_store_sale_sync`. Stores whose stock is
 * pushed by the StockModule (`stock_channel_push` + store policy push_enabled)
 * are left to that module.
 */
@Injectable()
export class CrossStoreSaleSyncService {
  private readonly logger = new Logger(CrossStoreSaleSyncService.name);

  constructor(
    private readonly db: DataSource,
    private readonly flags: FeatureFlagService,
    private readonly trading: EbayTradingApiService,
    private readonly inventory: EbayInventoryApiService,
    private readonly notifications: NotificationsService,
    @InjectQueue(CROSS_STORE_SALE_SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  async enabled(): Promise<boolean> {
    return this.flags.isEnabled(CROSS_STORE_SALE_SYNC_FLAG).catch(() => false);
  }

  @OnEvent('order.new')
  async onOrderNew(payload: {
    orderId: string;
    channel: string;
  }): Promise<void> {
    if (payload.channel !== 'ebay') return;
    try {
      if (!(await this.enabled())) return;
      await this.enqueue(payload.orderId);
    } catch (err) {
      this.logger.error(
        `Could not queue cross-store sale sync for order ${payload.orderId}: ${(err as Error).message}`,
      );
    }
  }

  async enqueue(orderId: string, delayMs = 5_000): Promise<void> {
    await this.queue.add(
      'sync-order',
      { orderId },
      {
        jobId: `cross-store-${orderId}`,
        delay: delayMs,
        attempts: 4,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
  }

  /** eBay orders imported since `since` (newest last), for a backfill run. */
  async ordersSince(since: Date, limit = 500): Promise<string[]> {
    const rows = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM orders
        WHERE channel = 'ebay' AND ordered_at >= $1 AND status NOT IN ('cancelled','refunded')
        ORDER BY ordered_at LIMIT $2`,
      [since, limit],
    );
    return rows.map((r) => r.id);
  }

  /**
   * Applies (or, with dryRun, only plans) the sale of every line of one order
   * to the other listings of the same SKU. Throws when an eBay call failed so
   * the queue retries; finished pairs are not repeated on retry.
   */
  async syncOrder(
    orderId: string,
    opts: { dryRun?: boolean } = {},
  ): Promise<CrossStoreSyncResult[]> {
    const dryRun = !!opts.dryRun;
    const [order] = await this.db.query<OrderRow[]>(
      `SELECT id, channel, status, store_id, external_order_id FROM orders WHERE id = $1`,
      [orderId],
    );
    if (!order || order.channel !== 'ebay') return [];
    if (['cancelled', 'refunded'].includes(order.status)) return [];

    const lines = await this.db.query<LineRow[]>(
      `SELECT id, sku, external_listing_id, title, quantity FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [orderId],
    );

    const stockPushOn = await this.flags
      .isEnabled(STOCK_CHANNEL_PUSH_FLAG)
      .catch(() => false);
    const results: CrossStoreSyncResult[] = [];
    for (const line of lines) {
      results.push(
        ...(await this.syncLine(order, line, { dryRun, stockPushOn })),
      );
    }

    const failed = results.filter((r) => r.status === 'failed');
    if (!dryRun) {
      const ended = results.filter(
        (r) => r.status === 'done' && r.action === 'end',
      ).length;
      const lowered = results.filter(
        (r) => r.status === 'done' && r.action === 'set_quantity',
      ).length;
      const disconnected = results.filter(
        (r) => r.reason === 'account_not_connected',
      );
      if (ended || lowered || failed.length || disconnected.length) {
        this.logger.log(
          `Cross-store sale sync order ${order.external_order_id ?? orderId}: ${ended} ended, ${lowered} lowered, ${failed.length} failed, ${disconnected.length} on disconnected accounts`,
        );
      }
      if (disconnected.length) {
        const list = disconnected
          .map(
            (r) => `${r.targetStoreName ?? '?'} item ${r.targetItemId ?? '?'}`,
          )
          .join('; ');
        await this.notifications
          .create({
            type: 'cross_store_sale_sync_disconnected',
            title: 'Sold part may still be listed on a disconnected store',
            body: `SKU ${disconnected[0].sku} sold (order ${order.external_order_id ?? orderId}). These stores' eBay accounts are disconnected, so Omni could not end the listing — reconnect them or end it by hand: ${list}`.slice(
              0,
              2000,
            ),
            severity: 'warning',
            entityType: 'order',
            entityId: orderId,
            actionUrl: '/settings/integrations/ebay',
          })
          .catch((err: Error) =>
            this.logger.warn(`Notification failed: ${err.message}`),
          );
      }
      if (failed.length) {
        throw new Error(
          `Cross-store sale sync failed for ${failed.length} listing(s): ${failed
            .map(
              (f) =>
                `${f.targetStoreName ?? f.targetStoreId}/${f.targetItemId}: ${f.error}`,
            )
            .join(' | ')
            .slice(0, 1500)}`,
        );
      }
    }
    return results;
  }

  /** Last attempt failed: tell a human which listings are still live. */
  async notifyGaveUp(orderId: string, error: string): Promise<void> {
    const rows = await this.db.query<
      Array<{
        sku: string | null;
        target_item_id: string | null;
        store_name: string | null;
        error: string | null;
      }>
    >(
      `SELECT x.sku, x.target_item_id, s.store_name, x.error
         FROM ebay_cross_store_sale_syncs x LEFT JOIN stores s ON s.id = x.target_store_id
        WHERE x.order_id = $1 AND x.status = 'failed'`,
      [orderId],
    );
    const list = rows.length
      ? rows
          .map(
            (r) =>
              `${r.store_name ?? '?'} item ${r.target_item_id ?? '?'} (SKU ${r.sku ?? '?'})`,
          )
          .join('; ')
      : error;
    await this.notifications
      .create({
        type: 'cross_store_sale_sync_failed',
        title: 'Sold part is still listed on another store',
        body: `Could not end or lower these listings after a sale — end them by hand: ${list}`.slice(
          0,
          2000,
        ),
        severity: 'error',
        entityType: 'order',
        entityId: orderId,
        actionUrl: '/orders',
      })
      .catch((err: Error) =>
        this.logger.warn(`Notification failed: ${err.message}`),
      );
  }

  async listRecent(limit = 200, status?: string): Promise<unknown[]> {
    const params: unknown[] = [Math.min(Math.max(limit, 1), 1000)];
    const where = status ? (params.push(status), `WHERE x.status = $2`) : '';
    return this.db.query(
      `SELECT x.id, x.order_id AS "orderId", o.external_order_id AS "externalOrderId", x.order_item_id AS "orderItemId",
              x.sku, x.sold_item_id AS "soldItemId", x.sold_qty AS "soldQty", so.store_name AS "soldStoreName",
              x.target_published_listing_id AS "targetListingId", x.target_item_id AS "targetItemId",
              ts.store_name AS "targetStoreName", x.action, x.status, x.reason,
              x.quantity_before AS "quantityBefore", x.quantity_after AS "quantityAfter", x.error,
              x.attempts, x.created_at AS "createdAt", x.updated_at AS "updatedAt"
         FROM ebay_cross_store_sale_syncs x
         JOIN orders o ON o.id = x.order_id
         LEFT JOIN stores so ON so.id = o.store_id
         LEFT JOIN stores ts ON ts.id = x.target_store_id
         ${where}
        ORDER BY x.updated_at DESC LIMIT $1`,
      params,
    );
  }

  /* ── internals ──────────────────────────────────────────────────── */

  private async syncLine(
    order: OrderRow,
    line: LineRow,
    ctx: { dryRun: boolean; stockPushOn: boolean },
  ): Promise<CrossStoreSyncResult[]> {
    const soldItemId = line.external_listing_id?.trim() || null;
    const soldQty = Math.max(1, line.quantity || 1);
    let sku = normalizeSku(line.sku);
    if (!sku && soldItemId) {
      const [sold] = await this.db.query<Array<{ sku: string | null }>>(
        `SELECT sku FROM ebay_published_listings WHERE ebay_item_id = $1 AND sku IS NOT NULL ORDER BY updated_at DESC LIMIT 1`,
        [soldItemId],
      );
      sku = normalizeSku(sold?.sku);
    }
    const base = {
      orderId: order.id,
      orderItemId: line.id,
      sku,
      soldItemId,
      soldQty,
    };
    const lineOutcome = (reason: string): CrossStoreSyncResult => ({
      ...base,
      targetListingId: null,
      targetStoreId: null,
      targetStoreName: null,
      targetItemId: null,
      action: 'none',
      status: 'skipped',
      reason,
      quantityBefore: null,
      quantityAfter: null,
      error: null,
    });

    const rejected = rejectSku(sku);
    if (rejected) {
      const r = lineOutcome(rejected);
      if (!ctx.dryRun) await this.record(r, LINE_TARGET_KEY);
      return [r];
    }

    // Other live copies of this SKU in every non-archived eBay store, one row
    // per eBay listing (the mirror can hold one item under two marketplaces);
    // the listing that just sold is excluded (eBay already lowered it).
    const targets = await this.db.query<TargetRow[]>(
      `SELECT DISTINCT ON (COALESCE(p.ebay_item_id, 'offer:' || p.offer_id))
              p.id, p.store_id, s.store_name, p.ebay_account_id, p.marketplace_id, p.ebay_item_id, p.offer_id,
              p.title, a.connection_status AS account_status
         FROM ebay_published_listings p
         JOIN stores s ON s.id = p.store_id AND s.channel = 'ebay' AND s.status <> 'archived'
         LEFT JOIN connected_ebay_accounts a ON a.id = p.ebay_account_id
        WHERE p.sku = $1
          AND p.listing_status IN ('active','out_of_stock')
          AND p.is_test_listing = false
          AND (p.ebay_item_id IS NOT NULL OR p.offer_id IS NOT NULL)
          AND p.ebay_item_id IS DISTINCT FROM $2
        ORDER BY COALESCE(p.ebay_item_id, 'offer:' || p.offer_id), p.updated_at DESC
        LIMIT ${MAX_TARGETS_PER_SKU + 1}`,
      [sku, soldItemId],
    );

    if (!targets.length) return [lineOutcome('no_other_listings')];
    if (targets.length > MAX_TARGETS_PER_SKU) {
      const r = lineOutcome('sku_too_common');
      if (!ctx.dryRun) {
        await this.record(r, LINE_TARGET_KEY);
        await this.notifications
          .create({
            type: 'cross_store_sale_sync_skipped',
            title: 'Sold SKU is on too many listings to sync',
            body: `SKU ${sku} sold (order ${order.external_order_id ?? order.id}) but matches more than ${MAX_TARGETS_PER_SKU} live listings, so none were ended. Check them by hand.`,
            severity: 'warning',
            entityType: 'order',
            entityId: order.id,
            actionUrl: '/orders',
          })
          .catch(() => undefined);
      }
      return [r];
    }

    const done = new Set(
      (
        await this.db.query<Array<{ target_key: string }>>(
          `SELECT target_key FROM ebay_cross_store_sale_syncs
            WHERE order_item_id = $1 AND status IN ('done','skipped') AND reason IS DISTINCT FROM 'account_not_connected'`,
          [line.id],
        )
      ).map((r) => r.target_key),
    );
    const pushManaged = ctx.stockPushOn
      ? await this.pushManagedStores(targets.map((t) => t.store_id))
      : new Set<string>();

    const results: CrossStoreSyncResult[] = [];
    for (const t of targets) {
      if (done.has(t.id)) continue;
      const r = await this.syncTarget(base, t, {
        ...ctx,
        pushManaged,
        soldTitle: line.title,
      });
      if (!ctx.dryRun) await this.record(r, t.id);
      results.push(r);
    }
    return results;
  }

  private async pushManagedStores(storeIds: string[]): Promise<Set<string>> {
    const rows = await this.db.query<Array<{ store_id: string }>>(
      `SELECT store_id FROM store_stock_policies WHERE push_enabled AND store_id = ANY($1::uuid[])`,
      [[...new Set(storeIds)]],
    );
    return new Set(rows.map((r) => r.store_id));
  }

  private async syncTarget(
    base: Pick<
      CrossStoreSyncResult,
      'orderId' | 'orderItemId' | 'sku' | 'soldItemId' | 'soldQty'
    >,
    t: TargetRow,
    ctx: {
      dryRun: boolean;
      pushManaged: Set<string>;
      soldTitle: string | null;
    },
  ): Promise<CrossStoreSyncResult> {
    const result: CrossStoreSyncResult = {
      ...base,
      targetListingId: t.id,
      targetStoreId: t.store_id,
      targetStoreName: t.store_name,
      targetItemId: t.ebay_item_id,
      action: 'none',
      status: 'skipped',
      reason: null,
      quantityBefore: null,
      quantityAfter: null,
      error: null,
    };
    // Same SKU is not proof of the same item: some labels are reused for
    // different parts. Never touch a listing whose title says otherwise.
    const verdict = samePartVerdict(ctx.soldTitle, t.title);
    if (!isSamePart(verdict)) return { ...result, reason: verdict };
    if (ctx.pushManaged.has(t.store_id))
      return { ...result, reason: 'stock_sync_managed' };
    if (t.account_status && t.account_status !== 'active') {
      // Its token cannot act on eBay; a human must end it (or reconnect and re-run).
      return {
        ...result,
        reason: 'account_not_connected',
        error: `eBay account is ${t.account_status}`,
      };
    }

    try {
      const live = await this.readLive(t);
      if (!live.active) {
        if (!ctx.dryRun) await this.markMirror(t, { status: 'ended', qty: 0 });
        return {
          ...result,
          reason: 'already_ended',
          quantityBefore: live.available,
        };
      }
      const plan: TargetPlan = planTarget(live.available, base.soldQty);
      result.quantityBefore = plan.available;
      if (plan.action === 'none')
        return {
          ...result,
          reason: plan.reason,
          quantityAfter: plan.available,
        };
      result.action = plan.action;
      result.quantityAfter = plan.remaining;
      if (ctx.dryRun) return { ...result, status: 'planned' };

      if (plan.action === 'end') {
        await this.endListing(t);
        await this.markMirror(t, { status: 'ended', qty: 0 });
      } else {
        await this.setQuantity(t, plan.remaining, live.quantitySold);
        await this.markMirror(t, { status: 'active', qty: plan.remaining });
      }
      return { ...result, status: 'done' };
    } catch (err) {
      const message = ((err as Error).message ?? String(err)).slice(0, 1000);
      if (isListingNotFoundError(message)) {
        return { ...result, reason: 'listing_not_found', error: message };
      }
      return { ...result, status: 'failed', error: message };
    }
  }

  /** Live state of a listing: GetItem by item number, else the Inventory API offer. */
  private async readLive(
    t: TargetRow,
  ): Promise<{ active: boolean; available: number; quantitySold: number }> {
    if (t.ebay_item_id) {
      const d = await this.trading.getItemDetails(
        t.store_id,
        t.ebay_item_id,
        t.marketplace_id,
      );
      return {
        active: isLiveTradingStatus(d.listingStatus),
        available: tradingAvailable(d.quantity, d.quantitySold),
        quantitySold: d.quantitySold ?? 0,
      };
    }
    const offer = await this.inventory.getOffer(
      t.store_id,
      t.offer_id as string,
    );
    const status = (offer.status ?? '').toUpperCase();
    return {
      active: status === 'PUBLISHED',
      available: offer.availableQuantity ?? 0,
      quantitySold: 0,
    };
  }

  private async endListing(t: TargetRow): Promise<void> {
    if (t.offer_id) {
      try {
        await this.inventory.withdrawOffer(t.store_id, t.offer_id);
        return;
      } catch (err) {
        if (!t.ebay_item_id) throw err;
        this.logger.warn(
          `withdrawOffer ${t.offer_id} failed (${(err as Error).message}); ending item ${t.ebay_item_id} instead`,
        );
      }
    }
    await this.trading.endFixedPriceItem(
      t.store_id,
      t.ebay_item_id as string,
      t.marketplace_id,
    );
  }

  /**
   * Lowers a listing to `remaining` available. Trading revise takes the
   * listing's total quantity (sold + available), so the result is read back
   * and corrected if eBay applied the number as the available quantity.
   */
  private async setQuantity(
    t: TargetRow,
    remaining: number,
    quantitySold: number,
  ): Promise<void> {
    if (t.offer_id) {
      try {
        const res = await this.inventory.bulkUpdatePriceQuantity(t.store_id, [
          { offers: [{ offerId: t.offer_id, availableQuantity: remaining }] },
        ]);
        const bad = (res?.responses ?? []).filter((x) => x.statusCode >= 400);
        if (!bad.length) return;
        if (!t.ebay_item_id)
          throw new Error(
            bad
              .map(
                (b) =>
                  b.errors?.map((e) => e.message).join('; ') ||
                  `HTTP ${b.statusCode}`,
              )
              .join(' | '),
          );
      } catch (err) {
        if (!t.ebay_item_id) throw err;
        this.logger.warn(
          `Offer quantity update ${t.offer_id} failed (${(err as Error).message}); revising item ${t.ebay_item_id} instead`,
        );
      }
    }
    const itemId = t.ebay_item_id as string;
    await this.trading.reviseFixedPriceItem(
      t.store_id,
      itemId,
      { quantity: quantitySold + remaining },
      t.marketplace_id,
    );
    const after = await this.trading.getItemDetails(
      t.store_id,
      itemId,
      t.marketplace_id,
    );
    const available = tradingAvailable(after.quantity, after.quantitySold);
    if (available !== remaining) {
      // eBay took the number as the available quantity: send just that.
      await this.trading.reviseFixedPriceItem(
        t.store_id,
        itemId,
        { quantity: remaining },
        t.marketplace_id,
      );
      const check = await this.trading.getItemDetails(
        t.store_id,
        itemId,
        t.marketplace_id,
      );
      const finalAvailable = tradingAvailable(
        check.quantity,
        check.quantitySold,
      );
      if (finalAvailable !== remaining) {
        throw new Error(
          `eBay reports ${finalAvailable} available after revising item ${itemId} to ${remaining}`,
        );
      }
    }
  }

  /** Updates the mirror row and any other row of the same eBay item. */
  private async markMirror(
    t: Pick<TargetRow, 'id' | 'ebay_item_id'>,
    s: { status: 'ended' | 'active'; qty: number },
  ): Promise<void> {
    await this.db.query(
      `UPDATE ebay_published_listings
          SET listing_status = $2, quantity_available = $3, last_synced_at = now(), updated_at = now()
        WHERE id = $1 OR ($4::varchar IS NOT NULL AND ebay_item_id = $4)`,
      [t.id, s.status, s.qty, t.ebay_item_id],
    );
  }

  private async record(
    r: CrossStoreSyncResult,
    targetKey: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO ebay_cross_store_sale_syncs
         (order_id, order_item_id, target_key, target_published_listing_id, target_store_id, target_item_id,
          sku, sold_item_id, sold_qty, action, status, reason, quantity_before, quantity_after, error, attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,1)
       ON CONFLICT (order_item_id, target_key) DO UPDATE SET
         action = EXCLUDED.action, status = EXCLUDED.status, reason = EXCLUDED.reason,
         quantity_before = EXCLUDED.quantity_before, quantity_after = EXCLUDED.quantity_after,
         error = EXCLUDED.error, attempts = ebay_cross_store_sale_syncs.attempts + 1, updated_at = now()`,
      [
        r.orderId,
        r.orderItemId,
        targetKey,
        r.targetListingId,
        r.targetStoreId,
        r.targetItemId,
        r.sku,
        r.soldItemId,
        r.soldQty,
        r.action,
        r.status,
        r.reason,
        r.quantityBefore,
        r.quantityAfter,
        r.error,
      ],
    );
  }
}
