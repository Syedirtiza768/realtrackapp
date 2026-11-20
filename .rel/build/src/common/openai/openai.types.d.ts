export interface OpenAiChatRequest {
    systemPrompt: string;
    userPrompt: string;
    imageUrls?: string[];
    imageDetail?: 'low' | 'auto' | 'high';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    webSearch?: boolean;
    webSearchOptions?: {
        engine?: 'exa' | 'auto';
        maxResults?: number;
        maxUses?: number;
        maxTotalResults?: number;
        searchContextSize?: 'low' | 'medium' | 'high';
        allowedDomains?: string[];
    };
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    metadata?: Record<string, unknown>;
    costLane?: string;
}
export interface OpenAiEmbeddingRequest {
    inputs: string[];
    model?: string;
}
export interface OpenAiChatResponse {
    content: unknown;
    rawContent: string;
    model: string;
    finishReason: string;
    usage: OpenAiUsage;
    latencyMs: number;
    estimatedCostUsd: number;
    citations?: OpenAiWebCitation[];
    webSearchRequests?: number;
}
export interface OpenAiWebCitation {
    url: string;
    title?: string;
    content?: string;
}
export interface OpenAiEmbeddingResponse {
    embeddings: number[][];
    model: string;
    usage: OpenAiUsage;
    estimatedCostUsd: number;
}
export interface OpenAiUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}
export type OpenAiJobPriority = 'critical' | 'high' | 'normal' | 'low';
export interface OpenAiQueueJob {
    jobId: string;
    request: OpenAiChatRequest;
    priority: OpenAiJobPriority;
    callbackEvent?: string;
    maxRetries?: number;
    callerContext?: string;
}
export interface OpenAiQueueResult {
    jobId: string;
    success: boolean;
    response?: OpenAiChatResponse;
    error?: string;
    retryCount: number;
}
export interface PromptTemplate {
    name: string;
    systemPrompt: string;
    userPrompt: string;
    jsonMode: boolean;
    temperature: number;
    maxTokens?: number;
}
export declare const OPENAI_PRICING: Record<string, {
    input: number;
    output: number;
}>;
export declare function estimateCost(model: string, promptTokens: number, completionTokens: number): number;
