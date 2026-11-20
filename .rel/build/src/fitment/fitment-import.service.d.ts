import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentSubmodel } from './entities/fitment-submodel.entity.js';
import { FitmentYear } from './entities/fitment-year.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';
export interface AcesVehicleRow {
    makeId?: number;
    makeName: string;
    modelName: string;
    submodelName?: string;
    yearStart: number;
    yearEnd: number;
    engineCode?: string;
    displacementL?: number;
    cylinders?: number;
    fuelType?: string;
    aspiration?: string;
}
export declare class FitmentImportService {
    private readonly makeRepo;
    private readonly modelRepo;
    private readonly submodelRepo;
    private readonly yearRepo;
    private readonly engineRepo;
    private readonly fitmentQueue;
    private readonly logger;
    constructor(makeRepo: Repository<FitmentMake>, modelRepo: Repository<FitmentModel>, submodelRepo: Repository<FitmentSubmodel>, yearRepo: Repository<FitmentYear>, engineRepo: Repository<FitmentEngine>, fitmentQueue: Queue);
    enqueueBulkImport(rows: AcesVehicleRow[], userId?: string): Promise<{
        jobId: string;
        rowCount: number;
    }>;
    processImportBatch(rows: AcesVehicleRow[]): Promise<{
        makesCreated: number;
        modelsCreated: number;
        submodelsCreated: number;
        yearsCreated: number;
        enginesCreated: number;
    }>;
    private slugify;
}
