import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { EbayFulfillmentApiService } from '../channels/ebay/ebay-fulfillment-api.service.js';
import { OrdersService } from './orders.service.js';
export declare class OrderFulfillmentService {
    private readonly orderRepo;
    private readonly itemRepo;
    private readonly storeRepo;
    private readonly fulfillmentApi;
    private readonly ordersService;
    private readonly eventEmitter;
    private readonly logger;
    constructor(orderRepo: Repository<Order>, itemRepo: Repository<OrderItem>, storeRepo: Repository<Store>, fulfillmentApi: EbayFulfillmentApiService, ordersService: OrdersService, eventEmitter: EventEmitter2);
    markShipped(orderId: string, tracking: {
        carrier: string;
        trackingNumber: string;
    }): Promise<Order>;
    bulkShip(items: Array<{
        orderId: string;
        trackingNumber: string;
        carrier: string;
    }>): Promise<{
        orderId: string;
        success: boolean;
        error?: string;
    }[]>;
    bulkCancel(orderIds: string[], reason?: string): Promise<{
        orderId: string;
        success: boolean;
        error?: string;
    }[]>;
    processTrackingCsv(csvContent: string): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
        errors: Array<{
            row: number;
            orderId: string;
            error: string;
        }>;
    }>;
}
