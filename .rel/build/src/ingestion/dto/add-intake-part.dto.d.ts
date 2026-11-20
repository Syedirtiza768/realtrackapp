export declare const INTAKE_PART_TYPES: readonly ["OEM", "Aftermarket", "Salvage"];
export type IntakePartType = (typeof INTAKE_PART_TYPES)[number];
export declare const INTAKE_CONDITION_IDS: readonly ["1000", "3000"];
export declare class AddIntakePartDto {
    sku?: string;
    partNumber: string;
    brand: string;
    partType: IntakePartType;
    conditionId: string;
    vehicleMake?: string;
    price: number;
    quantity?: number;
    imageUrls?: string[];
    uploadedAssetIds?: string[];
    title?: string;
    categoryName?: string;
    description?: string;
    teamId?: string;
    location?: string;
    weight?: number;
}
