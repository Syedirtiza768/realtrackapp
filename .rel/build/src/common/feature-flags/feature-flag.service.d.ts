import { Repository } from 'typeorm';
import { FeatureFlag } from './feature-flag.entity.js';
export declare class FeatureFlagService {
    private readonly flagRepo;
    private readonly logger;
    private cache;
    private cacheAge;
    private static readonly CACHE_TTL_MS;
    constructor(flagRepo: Repository<FeatureFlag>);
    isEnabled(key: string): Promise<boolean>;
    getAll(): Promise<FeatureFlag[]>;
    getByKey(key: string): Promise<FeatureFlag>;
    setEnabled(key: string, enabled: boolean): Promise<FeatureFlag>;
    toggle(key: string): Promise<FeatureFlag>;
    ensureFlag(key: string, description?: string, defaultEnabled?: boolean): Promise<FeatureFlag>;
    private refreshCacheIfStale;
}
