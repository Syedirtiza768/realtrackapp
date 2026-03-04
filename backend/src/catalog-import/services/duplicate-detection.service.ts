import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../entities/catalog-product.entity.js';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  isPartialMatch: boolean;
  matchStrategy: string | null;
  matchedProductId: string | null;
  confidence: number;
}

/**
 * Multi-layer duplicate detection for catalog products.
 *
 * Strategy priority:
 * 1. SKU (exact)
 * 2. Manufacturer Part Number (exact, normalized)
 * 3. eBay Item ID (exact)
 * 4. UPC / EAN (exact)
 * 5. Brand + MPN combination (normalized)
 * 6. Normalized title (fuzzy / exact)
 */
@Injectable()
export class DuplicateDetectionService {
  private readonly logger = new Logger(DuplicateDetectionService.name);

  constructor(
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
  ) {}

  /**
   * Check if a product already exists in the catalog using multi-layer matching.
   */
  async checkDuplicate(product: {
    sku?: string | null;
    mpn?: string | null;
    upc?: string | null;
    ean?: string | null;
    ebayItemId?: string | null;
    title?: string | null;
    brand?: string | null;
  }): Promise<DuplicateCheckResult> {
    // Layer 1: SKU (exact match)
    if (product.sku) {
      const match = await this.productRepo.findOne({
        where: { sku: product.sku },
        select: ['id'],
      });
      if (match) {
        return {
          isDuplicate: true,
          isPartialMatch: false,
          matchStrategy: 'sku',
          matchedProductId: match.id,
          confidence: 1.0,
        };
      }
    }

    // Layer 2: MPN (normalized exact match)
    if (product.mpn) {
      const normalized = this.normalizeMpn(product.mpn);
      const match = await this.productRepo.findOne({
        where: { mpnNormalized: normalized },
        select: ['id'],
      });
      if (match) {
        return {
          isDuplicate: true,
          isPartialMatch: false,
          matchStrategy: 'mpn',
          matchedProductId: match.id,
          confidence: 0.95,
        };
      }
    }

    // Layer 3: eBay Item ID (exact match)
    if (product.ebayItemId) {
      const match = await this.productRepo.findOne({
        where: { ebayItemId: product.ebayItemId },
        select: ['id'],
      });
      if (match) {
        return {
          isDuplicate: true,
          isPartialMatch: false,
          matchStrategy: 'ebay_item_id',
          matchedProductId: match.id,
          confidence: 1.0,
        };
      }
    }

    // Layer 4: UPC (exact match)
    if (product.upc) {
      const match = await this.productRepo.findOne({
        where: { upc: product.upc },
        select: ['id'],
      });
      if (match) {
        return {
          isDuplicate: true,
          isPartialMatch: false,
          matchStrategy: 'upc',
          matchedProductId: match.id,
          confidence: 1.0,
        };
      }
    }

    // Layer 5: Brand + MPN combination (normalized)
    if (product.brand && product.mpn) {
      const brandNorm = this.normalizeBrand(product.brand);
      const mpnNorm = this.normalizeMpn(product.mpn);
      const match = await this.productRepo.findOne({
        where: { brandNormalized: brandNorm, mpnNormalized: mpnNorm },
        select: ['id'],
      });
      if (match) {
        return {
          isDuplicate: true,
          isPartialMatch: false,
          matchStrategy: 'brand_mpn',
          matchedProductId: match.id,
          confidence: 0.9,
        };
      }
    }

    // Layer 6: Normalized title match (partial — flag for review)
    if (product.title) {
      const titleNorm = this.normalizeTitle(product.title);
      const match = await this.productRepo.findOne({
        where: { titleNormalized: titleNorm },
        select: ['id'],
      });
      if (match) {
        return {
          isDuplicate: false,
          isPartialMatch: true,
          matchStrategy: 'title_normalized',
          matchedProductId: match.id,
          confidence: 0.7,
        };
      }
    }

    // No match
    return {
      isDuplicate: false,
      isPartialMatch: false,
      matchStrategy: null,
      matchedProductId: null,
      confidence: 0,
    };
  }

  /**
   * Batch-optimized duplicate check using IN queries.
   * Returns a Map from an internal key to the check result.
   */
  async checkDuplicateBatch(
    products: Array<{
      index: number;
      sku?: string | null;
      mpn?: string | null;
      upc?: string | null;
      title?: string | null;
      brand?: string | null;
    }>,
  ): Promise<Map<number, DuplicateCheckResult>> {
    const results = new Map<number, DuplicateCheckResult>();

    // Collect all SKUs for a batch lookup
    const skuEntries = products.filter((p) => p.sku);
    if (skuEntries.length > 0) {
      const skus = skuEntries.map((p) => p.sku!);
      const existingBySku = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.id', 'p.sku'])
        .where('p.sku IN (:...skus)', { skus })
        .getMany();

      const skuMap = new Map(existingBySku.map((p) => [p.sku, p.id]));

      for (const entry of skuEntries) {
        if (skuMap.has(entry.sku!)) {
          results.set(entry.index, {
            isDuplicate: true,
            isPartialMatch: false,
            matchStrategy: 'sku',
            matchedProductId: skuMap.get(entry.sku!)!,
            confidence: 1.0,
          });
        }
      }
    }

    // Collect remaining items for MPN batch lookup
    const mpnEntries = products.filter((p) => p.mpn && !results.has(p.index));
    if (mpnEntries.length > 0) {
      const mpns = mpnEntries.map((p) => this.normalizeMpn(p.mpn!));
      const existingByMpn = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.id', 'p.mpnNormalized'])
        .where('p.mpn_normalized IN (:...mpns)', { mpns })
        .getMany();

      const mpnMap = new Map(existingByMpn.map((p) => [p.mpnNormalized, p.id]));

      for (const entry of mpnEntries) {
        const norm = this.normalizeMpn(entry.mpn!);
        if (mpnMap.has(norm)) {
          results.set(entry.index, {
            isDuplicate: true,
            isPartialMatch: false,
            matchStrategy: 'mpn',
            matchedProductId: mpnMap.get(norm)!,
            confidence: 0.95,
          });
        }
      }
    }

    // Remaining items: title check (partial match → flag for review)
    const titleEntries = products.filter(
      (p) => p.title && !results.has(p.index),
    );
    if (titleEntries.length > 0) {
      const titles = titleEntries.map((p) => this.normalizeTitle(p.title!));
      const existingByTitle = await this.productRepo
        .createQueryBuilder('p')
        .select(['p.id', 'p.titleNormalized'])
        .where('p.title_normalized IN (:...titles)', { titles })
        .getMany();

      const titleMap = new Map(
        existingByTitle.map((p) => [p.titleNormalized, p.id]),
      );

      for (const entry of titleEntries) {
        const norm = this.normalizeTitle(entry.title!);
        if (titleMap.has(norm)) {
          results.set(entry.index, {
            isDuplicate: false,
            isPartialMatch: true,
            matchStrategy: 'title_normalized',
            matchedProductId: titleMap.get(norm)!,
            confidence: 0.7,
          });
        }
      }
    }

    return results;
  }

  /* ── Normalization helpers ─────────────────────────────── */

  normalizeMpn(mpn: string): string {
    return mpn
      .toUpperCase()
      .replace(/[\s\-_.\/\\]+/g, '')
      .trim();
  }

  normalizeBrand(brand: string): string {
    return brand
      .toUpperCase()
      .replace(/[\s\-_.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
