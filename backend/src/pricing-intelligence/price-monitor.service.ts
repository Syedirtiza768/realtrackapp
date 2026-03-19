import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MasterProduct } from '../listings/entities/master-product.entity.js';
import { CompetitorPrice } from '../listings/entities/competitor-price.entity.js';
import { MarketSnapshot } from '../listings/entities/market-snapshot.entity.js';
import { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import { CompetitiveAnalysisPipeline } from '../common/openai/pipelines/competitive-analysis.pipeline.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import type { EbayItemSummary } from '../channels/ebay/ebay-api.types.js';

/**
 * PriceMonitorService — Scheduled competitor price collection.
 *
 * Phase 5 core service:
 *  - Collects competitor pricing from eBay Browse API
 *  - Stores in CompetitorPrice table for historical tracking
 *  - Generates MarketSnapshot via AI competitive analysis
 *  - Emits events when significant price changes detected
 *
 * Called by the scheduler every 4 hours for products with MPN.
 */
@Injectable()
export class PriceMonitorService {
  private readonly logger = new Logger(PriceMonitorService.name);

  constructor(
    @InjectRepository(MasterProduct)
    private readonly productRepo: Repository<MasterProduct>,
    @InjectRepository(CompetitorPrice)
    private readonly competitorRepo: Repository<CompetitorPrice>,
    @InjectRepository(MarketSnapshot)
    private readonly snapshotRepo: Repository<MarketSnapshot>,
    private readonly browseApi: EbayBrowseApiService,
    private readonly analysisPipeline: CompetitiveAnalysisPipeline,
    private readonly featureFlags: FeatureFlagService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Collect competitor prices for all active products with a part number.
   * Gated behind 'pricing_intelligence' feature flag.
   */
  async collectAllCompetitorPrices(): Promise<{
    processed: number;
    collected: number;
    errors: number;
  }> {
    if (!(await this.featureFlags.isEnabled('pricing_intelligence'))) {
      this.logger.debug('pricing_intelligence feature flag disabled — skipping');
      return { processed: 0, collected: 0, errors: 0 };
    }

    const products = await this.productRepo.find({
      where: { status: 'published', mpn: Not(IsNull()) },
      select: ['id', 'title', 'brand', 'mpn', 'costPrice', 'retailPrice', 'condition'],
    });

    this.logger.log(`Starting competitor price collection for ${products.length} products`);

    let collected = 0;
    let errors = 0;

    for (const product of products) {
      try {
        const result = await this.collectForProduct(product.id);
        collected += result.pricesCollected;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to collect prices for product ${product.id}: ${msg}`);
        errors++;
      }
    }

    this.logger.log(
      `Price collection complete: ${products.length} products, ${collected} competitor prices, ${errors} errors`,
    );

    return { processed: products.length, collected, errors };
  }

  /**
   * Collect competitor prices for a single product.
   */
  async collectForProduct(productId: string): Promise<{
    pricesCollected: number;
    snapshot: MarketSnapshot | null;
  }> {
    const product = await this.productRepo.findOneByOrFail({ id: productId });

    if (!product.mpn && !product.brand) {
      this.logger.debug(`Product ${productId} has no MPN or brand — skipping`);
      return { pricesCollected: 0, snapshot: null };
    }

    // Build search query from brand + MPN
    const searchQuery = [product.brand, product.mpn].filter(Boolean).join(' ');

    // Fetch competitor listings from eBay Browse API
    const pricing = await this.browseApi.getCompetitorPricing(
      searchQuery,
      product.condition === 'New' ? 'NEW' : undefined,
      25,
    );

    const now = new Date();
    let pricesCollected = 0;

    // Store individual competitor prices
    for (const item of pricing.items) {
      const price = parseFloat(item.price?.value ?? '0');
      if (price <= 0) continue;

      await this.competitorRepo.save(
        this.competitorRepo.create({
          masterProductId: product.id,
          partNumber: product.mpn ?? searchQuery,
          ebayItemId: item.itemId ?? null,
          title: item.title ?? null,
          seller: item.seller?.username ?? null,
          price,
          currency: item.price?.currency ?? 'USD',
          condition: item.condition ?? null,
          quantityAvailable: null,
          quantitySold: null,
          capturedAt: now,
        }),
      );
      pricesCollected++;
    }

    // Generate AI market snapshot if we have enough data
    let snapshot: MarketSnapshot | null = null;
    if (pricesCollected >= 3) {
      snapshot = await this.generateMarketSnapshot(product, pricing);
    } else {
      // Store basic stats without AI analysis
      snapshot = await this.snapshotRepo.save(
        this.snapshotRepo.create({
          masterProductId: product.id,
          partNumber: product.mpn ?? searchQuery,
          totalListings: pricing.total,
          avgPrice: pricing.avgPrice,
          medianPrice: pricing.medianPrice,
          minPrice: pricing.minPrice,
          maxPrice: pricing.maxPrice,
          recommendedPricing: null,
          marketInsights: [],
          confidence: null,
          aiCostUsd: null,
          capturedAt: now,
        }),
      );
    }

    // Emit price change event if market price shifted significantly
    if (snapshot && product.retailPrice && snapshot.avgPrice) {
      const diff = Math.abs(Number(product.retailPrice) - Number(snapshot.avgPrice));
      const pctChange = diff / Number(product.retailPrice);
      if (pctChange > 0.15) {
        this.eventEmitter.emit('pricing.significant_change', {
          productId: product.id,
          title: product.title,
          currentPrice: product.retailPrice,
          marketAvg: snapshot.avgPrice,
          pctChange: Math.round(pctChange * 100),
        });
      }
    }

    this.logger.log(
      `Product ${product.id} (${product.mpn}): ${pricesCollected} competitor prices, ` +
        `avg=$${pricing.avgPrice ?? 'N/A'}`,
    );

    return { pricesCollected, snapshot };
  }

  /**
   * Generate AI-powered market snapshot from competitor data.
   */
  private async generateMarketSnapshot(
    product: MasterProduct,
    pricing: {
      items: EbayItemSummary[];
      total: number;
      avgPrice: number | null;
      medianPrice: number | null;
      minPrice: number | null;
      maxPrice: number | null;
    },
  ): Promise<MarketSnapshot> {
    const searchQuery = [product.brand, product.mpn].filter(Boolean).join(' ');
    const competitorData = pricing.items.map((item) => ({
      title: item.title ?? '',
      price: item.price?.value ?? '0',
      seller: item.seller?.username ?? 'unknown',
      condition: item.condition ?? 'unknown',
    }));

    const analysis = await this.analysisPipeline.analyze(
      product.title ?? searchQuery,
      product.mpn ?? searchQuery,
      product.condition ?? 'New',
      competitorData,
    );

    const snapshot = await this.snapshotRepo.save(
      this.snapshotRepo.create({
        masterProductId: product.id,
        partNumber: product.mpn ?? searchQuery,
        totalListings: analysis.marketSummary.totalListings,
        avgPrice: analysis.marketSummary.avgPrice,
        medianPrice: analysis.marketSummary.medianPrice,
        minPrice: analysis.marketSummary.minPrice,
        maxPrice: analysis.marketSummary.maxPrice,
        recommendedPricing: analysis.recommendedPricing as unknown as Record<string, unknown>,
        marketInsights: analysis.marketInsights,
        confidence: analysis.confidence,
        aiCostUsd: analysis.rawResponse.estimatedCostUsd,
        capturedAt: new Date(),
      }),
    );

    return snapshot;
  }

  /**
   * Get competitor price history for a product.
   */
  async getCompetitorHistory(
    productId: string,
    days = 30,
  ): Promise<CompetitorPrice[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.competitorRepo.find({
      where: {
        masterProductId: productId,
        capturedAt: Not(IsNull()),
      },
      order: { capturedAt: 'DESC' },
      take: 200,
    });
  }

  /**
   * Get latest market snapshot for a product.
   */
  async getLatestSnapshot(productId: string): Promise<MarketSnapshot | null> {
    return this.snapshotRepo.findOne({
      where: { masterProductId: productId },
      order: { capturedAt: 'DESC' },
    });
  }

  /**
   * Get all market snapshots for a product (for charting).
   */
  async getSnapshotHistory(
    productId: string,
    limit = 30,
  ): Promise<MarketSnapshot[]> {
    return this.snapshotRepo.find({
      where: { masterProductId: productId },
      order: { capturedAt: 'DESC' },
      take: limit,
    });
  }
}
