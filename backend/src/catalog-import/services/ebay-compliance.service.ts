import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { CatalogProduct } from '../entities/catalog-product.entity.js';
import { ComplianceAuditService } from './compliance-audit.service.js';
import { AiRunLogService } from '../../common/openai/ai-run-log.service.js';

/* ── Types ─────────────────────────────────────────────────── */

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
  autoFilled: Array<{ field: string; value: string }>;
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
    topIssues: Array<{ code: string; count: number }>;
  };
}

/* ── eBay Required Item Specifics for Motors ───────────────── */

const REQUIRED_ITEM_SPECIFICS = [
  'Brand',
  'Manufacturer Part Number',
] as const;

const RECOMMENDED_ITEM_SPECIFICS = [
  'Interchange Part Number',
  'UPC',
  'Placement on Vehicle',
  'Fitment Type',
  'Warranty',
  'Country/Region of Manufacture',
  'Type',
  'Material',
] as const;

/* ── Title rules ───────────────────────────────────────────── */

const TITLE_MAX_LENGTH = 80;
const TITLE_FORBIDDEN_PATTERNS = [
  /\b(FREE SHIPPING|FREE S&H|FREE RETURNS)\b/gi,
  /\b(BEST PRICE|LOWEST PRICE|CHEAPEST)\b/gi,
  /\b(L@@K|LOOK|WOW|RARE FIND|MUST SEE|HOT)\b/gi,
  /!{2,}/g,
  /\*{2,}/g,
];

/* ── Condition map ─────────────────────────────────────────── */

const CONDITION_MAP: Record<string, string> = {
  '1000': 'New',
  '1500': 'New other',
  '1750': 'New with defects',
  '2000': 'Certified refurbished',
  '2500': 'Seller refurbished',
  '3000': 'Used',
  '7000': 'For parts or not working',
};

@Injectable()
export class EbayComplianceService {
  private readonly logger = new Logger(EbayComplianceService.name);

  constructor(
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    private readonly openai: OpenAiService,
    private readonly config: ConfigService,
    private readonly auditService: ComplianceAuditService,
    private readonly aiRunLogService: AiRunLogService,
  ) {}

  /** Feed eBay publish outcomes into the AI learning dataset. */
  async recordPublishOutcome(
    sku: string,
    published: boolean,
    publishError?: string,
    ebayCategoryId?: string,
  ): Promise<void> {
    await this.aiRunLogService.recordPublishOutcome(
      sku,
      published,
      publishError,
      ebayCategoryId,
    );
  }

  /**
   * Validate and optionally auto-correct a batch of catalog products.
   */
  async validateBatch(
    productIds: string[],
    autoFix = true,
  ): Promise<BatchComplianceResult> {
    const results: ComplianceResult[] = [];

    for (const productId of productIds) {
      try {
        const result = await this.validateProduct(productId, autoFix);
        results.push(result);
      } catch (err) {
        this.logger.warn(`Compliance check failed for ${productId}: ${err}`);
        results.push(this.createErrorResult(productId, String(err)));
      }
    }

    const compliantCount = results.filter((r) => r.compliant).length;
    const autoFixedCount = results.filter((r) => r.autoCorrections.length > 0).length;
    const allIssues = results.flatMap((r) => r.issues);

    // Count top issue codes
    const issueCounts = new Map<string, number>();
    for (const issue of allIssues) {
      issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
    }
    const topIssues = [...issueCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));

