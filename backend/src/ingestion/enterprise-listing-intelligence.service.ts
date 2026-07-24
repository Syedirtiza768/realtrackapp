import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PipelineJob } from './entities/pipeline-job.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { EbayCategoryMapping } from '../motors-intelligence/entities/ebay-category-mapping.entity.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type { ListingGenerationResult } from '../common/openai/pipelines/listing-generation.pipeline.js';
import {
  TitlePositionPartNamePipeline,
  type TitlePositionPartNameResult,
} from '../common/openai/pipelines/title-position-part-name.pipeline.js';
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
import { buildStructuredEbayTitle } from '../channels/ebay/ebay-listing-text.util.js';
import {
  alignGenerationAndYearRange,
  resolvePlatformGeneration,
} from '../fitment/platform-generation.util.js';
import { derivePartNameFromTitle } from '../listings/utils/derive-part-name-from-title.js';

/** Item/store country for listing HTML — Dubai-based sellers default to AE. */
function resolveSellerCountryFromLocation(
  location: string | null | undefined,
): string {
  const loc = (location ?? '').toUpperCase();
  if (loc.includes('DE') || loc.includes('GERMANY')) return 'DE';
  if (loc.includes('AU') || loc.includes('AUSTRALIA')) return 'AU';
  if (
    loc.includes('AE') ||
    loc.includes('DUBAI') ||
    loc.includes('UAE') ||
    loc.includes('UNITED ARAB')
  ) {
    return 'AE';
  }
  // RealTrack warehouses ship from Dubai even when marketplace is US/AU.
  return 'AE';
}

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

  private static readonly UNTRUSTED_GENERIC_PART_IDENTITIES = new Set([
    'automotive',
    'misc',
    'miscellaneous',
    'not specified',
    'oem part',
    'other',
    'part',
    'parts',
    'unknown',
  ]);

  /**
   * Categories that are technically under the eBay Motors tree (ancestor
   * chain includes 6000) but are the wrong vertical for a car/truck parts
   * business — e.g. 6024 "Motorcycles". isMotorsCategory's ancestor-chain
   * check treats these as valid, so once a product gets stuck on one
   * (typically via getFallbackLeafCategory's BFS landing on the shallowest
   * leaf under 6000, without regard for relevance — seen live: 318 of 766
   * products in job 572e96dd got category 6024 during a Taxonomy API
   * rate-limiting incident), it never self-corrects: the category "passes"
   * validation on every later publish attempt, and eBay rejects publish with
   * a misleading "Seller Provided Title Value is missing" (errorId 25016)
   * because the inventory item's Motors-parts aspects don't match what a
   * Motorcycles-category listing expects. Force re-resolution instead.
   *
   * 6000/262124/262320 are broad/root categories rather than publishable,
   * specific car/truck parts leaves for this pipeline.
   *
   * 6024 = Motorcycles. 6126 = Austin (a defunct British car-make category
   * under eBay's Motors tree) — same job also had 75 products stuck there;
   * a make-specific category is only valid when it actually matches the
   * product's make, and this pipeline's product data never involves Austin.
   */
  private static readonly WRONG_VERTICAL_MOTORS_IDS = new Set([
    '6000',
    '6024',
    '6126',
    '262124',
    '262320',
  ]);

  /** Cached fallback leaf category under 6000. */
  private fallbackLeaf: { categoryId: string; categoryName: string } | null =
    null;

  /**
   * Cache of Taxonomy API category-suggestion results, keyed by normalized
   * query text. Many products in the same import share a part type (e.g.
   * "Seal", "Heat Shield") that isn't in the keyword fast path, and each one
   * used to make its own live Taxonomy API call — under concurrent
   * processing this hammered eBay's rate limit hard enough to stall an
   * entire optimization job on repeated 429 backoff (2s→5s→12s→30s, per
   * query, per product). Caching the resolved result for the lifetime of
   * this service instance means only the first product with a given query
   * pays the API cost.
   */
  private readonly categorySuggestionCache = new Map<
    string,
    { categoryId: string; categoryName: string } | null
  >();
  /** In-flight requests, so concurrent products with the same query share one API call instead of each firing their own. */
  private readonly categorySuggestionInFlight = new Map<
    string,
    Promise<{ categoryId: string; categoryName: string } | null>
  >();

  constructor(
    @InjectRepository(PipelineJob)
    private readonly pipelineRepo: Repository<PipelineJob>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(EbayCategoryMapping)
    private readonly categoryMappingRepo: Repository<EbayCategoryMapping>,
    private readonly listingPipeline: ListingGenerationPipeline,
    private readonly titlePositionPartName: TitlePositionPartNamePipeline,
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
              sellerCountry: resolveSellerCountryFromLocation(product.location),
            },
          })),
        )
      : [];

    const aiByProductId = new Map<string, ListingGenerationResult>();
    for (let i = 0; i < aiProducts.length; i++) {
      const ai = aiResults[i];
      if (ai) aiByProductId.set(aiProducts[i].id, ai);
    }

    const titleSlotsByProductId = await this.resolveTitleSlots(
      products,
      options.marketplace,
    );

    const listings: EnterpriseListingResult[] = [];
    for (const product of products) {
      const listing = await this.buildEnterpriseListing(
        product,
        options.marketplace,
        aiByProductId.get(product.id) ?? null,
        titleSlotsByProductId.get(product.id) ?? null,
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

    const titleSlotsByProductId = await this.resolveTitleSlots(
      [product],
      options.marketplace,
    );

    return this.buildEnterpriseListing(
      product,
      options.marketplace,
      aiResults[0] ?? null,
      titleSlotsByProductId.get(product.id) ?? null,
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

    const titleSlotsByProductId = await this.resolveTitleSlots(
      ordered,
      options.marketplace,
    );

    const results = new Map<string, EnterpriseListingResult>();
    for (let i = 0; i < ordered.length; i++) {
      const listing = await this.buildEnterpriseListing(
        ordered[i],
        options.marketplace,
        aiResults[i] ?? null,
        titleSlotsByProductId.get(ordered[i].id) ?? null,
      );
      results.set(ordered[i].id, listing);
    }
    return results;
  }

  private async resolveTitleSlots(
    products: CatalogProduct[],
    marketplace: Marketplace,
  ): Promise<Map<string, TitlePositionPartNameResult>> {
    if (marketplace !== 'US' && marketplace !== 'AU') {
      return new Map();
    }
    if (products.length === 0) return new Map();

    return this.titlePositionPartName.resolveBatch(
      products.map((product) => {
        const donorYear = product.donorVinDecoded?.['year']
          ? String(product.donorVinDecoded['year'])
          : undefined;
        const donorModel = product.donorVinDecoded?.['model']
          ? String(product.donorVinDecoded['model'])
          : undefined;
        // Warehouse-intake descriptions can be AI-hallucinated from thin
        // signal (no photos, just brand + part number) — don't feed that
        // to the title-slot model as if it were reliable; the title itself
        // is deterministic/user-anchored and far more trustworthy here.
        const rawDesc = this.hasUntrustedPartType(product)
          ? product.title
          : (product.description ?? product.title);
        return {
          id: product.id,
          rawDesc,
          partNumber: product.oemPartNumber ?? product.mpn,
          make: product.brand,
          model: donorModel,
          year: donorYear,
          categoryName: product.categoryName,
          fallbackPosition: product.placement,
          fallbackPartName: this.resolveDescriptivePartType(product),
        };
      }),
    );
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
        part_type: this.resolveDescriptivePartType(product),
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
        sellerCountry: resolveSellerCountryFromLocation(product.location),
      },
    };
  }

  private static readonly NON_DESCRIPTIVE_PART_TYPES = new Set([
    'oem',
    'aftermarket',
    'salvage',
    'used',
    'new',
    'refurbished',
    'general',
    'unknown',
    'other',
  ]);

  /**
   * True when part_type holds the intake form's source/condition dropdown
   * value ("OEM"/"Aftermarket"/"Salvage") rather than a real part descriptor
   * — signals that product.description is also untrustworthy for this row:
   * warehouse-intake parts with no photos get their description from a
   * text-only AI OEM lookup that hallucinates confident-sounding but wrong
   * part identities (e.g. "This Engine Control Module (ECM) is...") when
   * given only a brand + part number to go on.
   */
  private hasUntrustedPartType(product: CatalogProduct): boolean {
    const raw = product.partType?.trim().toLowerCase();
    return !raw || EnterpriseListingIntelligenceService.NON_DESCRIPTIVE_PART_TYPES.has(raw);
  }

  /**
   * catalog_products.part_type holds a real part descriptor ("Window Motor")
   * for pipeline-imported rows, but for warehouse-intake rows it holds the
   * intake form's source/condition dropdown value ("OEM"/"Aftermarket"/
   * "Salvage") — a completely different meaning stored in the same column.
   * Sending that straight to the AI as "part_type" starved it of any real
   * signal about what the part is, which produced hallucinated generic
   * titles (e.g. unrelated parts all coming back "Engine Control Module").
   * Fall back to a descriptor derived from the source title in that case.
   */
  private resolveDescriptivePartType(product: CatalogProduct): string | null {
    const raw = product.partType?.trim();
    if (raw && !this.hasUntrustedPartType(product)) {
      return raw;
    }
    const derived = derivePartNameFromTitle(
      product.title,
      product.oemPartNumber ?? product.mpn,
      product.brand,
    );
    return derived ?? raw ?? null;
  }

  private async buildEnterpriseListing(
    product: CatalogProduct,
    marketplace: Marketplace,
    aiListing: ListingGenerationResult | null,
    titleSlots: TitlePositionPartNameResult | null = null,
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
        // US/AU titles are assembled from structured slots below (Gemini
        // Position/Part Name + deterministic Year/Make/Model/OEM). Keep the
        // AI title only as a temporary seed for other marketplaces / fallbacks.
        if (marketplace !== 'US' && marketplace !== 'AU') {
          optimizedTitle = this.cleanTitle(aiListing.title, marketplace);
          aiTitleConfidence = 0.85;
        }
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
        const exteriorIds = new Set(['33697', '174105', '179850']);
        const interiorIds = new Set(['33696', '262191', '262189']);
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
      if (titleSlots?.position) {
        englishInput.placement = titleSlots.position;
      }
      if (titleSlots?.partName) {
        englishInput.partType = titleSlots.partName;
      }
      const categoryHint = resolveEnglishCategory(
        englishInput.partType,
        englishInput.placement,
      );
      if (
        categoryHint &&
        categoryId &&
        categoryHint.categoryId !== categoryId
      ) {
        const exteriorIds = new Set(['33697', '174105', '179850']);
        const interiorIds = new Set(['33696', '262191', '262189']);
        if (
          interiorIds.has(categoryHint.categoryId) &&
          exteriorIds.has(categoryId)
        ) {
          categoryId = categoryHint.categoryId;
          categoryName = categoryHint.categoryName;
        }
      }

      const structuredTitle = buildStructuredEbayTitle({
        yearRange: englishInput.yearRange,
        make: englishInput.brand,
        model: englishInput.model,
        generation: englishInput.generation,
        position: englishInput.placement,
        partName: englishInput.partType,
        oemPartNumber: englishInput.oemPartNumber ?? englishInput.mpn,
      });
      if (structuredTitle) {
        optimizedTitle = structuredTitle;
        aiTitleConfidence =
          titleSlots?.source === 'gemini'
            ? 0.92
            : Math.max(aiTitleConfidence, 0.88);
      } else if (
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

    // Final guard, regardless of which branch above produced optimizedTitle
    // (AI path, deterministic fallback, or a marketplace rebuild): the AI
    // title generator and the deterministic builders both sometimes emit the
    // OEM/manufacturer part number with stray spaces between characters
    // (e.g. "5C5 881 106" instead of "5C5881106"), and occasional special
    // characters. Observed live on GridX pipeline jobs feeding this service —
    // fixing only the upstream pipeline script didn't catch AI-authored
    // titles that reformat the part number themselves.
    optimizedTitle = this.sanitizeOptimizedTitle(
      optimizedTitle,
      product,
      marketplace,
    );

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
    const keywordMatch = resolveMotorsCategoryFromPart(
      product.partType,
      product.placement,
    );
    const hasUntrustedGenericIdentity =
      this.isUntrustedGenericPartIdentity(product.partType);
    const candidate = product.categoryId?.trim();
    if (candidate) {
      const isValid = await this.isMotorsCategory(candidate);
      if (isValid) {
        if (
          hasUntrustedGenericIdentity &&
          !keywordMatch &&
          candidate !== '9886'
        ) {
          this.logger.warn(
            `Category ${candidate} (${product.categoryName ?? '?'}) for SKU ${product.sku ?? '?'} came from generic part identity ${product.partType ?? '?'} — using safe fallback`,
          );
          const fallback = await this.getFallbackLeafCategory();
          return {
            categoryId: fallback.categoryId,
            categoryName: fallback.categoryName,
            confidence: 0.4,
          };
        }
        if (keywordMatch && keywordMatch.categoryId !== candidate) {
          const keywordIsValid = await this.isMotorsCategory(
            keywordMatch.categoryId,
          );
          if (keywordIsValid) {
            this.logger.warn(
              `Category ${candidate} (${product.categoryName ?? '?'}) for SKU ${product.sku ?? '?'} conflicts with deterministic part keyword ${product.partType ?? '?'} -> ${keywordMatch.categoryId} (${keywordMatch.categoryName}) — using keyword category`,
            );
            return { ...keywordMatch, confidence: 0.9 };
          }
        }
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
    if (keywordMatch) {
      const keywordIsValid = await this.isMotorsCategory(
        keywordMatch.categoryId,
      );
      if (keywordIsValid) {
        return { ...keywordMatch, confidence: 0.85 };
      }
      this.logger.warn(
        `Keyword category ${keywordMatch.categoryId} (${keywordMatch.categoryName}) for SKU ${product.sku ?? '?'} is not currently publishable — will re-resolve`,
      );
    }

    if (hasUntrustedGenericIdentity) {
      const fallback = await this.getFallbackLeafCategory();
      return {
        categoryId: fallback.categoryId,
        categoryName: fallback.categoryName,
        confidence: 0.35,
      };
    }

    // Durable cache: has this exact part type been resolved via the API before
    // (this job, a prior job, or before the last restart)? If so, reuse it and
    // skip the live Taxonomy call entirely.
    const cachedByType = await this.lookupCachedCategoryByPartType(
      product.partType,
    );
    if (cachedByType) {
      return { ...cachedByType, confidence: 0.8 };
    }

    // Taxonomy API: try progressively broader queries; accept only
    // categories whose ancestor chain includes 6000 (Parts & Accessories).
    // The first successful resolution for this part type is persisted so no
    // future part of the same type needs the API again.
    const queries = [
      [product.brand, product.partType, product.title]
        .filter(Boolean)
        .join(' '),
      product.partType ? `automotive ${product.partType}` : null,
      product.partType ?? null,
    ].filter(Boolean) as string[];

    for (const query of queries) {
      const match = await this.findMotorsLeafFromSuggestions(query);
      if (match) {
        await this.cacheCategoryForPartType(
          product.partType,
          match.categoryId,
          match.categoryName,
        );
        return { ...match, confidence: 0.75 };
      }
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
    const cacheKey = query.trim().toLowerCase();
    if (this.categorySuggestionCache.has(cacheKey)) {
      return this.categorySuggestionCache.get(cacheKey)!;
    }
    const inFlight = this.categorySuggestionInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const request = (async () => {
      let result: { categoryId: string; categoryName: string } | null = null;
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
            result = {
              categoryId: catId,
              categoryName: s.category.categoryName,
            };
            break;
          }
        }
        this.categorySuggestionCache.set(cacheKey, result);
      } catch {
        // ignore — caller will try the next query or fallback. Deliberately
        // NOT cached: a transient rate-limit/network failure shouldn't
        // permanently poison this query for the rest of the job.
      } finally {
        this.categorySuggestionInFlight.delete(cacheKey);
      }
      return result;
    })();

    this.categorySuggestionInFlight.set(cacheKey, request);
    return request;
  }

  private isUntrustedGenericPartIdentity(partType: string | null): boolean {
    const normalized = (partType ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    return EnterpriseListingIntelligenceService.UNTRUSTED_GENERIC_PART_IDENTITIES.has(
      normalized,
    );
  }

  /**
   * Last-resort category when neither the keyword fast path nor Taxonomy API
   * suggestions found a match.
   *
   * This used to BFS the category subtree under 6000 for "the shallowest
   * leaf", on the theory that any leaf under the Motors root is safe. It
   * isn't: eBay's Motors tree has many small, shallow leaf categories for
   * specific (often defunct) car makes — Motorcycles (6024), Austin (6126),
   * Cord (6185) all surfaced this way for Audi parts in the same job,
   * because they happened to be near the top of the tree. A make-specific
   * category is only correct when it matches the product's actual make, and
   * this generic fallback path has no way to know that — so it must never
   * return anything but the safe, generic, always-applicable catch-all
   * below. Whack-a-moling individual bad IDs here doesn't scale; there's no
   * bound on how many obscure makes eBay's tree has near the root.
   */
  private async getFallbackLeafCategory(): Promise<{
    categoryId: string;
    categoryName: string;
  }> {
    if (this.fallbackLeaf) return this.fallbackLeaf;

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
   *
   * A category being "recognized" here isn't enough on its own: eBay
   * periodically restructures its category tree, and a category that was a
   * valid leaf when hardcoded or cached can later grow children and stop
   * being publishable — exactly what happened to 33726, hardcoded as
   * "Exterior Mirrors" but silently turned into "Transmission & Drivetrain"
   * with several children by eBay at some point, which wasn't caught until
   * two live publish attempts failed with "not a leaf category". Once a
   * category is recognized as Motors, isCurrentlyLeafCategory verifies it's
   * still usable before this returns true, so drift like that self-corrects
   * (forces re-resolution) instead of silently failing at publish time.
   */
  private async isMotorsCategory(categoryId: string): Promise<boolean> {
    try {
      if (
        EnterpriseListingIntelligenceService.WRONG_VERTICAL_MOTORS_IDS.has(
          categoryId,
        )
      ) {
        return false;
      }

      let recognizedAsMotors = false;

      // Check keyword-mapped IDs first (fast, no DB call)
      if (
        EnterpriseListingIntelligenceService.KEYWORD_MOTORS_IDS.has(categoryId)
      ) {
        recognizedAsMotors = true;
      } else {
        const mapping = await this.categoryMappingRepo.findOne({
          where: { ebayCategoryId: categoryId },
        });
        if (mapping) {
          if (!mapping.isMotorsCategory) return false;
          recognizedAsMotors = true;
        }
      }

      // Not in mapping table or keyword rows — reject by default.
      // The caller will re-resolve via the taxonomy API.
      if (!recognizedAsMotors) return false;

      // Curated keyword IDs and the generic fallback are verified-valid leaves
      // (see CATEGORY_KEYWORD_ROWS, last verified live 2026-07-13). Trust them
      // without a live getCategorySubtree call — otherwise every distinct
      // category triggers a Taxonomy API hit on each cold start (the caches are
      // per-process), which is what stalled catalog imports after restarts.
      // Drift (eBay renumbering a leaf) is caught at publish time and by the
      // periodic EbayCategoryKeywordAuditService, not here.
      if (
        EnterpriseListingIntelligenceService.KEYWORD_MOTORS_IDS.has(
          categoryId,
        ) ||
        categoryId === '9886'
      ) {
        return true;
      }

      // Non-curated but DB-recognized categories still get a (per-process
      // cached) live leaf check.
      return await this.isCurrentlyLeafCategory(categoryId);
    } catch {
      return false;
    }
  }

  /** Normalize a part type for use as a durable category-cache key. */
  private normalizePartTypeKey(partType: string | null | undefined): string {
    return (partType ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Durable part-type -> category cache backed by ebay_category_mappings.
   * Lets a part type resolved once via the Taxonomy API be reused forever
   * (across jobs and restarts) without another live call.
   */
  private async lookupCachedCategoryByPartType(
    partType: string | null | undefined,
  ): Promise<{ categoryId: string; categoryName: string } | null> {
    const norm = this.normalizePartTypeKey(partType);
    if (!norm) return null;
    try {
      const row = await this.categoryMappingRepo
        .createQueryBuilder('m')
        .where('m.active = true')
        .andWhere('m."isMotorsCategory" = true')
        .andWhere('(LOWER(m."productType") = :norm OR :norm = ANY(m.keywords))', {
          norm,
        })
        .getOne();
      return row
        ? { categoryId: row.ebayCategoryId, categoryName: row.ebayCategoryName }
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Persist a resolved (part type -> category) mapping so future parts of the
   * same type skip the Taxonomy API entirely. Never called on API failure, so
   * a transient rate-limit doesn't permanently pin a part type to "Other".
   */
  private async cacheCategoryForPartType(
    partType: string | null | undefined,
    categoryId: string,
    categoryName: string,
  ): Promise<void> {
    const norm = this.normalizePartTypeKey(partType);
    if (!norm || !categoryId) return;
    try {
      const existing = await this.categoryMappingRepo.findOne({
        where: { ebayCategoryId: categoryId },
      });
      if (existing) {
        const kws = existing.keywords ?? [];
        if (!kws.includes(norm)) {
          kws.push(norm);
          await this.categoryMappingRepo.update(
            { ebayCategoryId: categoryId },
            { keywords: kws, lastSyncedAt: new Date() },
          );
        }
      } else {
        await this.categoryMappingRepo.save(
          this.categoryMappingRepo.create({
            ebayCategoryId: categoryId,
            ebayCategoryName: categoryName ?? '',
            isMotorsCategory: true,
            active: true,
            productType: norm,
            keywords: [norm],
            lastSyncedAt: new Date(),
          }),
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to cache category ${categoryId} for part type "${norm}": ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  /**
   * Verify a category is still a real, currently-publishable leaf on eBay's
   * live category tree — not just "under the Motors ancestor chain" (that
   * check alone let both wrong-vertical categories like Motorcycles/Austin
   * and structurally-stale ones like the ex-mirrors category through
   * earlier). Cached per instance since the same category ID recurs across
   * many products in a batch; a lookup failure (rate limit, network) doesn't
   * block publishing — it assumes leaf rather than forcing needless
   * re-resolution on an unrelated API hiccup.
   */
  private readonly leafCategoryCache = new Map<string, boolean>();

  private async isCurrentlyLeafCategory(categoryId: string): Promise<boolean> {
    if (this.leafCategoryCache.has(categoryId)) {
      return this.leafCategoryCache.get(categoryId)!;
    }
    try {
      const subtree = await this.taxonomy.getCategorySubtree(
        categoryId,
        EnterpriseListingIntelligenceService.MOTORS_TREE_ID,
      );
      const isLeaf = Boolean(subtree.categorySubtreeNode?.leafCategoryTreeNode);
      this.leafCategoryCache.set(categoryId, isLeaf);
      return isLeaf;
    } catch {
      return true;
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
      partType: this.resolveDescriptivePartType(product) ?? undefined,
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
      sellerCountry: resolveSellerCountryFromLocation(product.location),
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

  /** Collapse a spaced-out occurrence of the product's own OEM/part number
   * back into a single token, and (US/AU only — German legitimately uses
   * umlauts/ß) strip characters outside the allowlist used across the title
   * builders. Guarded to part numbers >=5 chars to avoid false-positive
   * matches on short values. */
  private sanitizeOptimizedTitle(
    title: string,
    product: CatalogProduct,
    marketplace: Marketplace,
  ): string {
    let result = title;
    const pn = (product.oemPartNumber ?? product.mpn ?? '')?.trim();
    if (pn && pn.length >= 5) {
      const escaped = pn
        .split('')
        .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = new RegExp(escaped.join('\\s*'), 'i');
      const match = result.match(pattern);
      if (match && match[0].length <= pn.length + 12) {
        result = result.replace(pattern, pn);
      }
    }
    if (marketplace !== 'DE') {
      result = result
        .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return result;
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
