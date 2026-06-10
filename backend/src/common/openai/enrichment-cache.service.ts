import { Injectable } from '@nestjs/common';
import type { EnrichmentProfile } from './token-optimization.js';

interface CacheEntry {
  item: Record<string, unknown>;
  cachedAt: number;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class EnrichmentCacheService {
  private readonly cache = new Map<string, CacheEntry>();

  private key(
    mpn: string,
    promptVersion: string,
    profile: EnrichmentProfile,
  ): string {
    const norm = mpn.replace(/\s+/g, '').toLowerCase();
    return `${norm}|${promptVersion}|${profile}`;
  }

  get(
    mpn: string | undefined | null,
    promptVersion: string,
    profile: EnrichmentProfile,
  ): Record<string, unknown> | null {
    const trimmed = mpn?.trim();
    if (!trimmed) return null;
    const hit = this.cache.get(this.key(trimmed, promptVersion, profile));
    if (!hit) return null;
    if (Date.now() - hit.cachedAt > TTL_MS) {
      this.cache.delete(this.key(trimmed, promptVersion, profile));
      return null;
    }
    return hit.item;
  }

  set(
    mpn: string,
    promptVersion: string,
    profile: EnrichmentProfile,
    item: Record<string, unknown>,
  ): void {
    const trimmed = mpn.trim();
    if (!trimmed) return;
    this.cache.set(this.key(trimmed, promptVersion, profile), {
      item,
      cachedAt: Date.now(),
    });
  }
}
