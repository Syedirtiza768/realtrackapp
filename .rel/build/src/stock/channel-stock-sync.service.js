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
var ChannelStockSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelStockSyncService = exports.STOCK_CHANNEL_PUSH_FLAG = exports.STOCK_CHANNEL_SYNC_QUEUE = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const bullmq_1 = require("@nestjs/bullmq");
const event_emitter_1 = require("@nestjs/event-emitter");
const schedule_1 = require("@nestjs/schedule");
const bullmq_2 = require("bullmq");
const typeorm_1 = require("typeorm");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
const scheduler_leader_service_js_1 = require("../common/scheduler/scheduler-leader.service.js");
const ebay_inventory_api_service_js_1 = require("../channels/ebay/ebay-inventory-api.service.js");
const ebay_trading_api_service_js_1 = require("../channels/ebay/ebay-trading-api.service.js");
const stock_ledger_service_js_1 = require("./stock-ledger.service.js");
exports.STOCK_CHANNEL_SYNC_QUEUE = 'stock-channel-sync';
exports.STOCK_CHANNEL_PUSH_FLAG = 'stock_channel_push';
const PARTSBAZAR360_CHANNEL = 'partsbazar360';
let ChannelStockSyncService = ChannelStockSyncService_1 = class ChannelStockSyncService {
    db;
    flags;
    leader;
    ebayInventory;
    ebayTrading;
    moduleRef;
    queue;
    logger = new common_1.Logger(ChannelStockSyncService_1.name);
    constructor(db, flags, leader, ebayInventory, ebayTrading, moduleRef, queue) {
        this.db = db;
        this.flags = flags;
        this.leader = leader;
        this.ebayInventory = ebayInventory;
        this.ebayTrading = ebayTrading;
        this.moduleRef = moduleRef;
        this.queue = queue;
    }
    async onStockChanged(payload) {
        try {
            await this.queue.add('sweep', { organizationId: payload.organizationId }, { jobId: `sweep-${payload.organizationId}`, delay: 3_000, removeOnComplete: true, removeOnFail: 50 });
        }
        catch (err) {
            this.logger.warn(`Could not enqueue channel stock sweep: ${err.message}`);
        }
    }
    async cronSweep() {
        await this.leader.runIfLeader('stock-channel-sync-sweep', 100_000, async () => {
            await this.queue.add('sweep', {}, { jobId: `sweep-cron-${Math.floor(Date.now() / 120_000)}`, removeOnComplete: true, removeOnFail: 50 });
        });
    }
    async cronDrift() {
        await this.leader.runIfLeader('stock-channel-drift-check', 3_600_000, async () => {
            await this.queue.add('drift', {}, { jobId: `drift-${new Date().toISOString().slice(0, 10)}`, removeOnComplete: true, removeOnFail: 20 });
        });
    }
    async computeDesired(storeId, itemId) {
        const [row] = (await this.db.query(`SELECT i.status, i.sourcing_mode,
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
        WHERE i.id = $2`, [storeId, itemId]));
        if (!row)
            throw new common_1.NotFoundException('Inventory item not found');
        const itemActive = row.status === 'active';
        const bufferQty = Number(row.buffer_qty);
        const maxQty = row.max_qty == null ? null : Number(row.max_qty);
        const onHandAvailable = Number(row.on_hand_available);
        const sourceable = row.include_sourceable && row.sourcing_mode !== 'stocked'
            ? Math.max(0, Math.min(Number(row.supplier_available) - Number(row.open_requests), Number(row.max_sourceable_qty)))
            : 0;
        let desired = itemActive ? Math.max(0, onHandAvailable - bufferQty) + sourceable : 0;
        if (maxQty != null)
            desired = Math.min(desired, maxQty);
        return { desired, onHandAvailable, sourceable, bufferQty, maxQty, pushEnabled: !!row.push_enabled, itemActive };
    }
    async globalPushEnabled() {
        return this.flags.isEnabled(exports.STOCK_CHANNEL_PUSH_FLAG).catch(() => false);
    }
    async findTargets(storeId, itemId) {
        const [store] = (await this.db.query(`SELECT channel FROM stores WHERE id = $1`, [storeId]));
        if (!store)
            return [];
        if (store.channel === PARTSBAZAR360_CHANNEL) {
            const rows = (await this.db.query(`SELECT c.connection_id, c.listing_id, c.override_quantity
           FROM listing_channel_instances c JOIN inventory_items i ON i.id = $2
          WHERE c.store_id = $1 AND c.channel = $3
            AND c.listing_id IN (i.listing_record_id, i.catalog_product_id)
            AND c.sync_status NOT IN ('ended')`, [storeId, itemId, PARTSBAZAR360_CHANNEL]));
            return rows.map((r) => ({ kind: 'pb360', connectionId: r.connection_id, listingId: r.listing_id, channelQty: r.override_quantity }));
        }
        const rows = (await this.db.query(`SELECT p.id, p.offer_id, p.ebay_item_id, p.sku, p.marketplace_id, p.quantity_available
         FROM ebay_published_listings p JOIN inventory_items i ON i.id = $2
        WHERE p.store_id = $1 AND p.listing_status IN ('active','out_of_stock')
          AND (p.sku = i.sku OR (i.catalog_product_id IS NOT NULL AND p.catalog_product_id = i.catalog_product_id))`, [storeId, itemId]));
        return rows.flatMap((r) => r.offer_id
            ? [{ kind: 'ebay_offer', offerId: r.offer_id, sku: r.sku, publishedListingId: r.id, channelQty: r.quantity_available }]
            : r.ebay_item_id
                ? [{ kind: 'ebay_item', itemId: r.ebay_item_id, marketplaceId: r.marketplace_id, publishedListingId: r.id, channelQty: r.quantity_available }]
                : []);
    }
    async sweep(organizationId, limit = 200) {
        const pushGlobal = await this.flags.isEnabled(exports.STOCK_CHANNEL_PUSH_FLAG).catch(() => false);
        const rows = (await this.db.transaction(async (em) => {
            const claimed = (await em.query(`SELECT store_id, inventory_item_id, organization_id, pushed_qty, attempts
           FROM channel_stock_sync_state
          WHERE dirty ${organizationId ? 'AND organization_id = $2' : ''}
            -- failed rows back off 2, 4, 6, 8 minutes between attempts
            AND (status <> 'failed' OR updated_at < now() - attempts * interval '2 minutes')
          ORDER BY updated_at
          LIMIT $1 FOR UPDATE SKIP LOCKED`, organizationId ? [limit, organizationId] : [limit]));
            for (const r of claimed)
                await em.query(`UPDATE channel_stock_sync_state SET dirty = false WHERE store_id = $1 AND inventory_item_id = $2`, [r.store_id, r.inventory_item_id]);
            return claimed;
        }));
        let pushed = 0;
        let failed = 0;
        for (const r of rows) {
            const outcome = await this.processRow(r, pushGlobal);
            if (outcome === 'synced')
                pushed++;
            if (outcome === 'failed')
                failed++;
        }
        if (rows.length)
            this.logger.log(`Channel stock sweep: ${rows.length} rows, ${pushed} pushed, ${failed} failed`);
        return { processed: rows.length, pushed, failed };
    }
    async processRow(r, pushGlobal) {
        let status = 'pending';
        let error = null;
        let desired = null;
        let channelQty = null;
        let targets = [];
        try {
            const d = await this.computeDesired(r.store_id, r.inventory_item_id);
            desired = d.desired;
            targets = await this.findTargets(r.store_id, r.inventory_item_id);
            channelQty = targets.length ? targets.map((t) => t.channelQty ?? 0).reduce((a, b) => Math.min(a, b)) : null;
            if (!targets.length)
                status = 'no_target';
            else if (!pushGlobal || !d.pushEnabled)
                status = 'shadow';
            else if (targets.every((t) => t.channelQty === desired) && r.pushed_qty === desired)
                status = 'synced';
            else {
                await this.push(r.store_id, targets, desired);
                status = 'synced';
                channelQty = desired;
            }
        }
        catch (err) {
            status = 'failed';
            error = err.message?.slice(0, 2000) ?? String(err);
            this.logger.warn(`Stock push failed store=${r.store_id} item=${r.inventory_item_id}: ${error}`);
        }
        const retry = status === 'failed' && r.attempts + 1 < 5;
        await this.db.query(`UPDATE channel_stock_sync_state
          SET status = $3::varchar, desired_qty = $4::int, channel_qty = $5::int, last_error = $6::text, targets = $7::jsonb,
              attempts = CASE WHEN $3::varchar = 'failed' THEN attempts + 1 ELSE 0 END,
              pushed_qty = CASE WHEN $3::varchar = 'synced' THEN $4::int ELSE pushed_qty END,
              last_pushed_at = CASE WHEN $3::varchar = 'synced' AND $8::boolean THEN now() ELSE last_pushed_at END,
              dirty = dirty OR $9::boolean, updated_at = now()
        WHERE store_id = $1 AND inventory_item_id = $2`, [r.store_id, r.inventory_item_id, status, desired, channelQty, error, JSON.stringify(targets), status === 'synced', retry]);
        return status;
    }
    async push(storeId, targets, qty) {
        const offers = targets.filter((t) => t.kind === 'ebay_offer');
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
            if (t.kind === 'ebay_item')
                await this.reviseTradingQuantity(storeId, t.itemId, qty, t.marketplaceId);
            if (t.kind === 'pb360') {
                const pb360 = this.partsBazar();
                if (qty > 0)
                    await pb360.publish(t.connectionId, t.listingId, { quantity: qty });
                else
                    await pb360.end(t.listingId);
            }
        }
        const published = targets.filter((t) => t.kind !== 'pb360').map((t) => t.publishedListingId);
        if (published.length)
            await this.db.query(`UPDATE ebay_published_listings SET quantity_available = $2,
        listing_status = CASE WHEN $2::int > 0 THEN 'active' ELSE 'out_of_stock' END,
        updated_at = now() WHERE id = ANY($1::uuid[])`, [published, qty]);
    }
    partsBazar() {
        const specifier = '../channels/partsbazar360/partsbazar360.service.js';
        let cls;
        try {
            cls = require(specifier).PartsBazar360Service;
        }
        catch {
            cls = undefined;
        }
        if (!cls)
            throw new Error('The PartsBazar360 integration is not available in this build');
        return this.moduleRef.get(cls, { strict: false });
    }
    async reviseTradingQuantity(storeId, itemId, qty, marketplaceId) {
        const trading = this.ebayTrading;
        if (typeof trading.reviseFixedPriceItem !== 'function')
            throw new Error('This build cannot revise Trading-API listing quantities (ReviseFixedPriceItem is unavailable)');
        await trading.reviseFixedPriceItem(storeId, itemId, { quantity: qty }, marketplaceId);
    }
    async driftCheck(organizationId) {
        const params = [];
        const orgFilter = organizationId ? (params.push(organizationId), `AND c.organization_id = $1`) : '';
        const res = (await this.db.query(`WITH snap AS (
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
        RETURNING (c.desired_qty IS DISTINCT FROM snap.qty) AS drift`, params));
        const rows = (Array.isArray(res[0]) ? res[0] : res);
        return { checked: rows.length, drift: rows.filter((r) => r.drift).length };
    }
    async list(scope, q) {
        const params = [scope.organizationId];
        const where = ['c.organization_id = $1'];
        if (q.storeId) {
            params.push(q.storeId);
            where.push(`c.store_id = $${params.length}`);
        }
        if (q.status) {
            params.push(q.status.split(','));
            where.push(`c.status = ANY($${params.length})`);
        }
        if (q.driftOnly)
            where.push(`c.channel_qty IS DISTINCT FROM c.desired_qty AND c.status <> 'no_target'`);
        const limit = Math.min(q.limit ?? 100, 500);
        const offset = q.offset ?? 0;
        const rows = await this.db.query(`SELECT c.store_id AS "storeId", s.store_name AS "storeName", s.channel, c.inventory_item_id AS "itemId",
              i.sku, i.title, i.sourcing_mode AS "sourcingMode", c.status, c.dirty, c.desired_qty AS "desiredQty",
              c.pushed_qty AS "pushedQty", c.channel_qty AS "channelQty", c.attempts, c.last_error AS "lastError",
              c.last_pushed_at AS "lastPushedAt", c.updated_at AS "updatedAt",
              jsonb_array_length(c.targets) AS "targetCount", count(*) OVER()::int AS "totalCount"
         FROM channel_stock_sync_state c
         JOIN stores s ON s.id = c.store_id
         JOIN inventory_items i ON i.id = c.inventory_item_id
        WHERE ${where.join(' AND ')}
        ORDER BY (c.status = 'failed') DESC, (c.channel_qty IS DISTINCT FROM c.desired_qty) DESC, c.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}`, params);
        return { total: rows[0]?.totalCount ?? 0, items: rows };
    }
    async summary(scope) {
        const [row] = (await this.db.query(`SELECT COUNT(*) FILTER (WHERE status = 'synced')::int synced,
              COUNT(*) FILTER (WHERE status = 'shadow')::int shadow,
              COUNT(*) FILTER (WHERE status = 'failed')::int failed,
              COUNT(*) FILTER (WHERE status = 'no_target')::int "noTarget",
              COUNT(*) FILTER (WHERE dirty)::int pending,
              COUNT(*) FILTER (WHERE status <> 'no_target' AND channel_qty IS DISTINCT FROM desired_qty)::int drift
         FROM channel_stock_sync_state WHERE organization_id = $1`, [scope.organizationId]));
        const pushGlobal = await this.flags.isEnabled(exports.STOCK_CHANNEL_PUSH_FLAG).catch(() => false);
        return { ...row, pushGloballyEnabled: pushGlobal };
    }
    async resync(scope, storeId) {
        const params = [scope.organizationId];
        let storeFilter = '';
        if (storeId) {
            params.push(storeId);
            storeFilter = `AND s.id = $2`;
        }
        await this.db.query(`INSERT INTO channel_stock_sync_state (store_id, inventory_item_id, organization_id, dirty, status, updated_at)
       SELECT s.id, i.id, $1::uuid, true, 'pending', now()
         FROM stores s
         JOIN inventory_items i ON i.organization_id = $1 AND i.status = 'active'
        WHERE s.organization_id = $1 ${storeFilter}
          AND EXISTS (SELECT 1 FROM store_warehouse_links l WHERE l.store_id = s.id AND l.active)
          AND (EXISTS (SELECT 1 FROM stock_levels sl WHERE sl.inventory_item_id = i.id)
               OR EXISTS (SELECT 1 FROM inventory_item_sources x WHERE x.inventory_item_id = i.id AND x.active))
       ON CONFLICT (store_id, inventory_item_id) DO UPDATE SET dirty = true, updated_at = now()`, params);
        return this.sweep(scope.organizationId, 1000);
    }
};
exports.ChannelStockSyncService = ChannelStockSyncService;
__decorate([
    (0, event_emitter_1.OnEvent)(stock_ledger_service_js_1.STOCK_CHANGED_EVENT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChannelStockSyncService.prototype, "onStockChanged", null);
__decorate([
    (0, schedule_1.Cron)('*/2 * * * *', { name: 'stock-channel-sync-sweep' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChannelStockSyncService.prototype, "cronSweep", null);
__decorate([
    (0, schedule_1.Cron)('30 2 * * *', { name: 'stock-channel-drift-check' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChannelStockSyncService.prototype, "cronDrift", null);
exports.ChannelStockSyncService = ChannelStockSyncService = ChannelStockSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, bullmq_1.InjectQueue)(exports.STOCK_CHANNEL_SYNC_QUEUE)),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        feature_flag_service_js_1.FeatureFlagService,
        scheduler_leader_service_js_1.SchedulerLeaderService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_trading_api_service_js_1.EbayTradingApiService,
        core_1.ModuleRef,
        bullmq_2.Queue])
], ChannelStockSyncService);
//# sourceMappingURL=channel-stock-sync.service.js.map