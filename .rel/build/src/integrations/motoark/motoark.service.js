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
var MotoarkService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotoarkService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("typeorm");
const store_access_service_js_1 = require("../../channels/store-access.service.js");
const published_listings_service_js_1 = require("../../published-listings/services/published-listings.service.js");
const rbac_service_js_1 = require("../../rbac/rbac.service.js");
const channel_stock_sync_service_js_1 = require("../../stock/channel-stock-sync.service.js");
const stock_ledger_service_js_1 = require("../../stock/stock-ledger.service.js");
const index_js_1 = require("../../stock/entities/index.js");
const motoark_stock_service_js_1 = require("./motoark-stock.service.js");
const webhook_signature_js_1 = require("./webhook-signature.js");
class PendingEvent extends Error {
}
let MotoarkService = MotoarkService_1 = class MotoarkService {
    db;
    listings;
    stores;
    rbac;
    stock;
    ledger;
    channels;
    logger = new common_1.Logger(MotoarkService_1.name);
    constructor(db, listings, stores, rbac, stock, ledger, channels) {
        this.db = db;
        this.listings = listings;
        this.stores = stores;
        this.rbac = rbac;
        this.stock = stock;
        this.ledger = ledger;
        this.channels = channels;
    }
    async accept(org, user, dto, raw, timestamp, signature) {
        (0, webhook_signature_js_1.verifyWebhook)(process.env.MOTOARK_ORDER_WEBHOOK_SECRET, raw, timestamp, signature);
        this.validate(dto);
        const storeId = await this.assertScope(org, user);
        const physicalPermission = dto.eventType === 'return.received'
            ? 'motoark.returns.receive'
            : ['return.restocked', 'return.disposed'].includes(dto.eventType)
                ? 'motoark.returns.restock'
                : null;
        if (physicalPermission &&
            !(await this.rbac.getPermissionKeysForUser(user.id)).has(physicalPermission))
            throw new common_1.ForbiddenException('Physical return processing requires warehouse authority');
        const hash = (0, webhook_signature_js_1.payloadHash)(dto);
        const inserted = await this.db.query(`INSERT INTO motoark_order_events(organization_id,store_id,actor_user_id,event_id,external_order_id,payload_hash,payload)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,event_id) DO NOTHING RETURNING id`, [org, storeId, user.id, dto.eventId, dto.externalOrderId, hash, dto]);
        const [event] = await this.db.query(`SELECT id,payload_hash,store_id FROM motoark_order_events WHERE organization_id=$1 AND event_id=$2`, [org, dto.eventId]);
        if (event.payload_hash !== hash)
            throw new common_1.ConflictException('Event ID was already used with a different payload');
        if (event.store_id !== storeId)
            throw new common_1.ForbiddenException('Event store is outside the authorized integration');
        await this.process(event.id);
        return {
            duplicate: inserted.length === 0,
            ...(await this.get(org, user, dto.eventId)),
        };
    }
    async get(org, user, eventId) {
        const storeId = await this.assertScope(org, user);
        const [row] = await this.db.query(`SELECT event_id AS "eventId",status,attempts,last_error AS "lastError",result,
      created_at AS "receivedAt",applied_at AS "appliedAt" FROM motoark_order_events WHERE organization_id=$1 AND store_id=$2 AND event_id=$3`, [org, storeId, eventId]);
        if (!row)
            throw new common_1.NotFoundException('Order event not found');
        return row;
    }
    async quantity(org, user, listingId) {
        const storeId = await this.assertScope(org, user);
        return this.quantityFor(this.db.manager, org, storeId, listingId);
    }
    async quantityFor(em, org, storeId, listingId) {
        const [row] = await em.query(`SELECT p.id AS "listingId",p.quantity_available AS "marketplaceQuantity",p.revision AS "listingRevision",
      i.id AS "inventoryItemId",i.matches AS "mappingCount",c.desired_qty AS "desiredQuantity",c.status AS "channelSyncStatus",c.last_error AS "channelSyncError",
      COALESCE((SELECT sum(sl.on_hand) FROM stock_levels sl WHERE sl.inventory_item_id=i.id),0)::int AS "onHand",
      COALESCE((SELECT sum(sl.reserved) FROM stock_levels sl WHERE sl.inventory_item_id=i.id),0)::int AS reserved,
      COALESCE((SELECT sum(sl.version) FROM stock_levels sl WHERE sl.inventory_item_id=i.id),0)::text AS "stockRevision"
      FROM ebay_published_listings p LEFT JOIN LATERAL (
        SELECT candidate.id,count(*) OVER()::int AS matches FROM inventory_items candidate
        WHERE candidate.organization_id=p.organization_id AND candidate.status='active'
        AND ((p.catalog_product_id IS NOT NULL AND candidate.catalog_product_id=p.catalog_product_id)
          OR (candidate.sku=p.sku AND NOT EXISTS(SELECT 1 FROM inventory_items preferred
            WHERE preferred.organization_id=p.organization_id AND preferred.status='active' AND preferred.catalog_product_id=p.catalog_product_id))) LIMIT 1
      ) i ON true
      LEFT JOIN channel_stock_sync_state c ON c.store_id=p.store_id AND c.inventory_item_id=i.id
      WHERE p.id=$1 AND p.organization_id=$2 AND p.store_id=$3`, [listingId, org, storeId]);
        if (!row)
            throw new common_1.NotFoundException('Primemotive listing not found');
        if (!row.inventoryItemId || row.mappingCount !== 1)
            return {
                ...row,
                mapped: false,
                quantityAvailable: null,
                mappingError: (row.mappingCount ?? 0) > 1 ? 'ambiguous' : 'unmapped',
            };
        const desired = await this.channels.computeDesired(storeId, row.inventoryItemId);
        const globalPushEnabled = await this.channels.globalPushEnabled();
        return {
            ...row,
            mapped: true,
            quantityAvailable: desired.desired,
            warehouseAvailable: desired.onHandAvailable,
            sourceable: desired.sourceable,
            channelSyncStatus: row.channelSyncStatus ?? 'pending',
            storeChannelPushEnabled: desired.pushEnabled,
            globalChannelPushEnabled: globalPushEnabled,
            channelPushEnabled: desired.pushEnabled && globalPushEnabled,
        };
    }
    async retryDue() {
        const rows = await this.db.query(`SELECT id FROM motoark_order_events WHERE status IN ('received','pending') AND next_attempt_at<=now() ORDER BY next_attempt_at,id LIMIT 25`);
        for (const row of rows)
            await this.process(row.id);
    }
    async process(id) {
        let org;
        const items = [];
        try {
            await this.db.transaction(async (em) => {
                const [event] = await em.query(`SELECT * FROM motoark_order_events WHERE id=$1 FOR UPDATE SKIP LOCKED`, [id]);
                if (!event || ['applied', 'rejected'].includes(event.status))
                    return;
                org = event.organization_id;
                const dto = event.payload;
                await em.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
                    `motoark:${org}:${dto.externalOrderId}`,
                ]);
                let [order] = await em.query(`SELECT * FROM motoark_orders WHERE organization_id=$1 AND external_order_id=$2 FOR UPDATE`, [org, dto.externalOrderId]);
                if (!order &&
                    (dto.eventType !== 'order.paid' || dto.orderVersion !== 1))
                    throw new PendingEvent('Waiting for original purchase and previous order versions');
                if (order && order.store_id !== event.store_id)
                    throw new common_1.BadRequestException('Order store mismatch');
                if (order && dto.orderVersion > order.version + 1)
                    throw new PendingEvent('Waiting for previous order version');
                if (order && dto.orderVersion <= order.version)
                    throw new common_1.BadRequestException('Order version is already applied; reuse the original event ID for retries');
                if (order && dto.currency !== order.currency)
                    throw new common_1.BadRequestException('Order currency mismatch');
                if (order && dto.eventType === 'order.paid')
                    throw new common_1.BadRequestException('Original purchase already exists');
                if (!order)
                    order = await this.purchase(em, event, dto);
                const ctx = {
                    organizationId: org,
                    actorUserId: event.actor_user_id,
                    storeId: event.store_id,
                    orderId: order.order_id,
                    eventKey: `motoark:${event.id}`,
                };
                if (dto.eventType === 'refund.completed') {
                    const [existing] = await em.query(`SELECT amount FROM motoark_refunds WHERE motoark_order_id=$1 AND refund_id=$2`, [order.id, dto.refundId]);
                    if (existing)
                        throw new common_1.BadRequestException('Refund ID already applied; reuse its original event ID');
                    const total = (0, webhook_signature_js_1.cents)(order.refunded_amount) + (0, webhook_signature_js_1.cents)(dto.amount);
                    if (total > (0, webhook_signature_js_1.cents)(order.total_amount))
                        throw new common_1.BadRequestException('Refund exceeds remaining order amount');
                    await em.query(`INSERT INTO motoark_refunds VALUES($1,$2,$3)`, [
                        order.id,
                        dto.refundId,
                        dto.amount,
                    ]);
                    await em.query(`UPDATE motoark_orders SET refunded_amount=$2 WHERE id=$1`, [order.id, (0, webhook_signature_js_1.money)(total)]);
                    await em.query(`UPDATE orders SET refund_amount=$2,refunded_at=$3 WHERE id=$1`, [order.order_id, (0, webhook_signature_js_1.money)(total), dto.occurredAt]);
                }
                else
                    for (const input of dto.lines) {
                        const [line] = await em.query(`SELECT * FROM motoark_order_lines WHERE motoark_order_id=$1 AND external_line_id=$2 FOR UPDATE`, [order.id, input.externalLineId]);
                        if (!line)
                            throw new common_1.BadRequestException('Unknown original order line');
                        if (input.listingId &&
                            input.listingId !==
                                line.listing_id)
                            throw new common_1.BadRequestException('Original listing identity mismatch');
                        items.push(line.inventory_item_id);
                        if (dto.eventType === 'order.paid')
                            await this.stock.reserve(em, ctx, line);
                        else if (dto.eventType === 'order.shipped' ||
                            dto.eventType === 'order.cancelled') {
                            const ship = dto.eventType === 'order.shipped';
                            await this.stock.consume(em, ctx, line, input.quantity, ship);
                            await em.query(`UPDATE motoark_order_lines SET ${ship ? 'shipped=shipped' : 'cancelled=cancelled'}+$2 WHERE id=$1`, [line.id, input.quantity]);
                        }
                        else
                            await this.stock.returnAction(em, ctx, line, input, dto.returnId, dto.eventType);
                    }
                await em.query(`UPDATE motoark_orders SET version=$2 WHERE id=$1`, [
                    order.id,
                    dto.orderVersion,
                ]);
                await em.query(`UPDATE order_items oi SET stock_status=CASE WHEN l.shipped+l.cancelled=l.quantity AND l.shipped>0 THEN 'shipped' WHEN l.cancelled=l.quantity THEN 'released' ELSE 'reserved' END,
          fulfilled=(l.shipped+l.cancelled=l.quantity AND l.shipped>0) FROM motoark_order_lines l WHERE l.order_item_id=oi.id AND l.motoark_order_id=$1`, [order.id]);
                await em.query(`UPDATE orders SET status=CASE
          WHEN NOT EXISTS(SELECT 1 FROM motoark_order_lines WHERE motoark_order_id=$2 AND cancelled<>quantity) THEN 'cancelled'
          WHEN NOT EXISTS(SELECT 1 FROM motoark_order_lines WHERE motoark_order_id=$2 AND shipped+cancelled<>quantity) THEN 'shipped'
          ELSE 'processing' END, updated_at=now() WHERE id=$1`, [order.order_id, order.id]);
                await em.query(`UPDATE motoark_order_events SET status='applied',attempts=attempts+1,last_error=NULL,applied_at=clock_timestamp(),
          result=$2 WHERE id=$1`, [
                    id,
                    {
                        orderId: order.order_id,
                        externalOrderId: dto.externalOrderId,
                        orderVersion: dto.orderVersion,
                        stockApplied: true,
                        quantityPath: '/api/integrations/motoark/quantities/{listingId}',
                        channelSynchronization: 'asynchronous',
                    },
                ]);
            });
            if (org && items.length)
                this.ledger.emitChanged(org, [...new Set(items)].map((itemId) => ({ itemId })));
        }
        catch (error) {
            const err = error;
            const pending = error instanceof PendingEvent ||
                err.status === 409 ||
                !(error instanceof common_1.BadRequestException) ||
                err.message.startsWith('Insufficient mapped warehouse stock');
            const message = error instanceof PendingEvent || error instanceof common_1.BadRequestException
                ? err.message
                : 'Temporary stock/database processing failure';
            this.logger.warn(`MotoArk event ${id}: ${err.message}`);
            await this.db.query(`UPDATE motoark_order_events SET status=$2,attempts=attempts+1,last_error=$3,
        next_attempt_at=now()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::int)
        WHERE id=$1 AND status NOT IN ('applied','rejected')`, [id, pending ? 'pending' : 'rejected', message.slice(0, 1000)]);
        }
    }
    async purchase(em, event, dto) {
        const mapped = [];
        for (const input of dto.lines) {
            const [p] = await em.query(`SELECT * FROM ebay_published_listings WHERE id=$1 AND organization_id=$2 AND store_id=$3`, [input.listingId, event.organization_id, event.store_id]);
            if (!p)
                throw new common_1.BadRequestException('Listing does not belong to the authorized Primemotive store');
            if (p.is_test_listing || p.ebay_item_id?.startsWith('SIM-'))
                throw new common_1.BadRequestException('Mirror-only synthetic listings cannot create stock transactions');
            if (p.listing_status !== 'active' && p.listing_status !== 'out_of_stock')
                throw new common_1.BadRequestException('Listing is no longer eligible for an external purchase');
            const candidates = await em.query(`SELECT id FROM inventory_items WHERE organization_id=$1 AND status='active'
        AND ((($2::uuid IS NOT NULL) AND catalog_product_id=$2) OR (sku=$3 AND NOT EXISTS(SELECT 1 FROM inventory_items preferred
          WHERE preferred.organization_id=$1 AND preferred.status='active' AND preferred.catalog_product_id=$2))) LIMIT 2`, [event.organization_id, p.catalog_product_id, p.sku]);
            if (!candidates.length)
                throw new PendingEvent('Listing has no active inventory item mapping');
            if (candidates.length !== 1)
                throw new PendingEvent('Listing inventory mapping is ambiguous');
            const item = await em
                .getRepository(index_js_1.InventoryItem)
                .findOneByOrFail({ id: candidates[0].id });
            mapped.push({
                input,
                item: {
                    id: item.id,
                    sku: item.sku,
                    title: item.title ?? p.title,
                    listing_record_id: item.listingRecordId,
                },
                title: p.title,
            });
        }
        for (const id of [...new Set(mapped.map((x) => x.item.id))].sort())
            await em.query(`SELECT id FROM inventory_items WHERE id=$1 FOR UPDATE`, [
                id,
            ]);
        const subtotal = dto.lines.reduce((n, x) => n + (0, webhook_signature_js_1.cents)(x.unitPrice) * BigInt(x.quantity), 0n);
        const total = subtotal +
            (0, webhook_signature_js_1.cents)(dto.shippingAmount ?? '0.00') +
            (0, webhook_signature_js_1.cents)(dto.taxAmount ?? '0.00');
        if (total > 9999999999n)
            throw new common_1.BadRequestException('Order total exceeds supported monetary range');
        const [generic] = await em.query(`INSERT INTO orders(channel,store_id,external_order_id,status,subtotal,shipping_cost,tax_amount,total_amount,currency,ordered_at,paid_at)
      VALUES('motoark',$1,$2,'processing',$3,$4,$5,$6,$7,$8,$8) RETURNING id`, [
            event.store_id,
            `ma:${(0, webhook_signature_js_1.payloadHash)([event.organization_id, dto.externalOrderId])}`,
            (0, webhook_signature_js_1.money)(subtotal),
            dto.shippingAmount ?? '0.00',
            dto.taxAmount ?? '0.00',
            (0, webhook_signature_js_1.money)(total),
            dto.currency,
            dto.occurredAt,
        ]);
        const [order] = await em.query(`INSERT INTO motoark_orders(organization_id,store_id,external_order_id,order_id,currency,total_amount) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [
            event.organization_id,
            event.store_id,
            dto.externalOrderId,
            generic.id,
            dto.currency,
            (0, webhook_signature_js_1.money)(total),
        ]);
        for (const { input, item, title } of mapped) {
            const [line] = await em.query(`INSERT INTO order_items(order_id,listing_id,external_item_id,sku,title,quantity,unit_price,total_price,inventory_item_id,stock_status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'reserved') RETURNING id`, [
                generic.id,
                item.listing_record_id,
                input.externalLineId,
                item.sku,
                title,
                input.quantity,
                input.unitPrice,
                (0, webhook_signature_js_1.money)((0, webhook_signature_js_1.cents)(input.unitPrice) * BigInt(input.quantity)),
                item.id,
            ]);
            await em.query(`INSERT INTO motoark_order_lines(motoark_order_id,external_line_id,listing_id,inventory_item_id,order_item_id,quantity) VALUES($1,$2,$3,$4,$5,$6)`, [
                order.id,
                input.externalLineId,
                input.listingId,
                item.id,
                line.id,
                input.quantity,
            ]);
        }
        return order;
    }
    async assertScope(org, user) {
        const id = await this.listings.resolvePrimemotiveStoreId(org);
        if (!user.storeAccessAll &&
            !(await this.stores.getAccessibleStoreIds(user)).has(id))
            throw new common_1.ForbiddenException('Primemotive store access is required');
        return id;
    }
    validate(dto) {
        if (dto.eventType === 'refund.completed') {
            if (!dto.refundId || !dto.amount || (0, webhook_signature_js_1.cents)(dto.amount) <= 0n)
                throw new common_1.BadRequestException('Refund ID and a positive decimal amount are required');
            if (dto.lines?.length)
                throw new common_1.BadRequestException('Refund is a financial event; do not specify stock quantities');
        }
        else if (!dto.lines?.length)
            throw new common_1.BadRequestException('Order lines are required');
        if (dto.eventType === 'order.paid' &&
            dto.lines?.some((l) => !l.listingId || !l.unitPrice))
            throw new common_1.BadRequestException('Purchase lines require listingId and unitPrice');
        if (dto.eventType.startsWith('return.') && !dto.returnId)
            throw new common_1.BadRequestException('Return events require returnId');
        if (dto.eventType !== 'order.paid' && (dto.shippingAmount || dto.taxAmount))
            throw new common_1.BadRequestException('Order charges can only be supplied on the original purchase');
    }
};
exports.MotoarkService = MotoarkService;
__decorate([
    (0, schedule_1.Cron)('*/15 * * * * *', { name: 'motoark-order-events' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MotoarkService.prototype, "retryDue", null);
exports.MotoarkService = MotoarkService = MotoarkService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        published_listings_service_js_1.PublishedListingsService,
        store_access_service_js_1.StoreAccessService,
        rbac_service_js_1.RbacService,
        motoark_stock_service_js_1.MotoarkStockService,
        stock_ledger_service_js_1.StockLedgerService,
        channel_stock_sync_service_js_1.ChannelStockSyncService])
], MotoarkService);
//# sourceMappingURL=motoark.service.js.map