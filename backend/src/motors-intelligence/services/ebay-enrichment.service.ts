import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  MotorsProduct,
  EbayCategoryMapping,
  EbayAspectRequirement,
  AspectRequirementLevel,
} from '../entities';

export interface EnrichmentResult {
  categoryId: string | null;
  categoryName: string | null;
  aspects: EbayAspectRequirement[];
  compatibilityProperties: string[];
  enrichmentConfidence: number;
  errors: string[];
  warnings: string[];
  cached: boolean;
}

/**
 * Queries eBay Developer APIs for listing requirements:
 *  - Taxonomy / Category suggestions
 *  - Item Aspects (required/recommended specifics)
 *  - Compatibility properties
 *
 * Results are cached in ebay_category_mappings + ebay_aspect_requirements tables.
 */
@Injectable()
export class EbayEnrichmentService {
  private readonly logger = new Logger(EbayEnrichmentService.name);
  private readonly CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    @InjectRepository(MotorsProduct)
    private readonly motorsProductRepo: Repository<MotorsProduct>,
    @InjectRepository(EbayCategoryMapping)
    private readonly categoryMappingRepo: Repository<EbayCategoryMapping>,
    @InjectRepository(EbayAspectRequirement)
    private readonly aspectRepo: Repository<EbayAspectRequirement>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Enrich a MotorsProduct with eBay category & aspect data.
   * Uses cached mappings first, falls back to live API calls.
   */
  async enrichProduct(motorsProductId: string): Promise<EnrichmentResult> {
    const product = await this.motorsProductRepo.findOneOrFail({
      where: { id: motorsProductId },
    });

    const errors: string[] = [];
    const warnings: string[] = [];
    let cached = false;

    // Step 1: Resolve category
    let categoryId = product.ebayCategoryId;
    let categoryName = product.ebayCategoryName;

    if (!categoryId && product.productType) {
      // Try cached mapping by product type
      const mapping = await this.categoryMappingRepo.findOne({
        where: { productType: product.productType, active: true, isMotorsCategory: true },
      });

      if (mapping && this.isCacheFresh(mapping.lastSyncedAt)) {
        categoryId = mapping.ebayCategoryId;
        categoryName = mapping.ebayCategoryName;
        cached = true;
        this.logger.debug(`Cache hit for product type "${product.productType}" → category ${categoryId}`);
      } else {
        // Query eBay Taxonomy API for category suggestion
        const suggested = await this.suggestCategory(product);
        if (suggested) {
          categoryId = suggested.categoryId;
          categoryName = suggested.categoryName;

          // Cache the mapping
          await this.upsertCategoryMapping(
            suggested.categoryId,
            suggested.categoryName,
            product.productType,
            suggested.supportsCompatibility,
            suggested.compatibilityProperties,
          );
        } else {
          warnings.push('Could not determine eBay category from product data');
        }
      }
    }

    // Update product with resolved category
    if (categoryId && categoryId !== product.ebayCategoryId) {
      product.ebayCategoryId = categoryId;
      product.ebayCategoryName = categoryName;
      await this.motorsProductRepo.save(product);
    }

    // Step 2: Load or fetch aspect requirements
    let aspects: EbayAspectRequirement[] = [];
    if (categoryId) {
      aspects = await this.aspectRepo.find({
        where: { ebayCategoryId: categoryId },
      });

      if (aspects.length === 0 || !this.isAspectCacheFresh(aspects)) {
        // Fetch from eBay Item Aspects API
        const fetched = await this.fetchCategoryAspects(categoryId);
        if (fetched.length > 0) {
          // Replace cached aspects
          await this.aspectRepo.delete({ ebayCategoryId: categoryId });
          aspects = await this.aspectRepo.save(fetched);
        } else if (aspects.length === 0) {
          warnings.push(`No aspect requirements found for category ${categoryId}`);
        }
      } else {
        cached = true;
      }
    }

    // Step 3: Get compatibility properties
    let compatibilityProperties: string[] = [];
    if (categoryId) {
      const mapping = await this.categoryMappingRepo.findOne({
        where: { ebayCategoryId: categoryId },
      });
      compatibilityProperties = mapping?.compatibilityProperties || [];
    }

    // Calculate enrichment confidence
    const confidence = this.calculateEnrichmentConfidence(
      categoryId,
      aspects,
      compatibilityProperties,
      product,
    );

    return {
      categoryId,
      categoryName,
      aspects,
      compatibilityProperties,
      enrichmentConfidence: confidence,
      errors,
      warnings,
      cached,
    };
  }

