import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import type { User } from '../../auth/entities/user.entity.js';
import { StoreAccessService } from '../../channels/store-access.service.js';
import { PublishedListingsService } from '../../published-listings/services/published-listings.service.js';
import { RbacService } from '../../rbac/rbac.service.js';
import { ChannelStockSyncService } from '../../stock/channel-stock-sync.service.js';
import { StockLedgerService } from '../../stock/stock-ledger.service.js';
import { InventoryItem } from '../../stock/entities/index.js';
import { MotoarkOrderEventDto } from './motoark.dto.js';
import type {
  MotoarkInboxRow,
  MotoarkOrderRow,
  MotoarkEventResult,
  MotoarkQuantityRow,
  MotoarkListingRow,
} from './motoark.types.js';
import {
  MotoarkStockService,
  type MotoarkStockContext,
  type MotoarkStockLine,
} from './motoark-stock.service.js';
import {
  cents,
  money,
  payloadHash,
  verifyWebhook,
} from './webhook-signature.js';

class PendingEvent extends Error {}

@Injectable()
export class MotoarkService {
  private readonly logger = new Logger(MotoarkService.name);
  constructor(
    private readonly db: DataSource,
    private readonly listings: PublishedListingsService,
    private readonly stores: StoreAccessService,
    private readonly rbac: RbacService,
    private readonly stock: MotoarkStockService,
    private readonly ledger: StockLedgerService,
    private readonly channels: ChannelStockSyncService,
  ) {}

  async accept(
    org: string,
    user: User,
    dto: MotoarkOrderEventDto,
    raw: Buffer,
    timestamp?: string,
    signature?: string,
  ) {
    verifyWebhook(
      process.env.MOTOARK_ORDER_WEBHOOK_SECRET,
      raw,
      timestamp,
      signature,
    );
    this.validate(dto);
    const storeId = await this.assertScope(org, user);
    const physicalPermission =
      dto.eventType === 'return.received'
        ? 'motoark.returns.receive'
        : ['return.restocked', 'return.disposed'].includes(dto.eventType)
          ? 'motoark.returns.restock'
          : null;
    if (
      physicalPermission &&
      !(await this.rbac.getPermissionKeysForUser(user.id)).has(
        physicalPermission,
      )
    )
      throw new ForbiddenException(
        'Physical return processing requires warehouse authority',
      );
    const hash = payloadHash(dto);
    const inserted = await this.db.query<Array<{ id: string }>>(
      `INSERT INTO motoark_order_events(organization_id,store_id,actor_user_id,event_id,external_order_id,payload_hash,payload)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,event_id) DO NOTHING RETURNING id`,
      [org, storeId, user.id, dto.eventId, dto.externalOrderId, hash, dto],
    );
    const [event] = await this.db.query<
      Array<Pick<MotoarkInboxRow, 'id' | 'payload_hash' | 'store_id'>>
    >(
      `SELECT id,payload_hash,store_id FROM motoark_order_events WHERE organization_id=$1 AND event_id=$2`,
      [org, dto.eventId],
    );
    if (event.payload_hash !== hash)
      throw new ConflictException(
        'Event ID was already used with a different payload',
      );
    if (event.store_id !== storeId)
      throw new ForbiddenException(
        'Event store is outside the authorized integration',
      );
    await this.process(event.id);
    return {
      duplicate: inserted.length === 0,
      ...(await this.get(org, user, dto.eventId)),
    };
  }

  async get(org: string, user: User, eventId: string) {
    const storeId = await this.assertScope(org, user);
    const [row] = await this.db.query<MotoarkEventResult[]>(
      `SELECT event_id AS "eventId",status,attempts,last_error AS "lastError",result,
      created_at AS "receivedAt",applied_at AS "appliedAt" FROM motoark_order_events WHERE organization_id=$1 AND store_id=$2 AND event_id=$3`,
      [org, storeId, eventId],
    );
    if (!row) throw new NotFoundException('Order event not found');
    return row;
  }

  async quantity(org: string, user: User, listingId: string) {
    const storeId = await this.assertScope(org, user);
    return this.quantityFor(this.db.manager, org, storeId, listingId);
  }

