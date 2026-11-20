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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CrossStoreSaleSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossStoreSaleSyncService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("typeorm");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
const ebay_trading_api_service_js_1 = require("../channels/ebay/ebay-trading-api.service.js");
const ebay_inventory_api_service_js_1 = require("../channels/ebay/ebay-inventory-api.service.js");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
const cross_store_sale_sync_util_js_1 = require("./cross-store-sale-sync.util.js");
const STOCK_CHANNEL_PUSH_FLAG = 'stock_channel_push';
const LINE_TARGET_KEY = 'line';
let CrossStoreSaleSyncService = CrossStoreSaleSyncService_1 = class CrossStoreSaleSyncService {
    db;
    flags;
    trading;
    inventory;
    notifications;
    queue;
    logger = new common_1.Logger(CrossStoreSaleSyncService_1.name);
    constructor(db, flags, trading, inventory, notifications, queue) {
        this.db = db;
        this.flags = flags;
        this.trading = trading;
        this.inventory = inventory;
        this.notifications = notifications;
        this.queue = queue;
    }
    async enabled() {
        return this.flags.isEnabled(cross_store_sale_sync_util_js_1.CROSS_STORE_SALE_SYNC_FLAG).catch(() => false);
    }
    async onOrderNew(payload) {
        if (payload.channel !== 'ebay')
            return;
        try {
            if (!(await this.enabled()))
                return;
            await this.enqueue(payload.orderId);
        }
        catch (err) {
            this.logger.error(`Could not queue cross-store sale sync for order ${payload.orderId}: ${err.message}`);
        }
    }
    async enqueue(orderId, delayMs = 5_000) {
        await this.queue.add('sync-order', { orderId }, {
            jobId: `cross-store-${orderId}`,
            delay: delayMs,
            attempts: 4,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: 500,
            removeOnFail: 500,
        });
    }
    async ordersSince(since, limit = 500) {
        const rows = await this.db.query(`SELECT id FROM orders
        WHERE channel = 'ebay' AND ordered_at >= $1 AND status NOT IN ('cancelled','refunded')
        ORDER BY ordered_at LIMIT $2`, [since, limit]);
        return rows.map((r) => r.id);
    }
    async syncOrder(orderId, opts = {}) {
        const dryRun = !!opts.dryRun;
        const [order] = await this.db.query(`SELECT id, channel, status, store_id, external_order_id FROM orders WHERE id = $1`, [orderId]);
        if (!order || order.channel !== 'ebay')
            return [];
        if (['cancelled', 'refunded'].includes(order.status))
            return [];
        const lines = await this.db.query(`SELECT id, sku, external_listing_id, title, quantity FROM order_items WHERE order_id = $1 ORDER BY created_at`, [orderId]);
        const stockPushOn = await this.flags
            .isEnabled(STOCK_CHANNEL_PUSH_FLAG)
            .catch(() => false);
        const results = [];
        for (const line of lines) {
            results.push(...(await this.syncLine(order, line, { dryRun, stockPushOn })));
        }
        const failed = results.filter((r) => r.status === 'failed');
        if (!dryRun) {
            const ended = results.filter((r) => r.status === 'done' && r.action === 'end').length;
            const lowered = results.filter((r) => r.status === 'done' && r.action === 'set_quantity').length;
            const disconnected = results.filter((r) => r.reason === 'account_not_connected');
            if (ended || lowered || failed.length || disconnected.length) {
                this.logger.log(`Cross-store sale sync order ${order.external_order_id ?? orderId}: ${ended} ended, ${lowered} lowered, ${failed.length} failed, ${disconnected.length} on disconnected accounts`);
            }
            if (disconnected.length) {
                const list = disconnected
                    .map((r) => `${r.targetStoreName ?? '?'} item ${r.targetItemId ?? '?'}`)
                    .join('; ');
                await this.notifications
                    .create({
                    type: 'cross_store_sale_sync_disconnected',
                    title: 'Sold part may still be listed on a disconnected store',
                    body: `SKU ${disconnected[0].sku} sold (order ${order.external_order_id ?? orderId}). These stores' eBay accounts are disconnected, so Omni could not end the listing — reconnect them or end it by hand: ${list}`.slice(0, 2000),
                    severity: 'warning',
                    entityType: 'order',
                    entityId: orderId,
                    actionUrl: '/settings/integrations/ebay',
                })
                    .catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
            }
            if (failed.length) {
                throw new Error(`Cross-store sale sync failed for ${failed.length} listing(s): ${failed
                    .map((f) => `${f.targetStoreName ?? f.targetStoreId}/${f.targetItemId}: ${f.error}`)
                    .join(' | ')
                    .slice(0, 1500)}`);
            }
        }
        return results;
    }
    async notifyGaveUp(orderId, error) {
        const rows = await this.db.query(`SELECT x.sku, x.target_item_id, s.store_name, x.error
         FROM ebay_cross_store_sale_syncs x LEFT JOIN stores s ON s.id = x.target_store_id
        WHERE x.order_id = $1 AND x.status = 'failed'`, [orderId]);
        const list = rows.length
            ? rows
                .map((r) => `${r.store_name ?? '?'} item ${r.target_item_id ?? '?'} (SKU ${r.sku ?? '?'})`)
                .join('; ')
            : error;
        await this.notifications
            .create({
            type: 'cross_store_sale_sync_failed',
            title: 'Sold part is still listed on another store',
            body: `Could not end or lower these listings after a sale — end them by hand: ${list}`.slice(0, 2000),
            severity: 'error',
            entityType: 'order',
            entityId: orderId,
            actionUrl: '/orders',
        })
            .catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
    }
    async listRecent(limit = 200, status) {
        const params = [Math.min(Math.max(limit, 1), 1000)];
        const where = status ? (params.push(status), `WHERE x.status = $2`) : '';
        return this.db.query(`SELECT x.id, x.order_id AS "orderId", o.external_order_id AS "externalOrderId", x.order_item_id AS "orderItemId",
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
        ORDER BY x.updated_at DESC LIMIT $1`, params);
    }
    async syncLine(order, line, ctx) {
        const soldItemId = line.external_listing_id?.trim() || null;
        const soldQty = Math.max(1, line.quantity || 1);
        let sku = (0, cross_store_sale_sync_util_js_1.normalizeSku)(line.sku);
        if (!sku && soldItemId) {
            const [sold] = await this.db.query(`SELECT sku FROM ebay_published_listings WHERE ebay_item_id = $1 AND sku IS NOT NULL ORDER BY updated_at DESC LIMIT 1`, [soldItemId]);
            sku = (0, cross_store_sale_sync_util_js_1.normalizeSku)(sold?.sku);
        }
        const base = {
            orderId: order.id,
            orderItemId: line.id,
            sku,
            soldItemId,
            soldQty,
        };
        const lineOutcome = (reason) => ({
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
        const rejected = (0, cross_store_sale_sync_util_js_1.rejectSku)(sku);
        if (rejected) {
            const r = lineOutcome(rejected);
            if (!ctx.dryRun)
                await this.record(r, LINE_TARGET_KEY);
            return [r];
        }
        const targets = await this.db.query(`SELECT DISTINCT ON (COALESCE(p.ebay_item_id, 'offer:' || p.offer_id))
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
        LIMIT ${cross_store_sale_sync_util_js_1.MAX_TARGETS_PER_SKU + 1}`, [sku, soldItemId]);
        if (!targets.length)
            return [lineOutcome('no_other_listings')];
        if (targets.length > cross_store_sale_sync_util_js_1.MAX_TARGETS_PER_SKU) {
            const r = lineOutcome('sku_too_common');
            if (!ctx.dryRun) {
                await this.record(r, LINE_TARGET_KEY);
                await this.notifications
                    .create({
                    type: 'cross_store_sale_sync_skipped',
                    title: 'Sold SKU is on too many listings to sync',
                    body: `SKU ${sku} sold (order ${order.external_order_id ?? order.id}) but matches more than ${cross_store_sale_sync_util_js_1.MAX_TARGETS_PER_SKU} live listings, so none were ended. Check them by hand.`,
                    severity: 'warning',
                    entityType: 'order',
                    entityId: order.id,
                    actionUrl: '/orders',
                })
                    .catch(() => undefined);
            }
            return [r];
        }
        const done = new Set((await this.db.query(`SELECT target_key FROM ebay_cross_store_sale_syncs
            WHERE order_item_id = $1 AND status IN ('done','skipped') AND reason IS DISTINCT FROM 'account_not_connected'`, [line.id])).map((r) => r.target_key));
        const pushManaged = ctx.stockPushOn
            ? await this.pushManagedStores(targets.map((t) => t.store_id))
            : new Set();
        const results = [];
        for (const t of targets) {
            if (done.has(t.id))
                continue;
            const r = await this.syncTarget(base, t, {
                ...ctx,
                pushManaged,
                soldTitle: line.title,
            });
            if (!ctx.dryRun)
                await this.record(r, t.id);
            results.push(r);
        }
        return results;
    }
    async pushManagedStores(storeIds) {
        const rows = await this.db.query(`SELECT store_id FROM store_stock_policies WHERE push_enabled AND store_id = ANY($1::uuid[])`, [[...new Set(storeIds)]]);
        return new Set(rows.map((r) => r.store_id));
    }
    async syncTarget(base, t, ctx) {
        const result = {
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
        const verdict = (0, cross_store_sale_sync_util_js_1.samePartVerdict)(ctx.soldTitle, t.title);
        if (!(0, cross_store_sale_sync_util_js_1.isSamePart)(verdict))
            return { ...result, reason: verdict };
        if (ctx.pushManaged.has(t.store_id))
            return { ...result, reason: 'stock_sync_managed' };
        if (t.account_status && t.account_status !== 'active') {
            return {
                ...result,
                reason: 'account_not_connected',
                error: `eBay account is ${t.account_status}`,
            };
        }
        try {
            const live = await this.readLive(t);
            if (!live.active) {
                if (!ctx.dryRun)
                    await this.markMirror(t, { status: 'ended', qty: 0 });
                return {
                    ...result,
                    reason: 'already_ended',
                    quantityBefore: live.available,
                };
            }
            const plan = (0, cross_store_sale_sync_util_js_1.planTarget)(live.available, base.soldQty);
            result.quantityBefore = plan.available;
            if (plan.action === 'none')
                return {
                    ...result,
                    reason: plan.reason,
                    quantityAfter: plan.available,
                };
            result.action = plan.action;
            result.quantityAfter = plan.remaining;
            if (ctx.dryRun)
                return { ...result, status: 'planned' };
            if (plan.action === 'end') {
                await this.endListing(t);
                await this.markMirror(t, { status: 'ended', qty: 0 });
            }
            else {
                await this.setQuantity(t, plan.remaining, live.quantitySold);
                await this.markMirror(t, { status: 'active', qty: plan.remaining });
            }
            return { ...result, status: 'done' };
        }
        catch (err) {
            const message = (err.message ?? String(err)).slice(0, 1000);
            if ((0, cross_store_sale_sync_util_js_1.isListingNotFoundError)(message)) {
                return { ...result, reason: 'listing_not_found', error: message };
            }
            return { ...result, status: 'failed', error: message };
        }
    }
    async readLive(t) {
        if (t.ebay_item_id) {
            const d = await this.trading.getItemDetails(t.store_id, t.ebay_item_id, t.marketplace_id);
            return {
                active: (0, cross_store_sale_sync_util_js_1.isLiveTradingStatus)(d.listingStatus),
                available: (0, cross_store_sale_sync_util_js_1.tradingAvailable)(d.quantity, d.quantitySold),
                quantitySold: d.quantitySold ?? 0,
            };
        }
        const offer = await this.inventory.getOffer(t.store_id, t.offer_id);
        const status = (offer.status ?? '').toUpperCase();
        return {
            active: status === 'PUBLISHED',
            available: offer.availableQuantity ?? 0,
            quantitySold: 0,
        };
    }
    async endListing(t) {
        if (t.offer_id) {
            try {
                await this.inventory.withdrawOffer(t.store_id, t.offer_id);
                return;
            }
            catch (err) {
                if (!t.ebay_item_id)
                    throw err;
                this.logger.warn(`withdrawOffer ${t.offer_id} failed (${err.message}); ending item ${t.ebay_item_id} instead`);
            }
        }
        await this.trading.endFixedPriceItem(t.store_id, t.ebay_item_id, t.marketplace_id);
    }
    async setQuantity(t, remaining, quantitySold) {
        if (t.offer_id) {
            try {
                const res = await this.inventory.bulkUpdatePriceQuantity(t.store_id, [
                    { offers: [{ offerId: t.offer_id, availableQuantity: remaining }] },
                ]);
                const bad = (res?.responses ?? []).filter((x) => x.statusCode >= 400);
                if (!bad.length)
                    return;
                if (!t.ebay_item_id)
                    throw new Error(bad
                        .map((b) => b.errors?.map((e) => e.message).join('; ') ||
                        `HTTP ${b.statusCode}`)
                        .join(' | '));
            }
            catch (err) {
                if (!t.ebay_item_id)
                    throw err;
                this.logger.warn(`Offer quantity update ${t.offer_id} failed (${err.message}); revising item ${t.ebay_item_id} instead`);
            }
        }
        const itemId = t.ebay_item_id;
        await this.trading.reviseFixedPriceItem(t.store_id, itemId, { quantity: quantitySold + remaining }, t.marketplace_id);
        const after = await this.trading.getItemDetails(t.store_id, itemId, t.marketplace_id);
        const available = (0, cross_store_sale_sync_util_js_1.tradingAvailable)(after.quantity, after.quantitySold);
        if (available !== remaining) {
            await this.trading.reviseFixedPriceItem(t.store_id, itemId, { quantity: remaining }, t.marketplace_id);
            const check = await this.trading.getItemDetails(t.store_id, itemId, t.marketplace_id);
            const finalAvailable = (0, cross_store_sale_sync_util_js_1.tradingAvailable)(check.quantity, check.quantitySold);
            if (finalAvailable !== remaining) {
                throw new Error(`eBay reports ${finalAvailable} available after revising item ${itemId} to ${remaining}`);
            }
        }
    }
    async markMirror(t, s) {
        await this.db.query(`UPDATE ebay_published_listings
          SET listing_status = $2, quantity_available = $3, last_synced_at = now(), updated_at = now()
        WHERE id = $1 OR ($4::varchar IS NOT NULL AND ebay_item_id = $4)`, [t.id, s.status, s.qty, t.ebay_item_id]);
    }
    async record(r, targetKey) {
        await this.db.query(`INSERT INTO ebay_cross_store_sale_syncs
         (order_id, order_item_id, target_key, target_published_listing_id, target_store_id, target_item_id,
          sku, sold_item_id, sold_qty, action, status, reason, quantity_before, quantity_after, error, attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,1)
       ON CONFLICT (order_item_id, target_key) DO UPDATE SET
         action = EXCLUDED.action, status = EXCLUDED.status, reason = EXCLUDED.reason,
         quantity_before = EXCLUDED.quantity_before, quantity_after = EXCLUDED.quantity_after,
         error = EXCLUDED.error, attempts = ebay_cross_store_sale_syncs.attempts + 1, updated_at = now()`, [
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
        ]);
    }
};
exports.CrossStoreSaleSyncService = CrossStoreSaleSyncService;
__decorate([
    (0, event_emitter_1.OnEvent)('order.new'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CrossStoreSaleSyncService.prototype, "onOrderNew", null);
exports.CrossStoreSaleSyncService = CrossStoreSaleSyncService = CrossStoreSaleSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, bullmq_1.InjectQueue)(cross_store_sale_sync_util_js_1.CROSS_STORE_SALE_SYNC_QUEUE)),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        feature_flag_service_js_1.FeatureFlagService,
        ebay_trading_api_service_js_1.EbayTradingApiService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        notifications_service_js_1.NotificationsService, Function])
], CrossStoreSaleSyncService);
//# sourceMappingURL=cross-store-sale-sync.service.js.map