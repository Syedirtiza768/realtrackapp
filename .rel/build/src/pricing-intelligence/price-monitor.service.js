"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PriceMonitorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceMonitorService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const master_product_entity_js_1 = require("../listings/entities/master-product.entity.js");
const competitor_price_entity_js_1 = require("../listings/entities/competitor-price.entity.js");
const market_snapshot_entity_js_1 = require("../listings/entities/market-snapshot.entity.js");
const ebay_browse_api_service_js_1 = require("../channels/ebay/ebay-browse-api.service.js");
const competitive_analysis_pipeline_js_1 = require("../common/openai/pipelines/competitive-analysis.pipeline.js");
const feature_flag_service_js_1 = require("../common/feature-flags/feature-flag.service.js");
let PriceMonitorService = PriceMonitorService_1 = class PriceMonitorService {
    productRepo;
    competitorRepo;
    snapshotRepo;
    browseApi;
    analysisPipeline;
    featureFlags;
    eventEmitter;
    logger = new common_1.Logger(PriceMonitorService_1.name);
    constructor(productRepo, competitorRepo, snapshotRepo, browseApi, analysisPipeline, featureFlags, eventEmitter) {
        this.productRepo = productRepo;
        this.competitorRepo = competitorRepo;
        this.snapshotRepo = snapshotRepo;
        this.browseApi = browseApi;
        this.analysisPipeline = analysisPipeline;
        this.featureFlags = featureFlags;
        this.eventEmitter = eventEmitter;
    }
    async collectAllCompetitorPrices() {
        if (!(await this.featureFlags.isEnabled('pricing_intelligence'))) {
            this.logger.debug('pricing_intelligence feature flag disabled — skipping');
            return { processed: 0, collected: 0, errors: 0 };
        }
        const products = await this.productRepo.find({
            where: { status: 'published', mpn: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()) },
            select: [
                'id',
                'title',
                'brand',
                'mpn',
                'costPrice',
                'retailPrice',
                'condition',
            ],
        });
        this.logger.log(`Starting competitor price collection for ${products.length} products`);
        let collected = 0;
        let errors = 0;
        for (const product of products) {
            try {
                const result = await this.collectForProduct(product.id);
                collected += result.pricesCollected;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Failed to collect prices for product ${product.id}: ${msg}`);
                errors++;
            }
        }
        this.logger.log(`Price collection complete: ${products.length} products, ${collected} competitor prices, ${errors} errors`);
        return { processed: products.length, collected, errors };
    }
    async collectForProduct(productId) {
        const product = await this.productRepo.findOneByOrFail({ id: productId });
        if (!product.mpn && !product.brand) {
            this.logger.debug(`Product ${productId} has no MPN or brand — skipping`);
            return { pricesCollected: 0, snapshot: null };
        }
        const searchQuery = [product.brand, product.mpn].filter(Boolean).join(' ');
        const pricing = await this.browseApi.getCompetitorPricing(searchQuery, product.condition === 'New' ? 'NEW' : undefined, 25);
        const now = new Date();
        let pricesCollected = 0;
        for (const item of pricing.items) {
            const price = parseFloat(item.price?.value ?? '0');
            if (price <= 0)
                continue;
            await this.competitorRepo.save(this.competitorRepo.create({
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
            }));
            pricesCollected++;
        }
        let snapshot = null;
        if (pricesCollected >= 3) {
            snapshot = await this.generateMarketSnapshot(product, pricing);
        }
        else {
            snapshot = await this.snapshotRepo.save(this.snapshotRepo.create({
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
            }));
        }
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
        this.logger.log(`Product ${product.id} (${product.mpn}): ${pricesCollected} competitor prices, ` +
            `avg=$${pricing.avgPrice ?? 'N/A'}`);
        return { pricesCollected, snapshot };
    }
    async generateMarketSnapshot(product, pricing) {
        const searchQuery = [product.brand, product.mpn].filter(Boolean).join(' ');
        const competitorData = pricing.items.map((item) => ({
            title: item.title ?? '',
            price: item.price?.value ?? '0',
            seller: item.seller?.username ?? 'unknown',
            condition: item.condition ?? 'unknown',
        }));
        const analysis = await this.analysisPipeline.analyze(product.title ?? searchQuery, product.mpn ?? searchQuery, product.condition ?? 'New', competitorData);
        const snapshot = await this.snapshotRepo.save(this.snapshotRepo.create({
            masterProductId: product.id,
            partNumber: product.mpn ?? searchQuery,
            totalListings: analysis.marketSummary.totalListings,
            avgPrice: analysis.marketSummary.avgPrice,
            medianPrice: analysis.marketSummary.medianPrice,
            minPrice: analysis.marketSummary.minPrice,
            maxPrice: analysis.marketSummary.maxPrice,
            recommendedPricing: analysis.recommendedPricing,
            marketInsights: analysis.marketInsights,
            confidence: analysis.confidence,
            aiCostUsd: analysis.rawResponse.estimatedCostUsd,
            capturedAt: new Date(),
        }));
        return snapshot;
    }
    async getCompetitorHistory(productId, days = 30) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return this.competitorRepo.find({
            where: {
                masterProductId: productId,
                capturedAt: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
            },
            order: { capturedAt: 'DESC' },
            take: 200,
        });
    }
    async getLatestSnapshot(productId) {
        return this.snapshotRepo.findOne({
            where: { masterProductId: productId },
            order: { capturedAt: 'DESC' },
        });
    }
    async getSnapshotHistory(productId, limit = 30) {
        return this.snapshotRepo.find({
            where: { masterProductId: productId },
            order: { capturedAt: 'DESC' },
            take: limit,
        });
    }
};
exports.PriceMonitorService = PriceMonitorService;
exports.PriceMonitorService = PriceMonitorService = PriceMonitorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(master_product_entity_js_1.MasterProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(competitor_price_entity_js_1.CompetitorPrice)),
    __param(2, (0, typeorm_1.InjectRepository)(market_snapshot_entity_js_1.MarketSnapshot)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_browse_api_service_js_1.EbayBrowseApiService,
        competitive_analysis_pipeline_js_1.CompetitiveAnalysisPipeline,
        feature_flag_service_js_1.FeatureFlagService,
        event_emitter_1.EventEmitter2])
], PriceMonitorService);
//# sourceMappingURL=price-monitor.service.js.map