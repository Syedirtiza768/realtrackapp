"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ImageEnrichmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageEnrichmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const pipeline_job_entity_js_1 = require("../entities/pipeline-job.entity.js");
const openai_service_js_1 = require("../../common/openai/openai.service.js");
const model_router_js_1 = require("../../common/openai/model-router.js");
const ai_run_log_service_js_1 = require("../../common/openai/ai-run-log.service.js");
const image_search_service_js_1 = require("./image-search.service.js");
const image_optimizer_service_js_1 = require("./image-optimizer.service.js");
const imageCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const imageHashSet = new Set();
let ImageEnrichmentService = ImageEnrichmentService_1 = class ImageEnrichmentService {
    jobRepo;
    openai;
    modelRouter;
    runLogService;
    config;
    imageSearch;
    imageOptimizer;
    logger = new common_1.Logger(ImageEnrichmentService_1.name);
    promptVersion;
    constructor(jobRepo, openai, modelRouter, runLogService, config, imageSearch, imageOptimizer) {
        this.jobRepo = jobRepo;
        this.openai = openai;
        this.modelRouter = modelRouter;
        this.runLogService = runLogService;
        this.config = config;
        this.imageSearch = imageSearch;
        this.imageOptimizer = imageOptimizer;
        this.promptVersion = this.config.get('AI_PROMPT_VERSION', 'enrichment-v1');
    }
    async enrichBatch(parts, jobId, options = {}) {
        const downloadImages = options.downloadImages ?? false;
        const CONCURRENCY = 8;
        const progress = {
            totalParts: parts.length,
            processedParts: 0,
            enrichedParts: 0,
            skippedParts: 0,
            failedParts: 0,
            totalImagesFound: 0,
            totalImagesDownloaded: 0,
            cacheHits: 0,
            openaiTokensUsed: 0,
        };
        const results = new Array(parts.length);
        for (let i = 0; i < parts.length; i += CONCURRENCY) {
            const chunk = parts.slice(i, i + CONCURRENCY);
            const chunkResults = await Promise.all(chunk.map(async (part) => {
                try {
                    const cacheKey = this.buildCacheKey(part.partNumber, part.title);
                    const cached = imageCache.get(cacheKey);
                    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
                        progress.cacheHits++;
                        progress.processedParts++;
                        if (cached.result.primaryImage)
                            progress.enrichedParts++;
                        return cached.result;
                    }
                    if (part.existingImages && part.existingImages.length >= 3) {
                        progress.skippedParts++;
                        progress.processedParts++;
                        return {
                            partNumber: part.partNumber,
                            title: part.title,
                            primaryImage: null,
                            galleryImages: [],
                            diagramImages: [],
                            confidenceScore: 1.0,
                            searchQueries: [],
                            sourceAttribution: [],
                            skipped: true,
                            skipReason: 'Part already has sufficient images',
                        };
                    }
                    const result = await this.enrichSinglePart(part, progress, downloadImages);
                    imageCache.set(cacheKey, { result, cachedAt: Date.now() });
                    if (result.primaryImage) {
                        progress.enrichedParts++;
                        progress.totalImagesFound += 1 + result.galleryImages.length;
                    }
                    progress.processedParts++;
                    return result;
                }
                catch (err) {
                    this.logger.warn(`Failed to enrich images for part ${part.partNumber}: ${err}`);
                    progress.failedParts++;
                    progress.processedParts++;
                    return {
                        partNumber: part.partNumber,
                        title: part.title,
                        primaryImage: null,
                        galleryImages: [],
                        diagramImages: [],
                        confidenceScore: 0,
                        searchQueries: [],
                        sourceAttribution: [],
                        skipped: false,
                    };
                }
            }));
            for (let j = 0; j < chunkResults.length; j++) {
                results[i + j] = chunkResults[j];
            }
            if (jobId) {
                await this.updateJobProgress(jobId, progress);
            }
        }
        return { results, progress };
    }
    async enrichSinglePart(part, progress, downloadImages = false) {
        const queries = this.buildSearchQueries(part);
        const candidates = await this.searchImages(queries, part, {
            skipWebSearch: !downloadImages,
        });
        const validated = await this.validateAndRankImages(candidates, part, progress);
        const deduped = this.deduplicateImages(validated);
        let finalCandidates;
        if (downloadImages) {
            finalCandidates = await this.downloadAndOptimizeCandidates(deduped.slice(0, 8), progress);
        }
        else {
            finalCandidates = deduped.slice(0, 6);
        }
        const primary = finalCandidates.length > 0 ? finalCandidates[0] : null;
        const gallery = finalCandidates.slice(1, 6);
        const confidenceScore = primary
            ? Math.round((primary.relevanceScore * 0.6 + primary.qualityScore * 0.4) * 100) / 100
            : 0;
        const diagrams = finalCandidates.filter((c) => c.source?.toLowerCase().includes('diagram') ||
            c.source?.toLowerCase().includes('schematic'));
        const nonDiagrams = finalCandidates.filter((c) => !c.source?.toLowerCase().includes('diagram') &&
            !c.source?.toLowerCase().includes('schematic'));
        const primaryImg = nonDiagrams.length > 0 ? nonDiagrams[0] : primary;
        const galleryImgs = nonDiagrams.length > 1 ? nonDiagrams.slice(1, 6) : gallery;
        const allCandidates = deduped;
        const accessibleCount = allCandidates.filter((c) => c.accessible ?? true).length;
        const meetsRes = allCandidates.filter((c) => c.width >= 1000 && c.height >= 1000).length;
        const compliantCount = allCandidates.filter((c) => !c.hasWatermark && c.qualityScore >= 0.6).length;
        const rejectedCount = allCandidates.length - finalCandidates.length;
        const validationIssues = [];
        if (meetsRes === 0 && allCandidates.length > 0)
            validationIssues.push('No images meet 1000px minimum resolution');
        if (accessibleCount < allCandidates.length)
            validationIssues.push(`${allCandidates.length - accessibleCount} image URLs inaccessible`);
        return {
            partNumber: part.partNumber,
            title: part.title,
            primaryImage: primaryImg,
            galleryImages: galleryImgs,
            diagramImages: diagrams.slice(0, 3),
            confidenceScore,
            searchQueries: queries,
            sourceAttribution: finalCandidates.map((img) => ({
                url: img.url,
                source: img.source,
                localPath: img.localPath,
            })),
            skipped: false,
            validation: {
                totalCandidates: allCandidates.length,
                accessible: accessibleCount,
                meetsResolution: meetsRes,
                compliant: compliantCount,
                rejected: rejectedCount,
                issues: validationIssues,
            },
        };
    }
    async downloadAndOptimizeCandidates(candidates, progress) {
        const results = [];
        for (const candidate of candidates) {
            if (!candidate.url.startsWith('http://') &&
                !candidate.url.startsWith('https://')) {
                results.push(candidate);
                continue;
            }
            try {
                const optimized = await this.imageOptimizer.downloadAndOptimize(candidate.url, {
                    targetFormat: 'webp',
                    maxWidth: 1600,
                    quality: 82,
                });
                if (!optimized)
                    continue;
                const existingHashes = new Set(results.map((r) => r.hash));
                if (existingHashes.has(optimized.hash))
                    continue;
                progress.totalImagesDownloaded++;
                results.push({
                    ...candidate,
                    localPath: optimized.localPath,
                    width: optimized.width,
                    height: optimized.height,
                    format: optimized.format,
                    fileSizeBytes: optimized.fileSizeBytes,
                    hash: optimized.hash,
                    optimized: true,
                });
            }
            catch (err) {
                this.logger.debug(`Failed to download/optimize ${candidate.url}: ${err}`);
            }
        }
        return results;
    }
    buildSearchQueries(part) {
        const queries = [];
        if (part.brand && part.mpn) {
            queries.push(`${part.brand} ${part.mpn} auto part`);
        }
        if (part.partNumber) {
            queries.push(`${part.partNumber} OEM auto part image`);
        }
        const cleanTitle = part.title
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
        queries.push(`${cleanTitle} product photo`);
        if (part.brand && part.fitment) {
            queries.push(`${part.brand} ${part.fitment} replacement part`);
        }
        return queries;
    }
    async searchImages(queries, part, opts = {}) {
        const candidates = [];
        if (!opts.skipWebSearch)
            try {
                const webResults = await this.imageSearch.search(queries, {
                    maxPerQuery: 6,
                    minWidth: 500,
                });
                for (const result of webResults) {
                    if (result.url && result.width >= 300) {
                        const hash = crypto
                            .createHash('md5')
                            .update(result.url)
                            .digest('hex');
                        candidates.push({
                            url: result.url,
                            source: result.source,
                            width: result.width,
                            height: result.height,
                            format: result.format,
                            relevanceScore: 0.7,
                            qualityScore: 0.7,
                            hasWatermark: false,
                            hash,
                        });
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Web image search failed for ${part.partNumber}: ${err}`);
            }
        try {
            const response = await this.routedImageChat(part, `You are an automotive parts image specialist. Given an auto part, suggest realistic image URLs from well-known OEM and aftermarket databases. Return a JSON array of objects with: url, source, estimatedWidth, estimatedHeight, format.

Rules:
- Only suggest URLs from real, reputable automotive parts databases
- Prefer high-resolution product photos (1000px+)
- Avoid watermarked stock photos
- Include manufacturer catalog images when possible
- Format: return ONLY valid JSON array, no markdown`, `Find product images for this auto part:
Part Number: ${part.partNumber}
Title: ${part.title}
Brand: ${part.brand || 'Unknown'}
Search queries: ${queries.join(' | ')}

Return up to 6 candidate image URLs as JSON array.`, 'image_suggestion', { maxTokens: 800, temperature: 0.3 });
            try {
                const text = response.content
                    .replace(/```json?\n?/g, '')
                    .replace(/```/g, '')
                    .trim();
                const suggestions = JSON.parse(text);
                for (const s of suggestions) {
                    if (s.url && typeof s.url === 'string') {
                        const hash = crypto.createHash('md5').update(s.url).digest('hex');
                        candidates.push({
                            url: s.url,
                            source: s.source || 'ai_suggested',
                            width: s.estimatedWidth || 1200,
                            height: s.estimatedHeight || 1200,
                            format: s.format || 'jpg',
                            relevanceScore: 0.7,
                            qualityScore: 0.7,
                            hasWatermark: false,
                            hash,
                        });
                    }
                }
            }
            catch {
                this.logger.debug(`Could not parse AI image suggestions for ${part.partNumber}`);
            }
        }
        catch (err) {
            this.logger.warn(`AI image suggestion failed for ${part.partNumber}: ${err}`);
        }
        const placeholderSources = this.generateStructuredImageUrls(part);
        candidates.push(...placeholderSources);
        return candidates;
    }
    generateStructuredImageUrls(part) {
        const sanitizedPN = (part.partNumber || '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase();
        const brand = (part.brand || 'generic').toLowerCase().replace(/\s+/g, '-');
        if (!sanitizedPN)
            return [];
        const candidates = [];
        candidates.push({
            url: `/api/pipeline/images/catalog/${brand}/${sanitizedPN}_main.webp`,
            source: 'oem_catalog',
            width: 1200,
            height: 1200,
            format: 'webp',
            relevanceScore: 0.9,
            qualityScore: 0.95,
            hasWatermark: false,
            hash: crypto
                .createHash('md5')
                .update(`oem_${brand}_${sanitizedPN}_main`)
                .digest('hex'),
        });
        for (const angle of ['front', 'side', 'back']) {
            candidates.push({
                url: `/api/pipeline/images/catalog/${brand}/${sanitizedPN}_${angle}.webp`,
                source: 'oem_catalog',
                width: 1200,
                height: 1200,
                format: 'webp',
                relevanceScore: 0.85,
                qualityScore: 0.9,
                hasWatermark: false,
                hash: crypto
                    .createHash('md5')
                    .update(`oem_${brand}_${sanitizedPN}_${angle}`)
                    .digest('hex'),
            });
        }
        return candidates;
    }
    async validateAndRankImages(candidates, part, progress) {
        if (candidates.length === 0)
            return [];
        try {
            const response = await this.routedImageChat(part, `You are an image quality assessor for automotive parts listings. Score each image candidate on relevance (how well it matches the part) and quality (resolution, clarity, professional presentation). Return JSON array with: index, relevanceScore (0-1), qualityScore (0-1), hasWatermark (boolean), rejected (boolean), rejectReason.

Scoring criteria:
- relevanceScore 0.9+: Exact part match with correct brand/number
- relevanceScore 0.7-0.9: Same part type, correct brand
- relevanceScore 0.5-0.7: Similar part, may not be exact match
- relevanceScore <0.5: Reject (wrong part or ambiguous)
- qualityScore 0.9+: High resolution, clean background, professional
- qualityScore 0.7-0.9: Good quality, minor issues
- qualityScore <0.7: Low quality or issues present

Return ONLY valid JSON array.`, `Validate these image candidates for:
Part: ${part.partNumber} - ${part.title} (${part.brand || 'Unknown'})

Candidates:
${candidates.map((c, i) => `[${i}] ${c.url} (source: ${c.source}, ${c.width}x${c.height})`).join('\n')}

Score each candidate.`, 'image_validation', { maxTokens: 600, temperature: 0.1 });
            progress.openaiTokensUsed += response.usage?.totalTokens ?? 0;
            try {
                const text = response.content
                    .replace(/```json?\n?/g, '')
                    .replace(/```/g, '')
                    .trim();
                const scores = JSON.parse(text);
                for (const score of scores) {
                    if (score.index >= 0 && score.index < candidates.length) {
                        candidates[score.index].relevanceScore = Math.max(0, Math.min(1, score.relevanceScore));
                        candidates[score.index].qualityScore = Math.max(0, Math.min(1, score.qualityScore));
                        candidates[score.index].hasWatermark = score.hasWatermark;
                    }
                }
                return candidates
                    .filter((c) => c.relevanceScore >= 0.5 &&
                    !c.hasWatermark &&
                    c.qualityScore >= 0.5)
                    .sort((a, b) => {
                    const scoreA = a.relevanceScore * 0.6 + a.qualityScore * 0.4;
                    const scoreB = b.relevanceScore * 0.6 + b.qualityScore * 0.4;
                    return scoreB - scoreA;
                });
            }
            catch {
                return candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
            }
        }
        catch {
            return candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
        }
    }
    deduplicateImages(candidates) {
        const seen = new Set();
        const result = [];
        for (const candidate of candidates) {
            if (!seen.has(candidate.hash) && !imageHashSet.has(candidate.hash)) {
                seen.add(candidate.hash);
                imageHashSet.add(candidate.hash);
                result.push(candidate);
            }
        }
        if (imageHashSet.size > 50000) {
            imageHashSet.clear();
        }
        return result;
    }
    buildCacheKey(partNumber, title) {
        return `${partNumber}||${title}`.toLowerCase();
    }
    async updateJobProgress(jobId, progress) {
        try {
            await this.jobRepo.update(jobId, {
                stageDetails: {
                    ...(await this.jobRepo.findOneBy({ id: jobId }))?.stageDetails,
                    imageEnrichment: progress,
                },
            });
        }
        catch {
        }
    }
    async getEnrichmentStatus(jobId) {
        const job = await this.jobRepo.findOneBy({ id: jobId });
        if (!job?.stageDetails)
            return null;
        return job.stageDetails.imageEnrichment;
    }
    async validateImageUrls(urls) {
        const CONCURRENCY = 10;
        const results = [];
        for (let i = 0; i < urls.length; i += CONCURRENCY) {
            const chunk = urls.slice(i, i + CONCURRENCY);
            const chunkResults = await Promise.allSettled(chunk.map((url) => this.validateSingleImageUrl(url)));
            for (const r of chunkResults) {
                results.push(r.status === 'fulfilled'
                    ? r.value
                    : {
                        url: chunk[results.length - i] ?? '',
                        accessible: false,
                        issues: ['Request failed'],
                    });
            }
        }
        return results;
    }
    async validateSingleImageUrl(url) {
        const issues = [];
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            return { url, accessible: false, issues: ['Invalid URL scheme'] };
        }
        try {
            const { default: axios } = await import('axios');
            const resp = await axios.head(url, {
                timeout: 8_000,
                maxRedirects: 3,
                headers: { 'User-Agent': 'ListingPro/1.0 ImageValidator' },
                validateStatus: () => true,
            });
            const statusCode = resp.status;
            const contentType = String(resp.headers['content-type'] ?? '');
            const contentLength = parseInt(String(resp.headers['content-length'] ?? '0'), 10) ||
                undefined;
            if (statusCode < 200 || statusCode >= 400) {
                issues.push(`HTTP ${statusCode}`);
                return {
                    url,
                    accessible: false,
                    statusCode,
                    contentType,
                    contentLength,
                    issues,
                };
            }
            if (!contentType.startsWith('image/')) {
                issues.push(`Not an image (${contentType})`);
            }
            if (contentLength && contentLength > 12 * 1024 * 1024) {
                issues.push('Image exceeds 12MB eBay limit');
            }
            const lowerUrl = url.toLowerCase();
            const placeholderHosts = [
                'placeholder.com',
                'placehold.it',
                'via.placeholder',
                'dummyimage.com',
            ];
            if (placeholderHosts.some((h) => lowerUrl.includes(h))) {
                issues.push('Placeholder image detected');
            }
            return {
                url,
                accessible: issues.length === 0,
                statusCode,
                contentType,
                contentLength,
                issues,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
                issues.push('Host unreachable');
            }
            else if (message.includes('timeout')) {
                issues.push('Request timed out');
            }
            else {
                issues.push(`Validation error: ${message.slice(0, 80)}`);
            }
            return { url, accessible: false, issues };
        }
    }
    async routedImageChat(part, systemPrompt, userPrompt, task, options) {
        const route = this.modelRouter.selectTextRoute({
            partNumber: part.partNumber ?? part.mpn,
            partName: part.title,
            partType: task,
        });
        const response = await this.openai.chat({
            systemPrompt,
            userPrompt,
            model: route.model,
            costLane: route.lane,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
        });
        await this.runLogService.logRun({
            sku: null,
            partNumber: part.partNumber ?? part.mpn ?? null,
            partType: task,
            lane: route.lane,
            model: route.model,
            attempt: 1,
            promptVersion: this.promptVersion,
            routingPolicyVersion: route.policyVersion,
            inputTokens: response.usage.promptTokens,
            outputTokens: response.usage.completionTokens,
            costUsd: response.estimatedCostUsd,
            latencyMs: response.latencyMs,
            passedGate: true,
            escalated: false,
        });
        return response;
    }
};
exports.ImageEnrichmentService = ImageEnrichmentService;
exports.ImageEnrichmentService = ImageEnrichmentService = ImageEnrichmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pipeline_job_entity_js_1.PipelineJob)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        openai_service_js_1.OpenAiService,
        model_router_js_1.ModelRouter,
        ai_run_log_service_js_1.AiRunLogService,
        config_1.ConfigService,
        image_search_service_js_1.ImageSearchService,
        image_optimizer_service_js_1.ImageOptimizerService])
], ImageEnrichmentService);
//# sourceMappingURL=image-enrichment.service.js.map