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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const order_entity_js_1 = require("./entities/order.entity.js");
const order_item_entity_js_1 = require("./entities/order-item.entity.js");
const order_state_machine_js_1 = require("./order-state-machine.js");
let OrdersService = OrdersService_1 = class OrdersService {
    orderRepo;
    itemRepo;
    eventEmitter;
    logger = new common_1.Logger(OrdersService_1.name);
    constructor(orderRepo, itemRepo, eventEmitter) {
        this.orderRepo = orderRepo;
        this.itemRepo = itemRepo;
        this.eventEmitter = eventEmitter;
    }
    async findAll(dto) {
        const qb = this.orderRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.connection', 'conn');
        if (dto.status) {
            qb.andWhere('o.status = :status', { status: dto.status });
        }
        if (dto.channel) {
            qb.andWhere('o.channel = :channel', { channel: dto.channel });
        }
        if (dto.storeId) {
            qb.andWhere('o.store_id = :storeId', { storeId: dto.storeId });
        }
        if (dto.since) {
            qb.andWhere('o.ordered_at >= :since', { since: new Date(dto.since) });
        }
        if (dto.until) {
            qb.andWhere('o.ordered_at <= :until', { until: new Date(dto.until) });
        }
        if (dto.search) {
            qb.andWhere('(o.buyer_email ILIKE :search OR o.buyer_name ILIKE :search OR o.external_order_id ILIKE :search)', { search: `%${dto.search}%` });
        }
        qb.orderBy('o.ordered_at', 'DESC')
            .take(dto.limit ?? 50)
            .skip(dto.offset ?? 0);
        const [orders, total] = await qb.getManyAndCount();
        return { orders, total };
    }
    async findOne(id) {
        const order = await this.orderRepo.findOne({
            where: { id },
            relations: ['connection'],
        });
        if (!order)
            throw new common_1.NotFoundException(`Order ${id} not found`);
        const items = await this.itemRepo.find({
            where: { orderId: id },
            order: { createdAt: 'ASC' },
        });
        return { order, items };
    }
    async getStats() {
        const result = await this.orderRepo
            .createQueryBuilder('o')
            .select('o.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('o.status')
            .getRawMany();
        const stats = {};
        for (const s of order_state_machine_js_1.ALL_ORDER_STATUSES)
            stats[s] = 0;
        for (const row of result)
            stats[row.status] = parseInt(row.count, 10);
        return stats;
    }
    async transitionStatus(id, newStatus, reason) {
        const order = await this.orderRepo.findOneBy({ id });
        if (!order)
            throw new common_1.NotFoundException(`Order ${id} not found`);
        this.assertLifecycleOwner(order);
        if (!(0, order_state_machine_js_1.canTransition)(order.status, newStatus)) {
            throw new common_1.BadRequestException(`Cannot transition from '${order.status}' to '${newStatus}'. ` +
                `Valid transitions: ${(0, order_state_machine_js_1.getValidTransitions)(order.status).join(', ') || 'none (terminal state)'}`);
        }
        const oldStatus = order.status;
        order.status = newStatus;
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
        if (newStatus === 'shipped') {
            this.eventEmitter.emit('order.shipped', {
                orderId: order.id,
                channel: order.channel,
                trackingNumber: order.trackingNumber,
                shippedAt: order.shippedAt,
            });
        }
        if (newStatus === 'cancelled') {
            this.eventEmitter.emit('order.cancelled', {
                orderId: order.id,
                channel: order.channel,
                reason: reason ?? null,
            });
        }
        return order;
    }
    async updateShipping(id, dto) {
        const order = await this.orderRepo.findOneBy({ id });
        if (!order)
            throw new common_1.NotFoundException(`Order ${id} not found`);
        this.assertLifecycleOwner(order);
        order.trackingNumber = dto.trackingNumber;
        if (dto.trackingCarrier)
            order.trackingCarrier = dto.trackingCarrier;
        if (dto.shippingMethod)
            order.shippingMethod = dto.shippingMethod;
        if (order.status === 'processing' || order.status === 'confirmed') {
            order.status = 'shipped';
            order.shippedAt = new Date();
        }
        await this.orderRepo.save(order);
        this.logger.log(`Order ${id}: tracking updated → ${dto.trackingNumber}`);
        if (order.status === 'shipped') {
            this.eventEmitter.emit('order.shipped', {
                orderId: order.id,
                channel: order.channel,
                trackingNumber: order.trackingNumber,
                shippedAt: order.shippedAt,
            });
        }
        return order;
    }
    async processRefund(id, dto) {
        const order = await this.orderRepo.findOneBy({ id });
        if (!order)
            throw new common_1.NotFoundException(`Order ${id} not found`);
        this.assertLifecycleOwner(order);
        if (!(0, order_state_machine_js_1.canTransition)(order.status, 'refund_requested') &&
            order.status !== 'refund_requested') {
            throw new common_1.BadRequestException(`Cannot refund order in '${order.status}' state`);
        }
        const refundAmt = parseFloat(dto.amount);
        if (isNaN(refundAmt) || refundAmt <= 0) {
            throw new common_1.BadRequestException('Invalid refund amount');
        }
        const totalAmt = parseFloat(order.totalAmount);
        if (refundAmt > totalAmt) {
            throw new common_1.BadRequestException(`Refund amount $${refundAmt} exceeds order total $${totalAmt}`);
        }
        order.refundAmount = dto.amount;
        order.refundReason = dto.reason ?? null;
        order.status = 'refunded';
        order.refundedAt = new Date();
        await this.orderRepo.save(order);
        this.logger.log(`Order ${id}: refunded $${dto.amount}`);
        return order;
    }
    assertLifecycleOwner(order) {
        if (order.channel === 'motoark')
            throw new common_1.BadRequestException('MotoArk orders must be updated through the signed MotoArk order-events contract');
    }
    async importOrder(data) {
        const existing = await this.orderRepo.findOne({
            where: { channel: data.channel, externalOrderId: data.externalOrderId },
        });
        if (existing)
            return existing;
        const order = this.orderRepo.create({
            channel: data.channel,
            connectionId: data.connectionId ?? null,
            storeId: data.storeId ?? null,
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
        const savedOrder = await this.orderRepo.manager.transaction(async (em) => {
            const saved = await em.getRepository(order_entity_js_1.Order).save(order);
            const lines = data.items.map((item) => this.itemRepo.create({
                orderId: saved.id,
                listingId: item.listingId ?? null,
                externalItemId: item.externalItemId ?? null,
                externalListingId: item.externalListingId ?? null,
                sku: item.sku ?? null,
                title: item.title,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: (item.quantity * parseFloat(item.unitPrice)).toFixed(2),
            }));
            if (lines.length)
                await em.getRepository(order_item_entity_js_1.OrderItem).save(lines);
            return saved;
        });
        this.logger.log(`Imported order ${savedOrder.id} from ${data.channel}:${data.externalOrderId} (${data.items.length} items)`);
        this.eventEmitter.emit('order.new', {
            orderId: savedOrder.id,
            storeId: savedOrder.storeId,
            channel: savedOrder.channel,
            total: savedOrder.totalAmount,
        });
        return savedOrder;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_js_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(order_item_entity_js_1.OrderItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], OrdersService);
//# sourceMappingURL=orders.service.js.map