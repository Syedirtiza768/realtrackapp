export declare class OrdersQueryDto {
    status?: string;
    channel?: string;
    storeId?: string;
    since?: string;
    until?: string;
    search?: string;
    limit?: number;
    offset?: number;
}
export declare class UpdateOrderStatusDto {
    status: string;
    reason?: string;
}
export declare class UpdateShippingDto {
    trackingNumber: string;
    trackingCarrier?: string;
    shippingMethod?: string;
}
export declare class RefundDto {
    amount: string;
    reason?: string;
}
export declare class BulkShipItemDto {
    orderId: string;
    trackingNumber: string;
    carrier: string;
}
export declare class BulkShipDto {
    items: BulkShipItemDto[];
}
export declare class BulkCancelDto {
    orderIds: string[];
    reason?: string;
}
export declare class CsvTrackingUploadDto {
    csvContent: string;
}
export declare class ManualImportDto {
    storeId?: string;
}
