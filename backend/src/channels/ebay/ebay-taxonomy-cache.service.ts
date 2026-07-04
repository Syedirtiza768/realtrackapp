/**
 * Persistent on-disk cache for eBay Taxonomy API responses.
 * Shared with scripts/lib/taxonomy-client.mjs (same file format + path).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

const CACHE_VERSION = 2;
const SUGGESTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

interface SuggestionEntry {
  result: {
    categoryId: string;
    categoryName: string;
    categoryPath?: string;
  } | null;
  cachedAt: number;
}

interface ScopeData {
  suggestions: Record<string, SuggestionEntry>;
  aspects: Record<string, { aspects: unknown; cachedAt: number }>;
  dailyUsage: Record<string, number>;
}

interface CacheFile {
  version: number;
  scopes: Record<string, ScopeData>;
}

@Injectable()
export class EbayTaxonomyCacheService {
  private readonly logger = new Logger(EbayTaxonomyCacheService.name);
  private readonly cachePath: string;
  private readonly scopeKey: string;
  private readonly dailyQuota: number;
  private disk: CacheFile;

  constructor(private readonly config: ConfigService) {
    const root =
      this.config.get<string>('PIPELINE_PROJECT_ROOT') ||
      path.resolve(process.cwd(), '..');
    this.cachePath = path.resolve(
      root,
      this.config.get<string>('EBAY_TAXONOMY_CACHE_PATH') ||
        'config/.ebay-taxonomy-suggestions-cache.json',
    );
    const sandbox =
      String(this.config.get('EBAY_SANDBOX', 'false')).toLowerCase() ===
      'true';
    const marketplace =
      this.config.get<string>('EBAY_MARKETPLACE_ID') || 'EBAY_MOTORS_US';
    this.scopeKey = `${marketplace}:${sandbox ? 'sandbox' : 'production'}`;
    this.dailyQuota =
      Number(this.config.get('PIPELINE_TAXONOMY_DAILY_QUOTA')) || 4800;
    this.disk = this.load();
  }

  private load(): CacheFile {
    try {
      if (fs.existsSync(this.cachePath)) {
        const parsed = JSON.parse(
          fs.readFileSync(this.cachePath, 'utf8'),
        ) as CacheFile;
        if (parsed?.version === CACHE_VERSION) return parsed;
      }
    } catch (err) {
      this.logger.warn(`Taxonomy cache load failed: ${(err as Error).message}`);
    }
    return { version: CACHE_VERSION, scopes: {} };
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      fs.writeFileSync(this.cachePath, JSON.stringify(this.disk, null, 2));
    } catch (err) {
      this.logger.warn(`Taxonomy cache persist failed: ${(err as Error).message}`);
    }
  }

  private scope(): ScopeData {
    if (!this.disk.scopes[this.scopeKey]) {
      this.disk.scopes[this.scopeKey] = {
        suggestions: {},
        aspects: {},
        dailyUsage: {},
      };
    }
    return this.disk.scopes[this.scopeKey];
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  getDailyUsage(): number {
    const day = this.todayKey();
    return this.scope().dailyUsage[day] ?? 0;
  }

  hasDailyQuota(): boolean {
    return this.getDailyUsage() < this.dailyQuota;
  }

  incrementDailyUsage(): void {
    const s = this.scope();
    const day = this.todayKey();
    s.dailyUsage[day] = (s.dailyUsage[day] ?? 0) + 1;
    for (const k of Object.keys(s.dailyUsage)) {
      if (k < day) delete s.dailyUsage[k];
    }
    this.persist();
  }

  normQuery(q: string): string {
    return String(q || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  getSuggestion(
    treeId: string,
    query: string,
  ): SuggestionEntry['result'] | undefined {
    const key = `${treeId}::${this.normQuery(query)}`;
    const entry = this.scope().suggestions[key];
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > SUGGESTION_TTL_MS) {
      delete this.scope().suggestions[key];
      return undefined;
    }
    return entry.result;
  }

  setSuggestion(
    treeId: string,
    query: string,
    result: SuggestionEntry['result'],
  ): void {
    const key = `${treeId}::${this.normQuery(query)}`;
    this.scope().suggestions[key] = { result, cachedAt: Date.now() };
    this.persist();
  }
}
