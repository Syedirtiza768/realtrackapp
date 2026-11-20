export declare class CompetitorPrice {
    id: string;
    masterProductId: string | null;
    partNumber: string;
    ebayItemId: string | null;
    title: string | null;
    seller: string | null;
    price: number;
    currency: string;
    condition: string | null;
    quantityAvailable: number | null;
    quantitySold: number | null;
    capturedAt: Date;
    createdAt: Date;
}
