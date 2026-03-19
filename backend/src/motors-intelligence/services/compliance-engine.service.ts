import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import {
  MotorsProduct,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  EbayCategoryMapping,
  EbayAspectRequirement,
  AspectRequirementLevel,
} from '../entities';

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

// eBay title rules
const TITLE_MAX_LENGTH = 80;
const TITLE_FORBIDDEN_PATTERNS = [
  /\b(FREE SHIPPING|FREE S&H|FREE RETURNS)\b/gi,
  /\b(BEST PRICE|LOWEST PRICE|CHEAPEST)\b/gi,
  /\b(L@@K|LOOK|WOW|RARE FIND|MUST SEE|HOT)\b/gi,
  /!{2,}/g, // Multiple exclamation marks
  /\b([A-Z]{10,})\b/g, // Long sequences of ALL CAPS (allow short abbreviations)
];

const FORBIDDEN_HTML_TAGS = ['script', 'iframe', 'embed', 'object', 'form', 'input', 'style', 'link'];

const PROHIBITED_CLAIMS = [
  'lifetime warranty',
  'guaranteed to fit',
  'fits all vehicles',
  'universal fit',
  'one size fits all',
  'OEM quality', // unless actually OEM
  'factory replacement', // unless verified
];

@Injectable()
export class ComplianceEngineService {
  private readonly logger = new Logger(ComplianceEngineService.name);

  constructor(
    @InjectRepository(ValidationResult)
    private readonly validationResultRepo: Repository<ValidationResult>,
    @InjectRepository(MotorsProduct)
    private readonly motorsProductRepo: Repository<MotorsProduct>,
    @InjectRepository(EbayCategoryMapping)
    private readonly categoryMappingRepo: Repository<EbayCategoryMapping>,
    @InjectRepository(EbayAspectRequirement)
    private readonly aspectRequirementRepo: Repository<EbayAspectRequirement>,
  ) {}

