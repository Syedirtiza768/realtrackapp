import { Repository } from 'typeorm';
import { MotorsProduct, ValidationResult, ValidationIssue, EbayCategoryMapping, EbayAspectRequirement } from '../entities';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { AiRunLogService } from '../../common/openai/ai-run-log.service.js';
export interface ComplianceCheckResult {
    publishable: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    infos: ValidationIssue[];
    overallComplianceScore: number;
    duplicateDetected: boolean;
    duplicateOfListingId?: string;
    duplicateMatchType?: string;
}
export declare class ComplianceEngineService {
    private readonly validationResultRepo;
    private readonly motorsProductRepo;
    private readonly categoryMappingRepo;
    private readonly aspectRequirementRepo;
    private readonly catalogProductRepo;
    private readonly aiRunLogService;
    private readonly logger;
    constructor(validationResultRepo: Repository<ValidationResult>, motorsProductRepo: Repository<MotorsProduct>, categoryMappingRepo: Repository<EbayCategoryMapping>, aspectRequirementRepo: Repository<EbayAspectRequirement>, catalogProductRepo: Repository<CatalogProduct>, aiRunLogService: AiRunLogService);
    validateProduct(motorsProductId: string): Promise<ValidationResult>;
    private validateCategory;
    private validateItemSpecifics;
    private validateFitment;
    private validateTitle;
    private validateHtml;
    private validateProhibitedClaims;
    private validateIdentity;
    private validateConfidence;
    private detectDuplicates;
    private calculateComplianceScore;
    private getAspectCoverage;
    private buildFullPayload;
}
