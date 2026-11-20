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
var PublishedListingsPricingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsPricingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_browse_api_service_js_1 = require("../../channels/ebay/ebay-browse-api.service.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
const published_listings_health_service_js_1 = require("./published-listings-health.service.js");
let PublishedListingsPricingService = PublishedListingsPricingService_1 = class PublishedListingsPricingService {
    listingRepo;
    accountRepo;
    browseApi;
    health;
    logger = new common_1.Logger(PublishedListingsPricingService_1.name);
    constructor(listingRepo, accountRepo, browseApi, health) {
        this.listingRepo = listingRepo;
        this.accountRepo = accountRepo;
        this.browseApi = browseApi;
        this.health = health;
    }
    buildSearchQuery(listing) {
        const specifics = listing.itemSpecifics ?? {};
        const brand = specifics.Brand?.[0] ??
            specifics['Manufacturer']?.[0] ??
            specifics['Brand Name']?.[0];
        const mpn = specifics['Manufacturer Part Number']?.[0] ??
            specifics.MPN?.[0] ??
            specifics['OE/OEM Part Number']?.[0];
        if (brand && mpn)
            return `${brand} ${mpn}`.trim();
        if (mpn)
            return mpn;
        if (listing.sku && listing.sku.length >= 4)
            return listing.sku;
        if (listing.title.length >= 8) {
            return listing.title.split(/\s+/).slice(0, 6).join(' ');
        }
        return null;
    }
    async refreshCompetitorPricing(listingId, organizationId) {
        const listing = await this.listingRepo.findOne({
            where: { id: listingId, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        const searchQuery = this.buildSearchQuery(listing);
        if (!searchQuery) {
            this.logger.debug(`No search query for listing ${listingId}`);
            return listing;
        }
        const condition = listing.condition?.toUpperCase().includes('NEW')
            ? 'NEW'
            : undefined;
        const pricing = await this.browseApi.getCompetitorPricing(searchQuery, condition, 25);
        const snapshot = {
            searchQuery,
            sampleCount: pricing.items.length,
            avgPrice: pricing.avgPrice,
            medianPrice: pricing.medianPrice,
            minPrice: pricing.minPrice,
            maxPrice: pricing.maxPrice,
            fetchedAt: new Date().toISOString(),
            topCompetitors: pricing.items.slice(0, 5).map((i) => ({
                itemId: i.itemId ?? null,
                title: i.title ?? null,
                price: i.price?.value ? Number(i.price.value) : null,
                condition: i.condition ?? null,
            })),
        };
        listing.performanceMetrics = {
            ...(listing.performanceMetrics ?? {}),
            competitorPricing: snapshot,
        };
        listing.healthFlags = this.health.computeHealthFlags({
            title: listing.title,
            imageUrls: listing.imageUrls,
            itemSpecifics: listing.itemSpecifics,
            compatibility: listing.compatibility,
            quantityAvailable: listing.quantityAvailable,
            quantitySold: listing.quantitySold,
            performanceMetrics: listing.performanceMetrics,
            categoryId: listing.categoryId,
            price: listing.price,
            competitorPricing: snapshot,
        });
        await this.listingRepo.save(listing);
        return listing;
    }
    async refreshForAccount(organizationId, ebayAccountId, limit = 50) {
        const listings = await this.listingRepo.find({
            where: { organizationId, ebayAccountId, listingStatus: 'active' },
            order: { updatedAt: 'DESC' },
            take: limit,
        });
        let updated = 0;
        let skipped = 0;
        for (const listing of listings) {
            if (!this.buildSearchQuery(listing)) {
                skipped += 1;
                continue;
            }
            try {
                await this.refreshCompetitorPricing(listing.id, organizationId);
                updated += 1;
            }
            catch (e) {
                this.logger.warn(`Competitor pricing failed for ${listing.id}: ${e instanceof Error ? e.message : String(e)}`);
                skipped += 1;
            }
        }
        return { processed: listings.length, updated, skipped };
    }
    async refreshForOrganization(organizationId, limitPerAccount = 50) {
        const accounts = await this.accountRepo.find({
            where: { organizationId, connectionStatus: 'active' },
        });
        let updated = 0;
        let skipped = 0;
        for (const account of accounts) {
            const result = await this.refreshForAccount(organizationId, account.id, limitPerAccount);
            updated += result.updated;
            skipped += result.skipped;
        }
        return { accounts: accounts.length, updated, skipped };
    }
};
exports.PublishedListingsPricingService = PublishedListingsPricingService;
exports.PublishedListingsPricingService = PublishedListingsPricingService = PublishedListingsPricingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __param(1, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_browse_api_service_js_1.EbayBrowseApiService,
        published_listings_health_service_js_1.PublishedListingsHealthService])
], PublishedListingsPricingService);
//# sourceMappingURL=published-listings-pricing.service.js.map