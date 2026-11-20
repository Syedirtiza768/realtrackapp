import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { CatalogProduct } from '../entities/catalog-product.entity.js';
import { ComplianceAuditService } from './compliance-audit.service.js';
import { AiRunLogService } from '../../common/openai/ai-run-log.service.js';
export type ComplianceSeverity = 'error' | 'warning' | 'info';
export interface ComplianceIssue {
    code: string;
    field: string;
    message: string;
    severity: ComplianceSeverity;
    suggestion?: string;
    autoFixed?: boolean;
    originalValue?: string;
    fixedValue?: string;
}
export interface ComplianceResult {
    productId: string;
    sku: string | null;
    compliant: boolean;
    complianceScore: number;
    issues: ComplianceIssue[];
    autoCorrections: ComplianceIssue[];
    categoryValidation: CategoryValidationResult;
    titleOptimization: TitleOptimizationResult;
    descriptionEnhancement: DescriptionEnhancementResult;
    fitmentValidation: FitmentValidationResult;
    imageCompliance: ImageComplianceResult;
    pricingValidation: PricingValidationResult;
    itemSpecifics: ItemSpecificsResult;
}
export interface CategoryValidationResult {
    valid: boolean;
    suggestedCategoryId: string | null;
    suggestedCategoryName: string | null;
    confidence: number;
    issues: ComplianceIssue[];
}
export interface TitleOptimizationResult {
    originalTitle: string;
    optimizedTitle: string;
    applied: boolean;
    lengthOk: boolean;
    seoScore: number;
    issues: ComplianceIssue[];
}
export interface DescriptionEnhancementResult {
    hasDescription: boolean;
    enhanced: boolean;
    enhancedDescription: string | null;
    issues: ComplianceIssue[];
}
export interface FitmentValidationResult {
    hasFitment: boolean;
    valid: boolean;
    normalized: boolean;
    vehicleCount: number;
    issues: ComplianceIssue[];
}
export interface ImageComplianceResult {
    hasImages: boolean;
    imageCount: number;
    valid: boolean;
    issues: ComplianceIssue[];
}
export interface PricingValidationResult {
    hasPrice: boolean;
    valid: boolean;
    issues: ComplianceIssue[];
}
export interface ItemSpecificsResult {
    totalRequired: number;
    totalPresent: number;
    coveragePercent: number;
    missingRequired: string[];
    autoFilled: Array<{
        field: string;
        value: string;
    }>;
    issues: ComplianceIssue[];
}
export interface BatchComplianceResult {
    totalRecords: number;
    compliantRecords: number;
    nonCompliantRecords: number;
    autoFixedRecords: number;
    averageComplianceScore: number;
    results: ComplianceResult[];
    summary: {
        errorCount: number;
        warningCount: number;
        infoCount: number;
        totalAutoCorrections: number;
        topIssues: Array<{
            code: string;
            count: number;
        }>;
    };
}
export declare class EbayComplianceService {
    private readonly productRepo;
    private readonly openai;
    private readonly config;
    private readonly auditService;
    private readonly aiRunLogService;
    private readonly logger;
    constructor(productRepo: Repository<CatalogProduct>, openai: OpenAiService, config: ConfigService, auditService: ComplianceAuditService, aiRunLogService: AiRunLogService);
    recordPublishOutcome(sku: string, published: boolean, publishError?: string, ebayCategoryId?: string): Promise<void>;
    validateBatch(productIds: string[], autoFix?: boolean): Promise<BatchComplianceResult>;
    validateProduct(productId: string, autoFix?: boolean): Promise<ComplianceResult>;
    validateImportProducts(importId: string, autoFix?: boolean, limit?: number): Promise<BatchComplianceResult>;
    validateRowData(data: Record<string, string>): {
        compliant: boolean;
        errors: string[];
        warnings: string[];
        autoCorrections: Array<{
            field: string;
            original: string;
            corrected: string;
        }>;
    };
    private inferBrandFromTitle;
    private validateUpcCheckDigit;
    private logComplianceAudit;
    private validateCategory;
    private suggestCategory;
    private validateItemSpecifics;
    private autoFillSpecifics;
    private validateAndOptimizeTitle;
    private calculateTitleSeoScore;
    private generateOptimizedTitle;
    private validateDescription;
    private generateDescription;
    private validateFitment;
    private validateImages;
    private validatePricing;
    private calculateComplianceScore;
    private applyAutoCorrections;
    private createErrorResult;
}
