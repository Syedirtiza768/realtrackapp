import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ExtractedAttribute, CorrectionRule } from '../entities';
export interface VisionExtractionResult {
    extractedBrand: string | null;
    extractedMpn: string | null;
    extractedOemNumber: string | null;
    extractedProductType: string | null;
    extractedProductFamily: string | null;
    extractedPlacement: string | null;
    extractedMaterial: string | null;
    extractedFinish: string | null;
    extractedCondition: string | null;
    extractedQuantity: string | null;
    extractedSideOrientation: string | null;
    extractedFrontRear: string | null;
    extractedDimensions: Record<string, any> | null;
    extractedFeatures: string[] | null;
    extractedFitmentRaw: any[] | null;
    visibleTextLines: string[] | null;
    packagingIdentifiers: string[] | null;
    confidenceScores: Record<string, number>;
    rawOcrText: string | null;
}
export declare class VisionExtractionService {
    private readonly extractedAttrRepo;
    private readonly correctionRuleRepo;
    private readonly configService;
    private readonly logger;
    private openai;
    constructor(extractedAttrRepo: Repository<ExtractedAttribute>, correctionRuleRepo: Repository<CorrectionRule>, configService: ConfigService);
    extractFromImages(motorsProductId: string, imageUrls: string[]): Promise<ExtractedAttribute>;
    extractMpnFromText(motorsProductId: string, text: string): Promise<ExtractedAttribute>;
    extractFromSupplierData(motorsProductId: string, supplierData: Record<string, any>): Promise<ExtractedAttribute>;
    getExtractions(motorsProductId: string): Promise<ExtractedAttribute[]>;
    private mapVisionResponse;
    private applyCorrections;
    private applyRulesToField;
    private escapeRegex;
}
