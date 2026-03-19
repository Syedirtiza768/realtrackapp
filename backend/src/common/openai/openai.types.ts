/**
 * Shared OpenAI type definitions used across all modules.
 */

// ──────────────────────────── Request Types ────────────────────────

export interface OpenAiChatRequest {
  /** System prompt / instruction */
  systemPrompt: string;
  /** User prompt / content */
  userPrompt: string;
  /** Images to include (Vision) */
  imageUrls?: string[];
  /** Model override (default from config) */
  model?: string;
  /** Temperature 0-2 (default 0.2) */
  temperature?: number;
  /** Max tokens in response */
  maxTokens?: number;
  /** Whether to request JSON mode */
  jsonMode?: boolean;
  /** Optional metadata for logging */
  metadata?: Record<string, unknown>;
}

export interface OpenAiEmbeddingRequest {
  /** Input text(s) to embed */
  inputs: string[];
  /** Model override (default text-embedding-3-small) */
  model?: string;
}

// ──────────────────────────── Response Types ───────────────────────

export interface OpenAiChatResponse {
  /** Parsed content (string or JSON object) */
  content: unknown;
  /** Raw string content from the model */
  rawContent: string;
  /** Model used */
  model: string;
  /** Finish reason */
  finishReason: string;
  /** Token usage */
  usage: OpenAiUsage;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
}

export interface OpenAiEmbeddingResponse {
  /** Embedding vectors */
  embeddings: number[][];
  /** Model used */
  model: string;
  /** Token usage */
  usage: OpenAiUsage;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
}

export interface OpenAiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ──────────────────────────── Queue Types ──────────────────────────

export type OpenAiJobPriority = 'critical' | 'high' | 'normal' | 'low';

export interface OpenAiQueueJob {
  /** Unique job ID for dedup */
  jobId: string;
  /** The chat request payload */
  request: OpenAiChatRequest;
  /** Priority level */
  priority: OpenAiJobPriority;
  /** Callback event name (EventEmitter2) */
  callbackEvent?: string;
  /** Maximum retries */
  maxRetries?: number;
  /** Caller context for logging */
  callerContext?: string;
}

export interface OpenAiQueueResult {
  jobId: string;
  success: boolean;
  response?: OpenAiChatResponse;
  error?: string;
  retryCount: number;
}

// ──────────────────────────── Prompt Template Types ────────────────

export interface PromptTemplate {
  /** Template name/key */
  name: string;
  /** System prompt with {{variable}} placeholders */
  systemPrompt: string;
  /** User prompt with {{variable}} placeholders */
  userPrompt: string;
  /** Whether this prompt requires JSON mode */
  jsonMode: boolean;
  /** Recommended temperature */
  temperature: number;
  /** Recommended max tokens */
  maxTokens: number;
}

// ──────────────────────────── Cost Estimation ──────────────────────

/**
 * GPT-4o pricing (as of 2024):
 *  Input: $2.50 / 1M tokens
 *  Output: $10.00 / 1M tokens
 *
 * GPT-4o-mini pricing:
 *  Input: $0.15 / 1M tokens
 *  Output: $0.60 / 1M tokens
 */
export const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
};

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = OPENAI_PRICING[model] ?? OPENAI_PRICING['gpt-4o'];
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}
