import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import {
  MotorsProduct,
  ProductCandidate,
  CandidateStatus,
  ExtractedAttribute,
  CorrectionRule,
  CorrectionType,
} from '../entities';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity';

export interface IdentityResolutionResult {
  resolved: boolean;
  candidates: ProductCandidate[];
  winner: ProductCandidate | null;
  identityConfidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
}

// Weight config for the scoring model
const IDENTITY_WEIGHTS = {
  exactMpn: 0.35,
  brandMatch: 0.20,
  ocrMpn: 0.15,
  visualFamily: 0.10,
  dimensionMatch: 0.10,
  supplierDescSimilarity: 0.05,
  fitmentConsistency: 0.05,
};

const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: 0.85,
  REVIEW_REQUIRED: 0.60,
  REJECT: 0.30,
};

@Injectable()
export class ProductIdentityService {
  private readonly logger = new Logger(ProductIdentityService.name);

  constructor(
    @InjectRepository(MotorsProduct)
    private readonly motorsProductRepo: Repository<MotorsProduct>,
    @InjectRepository(ProductCandidate)
    private readonly candidateRepo: Repository<ProductCandidate>,
    @InjectRepository(ExtractedAttribute)
    private readonly extractedAttrRepo: Repository<ExtractedAttribute>,
    @InjectRepository(CatalogProduct)
    private readonly catalogProductRepo: Repository<CatalogProduct>,
    @InjectRepository(CorrectionRule)
    private readonly correctionRuleRepo: Repository<CorrectionRule>,
  ) {}

