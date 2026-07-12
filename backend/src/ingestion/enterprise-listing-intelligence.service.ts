import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayCategoryMapping } from '../motors-intelligence/entities/ebay-category-mapping.entity.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type { ListingGenerationResult } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import {
  buildGermanItemSpecifics,
  buildGermanListingDescription,
  buildGermanListingSubtitle,
  buildGermanListingTitle,
  type GermanListingInput,
  isLikelyGermanText,
  CATEGORY_KEYWORD_ROWS,
  resolveMotorsCategoryFromPart,
  validateGermanListing,
} from '../channels/ebay/ebay-german-listing.util.js';
import {
  applyAustralianSpelling,
  buildEnglishItemSpecifics,
  buildEnglishListingDescription,
  buildEnglishListingTitle,
  resolveMotorsCategoryFromPart as resolveEnglishCategory,
  shouldRebuildEnglishTitle,
  validateEnglishListing,
} from '../channels/ebay/ebay-english-listing.util.js';
import {
  alignGenerationAndYearRange,
  resolvePlatformGeneration,
} from '../fitment/platform-generation.util.js';

export type Marketplace = 'US' | 'DE' | 'AU';
export type ListingQualityProfile =
  | 'max_seo_comprehensive'
  | 'balanced'
  | 'creative_exploration';

interface EnterpriseOptions {
  marketplace: Marketplace;
  limit: number;
  aiBudgetListings: number;
  listingQualityProfile: ListingQualityProfile;
}

export interface SpecificFieldScore {
  field: string;
  required: boolean;
  present: boolean;
  inferred: boolean;
  confidence: number;
  source: 'source_data' | 'ai' | 'inferred' | 'missing';
}

export interface CompatibilityRow {
  make: string;
  model: string;
  year: string;
  trim?: string;
  engine?: string;
  drivetrain?: string;
  bodyStyle?: string;
  notes?: string;
  confidence: number;
  source: 'source_data' | 'rejected';
  rejectedReason?: string;
}

export interface ComplianceWarning {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export interface EnterpriseListingResult {
  productId: string;
  sku: string | null;
  optimizedTitle: string;
  subtitle: string | null;
  categoryId: string | null;
  categoryName: string | null;
  itemSpecifics: Record<string, string>;
  specificsScore: {
    coverage: number;
    requiredPresent: number;
    requiredTotal: number;
    details: SpecificFieldScore[];
  };
  compatibility: CompatibilityRow[];
  compatibilitySummary: {
    validRows: number;
    rejectedRows: number;
    confidence: number;
  };
  seoDescription: string;
  shortDescription: string;
  imageAnalysis: {
    count: number;
    qualityScore: number;
    readinessScore: number;
    findings: string[];
    recommendations: string[];
  };
  confidenceScores: {
    title: number;
    specifics: number;
    fitment: number;
    description: number;
    category: number;
    overall: number;
  };
  complianceWarnings: ComplianceWarning[];
  validationStatus: 'pass' | 'review' | 'block';
  missingDataReport: string[];
  uploadReadinessScore: number;
  finalUploadPayload: Record<string, unknown>;
}

export interface EnterpriseOptimizationResult {
  jobId: string;
  marketplace: Marketplace;
  totalProducts: number;
  aiGeneratedCount: number;
  blockedCount: number;
  reviewCount: number;
  passCount: number;
  averageUploadReadiness: number;
  listings: EnterpriseListingResult[];
}

@Injectable()
export class EnterpriseListingIntelligenceService {
  private readonly logger = new Logger(
    EnterpriseListingIntelligenceService.name,
  );

  /**
   * eBay Motors P&A category tree ID (US). The general EBAY_US tree is '0'
   * but Motors categories live on tree '100'.
   */
  private static readonly MOTORS_TREE_ID = '100';

  /** Category IDs from keyword-based Motors mapping (known leaf categories). */
  private static readonly KEYWORD_MOTORS_IDS = new Set(
    CATEGORY_KEYWORD_ROWS.map((r) => r.id),
  );

  /** Cached fallback leaf category under 6000. */
  private fallbackLeaf: { categoryId: string; categoryName: string } | null =
    null;

  constructor(
    @InjectRepository(PipelineJob)
    private readonly pipelineRepo: Repository<PipelineJob>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(EbayCategoryMapping)
    private readonly categoryMappingRepo: Repository<EbayCategoryMapping>,
    private readonly listingPipeline: ListingGenerationPipeline,
    private readonly taxonomy: EbayTaxonomyApiService,
  ) {}

