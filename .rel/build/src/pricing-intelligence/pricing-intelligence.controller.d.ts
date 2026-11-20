import { PriceMonitorService } from './price-monitor.service.js';
import { AutoRepriceService } from './auto-reprice.service.js';
declare class RepriceDto {
    productId: string;
    storeIds?: string[];
    forceApply?: boolean;
}
declare class CollectPricesDto {
    productId?: string;
}
export declare class PricingIntelligenceController {
    private readonly priceMonitor;
    private readonly autoReprice;
    constructor(priceMonitor: PriceMonitorService, autoReprice: AutoRepriceService);
    getLatestSnapshot(productId: string): Promise<import("../listings/entities/market-snapshot.entity.js").MarketSnapshot | null>;
    getSnapshotHistory(productId: string, limit?: string): Promise<import("../listings/entities/market-snapshot.entity.js").MarketSnapshot[]>;
    getCompetitorHistory(productId: string, days?: string): Promise<import("../listings/entities/competitor-price.entity.js").CompetitorPrice[]>;
    getSuggestion(productId: string): Promise<import("../common/openai/pipelines/pricing-analysis.pipeline.js").PricingSuggestion>;
    reprice(dto: RepriceDto): Promise<{
        suggestion: import("../common/openai/pipelines/pricing-analysis.pipeline.js").PricingSuggestion;
        results: import("./auto-reprice.service.js").RepriceResult[];
    }>;
    collectPrices(dto: CollectPricesDto): Promise<{
        processed: number;
        collected: number;
        errors: number;
    }> | Promise<{
        pricesCollected: number;
        snapshot: import("../listings/entities/market-snapshot.entity.js").MarketSnapshot | null;
    }>;
}
export {};
