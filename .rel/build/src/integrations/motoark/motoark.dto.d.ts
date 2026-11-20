export declare const MOTOARK_EVENTS: readonly ["order.paid", "order.shipped", "order.cancelled", "return.requested", "return.received", "return.restocked", "return.disposed", "refund.completed"];
export type MotoarkEventType = (typeof MOTOARK_EVENTS)[number];
export declare class MotoarkLineDto {
    externalLineId: string;
    listingId?: string;
    quantity: number;
    unitPrice?: string;
    warehouseId?: string;
    locationId?: string;
    unitIds?: string[];
}
export declare class MotoarkOrderEventDto {
    schemaVersion: number;
    eventId: string;
    eventType: MotoarkEventType;
    occurredAt: string;
    externalOrderId: string;
    orderVersion: number;
    currency: string;
    lines?: MotoarkLineDto[];
    returnId?: string;
    refundId?: string;
    amount?: string;
    shippingAmount?: string;
    taxAmount?: string;
}
