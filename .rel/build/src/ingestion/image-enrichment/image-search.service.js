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
var ImageSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageSearchService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
let ImageSearchService = ImageSearchService_1 = class ImageSearchService {
    config;
    logger = new common_1.Logger(ImageSearchService_1.name);
    bingKey;
    bingEndpoint;
    googleKey;
    googleCx;
    constructor(config) {
        this.config = config;
        this.bingKey = this.config.get('BING_IMAGE_SEARCH_KEY', '');
        this.bingEndpoint = this.config.get('BING_IMAGE_SEARCH_ENDPOINT', 'https://api.bing.microsoft.com/v7.0/images/search');
        this.googleKey = this.config.get('GOOGLE_CUSTOM_SEARCH_KEY', '');
        this.googleCx = this.config.get('GOOGLE_CUSTOM_SEARCH_CX', '');
    }
    async search(queries, options = {}) {
        const maxPerQuery = options.maxPerQuery ?? 8;
        const allResults = [];
        for (const query of queries) {
            try {
                let results = [];
                if (this.bingKey) {
                    results = await this.searchBing(query, maxPerQuery);
                }
                else if (this.googleKey && this.googleCx) {
                    results = await this.searchGoogle(query, maxPerQuery);
                }
                const oemResults = this.generateOemCatalogUrls(query);
                results.push(...oemResults);
                allResults.push(...results);
            }
            catch (err) {
                this.logger.warn(`Image search failed for query "${query}": ${err}`);
            }
        }
        const seen = new Set();
        return allResults.filter((r) => {
            if (seen.has(r.url))
                return false;
            seen.add(r.url);
            return true;
        });
    }
    async searchBing(query, count) {
        try {
            const response = await axios_1.default.get(this.bingEndpoint, {
                headers: { 'Ocp-Apim-Subscription-Key': this.bingKey },
                params: {
                    q: query,
                    count,
                    imageType: 'Photo',
                    size: 'Large',
                    aspect: 'Square',
                    safeSearch: 'Strict',
                    minWidth: 500,
                    minHeight: 500,
                },
                timeout: 10_000,
            });
            const values = response.data?.value ?? [];
            return values.map((img) => ({
                url: String(img.contentUrl ?? ''),
                thumbnailUrl: String(img.thumbnailUrl ?? ''),
                title: String(img.name ?? ''),
                source: 'bing_image_search',
                hostPage: String(img.hostPageUrl ?? ''),
                width: Number(img.width ?? 0),
                height: Number(img.height ?? 0),
                format: this.inferFormat(String(img.encodingFormat ?? img.contentUrl ?? '')),
            }));
        }
        catch (err) {
            this.logger.warn(`Bing image search error: ${err}`);
            return [];
        }
    }
    async searchGoogle(query, count) {
        try {
            const response = await axios_1.default.get('https://www.googleapis.com/customsearch/v1', {
                params: {
                    key: this.googleKey,
                    cx: this.googleCx,
                    q: query,
                    searchType: 'image',
                    num: Math.min(count, 10),
                    imgSize: 'xlarge',
                    safe: 'active',
                },
                timeout: 10_000,
            });
            const items = response.data?.items ?? [];
            return items.map((item) => {
                const image = (item.image ?? {});
                return {
                    url: String(item.link ?? ''),
                    thumbnailUrl: String(image.thumbnailLink ?? ''),
                    title: String(item.title ?? ''),
                    source: 'google_custom_search',
                    hostPage: String(image.contextLink ?? ''),
                    width: Number(image.width ?? 0),
                    height: Number(image.height ?? 0),
                    format: this.inferFormat(String(item.link ?? '')),
                };
            });
        }
        catch (err) {
            this.logger.warn(`Google image search error: ${err}`);
            return [];
        }
    }
    generateOemCatalogUrls(query) {
        const tokens = query.toLowerCase().split(/\s+/);
        const results = [];
        const brandPatterns = {
            dorman: 'https://www.dormanproducts.com/p-{pn}',
            moog: 'https://www.moogparts.com/parts/{pn}',
            acdelco: 'https://www.acdelco.com/parts/{pn}',
            bosch: 'https://www.boschautoparts.com/en/auto/{pn}',
            denso: 'https://www.densoautoparts.com/products/{pn}',
            ngk: 'https://www.ngksparkplugs.com/en/product-detail/{pn}',
            gates: 'https://www.gates.com/us/en/search/{pn}',
            motorcraft: 'https://parts.ford.com/shop/en/us/{pn}',
        };
        for (const [brand, pattern] of Object.entries(brandPatterns)) {
            if (tokens.some((t) => t.includes(brand))) {
                const pnToken = tokens.find((t) => /^[a-z0-9]{3,}[-]?[a-z0-9]+$/i.test(t));
                if (pnToken) {
                    results.push({
                        url: pattern.replace('{pn}', pnToken.toUpperCase()),
                        thumbnailUrl: '',
                        title: `OEM ${brand} ${pnToken}`,
                        source: `oem_${brand}`,
                        hostPage: pattern.replace('{pn}', pnToken.toUpperCase()),
                        width: 1200,
                        height: 1200,
                        format: 'jpg',
                    });
                }
            }
        }
        return results;
    }
    inferFormat(urlOrType) {
        const lower = urlOrType.toLowerCase();
        if (lower.includes('png'))
            return 'png';
        if (lower.includes('webp'))
            return 'webp';
        if (lower.includes('gif'))
            return 'gif';
        return 'jpg';
    }
};
exports.ImageSearchService = ImageSearchService;
exports.ImageSearchService = ImageSearchService = ImageSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ImageSearchService);
//# sourceMappingURL=image-search.service.js.map