  async validateProduct(motorsProductId: string): Promise<ValidationResult> {
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: motorsProductId },
    });

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const infos: ValidationIssue[] = [];

    // 1. Category requirements
    await this.validateCategory(product, errors, warnings);

    // 2. Required item specifics
    await this.validateItemSpecifics(product, errors, warnings, infos);

    // 3. Motors compatibility requirements
    this.validateFitment(product, errors, warnings);

    // 4. Title rules
    this.validateTitle(product, errors, warnings);

    // 5. HTML safety rules
    this.validateHtml(product, errors, warnings);

    // 6. Prohibited claims
    this.validateProhibitedClaims(product, errors, warnings);

    // 7. Identity validation
    this.validateIdentity(product, errors, warnings);

    // 8. Confidence thresholds
    this.validateConfidence(product, errors, warnings);

    // 9. Duplicate detection
    const duplicateResult = await this.detectDuplicates(product);

    // Calculate overall compliance score
    const overallScore = this.calculateComplianceScore(errors, warnings, infos);

    const publishable = errors.length === 0 && overallScore >= 0.7;

    const validationResult = this.validationResultRepo.create({
      motorsProductId,
      publishable,
      errors,
      warnings,
      infos,
      duplicateDetected: duplicateResult.detected,
      duplicateOfListingId: duplicateResult.duplicateId,
      duplicateMatchType: duplicateResult.matchType,
      overallComplianceScore: overallScore,
      aspectCoverage: await this.getAspectCoverage(product),
      fullPayload: this.buildFullPayload(product),
    });

    return this.validationResultRepo.save(validationResult);
  }

  private async validateCategory(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): Promise<void> {
    if (!product.ebayCategoryId) {
      errors.push({
        code: 'MISSING_CATEGORY',
        field: 'ebayCategoryId',
        message: 'eBay category ID is required',
        severity: ValidationSeverity.ERROR,
        suggestion: 'Resolve the product type to determine appropriate eBay Motors category',
      });
      return;
    }

    const mapping = await this.categoryMappingRepo.findOne({
      where: { ebayCategoryId: product.ebayCategoryId },
    });

    if (!mapping) {
      warnings.push({
        code: 'UNKNOWN_CATEGORY',
        field: 'ebayCategoryId',
        message: `Category ${product.ebayCategoryId} not found in Motors category mappings`,
        severity: ValidationSeverity.WARNING,
      });
    } else if (mapping.supportsCompatibility && !product.fitmentRows?.length) {
      warnings.push({
        code: 'MISSING_COMPATIBILITY',
        field: 'fitmentRows',
        message: 'This category supports vehicle compatibility but no fitment data provided',
        severity: ValidationSeverity.WARNING,
        suggestion: 'Add fitment/compatibility data for better listing visibility',
      });
    }
  }

  private async validateItemSpecifics(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
    infos: ValidationIssue[],
  ): Promise<void> {
    if (!product.ebayCategoryId) return;

    const requirements = await this.aspectRequirementRepo.find({
      where: { ebayCategoryId: product.ebayCategoryId },
    });

    const specifics = product.generatedItemSpecifics || {};

    for (const req of requirements) {
      const value = specifics[req.aspectName];

      if (req.requirementLevel === AspectRequirementLevel.REQUIRED && !value) {
        errors.push({
          code: 'MISSING_REQUIRED_ASPECT',
          field: req.aspectName,
          message: `Required item specific "${req.aspectName}" is missing`,
          severity: ValidationSeverity.ERROR,
          suggestion: req.defaultValue ? `Default value: ${req.defaultValue}` : undefined,
        });
      } else if (req.requirementLevel === AspectRequirementLevel.RECOMMENDED && !value) {
        warnings.push({
          code: 'MISSING_RECOMMENDED_ASPECT',
          field: req.aspectName,
          message: `Recommended item specific "${req.aspectName}" is missing`,
          severity: ValidationSeverity.WARNING,
        });
      }

      // Validate against allowed values
      if (value && req.allowedValues && req.allowedValues.length > 0) {
        if (!req.allowedValues.includes(value)) {
          warnings.push({
            code: 'INVALID_ASPECT_VALUE',
            field: req.aspectName,
            message: `Value "${value}" is not in the allowed values for "${req.aspectName}"`,
            severity: ValidationSeverity.WARNING,
            suggestion: `Allowed values: ${req.allowedValues.slice(0, 5).join(', ')}...`,
          });
        }
      }

      // Validate max length
      if (value && req.maxLength && value.length > req.maxLength) {
        errors.push({
          code: 'ASPECT_TOO_LONG',
          field: req.aspectName,
          message: `Value for "${req.aspectName}" exceeds max length of ${req.maxLength}`,
          severity: ValidationSeverity.ERROR,
        });
      }
    }
  }

  private validateFitment(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    if (!product.fitmentRows || product.fitmentRows.length === 0) {
      if (product.compatibilityRequired) {
        errors.push({
          code: 'FITMENT_REQUIRED',
          field: 'fitmentRows',
          message: 'Vehicle compatibility data is required for this category',
          severity: ValidationSeverity.ERROR,
        });
      }
      return;
    }

    // Validate fitment rows
    const seen = new Set<string>();
    for (let i = 0; i < product.fitmentRows.length; i++) {
      const row = product.fitmentRows[i];

      // Check for required fields
      if (!row.year && !row.yearStart) {
        warnings.push({
          code: 'FITMENT_MISSING_YEAR',
          field: `fitmentRows[${i}]`,
          message: `Fitment row ${i + 1} is missing year information`,
          severity: ValidationSeverity.WARNING,
        });
      }

      if (!row.make) {
        warnings.push({
          code: 'FITMENT_MISSING_MAKE',
          field: `fitmentRows[${i}]`,
          message: `Fitment row ${i + 1} is missing make`,
          severity: ValidationSeverity.WARNING,
        });
      }

      if (!row.model) {
        warnings.push({
          code: 'FITMENT_MISSING_MODEL',
          field: `fitmentRows[${i}]`,
          message: `Fitment row ${i + 1} is missing model`,
          severity: ValidationSeverity.WARNING,
        });
      }

      // Duplicate check
      const key = `${row.year || row.yearStart}-${row.make}-${row.model}-${row.submodel || ''}-${row.engine || ''}`;
      if (seen.has(key)) {
        warnings.push({
          code: 'FITMENT_DUPLICATE_ROW',
          field: `fitmentRows[${i}]`,
          message: `Duplicate fitment row detected: ${key}`,
          severity: ValidationSeverity.WARNING,
        });
      }
      seen.add(key);

      // Year validation
      const year = parseInt(row.year || row.yearStart, 10);
      if (year && (year < 1900 || year > new Date().getFullYear() + 2)) {
        errors.push({
          code: 'FITMENT_INVALID_YEAR',
          field: `fitmentRows[${i}]`,
          message: `Invalid year ${year} in fitment row ${i + 1}`,
          severity: ValidationSeverity.ERROR,
        });
      }
    }
  }

  private validateTitle(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    const title = product.generatedTitle;
    if (!title) {
      errors.push({
        code: 'MISSING_TITLE',
        field: 'generatedTitle',
        message: 'Listing title is required',
        severity: ValidationSeverity.ERROR,
      });
      return;
    }

    // Length check
    if (title.length > TITLE_MAX_LENGTH) {
      errors.push({
        code: 'TITLE_TOO_LONG',
        field: 'generatedTitle',
        message: `Title is ${title.length} characters, max is ${TITLE_MAX_LENGTH}`,
        severity: ValidationSeverity.ERROR,
        suggestion: 'Shorten the title while keeping key product identifiers',
      });
    }

    // Forbidden patterns
    for (const pattern of TITLE_FORBIDDEN_PATTERNS) {
      if (pattern.test(title)) {
        warnings.push({
          code: 'TITLE_FORBIDDEN_PATTERN',
          field: 'generatedTitle',
          message: `Title contains a forbidden pattern: ${pattern.source}`,
          severity: ValidationSeverity.WARNING,
        });
      }
    }

    // Quality checks
    if (!product.brand || !title.includes(product.brand)) {
      warnings.push({
        code: 'TITLE_MISSING_BRAND',
        field: 'generatedTitle',
        message: 'Title should include the brand name',
        severity: ValidationSeverity.WARNING,
      });
    }

    if (!product.mpn || !title.includes(product.mpn)) {
      warnings.push({
        code: 'TITLE_MISSING_MPN',
        field: 'generatedTitle',
        message: 'Title should include the MPN for better search visibility',
        severity: ValidationSeverity.WARNING,
      });
    }

    // Title improvement suggestions
    if (title.length < 40) {
      warnings.push({
        code: 'TITLE_CAN_BE_IMPROVED',
        field: 'generatedTitle',
        message: 'Title is short and may not use all available keyword space',
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private validateHtml(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    const html = product.generatedHtmlDescription;
    if (!html) return;

    for (const tag of FORBIDDEN_HTML_TAGS) {
      const pattern = new RegExp(`<${tag}[\\s>]`, 'gi');
      if (pattern.test(html)) {
        errors.push({
          code: 'HTML_FORBIDDEN_TAG',
          field: 'generatedHtmlDescription',
          message: `HTML description contains forbidden tag: <${tag}>`,
          severity: ValidationSeverity.ERROR,
        });
      }
    }

    // Check for external resources
    if (/src\s*=\s*["']https?:/i.test(html)) {
      warnings.push({
        code: 'HTML_EXTERNAL_RESOURCE',
        field: 'generatedHtmlDescription',
        message: 'HTML description references external resources',
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private validateProhibitedClaims(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    const textToCheck = [
      product.generatedTitle,
      product.generatedHtmlDescription,
      ...(product.generatedBulletFeatures || []),
    ].filter(Boolean).join(' ').toLowerCase();

    for (const claim of PROHIBITED_CLAIMS) {
      if (textToCheck.includes(claim.toLowerCase())) {
        warnings.push({
          code: 'PROHIBITED_CLAIM',
          field: 'content',
          message: `Content contains prohibited claim: "${claim}"`,
          severity: ValidationSeverity.WARNING,
          suggestion: 'Remove or rephrase this claim to comply with eBay policies',
        });
      }
    }
  }

  private validateIdentity(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    // Brand / MPN consistency
    if (!product.brand) {
      errors.push({
        code: 'MISSING_BRAND',
        field: 'brand',
        message: 'Product brand is required',
        severity: ValidationSeverity.ERROR,
      });
    }

    if (!product.mpn) {
      errors.push({
        code: 'MISSING_MPN',
        field: 'mpn',
        message: 'Manufacturer Part Number is required',
        severity: ValidationSeverity.ERROR,
      });
    }

    // Condition validation
    if (!product.condition) {
      warnings.push({
        code: 'MISSING_CONDITION',
        field: 'condition',
        message: 'Product condition not specified',
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private validateConfidence(
    product: MotorsProduct,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    if (product.identityConfidence !== null && Number(product.identityConfidence) < 0.6) {
      errors.push({
        code: 'LOW_IDENTITY_CONFIDENCE',
        field: 'identityConfidence',
        message: `Identity confidence (${product.identityConfidence}) is below threshold`,
        severity: ValidationSeverity.ERROR,
      });
    }

    if (product.fitmentConfidence !== null && Number(product.fitmentConfidence) < 0.5) {
      warnings.push({
        code: 'LOW_FITMENT_CONFIDENCE',
        field: 'fitmentConfidence',
        message: `Fitment confidence (${product.fitmentConfidence}) is below recommended threshold`,
        severity: ValidationSeverity.WARNING,
      });
    }
  }

  private async detectDuplicates(
    product: MotorsProduct,
  ): Promise<{ detected: boolean; duplicateId?: string; matchType?: string }> {
    // Check by brand + MPN (most reliable)
    if (product.brand && product.mpn) {
      const existing = await this.motorsProductRepo.findOne({
        where: {
          brand: product.brand,
          mpn: product.mpn,
          status: 'published' as any,
        },
      });
      if (existing && existing.id !== product.id) {
        return { detected: true, duplicateId: existing.id, matchType: 'brand_mpn' };
      }
    }

    // Check by title similarity (basic approach)
    if (product.generatedTitle) {
      const similar = await this.motorsProductRepo
        .createQueryBuilder('mp')
        .where('mp.id != :id', { id: product.id })
        .andWhere(`mp."generatedTitle" ILIKE :title`, {
          title: `%${product.generatedTitle.substring(0, 40)}%`,
        })
        .andWhere(`mp.status = 'published'`)
        .limit(1)
        .getOne();

      if (similar) {
        return { detected: true, duplicateId: similar.id, matchType: 'title_similarity' };
      }
    }

    return { detected: false };
  }

  private calculateComplianceScore(
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
    infos: ValidationIssue[],
  ): number {
    let score = 1.0;
    score -= errors.length * 0.15;
    score -= warnings.length * 0.05;
    return Math.max(0, Math.min(1, score));
  }

  private async getAspectCoverage(product: MotorsProduct): Promise<Record<string, any>> {
    if (!product.ebayCategoryId) return {};

    const requirements = await this.aspectRequirementRepo.find({
      where: { ebayCategoryId: product.ebayCategoryId },
    });

    const specifics = product.generatedItemSpecifics || {};
    const required = requirements.filter(r => r.requirementLevel === AspectRequirementLevel.REQUIRED);
    const recommended = requirements.filter(r => r.requirementLevel === AspectRequirementLevel.RECOMMENDED);

    const requiredCovered = required.filter(r => specifics[r.aspectName]).length;
    const recommendedCovered = recommended.filter(r => specifics[r.aspectName]).length;

    return {
      requiredTotal: required.length,
      requiredCovered,
      requiredCoverage: required.length > 0 ? requiredCovered / required.length : 1,
      recommendedTotal: recommended.length,
      recommendedCovered,
      recommendedCoverage: recommended.length > 0 ? recommendedCovered / recommended.length : 1,
    };
  }

  private buildFullPayload(product: MotorsProduct): Record<string, any> {
    return {
      title: product.generatedTitle,
      itemSpecifics: product.generatedItemSpecifics,
      description: product.generatedHtmlDescription,
      categoryId: product.ebayCategoryId,
      condition: product.condition,
      price: product.price,
      quantity: product.quantity,
      imageUrls: product.imageUrls,
      fitmentRows: product.fitmentRows,
      brand: product.brand,
      mpn: product.mpn,
    };
  }
}
