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
var PublishedListingsTradingEnrichmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsTradingEnrichmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
const ebay_trading_api_service_js_1 = require("../../channels/ebay/ebay-trading-api.service.js");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_BUDGET = Number(process.env.TRADING_ENRICHMENT_DAILY_BUDGET ?? '4500');
let PublishedListingsTradingEnrichmentService = PublishedListingsTradingEnrichmentService_1 = class PublishedListingsTradingEnrichmentService {
    listingRepo;
    tradingApi;
    logger = new common_1.Logger(PublishedListingsTradingEnrichmentService_1.name);
    dailyCallCount = 0;
    dailyResetDate = '';
    constructor(listingRepo, tradingApi) {
        this.listingRepo = listingRepo;
        this.tradingApi = tradingApi;
    }
    checkBudget() {
        const today = new Date().toISOString().slice(0, 10);
        if (today !== this.dailyResetDate) {
            this.dailyCallCount = 0;
            this.dailyResetDate = today;
        }
        return this.dailyCallCount < DAILY_BUDGET;
    }
    incrementBudget() {
        this.dailyCallCount += 1;
    }
    getBudgetStatus() {
        const today = new Date().toISOString().slice(0, 10);
        if (today !== this.dailyResetDate) {
            this.dailyCallCount = 0;
            this.dailyResetDate = today;
        }
        return {
            used: this.dailyCallCount,
            remaining: Math.max(0, DAILY_BUDGET - this.dailyCallCount),
            limit: DAILY_BUDGET,
            resetDate: this.dailyResetDate,
        };
    }
    async enrich(listing, options) {
        const cached = this.readCache(listing);
        if (cached && !options?.force) {
            return {
                data: cached,
                cached: true,
                budget: this.getBudgetStatus(),
            };
        }
        if (!this.checkBudget()) {
            this.logger.warn(`Trading enrichment budget exhausted (${DAILY_BUDGET}/day). ` +
                `Returning stale cache for ${listing.ebayItemId}.`);
            if (cached) {
                return {
                    data: cached,
                    cached: true,
                    budget: this.getBudgetStatus(),
                };
            }
            return {
                data: this.emptyResult(),
                cached: false,
                budget: this.getBudgetStatus(),
            };
        }
        if (!listing.ebayItemId) {
            return {
                data: this.emptyResult(),
                cached: false,
                budget: this.getBudgetStatus(),
            };
        }
        try {
            this.incrementBudget();
            const t0 = Date.now();
            const result = await this.tradingApi.getItemDetails(listing.storeId, listing.ebayItemId, listing.marketplaceId);
            const elapsed = Date.now() - t0;
            this.logger.log(`Trading GetItem ${listing.ebayItemId} completed in ${elapsed}ms ` +
                `(budget: ${this.dailyCallCount}/${DAILY_BUDGET})`);
            const enrichment = {
                enrichedAt: new Date().toISOString(),
                source: 'trading_api',
                imageUrls: result.imageUrls,
                compatibility: result.compatibility,
                description: result.description,
                itemSpecifics: result.itemSpecifics,
            };
            await this.persistCache(listing, enrichment);
            return {
                data: enrichment,
                cached: false,
                budget: this.getBudgetStatus(),
            };
        }
        catch (err) {
            this.logger.warn(`Trading GetItem failed for ${listing.ebayItemId}: ${err instanceof Error ? err.message : String(err)}`);
            if (cached) {
                return {
                    data: cached,
                    cached: true,
                    budget: this.getBudgetStatus(),
                };
            }
            return {
                data: this.emptyResult(),
                cached: false,
                budget: this.getBudgetStatus(),
            };
        }
    }
    async preEnrichBatch(listings, options) {
        let enriched = 0;
        let skipped = 0;
        let failed = 0;
        for (const listing of listings) {
            if (!this.checkBudget()) {
                this.logger.warn(`Pre-enrichment budget exhausted. ${listings.length - enriched - skipped - failed} remaining.`);
                skipped += listings.length - enriched - skipped - failed;
                break;
            }
            const cached = this.readCache(listing);
            if (cached && !options?.force) {
                skipped += 1;
                continue;
            }
            try {
                await this.enrich(listing, options);
                enriched += 1;
            }
            catch {
                failed += 1;
            }
        }
        this.logger.log(`Pre-enrichment batch: ${enriched} enriched, ${skipped} skipped, ${failed} failed. ` +
            `Budget: ${this.dailyCallCount}/${DAILY_BUDGET}`);
        return { enriched, skipped, failed };
    }
    readCache(listing) {
        const raw = listing.rawEbayResponse;
        if (!raw)
            return null;
        const cached = raw['tradingEnrichment'];
        if (!cached?.enrichedAt)
            return null;
        const age = Date.now() - new Date(cached.enrichedAt).getTime();
        if (age > CACHE_TTL_MS)
            return null;
        return cached;
    }
    async persistCache(listing, enrichment) {
        listing.rawEbayResponse = {
            ...(listing.rawEbayResponse ?? {}),
            tradingEnrichment: enrichment,
        };
        await this.listingRepo.save(listing);
    }
    emptyResult() {
        return {
            enrichedAt: new Date().toISOString(),
            source: 'trading_api',
            imageUrls: [],
            compatibility: null,
            description: null,
            itemSpecifics: {},
        };
    }
};
exports.PublishedListingsTradingEnrichmentService = PublishedListingsTradingEnrichmentService;
exports.PublishedListingsTradingEnrichmentService = PublishedListingsTradingEnrichmentService = PublishedListingsTradingEnrichmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        ebay_trading_api_service_js_1.EbayTradingApiService])
], PublishedListingsTradingEnrichmentService);
//# sourceMappingURL=published-listings-trading-enrichment.service.js.map