import { EbayAuthService } from './ebay-auth.service.js';
import type { EbayOrderPage, EbayOrder, EbayShippingFulfillmentRequest, EbayFulfillment } from './ebay-api.types.js';
export declare class EbayFulfillmentApiService {
    private readonly auth;
    private readonly logger;
    private readonly http;
    constructor(auth: EbayAuthService);
    private authHeaders;
    getOrders(storeId: string, options?: {
        filter?: string;
        limit?: number;
        offset?: number;
        orderIds?: string[];
    }): Promise<EbayOrderPage>;
    getRecentOrders(storeId: string, sinceDate: Date, limit?: number): Promise<EbayOrder[]>;
    getOrder(storeId: string, orderId: string): Promise<EbayOrder>;
    createShippingFulfillment(storeId: string, orderId: string, fulfillment: EbayShippingFulfillmentRequest): Promise<{
        fulfillmentId: string;
    }>;
    getShippingFulfillments(storeId: string, orderId: string): Promise<EbayFulfillment[]>;
    getAwaitingShipmentCount(storeId: string): Promise<number>;
}