  async resolveIdentity(motorsProductId: string): Promise<IdentityResolutionResult> {
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: motorsProductId },
    });

    const extractions = await this.extractedAttrRepo.find({
      where: { motorsProductId },
      order: { createdAt: 'DESC' },
    });

    // Merge signals from all extractions
    const signals = this.mergeExtractionSignals(extractions);

    // Stage 1: Deterministic Resolution
    let candidates = await this.deterministicResolution(motorsProductId, signals);

    // Stage 2: AI-Assisted if no exact match found
    if (candidates.length === 0 && extractions.length > 0) {
      candidates = await this.aiAssistedCandidateGeneration(motorsProductId, signals, extractions);
    }

    // Stage 3: Score all candidates
    for (const candidate of candidates) {
      candidate.compositeScore = this.computeCompositeScore(candidate);
    }

    // Sort by composite score descending
    candidates.sort((a, b) => Number(b.compositeScore) - Number(a.compositeScore));

    // Assign ranks
    candidates.forEach((c, i) => { c.rank = i + 1; });

    // Save all candidates
    const savedCandidates = await this.candidateRepo.save(candidates);

    // Stage 3b: Validation gates
    const validationResult = this.applyValidationGates(savedCandidates, signals);

    if (validationResult.resolved && validationResult.winner) {
      // Mark winner
      validationResult.winner.status = CandidateStatus.SELECTED;
      await this.candidateRepo.save(validationResult.winner);

      // Update motors product with resolved identity
      await this.applyWinnerToProduct(product, validationResult.winner);
    }

    return validationResult;
  }

  private mergeExtractionSignals(extractions: ExtractedAttribute[]): Record<string, any> {
    const signals: Record<string, any> = {
      brands: [],
      mpns: [],
      oemNumbers: [],
      productTypes: [],
      productFamilies: [],
      placements: [],
      conditions: [],
      sideOrientations: [],
      frontRears: [],
      features: [],
      fitmentRaw: [],
      dimensions: null,
    };

    for (const ext of extractions) {
      if (ext.extractedBrand) signals.brands.push(ext.extractedBrand);
      if (ext.extractedMpn) signals.mpns.push(ext.extractedMpn);
      if (ext.extractedOemNumber) signals.oemNumbers.push(ext.extractedOemNumber);
      if (ext.extractedProductType) signals.productTypes.push(ext.extractedProductType);
      if (ext.extractedProductFamily) signals.productFamilies.push(ext.extractedProductFamily);
      if (ext.extractedPlacement) signals.placements.push(ext.extractedPlacement);
      if (ext.extractedCondition) signals.conditions.push(ext.extractedCondition);
      if (ext.extractedSideOrientation) signals.sideOrientations.push(ext.extractedSideOrientation);
      if (ext.extractedFrontRear) signals.frontRears.push(ext.extractedFrontRear);
      if (ext.extractedFeatures) signals.features.push(...ext.extractedFeatures);
      if (ext.extractedFitmentRaw) signals.fitmentRaw.push(...ext.extractedFitmentRaw);
      if (ext.extractedDimensions && !signals.dimensions) {
        signals.dimensions = ext.extractedDimensions;
      }

      // Use normalized output if available
      if (ext.normalizedOutput) {
        if (ext.normalizedOutput.brand) signals.brands.push(ext.normalizedOutput.brand);
        if (ext.normalizedOutput.mpn) signals.mpns.push(ext.normalizedOutput.mpn);
        if (ext.normalizedOutput.productType) signals.productTypes.push(ext.normalizedOutput.productType);
      }
    }

    // Deduplicate
    signals.brands = [...new Set(signals.brands)];
    signals.mpns = [...new Set(signals.mpns)];
    signals.oemNumbers = [...new Set(signals.oemNumbers)];
    signals.productTypes = [...new Set(signals.productTypes)];
    signals.productFamilies = [...new Set(signals.productFamilies)];
    signals.placements = [...new Set(signals.placements)];
    signals.conditions = [...new Set(signals.conditions)];

    return signals;
  }

  private async deterministicResolution(
    motorsProductId: string,
    signals: Record<string, any>,
  ): Promise<ProductCandidate[]> {
    const candidates: ProductCandidate[] = [];

    // 1. Internal approved SKU master (catalog_products by exact MPN)
    for (const mpn of signals.mpns) {
      const normalized = this.normalizeMpn(mpn);
      const catalogMatches = await this.catalogProductRepo.find({
        where: { mpnNormalized: normalized },
        take: 5,
      });

      for (const match of catalogMatches) {
        const candidate = this.candidateRepo.create({
          motorsProductId,
          brand: match.brand,
          mpn: match.mpn,
          mpnNormalized: match.mpnNormalized,
          oemPartNumber: match.oemPartNumber,
          productType: match.partType,
          placement: match.placement,
          condition: match.conditionLabel,
          source: 'internal_sku',
          sourceReference: match.id,
          exactMpnScore: normalized === match.mpnNormalized ? 1.0 : 0.0,
          brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
          candidateData: {
            catalogProductId: match.id,
            sku: match.sku,
            title: match.title,
            categoryId: match.categoryId,
            imageUrls: match.imageUrls,
            fitmentData: match.fitmentData,
          },
        });
        candidates.push(candidate);
      }
    }

    // 2. Supplier MPN index (catalog_products by MPN prefix match)
    if (candidates.length === 0) {
      for (const mpn of signals.mpns) {
        const prefixMatches = await this.catalogProductRepo
          .createQueryBuilder('cp')
          .where(`cp."mpnNormalized" LIKE :pattern`, { pattern: `${this.normalizeMpn(mpn)}%` })
          .limit(5)
          .getMany();

        for (const match of prefixMatches) {
          const candidate = this.candidateRepo.create({
            motorsProductId,
            brand: match.brand,
            mpn: match.mpn,
            mpnNormalized: match.mpnNormalized,
            oemPartNumber: match.oemPartNumber,
            productType: match.partType,
            placement: match.placement,
            condition: match.conditionLabel,
            source: 'supplier_mpn',
            sourceReference: match.id,
            exactMpnScore: 0.7, // prefix match, not exact
            brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
            candidateData: {
              catalogProductId: match.id,
              sku: match.sku,
              title: match.title,
            },
          });
          candidates.push(candidate);
        }
      }
    }

    // 3. OEM / interchange tables
    for (const oem of signals.oemNumbers) {
      const oemMatches = await this.catalogProductRepo.find({
        where: { oemPartNumber: ILike(`%${oem}%`) },
        take: 5,
      });

      for (const match of oemMatches) {
        const exists = candidates.some(c =>
          c.mpnNormalized === match.mpnNormalized && c.source !== 'oem_interchange',
        );
        if (!exists) {
          const candidate = this.candidateRepo.create({
            motorsProductId,
            brand: match.brand,
            mpn: match.mpn,
            mpnNormalized: match.mpnNormalized,
            oemPartNumber: match.oemPartNumber,
            productType: match.partType,
            source: 'oem_interchange',
            sourceReference: match.id,
            exactMpnScore: 0.5,
            brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
            candidateData: {
              catalogProductId: match.id,
              matchedOem: oem,
            },
          });
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  private async aiAssistedCandidateGeneration(
    motorsProductId: string,
    signals: Record<string, any>,
    extractions: ExtractedAttribute[],
  ): Promise<ProductCandidate[]> {
    const candidates: ProductCandidate[] = [];

    // Generate candidates from vision/OCR extracted data
    const bestExtraction = extractions[0]; // most recent

    if (bestExtraction) {
      // Search catalog by brand + product type
      const brandQuery = signals.brands[0];
      const typeQuery = signals.productTypes[0];

      if (brandQuery || typeQuery) {
        const qb = this.catalogProductRepo.createQueryBuilder('cp');

        if (brandQuery) {
          qb.andWhere(`cp."brandNormalized" ILIKE :brand`, {
            brand: `%${brandQuery.toLowerCase()}%`,
          });
        }
        if (typeQuery) {
          qb.andWhere(`(cp."partType" ILIKE :type OR cp."title" ILIKE :typeTitle)`, {
            type: `%${typeQuery}%`,
            typeTitle: `%${typeQuery}%`,
          });
        }

        const matches = await qb.limit(10).getMany();

        for (const match of matches) {
          const candidate = this.candidateRepo.create({
            motorsProductId,
            brand: match.brand,
            mpn: match.mpn,
            mpnNormalized: match.mpnNormalized,
            oemPartNumber: match.oemPartNumber,
            productType: match.partType,
            placement: match.placement,
            source: 'ai_vision',
            sourceReference: bestExtraction.id,
            exactMpnScore: this.scoreMpnSimilarity(signals.mpns, match.mpnNormalized),
            brandMatchScore: this.scoreBrandMatch(signals.brands, match.brand),
            ocrMpnScore: bestExtraction.confidenceScores?.mpn || 0,
            visualFamilyScore: this.scoreProductTypeSimilarity(signals.productTypes, match.partType),
            candidateData: {
              catalogProductId: match.id,
              sku: match.sku,
              title: match.title,
            },
          });
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  private applyValidationGates(
    candidates: ProductCandidate[],
    signals: Record<string, any>,
  ): IdentityResolutionResult {
    const reviewReasons: string[] = [];

    if (candidates.length === 0) {
      return {
        resolved: false,
        candidates: [],
        winner: null,
        identityConfidence: 0,
        requiresReview: true,
        reviewReasons: ['No candidates found'],
      };
    }

    const topCandidate = candidates[0];
    const confidence = Number(topCandidate.compositeScore);

    // Check: only one winning candidate (or clear margin)
    if (candidates.length > 1) {
      const secondBest = Number(candidates[1].compositeScore);
      if (confidence - secondBest < 0.15) {
        reviewReasons.push('multiple_identities');
      }
    }

    // Check: confidence above threshold
    if (confidence < CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED) {
      reviewReasons.push('low_confidence');
    }

    // Check: no brand conflict
    if (signals.brands.length > 1) {
      const uniqueBrands = signals.brands.map((b: string) => b.toLowerCase()).filter(
        (b: string, i: number, a: string[]) => a.indexOf(b) === i,
      );
      if (uniqueBrands.length > 1) {
        reviewReasons.push('brand_ambiguity');
      }
    }

    // Check: no quantity ambiguity
    if (signals.conditions?.length > 1) {
      reviewReasons.push('quantity_ambiguity');
    }

    // Check: no side/orientation ambiguity
    if (signals.sideOrientations?.length > 1) {
      const unique = [...new Set(signals.sideOrientations.map((s: string) => s.toLowerCase()))];
      if (unique.length > 1) {
        reviewReasons.push('side_orientation_conflict');
      }
    }

    // Check: no front/rear ambiguity
    if (signals.frontRears?.length > 1) {
      const unique = [...new Set(signals.frontRears.map((s: string) => s.toLowerCase()))];
      if (unique.length > 1) {
        reviewReasons.push('front_rear_conflict');
      }
    }

    const resolved = confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE && reviewReasons.length === 0;

    return {
      resolved,
      candidates,
      winner: resolved || confidence >= CONFIDENCE_THRESHOLDS.REVIEW_REQUIRED ? topCandidate : null,
      identityConfidence: confidence,
      requiresReview: reviewReasons.length > 0 || confidence < CONFIDENCE_THRESHOLDS.AUTO_APPROVE,
      reviewReasons,
    };
  }

  private async applyWinnerToProduct(
    product: MotorsProduct,
    winner: ProductCandidate,
  ): Promise<void> {
    product.brand = winner.brand;
    product.brandNormalized = winner.brand?.toLowerCase().replace(/[^a-z0-9]/g, '') || null;
    product.mpn = winner.mpn;
    product.mpnNormalized = winner.mpnNormalized;
    product.oemPartNumber = winner.oemPartNumber;
    product.productType = winner.productType;
    product.productFamily = winner.productFamily;
    product.placement = winner.placement;
    product.condition = winner.condition;
    product.identityConfidence = Number(winner.compositeScore);

    // If candidate has catalog product data, pull additional fields
    if (winner.candidateData?.catalogProductId) {
      const catalogProduct = await this.catalogProductRepo.findOne({
        where: { id: winner.candidateData.catalogProductId },
      });
      if (catalogProduct) {
        product.catalogProductId = catalogProduct.id;
        if (catalogProduct.categoryId) {
          product.ebayCategoryId = catalogProduct.categoryId;
          product.ebayCategoryName = catalogProduct.categoryName;
        }
        if (catalogProduct.imageUrls && (!product.imageUrls || product.imageUrls.length === 0)) {
          product.imageUrls = catalogProduct.imageUrls;
        }
        if (catalogProduct.fitmentData) {
          product.fitmentRows = catalogProduct.fitmentData as any[];
        }
      }
    }

    await this.motorsProductRepo.save(product);
  }

  private computeCompositeScore(candidate: ProductCandidate): number {
    return Number(
      (
        IDENTITY_WEIGHTS.exactMpn * Number(candidate.exactMpnScore) +
        IDENTITY_WEIGHTS.brandMatch * Number(candidate.brandMatchScore) +
        IDENTITY_WEIGHTS.ocrMpn * Number(candidate.ocrMpnScore) +
        IDENTITY_WEIGHTS.visualFamily * Number(candidate.visualFamilyScore) +
        IDENTITY_WEIGHTS.dimensionMatch * Number(candidate.dimensionMatchScore) +
        IDENTITY_WEIGHTS.supplierDescSimilarity * Number(candidate.supplierDescSimilarityScore) +
        IDENTITY_WEIGHTS.fitmentConsistency * Number(candidate.fitmentConsistencyScore)
      ).toFixed(4),
    );
  }

  private normalizeMpn(mpn: string): string {
    return mpn
      .toUpperCase()
      .replace(/[-–—.\s]/g, '')
      .replace(/O/g, '0') // Common OCR substitution handled as normalization
      .replace(/I/g, '1') // Common OCR substitution
      .trim();
  }

  private scoreBrandMatch(extractedBrands: string[], candidateBrand: string | null): number {
    if (!candidateBrand || extractedBrands.length === 0) return 0;
    const normalized = candidateBrand.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const brand of extractedBrands) {
      const normalizedBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedBrand === normalized) return 1.0;
      if (normalizedBrand.includes(normalized) || normalized.includes(normalizedBrand)) return 0.8;
    }
    return 0;
  }

  private scoreMpnSimilarity(extractedMpns: string[], candidateMpn: string | null): number {
    if (!candidateMpn || extractedMpns.length === 0) return 0;
    const normalizedCandidate = this.normalizeMpn(candidateMpn);
    for (const mpn of extractedMpns) {
      const normalizedExtracted = this.normalizeMpn(mpn);
      if (normalizedExtracted === normalizedCandidate) return 1.0;
      if (normalizedCandidate.startsWith(normalizedExtracted) ||
          normalizedExtracted.startsWith(normalizedCandidate)) return 0.7;
      // Levenshtein-like rough check
      if (this.roughSimilarity(normalizedExtracted, normalizedCandidate) > 0.85) return 0.6;
    }
    return 0;
  }

  private scoreProductTypeSimilarity(extractedTypes: string[], candidateType: string | null): number {
    if (!candidateType || extractedTypes.length === 0) return 0;
    const normalizedCandidate = candidateType.toLowerCase();
    for (const type of extractedTypes) {
      const normalizedExtracted = type.toLowerCase();
      if (normalizedExtracted === normalizedCandidate) return 1.0;
      if (normalizedCandidate.includes(normalizedExtracted) ||
          normalizedExtracted.includes(normalizedCandidate)) return 0.7;
    }
    return 0;
  }

  private roughSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) matches++;
    }
    return matches / longer.length;
  }
}