  private async quantityFor(
    em: EntityManager,
    org: string,
    storeId: string,
    listingId: string,
  ) {
    const [row] = await em.query<MotoarkQuantityRow[]>(
      `SELECT p.id AS "listingId",p.quantity_available AS "marketplaceQuantity",p.revision AS "listingRevision",
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
      WHERE p.id=$1 AND p.organization_id=$2 AND p.store_id=$3`,
      [listingId, org, storeId],
    );
    if (!row) throw new NotFoundException('Primemotive listing not found');
    if (!row.inventoryItemId || row.mappingCount !== 1)
      return {
        ...row,
        mapped: false,
        quantityAvailable: null,
        mappingError: (row.mappingCount ?? 0) > 1 ? 'ambiguous' : 'unmapped',
      };
    const desired = await this.channels.computeDesired(
      storeId,
      row.inventoryItemId,
    );
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

  @Cron('*/15 * * * * *', { name: 'motoark-order-events' })
  async retryDue() {
    const rows = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM motoark_order_events WHERE status IN ('received','pending') AND next_attempt_at<=now() ORDER BY next_attempt_at,id LIMIT 25`,
    );
    for (const row of rows) await this.process(row.id);
  }

  async process(id: string) {
    let org: string | undefined;
    const items: string[] = [];
    try {
      await this.db.transaction(async (em) => {
        const [event] = await em.query<MotoarkInboxRow[]>(
          `SELECT * FROM motoark_order_events WHERE id=$1 FOR UPDATE SKIP LOCKED`,
          [id],
        );
        if (!event || ['applied', 'rejected'].includes(event.status)) return;
        org = event.organization_id;
        const dto = event.payload;
        await em.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
          `motoark:${org}:${dto.externalOrderId}`,
        ]);
        let [order] = await em.query<MotoarkOrderRow[]>(
          `SELECT * FROM motoark_orders WHERE organization_id=$1 AND external_order_id=$2 FOR UPDATE`,
          [org, dto.externalOrderId],
        );
        if (
          !order &&
          (dto.eventType !== 'order.paid' || dto.orderVersion !== 1)
        )
          throw new PendingEvent(
            'Waiting for original purchase and previous order versions',
          );
        if (order && order.store_id !== event.store_id)
          throw new BadRequestException('Order store mismatch');
        if (order && dto.orderVersion > order.version + 1)
          throw new PendingEvent('Waiting for previous order version');
        if (order && dto.orderVersion <= order.version)
          throw new BadRequestException(
            'Order version is already applied; reuse the original event ID for retries',
          );
        if (order && dto.currency !== order.currency)
          throw new BadRequestException('Order currency mismatch');
        if (order && dto.eventType === 'order.paid')
          throw new BadRequestException('Original purchase already exists');
        if (!order) order = await this.purchase(em, event, dto);
        const ctx: MotoarkStockContext = {
          organizationId: org,
          actorUserId: event.actor_user_id,
          storeId: event.store_id,
          orderId: order.order_id,
          eventKey: `motoark:${event.id}`,
        };
        if (dto.eventType === 'refund.completed') {
          const [existing] = await em.query<Array<{ amount: string }>>(
            `SELECT amount FROM motoark_refunds WHERE motoark_order_id=$1 AND refund_id=$2`,
            [order.id, dto.refundId],
          );
          if (existing)
            throw new BadRequestException(
              'Refund ID already applied; reuse its original event ID',
            );
          const total = cents(order.refunded_amount) + cents(dto.amount!);
          if (total > cents(order.total_amount))
            throw new BadRequestException(
              'Refund exceeds remaining order amount',
            );
          await em.query(`INSERT INTO motoark_refunds VALUES($1,$2,$3)`, [
            order.id,
            dto.refundId,
            dto.amount,
          ]);
          await em.query(
            `UPDATE motoark_orders SET refunded_amount=$2 WHERE id=$1`,
            [order.id, money(total)],
          );
          await em.query(
            `UPDATE orders SET refund_amount=$2,refunded_at=$3 WHERE id=$1`,
            [order.order_id, money(total), dto.occurredAt],
          );
        } else
          for (const input of dto.lines!) {
            const [line] = await em.query<MotoarkStockLine[]>(
              `SELECT * FROM motoark_order_lines WHERE motoark_order_id=$1 AND external_line_id=$2 FOR UPDATE`,
              [order.id, input.externalLineId],
            );
            if (!line)
              throw new BadRequestException('Unknown original order line');
            if (
              input.listingId &&
              input.listingId !==
                (line as MotoarkStockLine & { listing_id: string }).listing_id
            )
              throw new BadRequestException(
                'Original listing identity mismatch',
              );
            items.push(line.inventory_item_id);
            if (dto.eventType === 'order.paid')
              await this.stock.reserve(em, ctx, line);
            else if (
              dto.eventType === 'order.shipped' ||
              dto.eventType === 'order.cancelled'
            ) {
              const ship = dto.eventType === 'order.shipped';
              await this.stock.consume(em, ctx, line, input.quantity, ship);
              await em.query(
                `UPDATE motoark_order_lines SET ${ship ? 'shipped=shipped' : 'cancelled=cancelled'}+$2 WHERE id=$1`,
                [line.id, input.quantity],
              );
            } else
              await this.stock.returnAction(
                em,
                ctx,
                line,
                input,
                dto.returnId!,
                dto.eventType,
              );
          }
        await em.query(`UPDATE motoark_orders SET version=$2 WHERE id=$1`, [
          order.id,
          dto.orderVersion,
        ]);
        await em.query(
          `UPDATE order_items oi SET stock_status=CASE WHEN l.shipped+l.cancelled=l.quantity AND l.shipped>0 THEN 'shipped' WHEN l.cancelled=l.quantity THEN 'released' ELSE 'reserved' END,
          fulfilled=(l.shipped+l.cancelled=l.quantity AND l.shipped>0) FROM motoark_order_lines l WHERE l.order_item_id=oi.id AND l.motoark_order_id=$1`,
          [order.id],
        );
        await em.query(
          `UPDATE orders SET status=CASE
          WHEN NOT EXISTS(SELECT 1 FROM motoark_order_lines WHERE motoark_order_id=$2 AND cancelled<>quantity) THEN 'cancelled'
          WHEN NOT EXISTS(SELECT 1 FROM motoark_order_lines WHERE motoark_order_id=$2 AND shipped+cancelled<>quantity) THEN 'shipped'
          ELSE 'processing' END, updated_at=now() WHERE id=$1`,
          [order.order_id, order.id],
        );
        await em.query(
          `UPDATE motoark_order_events SET status='applied',attempts=attempts+1,last_error=NULL,applied_at=clock_timestamp(),
          result=$2 WHERE id=$1`,
          [
            id,
            {
              orderId: order.order_id,
              externalOrderId: dto.externalOrderId,
              orderVersion: dto.orderVersion,
              stockApplied: true,
              quantityPath: '/api/integrations/motoark/quantities/{listingId}',
              channelSynchronization: 'asynchronous',
            },
          ],
        );
      });
      if (org && items.length)
        this.ledger.emitChanged(
          org,
          [...new Set(items)].map((itemId) => ({ itemId })),
        );
    } catch (error) {
      const err = error as Error & { code?: string; status?: number };
      const pending =
        error instanceof PendingEvent ||
        err.status === 409 ||
        !(error instanceof BadRequestException) ||
        err.message.startsWith('Insufficient mapped warehouse stock');
      const message =
        error instanceof PendingEvent || error instanceof BadRequestException
          ? err.message
          : 'Temporary stock/database processing failure';
      this.logger.warn(`MotoArk event ${id}: ${err.message}`);
      await this.db.query(
        `UPDATE motoark_order_events SET status=$2,attempts=attempts+1,last_error=$3,
        next_attempt_at=now()+make_interval(secs=>LEAST(3600,15*power(2,LEAST(attempts,8)))::int)
        WHERE id=$1 AND status NOT IN ('applied','rejected')`,
        [id, pending ? 'pending' : 'rejected', message.slice(0, 1000)],
      );
    }
  }

  private async purchase(
    em: EntityManager,
    event: { organization_id: string; store_id: string },
    dto: MotoarkOrderEventDto,
  ) {
    const mapped: Array<{
      input: NonNullable<MotoarkOrderEventDto['lines']>[number];
      item: {
        id: string;
        sku: string;
        title: string;
        listing_record_id: string | null;
      };
      title: string;
    }> = [];
    for (const input of dto.lines!) {
      const [p] = await em.query<MotoarkListingRow[]>(
        `SELECT * FROM ebay_published_listings WHERE id=$1 AND organization_id=$2 AND store_id=$3`,
        [input.listingId, event.organization_id, event.store_id],
      );
      if (!p)
        throw new BadRequestException(
          'Listing does not belong to the authorized Primemotive store',
        );
      if (p.is_test_listing || p.ebay_item_id?.startsWith('SIM-'))
        throw new BadRequestException(
          'Mirror-only synthetic listings cannot create stock transactions',
        );
      if (p.listing_status !== 'active' && p.listing_status !== 'out_of_stock')
        throw new BadRequestException(
          'Listing is no longer eligible for an external purchase',
        );
      const candidates = await em.query<Array<{ id: string }>>(
        `SELECT id FROM inventory_items WHERE organization_id=$1 AND status='active'
        AND ((($2::uuid IS NOT NULL) AND catalog_product_id=$2) OR (sku=$3 AND NOT EXISTS(SELECT 1 FROM inventory_items preferred
          WHERE preferred.organization_id=$1 AND preferred.status='active' AND preferred.catalog_product_id=$2))) LIMIT 2`,
        [event.organization_id, p.catalog_product_id, p.sku],
      );
      if (!candidates.length)
        throw new PendingEvent('Listing has no active inventory item mapping');
      if (candidates.length !== 1)
        throw new PendingEvent('Listing inventory mapping is ambiguous');
      const item = await em
        .getRepository(InventoryItem)
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
    const subtotal = dto.lines!.reduce(
      (n, x) => n + cents(x.unitPrice!) * BigInt(x.quantity),
      0n,
    );
    const total =
      subtotal +
      cents(dto.shippingAmount ?? '0.00') +
      cents(dto.taxAmount ?? '0.00');
    if (total > 9999999999n)
      throw new BadRequestException(
        'Order total exceeds supported monetary range',
      );
    const [generic] = await em.query<Array<{ id: string }>>(
      `INSERT INTO orders(channel,store_id,external_order_id,status,subtotal,shipping_cost,tax_amount,total_amount,currency,ordered_at,paid_at)
      VALUES('motoark',$1,$2,'processing',$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
      [
        event.store_id,
        `ma:${payloadHash([event.organization_id, dto.externalOrderId])}`,
        money(subtotal),
        dto.shippingAmount ?? '0.00',
        dto.taxAmount ?? '0.00',
        money(total),
        dto.currency,
        dto.occurredAt,
      ],
    );
    const [order] = await em.query<MotoarkOrderRow[]>(
      `INSERT INTO motoark_orders(organization_id,store_id,external_order_id,order_id,currency,total_amount) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        event.organization_id,
        event.store_id,
        dto.externalOrderId,
        generic.id,
        dto.currency,
        money(total),
      ],
    );
    for (const { input, item, title } of mapped) {
      const [line] = await em.query<Array<{ id: string }>>(
        `INSERT INTO order_items(order_id,listing_id,external_item_id,sku,title,quantity,unit_price,total_price,inventory_item_id,stock_status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'reserved') RETURNING id`,
        [
          generic.id,
          item.listing_record_id,
          input.externalLineId,
          item.sku,
          title,
          input.quantity,
          input.unitPrice,
          money(cents(input.unitPrice!) * BigInt(input.quantity)),
          item.id,
        ],
      );
      await em.query(
        `INSERT INTO motoark_order_lines(motoark_order_id,external_line_id,listing_id,inventory_item_id,order_item_id,quantity) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          order.id,
          input.externalLineId,
          input.listingId,
          item.id,
          line.id,
          input.quantity,
        ],
      );
    }
    return order;
  }

  private async assertScope(org: string, user: User) {
    const id = await this.listings.resolvePrimemotiveStoreId(org);
    if (
      !user.storeAccessAll &&
      !(await this.stores.getAccessibleStoreIds(user)).has(id)
    )
      throw new ForbiddenException('Primemotive store access is required');
    return id;
  }

  private validate(dto: MotoarkOrderEventDto) {
    if (dto.eventType === 'refund.completed') {
      if (!dto.refundId || !dto.amount || cents(dto.amount) <= 0n)
        throw new BadRequestException(
          'Refund ID and a positive decimal amount are required',
        );
      if (dto.lines?.length)
        throw new BadRequestException(
          'Refund is a financial event; do not specify stock quantities',
        );
    } else if (!dto.lines?.length)
      throw new BadRequestException('Order lines are required');
    if (
      dto.eventType === 'order.paid' &&
      dto.lines?.some((l) => !l.listingId || !l.unitPrice)
    )
      throw new BadRequestException(
        'Purchase lines require listingId and unitPrice',
      );
    if (dto.eventType.startsWith('return.') && !dto.returnId)
      throw new BadRequestException('Return events require returnId');
    if (dto.eventType !== 'order.paid' && (dto.shippingAmount || dto.taxAmount))
      throw new BadRequestException(
        'Order charges can only be supplied on the original purchase',
      );
  }
}