  async generateForPipelineJob(
    jobId: string,
    rawOptions?: Partial<EnterpriseOptions>,
  ): Promise<EnterpriseOptimizationResult> {
    const limit = Math.min(Math.max(rawOptions?.limit ?? 250, 1), 2000);
    const options: EnterpriseOptions = {
      marketplace: rawOptions?.marketplace ?? 'US',
      limit,
      aiBudgetListings: Math.min(
        Math.max(rawOptions?.aiBudgetListings ?? limit, 0),
        2000,
      ),
      listingQualityProfile:
        rawOptions?.listingQualityProfile ?? 'max_seo_comprehensive',
    };

    const job = await this.pipelineRepo.findOneBy({ id: jobId });
    if (!job) {
      throw new NotFoundException(`Pipeline job ${jobId} not found`);
    }

    const products = await this.productRepo.find({
      where: { pipelineJobId: jobId },
      order: { sourceRow: 'ASC' },
      take: options.limit,
    });

    const aiProducts = products.slice(0, options.aiBudgetListings);
    const aiResults = aiProducts.length
      ? await this.listingPipeline.generateBatch(
          aiProducts.map((product) => ({
            productData: {
              brand: product.brand,
              mpn: product.mpn,
              part_type: product.partType,
              placement: product.placement,
              material: product.material,
              features: product.features,
              fitment: this.normalizeCompatibility(product.fitmentData).filter(
                (row) => row.source === 'source_data',
              ),
            },
            categoryName:
              product.categoryName ?? 'eBay Motors Parts & Accessories',
            condition: product.conditionLabel ?? product.conditionId ?? 'Used',
            options: {
              temperature: this.getTemperatureForProfile(
                options.listingQualityProfile,
              ),
              marketplace: options.marketplace,
              sellerCountry: product.location?.includes('DE') ? 'DE' : 'US',
            },
          })),
        )
      : [];

    const aiByProductId = new Map<string, ListingGenerationResult>();
    for (let i = 0; i < aiProducts.length; i++) {
      const ai = aiResults[i];
      if (ai) aiByProductId.set(aiProducts[i].id, ai);
    }

    const listings: EnterpriseListingResult[] = [];
    for (const product of products) {
      const listing = await this.buildEnterpriseListing(
        product,
        options.marketplace,
        aiByProductId.get(product.id) ?? null,
      );
      listings.push(listing);
    }
    const aiGeneratedCount = aiByProductId.size;

    const blockedCount = listings.filter(
      (l) => l.validationStatus === 'block',
    ).length;
    const reviewCount = listings.filter(
      (l) => l.validationStatus === 'review',
    ).length;
    const passCount = listings.filter(
      (l) => l.validationStatus === 'pass',
    ).length;
    const averageUploadReadiness = listings.length
      ? Math.round(
          (listings.reduce((sum, l) => sum + l.uploadReadinessScore, 0) /
            listings.length) *
            100,
        ) / 100
      : 0;

    return {
      jobId,
      marketplace: options.marketplace,
      totalProducts: products.length,
      aiGeneratedCount,
      blockedCount,
      reviewCount,
      passCount,
      averageUploadReadiness,
      listings,
    };
  }

  /** Max SEO + comprehensive optimization for a single catalog product. */
  async generateForProduct(
    productId: string,
    rawOptions?: Partial<EnterpriseOptions>,
  ): Promise<EnterpriseListingResult> {
    const product = await this.productRepo.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const options: EnterpriseOptions = {
      marketplace: rawOptions?.marketplace ?? 'US',
      limit: 1,
      aiBudgetListings: 1,
      listingQualityProfile:
        rawOptions?.listingQualityProfile ?? 'max_seo_comprehensive',
    };

    const aiResults = await this.listingPipeline.generateBatch([
      this.buildAiListingItem(product, options),
    ]);

    return this.buildEnterpriseListing(
      product,
      options.marketplace,
      aiResults[0] ?? null,
    );
  }

