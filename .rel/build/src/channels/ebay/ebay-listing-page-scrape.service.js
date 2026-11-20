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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayListingPageScrapeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayListingPageScrapeService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ebay_listing_page_scrape_util_js_1 = require("./ebay-listing-page-scrape.util.js");
let EbayListingPageScrapeService = EbayListingPageScrapeService_1 = class EbayListingPageScrapeService {
    logger = new common_1.Logger(EbayListingPageScrapeService_1.name);
    tokens;
    lastRefill = Date.now();
    maxTokens;
    refillPerMs;
    constructor() {
        const rps = Math.max(0.2, Number(process.env.PUBLISHED_LISTINGS_SCRAPE_RPS ?? '0.5') || 0.5);
        this.maxTokens = rps;
        this.tokens = rps;
        this.refillPerMs = rps / 1000;
    }
    isEnabled() {
        const flag = (process.env.PUBLISHED_LISTINGS_SCRAPE_ENRICH ?? '').toLowerCase();
        return flag === '1' || flag === 'true' || flag === 'yes';
    }
    async acquire() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillPerMs);
        this.lastRefill = now;
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }
        const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs);
        await new Promise((r) => setTimeout(r, waitMs));
        this.tokens = Math.max(0, this.tokens - 1);
    }
    async scrapeListingPage(input) {
        if (!this.isEnabled())
            return null;
        if (!input.ebayItemId?.trim())
            return null;
        const url = (0, ebay_listing_page_scrape_util_js_1.buildPublicEbayItemUrl)(input.ebayItemId, input.listingUrl, {
            preferEnglishSite: true,
        });
        const timeoutMs = Number(process.env.PUBLISHED_LISTINGS_SCRAPE_TIMEOUT_MS ?? '15000') ||
            15_000;
        try {
            await this.acquire();
            const { data, status } = await axios_1.default.get(url, {
                timeout: timeoutMs,
                maxRedirects: 5,
                responseType: 'text',
                headers: {
                    'User-Agent': process.env.PUBLISHED_LISTINGS_SCRAPE_UA ??
                        'Mozilla/5.0 (compatible; OmniCorePublishedListingsBot/1.0; +https://app.omnicoreholding.com)',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                validateStatus: (s) => s >= 200 && s < 400,
            });
            if (status >= 400 || typeof data !== 'string' || data.length < 200) {
                return null;
            }
            if (/captcha|robot check|splashui\/challenge/i.test(data)) {
                this.logger.warn(`eBay scrape challenge page for ${input.ebayItemId}`);
                return null;
            }
            return (0, ebay_listing_page_scrape_util_js_1.parseEbayListingPageHtml)(data);
        }
        catch (e) {
            this.logger.debug(`Listing page scrape failed for ${input.ebayItemId}: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }
};
exports.EbayListingPageScrapeService = EbayListingPageScrapeService;
exports.EbayListingPageScrapeService = EbayListingPageScrapeService = EbayListingPageScrapeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EbayListingPageScrapeService);
//# sourceMappingURL=ebay-listing-page-scrape.service.js.map