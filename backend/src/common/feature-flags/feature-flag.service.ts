import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag } from './feature-flag.entity.js';

/**
 * Service for managing feature flags.
 * 
 * Provides a simple get/set/toggle interface with a local cache
 * to avoid hitting the DB on every check. Cache refreshes every 60s.
 */
@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private cache: Map<string, boolean> = new Map();
  private cacheAge = 0;
  private static readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly flagRepo: Repository<FeatureFlag>,
  ) {}

  /**
   * Check if a feature is enabled.
   * Uses a 60-second local cache to minimize DB lookups.
   */
  async isEnabled(key: string): Promise<boolean> {
    await this.refreshCacheIfStale();
    return this.cache.get(key) ?? false;
  }

  /**
   * Get all feature flags.
   */
  async getAll(): Promise<FeatureFlag[]> {
    return this.flagRepo.find({ order: { key: 'ASC' } });
  }

  /**
   * Get a single flag by key.
   */
  async getByKey(key: string): Promise<FeatureFlag> {
    const flag = await this.flagRepo.findOne({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag '${key}' not found`);
    return flag;
  }

  /**
   * Enable or disable a feature flag.
   */
  async setEnabled(key: string, enabled: boolean): Promise<FeatureFlag> {
    const flag = await this.getByKey(key);
    flag.enabled = enabled;
    const saved = await this.flagRepo.save(flag);
    this.cache.set(key, enabled);
    this.logger.log(`Feature flag '${key}' set to ${enabled}`);
    return saved;
  }

  /**
   * Toggle a feature flag.
   */
  async toggle(key: string): Promise<FeatureFlag> {
    const flag = await this.getByKey(key);
    return this.setEnabled(key, !flag.enabled);
  }

  /**
   * Create a new feature flag (idempotent — skips if key already exists).
   */
  async ensureFlag(key: string, description?: string, defaultEnabled = false): Promise<FeatureFlag> {
    const existing = await this.flagRepo.findOne({ where: { key } });
    if (existing) return existing;

    const flag = this.flagRepo.create({
      key,
      description: description ?? null,
      enabled: defaultEnabled,
    });
    return this.flagRepo.save(flag);
  }

  /**
   * Refresh cache from DB if older than CACHE_TTL_MS.
   */
  private async refreshCacheIfStale(): Promise<void> {
    if (Date.now() - this.cacheAge < FeatureFlagService.CACHE_TTL_MS && this.cache.size > 0) {
      return;
    }
    try {
      const flags = await this.flagRepo.find();
      this.cache = new Map(flags.map((f) => [f.key, f.enabled]));
      this.cacheAge = Date.now();
    } catch (error) {
      // On error (e.g., table doesn't exist yet), keep stale cache
      this.logger.warn('Failed to refresh feature flag cache', error);
    }
  }
}