  /**
   * Batch variant of generateForProduct — makes ONE call to
   * listingPipeline.generateBatch covering all given products instead of one
   * call per product, so the OpenAI round-trip is shared across the batch.
   * Used by bulk listing optimization; single-product re-run still goes
   * through generateForProduct above.
   */
  async generateForProductsBatch(
    productIds: string[],
    rawOptions?: Partial<EnterpriseOptions>,
  ): Promise<Map<string, EnterpriseListingResult>> {
    if (productIds.length === 0) return new Map();

    const products = await this.productRepo.find({
      where: { id: In(productIds) },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    // Preserve caller order; skip any id that no longer resolves to a product.
    const ordered = productIds
      .map((id) => byId.get(id))
      .filter((p): p is CatalogProduct => !!p);

    const options: EnterpriseOptions = {
      marketplace: rawOptions?.marketplace ?? 'US',
      limit: 1,
      aiBudgetListings: 1,
      listingQualityProfile:
        rawOptions?.listingQualityProfile ?? 'max_seo_comprehensive',
    };

    const aiResults = await this.listingPipeline.generateBatch(
      ordered.map((product) => this.buildAiListingItem(product, options)),
    );

    const results = new Map<string, EnterpriseListingResult>();
    for (let i = 0; i < ordered.length; i++) {
      const listing = await this.buildEnterpriseListing(
        ordered[i],
        options.marketplace,
        aiResults[i] ?? null,
      );
      results.set(ordered[i].id, listing);
    }
    return results;
  }

  private buildAiListingItem(
    product: CatalogProduct,
    options: EnterpriseOptions,
  ): {
    productData: Record<string, unknown>;
    categoryName: string;
    condition: string;
    options: {
      temperature: number;
      marketplace: Marketplace;
      sellerCountry: string;
    };
  } {
    return {
      productData: {
        brand: product.brand,
        mpn: product.mpn,
        part_type: product.partType,
        placement: product.placement,
        material: product.material,
        features: product.features,
        fitment: this.normalizeCompatibility(product.fitmentData).filter(
          (row) => row.source === 'source_data',
        ),
      },
      categoryName: product.categoryName ?? 'eBay Motors Parts & Accessories',
      condition: product.conditionLabel ?? product.conditionId ?? 'Used',
      options: {
        temperature: this.getTemperatureForProfile(
          options.listingQualityProfile,
        ),
        marketplace: options.marketplace,
        sellerCountry: product.location?.includes('DE') ? 'DE' : 'US',
      },
    };
  }

  private async buildEnterpriseListing(
    product: CatalogProduct,
    marketplace: Marketplace,
    aiListing: ListingGenerationResult | null,
  ): Promise<EnterpriseListingResult> {
    const baseSpecifics = this.extractBaseSpecifics(product);
    const category = await this.resolvePublishableCategory(product);
    let categoryId = category.categoryId;
    let categoryName = category.categoryName;
    const requiredSpecificNames = await this.getRequiredAspectsSafe(categoryId);

    let mergedSpecifics = { ...baseSpecifics };
    let specificsEvaluation = this.evaluateSpecifics(
      mergedSpecifics,
      requiredSpecificNames,
    );
    const compatibility = this.normalizeCompatibility(product.fitmentData);
    const compatibilityValidRows = compatibility.filter(
      (row) => row.source === 'source_data',
    );
    const compatibilityRejected =
      compatibility.length - compatibilityValidRows.length;
    const fitmentConfidence =
      compatibilityValidRows.length > 0
        ? Math.round(
            (compatibilityValidRows.reduce(
              (sum, row) => sum + row.confidence,
              0,
            ) /
              compatibilityValidRows.length) *
              100,
          ) / 100
        : 0;

    let optimizedTitle = this.buildFallbackTitle(product, marketplace);
    let subtitle: string | null = null;
    let seoDescription = this.buildFallbackDescription(
      product,
      marketplace,
      compatibilityValidRows,
    );
    let shortDescription = this.buildShortDescription(product, marketplace);
    let aiTitleConfidence = 0.6;
    let aiDescriptionConfidence = 0.55;

    if (aiListing) {
      try {
        optimizedTitle = this.cleanTitle(aiListing.title, marketplace);
        subtitle =
          typeof aiListing.subtitle === 'string'
            ? aiListing.subtitle.slice(0, 55)
            : null;
        seoDescription = this.cleanDescription(
          aiListing.description,
          product,
          marketplace,
        );
        shortDescription = this.buildShortDescriptionFromAi(
          aiListing.bulletPoints,
          product,
          marketplace,
        );
        mergedSpecifics = this.mergeAiSpecifics(
          baseSpecifics,
          aiListing.itemSpecifics,
        );
        specificsEvaluation = this.evaluateSpecifics(
          mergedSpecifics,
          requiredSpecificNames,
        );
        aiTitleConfidence = 0.85;
        aiDescriptionConfidence = 0.82;
      } catch (error) {
        this.logger.warn(
          `AI generation failed for product ${product.id}: ${String(error)}`,
        );
      }
    }

    if (marketplace === 'DE') {
      const germanInput = this.toGermanListingInput(
        product,
        compatibilityValidRows,
      );
      const categoryHint = resolveMotorsCategoryFromPart(
        product.partType,
        product.placement,
      );
      if (
        categoryHint &&
        categoryId &&
        categoryHint.categoryId !== categoryId
      ) {
        const exteriorIds = new Set(['33697', '174105']);
        const interiorIds = new Set(['33695', '33717', '174090']);
        if (
          interiorIds.has(categoryHint.categoryId) &&
          exteriorIds.has(categoryId)
        ) {
          categoryId = categoryHint.categoryId;
          categoryName = categoryHint.categoryName;
        }
      }

      if (!isLikelyGermanText(optimizedTitle)) {
        optimizedTitle = buildGermanListingTitle(germanInput);
        aiTitleConfidence = Math.max(aiTitleConfidence, 0.88);
      }
      if (!subtitle) {
        subtitle = buildGermanListingSubtitle(germanInput);
      }
      const plainDescLen = seoDescription.replace(/<[^>]+>/g, '').trim().length;
      if (plainDescLen < 120 || !isLikelyGermanText(seoDescription)) {
        seoDescription = buildGermanListingDescription(germanInput);
        aiDescriptionConfidence = Math.max(aiDescriptionConfidence, 0.86);
      }
      mergedSpecifics = {
        ...mergedSpecifics,
        ...buildGermanItemSpecifics(germanInput),
      };
      specificsEvaluation = this.evaluateSpecifics(
        mergedSpecifics,
        requiredSpecificNames,
      );
      shortDescription = this.buildShortDescriptionFromAi(
        [optimizedTitle.split(' ').slice(0, 8).join(' ')],
        product,
        marketplace,
      );
    } else if (marketplace === 'US' || marketplace === 'AU') {
      const englishInput = this.toEnglishListingInput(
        product,
        compatibilityValidRows,
      );
      const categoryHint = resolveEnglishCategory(
        product.partType,
        product.placement,
      );
      if (
        categoryHint &&
        categoryId &&
        categoryHint.categoryId !== categoryId
      ) {
        const exteriorIds = new Set(['33697', '174105']);
        const interiorIds = new Set(['33695', '33717', '174090']);
        if (
          interiorIds.has(categoryHint.categoryId) &&
          exteriorIds.has(categoryId)
        ) {
          categoryId = categoryHint.categoryId;
          categoryName = categoryHint.categoryName;
        }
      }

      if (
        shouldRebuildEnglishTitle(optimizedTitle, englishInput) ||
        optimizedTitle.length < 24
      ) {
        optimizedTitle = buildEnglishListingTitle(englishInput);
        aiTitleConfidence = Math.max(aiTitleConfidence, 0.88);
      }
      if (marketplace === 'AU') {
        optimizedTitle = applyAustralianSpelling(optimizedTitle);
      }

      const plainDescLen = seoDescription.replace(/<[^>]+>/g, '').trim().length;
      if (plainDescLen < 120) {
        seoDescription = buildEnglishListingDescription(
          englishInput,
          marketplace,
        );
        aiDescriptionConfidence = Math.max(aiDescriptionConfidence, 0.86);
      } else if (marketplace === 'AU') {
        seoDescription = applyAustralianSpelling(seoDescription);
      }

      mergedSpecifics = {
        ...mergedSpecifics,
        ...buildEnglishItemSpecifics(englishInput),
      };
      specificsEvaluation = this.evaluateSpecifics(
        mergedSpecifics,
        requiredSpecificNames,
      );
    }

    const imageAnalysis = this.evaluateImages(product.imageUrls);
    const complianceWarnings = this.buildComplianceWarnings({
      title: optimizedTitle,
      categoryId,
      requiredSpecifics: specificsEvaluation.requiredTotal,
      requiredSpecificsPresent: specificsEvaluation.requiredPresent,
      compatibilityValidRows: compatibilityValidRows.length,
      imageCount: imageAnalysis.count,
      imageQuality: imageAnalysis.qualityScore,
      hasPrice: product.price != null && Number(product.price) > 0,
      marketplace,
      product,
      description: seoDescription,
      itemSpecifics: mergedSpecifics,
    });

    const errors = complianceWarnings.filter(
      (i) => i.severity === 'error',
    ).length;
    const warnings = complianceWarnings.filter(
      (i) => i.severity === 'warning',
    ).length;
    const missingDataReport = this.buildMissingDataReport(
      product,
      specificsEvaluation.details,
      compatibilityValidRows.length,
    );

    const confidenceScores = {
      title: aiTitleConfidence,
      specifics: specificsEvaluation.coverage,
      fitment: fitmentConfidence,
      description: aiDescriptionConfidence,
      category: category.confidence,
      overall: this.round(
        aiTitleConfidence * 0.2 +
          specificsEvaluation.coverage * 0.25 +
          fitmentConfidence * 0.25 +
          aiDescriptionConfidence * 0.15 +
          category.confidence * 0.15,
      ),
    };

    const uploadReadinessScore = this.round(
      Math.max(0, confidenceScores.overall - errors * 0.25 - warnings * 0.05),
    );

    const validationStatus: 'pass' | 'review' | 'block' =
      errors > 0 ? 'block' : uploadReadinessScore < 0.75 ? 'review' : 'pass';

    return {
      productId: product.id,
      sku: product.sku,
      optimizedTitle,
      subtitle,
      categoryId,
      categoryName,
      itemSpecifics: mergedSpecifics,
      specificsScore: {
        coverage: specificsEvaluation.coverage,
        requiredPresent: specificsEvaluation.requiredPresent,
        requiredTotal: specificsEvaluation.requiredTotal,
        details: specificsEvaluation.details,
      },
      compatibility,
      compatibilitySummary: {
        validRows: compatibilityValidRows.length,
        rejectedRows: compatibilityRejected,
        confidence: fitmentConfidence,
      },
      seoDescription,
      shortDescription,
      imageAnalysis,
      confidenceScores,
      complianceWarnings,
      validationStatus,
      missingDataReport,
      uploadReadinessScore,
      finalUploadPayload: this.buildFinalPayload({
        product,
        marketplace,
        categoryId,
        optimizedTitle,
        subtitle,
        seoDescription,
        itemSpecifics: mergedSpecifics,
        compatibility: compatibilityValidRows,
      }),
    };
  }

  private mergeAiSpecifics(
    baseSpecifics: Record<string, string>,
    aiSpecifics: Record<string, string>,
  ): Record<string, string> {
    const merged: Record<string, string> = { ...baseSpecifics };
    if (!aiSpecifics || typeof aiSpecifics !== 'object') {
      return merged;
    }

    for (const [rawKey, rawValue] of Object.entries(aiSpecifics)) {
      const key = String(rawKey ?? '').trim();
      const value = String(rawValue ?? '').trim();
      if (!key || !value) continue;
      if (value.length > 120) continue;
      if (!merged[key]) {
        merged[key] = value;
      }
    }
    return merged;
  }

  /**
   * Resolve a publishable eBay Motors leaf category for pipeline persistence.
   * This is intentionally public so the ingestion worker can normalize the
   * category before catalog/listing rows are saved, rather than relying on the
   * later optional optimization pass to repair bad taxonomy output.
   */
  async resolvePublishableCategory(product: CatalogProduct): Promise<{
    categoryId: string | null;
    categoryName: string | null;
    confidence: number;
  }> {
    const candidate = product.categoryId?.trim();
    if (candidate) {
      const isValid = await this.isMotorsCategory(candidate);
      if (isValid) {
        return {
          categoryId: candidate,
          categoryName: product.categoryName,
          confidence: 0.95,
        };
      }
      this.logger.warn(
        `Category ${candidate} (${product.categoryName ?? '?'}) for SKU ${product.sku ?? '?'} is not a known Motors category — will re-resolve`,
      );
    }

    // Fast path: keyword-based matching (no API call, deterministic)
    const keywordMatch = resolveMotorsCategoryFromPart(
      product.partType,
      product.placement,
    );
    if (keywordMatch) {
      return { ...keywordMatch, confidence: 0.85 };
    }

    // Taxonomy API: try progressively broader queries; accept only
    // categories whose ancestor chain includes 6000 (Parts & Accessories).
    const queries = [
      [product.brand, product.partType, product.title]
        .filter(Boolean)
        .join(' '),
      product.partType ? `automotive ${product.partType}` : null,
      product.partType ?? null,
    ].filter(Boolean) as string[];

    for (const query of queries) {
      const match = await this.findMotorsLeafFromSuggestions(query);
      if (match) return { ...match, confidence: 0.75 };
    }

    // Last resort: find a real leaf under 6000 via the subtree API.
    const fallback = await this.getFallbackLeafCategory();
    return {
      categoryId: fallback.categoryId,
      categoryName: fallback.categoryName,
      confidence: 0.3,
    };
  }

  /**
   * Query eBay taxonomy for category suggestions and return the first one
   * whose ancestor chain includes category 6000 (Parts & Accessories).
   * Taxonomy suggestions are leaf-level by design, so this guarantees a
   * valid Motors leaf category.
   */
  private async findMotorsLeafFromSuggestions(
    query: string,
  ): Promise<{ categoryId: string; categoryName: string } | null> {
    try {
      const suggestions = await this.taxonomy.getCategorySuggestions(
        query,
        EnterpriseListingIntelligenceService.MOTORS_TREE_ID,
      );
      for (const s of suggestions) {
        const catId = s.category?.categoryId;
        if (!catId) continue;
        const underMotors = s.categoryTreeNodeAncestors?.some(
          (a) => a.categoryId === '6000',
        );
        if (underMotors) {
          return {
            categoryId: catId,
            categoryName: s.category.categoryName,
          };
        }
      }
    } catch {
      // ignore — caller will try the next query or fallback
    }
    return null;
  }

  /**
   * Find a safe leaf category under 6000 via the subtree API.
   * Uses BFS to find the shallowest leaf. Result is cached for the
   * lifetime of the service instance.
   */
  private async getFallbackLeafCategory(): Promise<{
    categoryId: string;
    categoryName: string;
  }> {
    if (this.fallbackLeaf) return this.fallbackLeaf;

    try {
      const subtree = await this.taxonomy.getCategorySubtree(
        '6000',
        EnterpriseListingIntelligenceService.MOTORS_TREE_ID,
      );
      const queue = [subtree.categorySubtreeNode];
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (node.leafCategoryTreeNode) {
          this.fallbackLeaf = {
            categoryId: node.category.categoryId,
            categoryName: node.category.categoryName,
          };
          this.logger.log(
            `Resolved fallback Motors leaf: ${this.fallbackLeaf.categoryId} (${this.fallbackLeaf.categoryName})`,
          );
          return this.fallbackLeaf;
        }
        if (node.childCategoryTreeNodes) {
          queue.push(...node.childCategoryTreeNodes);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to resolve fallback Motors leaf from subtree: ${(err as Error).message}`,
      );
    }

    // Hardcoded emergency fallback must itself be a publishable leaf.
    // Category 6000 is the Motors P&A root and eBay Inventory rejects it.
    this.fallbackLeaf = {
      categoryId: '9886',
      categoryName: 'Other Car & Truck Parts & Accessories',
    };
    return this.fallbackLeaf;
  }

  /**
   * Check whether a category ID is a known eBay Motors category.
   * Checks the cached ebay_category_mappings table AND the static
   * keyword-based Motors category IDs. Returns false for categories
   * that are clearly non-automotive (Guitars, LEGO, etc.).
   */
  private async isMotorsCategory(categoryId: string): Promise<boolean> {
    try {
      // Check keyword-mapped IDs first (fast, no DB call)
      if (
        EnterpriseListingIntelligenceService.KEYWORD_MOTORS_IDS.has(categoryId)
      ) {
        return true;
      }

      const mapping = await this.categoryMappingRepo.findOne({
        where: { ebayCategoryId: categoryId },
      });
      if (mapping) return mapping.isMotorsCategory;

      // Not in mapping table or keyword rows — reject by default.
      // The caller will re-resolve via the taxonomy API.
      return false;
    } catch {
      return false;
    }
  }

  private async getRequiredAspectsSafe(
    categoryId: string | null,
  ): Promise<string[]> {
    if (!categoryId) return ['Brand', 'Manufacturer Part Number'];
    try {
      const aspects = await this.taxonomy.getItemAspectsForCategory(categoryId);
      const required = aspects
        .filter((aspect) => aspect.aspectConstraint?.aspectRequired)
        .map((aspect) => aspect.localizedAspectName)
        .filter(Boolean);
      if (required.length > 0) return required;
    } catch {
      // fallback below
    }
    return ['Brand', 'Manufacturer Part Number'];
  }

  private extractBaseSpecifics(
    product: CatalogProduct,
  ): Record<string, string> {
    const entries: Array<[string, string | null | undefined]> = [
      ['Brand', product.brand],
      ['Manufacturer Part Number', product.mpn],
      ['Interchange Part Number', product.oemPartNumber],
      ['OE/OEM Part Number', product.oemPartNumber],
      ['Type', product.partType],
      ['Placement on Vehicle', product.placement],
      ['Material', product.material],
      ['Features', product.features],
      ['Country/Region of Manufacture', product.countryOfOrigin],
      ['UPC', product.upc],
      ['EAN', product.ean],
      ['Condition', product.conditionLabel ?? product.conditionId],
    ];
    const specifics: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (value && String(value).trim()) specifics[key] = String(value).trim();
    }
    return specifics;
  }

  private evaluateSpecifics(
    itemSpecifics: Record<string, string>,
    requiredFields: string[],
  ): {
    coverage: number;
    requiredPresent: number;
    requiredTotal: number;
    details: SpecificFieldScore[];
  } {
    const requiredSet = new Set(requiredFields);
    const knownFields = new Set([
      ...requiredFields,
      'Interchange Part Number',
      'OE/OEM Part Number',
      'Type',
      'Placement on Vehicle',
      'Material',
      'Features',
      'Country/Region of Manufacture',
      'UPC',
      'EAN',
      'Condition',
    ]);

    const details: SpecificFieldScore[] = [];
    let requiredPresent = 0;
    for (const field of knownFields) {
      const value = itemSpecifics[field];
      const present = Boolean(value && value.trim());
      const required = requiredSet.has(field);
      if (required && present) requiredPresent++;
      details.push({
        field,
        required,
        present,
        inferred: false,
        confidence: present ? 0.95 : 0,
        source: present ? 'source_data' : 'missing',
      });
    }

    const requiredTotal = requiredFields.length || 1;
    const coverage = this.round(requiredPresent / requiredTotal);
    return { coverage, requiredPresent, requiredTotal, details };
  }

  private normalizeCompatibility(
    fitmentData: Record<string, unknown>[] | null,
  ): CompatibilityRow[] {
    if (!Array.isArray(fitmentData) || fitmentData.length === 0) return [];

    const rows: CompatibilityRow[] = [];
    for (const raw of fitmentData) {
      const make = String(raw['Make'] ?? raw['make'] ?? '').trim();
      const model = String(raw['Model'] ?? raw['model'] ?? '').trim();
      const year = String(raw['Year'] ?? raw['year'] ?? '').trim();
      const trim = String(raw['Trim'] ?? raw['trim'] ?? '').trim() || undefined;
      const engine =
        String(raw['Engine'] ?? raw['engine'] ?? '').trim() || undefined;
      const drivetrain =
        String(raw['Drivetrain'] ?? raw['drivetrain'] ?? '').trim() ||
        undefined;
      const bodyStyle =
        String(raw['Body Style'] ?? raw['bodyStyle'] ?? '').trim() || undefined;

      const yearNum = Number(year);
      const yearValid =
        Number.isFinite(yearNum) &&
        yearNum >= 1900 &&
        yearNum <= new Date().getFullYear() + 2;
      if (!make || !model || !year || !yearValid) {
        rows.push({
          make,
          model,
          year,
          trim,
          engine,
          drivetrain,
          bodyStyle,
          confidence: 0,
          source: 'rejected',
          rejectedReason: 'Missing or invalid Year/Make/Model',
        });
        continue;
      }

      rows.push({
        make,
        model,
        year,
        trim,
        engine,
        drivetrain,
        bodyStyle,
        confidence: this.round(trim || engine ? 0.92 : 0.82),
        source: 'source_data',
      });
    }
    return rows;
  }

  private evaluateImages(imageUrls: string[]): {
    count: number;
    qualityScore: number;
    readinessScore: number;
    findings: string[];
    recommendations: string[];
  } {
    const findings: string[] = [];
    const recommendations: string[] = [];
    const count = Array.isArray(imageUrls)
      ? imageUrls.filter(Boolean).length
      : 0;

    if (count === 0) findings.push('No product images detected');
    if (count > 0 && count < 3)
      findings.push('Low image count for high-conversion Motors listing');
    if (count > 0 && count < 6) {
      findings.push(
        'Interior/trim parts typically need 6–12 photos (front, back, clips, label, wear)',
      );
    }
    if (
      imageUrls.some((url) =>
        /watermark|placeholder|default|logo-only/i.test(url),
      )
    ) {
      findings.push('Potential watermark/placeholder style image detected');
    }

    if (count < 6)
      recommendations.push(
        'Add 6-12 images: front, side, rear, labels, connectors, defects',
      );
    recommendations.push(
      'Prioritize first image with clear part angle on clean background',
    );
    recommendations.push(
      'Add close-up of OEM/MPN label to improve buyer trust and returns reduction',
    );

    let qualityScore = 0.85;
    if (count === 0) qualityScore = 0;
    else if (count < 3) qualityScore = 0.55;
    else if (count < 6) qualityScore = 0.75;

    if (findings.some((f) => f.includes('watermark'))) qualityScore -= 0.1;
    qualityScore = this.round(Math.max(0, qualityScore));

    const readinessScore = this.round(
      Math.max(0, qualityScore - (count === 0 ? 0.4 : 0)),
    );
    return { count, qualityScore, readinessScore, findings, recommendations };
  }

  private buildComplianceWarnings(input: {
    title: string;
    categoryId: string | null;
    requiredSpecifics: number;
    requiredSpecificsPresent: number;
    compatibilityValidRows: number;
    imageCount: number;
    imageQuality: number;
    hasPrice: boolean;
    marketplace?: Marketplace;
    product?: CatalogProduct;
    description?: string;
    itemSpecifics?: Record<string, string>;
  }): ComplianceWarning[] {
    const issues: ComplianceWarning[] = [];
    if (!input.title || input.title.length > 80) {
      issues.push({
        code: 'TITLE_INVALID',
        severity: 'error',
        field: 'title',
        message: 'Title missing or exceeds 80 characters',
      });
    }
    if (!input.categoryId) {
      issues.push({
        code: 'CATEGORY_MISSING',
        severity: 'error',
        field: 'categoryId',
        message: 'Category is missing',
      });
    }
    if (input.requiredSpecificsPresent < input.requiredSpecifics) {
      issues.push({
        code: 'REQUIRED_SPECIFICS_MISSING',
        severity: 'error',
        field: 'itemSpecifics',
        message: `Required specifics incomplete (${input.requiredSpecificsPresent}/${input.requiredSpecifics})`,
      });
    }
    if (input.compatibilityValidRows === 0) {
      issues.push({
        code: 'FITMENT_MISSING',
        severity: 'warning',
        field: 'compatibility',
        message:
          'No validated fitment rows; listing should be routed to review',
      });
    }
    if (input.imageCount === 0) {
      issues.push({
        code: 'IMAGE_MISSING',
        severity: 'error',
        field: 'images',
        message: 'At least one product image is required',
      });
    } else if (input.imageQuality < 0.65) {
      issues.push({
        code: 'IMAGE_QUALITY_LOW',
        severity: 'warning',
        field: 'images',
        message: 'Image quality/readiness below recommended threshold',
      });
    }
    if (!input.hasPrice) {
      issues.push({
        code: 'PRICE_MISSING',
        severity: 'error',
        field: 'price',
        message: 'Positive price is required for upload',
      });
    }

    if (
      input.marketplace === 'DE' &&
      input.product &&
      input.description &&
      input.itemSpecifics
    ) {
      const deValidation = validateGermanListing({
        title: input.title,
        description: input.description,
        itemSpecifics: input.itemSpecifics,
        categoryId: input.categoryId,
        categoryName: input.product.categoryName,
        partType: input.product.partType,
        placement: input.product.placement,
        mpn: input.product.mpn,
        oemPartNumber: input.product.oemPartNumber,
      });
      for (const issue of deValidation.issues) {
        issues.push({
          code: issue.code,
          severity: issue.severity,
          field: issue.field,
          message: issue.message,
        });
      }
    }

    if (
      (input.marketplace === 'US' || input.marketplace === 'AU') &&
      input.product &&
      input.description &&
      input.itemSpecifics
    ) {
      const enValidation = validateEnglishListing({
        title: input.title,
        description: input.description,
        itemSpecifics: input.itemSpecifics,
        categoryId: input.categoryId,
        categoryName: input.product.categoryName,
        partType: input.product.partType,
        placement: input.product.placement,
        mpn: input.product.mpn,
        oemPartNumber: input.product.oemPartNumber,
      });
      for (const issue of enValidation.issues) {
        issues.push({
          code: issue.code,
          severity: issue.severity,
          field: issue.field,
          message: issue.message,
        });
      }
    }

    return issues;
  }

  private toEnglishListingInput(
    product: CatalogProduct,
    fitmentRows: CompatibilityRow[],
  ) {
    const german = this.toGermanListingInput(product, fitmentRows);
    return {
      brand: german.brand,
      model: german.model,
      partType: german.partType,
      placement: german.placement,
      mpn: german.mpn,
      oemPartNumber: german.oemPartNumber,
      condition: german.condition,
      material: german.material,
      donorVehicle: german.donorVehicle,
      yearRange: german.yearRange,
      generation: german.generation,
      fitmentRows: german.fitmentRows,
      fitmentConfirmed: german.fitmentConfirmed,
      sellerCountry: german.sellerCountry,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
    };
  }

  private toGermanListingInput(
    product: CatalogProduct,
    fitmentRows: CompatibilityRow[],
  ): GermanListingInput {
    const decoded = product.donorVinDecoded;
    const donorYear = decoded?.['year'] ? String(decoded['year']) : '';
    const donorMake = decoded?.['make']
      ? String(decoded['make'])
      : (product.brand ?? '');
    const donorModel = decoded?.['model'] ? String(decoded['model']) : '';
    const donorVehicle =
      [donorYear, donorMake, donorModel].filter(Boolean).join(' ').trim() ||
      undefined;

    const years = fitmentRows
      .map((r) => Number(r.year))
      .filter((y) => Number.isFinite(y));
    const yearRangeFromFitment =
      years.length >= 2
        ? `${Math.min(...years)}-${Math.max(...years)}`
        : years.length === 1
          ? String(years[0])
          : donorYear || undefined;

    const platform = donorYear
      ? resolvePlatformGeneration(
          donorMake,
          donorModel || product.brand,
          donorYear,
        )
      : null;
    const aligned = alignGenerationAndYearRange({
      generation: platform?.code,
      yearRange: yearRangeFromFitment,
      make: donorMake || product.brand,
      model: donorModel || fitmentRows[0]?.model,
      anchorYear: donorYear,
      fitmentYears: fitmentRows.map((r) => r.year),
    });

    return {
      brand: product.brand,
      model: donorModel || fitmentRows[0]?.model || undefined,
      partType: product.partType,
      placement: product.placement,
      mpn: product.mpn,
      oemPartNumber: product.oemPartNumber ?? product.mpn,
      condition: product.conditionLabel ?? product.conditionId,
      material: product.material,
      donorVehicle,
      yearRange: aligned.yearRange,
      generation: aligned.generation || undefined,
      fitmentRows: fitmentRows.map((r) => ({
        year: r.year,
        make: r.make,
        model: r.model,
        trim: r.trim,
      })),
      fitmentConfirmed:
        fitmentRows.length > 0 &&
        product.fitmentConfidence != null &&
        Number(product.fitmentConfidence) >= 0.85,
      sellerCountry: product.location?.toUpperCase().includes('DE')
        ? 'DE'
        : 'US',
      categoryId: product.categoryId,
      categoryName: product.categoryName,
    };
  }

  private buildMissingDataReport(
    product: CatalogProduct,
    specifics: SpecificFieldScore[],
    compatibilityRows: number,
  ): string[] {
    const missing = specifics
      .filter((s) => s.required && !s.present)
      .map((s) => `Missing required specific: ${s.field}`);
    if (!product.description || product.description.trim().length < 60) {
      missing.push('Description is too short for production listing quality');
    }
    if (compatibilityRows === 0)
      missing.push('No validated compatibility rows');
    if (!product.imageUrls?.length) missing.push('No images provided');
    return missing;
  }

  private cleanTitle(title: string, marketplace: Marketplace): string {
    const normalized = title.replace(/\s+/g, ' ').trim();
    const local = this.localizeText(normalized, marketplace);
    return local.slice(0, 80);
  }

  private cleanDescription(
    description: string,
    product: CatalogProduct,
    marketplace: Marketplace,
  ): string {
    if (!description || description.trim().length < 250) {
      return this.buildFallbackDescription(product, marketplace, []);
    }
    return this.localizeText(
      this.ensureEnterpriseDescriptionQuality(description),
      marketplace,
    );
  }

  private ensureEnterpriseDescriptionQuality(description: string): string {
    const normalized = description.trim();
    const requiredSections = [
      'Overview',
      'Features',
      'Specifications',
      'Fitment',
      'Condition Notes',
    ];
    const missing = requiredSections.filter(
      (section) =>
        !new RegExp(`<h3>\\s*${section}\\s*</h3>`, 'i').test(normalized),
    );
    if (missing.length === 0) {
      return normalized;
    }

    // Fallback appends explicit sections so all enterprise listings stay structurally consistent.
    return `${normalized}
<h3>Condition Notes</h3>
<p>Please review product photos, part numbers, and fitment details before purchase to confirm compatibility.</p>`;
  }

  private buildFallbackTitle(
    product: CatalogProduct,
    marketplace: Marketplace,
  ): string {
    if (marketplace === 'DE') {
      return buildGermanListingTitle(this.toGermanListingInput(product, []));
    }
    if (marketplace === 'US' || marketplace === 'AU') {
      const title = buildEnglishListingTitle(
        this.toEnglishListingInput(product, []),
      );
      return marketplace === 'AU' ? applyAustralianSpelling(title) : title;
    }
    const parts = [
      product.brand,
      product.partType,
      product.mpn,
      product.placement ? `for ${product.placement}` : null,
    ]
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(' ');
    return this.cleanTitle(
      parts || product.title || 'Automotive Part',
      marketplace,
    );
  }

  private buildFallbackDescription(
    product: CatalogProduct,
    marketplace: Marketplace,
    compatibility: CompatibilityRow[],
  ): string {
    if (marketplace === 'DE') {
      return buildGermanListingDescription(
        this.toGermanListingInput(product, compatibility),
      );
    }
    if (marketplace === 'US' || marketplace === 'AU') {
      return buildEnglishListingDescription(
        this.toEnglishListingInput(product, compatibility),
        marketplace,
      );
    }

    const compatibilityText = compatibility.length
      ? compatibility
          .slice(0, 10)
          .map(
            (c) =>
              `${c.year} ${c.make} ${c.model}${c.trim ? ` ${c.trim}` : ''}`,
          )
          .join(', ')
      : 'Please verify fitment before purchase.';

    const body = `<h3>Product Overview</h3>
<p>${product.title}</p>
<h3>Technical Specifications</h3>
<ul>
  <li>Brand: ${product.brand ?? 'Not specified'}</li>
  <li>MPN: ${product.mpn ?? 'Not specified'}</li>
  <li>Type: ${product.partType ?? 'Not specified'}</li>
  <li>Condition: ${product.conditionLabel ?? product.conditionId ?? 'Not specified'}</li>
</ul>
<h3>Compatibility Summary</h3>
<p>${compatibilityText}</p>
<h3>Important Notices</h3>
<p>Please match part numbers and vehicle details prior to ordering.</p>`;
    return this.localizeText(body, marketplace);
  }

  private buildShortDescription(
    product: CatalogProduct,
    marketplace: Marketplace,
  ): string {
    const short =
      `${product.brand ?? 'Auto Part'} ${product.partType ?? ''} ${product.mpn ?? ''}`.trim();
    return this.localizeText(short.slice(0, 160), marketplace);
  }

  private buildShortDescriptionFromAi(
    bulletPoints: string[],
    product: CatalogProduct,
    marketplace: Marketplace,
  ): string {
    if (!Array.isArray(bulletPoints) || bulletPoints.length === 0) {
      return this.buildShortDescription(product, marketplace);
    }
    return this.localizeText(
      bulletPoints.slice(0, 3).join(' | ').slice(0, 220),
      marketplace,
    );
  }

  private localizeText(text: string, marketplace: Marketplace): string {
    if (marketplace === 'DE') {
      if (isLikelyGermanText(text)) return text;
      return text;
    }
    if (marketplace === 'AU') {
      return text
        .replace(/\bmiles\b/gi, 'kilometres')
        .replace(/\binches\b/gi, 'mm')
        .replace(/\bshipping\b/gi, 'shipping (AU)');
    }
    return text;
  }

  private buildFinalPayload(input: {
    product: CatalogProduct;
    marketplace: Marketplace;
    categoryId: string | null;
    optimizedTitle: string;
    subtitle: string | null;
    seoDescription: string;
    itemSpecifics: Record<string, string>;
    compatibility: CompatibilityRow[];
  }): Record<string, unknown> {
    return {
      marketplace: input.marketplace,
      sku: input.product.sku,
      title: input.optimizedTitle,
      subtitle: input.subtitle,
      categoryId: input.categoryId,
      conditionId: input.product.conditionId,
      description: input.seoDescription,
      price: input.product.price,
      quantity: input.product.quantity,
      imageUrls: input.product.imageUrls,
      itemSpecifics: input.itemSpecifics,
      compatibility: input.compatibility.map((row) => ({
        Make: row.make,
        Model: row.model,
        Year: row.year,
        Trim: row.trim,
        Engine: row.engine,
        Drivetrain: row.drivetrain,
        BodyStyle: row.bodyStyle,
      })),
      shippingProfileName: input.product.shippingProfile,
      returnProfileName: input.product.returnProfile,
      paymentProfileName: input.product.paymentProfile,
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private getTemperatureForProfile(profile: ListingQualityProfile): number {
    if (profile === 'creative_exploration') return 0.65;
    if (profile === 'balanced') return 0.4;
    return 0.25;
  }

  private getContentRequirements(profile: ListingQualityProfile): string[] {
    if (profile === 'creative_exploration') {
      return [
        'Use varied phrasing while staying factual.',
        'Introduce stronger merchandising language where claims are verifiable.',
      ];
    }
    if (profile === 'balanced') {
      return [
        'Blend SEO keyword coverage with concise readability.',
        'Keep technical specifics clear and structured.',
      ];
    }
    return [
      'Prioritize SEO completeness, technical accuracy, and buyer confidence.',
      'Produce comprehensive, conversion-focused listing copy with explicit fitment caveats.',
    ];
  }
}
