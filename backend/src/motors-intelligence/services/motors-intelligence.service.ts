import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  MotorsProduct,
  MotorsProductStatus,
  ReviewTaskReason,
} from '../entities';
import { MotorsPipelineResultDto } from '../dto';
import { VisionExtractionService } from './vision-extraction.service';
import { ProductIdentityService, IdentityResolutionResult } from './product-identity.service';
import { FitmentResolverService, FitmentResolutionResult } from './fitment-resolver.service';
import { ListingGeneratorService, ListingGenerationInput } from './listing-generator.service';
import { ComplianceEngineService, ComplianceCheckResult } from './compliance-engine.service';
import { ReviewQueueService } from './review-queue.service';
import { MotorsPublisherService } from './motors-publisher.service';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';

const AUTO_PUBLISH_THRESHOLDS = {
  identityConfidence: 0.85,
  fitmentConfidence: 0.70,
  complianceScore: 0.80,
  contentQuality: 0.75,
};

@Injectable()
export class MotorsIntelligenceService {
  private readonly logger = new Logger(MotorsIntelligenceService.name);

  constructor(
    @InjectRepository(MotorsProduct)
    private readonly motorsProductRepo: Repository<MotorsProduct>,
    private readonly visionExtractionService: VisionExtractionService,
    private readonly productIdentityService: ProductIdentityService,
    private readonly fitmentResolverService: FitmentResolverService,
    private readonly listingGeneratorService: ListingGeneratorService,
    private readonly complianceEngineService: ComplianceEngineService,
    private readonly reviewQueueService: ReviewQueueService,
    private readonly motorsPublisherService: MotorsPublisherService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Execute the full Motors Intelligence pipeline for a product.
   * Deterministic-first, AI-assisted second, review-controlled when uncertain.
   */
  async runPipeline(motorsProductId: string): Promise<MotorsPipelineResultDto> {
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: motorsProductId },
    });

    const result: MotorsPipelineResultDto = {
      motorsProductId,
      status: product.status,
      identityConfidence: null,
      fitmentConfidence: null,
      complianceConfidence: null,
      publishable: false,
      reviewRequired: false,
      errors: [],
      warnings: [],
    };

    try {
      // ──── Stage 1: Vision/OCR Extraction ────────────────────────
      if (product.imageUrls?.length && await this.featureFlagService.isEnabled('motors_vision_extraction')) {
        this.logger.log(`[${motorsProductId}] Starting vision extraction...`);
        product.status = MotorsProductStatus.EXTRACTING;
        await this.motorsProductRepo.save(product);

        try {
          await this.visionExtractionService.extractFromImages(
            motorsProductId,
            product.imageUrls,
          );
        } catch (err) {
          this.logger.warn(`Vision extraction failed: ${err.message}`);
          result.warnings.push({ code: 'VISION_EXTRACTION_FAILED', message: err.message });
        }
      }

      // Extract from supplier data if present
      if (product.sourcePayload) {
        try {
          await this.visionExtractionService.extractFromSupplierData(
            motorsProductId,
            product.sourcePayload,
          );
        } catch (err) {
          this.logger.warn(`Supplier extraction failed: ${err.message}`);
        }
      }

      // ──── Stage 2: Product Identity Resolution ──────────────────
      this.logger.log(`[${motorsProductId}] Resolving product identity...`);
      product.status = MotorsProductStatus.IDENTIFYING;
      await this.motorsProductRepo.save(product);

      const identityResult: IdentityResolutionResult =
        await this.productIdentityService.resolveIdentity(motorsProductId);

      result.identityConfidence = identityResult.identityConfidence;

      if (identityResult.requiresReview) {
        for (const reason of identityResult.reviewReasons) {
          const reviewReason = this.mapToReviewReason(reason);
          if (reviewReason) {
            await this.reviewQueueService.createReviewTask(
              motorsProductId,
              reviewReason,
              `Identity resolution: ${reason}`,
              {
                candidatesSnapshot: identityResult.candidates.map(c => ({
                  id: c.id,
                  brand: c.brand,
                  mpn: c.mpn,
                  source: c.source,
                  compositeScore: c.compositeScore,
                })),
              },
            );
            result.reviewRequired = true;
            result.reviewTaskId = undefined; // will be set from the first task
          }
        }

        // If review is required and identity confidence is too low, stop here
        if (identityResult.identityConfidence < 0.5) {
          result.status = MotorsProductStatus.REVIEW_REQUIRED;
          return result;
        }
      }

      // Reload product after identity resolution updated it
      const updatedProduct = await this.motorsProductRepo.findOneOrFail({
        where: { id: motorsProductId },
      });

      // ──── Stage 3: Fitment Resolution ───────────────────────────
      if (await this.featureFlagService.isEnabled('motors_fitment_resolution')) {
        this.logger.log(`[${motorsProductId}] Resolving fitment...`);
        updatedProduct.status = MotorsProductStatus.RESOLVING_FITMENT;
        await this.motorsProductRepo.save(updatedProduct);

        const fitmentResult: FitmentResolutionResult =
          await this.fitmentResolverService.resolveFitment(motorsProductId);

        result.fitmentConfidence = fitmentResult.fitmentConfidence;

        if (!fitmentResult.resolved && updatedProduct.compatibilityRequired) {
          await this.reviewQueueService.createReviewTask(
            motorsProductId,
            ReviewTaskReason.MISSING_FITMENT,
            'Fitment data required but not resolved',
            { fitmentSnapshot: fitmentResult.fitmentRows },
          );
          result.reviewRequired = true;
        }

        if (fitmentResult.errors.length > 0) {
          result.errors.push(...fitmentResult.errors.map(e => ({ code: 'FITMENT_ERROR', message: e })));
        }
      }

      // ──── Stage 4: Listing Generation ───────────────────────────
      if (await this.featureFlagService.isEnabled('motors_listing_generation')) {
        this.logger.log(`[${motorsProductId}] Generating listing content...`);
        const reloaded = await this.motorsProductRepo.findOneOrFail({
          where: { id: motorsProductId },
        });
        reloaded.status = MotorsProductStatus.GENERATING_LISTING;
        await this.motorsProductRepo.save(reloaded);

        const input: ListingGenerationInput = {
          brand: reloaded.brand || '',
          mpn: reloaded.mpn || '',
          productType: reloaded.productType || '',
          placement: reloaded.placement || undefined,
          material: reloaded.material || undefined,
          finish: reloaded.finish || undefined,
          includes: reloaded.includes || undefined,
          features: reloaded.features || undefined,
          condition: reloaded.condition || 'New',
          compatibleVehicleSummary: reloaded.compatibleVehicleSummary || undefined,
          categoryId: reloaded.ebayCategoryId || '',
          requiredAspects: {},
          forbiddenClaims: [],
          titleCharLimit: 80,
          dimensions: reloaded.dimensions || undefined,
          quantityPerPack: reloaded.quantityPerPack || undefined,
          sideOrientation: reloaded.sideOrientation || undefined,
          frontRear: reloaded.frontRear || undefined,
          oemPartNumber: reloaded.oemPartNumber || undefined,
        };

        try {
          const generation = await this.listingGeneratorService.generateListing(
            motorsProductId,
            input,
          );

          // Apply generation to product
          reloaded.generatedTitle = generation.generatedTitle;
          reloaded.generatedItemSpecifics = generation.generatedItemSpecifics;
          reloaded.generatedBulletFeatures = generation.generatedBulletFeatures;
          reloaded.generatedHtmlDescription = generation.generatedHtmlDescription;
          reloaded.generatedKeywordRationale = generation.keywordRationale;
          reloaded.generatedSearchTags = generation.searchTags;
          reloaded.contentQualityScore = generation.overallQualityScore;
          await this.motorsProductRepo.save(reloaded);
        } catch (err) {
          this.logger.error(`Listing generation failed: ${err.message}`);
          result.errors.push({ code: 'GENERATION_FAILED', message: err.message });
        }
      }

      // ──── Stage 5: Compliance Validation ────────────────────────
      if (await this.featureFlagService.isEnabled('motors_compliance_engine')) {
        this.logger.log(`[${motorsProductId}] Running compliance validation...`);
        const reloaded = await this.motorsProductRepo.findOneOrFail({
          where: { id: motorsProductId },
        });
        reloaded.status = MotorsProductStatus.VALIDATING;
        await this.motorsProductRepo.save(reloaded);

        const validationResult = await this.complianceEngineService.validateProduct(motorsProductId);

        result.complianceConfidence = validationResult.overallComplianceScore;
        result.publishable = validationResult.publishable;
        result.errors.push(...validationResult.errors);
        result.warnings.push(...validationResult.warnings);

        reloaded.complianceConfidence = validationResult.overallComplianceScore;

        if (validationResult.errors.length > 0) {
          await this.reviewQueueService.createReviewTask(
            motorsProductId,
            ReviewTaskReason.COMPLIANCE_FAILURE,
            `Compliance validation failed with ${validationResult.errors.length} errors`,
            { complianceSnapshot: validationResult as any },
          );
          result.reviewRequired = true;
          reloaded.status = MotorsProductStatus.REVIEW_REQUIRED;
        } else if (result.reviewRequired) {
          reloaded.status = MotorsProductStatus.REVIEW_REQUIRED;
        } else {
          reloaded.status = MotorsProductStatus.APPROVED;
        }

        await this.motorsProductRepo.save(reloaded);
      }

      // ──── Stage 6: Auto-Publish Decision ────────────────────────
      if (
        result.publishable &&
        !result.reviewRequired &&
        await this.featureFlagService.isEnabled('motors_auto_publish')
      ) {
        const final = await this.motorsProductRepo.findOneOrFail({
          where: { id: motorsProductId },
        });

        if (this.meetsAutoPublishThresholds(final)) {
          this.logger.log(`[${motorsProductId}] All thresholds met - marking for auto-publish`);
          final.status = MotorsProductStatus.APPROVED;
          final.approvedAt = new Date();
          final.approvedBy = 'system:auto_publish';
          await this.motorsProductRepo.save(final);
        }
      }

      result.status = (await this.motorsProductRepo.findOneOrFail({
        where: { id: motorsProductId },
      })).status;

    } catch (error) {
      this.logger.error(`Pipeline failed for ${motorsProductId}: ${error.message}`, error.stack);

      const product = await this.motorsProductRepo.findOne({ where: { id: motorsProductId } });
      if (product) {
        product.status = MotorsProductStatus.FAILED;
        product.publishError = error.message;
        await this.motorsProductRepo.save(product);
      }

      result.status = MotorsProductStatus.FAILED;
      result.errors.push({ code: 'PIPELINE_FAILED', message: error.message });
    }

    return result;
  }

  async getProduct(id: string): Promise<MotorsProduct> {
    return this.motorsProductRepo.findOneOrFail({ where: { id } });
  }

  async getProducts(query: any): Promise<{ products: MotorsProduct[]; total: number }> {
    const qb = this.motorsProductRepo.createQueryBuilder('mp');

    if (query.status) {
      qb.andWhere('mp.status = :status', { status: query.status });
    }
    if (query.sourceType) {
      qb.andWhere('mp."sourceType" = :sourceType', { sourceType: query.sourceType });
    }
    if (query.brand) {
      qb.andWhere('mp.brand ILIKE :brand', { brand: `%${query.brand}%` });
    }
    if (query.productType) {
      qb.andWhere('mp."productType" ILIKE :productType', { productType: `%${query.productType}%` });
    }
    if (query.search) {
      qb.andWhere(
        `(mp.brand ILIKE :search OR mp.mpn ILIKE :search OR mp."productType" ILIKE :search OR mp."generatedTitle" ILIKE :search)`,
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy(`mp."${query.sortBy || 'createdAt'}"`, query.sortOrder || 'DESC');

    const total = await qb.getCount();
    const products = await qb
      .skip(query.offset || 0)
      .take(query.limit || 50)
      .getMany();

    return { products, total };
  }

  /** Alias for controller compatibility */
  async listProducts(query: any): Promise<{ items: MotorsProduct[]; total: number }> {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 25);
    const result = await this.getProducts({
      ...query,
      offset: (page - 1) * limit,
      limit,
    });
    return { items: result.products, total: result.total };
  }

  async batchCreateProducts(products: Partial<MotorsProduct>[]): Promise<MotorsProduct[]> {
    const created: MotorsProduct[] = [];
    for (const data of products) {
      created.push(await this.createProduct(data));
    }
    return created;
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.motorsProductRepo.findOneOrFail({ where: { id } });
    await this.motorsProductRepo.softRemove(product);
  }

  async publish(
    motorsProductId: string,
    connectionId: string,
  ): Promise<{ success: boolean; ebayListingId?: string; error?: string }> {
    return this.motorsPublisherService.publishToEbay(motorsProductId, connectionId);
  }

  async createProduct(data: Partial<MotorsProduct>): Promise<MotorsProduct> {
    // Normalize MPN and brand
    if (data.mpn) {
      data.mpnNormalized = data.mpn
        .toUpperCase()
        .replace(/[-–—.\s]/g, '')
        .trim();
    }
    if (data.brand) {
      data.brandNormalized = data.brand
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    const product = this.motorsProductRepo.create(data);
    return this.motorsProductRepo.save(product);
  }

  async updateProduct(id: string, data: Partial<MotorsProduct>): Promise<MotorsProduct> {
    const product = await this.motorsProductRepo.findOneOrFail({ where: { id } });

    // Normalize if updated
    if (data.mpn) {
      data.mpnNormalized = data.mpn.toUpperCase().replace(/[-–—.\s]/g, '').trim();
    }
    if (data.brand) {
      data.brandNormalized = data.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    Object.assign(product, data);
    return this.motorsProductRepo.save(product);
  }

  async getStats(): Promise<Record<string, any>> {
    const statusCounts = await this.motorsProductRepo
      .createQueryBuilder('mp')
      .select('mp.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('mp.status')
      .getRawMany();

    const sourceTypeCounts = await this.motorsProductRepo
      .createQueryBuilder('mp')
      .select('mp."sourceType"', 'sourceType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('mp."sourceType"')
      .getRawMany();

    const avgConfidence = await this.motorsProductRepo
      .createQueryBuilder('mp')
      .select('AVG(mp."identityConfidence")', 'avgIdentity')
      .addSelect('AVG(mp."fitmentConfidence")', 'avgFitment')
      .addSelect('AVG(mp."complianceConfidence")', 'avgCompliance')
      .addSelect('AVG(mp."contentQualityScore")', 'avgQuality')
      .where('mp.status NOT IN (:...excluded)', {
        excluded: [MotorsProductStatus.PENDING, MotorsProductStatus.FAILED],
      })
      .getRawOne();

    return {
      byStatus: statusCounts,
      bySourceType: sourceTypeCounts,
      averageConfidence: avgConfidence,
      total: await this.motorsProductRepo.count(),
    };
  }

  private meetsAutoPublishThresholds(product: MotorsProduct): boolean {
    return (
      Number(product.identityConfidence || 0) >= AUTO_PUBLISH_THRESHOLDS.identityConfidence &&
      Number(product.fitmentConfidence || 0) >= AUTO_PUBLISH_THRESHOLDS.fitmentConfidence &&
      Number(product.complianceConfidence || 0) >= AUTO_PUBLISH_THRESHOLDS.complianceScore &&
      Number(product.contentQualityScore || 0) >= AUTO_PUBLISH_THRESHOLDS.contentQuality
    );
  }

  private mapToReviewReason(reason: string): ReviewTaskReason | null {
    const mapping: Record<string, ReviewTaskReason> = {
      multiple_identities: ReviewTaskReason.MULTIPLE_IDENTITIES,
      low_confidence: ReviewTaskReason.LOW_CONFIDENCE,
      brand_ambiguity: ReviewTaskReason.BRAND_AMBIGUITY,
      quantity_ambiguity: ReviewTaskReason.QUANTITY_AMBIGUITY,
      side_orientation_conflict: ReviewTaskReason.SIDE_ORIENTATION_CONFLICT,
      front_rear_conflict: ReviewTaskReason.FRONT_REAR_CONFLICT,
      ocr_conflict: ReviewTaskReason.OCR_CONFLICT,
      image_only: ReviewTaskReason.IMAGE_ONLY,
    };
    return mapping[reason] || null;
  }
}
