import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { PartsSearchQueryDto } from './dto/parts-search-query.dto.js';
import { PartsSearchClient } from './parts-search.client.js';
import type { PartsSearchAudience, PartsSearchResponse, PartsSearchStatus, PartsSearchSuggestResponse } from './parts-search.types.js';
export declare class PartsSearchService {
    private readonly client;
    private readonly config;
    private readonly redis;
    private readonly logger;
    constructor(client: PartsSearchClient, config: ConfigService, redis: Redis);
    get audience(): PartsSearchAudience;
    private get cacheTtlSeconds();
    search(dto: PartsSearchQueryDto, userId?: string): Promise<PartsSearchResponse>;
    private publicSearch;
    suggest(q: string | undefined): Promise<PartsSearchSuggestResponse>;
    part(id: string): Promise<Record<string, unknown>>;
    private publicPart;
    status(): Promise<PartsSearchStatus>;
    private isInternalFallback;
    private toHttpError;
    private cacheKey;
    private cacheGet;
    private cacheSet;
    private logQuery;
}
