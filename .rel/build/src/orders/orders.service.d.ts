import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import type { OrdersQueryDto, UpdateShippingDto, RefundDto } from './dto/orders.dto.js';
export declare class OrdersService {
    private readonly orderRepo;
    private readonly itemRepo;
    private readonly eventEmitter;
    private readonly logger;
    constructor(orderRepo: Repository<Order>, itemRepo: Repository<OrderItem>, eventEmitter: EventEmitter2);
    findAll(dto: OrdersQueryDto): Promise<{
        orders: Order[];
        total: number;
    }>;
    findOne(id: string): Promise<{
        order: Order;
        items: OrderItem[];
    }>;
    getStats(): Promise<Record<string, number>>;
    transitionStatus(id: string, newStatus: string, reason?: string): Promise<Order>;
    updateShipping(id: string, dto: UpdateShippingDto): Promise<Order>;
    processRefund(id: string, dto: RefundDto): Promise<Order>;
    private assertLifecycleOwner;
    importOrder(data: {
        channel: string;
        connectionId?: string;
        storeId?: string;
        externalOrderId: string;
        externalUrl?: string;
        buyer?: {
            username?: string;
            email?: string;
            name?: string;
        };
        shipping?: Record<string, string>;
        financials: {
            subtotal: string;
            shippingCost?: string;
            tax?: string;
            total: string;
            currency?: string;
            fee?: string;
        };
        items: Array<{
            externalItemId?: string;
            externalListingId?: string;
            listingId?: string;
            sku?: string;
            title: string;
            quantity: number;
            unitPrice: string;
        }>;
        orderedAt?: Date;
    }): Promise<Order>;
}