    return {
      totalRecords: results.length,
      compliantRecords: compliantCount,
      nonCompliantRecords: results.length - compliantCount,
      autoFixedRecords: autoFixedCount,
      averageComplianceScore: results.length > 0
        ? Math.round((results.reduce((sum, r) => sum + r.complianceScore, 0) / results.length) * 100) / 100
        : 0,
      results,
      summary: {
        errorCount: allIssues.filter((i) => i.severity === 'error').length,
        warningCount: allIssues.filter((i) => i.severity === 'warning').length,
        infoCount: allIssues.filter((i) => i.severity === 'info').length,
        totalAutoCorrections: results.reduce((sum, r) => sum + r.autoCorrections.length, 0),
        topIssues,
      },
    };
  }

  /**
   * Validate a single product for eBay Motors compliance.
   */
  async validateProduct(productId: string, autoFix = true): Promise<ComplianceResult> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) {
      return this.createErrorResult(productId, 'Product not found');
    }

    const issues: ComplianceIssue[] = [];
    const autoCorrections: ComplianceIssue[] = [];

    // 1. Category compliance
    const categoryValidation = await this.validateCategory(product);
    issues.push(...categoryValidation.issues);

    // 2. Item specifics enforcement
    const itemSpecifics = await this.validateItemSpecifics(product, autoFix);
    issues.push(...itemSpecifics.issues);
    if (autoFix && itemSpecifics.autoFilled.length > 0) {
      for (const fill of itemSpecifics.autoFilled) {
        autoCorrections.push({
          code: 'AUTO_FILL_SPECIFIC',
          field: fill.field,
          message: `Auto-filled missing item specific: ${fill.field} = ${fill.value}`,
          severity: 'info',
          autoFixed: true,
          fixedValue: fill.value,
        });
      }
    }

    // 3. Title optimization
    const titleOptimization = await this.validateAndOptimizeTitle(product, autoFix);
    issues.push(...titleOptimization.issues);
    if (titleOptimization.applied && titleOptimization.optimizedTitle !== titleOptimization.originalTitle) {
      autoCorrections.push({
        code: 'TITLE_OPTIMIZED',
        field: 'title',
        message: 'Title was optimized for eBay SEO',
        severity: 'info',
        autoFixed: true,
        originalValue: titleOptimization.originalTitle,
        fixedValue: titleOptimization.optimizedTitle,
      });
    }

    // 4. Description enhancement
    const descriptionResult = await this.validateDescription(product, autoFix);
    issues.push(...descriptionResult.issues);
    if (descriptionResult.enhanced) {
      autoCorrections.push({
        code: 'DESCRIPTION_ENHANCED',
        field: 'description',
        message: 'Description was enhanced with structured content',
        severity: 'info',
        autoFixed: true,
      });
    }

    // 5. Fitment validation
    const fitmentResult = this.validateFitment(product);
    issues.push(...fitmentResult.issues);

    // 6. Image compliance
    const imageResult = this.validateImages(product);
    issues.push(...imageResult.issues);

    // 7. Pricing & policy checks
    const pricingResult = this.validatePricing(product);
    issues.push(...pricingResult.issues);

    // Calculate compliance score
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    const complianceScore = this.calculateComplianceScore(errors.length, warnings.length);
    const compliant = errors.length === 0 && complianceScore >= 0.70;

    // Persist auto-corrections
    if (autoFix && autoCorrections.length > 0) {
      await this.applyAutoCorrections(product, autoCorrections, titleOptimization, descriptionResult, itemSpecifics);
    }

    // Log to compliance audit trail
    await this.logComplianceAudit(productId, product.importId, complianceScore, issues, autoCorrections);

    if (product.sku) {
      await this.aiRunLogService.recordComplianceOutcome(
        product.sku,
        complianceScore,
      );
    }

    return {
      productId,
      sku: product.sku,
      compliant,
      complianceScore,
      issues,
      autoCorrections,
      categoryValidation,
      titleOptimization,
      descriptionEnhancement: descriptionResult,
      fitmentValidation: fitmentResult,
      imageCompliance: imageResult,
      pricingValidation: pricingResult,
      itemSpecifics,
    };
  }

  /**
   * Validate all products from a specific import.
   * Only compliant or auto-corrected records pass; non-compliant are flagged.
   */
  async validateImportProducts(
    importId: string,
    autoFix = true,
    limit = 500,
  ): Promise<BatchComplianceResult> {
    const products = await this.productRepo.find({
      where: { importId },
      take: limit,
      order: { createdAt: 'ASC' },
    });

    if (products.length === 0) {
      return {
        totalRecords: 0,
        compliantRecords: 0,
        nonCompliantRecords: 0,
        autoFixedRecords: 0,
        averageComplianceScore: 0,
        results: [],
        summary: { errorCount: 0, warningCount: 0, infoCount: 0, totalAutoCorrections: 0, topIssues: [] },
      };
    }

    return this.validateBatch(products.map((p) => p.id), autoFix);
  }

  /**
   * Inline compliance check for a raw row during CSV import.
   * Can be used before DB insert to gate non-compliant records.
   */
  validateRowData(data: Record<string, string>): {
    compliant: boolean;
    errors: string[];
    warnings: string[];
    autoCorrections: Array<{ field: string; original: string; corrected: string }>;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const autoCorrections: Array<{ field: string; original: string; corrected: string }> = [];

    // Title validation
    const title = data['title'] || '';
    if (!title) {
      errors.push('Title is required');
    } else {
      if (title.length > 80) {
        const trimmed = title.slice(0, 80);
        autoCorrections.push({ field: 'title', original: title, corrected: trimmed });
        data['title'] = trimmed;
      }
      for (const pattern of TITLE_FORBIDDEN_PATTERNS) {
        if (pattern.test(title)) {
          const cleaned = title.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
          autoCorrections.push({ field: 'title', original: title, corrected: cleaned });
          data['title'] = cleaned;
          break;
        }
      }
    }

    // Brand validation — infer common OEM from title when C:Brand is blank (eBay export quirk)
    if (!data['brand'] || !data['brand'].trim()) {
      const inferred = this.inferBrandFromTitle(data['title'] || '');
      if (inferred) {
        data['brand'] = inferred;
        autoCorrections.push({ field: 'brand', original: '(empty)', corrected: inferred });
      }
    }
    if (!data['brand'] || !data['brand'].trim()) {
      errors.push('Brand is required for eBay Motors');
    }

    // MPN validation
    if (!data['mpn'] || !data['mpn'].trim()) {
      warnings.push('Manufacturer Part Number is strongly recommended');
    }

    // Price validation
    if (data['price']) {
      const price = parseFloat(data['price'].replace(/[$,\s]/g, ''));
      if (isNaN(price) || price <= 0) {
        errors.push('Price must be a positive number');
      } else if (price < 0.01) {
        errors.push('Price below minimum threshold ($0.01)');
      }
    }

    // Quantity validation
    if (data['quantity']) {
      const qty = parseInt(data['quantity'], 10);
      if (isNaN(qty) || qty < 1) {
        warnings.push('Quantity should be at least 1');
      }
    }

    // Condition validation
    if (data['conditionId']) {
      const validConditions = ['1000', '1500', '1750', '2000', '2500', '3000', '7000'];
      const cleanCondition = data['conditionId'].replace(/-.*/, '');
      if (!validConditions.includes(cleanCondition)) {
        warnings.push(`Condition ID "${data['conditionId']}" is not a standard eBay condition`);
      }
    }

    // UPC validation (check digit)
    if (data['upc'] && data['upc'].trim()) {
      const upc = data['upc'].replace(/\s/g, '');
      if (upc !== 'Does not apply' && upc !== 'N/A') {
        if (!/^\d{12,13}$/.test(upc)) {
          warnings.push('UPC must be 12 or 13 digits');
        } else if (!this.validateUpcCheckDigit(upc)) {
          warnings.push('UPC check digit is invalid');
        }
      }
    }

    // Image validation
    if (!data['imageUrls'] || !data['imageUrls'].trim()) {
      warnings.push('At least 1 image is required for eBay listings');
    } else {
      const urls = data['imageUrls'].split('|').filter(Boolean);
      const validUrls = urls.filter((u) => /^https?:\/\/.+/i.test(u));
      if (validUrls.length === 0) {
        warnings.push('No valid image URLs found');
      }
    }

    return {
      compliant: errors.length === 0,
      errors,
      warnings,
      autoCorrections,
    };
  }

  /**
   * Best-effort OEM brand from listing title when C:Brand is blank (common on File Exchange exports).
   */
  private inferBrandFromTitle(title: string): string | null {
    const t = title.trim();
    if (!t) return null;
    const lower = t.toLowerCase();
    const brands: Array<[string, string]> = [
      ['mercedes-benz', 'Mercedes-Benz'],
      ['mercedes', 'Mercedes-Benz'],
      ['bmw', 'BMW'],
      ['audi', 'Audi'],
      ['porsche', 'Porsche'],
      ['volkswagen', 'Volkswagen'],
      ['toyota', 'Toyota'],
      ['honda', 'Honda'],
      ['nissan', 'Nissan'],
      ['mazda', 'Mazda'],
      ['subaru', 'Subaru'],
      ['lexus', 'Lexus'],
      ['acura', 'Acura'],
      ['infiniti', 'Infiniti'],
      ['hyundai', 'Hyundai'],
      ['kia', 'Kia'],
      ['genesis', 'Genesis'],
      ['ford', 'Ford'],
      ['chevrolet', 'Chevrolet'],
      ['chevy', 'Chevrolet'],
      ['gmc', 'GMC'],
      ['cadillac', 'Cadillac'],
      ['dodge', 'Dodge'],
      ['chrysler', 'Chrysler'],
      ['jeep', 'Jeep'],
      ['ram', 'RAM'],
      ['tesla', 'Tesla'],
      ['volvo', 'Volvo'],
      ['land rover', 'Land Rover'],
      ['jaguar', 'Jaguar'],
      ['mini', 'MINI'],
      ['fiat', 'Fiat'],
      ['alfa romeo', 'Alfa Romeo'],
      ['maserati', 'Maserati'],
      ['ferrari', 'Ferrari'],
      ['lamborghini', 'Lamborghini'],
      ['bentley', 'Bentley'],
      ['rolls-royce', 'Rolls-Royce'],
      ['rolls royce', 'Rolls-Royce'],
      ['mitsubishi', 'Mitsubishi'],
      ['suzuki', 'Suzuki'],
      ['isuzu', 'Isuzu'],
    ];
    for (const [needle, brand] of brands) {
      if (lower.includes(needle)) return brand;
    }
    return null;
  }

  /**
   * Validate UPC check digit using standard algorithm.
   */
  private validateUpcCheckDigit(upc: string): boolean {
    const digits = upc.split('').map(Number);
    if (digits.length === 12) {
      // UPC-A
      let sum = 0;
      for (let i = 0; i < 11; i++) {
        sum += digits[i] * (i % 2 === 0 ? 3 : 1);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return checkDigit === digits[11];
    } else if (digits.length === 13) {
      // EAN-13
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += digits[i] * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return checkDigit === digits[12];
    }
    return false;
  }

  /**
   * Log compliance results to the audit trail.
   */
  private async logComplianceAudit(
    productId: string,
    importId: string | null,
    score: number,
    issues: ComplianceIssue[],
    corrections: ComplianceIssue[],
  ): Promise<void> {
    const entries = [
      // Log overall validation
      {
        productId,
        importId,
        action: 'validation' as const,
        field: '_overall',
        reason: `Compliance score: ${score} | ${issues.length} issues | ${corrections.length} corrections`,
        severity: score >= 0.7 ? 'info' : 'warning',
        complianceScore: score,
        autoFixed: corrections.length > 0,
      },
      // Log each auto-correction
      ...corrections.map((c) => ({
        productId,
        importId,
        action: c.code.includes('TITLE') ? ('title_optimization' as const)
          : c.code.includes('DESCRIPTION') ? ('description_enhancement' as const)
          : c.code.includes('CATEGORY') ? ('category_mapping' as const)
          : c.code.includes('SPECIFIC') ? ('item_specifics_fill' as const)
          : ('auto_correction' as const),
        field: c.field,
        originalValue: c.originalValue ?? null,
        newValue: c.fixedValue ?? null,
        reason: c.message,
        severity: c.severity,
        complianceScore: null as number | null,
        autoFixed: true,
      })),
    ];

    await this.auditService.logBatch(entries);
  }

  /* ── 1. Category Validation ──────────────────────────────── */

  private async validateCategory(product: CatalogProduct): Promise<CategoryValidationResult> {
    const issues: ComplianceIssue[] = [];

    if (!product.categoryId) {
      // Attempt to suggest a category based on product data
      const suggested = await this.suggestCategory(product);
      if (suggested) {
        return {
          valid: false,
          suggestedCategoryId: suggested.id,
          suggestedCategoryName: suggested.name,
          confidence: suggested.confidence,
          issues: [{
            code: 'MISSING_CATEGORY',
            field: 'categoryId',
            message: 'eBay category is missing',
            severity: 'error',
            suggestion: `Suggested: ${suggested.name} (${suggested.id})`,
          }],
        };
      }

      issues.push({
        code: 'MISSING_CATEGORY',
        field: 'categoryId',
        message: 'eBay category is required for listing',
        severity: 'error',
      });

      return {
        valid: false,
        suggestedCategoryId: null,
        suggestedCategoryName: null,
        confidence: 0,
        issues,
      };
    }

    return {
      valid: true,
      suggestedCategoryId: product.categoryId,
      suggestedCategoryName: product.categoryName ?? null,
      confidence: 1.0,
      issues,
    };
  }

  private async suggestCategory(product: CatalogProduct): Promise<{
    id: string;
    name: string;
    confidence: number;
  } | null> {
    try {
      const response = await this.openai.chat({
        systemPrompt: `You are an eBay Motors category specialist. Given auto part info, suggest the best eBay Motors category. Return JSON: {"id":"<ebay_category_id>","name":"<category_name>","confidence":0.0-1.0}. Common categories:
- 33631: Car & Truck Parts & Accessories
- 174104: Brakes & Brake Parts
- 33626: Engines & Components
- 33612: Exterior Parts & Accessories
- 33694: Interior Parts & Accessories
- 33602: Lighting & Lamps
- 33611: Suspension & Steering
Return ONLY JSON.`,
        userPrompt: `Part: ${product.title}\nBrand: ${product.brand || 'N/A'}\nType: ${product.partType || 'N/A'}\nMPN: ${product.mpn || 'N/A'}`,
        maxTokens: 150,
        temperature: 0.1,
      });

      const text = (response.content as string).replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /* ── 2. Item Specifics ───────────────────────────────────── */

  private async validateItemSpecifics(
    product: CatalogProduct,
    autoFix: boolean,
  ): Promise<ItemSpecificsResult> {
    const issues: ComplianceIssue[] = [];
    const autoFilled: Array<{ field: string; value: string }> = [];
    const missingRequired: string[] = [];

    // Check required specifics
    const specificsMap: Record<string, string | null> = {
      'Brand': product.brand,
      'Manufacturer Part Number': product.mpn,
    };

    for (const specific of REQUIRED_ITEM_SPECIFICS) {
      const value = specificsMap[specific];
      if (!value || value.trim() === '') {
        missingRequired.push(specific);
        issues.push({
          code: 'MISSING_REQUIRED_SPECIFIC',
          field: specific,
          message: `Required item specific "${specific}" is missing`,
          severity: 'error',
          suggestion: `Provide a valid ${specific}`,
        });
      }
    }

    // Check recommended specifics
    const recommendedMap: Record<string, string | null> = {
      'Interchange Part Number': product.oemPartNumber,
      'UPC': product.upc,
      'Placement on Vehicle': product.placement,
      'Type': product.partType,
      'Material': product.material,
    };

    for (const specific of RECOMMENDED_ITEM_SPECIFICS) {
      const value = recommendedMap[specific];
      if (!value || value.trim() === '') {
        issues.push({
          code: 'MISSING_RECOMMENDED_SPECIFIC',
          field: specific,
          message: `Recommended item specific "${specific}" is not provided`,
          severity: 'warning',
        });
      }
    }

    // Auto-fill missing specifics using AI
    if (autoFix && missingRequired.length > 0) {
      const filled = await this.autoFillSpecifics(product, missingRequired);
      autoFilled.push(...filled);
    }

    const totalRequired = REQUIRED_ITEM_SPECIFICS.length;
    const totalPresent = totalRequired - missingRequired.length + autoFilled.length;

    return {
      totalRequired,
      totalPresent: Math.min(totalPresent, totalRequired),
      coveragePercent: Math.round((totalPresent / totalRequired) * 100),
      missingRequired,
      autoFilled,
      issues,
    };
  }

  private async autoFillSpecifics(
    product: CatalogProduct,
    missingFields: string[],
  ): Promise<Array<{ field: string; value: string }>> {
    try {
      const response = await this.openai.chat({
        systemPrompt: `You are an automotive parts data specialist. Given a product and missing item specifics, infer the most likely values. Return JSON array: [{"field":"...","value":"..."}]. Only fill fields you are confident about. If unsure, omit that field. Return ONLY JSON array.`,
        userPrompt: `Product: ${product.title}
SKU: ${product.sku || 'N/A'}
Brand: ${product.brand || 'N/A'}
MPN: ${product.mpn || 'N/A'}
Description: ${(product.description || '').slice(0, 200)}

Missing fields: ${missingFields.join(', ')}`,
        maxTokens: 300,
        temperature: 0.1,
      });

      const text = (response.content as string).replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const fills = JSON.parse(text) as Array<{ field: string; value: string }>;
      return fills.filter((f) => f.field && f.value && missingFields.includes(f.field));
    } catch {
      return [];
    }
  }

  /* ── 3. Title Optimization ───────────────────────────────── */

  private async validateAndOptimizeTitle(
    product: CatalogProduct,
    autoFix: boolean,
  ): Promise<TitleOptimizationResult> {
    const issues: ComplianceIssue[] = [];
    const originalTitle = product.title || '';
    let optimizedTitle = originalTitle;
    let applied = false;

    // Length check
    if (originalTitle.length > TITLE_MAX_LENGTH) {
      issues.push({
        code: 'TITLE_TOO_LONG',
        field: 'title',
        message: `Title exceeds ${TITLE_MAX_LENGTH} characters (${originalTitle.length})`,
        severity: 'error',
        suggestion: `Shorten title to ${TITLE_MAX_LENGTH} characters`,
      });
    }

    if (originalTitle.length === 0) {
      issues.push({
        code: 'TITLE_EMPTY',
        field: 'title',
        message: 'Title is empty',
        severity: 'error',
      });
      return {
        originalTitle,
        optimizedTitle,
        applied: false,
        lengthOk: false,
        seoScore: 0,
        issues,
      };
    }

    // Forbidden patterns
    for (const pattern of TITLE_FORBIDDEN_PATTERNS) {
      if (pattern.test(originalTitle)) {
        issues.push({
          code: 'TITLE_FORBIDDEN_CONTENT',
          field: 'title',
          message: `Title contains forbidden content matching ${pattern.source}`,
          severity: 'error',
          suggestion: 'Remove promotional or spammy text',
        });
      }
    }

    // Duplicate words check
    const words = originalTitle.toLowerCase().split(/\s+/);
    const duplicates = words.filter((w, i) => words.indexOf(w) !== i && w.length > 3);
    if (duplicates.length > 0) {
      issues.push({
        code: 'TITLE_DUPLICATE_WORDS',
        field: 'title',
        message: `Title contains duplicate words: ${[...new Set(duplicates)].join(', ')}`,
        severity: 'warning',
      });
    }

    // SEO scoring
    const seoScore = this.calculateTitleSeoScore(originalTitle, product);

    // Auto-optimize if needed
    if (autoFix && (issues.some((i) => i.severity === 'error') || seoScore < 0.6)) {
      optimizedTitle = await this.generateOptimizedTitle(product);
      if (optimizedTitle && optimizedTitle !== originalTitle) {
        applied = true;
      } else {
        optimizedTitle = originalTitle;
      }
    }

    return {
      originalTitle,
      optimizedTitle,
      applied,
      lengthOk: originalTitle.length <= TITLE_MAX_LENGTH,
      seoScore,
      issues,
    };
  }

  private calculateTitleSeoScore(title: string, product: CatalogProduct): number {
    let score = 0.5;

    // Has brand
    if (product.brand && title.toLowerCase().includes(product.brand.toLowerCase())) score += 0.15;
    // Has part number
    if (product.mpn && title.toLowerCase().includes(product.mpn.toLowerCase())) score += 0.15;
    // Good length (50-80 chars)
    if (title.length >= 50 && title.length <= 80) score += 0.1;
    else if (title.length >= 30 && title.length < 50) score += 0.05;
    // Has keywords (not all caps)
    if (title !== title.toUpperCase()) score += 0.05;
    // Has fitment info
    if (/\b(for|fits)\b/i.test(title)) score += 0.05;

    return Math.min(1, Math.round(score * 100) / 100);
  }

  private async generateOptimizedTitle(product: CatalogProduct): Promise<string> {
    try {
      const response = await this.openai.chat({
        systemPrompt: `You are an eBay SEO specialist for automotive parts. Generate an optimized listing title following these rules:
- Max 80 characters
- Include: Brand, Part Number, Key Fitment, Core Keyword
- No spammy phrases (FREE SHIPPING, BEST PRICE, L@@K, etc.)
- No excessive punctuation or ALL CAPS
- Natural, professional language
- Return ONLY the title text, nothing else.`,
        userPrompt: `Generate an optimized eBay title for:
Brand: ${product.brand || 'N/A'}
MPN: ${product.mpn || 'N/A'}
Part Type: ${product.partType || 'N/A'}
Current Title: ${product.title}
Condition: ${product.conditionLabel || product.conditionId || 'N/A'}`,
        maxTokens: 100,
        temperature: 0.3,
      });

      const title = (response.content as string).replace(/^["']|["']$/g, '').trim();
      return title.length <= TITLE_MAX_LENGTH ? title : title.slice(0, TITLE_MAX_LENGTH);
    } catch {
      return product.title;
    }
  }

  /* ── 4. Description Enhancement ──────────────────────────── */

  private async validateDescription(
    product: CatalogProduct,
    autoFix: boolean,
  ): Promise<DescriptionEnhancementResult> {
    const issues: ComplianceIssue[] = [];
    const description = product.description || '';
    let enhanced = false;
    let enhancedDescription: string | null = null;

    if (!description || description.trim().length < 20) {
      issues.push({
        code: 'DESCRIPTION_MISSING',
        field: 'description',
        message: 'Product description is missing or too short',
        severity: 'warning',
        suggestion: 'Add a detailed description with features, compatibility, and condition',
      });

      if (autoFix) {
        enhancedDescription = await this.generateDescription(product);
        if (enhancedDescription) enhanced = true;
      }
    } else {
      // Check for prohibited HTML
      const hasScript = /<script[\s>]/i.test(description);
      const hasIframe = /<iframe[\s>]/i.test(description);
      if (hasScript || hasIframe) {
        issues.push({
          code: 'DESCRIPTION_PROHIBITED_HTML',
          field: 'description',
          message: 'Description contains prohibited HTML elements (script/iframe)',
          severity: 'error',
        });
      }

      // Check minimum quality
      if (description.length < 100) {
        issues.push({
          code: 'DESCRIPTION_TOO_SHORT',
          field: 'description',
          message: 'Description is shorter than recommended (min 100 chars)',
          severity: 'warning',
        });

        if (autoFix) {
          enhancedDescription = await this.generateDescription(product);
          if (enhancedDescription) enhanced = true;
        }
      }
    }

    return { hasDescription: !!description, enhanced, enhancedDescription, issues };
  }

  private async generateDescription(product: CatalogProduct): Promise<string | null> {
    try {
      const response = await this.openai.chat({
        systemPrompt: `You are an eBay listing specialist. Generate a professional, structured product description for an automotive part. Include:
1. Key Features (bullet points)
2. Compatibility / Fitment info
3. Condition notes
4. Brief shipping & returns info

Rules:
- Professional tone
- No prohibited HTML (<script>, <iframe>)
- Clean HTML formatting with <ul>, <li>, <p>, <strong>
- No false claims or prohibited terms
- Return ONLY the HTML description.`,
        userPrompt: `Product: ${product.title}
Brand: ${product.brand || 'N/A'}
MPN: ${product.mpn || 'N/A'}
Condition: ${product.conditionLabel || product.conditionId || 'N/A'}
Part Type: ${product.partType || 'N/A'}
Placement: ${product.placement || 'N/A'}
Material: ${product.material || 'N/A'}
Features: ${product.features || 'N/A'}
Current Description: ${(product.description || '').slice(0, 200)}`,
        maxTokens: 600,
        temperature: 0.3,
      });

      return (response.content as string).trim();
    } catch {
      return null;
    }
  }

  /* ── 5. Fitment Validation ───────────────────────────────── */

  private validateFitment(product: CatalogProduct): FitmentValidationResult {
    const issues: ComplianceIssue[] = [];
    const fitmentData = product.fitmentData;
    const hasFitment = !!fitmentData && Array.isArray(fitmentData) && fitmentData.length > 0;

    if (!hasFitment) {
      issues.push({
        code: 'MISSING_FITMENT',
        field: 'fitmentData',
        message: 'No vehicle compatibility / fitment data provided',
        severity: 'warning',
        suggestion: 'Add Year/Make/Model compatibility for better search visibility',
      });

      return { hasFitment: false, valid: false, normalized: false, vehicleCount: 0, issues };
    }

    let valid = true;
    let vehicleCount = 0;

    for (const entry of fitmentData) {
      vehicleCount++;
      const year = entry['Year'] || entry['year'];
      const make = entry['Make'] || entry['make'];
      const model = entry['Model'] || entry['model'];

      if (!year || !make || !model) {
        valid = false;
        issues.push({
          code: 'INCOMPLETE_FITMENT',
          field: 'fitmentData',
          message: `Fitment entry missing required fields (Year/Make/Model)`,
          severity: 'warning',
        });
        break; // Report once
      }

      // Validate year range
      const yearNum = Number(year);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 2) {
        issues.push({
          code: 'INVALID_FITMENT_YEAR',
          field: 'fitmentData',
          message: `Invalid year in fitment: ${year}`,
          severity: 'warning',
        });
      }
    }

    return { hasFitment: true, valid, normalized: false, vehicleCount, issues };
  }

  /* ── 6. Image Compliance ─────────────────────────────────── */

  private validateImages(product: CatalogProduct): ImageComplianceResult {
    const issues: ComplianceIssue[] = [];
    const images = product.imageUrls || [];
    const hasImages = images.length > 0;

    if (!hasImages) {
      issues.push({
        code: 'NO_IMAGES',
        field: 'imageUrls',
        message: 'At least 1 valid image is required per listing',
        severity: 'error',
        suggestion: 'Add a product image or use the image enrichment pipeline',
      });
      return { hasImages: false, imageCount: 0, valid: false, issues };
    }

    // Validate image URLs
    for (const url of images) {
      if (!url || typeof url !== 'string') {
        issues.push({
          code: 'INVALID_IMAGE_URL',
          field: 'imageUrls',
          message: 'Image URL is empty or invalid',
          severity: 'error',
        });
        continue;
      }

      // Check for known bad patterns
      if (/placeholder|no-image|default/i.test(url)) {
        issues.push({
          code: 'PLACEHOLDER_IMAGE',
          field: 'imageUrls',
          message: 'Image appears to be a placeholder, not a real product photo',
          severity: 'warning',
        });
      }
    }

    return {
      hasImages: true,
      imageCount: images.length,
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /* ── 7. Pricing & Policy Checks ──────────────────────────── */

  private validatePricing(product: CatalogProduct): PricingValidationResult {
    const issues: ComplianceIssue[] = [];
    const price = product.price;

    if (price === null || price === undefined) {
      issues.push({
        code: 'MISSING_PRICE',
        field: 'price',
        message: 'Price is required',
        severity: 'error',
      });
      return { hasPrice: false, valid: false, issues };
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      issues.push({
        code: 'INVALID_PRICE',
        field: 'price',
        message: `Price must be a positive number (got: ${price})`,
        severity: 'error',
      });
      return { hasPrice: true, valid: false, issues };
    }

    if (numericPrice > 50000) {
      issues.push({
        code: 'PRICE_SUSPICIOUSLY_HIGH',
        field: 'price',
        message: `Price $${numericPrice} seems unusually high for this category`,
        severity: 'warning',
      });
    }

    if (numericPrice < 0.01) {
      issues.push({
        code: 'PRICE_TOO_LOW',
        field: 'price',
        message: 'Price is below minimum threshold',
        severity: 'error',
      });
      return { hasPrice: true, valid: false, issues };
    }

    // Condition check
    const conditionId = product.conditionId;
    if (!conditionId) {
      issues.push({
        code: 'MISSING_CONDITION',
        field: 'conditionId',
        message: 'Item condition is required',
        severity: 'error',
      });
    } else if (!CONDITION_MAP[conditionId]) {
      issues.push({
        code: 'INVALID_CONDITION',
        field: 'conditionId',
        message: `Condition ID "${conditionId}" is not a valid eBay condition code`,
        severity: 'warning',
        suggestion: `Valid values: ${Object.entries(CONDITION_MAP).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      });
    }

    // Quantity check
    const qty = product.quantity;
    if (qty === null || qty === undefined || qty < 1) {
      issues.push({
        code: 'MISSING_QUANTITY',
        field: 'quantity',
        message: 'Quantity must be at least 1',
        severity: 'error',
      });
    }

    // Shipping profile
    if (!product.shippingProfile) {
      issues.push({
        code: 'MISSING_SHIPPING_PROFILE',
        field: 'shippingProfile',
        message: 'Shipping profile is recommended',
        severity: 'warning',
      });
    }

    // Return profile
    if (!product.returnProfile) {
      issues.push({
        code: 'MISSING_RETURN_PROFILE',
        field: 'returnProfile',
        message: 'Return policy profile is recommended',
        severity: 'warning',
      });
    }

    return {
      hasPrice: true,
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  private calculateComplianceScore(errorCount: number, warningCount: number): number {
    let score = 1.0;
    score -= errorCount * 0.15;
    score -= warningCount * 0.03;
    return Math.max(0, Math.round(score * 100) / 100);
  }

  private async applyAutoCorrections(
    product: CatalogProduct,
    corrections: ComplianceIssue[],
    titleResult: TitleOptimizationResult,
    descResult: DescriptionEnhancementResult,
    specificsResult: ItemSpecificsResult,
  ): Promise<void> {
    try {
      const updates: Partial<CatalogProduct> = {};

      if (titleResult.applied) {
        updates.title = titleResult.optimizedTitle;
      }

      if (descResult.enhanced && descResult.enhancedDescription) {
        updates.description = descResult.enhancedDescription;
      }

      // Apply auto-filled specifics
      for (const fill of specificsResult.autoFilled) {
        switch (fill.field) {
          case 'Brand':
            updates.brand = fill.value;
            break;
          case 'Manufacturer Part Number':
            updates.mpn = fill.value;
            break;
          case 'Interchange Part Number':
            updates.oemPartNumber = fill.value;
            break;
          case 'UPC':
            updates.upc = fill.value;
            break;
          case 'Placement on Vehicle':
            updates.placement = fill.value;
            break;
          case 'Type':
            updates.partType = fill.value;
            break;
          case 'Material':
            updates.material = fill.value;
            break;
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.productRepo.update(product.id, updates as any);
        this.logger.log(`Applied ${Object.keys(updates).length} auto-corrections to product ${product.id}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to apply auto-corrections to ${product.id}: ${err}`);
    }
  }

  private createErrorResult(productId: string, errorMsg: string): ComplianceResult {
    return {
      productId,
      sku: null,
      compliant: false,
      complianceScore: 0,
      issues: [{
        code: 'SYSTEM_ERROR',
        field: '_system',
        message: errorMsg,
        severity: 'error',
      }],
      autoCorrections: [],
      categoryValidation: { valid: false, suggestedCategoryId: null, suggestedCategoryName: null, confidence: 0, issues: [] },
      titleOptimization: { originalTitle: '', optimizedTitle: '', applied: false, lengthOk: false, seoScore: 0, issues: [] },
      descriptionEnhancement: { hasDescription: false, enhanced: false, enhancedDescription: null, issues: [] },
      fitmentValidation: { hasFitment: false, valid: false, normalized: false, vehicleCount: 0, issues: [] },
      imageCompliance: { hasImages: false, imageCount: 0, valid: false, issues: [] },
      pricingValidation: { hasPrice: false, valid: false, issues: [] },
      itemSpecifics: { totalRequired: 0, totalPresent: 0, coveragePercent: 0, missingRequired: [], autoFilled: [], issues: [] },
    };
  }
}
