import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MasterProduct } from '../listings/entities/master-product.entity.js';
import { EbayOffer } from '../listings/entities/ebay-offer.entity.js';
import { CompetitorPrice } from '../listings/entities/competitor-price.entity.js';
import { MarketSnapshot } from '../listings/entities/market-snapshot.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import { PricingAnalysisPipeline, type PricingSuggestion } from '../common/openai/pipelines/pricing-analysis.pipeline.js';
export interface RepriceResult {
    offerId: string;
    storeId: string;
    storeName: string;
    oldPrice: number | null;
    newPrice: number;
    action: 'repriced' | 'unchanged' | 'skipped' | 'error';
    error?: string;
}
export declare class AutoRepriceService {
    private readonly productRepo;
    private readonly offerRepo;
    private readonly competitorRepo;
    private readonly snapshotRepo;
    private readonly storeRepo;
    private readonly inventoryApi;
    private readonly pricingPipeline;
    private readonly eventEmitter;
    private readonly logger;
    private readonly AUTO_APPLY_THRESHOLD;
    constructor(productRepo: Repository<MasterProduct>, offerRepo: Repository<EbayOffer>, competitorRepo: Repository<CompetitorPrice>, snapshotRepo: Repository<MarketSnapshot>, storeRepo: Repository<Store>, inventoryApi: EbayInventoryApiService, pricingPipeline: PricingAnalysisPipeline, eventEmitter: EventEmitter2);
    getSuggestion(productId: string): Promise<PricingSuggestion>;
    repriceProduct(productId: string, options?: {
        storeIds?: string[];
        forceApply?: boolean;
    }): Promise<{
        suggestion: PricingSuggestion;
        results: RepriceResult[];
    }>;
}
