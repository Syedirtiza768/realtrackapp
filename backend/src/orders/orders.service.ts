import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { canTransition, getValidTransitions, ALL_ORDER_STATUSES } from './order-state-machine.js';
import type { OrdersQueryDto, UpdateShippingDto, RefundDto } from './dto/orders.dto.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
  ) {}

  // ─── Queries ───

  async findAll(dto: OrdersQueryDto): Promise<{ orders: Order[]; total: number }> {
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.connection', 'conn');

    if (dto.status) {
      qb.andWhere('o.status = :status', { status: dto.status });
    }
    if (dto.channel) {
      qb.andWhere('o.channel = :channel', { channel: dto.channel });
    }
    if (dto.since) {
      qb.andWhere('o.ordered_at >= :since', { since: new Date(dto.since) });
    }
    if (dto.until) {
      qb.andWhere('o.ordered_at <= :until', { until: new Date(dto.until) });
    }
    if (dto.search) {
      qb.andWhere(
        '(o.buyer_email ILIKE :search OR o.buyer_name ILIKE :search OR o.external_order_id ILIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    qb.orderBy('o.ordered_at', 'DESC')
      .take(dto.limit ?? 50)
      .skip(dto.offset ?? 0);

    const [orders, total] = await qb.getManyAndCount();
    return { orders, total };
  }

  async findOne(id: string): Promise<{ order: Order; items: OrderItem[] }> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['connection'],
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const items = await this.itemRepo.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });

    return { order, items };
  }

  async getStats(): Promise<Record<string, number>> {
    const result = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.status')
      .getRawMany();

    const stats: Record<string, number> = {};
    for (const s of ALL_ORDER_STATUSES) stats[s] = 0;
    for (const row of result) stats[row.status] = parseInt(row.count, 10);
    return stats;
  }

  // ─── State transitions ───

  async transitionStatus(id: string, newStatus: string, reason?: string): Promise<Order> {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    if (!canTransition(order.status, newStatus)) {
      throw new BadRequestException(
        `Cannot transition from '${order.status}' to '${newStatus}'. ` +
        `Valid transitions: ${getValidTransitions(order.status).join(', ') || 'none (terminal state)'}`,
      );
    }

    const oldStatus = order.status;
    order.status = newStatus;

    // Apply side effects
    switch (newStatus) {
      case 'shipped':
        order.shippedAt = order.shippedAt ?? new Date();
        break;
      case 'delivered':
        order.deliveredAt = new Date();
        break;
      case 'cancelled':
        order.cancelledAt = new Date();
        break;
      case 'refunded':
        order.refundedAt = new Date();
        break;
    }

    await this.orderRepo.save(order);
    this.logger.log(`Order ${id}: ${oldStatus} → ${newStatus}${reason ? ` (${reason})` : ''}`);
    return order;
  }

  async updateShipping(id: string, dto: UpdateShippingDto): Promise<Order> {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    order.trackingNumber = dto.trackingNumber;
    if (dto.trackingCarrier) order.trackingCarrier = dto.trackingCarrier;
    if (dto.shippingMethod) order.shippingMethod = dto.shippingMethod;

    // Auto-transition to shipped if currently processing
    if (order.status === 'processing' || order.status === 'confirmed') {
      order.status = 'shipped';
      order.shippedAt = new Date();
    }

    await this.orderRepo.save(order);
    this.logger.log(`Order ${id}: tracking updated → ${dto.trackingNumber}`);
    return order;
  }

  async processRefund(id: string, dto: RefundDto): Promise<Order> {
    const order = await this.orderRepo.findOneBy({ id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    // Must be in a refundable state
    if (!canTransition(order.status, 'refund_requested') && order.status !== 'refund_requested') {
      throw new BadRequestException(`Cannot refund order in '${order.status}' state`);
    }

    const refundAmt = parseFloat(dto.amount);
    if (isNaN(refundAmt) || refundAmt <= 0) {
      throw new BadRequestException('Invalid refund amount');
    }

    const totalAmt = parseFloat(order.totalAmount);
    if (refundAmt > totalAmt) {
      throw new BadRequestException(`Refund amount $${refundAmt} exceeds order total $${totalAmt}`);
    }

    order.refundAmount = dto.amount;
    order.refundReason = dto.reason ?? null;
    order.status = 'refunded';
    order.refundedAt = new Date();

    await this.orderRepo.save(order);
    this.logger.log(`Order ${id}: refunded $${dto.amount}`);
    return order;
  }

  // ─── Import from marketplace ───

  async importOrder(data: {
    channel: string;
    connectionId?: string;
    externalOrderId: string;
    externalUrl?: string;
    buyer?: { username?: string; email?: string; name?: string };
    shipping?: Record<string, string>;
    financials: { subtotal: string; shippingCost?: string; tax?: string; total: string; currency?: string; fee?: string };
    items: Array<{ externalItemId?: string; listingId?: string; sku?: string; title: string; quantity: number; unitPrice: string }>;
    orderedAt?: Date;
  }): Promise<Order> {
    // Idempotency: check if order already exists
    const existing = await this.orderRepo.findOne({
      where: { channel: data.channel, externalOrderId: data.externalOrderId },
    });
    if (existing) return existing;

    const order = this.orderRepo.create({
      channel: data.channel,
      connectionId: data.connectionId ?? null,
      externalOrderId: data.externalOrderId,
      externalUrl: data.externalUrl ?? null,
      status: 'pending',
      buyerUsername: data.buyer?.username ?? null,
      buyerEmail: data.buyer?.email ?? null,
      buyerName: data.buyer?.name ?? null,
      shippingName: data.shipping?.name ?? null,
      shippingAddress1: data.shipping?.address1 ?? null,
      shippingAddress2: data.shipping?.address2 ?? null,
      shippingCity: data.shipping?.city ?? null,
      shippingState: data.shipping?.state ?? null,
      shippingZip: data.shipping?.zip ?? null,
      shippingCountry: data.shipping?.country ?? null,
      subtotal: data.financials.subtotal,
      shippingCost: data.financials.shippingCost ?? '0',
      taxAmount: data.financials.tax ?? '0',
      totalAmount: data.financials.total,
      currency: data.financials.currency ?? 'USD',
      marketplaceFee: data.financials.fee ?? '0',
      orderedAt: data.orderedAt ?? new Date(),
    });

    const savedOrder = await this.orderRepo.save(order);

    // Create order items
    for (const item of data.items) {
      const totalPrice = (item.quantity * parseFloat(item.unitPrice)).toFixed(2);
      await this.itemRepo.save(
        this.itemRepo.create({
          orderId: savedOrder.id,
          listingId: item.listingId ?? null,
          externalItemId: item.externalItemId ?? null,
          sku: item.sku ?? null,
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice,
        }),
      );
    }

    this.logger.log(
      `Imported order ${savedOrder.id} from ${data.channel}:${data.externalOrderId} (${data.items.length} items)`,
    );
    return savedOrder;
  }
}
