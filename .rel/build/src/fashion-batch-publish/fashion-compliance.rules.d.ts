export type ComplianceDecision = 'PASS' | 'AUTO_FIXED' | 'NEEDS_REVIEW' | 'BLOCKED';
export type IssueSeverity = 'info' | 'warn' | 'review' | 'block';
export type IssueField = 'title' | 'description' | 'brand' | 'price' | 'images' | 'category';
export interface ComplianceIssue {
    code: string;
    severity: IssueSeverity;
    message: string;
    field?: IssueField;
    evidence?: string;
    imageIndex?: number;
    autoFixed?: boolean;
    source?: 'text' | 'vision' | 'image';
}
export interface ComplianceFix {
    field: 'title' | 'brand' | 'images';
    before: unknown;
    after: unknown;
    reason: string;
}
export interface ProtectedBrand {
    name: string;
    aliases?: string[];
    priceFloor?: number;
}
export interface AuthenticityGuaranteeRule {
    label: string;
    categoryIds?: string[];
    categoryKeywords?: string[];
    minPrice: number;
}
export interface FashionComplianceConfig {
    blockTerms: string[];
    blockTermExceptions: string[];
    reviewPhrases: string[];
    fillerTerms: string[];
    protectedBrands: ProtectedBrand[];
    knownBrands: string[];
    ambiguousBrands: string[];
    authenticityGuarantee: AuthenticityGuaranteeRule[];
}
export interface ComplianceListing {
    title: string;
    description: string | null;
    brand: string | null;
    brandSpecific: string | null;
    price: number | null;
    categoryId: string | null;
    categoryName: string | null;
}
export interface TextCheckResult {
    issues: ComplianceIssue[];
    fixes: ComplianceFix[];
    fixed: ComplianceListing;
    declaredBrand: string | null;
    authenticityGuarantee: string | null;
}
export declare const EBAY_TITLE_MAX = 80;
export declare const DEFAULT_FASHION_COMPLIANCE_CONFIG: FashionComplianceConfig;
export declare function mergeComplianceConfig(override: Partial<FashionComplianceConfig> | null | undefined): FashionComplianceConfig;
export declare function normalizeText(value: string | null | undefined): string;
export declare function findPhrase(text: string, phrase: string): string | null;
export declare function tidyTitle(title: string): string;
export declare function checkListingText(listing: ComplianceListing, config?: FashionComplianceConfig): TextCheckResult;
export declare function riskScore(issues: ComplianceIssue[]): number;
export declare function decide(issues: ComplianceIssue[]): ComplianceDecision;
