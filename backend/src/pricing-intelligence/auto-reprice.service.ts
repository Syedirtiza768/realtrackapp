import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, IsNull, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MasterProduct } from '../listings/entities/master-product.entity.js';
import { EbayOffer } from '../listings/entities/ebay-offer.entity.js';
import { CompetitorPrice } from '../listings/entities/competitor-price.entity.js';
import { MarketSnapshot } from '../listings/entities/market-snapshot.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { PricingAnalysisPipeline, type PricingSuggestion } from '../common/openai/pipelines/pricing-analysis.pipeline.js';

/**
 * Reprice result for a single offer.
 */
export interface RepriceResult {
  offerId: string;
  storeId: string;
  storeName: string;
  oldPrice: number | null;
  newPrice: number;
  action: 'repriced' | 'unchanged' | 'skipped' | 'error';
  error?: string;
}

/**
 * AutoRepriceService — Phase 5 automated repricing engine.
 *
 * Flow:
 *  1. Fetch recent competitor prices + market snapshot
 *  2. Run PricingAnalysisPipeline (OpenAI) to get suggested price
 *  3. If confidence ≥ threshold, push new price to eBay offers via Inventory API
 *  4. Emit events for audit/notification
 *
 * Can be triggered manually (single product) or by automation rules.
 */
@Injectable()
export class AutoRepriceService {
  private readonly logger = new Logger(AutoRepriceService.name);

  /** Minimum AI confidence score to auto-apply pricing */
  private readonly AUTO_APPLY_THRESHOLD = 0.7;

