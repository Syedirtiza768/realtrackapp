export declare class ShippingProfile {
    id: string;
    name: string;
    carrier: string;
    service: string;
    handlingTime: number;
    costType: 'flat' | 'calculated' | 'free';
    flatCost: string | null;
    weightBased: boolean;
    domesticOnly: boolean;
    isDefault: boolean;
    active: boolean;
    createdAt: Date;
}
