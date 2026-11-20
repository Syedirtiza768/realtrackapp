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
var PublishedListingsEnrichmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsEnrichmentService = void 0;
const common_1 = require("@nestjs/common");
const ebay_browse_api_service_js_1 = require("../../channels/ebay/ebay-browse-api.service.js");
const ebay_inventory_api_service_js_1 = require("../../channels/ebay/ebay-inventory-api.service.js");
const ebay_trading_api_service_js_1 = require("../../channels/ebay/ebay-trading-api.service.js");
const ebay_listing_page_scrape_service_js_1 = require("../../channels/ebay/ebay-listing-page-scrape.service.js");
const ebay_listing_images_util_js_1 = require("../../channels/ebay/ebay-listing-images.util.js");
const ebay_listing_page_scrape_util_js_1 = require("../../channels/ebay/ebay-listing-page-scrape.util.js");
function compatibilityRowCount(compatibility) {
    const rows = compatibility?.compatibleProducts;
    return Array.isArray(rows) ? rows.length : -1;
}
function compatibilityChecked(compatibility) {
    return (compatibility != null && Array.isArray(compatibility.compatibleProducts));
}
function aspectCount(specifics) {
    return Object.keys(specifics ?? {}).length;
}
function extractBrowseImages(item) {
    const urls = [];
    if (item.image?.imageUrl)
        urls.push(item.image.imageUrl);
    const additional = item.additionalImages ?? [];
    for (const img of additional) {
        if (img.imageUrl)
            urls.push(img.imageUrl);
    }
    return [...new Set(urls.map(ebay_listing_images_util_js_1.preferLargeEbayImageUrl))];
}
function extractBrowseCompatibility(item) {
    const raw = item.compatibleProducts ?? null;
    if (!Array.isArray(raw) || raw.length === 0)
        return null;
    return { compatibleProducts: raw };
}
function extractBrowseDescription(item) {
    const desc = item.description;
    const short = item.shortDescription;
    const value = (desc ?? short ?? '').trim();
    return value || null;
}
function extractBrowseItemSpecifics(item) {
    const out = {};
    for (const aspect of item.localizedAspects ?? []) {
        const name = aspect?.name?.trim();
        const value = aspect?.value?.trim();
        if (!name || !value)
            continue;
        const existing = out[name] ?? [];
        if (!existing.includes(value))
            existing.push(value);
        out[name] = existing;
    }
    if (item.brand?.trim()) {
        out.Brand = [...new Set([...(out.Brand ?? []), item.brand.trim()])];
    }
    if (item.mpn?.trim()) {
        out['Manufacturer Part Number'] = [
            ...new Set([...(out['Manufacturer Part Number'] ?? []), item.mpn.trim()]),
        ];
    }
    return out;
}
function mergeItemSpecifics(primary, secondary) {
    if (aspectCount(primary) === 0)
        return { ...(secondary ?? {}) };
    if (aspectCount(secondary) === 0)
        return { ...(primary ?? {}) };
    if (aspectCount(secondary) > aspectCount(primary)) {
        return { ...(secondary ?? {}) };
    }
    return { ...(primary ?? {}) };
}
function tradingEnrichDisabled(inputSkip) {
    if (inputSkip)
        return true;
    const flag = (process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? '').toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
}
let PublishedListingsEnrichmentService = PublishedListingsEnrichmentService_1 = class PublishedListingsEnrichmentService {
    tradingApi;
    browseApi;
    inventoryApi;
    pageScrape;
    logger = new common_1.Logger(PublishedListingsEnrichmentService_1.name);
    constructor(tradingApi, browseApi, inventoryApi, pageScrape) {
        this.tradingApi = tradingApi;
        this.browseApi = browseApi;
        this.inventoryApi = inventoryApi;
        this.pageScrape = pageScrape;
    }
    needsEnrichment(input) {
        const imageCount = input.imageUrls?.length ?? 0;
        const hasDescription = Boolean(input.description?.trim());
        const hasSpecifics = aspectCount(input.itemSpecifics) > 0;
        const needsEnglishLocale = (0, ebay_listing_page_scrape_util_js_1.isNonEnglishEbayListingHost)(input.listingUrl);
        return (imageCount <= 1 ||
            !compatibilityChecked(input.compatibility) ||
            !hasDescription ||
            !hasSpecifics ||
            needsEnglishLocale);
    }
    async enrichListing(input) {
        const sources = [];
        let listingUrl = input.listingUrl?.trim() || null;
        const englishListingUrl = input.ebayItemId?.trim()
            ? `https://www.ebay.com/itm/${input.ebayItemId.trim()}`
            : null;
        const forceEnglish = (0, ebay_listing_page_scrape_util_js_1.isNonEnglishEbayListingHost)(listingUrl);
        let title = forceEnglish ? null : input.title?.trim() || null;
        let imageUrls = [...(input.imageUrls ?? [])].map(ebay_listing_images_util_js_1.preferLargeEbayImageUrl);
        let compatibility = input.compatibility ?? null;
        let description = forceEnglish ? null : input.description?.trim() || null;
        let itemSpecifics = { ...(input.itemSpecifics ?? {}) };
        let rawGetItem;
        if (input.sku?.trim() && !compatibilityChecked(compatibility)) {
            try {
                const invCompat = (await this.inventoryApi.getCompatibility(input.storeId, input.sku.trim()));
                if (compatibilityRowCount(invCompat) > 0) {
                    compatibility = invCompat;
                    sources.push('inventory_api');
                }
            }
            catch {
            }
        }
        let needsImages = imageUrls.length <= 1;
        let needsCompat = !compatibilityChecked(compatibility);
        let needsDescription = !description;
        let needsTitle = !title;
        let needsSpecifics = aspectCount(itemSpecifics) === 0;
        if (!forceEnglish &&
            !tradingEnrichDisabled(input.skipTrading) &&
            (needsImages || needsCompat || needsDescription || needsSpecifics)) {
            try {
                const trading = await this.tradingApi.getItemDetails(input.storeId, input.ebayItemId, input.marketplaceId);
                rawGetItem = {
                    imageUrls: trading.imageUrls.map(ebay_listing_images_util_js_1.preferLargeEbayImageUrl),
                    description: trading.description,
                    itemSpecifics: trading.itemSpecifics ?? {},
                    compatibility: trading.compatibility,
                };
                if (needsImages && trading.imageUrls.length > imageUrls.length) {
                    imageUrls = trading.imageUrls.map(ebay_listing_images_util_js_1.preferLargeEbayImageUrl);
                    sources.push('trading_getitem');
                }
                if (needsCompat && trading.compatibility) {
                    compatibility = trading.compatibility;
                    sources.push('trading_getitem');
                }
                if (needsDescription && trading.description?.trim()) {
                    description = trading.description.trim();
                    sources.push('trading_getitem');
                }
                if (needsSpecifics && aspectCount(trading.itemSpecifics) > 0) {
                    itemSpecifics = mergeItemSpecifics(itemSpecifics, trading.itemSpecifics);
                    sources.push('trading_getitem');
                }
            }
            catch (e) {
                this.logger.debug(`Trading GetItem enrich skipped for ${input.ebayItemId}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        needsImages = imageUrls.length <= 1;
        needsCompat = !compatibilityChecked(compatibility);
        needsDescription = !description;
        needsTitle = !title;
        needsSpecifics = aspectCount(itemSpecifics) === 0;
        if (needsImages ||
            needsCompat ||
            needsDescription ||
            needsSpecifics ||
            needsTitle ||
            forceEnglish) {
            try {
                const browse = await this.browseApi.getItemByLegacyId(input.ebayItemId, input.marketplaceId);
                if (needsImages) {
                    const browseImages = extractBrowseImages(browse);
                    if (browseImages.length > imageUrls.length) {
                        imageUrls = browseImages;
                        sources.push('browse_api');
                    }
                }
                if (needsCompat) {
                    const browseCompat = extractBrowseCompatibility(browse);
                    if (browseCompat) {
                        compatibility = browseCompat;
                        sources.push('browse_api');
                    }
                }
                if (needsDescription) {
                    const browseDesc = extractBrowseDescription(browse);
                    if (browseDesc) {
                        description = browseDesc;
                        sources.push('browse_api');
                    }
                }
                if (needsTitle && browse.title?.trim()) {
                    title = browse.title.trim();
                    sources.push('browse_api');
                }
                if (needsSpecifics) {
                    const browseSpecifics = extractBrowseItemSpecifics(browse);
                    if (aspectCount(browseSpecifics) > 0) {
                        itemSpecifics = mergeItemSpecifics(itemSpecifics, browseSpecifics);
                        sources.push('browse_api');
                    }
                }
                if (forceEnglish && englishListingUrl) {
                    listingUrl = englishListingUrl;
                    sources.push('browse_api');
                }
            }
            catch (e) {
                this.logger.debug(`Browse enrich skipped for ${input.ebayItemId}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        needsImages = imageUrls.length <= 1;
        needsCompat = !compatibilityChecked(compatibility);
        needsDescription = !description;
        needsTitle = !title;
        needsSpecifics = aspectCount(itemSpecifics) === 0;
        if (this.pageScrape.isEnabled() &&
            (needsImages ||
                needsCompat ||
                needsDescription ||
                needsSpecifics ||
                needsTitle)) {
            try {
                const scraped = await this.pageScrape.scrapeListingPage({
                    ebayItemId: input.ebayItemId,
                    listingUrl: englishListingUrl ?? input.listingUrl,
                });
                if (scraped) {
                    if (needsImages && scraped.imageUrls.length > imageUrls.length) {
                        imageUrls = scraped.imageUrls.map(ebay_listing_images_util_js_1.preferLargeEbayImageUrl);
                        sources.push('listing_page_scrape');
                    }
                    if (needsCompat && scraped.compatibility) {
                        compatibility = scraped.compatibility;
                        sources.push('listing_page_scrape');
                    }
                    if (needsDescription && scraped.descriptionHtml?.trim()) {
                        description = scraped.descriptionHtml.trim();
                        sources.push('listing_page_scrape');
                    }
                    if (needsTitle && scraped.title?.trim()) {
                        title = scraped.title.trim();
                        sources.push('listing_page_scrape');
                    }
                    if (needsSpecifics && aspectCount(scraped.itemSpecifics) > 0) {
                        itemSpecifics = mergeItemSpecifics(itemSpecifics, scraped.itemSpecifics);
                        sources.push('listing_page_scrape');
                    }
                    if (forceEnglish && englishListingUrl) {
                        listingUrl = englishListingUrl;
                        sources.push('listing_page_scrape');
                    }
                    rawGetItem = {
                        imageUrls: scraped.imageUrls,
                        description: scraped.descriptionHtml,
                        itemSpecifics: scraped.itemSpecifics,
                        compatibility: scraped.compatibility,
                        title: scraped.title,
                    };
                }
            }
            catch (e) {
                this.logger.debug(`Listing page scrape enrich skipped for ${input.ebayItemId}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        if (forceEnglish && englishListingUrl) {
            listingUrl = englishListingUrl;
        }
        const sanitized = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(imageUrls.map(ebay_listing_images_util_js_1.preferLargeEbayImageUrl));
        return {
            title,
            listingUrl,
            imageUrls: sanitized.imageUrls,
            compatibility: compatibilityRowCount(compatibility) > 0
                ? compatibility
                : compatibility === null
                    ? { compatibleProducts: [] }
                    : compatibility,
            description,
            itemSpecifics,
            sources: [...new Set(sources)],
            rawGetItem,
        };
    }
};
exports.PublishedListingsEnrichmentService = PublishedListingsEnrichmentService;
exports.PublishedListingsEnrichmentService = PublishedListingsEnrichmentService = PublishedListingsEnrichmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_trading_api_service_js_1.EbayTradingApiService,
        ebay_browse_api_service_js_1.EbayBrowseApiService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_listing_page_scrape_service_js_1.EbayListingPageScrapeService])
], PublishedListingsEnrichmentService);
//# sourceMappingURL=published-listings-enrichment.service.js.map