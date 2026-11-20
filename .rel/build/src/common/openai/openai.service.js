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
var OpenAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
const openai_types_js_1 = require("./openai.types.js");
let OpenAiService = OpenAiService_1 = class OpenAiService {
    config;
    logger = new common_1.Logger(OpenAiService_1.name);
    client;
    baseURL;
    chatModel;
    embeddingModel;
    visionDetail;
    rateLimitRemainingRequests = Infinity;
    rateLimitRemainingTokens = Infinity;
    rateLimitResetMs = 0;
    sessionCostUsd = 0;
    sessionCostByLane = new Map();
    constructor(config) {
        this.config = config;
        this.chatModel =
            this.config.get('OPENAI_MODEL_DEFAULT') ||
                this.config.get('OPENAI_CHAT_MODEL', 'openai/gpt-4.1-mini');
        this.embeddingModel = this.config.get('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small');
        const detail = this.config.get('OPENAI_VISION_DETAIL', 'auto');
        this.visionDetail = detail === 'low' || detail === 'high' ? detail : 'auto';
        const apiKey = this.config.get('OPENAI_API_KEY', '');
        const baseURL = this.config.get('OPENAI_BASE_URL', 'https://openrouter.ai/api/v1');
        this.client = new openai_1.default({
            apiKey,
            baseURL,
            maxRetries: 0,
            timeout: Number(this.config.get('OPENAI_TIMEOUT_MS', '120000')),
            defaultHeaders: {
                'HTTP-Referer': 'https://app.omnicoreholding.com',
                'X-Title': 'Omni Core',
            },
        });
        this.baseURL = baseURL;
    }
    onModuleInit() {
        const apiKey = this.config.get('OPENAI_API_KEY', '');
        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY not set — AI calls will fail. Set the env var to enable AI features.');
        }
        this.logger.log(`AI client initialized (baseURL=${this.baseURL}, chat=${this.chatModel}, embed=${this.embeddingModel})`);
    }
    async chat(req) {
        const model = req.model ?? this.chatModel;
        const temperature = req.temperature ?? 0.2;
        const startMs = Date.now();
        const messages = [
            { role: 'system', content: req.systemPrompt },
        ];
        if (req.imageUrls?.length) {
            const content = [
                { type: 'text', text: req.userPrompt },
                ...req.imageUrls.map((url) => ({
                    type: 'image_url',
                    image_url: {
                        url,
                        detail: req.imageDetail ?? this.visionDetail,
                    },
                })),
            ];
            messages.push({ role: 'user', content });
        }
        else {
            messages.push({ role: 'user', content: req.userPrompt });
        }
        const request = {
            model,
            messages,
            temperature,
            max_tokens: typeof req.maxTokens === 'number' &&
                Number.isFinite(req.maxTokens) && req.maxTokens > 0
                ? Math.floor(req.maxTokens)
                : 4096,
            ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
            ...(req.webSearch
                ? {
                    tools: [
                        {
                            type: 'openrouter:web_search',
                            parameters: {
                                engine: req.webSearchOptions?.engine ?? 'exa',
                                max_results: req.webSearchOptions?.maxResults ?? 5,
                                max_uses: req.webSearchOptions?.maxUses ?? 2,
                                max_total_results: req.webSearchOptions?.maxTotalResults ?? 10,
                                search_context_size: req.webSearchOptions?.searchContextSize ?? 'medium',
                                ...(req.webSearchOptions?.allowedDomains?.length
                                    ? {
                                        allowed_domains: req.webSearchOptions.allowedDomains,
                                    }
                                    : {}),
                            },
                        },
                    ],
                }
                : {}),
            ...(req.reasoningEffort
                ? { reasoning_effort: req.reasoningEffort }
                : {}),
        };
        const response = await this.callWithRetry(() => this.client.chat.completions.create(request));
        const latencyMs = Date.now() - startMs;
        const choice = response.choices?.[0];
        if (!choice) {
            const upstreamError = response
                ?.error?.message;
            throw new Error(`AI response missing choices (possible upstream refusal/error): ${upstreamError ?? 'empty choices array'}`);
        }
        const rawContent = choice.message?.content ?? '';
        const usage = response.usage;
        const promptTokens = usage?.prompt_tokens ?? 0;
        const completionTokens = usage?.completion_tokens ?? 0;
        const totalTokens = promptTokens + completionTokens;
        const webSearchRequests = Number(usage?.server_tool_use?.web_search_requests ?? 0);
        const citations = req.webSearch
            ? this.extractWebCitations(choice.message)
            : [];
        const cost = (0, openai_types_js_1.estimateCost)(model, promptTokens, completionTokens) +
            webSearchRequests * 0.007;
        this.sessionCostUsd += cost;
        const laneKey = req.costLane ?? model;
        this.sessionCostByLane.set(laneKey, (this.sessionCostByLane.get(laneKey) ?? 0) + cost);
        let content = rawContent;
        if (req.jsonMode) {
            try {
                content = JSON.parse(rawContent);
            }
            catch {
                this.logger.warn('Failed to parse JSON response from AI model');
            }
        }
        return {
            content,
            rawContent,
            model,
            finishReason: choice.finish_reason ?? 'unknown',
            usage: { promptTokens, completionTokens, totalTokens },
            latencyMs,
            estimatedCostUsd: cost,
            ...(citations.length > 0 ? { citations } : {}),
            ...(req.webSearch ? { webSearchRequests } : {}),
        };
    }
    extractWebCitations(message) {
        if (!message || typeof message !== 'object')
            return [];
        const metadata = message;
        const entries = [
            ...(Array.isArray(metadata.annotations) ? metadata.annotations : []),
            ...(Array.isArray(metadata.citations) ? metadata.citations : []),
        ];
        const citations = new Map();
        for (const entry of entries) {
            const raw = entry['url_citation'] && typeof entry['url_citation'] === 'object'
                ? entry['url_citation']
                : entry;
            const url = typeof raw['url'] === 'string' ? raw['url'].trim() : '';
            if (!/^https?:\/\//i.test(url))
                continue;
            citations.set(url, {
                url,
                ...(typeof raw['title'] === 'string' ? { title: raw['title'] } : {}),
                ...(typeof raw['content'] === 'string'
                    ? { content: raw['content'] }
                    : {}),
            });
        }
        return [...citations.values()];
    }
    async embed(req) {
        const model = req.model ?? this.embeddingModel;
        const response = await this.callWithRetry(() => this.client.embeddings.create({
            model,
            input: req.inputs,
        }));
        const totalTokens = response.usage?.total_tokens ?? 0;
        const cost = (0, openai_types_js_1.estimateCost)(model, totalTokens, 0);
        this.sessionCostUsd += cost;
        return {
            embeddings: response.data.map((d) => d.embedding),
            model,
            usage: { promptTokens: totalTokens, completionTokens: 0, totalTokens },
            estimatedCostUsd: cost,
        };
    }
    getSessionCost() {
        return Math.round(this.sessionCostUsd * 10000) / 10000;
    }
    getSessionCostByLane() {
        const out = {};
        for (const [lane, cost] of this.sessionCostByLane) {
            out[lane] = Math.round(cost * 10000) / 10000;
        }
        return out;
    }
    getRateLimitStatus() {
        return {
            remainingRequests: this.rateLimitRemainingRequests,
            remainingTokens: this.rateLimitRemainingTokens,
            resetMs: this.rateLimitResetMs,
        };
    }
    async callWithRetry(fn, attempt = 0) {
        const maxRetries = 3;
        try {
            const result = await fn();
            this.rateLimitRemainingRequests = Infinity;
            this.rateLimitResetMs = 0;
            return result;
        }
        catch (err) {
            const status = err?.status ?? err?.response?.status;
            const isRateLimit = status === 429;
            const isServerError = status >= 500 && status < 600;
            if ((isRateLimit || isServerError) && attempt < maxRetries) {
                const delayMs = Math.pow(4, attempt) * 1000;
                this.logger.warn(`AI ${isRateLimit ? 'rate-limited' : 'server error'} (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms`);
                if (isRateLimit) {
                    this.rateLimitRemainingRequests = 0;
                    this.rateLimitResetMs = Date.now() + delayMs;
                }
                await this.sleep(delayMs);
                return this.callWithRetry(fn, attempt + 1);
            }
            throw err;
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = OpenAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiService);
//# sourceMappingURL=openai.service.js.map