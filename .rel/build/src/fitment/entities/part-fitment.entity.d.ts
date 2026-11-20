import { ListingRecord } from '../../listings/listing-record.entity.js';
import { FitmentMake } from './fitment-make.entity.js';
import { FitmentModel } from './fitment-model.entity.js';
import { FitmentSubmodel } from './fitment-submodel.entity.js';
import { FitmentEngine } from './fitment-engine.entity.js';
export type FitmentSource = 'manual' | 'aces_import' | 'ai_detected' | 'bulk_import';
export declare class PartFitment {
    id: string;
    listingId: string;
    listing?: ListingRecord;
    makeId: number;
    make?: FitmentMake;
    modelId: number;
    model?: FitmentModel;
    submodelId: number | null;
    submodel?: FitmentSubmodel;
    yearStart: number;
    yearEnd: number;
    engineId: number | null;
    engine?: FitmentEngine;
    source: FitmentSource;
    confidence: number | null;
    verified: boolean;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    notes: string | null;
    createdAt: Date;
}
