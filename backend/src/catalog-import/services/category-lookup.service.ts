import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { EbayTaxonomyApiService } from '../../channels/ebay/ebay-taxonomy-api.service.js';
import { CatalogProduct } from '../entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';

export interface CategoryLookupResult {
  categoryId: string | null;
  categoryName: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

@Injectable()
export class CategoryLookupService {
  private readonly logger = new Logger(CategoryLookupService.name);

  /** Cache marketplace → category tree ID lookups to avoid repeated API calls */
  private readonly treeIdCache = new Map<string, string>();

  /** Known tree IDs for common marketplaces (avoids API call) */
  private static readonly KNOWN_TREE_IDS: Record<string, string> = {
    EBAY_US: '0',
    EBAY_AU: '100',
    EBAY_DE: '77',
    EBAY_GB: '3',
  };

  constructor(
    private readonly taxonomy: EbayTaxonomyApiService,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
  ) {}

  // ── Public API ─────────────────────────────────────────────

  /**
   * Look up the best eBay category for a product using eBay's Taxonomy API.
   * Builds a keyword query from available product fields.
   */
  async lookupCategory(
    title?: string | null,
    brand?: string | null,
    partType?: string | null,
    mpn?: string | null,
    marketplace?: string | null,
  ): Promise<CategoryLookupResult> {
    const treeId = await this.resolveTreeId(marketplace);
    const query = this.buildQuery(title, brand, partType, mpn);

    if (!query) {
      return { categoryId: null, categoryName: null, confidence: 'none' };
    }

    try {
      const suggestions = await this.taxonomy.getCategorySuggestions(query, treeId);
      const first = suggestions?.[0];
      if (first?.category?.categoryId) {
        const isExact = first.relevancy === 'RELEVANT' || first.relevancy?.includes('HIGH');
        return {
          categoryId: first.category.categoryId,
          categoryName: first.category.categoryName ?? null,
          confidence: isExact ? 'high' : 'medium',
        };
      }
      return { categoryId: null, categoryName: null, confidence: 'none' };
    } catch (err) {
      this.logger.warn(`eBay category lookup failed for query "${query}": ${(err as Error).message}`);
      return { categoryId: null, categoryName: null, confidence: 'none' };
    }
  }

  /**
   * Lookup + update a CatalogProduct and all associated ListingRecords in one shot.
   */
  async lookupAndUpdateProduct(product: CatalogProduct): Promise<boolean> {
    if (product.categoryId) return false; // already set

    const result = await this.lookupCategory(
      product.title,
      product.brand,
      product.partType,
      product.mpn,
    );

    if (!result.categoryId) return false;

    await this.productRepo.update(product.id, {
      categoryId: result.categoryId,
      categoryName: result.categoryName,
    });

    // Also update all listing records that reference this product by SKU
    if (product.sku) {
      await this.listingRepo.update(
        { customLabelSku: product.sku, categoryId: IsNull() },
        {
          categoryId: result.categoryId,
          categoryName: result.categoryName,
        },
      );
    }

    this.logger.log(`Updated product ${product.id} (${product.sku ?? 'no-sku'}) → category ${result.categoryId} (${result.categoryName})`);
    return true;
  }

  /**
   * Scan all CatalogProducts with null categoryId and backfill them.
   * Returns count of successfully updated products.
   */
  async backfillMissingCategories(
    batchSize = 10,
    concurrency = 2,
  ): Promise<{ scanned: number; updated: number; failed: number }> {
    const total = await this.productRepo.count({ where: { categoryId: IsNull() } });
    this.logger.log(`Backfill starting: ${total} products with missing categoryId`);

    let scanned = 0;
    let updated = 0;
    let failed = 0;

    // Process in batches with limited concurrency
    for (let offset = 0; offset < total; offset += batchSize) {
      const batch = await this.productRepo.find({
        where: { categoryId: IsNull() },
        take: batchSize,
        skip: offset,
        order: { createdAt: 'DESC' },
      });

      // Run batch with limited concurrency
      const results = await Promise.allSettled(
        batch.map((product) => this.lookupAndUpdateProduct(product)),
      );

      for (const result of results) {
        scanned++;
        if (result.status === 'fulfilled' && result.value) {
          updated++;
        } else {
          failed++;
        }
      }

      this.logger.log(`Backfill progress: ${scanned}/${total} scanned, ${updated} updated, ${failed} failed`);
    }

    this.logger.log(`Backfill complete: ${scanned} scanned, ${updated} updated, ${failed} failed`);
    return { scanned, updated, failed };
  }

