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
var OpenAiVisionProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiVisionProvider = void 0;
const common_1 = require("@nestjs/common");
const vision_enrichment_pipeline_js_1 = require("../../common/openai/pipelines/vision-enrichment.pipeline.js");
let OpenAiVisionProvider = OpenAiVisionProvider_1 = class OpenAiVisionProvider {
    visionPipeline;
    name = 'openai_vision';
    logger = new common_1.Logger(OpenAiVisionProvider_1.name);
    constructor(visionPipeline) {
        this.visionPipeline = visionPipeline;
    }
    async analyzeImages(imageUrls, prompt, partContext) {
        try {
            const result = await this.visionPipeline.analyze(imageUrls, partContext ?? {}, prompt);
            return {
                raw: result.raw,
                provider: result.provider,
                model: result.model,
                tokensUsed: result.tokensUsed,
                latencyMs: result.latencyMs,
                estimatedCostUsd: result.estimatedCostUsd,
                validationScore: result.validationScore,
                passedGate: result.passedGate,
                guardFixes: result.guardFixes,
            };
        }
        catch (err) {
            this.logger.error('AI Vision API call failed', err);
            throw err;
        }
    }
    estimateCost(imageCount) {
        return imageCount * 0.0025;
    }
};
exports.OpenAiVisionProvider = OpenAiVisionProvider;
exports.OpenAiVisionProvider = OpenAiVisionProvider = OpenAiVisionProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [vision_enrichment_pipeline_js_1.VisionEnrichmentPipeline])
], OpenAiVisionProvider);
//# sourceMappingURL=openai-vision.provider.js.map