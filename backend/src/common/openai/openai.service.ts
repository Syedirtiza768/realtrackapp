import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  OpenAiChatRequest,
  OpenAiChatResponse,
  OpenAiEmbeddingRequest,
  OpenAiEmbeddingResponse,
} from './openai.types.js';
import { estimateCost } from './openai.types.js';

/**
 * OpenAiService — Central AI client (OpenRouter-compatible) with rate-limit awareness.
 *
 * Provides:
 *  - Chat completions (text + vision via MiniMax M3)
 *  - Embeddings (currently unused)
 *  - Automatic retry with exponential backoff on rate limits
 *  - Cost tracking per call
 *  - Configurable model selection
 *
 * All AI interactions across the app should go through this service,
 * NOT through the `openai` package directly.
 */
@Injectable()
export class OpenAiService implements OnModuleInit {
  private readonly logger = new Logger(OpenAiService.name);
  private client!: OpenAI;

  /** Default models (overridable per-call) */
  private chatModel: string;
  private embeddingModel: string;

  /** Rate-limit tracking */
  private rateLimitRemainingRequests = Infinity;
  private rateLimitRemainingTokens = Infinity;
  private rateLimitResetMs = 0;

  /** Cumulative cost tracker (resets on app restart) */
  private sessionCostUsd = 0;

  constructor(private readonly config: ConfigService) {
    this.chatModel = this.config.get<string>('OPENAI_CHAT_MODEL', 'minimax/minimax-m3');
    this.embeddingModel = this.config.get<string>(
      'OPENAI_EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
  }

  onModuleInit() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '');
    const baseURL = this.config.get<string>('OPENAI_BASE_URL', 'https://openrouter.ai/api/v1');
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set — AI calls will fail. Set the env var to enable AI features.',
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL,
      maxRetries: 0,
      timeout: 60_000,
      defaultHeaders: {
        'HTTP-Referer': 'https://realtrackapp.com',
        'X-Title': 'RealTrackApp',
      },
    });
    this.logger.log(
      `AI client initialized (baseURL=${baseURL}, chat=${this.chatModel}, embed=${this.embeddingModel})`,
    );
  }

  // ──────────────────────────── Chat Completions ──────────────────

  /**
   * Execute a chat completion request.
   * Supports text-only and vision (with imageUrls).
   */
  async chat(req: OpenAiChatRequest): Promise<OpenAiChatResponse> {
    const model = req.model ?? this.chatModel;
    const temperature = req.temperature ?? 0.2;
    const startMs = Date.now();

    // Build messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: req.systemPrompt },
    ];

    // Build user content (text + optional images)
    if (req.imageUrls?.length) {
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        { type: 'text', text: req.userPrompt },
        ...req.imageUrls.map(
          (url) =>
            ({
              type: 'image_url' as const,
              image_url: { url, detail: 'high' as const },
            }),
        ),
      ];
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: req.userPrompt });
    }

    const response = await this.callWithRetry(() =>
      this.client.chat.completions.create({
        model,
        messages,
        temperature,
        ...(typeof req.maxTokens === 'number' ? { max_tokens: req.maxTokens } : {}),
        ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    );

    const latencyMs = Date.now() - startMs;
    const rawContent = response.choices[0]?.message?.content ?? '';
    const usage = response.usage;

    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const cost = estimateCost(model, promptTokens, completionTokens);
    this.sessionCostUsd += cost;

    // Parse content
    let content: unknown = rawContent;
    if (req.jsonMode) {
      try {
        content = JSON.parse(rawContent);
      } catch {
        this.logger.warn('Failed to parse JSON response from AI model');
      }
    }

    return {
      content,
      rawContent,
      model,
      finishReason: response.choices[0]?.finish_reason ?? 'unknown',
      usage: { promptTokens, completionTokens, totalTokens },
      latencyMs,
      estimatedCostUsd: cost,
    };
  }

  // ──────────────────────────── Embeddings ─────────────────────────

  /**
   * Generate embeddings for one or more text inputs.
   * NOTE: MiniMax M3 does not support embeddings. This endpoint will
   * only work if OPENAI_EMBEDDING_MODEL points to a compatible provider.
   */
  async embed(req: OpenAiEmbeddingRequest): Promise<OpenAiEmbeddingResponse> {
    const model = req.model ?? this.embeddingModel;

    const response = await this.callWithRetry(() =>
      this.client.embeddings.create({
        model,
        input: req.inputs,
      }),
    );

    const totalTokens = response.usage?.total_tokens ?? 0;
    const cost = estimateCost(model, totalTokens, 0);
    this.sessionCostUsd += cost;

    return {
      embeddings: response.data.map((d) => d.embedding),
      model,
      usage: { promptTokens: totalTokens, completionTokens: 0, totalTokens },
      estimatedCostUsd: cost,
    };
  }

  // ──────────────────────────── Cost Tracking ──────────────────────

  /**
   * Get the cumulative cost for this session.
   */
  getSessionCost(): number {
    return Math.round(this.sessionCostUsd * 10000) / 10000;
  }

  /**
   * Get current rate-limit status.
   */
  getRateLimitStatus() {
    return {
      remainingRequests: this.rateLimitRemainingRequests,
      remainingTokens: this.rateLimitRemainingTokens,
      resetMs: this.rateLimitResetMs,
    };
  }

  // ──────────────────────────── Retry Logic ────────────────────────

  /**
   * Retry wrapper with exponential backoff for rate limit (429) errors.
   * Max 3 retries with 1s, 4s, 16s delays.
   */
  private async callWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    const maxRetries = 3;
    try {
      const result = await fn();

      this.rateLimitRemainingRequests = Infinity;
      this.rateLimitResetMs = 0;

      return result;
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const isRateLimit = status === 429;
      const isServerError = status >= 500 && status < 600;

      if ((isRateLimit || isServerError) && attempt < maxRetries) {
        const delayMs = Math.pow(4, attempt) * 1000; // 1s, 4s, 16s
        this.logger.warn(
          `AI ${isRateLimit ? 'rate-limited' : 'server error'} (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms`,
        );

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
