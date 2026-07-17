import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import type { EbayAspect } from '../channels/ebay/ebay-api.types.js';
import { EbayCategory } from '../listings/entities/ebay-category.entity.js';
import { detectHallucinatedPartNumbers } from '../common/openai/listing-guards.js';

export interface PartIdentificationCandidate {
  brand?: string | null;
  mpn?: string | null;
  oemNumber?: string | null;
}

export interface BrowseCorroborationResult {
  /** False if brand/MPN were too sparse to attempt a lookup at all. */
  checked: boolean;
  found: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  fitmentHints?: Array<{ year?: string; make?: string; model?: string }>;
  /** Deterministic brand-format warnings — evidence for the validator, not a hard block. */
  hallucinationWarnings: string[];
}

/**
 * Bridges live eBay data into the Add-Part inline-enrich flow:
 *  - corroborates a vision/OEM-text identified brand+MPN against real eBay
 *    catalog listings via the Browse API
 *  - grows the durable `ebay_categories` truth table so the (already
 *    prod-enabled) AI_TAXONOMY_VALIDATION_ENABLED gate has real data to
 *    check against instead of soft-failing on every category
 */
@Injectable()
export class PartIdentificationService {
  private readonly logger = new Logger(PartIdentificationService.name);

  constructor(
    private readonly browseApi: EbayBrowseApiService,
    private readonly taxonomy: EbayTaxonomyApiService,
    @InjectRepository(EbayCategory)
    private readonly categoryRepo: Repository<EbayCategory>,
  ) {}

  /**
   * Corroborate a candidate brand+MPN/OEM number against live eBay listings.
   * This is evidence, not a gate — a legitimately rare part can have zero
   * matching listings and still be a real, valid identification.
   */
  async identifyAndCorroborate(
    candidate: PartIdentificationCandidate,
  ): Promise<BrowseCorroborationResult> {
    const brand = candidate.brand?.trim();
    const mpn = (candidate.mpn ?? candidate.oemNumber)?.trim();
    if (!brand || !mpn) {
      return { checked: false, found: false, hallucinationWarnings: [] };
    }

    const hallucinationWarnings = detectHallucinatedPartNumbers(
      [{ oemPartNumber: mpn, partName: 'identified_part' }],
      brand,
    );
    if (hallucinationWarnings.length > 0) {
      this.logger.warn(
        `Part identification: hallucination check flagged ${brand} ${mpn}: ` +
          hallucinationWarnings.join('; '),
      );
    }

    try {
      const result = await this.browseApi.searchByMpn(brand, mpn);
      if (!result.found || result.items.length === 0) {
        return { checked: true, found: false, hallucinationWarnings };
      }

      const best = result.items.find((i) => i.categoryId) ?? result.items[0];
      return {
        checked: true,
        found: true,
        categoryId: best.categoryId ?? null,
        categoryName: best.categoryName ?? null,
        fitmentHints: best.fitmentHints,
        hallucinationWarnings,
      };
    } catch (err) {
      this.logger.warn(
        `Browse API corroboration failed for ${brand} ${mpn}: ` +
          `${err instanceof Error ? err.message : err}`,
      );
      return { checked: false, found: false, hallucinationWarnings };
    }
  }

  /**
   * Ensure a resolved category has a durable row in `ebay_categories`.
   * Fire-and-forget from the caller's perspective — never blocks enrichment.
   */
  async ensureCategoryCached(
    categoryId: string | null | undefined,
    treeId = '0',
  ): Promise<void> {
    if (!categoryId?.trim()) return;

    try {
      const existing = await this.categoryRepo.findOne({
        where: { ebayCategoryId: categoryId, treeId },
      });
      if (existing) return;

      const [subtree, aspects] = await Promise.all([
        this.taxonomy.getCategorySubtree(categoryId, treeId).catch(() => null),
        this.taxonomy
          .getItemAspectsForCategory(categoryId, treeId)
          .catch((): EbayAspect[] => []),
      ]);

      const node = subtree?.categorySubtreeNode;
      const requiredAspects = aspects.filter(
        (a) => a.aspectConstraint?.aspectRequired,
      ) as unknown as Record<string, unknown>[];
      const recommendedAspects = aspects.filter(
        (a) => !a.aspectConstraint?.aspectRequired,
      ) as unknown as Record<string, unknown>[];

      const row = new EbayCategory();
      row.ebayCategoryId = categoryId;
      row.treeId = treeId;
      row.parentCategoryId = null;
      row.categoryName = node?.category?.categoryName ?? categoryId;
      row.categoryPath = null;
      row.depth = 0;
      // Default to leaf when the subtree lookup itself failed — a category
      // we can't introspect shouldn't silently block listing on this cache.
      row.isLeaf = node?.leafCategoryTreeNode ?? true;
      row.requiredAspects = requiredAspects;
      row.recommendedAspects = recommendedAspects;
      row.supportsCompatibility = false;
      row.treeVersion = null;
      await this.categoryRepo.save(row);

      this.logger.log(
        `Cached eBay category ${categoryId} (tree ${treeId}): leaf=${row.isLeaf}, ` +
          `${requiredAspects.length} required aspect(s)`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to cache category ${categoryId}: ` +
          `${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
