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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const openai_vision_provider_js_1 = require("./openai-vision.provider.js");
let AiService = AiService_1 = class AiService {
    openaiProvider;
    logger = new common_1.Logger(AiService_1.name);
    providers;
    constructor(openaiProvider) {
        this.openaiProvider = openaiProvider;
        this.providers = new Map();
        this.providers.set('openai', openaiProvider);
    }
    getProvider(name) {
        const key = name ?? 'openai';
        const provider = this.providers.get(key);
        if (!provider) {
            this.logger.warn(`Unknown provider "${key}", falling back to openai`);
            return this.openaiProvider;
        }
        return provider;
    }
    async analyzeImages(imageUrls, preferredProvider, partContext) {
        const provider = this.getProvider(preferredProvider);
        this.logger.log(`Analyzing ${imageUrls.length} image(s) with provider=${provider.name}`);
        try {
            return await provider.analyzeImages(imageUrls, '', partContext);
        }
        catch (err) {
            if (preferredProvider === 'openai' && this.providers.has('google')) {
                this.logger.warn('Primary provider failed, trying fallback (google)');
                const fallback = this.providers.get('google');
                return fallback.analyzeImages(imageUrls, '');
            }
            throw err;
        }
    }
    normalizeResponse(response) {
        const raw = response.raw;
        const conf = (raw['confidence'] ?? {});
        return {
            title: this.str(raw['title']),
            brand: this.str(raw['brand']),
            mpn: this.str(raw['mpn']),
            oemNumber: this.str(raw['oemNumber']),
            partType: this.str(raw['partType']),
            condition: this.str(raw['condition']),
            priceEstimate: this.num(raw['priceEstimate']),
            description: this.str(raw['description']),
            features: Array.isArray(raw['features'])
                ? raw['features'].filter((f) => typeof f === 'string')
                : [],
            fitmentRaw: raw['fitment'] && typeof raw['fitment'] === 'object'
                ? raw['fitment']
                : null,
            confidenceTitle: this.clamp(conf['title']),
            confidenceBrand: this.clamp(conf['brand']),
            confidenceMpn: this.clamp(conf['mpn']),
            confidencePartType: this.clamp(conf['partType']),
            confidenceOverall: this.clamp(conf['overall']),
        };
    }
    str(val) {
        return typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
    }
    num(val) {
        const n = Number(val);
        return isNaN(n) ? null : n;
    }
    clamp(val) {
        const n = Number(val);
        if (isNaN(n))
            return 0;
        return Math.max(0, Math.min(1, n));
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_vision_provider_js_1.OpenAiVisionProvider])
], AiService);
//# sourceMappingURL=ai.service.js.map