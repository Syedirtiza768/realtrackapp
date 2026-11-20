import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MasterProduct } from '../listings/entities/master-product.entity.js';
import { CompetitorPrice } from '../listings/entities/competitor-price.entity.js';
import { MarketSnapshot } from '../listings/entities/market-snapshot.entity.js';
import { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import { CompetitiveAnalysisPipeline } from '../common/openai/pipelines/competitive-analysis.pipeline.js';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
export declare class PriceMonitorService {
    private readonly productRepo;
    private readonly competitorRepo;
    private readonly snapshotRepo;
    private readonly browseApi;
    private readonly analysisPipeline;
    private readonly featureFlags;
    private readonly eventEmitter;
    private readonly logger;
    constructor(productRepo: Repository<MasterProduct>, competitorRepo: Repository<CompetitorPrice>, snapshotRepo: Repository<MarketSnapshot>, browseApi: EbayBrowseApiService, analysisPipeline: CompetitiveAnalysisPipeline, featureFlags: FeatureFlagService, eventEmitter: EventEmitter2);
    collectAllCompetitorPrices(): Promise<{
        processed: number;
        collected: number;
        errors: number;
    }>;
    collectForProduct(productId: string): Promise<{
        pricesCollected: number;
        snapshot: MarketSnapshot | null;
    }>;
    private generateMarketSnapshot;
    getCompetitorHistory(productId: string, days?: number): Promise<CompetitorPrice[]>;
    getLatestSnapshot(productId: string): Promise<MarketSnapshot | null>;
    getSnapshotHistory(productId: string, limit?: number): Promise<MarketSnapshot[]>;
}
