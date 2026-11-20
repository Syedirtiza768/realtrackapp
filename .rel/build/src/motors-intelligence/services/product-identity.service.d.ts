import { Repository } from 'typeorm';
import { MotorsProduct, ProductCandidate, ExtractedAttribute, CorrectionRule } from '../entities';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity';
export interface IdentityResolutionResult {
    resolved: boolean;
    candidates: ProductCandidate[];
    winner: ProductCandidate | null;
    identityConfidence: number;
    requiresReview: boolean;
    reviewReasons: string[];
}
export declare class ProductIdentityService {
    private readonly motorsProductRepo;
    private readonly candidateRepo;
    private readonly extractedAttrRepo;
    private readonly catalogProductRepo;
    private readonly correctionRuleRepo;
    private readonly logger;
    constructor(motorsProductRepo: Repository<MotorsProduct>, candidateRepo: Repository<ProductCandidate>, extractedAttrRepo: Repository<ExtractedAttribute>, catalogProductRepo: Repository<CatalogProduct>, correctionRuleRepo: Repository<CorrectionRule>);
    resolveIdentity(motorsProductId: string): Promise<IdentityResolutionResult>;
    private mergeExtractionSignals;
    private deterministicResolution;
    private aiAssistedCandidateGeneration;
    private applyValidationGates;
    private applyWinnerToProduct;
    private computeCompositeScore;
    private normalizeMpn;
    private scoreBrandMatch;
    private scoreMpnSimilarity;
    private scoreProductTypeSimilarity;
    private roughSimilarity;
}
