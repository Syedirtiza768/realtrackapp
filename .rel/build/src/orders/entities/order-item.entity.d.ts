import { Order } from './order.entity.js';
export declare class OrderItem {
    id: string;
    orderId: string;
    order: Order;
    listingId: string | null;
    externalItemId: string | null;
    externalListingId: string | null;
    sku: string | null;
    title: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    fulfilled: boolean;
    inventoryItemId: string | null;
    stockStatus: string | null;
    createdAt: Date;
}
