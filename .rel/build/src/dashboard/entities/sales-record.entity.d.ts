export declare class SalesRecord {
    id: string;
    orderId: string | null;
    listingId: string;
    channel: string;
    storeId: string | null;
    quantitySold: number;
    salePrice: string;
    currency: string;
    marketplaceFee: string | null;
    netRevenue: string | null;
    soldAt: Date;
}
