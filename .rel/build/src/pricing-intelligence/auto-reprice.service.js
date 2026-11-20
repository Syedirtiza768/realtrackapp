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
var AutoRepriceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoRepriceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const master_product_entity_js_1 = require("../listings/entities/master-product.entity.js");
const ebay_offer_entity_js_1 = require("../listings/entities/ebay-offer.entity.js");
const competitor_price_entity_js_1 = require("../listings/entities/competitor-price.entity.js");
const market_snapshot_entity_js_1 = require("../listings/entities/market-snapshot.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const ebay_inventory_api_service_js_1 = require("../channels/ebay/ebay-inventory-api.service.js");
const pricing_analysis_pipeline_js_1 = require("../common/openai/pipelines/pricing-analysis.pipeline.js");
let AutoRepriceService = AutoRepriceService_1 = class AutoRepriceService {
    productRepo;
    offerRepo;
    competitorRepo;
    snapshotRepo;
    storeRepo;
    inventoryApi;
    pricingPipeline;
    eventEmitter;
    logger = new common_1.Logger(AutoRepriceService_1.name);
    AUTO_APPLY_THRESHOLD = 0.7;
    constructor(productRepo, offerRepo, competitorRepo, snapshotRepo, storeRepo, inventoryApi, pricingPipeline, eventEmitter) {
        this.productRepo = productRepo;
        this.offerRepo = offerRepo;
        this.competitorRepo = competitorRepo;
        this.snapshotRepo = snapshotRepo;
        this.storeRepo = storeRepo;
        this.inventoryApi = inventoryApi;
        this.pricingPipeline = pricingPipeline;
        this.eventEmitter = eventEmitter;
    }
    async getSuggestion(productId) {
        const product = await this.productRepo.findOneByOrFail({ id: productId });
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const competitors = await this.competitorRepo
            .createQueryBuilder('c')
            .where('c.master_product_id = :productId', { productId })
            .andWhere('c.captured_at > :since', { since })
            .orderBy('c.captured_at', 'DESC')
            .take(25)
            .getMany();
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
                medianPrice: snapshot.medianPrice
                    ? Number(snapshot.medianPrice)
                    : null,
                minPrice: snapshot.minPrice ? Number(snapshot.minPrice) : null,
                maxPrice: snapshot.maxPrice ? Number(snapshot.maxPrice) : null,
            }
            : {
                totalListings: competitors.length,
                avgPrice: competitors.length > 0
                    ? competitors.reduce((s, c) => s + Number(c.price), 0) /
                        competitors.length
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
    async repriceProduct(productId, options) {
        const suggestion = await this.getSuggestion(productId);
        if (suggestion.confidence < this.AUTO_APPLY_THRESHOLD &&
            !options?.forceApply) {
            this.logger.log(`Product ${productId}: confidence ${suggestion.confidence} below threshold — queued for review`);
            this.eventEmitter.emit('pricing.review_needed', {
                productId,
                suggestion,
            });
            return { suggestion, results: [] };
        }
        const whereClause = {
            masterProductId: productId,
            status: 'published',
            ebayOfferId: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
        };
        if (options?.storeIds?.length) {
            whereClause.storeId = (0, typeorm_2.In)(options.storeIds);
        }
        const offers = await this.offerRepo.find({ where: whereClause });
        const results = [];
        for (const offer of offers) {
            const store = await this.storeRepo.findOneBy({ id: offer.storeId });
            const storeName = store?.storeName ?? offer.storeId;
            const oldPrice = offer.price ? Number(offer.price) : null;
            const newPrice = suggestion.suggestedPrice;
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
                await this.inventoryApi.updateOffer(offer.storeId, offer.ebayOfferId, {
                    pricingSummary: {
                        price: { value: newPrice.toFixed(2), currency: 'USD' },
                    },
                });
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
                this.logger.log(`Repriced offer ${offer.ebayOfferId} on ${storeName}: $${oldPrice} → $${newPrice.toFixed(2)}`);
            }
            catch (err) {
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
        this.logger.log(`Auto-reprice product ${productId}: ${repriced}/${offers.length} offers updated at $${suggestion.suggestedPrice.toFixed(2)}`);
        return { suggestion, results };
    }
};
exports.AutoRepriceService = AutoRepriceService;
exports.AutoRepriceService = AutoRepriceService = AutoRepriceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(master_product_entity_js_1.MasterProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_offer_entity_js_1.EbayOffer)),
    __param(2, (0, typeorm_1.InjectRepository)(competitor_price_entity_js_1.CompetitorPrice)),
    __param(3, (0, typeorm_1.InjectRepository)(market_snapshot_entity_js_1.MarketSnapshot)),
    __param(4, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        pricing_analysis_pipeline_js_1.PricingAnalysisPipeline,
        event_emitter_1.EventEmitter2])
], AutoRepriceService);
//# sourceMappingURL=auto-reprice.service.js.map