  constructor(
    @InjectRepository(MasterProduct)
    private readonly productRepo: Repository<MasterProduct>,
    @InjectRepository(EbayOffer)
    private readonly offerRepo: Repository<EbayOffer>,
    @InjectRepository(CompetitorPrice)
    private readonly competitorRepo: Repository<CompetitorPrice>,
    @InjectRepository(MarketSnapshot)
    private readonly snapshotRepo: Repository<MarketSnapshot>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly pricingPipeline: PricingAnalysisPipeline,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get a pricing suggestion for a product (without applying it).
   */
  async getSuggestion(productId: string): Promise<PricingSuggestion> {
    const product = await this.productRepo.findOneByOrFail({ id: productId });

    // Fetch recent competitor prices (last 7 days)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const competitors = await this.competitorRepo
      .createQueryBuilder('c')
      .where('c.master_product_id = :productId', { productId })
      .andWhere('c.captured_at > :since', { since })
      .orderBy('c.captured_at', 'DESC')
      .take(25)
      .getMany();

    // Get latest market snapshot
    const snapshot = await this.snapshotRepo.findOne({
      where: { masterProductId: productId },
      order: { capturedAt: 'DESC' },
    });

    const competitorData = competitors.map((c) => ({
      seller: c.seller ?? 'unknown',
      price: Number(c.price),
      condition: c.condition ?? 'unknown',
      title: c.title ?? '',
    }));

    const marketSummary = snapshot
      ? {
          totalListings: snapshot.totalListings,
          avgPrice: snapshot.avgPrice ? Number(snapshot.avgPrice) : null,
          medianPrice: snapshot.medianPrice ? Number(snapshot.medianPrice) : null,
          minPrice: snapshot.minPrice ? Number(snapshot.minPrice) : null,
          maxPrice: snapshot.maxPrice ? Number(snapshot.maxPrice) : null,
        }
      : {
          totalListings: competitors.length,
          avgPrice: competitors.length > 0
            ? competitors.reduce((s, c) => s + Number(c.price), 0) / competitors.length
            : null,
          medianPrice: null,
          minPrice: competitors.length > 0
            ? Math.min(...competitors.map((c) => Number(c.price)))
            : null,
          maxPrice: competitors.length > 0
            ? Math.max(...competitors.map((c) => Number(c.price)))
            : null,
        };

    return this.pricingPipeline.suggestPrice({
      productTitle: product.title ?? `${product.brand} ${product.mpn}`,
      partNumber: product.mpn ?? product.sku,
      brand: product.brand ?? '',
      condition: product.condition ?? 'New',
      costPrice: product.costPrice ? Number(product.costPrice) : null,
      retailPrice: product.retailPrice ? Number(product.retailPrice) : null,
      mapPrice: product.mapPrice ? Number(product.mapPrice) : null,
      competitors: competitorData,
      marketSummary,
    });
  }

  /**
   * Auto-reprice a product across all (or selected) stores.
   * Pushes new prices to eBay if confidence is above threshold.
   */
  async repriceProduct(
    productId: string,
    options?: { storeIds?: string[]; forceApply?: boolean },
  ): Promise<{
    suggestion: PricingSuggestion;
    results: RepriceResult[];
  }> {
    const suggestion = await this.getSuggestion(productId);

    if (suggestion.confidence < this.AUTO_APPLY_THRESHOLD && !options?.forceApply) {
      this.logger.log(
        `Product ${productId}: confidence ${suggestion.confidence} below threshold — queued for review`,
      );
      this.eventEmitter.emit('pricing.review_needed', {
        productId,
        suggestion,
      });
      return { suggestion, results: [] };
    }

    // Find published eBay offers for this product
    const whereClause: Record<string, unknown> = {
      masterProductId: productId,
      status: 'published',
      ebayOfferId: Not(IsNull()),
    };
    if (options?.storeIds?.length) {
      whereClause.storeId = In(options.storeIds);
    }

    const offers = await this.offerRepo.find({ where: whereClause });
    const results: RepriceResult[] = [];

    for (const offer of offers) {
      const store = await this.storeRepo.findOneBy({ id: offer.storeId });
      const storeName = store?.storeName ?? offer.storeId;

      const oldPrice = offer.price ? Number(offer.price) : null;
      const newPrice = suggestion.suggestedPrice;

      // Skip if price hasn't changed significantly (< $0.01)
      if (oldPrice !== null && Math.abs(newPrice - oldPrice) < 0.01) {
        results.push({
          offerId: offer.id,
          storeId: offer.storeId,
          storeName,
          oldPrice,
          newPrice,
          action: 'unchanged',
        });
        continue;
      }

      try {
        // Push new price to eBay via Inventory API
        await this.inventoryApi.updateOffer(
          offer.storeId,
          offer.ebayOfferId!,
          {
            pricingSummary: {
              price: { value: newPrice.toFixed(2), currency: 'USD' },
            },
          } as Record<string, unknown>,
        );

        // Update local offer record
        await this.offerRepo.update(offer.id, {
          price: newPrice,
          lastSyncedAt: new Date(),
        });

        results.push({
          offerId: offer.id,
          storeId: offer.storeId,
          storeName,
          oldPrice,
          newPrice,
          action: 'repriced',
        });

        this.logger.log(
          `Repriced offer ${offer.ebayOfferId} on ${storeName}: $${oldPrice} → $${newPrice.toFixed(2)}`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to reprice offer ${offer.id}: ${msg}`);
        results.push({
          offerId: offer.id,
          storeId: offer.storeId,
          storeName,
          oldPrice,
          newPrice,
          action: 'error',
          error: msg,
        });
      }
    }

    // Emit audit event
    this.eventEmitter.emit('pricing.repriced', {
      productId,
      suggestion: {
        suggestedPrice: suggestion.suggestedPrice,
        confidence: suggestion.confidence,
        strategy: suggestion.pricingStrategy,
      },
      results,
    });

    const repriced = results.filter((r) => r.action === 'repriced').length;
    this.logger.log(
      `Auto-reprice product ${productId}: ${repriced}/${offers.length} offers updated at $${suggestion.suggestedPrice.toFixed(2)}`,
    );

    return { suggestion, results };
  }
}
