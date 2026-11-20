import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OpenAiChatRequest, OpenAiChatResponse, OpenAiEmbeddingRequest, OpenAiEmbeddingResponse } from './openai.types.js';
export declare class OpenAiService implements OnModuleInit {
    private readonly config;
    private readonly logger;
    private client;
    private baseURL;
    private chatModel;
    private embeddingModel;
    private visionDetail;
    private rateLimitRemainingRequests;
    private rateLimitRemainingTokens;
    private rateLimitResetMs;
    private sessionCostUsd;
    private sessionCostByLane;
    constructor(config: ConfigService);
    onModuleInit(): void;
    chat(req: OpenAiChatRequest): Promise<OpenAiChatResponse>;
    private extractWebCitations;
    embed(req: OpenAiEmbeddingRequest): Promise<OpenAiEmbeddingResponse>;
    getSessionCost(): number;
    getSessionCostByLane(): Record<string, number>;
    getRateLimitStatus(): {
        remainingRequests: number;
        remainingTokens: number;
        resetMs: number;
    };
    private callWithRetry;
    private sleep;
}
