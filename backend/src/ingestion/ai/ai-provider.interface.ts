/**
 * Standard interface for all AI vision providers.
 * Allows swapping between OpenAI, Google Vision, or any future provider.
 */
export interface AiRawResponse {
  /** The raw JSON object returned by the AI provider */
  raw: Record<string, unknown>;
  /** Provider identifier (e.g., 'openai_vision', 'google_vision') */
  provider: string;
  /** Model used (e.g., 'gpt-4o', 'gemini-1.5-pro') */
  model: string;
  /** Tokens consumed */
  tokensUsed: number;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** Estimated cost in USD */
  estimatedCostUsd: number;
}

export interface NormalizedAiFields {
  title: string | null;
  brand: string | null;
  mpn: string | null;
  oemNumber: string | null;
  partType: string | null;
  condition: string | null;
  priceEstimate: number | null;
  description: string | null;
  features: string[];
  fitmentRaw: Record<string, unknown> | null;
  confidenceTitle: number;
  confidenceBrand: number;
  confidenceMpn: number;
  confidencePartType: number;
  confidenceOverall: number;
}

export interface AiVisionProvider {
  readonly name: string;

  /**
   * Analyze one or more images and return structured motor-part data.
   */
  analyzeImages(
    imageUrls: string[],
    prompt: string,
  ): Promise<AiRawResponse>;

  /**
   * Estimate cost for processing N images.
   */
  estimateCost(imageCount: number): number;
}
