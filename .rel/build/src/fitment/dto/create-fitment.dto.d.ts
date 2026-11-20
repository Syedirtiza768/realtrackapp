export declare class CreateFitmentDto {
    makeId: number;
    modelId: number;
    submodelId?: number;
    yearStart: number;
    yearEnd: number;
    engineId?: number;
    source?: string;
    confidence?: number;
    notes?: string;
}
export declare class VerifyFitmentDto {
    verified: boolean;
}
export declare class FitmentDetectionDto {
    listingId?: string;
    text?: string;
}
