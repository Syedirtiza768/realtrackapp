import { Repository } from 'typeorm';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';
export interface DetectedFitment {
    makeSlug: string;
    modelSlug: string;
    submodel?: string;
    yearStart: number;
    yearEnd: number;
    engineCode?: string;
    confidence: number;
}
export declare class FitmentMatcherService {
    private readonly makeRepo;
    private readonly modelRepo;
    private readonly engineRepo;
    private readonly logger;
    constructor(makeRepo: Repository<FitmentMake>, modelRepo: Repository<FitmentModel>, engineRepo: Repository<FitmentEngine>);
    detectFromText(text: string): Promise<DetectedFitment[]>;
    private fuzzyMatchMake;
    private fuzzyMatchModel;
    private calculateConfidence;
}
