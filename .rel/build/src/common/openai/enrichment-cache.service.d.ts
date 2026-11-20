import type { EnrichmentProfile } from './token-optimization.js';
export declare class EnrichmentCacheService {
    private readonly cache;
    private key;
    get(mpn: string | undefined | null, promptVersion: string, profile: EnrichmentProfile): Record<string, unknown> | null;
    set(mpn: string, promptVersion: string, profile: EnrichmentProfile, item: Record<string, unknown>): void;
}