  /**
   * Backfill missing categories for listing records that still have null
   * categoryId after the catalog product backfill (orphan listings with no
   * matching catalog product, or listings whose product lookup failed).
   */
  async backfillListingRecords(
    batchSize = 10,
    concurrency = 2,
  ): Promise<{ scanned: number; updated: number; failed: number }> {
    // Only target listings that weren't already updated by backfillMissingCategories
    // (i.e. where categoryId is still null)
    const total = await this.listingRepo.count({
      where: { categoryId: IsNull() },
    });
    if (total === 0) {
      this.logger.log('ListingRecord backfill: no records with missing categoryId');
      return { scanned: 0, updated: 0, failed: 0 };
    }
    this.logger.log(`ListingRecord backfill starting: ${total} records with missing categoryId`);

    let scanned = 0;
    let updated = 0;
    let failed = 0;

    for (let offset = 0; offset < total; offset += batchSize) {
      const batch = await this.listingRepo.find({
        where: { categoryId: IsNull() },
        take: batchSize,
        skip: offset,
        order: { importedAt: 'DESC' },
      });

      const results = await Promise.allSettled(
        batch.map((rec) => this.lookupAndUpdateListingRecord(rec)),
      );

      for (const result of results) {
        scanned++;
        if (result.status === 'fulfilled' && result.value) {
          updated++;
        } else {
          failed++;
        }
      }
    }

    this.logger.log(`ListingRecord backfill complete: ${scanned} scanned, ${updated} updated, ${failed} failed`);
    return { scanned, updated, failed };
  }

  // ── Private ────────────────────────────────────────────────

  private async lookupAndUpdateListingRecord(rec: ListingRecord): Promise<boolean> {
    const result = await this.lookupCategory(
      rec.title,
      rec.cBrand,
      null, // listing records don't have partType
      null,
      rec.marketplace,
    );

    if (!result.categoryId) return false;

    await this.listingRepo.update(rec.id, {
      categoryId: result.categoryId,
      categoryName: result.categoryName,
    });

    return true;
  }

  private buildQuery(
    title?: string | null,
    brand?: string | null,
    partType?: string | null,
    mpn?: string | null,
  ): string {
    const parts = [brand, partType, title].filter((s) => s && s.trim());
    if (parts.length === 0 && mpn) parts.push(mpn);
    return parts.join(' ').trim();
  }

  /**
   * Resolve a marketplace identifier to an eBay category tree ID.
   * Uses known trees for common marketplaces, falls back to API lookup.
   */
  private async resolveTreeId(marketplace?: string | null): Promise<string> {
    if (!marketplace) {
      return EbayTaxonomyApiService.EBAY_US_TREE_ID;
    }

    // Map short codes to marketplace IDs
    const mktToEbay: Record<string, string> = {
      US: 'EBAY_US',
      AU: 'EBAY_AU',
      DE: 'EBAY_DE',
      GB: 'EBAY_GB',
    };

    const ebayMkt = marketplace.includes('EBAY_')
      ? marketplace
      : (mktToEbay[marketplace] ?? 'EBAY_US');

    // Check cache first
    const cached = this.treeIdCache.get(ebayMkt);
    if (cached) return cached;

    // Check known trees
    const known = CategoryLookupService.KNOWN_TREE_IDS[ebayMkt];
    if (known) {
      this.treeIdCache.set(ebayMkt, known);
      return known;
    }

    // Fallback: look up via API
    try {
      const treeId = await this.taxonomy.getDefaultCategoryTreeId(ebayMkt);
      this.treeIdCache.set(ebayMkt, treeId);
      return treeId;
    } catch {
      return EbayTaxonomyApiService.EBAY_US_TREE_ID;
    }
  }
}
