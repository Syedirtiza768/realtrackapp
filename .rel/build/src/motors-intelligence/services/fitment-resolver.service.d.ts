import { Repository } from 'typeorm';
import { MotorsProduct, EbayCategoryMapping } from '../entities';
import { PartFitment } from '../../fitment/entities/part-fitment.entity';
import { FitmentMake } from '../../fitment/entities/fitment-make.entity';
import { FitmentModel } from '../../fitment/entities/fitment-model.entity';
import { FitmentService } from '../../fitment/fitment.service';
export interface FitmentRow {
    year?: string;
    yearStart?: number;
    yearEnd?: number;
    make: string;
    model: string;
    submodel?: string;
    engine?: string;
    notes?: string[];
}
export interface FitmentResolutionResult {
    resolved: boolean;
    fitmentRows: FitmentRow[];
    fitmentConfidence: number;
    compatibleVehicleSummary: string;
    errors: string[];
    warnings: string[];
}
export declare class FitmentResolverService {
    private readonly motorsProductRepo;
    private readonly categoryMappingRepo;
    private readonly partFitmentRepo;
    private readonly fitmentMakeRepo;
    private readonly fitmentModelRepo;
    private readonly fitmentService;
    private readonly logger;
    constructor(motorsProductRepo: Repository<MotorsProduct>, categoryMappingRepo: Repository<EbayCategoryMapping>, partFitmentRepo: Repository<PartFitment>, fitmentMakeRepo: Repository<FitmentMake>, fitmentModelRepo: Repository<FitmentModel>, fitmentService: FitmentService);
    resolveFitment(motorsProductId: string): Promise<FitmentResolutionResult>;
    private normalizeFitmentRows;
    private validateFitmentRow;
    private deduplicateRows;
    private generateCompatibilitySummary;
    private compactYearRange;
    private calculateFitmentConfidence;
    private normalizeString;
    private capitalizeWords;
}
