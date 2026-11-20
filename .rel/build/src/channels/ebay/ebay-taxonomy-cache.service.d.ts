import { ConfigService } from '@nestjs/config';
interface SuggestionEntry {
    result: {
        categoryId: string;
        categoryName: string;
        categoryPath?: string;
    } | null;
    cachedAt: number;
}
export declare class EbayTaxonomyCacheService {
    private readonly config;
    private readonly logger;
    private readonly cachePath;
    private readonly scopeKey;
    private readonly dailyQuota;
    private disk;
    constructor(config: ConfigService);
    private load;
    private persist;
    private scope;
    private todayKey;
    getDailyUsage(): number;
    hasDailyQuota(): boolean;
    incrementDailyUsage(): void;
    normQuery(q: string): string;
    getSuggestion(treeId: string, query: string): SuggestionEntry['result'] | undefined;
    setSuggestion(treeId: string, query: string, result: SuggestionEntry['result']): void;
    getCompatibility(categoryTreeId: string, categoryId: string): boolean | undefined;
    setCompatibility(categoryTreeId: string, categoryId: string, required: boolean): void;
}
export {};