  /**
   * Suggest the best eBay Motors category for a product.
   * In production, calls eBay Taxonomy API; here we use intelligent
   * local matching against our seeded category mappings.
   */
  private async suggestCategory(product: MotorsProduct): Promise<{
    categoryId: string;
    categoryName: string;
    supportsCompatibility: boolean;
    compatibilityProperties: string[];
  } | null> {
    const searchTerms = [
      product.productType,
      product.productFamily,
      product.brand,
    ].filter(Boolean).join(' ').toLowerCase();

    if (!searchTerms) return null;

    // Search cached mappings by keywords
    const mappings = await this.categoryMappingRepo
      .createQueryBuilder('m')
      .where('m.active = true')
      .andWhere('m."isMotorsCategory" = true')
      .getMany();

    let bestMatch: EbayCategoryMapping | null = null;
    let bestScore = 0;

    for (const mapping of mappings) {
      let score = 0;

      // Product type exact match
      if (mapping.productType && product.productType) {
        const mapType = mapping.productType.toLowerCase();
        const prodType = product.productType.toLowerCase();
        if (mapType === prodType) score += 10;
        else if (mapType.includes(prodType) || prodType.includes(mapType)) score += 5;
      }

      // Keyword match
      if (mapping.keywords) {
        for (const kw of mapping.keywords) {
          if (searchTerms.includes(kw.toLowerCase())) {
            score += 3;
          }
        }
      }

      // Category name match
      if (mapping.ebayCategoryName) {
        const catName = mapping.ebayCategoryName.toLowerCase();
        if (searchTerms.includes(catName) || catName.includes(product.productType?.toLowerCase() || '---')) {
          score += 4;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = mapping;
      }
    }

    if (bestMatch && bestScore >= 3) {
      return {
        categoryId: bestMatch.ebayCategoryId,
        categoryName: bestMatch.ebayCategoryName,
        supportsCompatibility: bestMatch.supportsCompatibility,
        compatibilityProperties: bestMatch.compatibilityProperties || [],
      };
    }

    // Fallback: use the generic "Other Parts" category
    const fallback = mappings.find(m => m.ebayCategoryName?.includes('Other'));
    if (fallback) {
      return {
        categoryId: fallback.ebayCategoryId,
        categoryName: fallback.ebayCategoryName,
        supportsCompatibility: fallback.supportsCompatibility,
        compatibilityProperties: fallback.compatibilityProperties || [],
      };
    }

    return null;
  }

  /**
   * Fetch aspect requirements for a category from eBay.
   * In production, calls:
   *   GET /sell/metadata/v1/marketplace/EBAY_MOTORS_US/get_item_aspects_for_category?category_id={id}
   *
   * For now, generates standard Motors aspects based on category data.
   */
  private async fetchCategoryAspects(categoryId: string): Promise<EbayAspectRequirement[]> {
    const mapping = await this.categoryMappingRepo.findOne({
      where: { ebayCategoryId: categoryId },
    });

    // Standard Motors required aspects
    const aspects: Partial<EbayAspectRequirement>[] = [
      {
        ebayCategoryId: categoryId,
        aspectName: 'Brand',
        requirementLevel: AspectRequirementLevel.REQUIRED,
        dataType: 'TEXT',
        maxLength: 65,
      },
      {
        ebayCategoryId: categoryId,
        aspectName: 'Manufacturer Part Number',
        requirementLevel: AspectRequirementLevel.REQUIRED,
        dataType: 'TEXT',
        maxLength: 65,
      },
      {
        ebayCategoryId: categoryId,
        aspectName: 'Placement on Vehicle',
        requirementLevel: AspectRequirementLevel.RECOMMENDED,
        dataType: 'TEXT',
        maxLength: 65,
        allowedValues: ['Front', 'Rear', 'Left', 'Right', 'Front Left', 'Front Right', 'Rear Left', 'Rear Right', 'Upper', 'Lower'],
      },
      {
        ebayCategoryId: categoryId,
        aspectName: 'Warranty',
        requirementLevel: AspectRequirementLevel.RECOMMENDED,
        dataType: 'TEXT',
        maxLength: 65,
        allowedValues: ['1 Year', '2 Year', '3 Year', 'Lifetime', 'No Warranty', 'Unspecified'],
      },
      {
        ebayCategoryId: categoryId,
        aspectName: 'Fitment Type',
        requirementLevel: AspectRequirementLevel.RECOMMENDED,
        dataType: 'TEXT',
        allowedValues: ['Direct Replacement', 'Performance/Custom'],
      },
    ];

    // Add category-specific aspects
    if (mapping?.supportsCompatibility) {
      aspects.push({
        ebayCategoryId: categoryId,
        aspectName: 'OE/OEM Part Number',
        requirementLevel: AspectRequirementLevel.RECOMMENDED,
        dataType: 'TEXT',
        maxLength: 65,
      });
    }

    // Material/Finish for applicable categories
    const materialCategories = ['Brake Pad', 'Brake Caliper', 'Control Arm', 'Wheel Hub', 'Radiator'];
    if (mapping?.productType && materialCategories.includes(mapping.productType)) {
      aspects.push(
        {
          ebayCategoryId: categoryId,
          aspectName: 'Material',
          requirementLevel: AspectRequirementLevel.RECOMMENDED,
          dataType: 'TEXT',
          maxLength: 65,
        },
        {
          ebayCategoryId: categoryId,
          aspectName: 'Finish',
          requirementLevel: AspectRequirementLevel.RECOMMENDED,
          dataType: 'TEXT',
          maxLength: 65,
        },
      );
    }

    return aspects.map(a => this.aspectRepo.create(a));
  }

  private async upsertCategoryMapping(
    categoryId: string,
    categoryName: string | null,
    productType: string | null,
    supportsCompatibility: boolean,
    compatibilityProperties: string[],
  ): Promise<void> {
    const existing = await this.categoryMappingRepo.findOne({
      where: { ebayCategoryId: categoryId },
    });

    if (existing) {
      existing.ebayCategoryName = categoryName || existing.ebayCategoryName;
      existing.productType = productType || existing.productType;
      existing.supportsCompatibility = supportsCompatibility;
      existing.compatibilityProperties = compatibilityProperties;
      existing.lastSyncedAt = new Date();
      await this.categoryMappingRepo.save(existing);
    } else {
      await this.categoryMappingRepo.save(
        this.categoryMappingRepo.create({
          ebayCategoryId: categoryId,
          ebayCategoryName: categoryName || '',
          productType,
          isMotorsCategory: true,
          supportsCompatibility,
          compatibilityProperties,
          lastSyncedAt: new Date(),
        }),
      );
    }
  }

  private calculateEnrichmentConfidence(
    categoryId: string | null,
    aspects: EbayAspectRequirement[],
    compatibilityProperties: string[],
    product: MotorsProduct,
  ): number {
    let score = 0;

    if (categoryId) score += 0.4;
    if (aspects.length > 0) score += 0.3;
    if (product.brand && product.mpn) score += 0.2;
    if (compatibilityProperties.length > 0) score += 0.1;

    return Math.min(1, score);
  }

  private isCacheFresh(lastSynced: Date | null): boolean {
    if (!lastSynced) return false;
    return Date.now() - new Date(lastSynced).getTime() < this.CACHE_TTL_MS;
  }

  private isAspectCacheFresh(aspects: EbayAspectRequirement[]): boolean {
    if (aspects.length === 0) return false;
    // Aspects don't have lastSynced per-row, use creation date of first row
    const oldest = aspects.reduce(
      (min, a) => (a.createdAt && new Date(a.createdAt) < min ? new Date(a.createdAt) : min),
      new Date(),
    );
    return Date.now() - oldest.getTime() < this.CACHE_TTL_MS;
  }
}
