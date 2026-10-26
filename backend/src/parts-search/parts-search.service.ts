import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { APP_REDIS } from '../common/redis/app-redis.constants.js';
import {
  PartsSearchQueryDto,
  toUpstreamParams,
} from './dto/parts-search-query.dto.js';
import { PartsSearchClient, PartsSearchUpstreamError } from './parts-search.client.js';
import type {
  PartsSearchAudience,
  PartsSearchResponse,
  PartsSearchStatus,
  PartsSearchSuggestResponse,
} from './parts-search.types.js';

const PUBLIC_SEARCH_PATH = '/v1/search';
const INTERNAL_SEARCH_PATH = '/integrations/realtrack/search';
const SUGGEST_PATH = '/search/suggest';
const PUBLIC_PART_PATH = '/search/parts';

/**
 * Internal-search failures that mean "not deployed / not enabled / key wrong"
 * rather than "search is down". On these the portal still answers from public
 * search and says why, instead of going blank.
 */
const INTERNAL_FALLBACK_STATUSES = new Set([401, 403, 404, 503]);

const EMPTY_SUGGEST: PartsSearchSuggestResponse = {
  parts: [],
  categories: [],
  categoryGroups: [],
  brands: [],
  makes: [],
};

/**
 * Parts Search portal backend: a guarded, cached proxy over PartsBazar360's
 * universal search. Uses the internal (keyed) endpoint when
 * PARTSBAZAR360_SEARCH_API_KEY is set — every offer with seller, source and
 * stock — and the public buyer search otherwise.
 */
@Injectable()
export class PartsSearchService {
  private readonly logger = new Logger(PartsSearchService.name);

  constructor(
    private readonly client: PartsSearchClient,
    private readonly config: ConfigService,
    @Inject(APP_REDIS) private readonly redis: Redis,
  ) {}

  get audience(): PartsSearchAudience {
    return this.client.internalKey ? 'internal' : 'public';
  }

  private get cacheTtlSeconds(): number {
    const value = Number(this.config.get<string>('PARTS_SEARCH_CACHE_TTL_SECONDS', '30'));
    return Number.isFinite(value) && value >= 0 ? value : 30;
  }

  async search(dto: PartsSearchQueryDto, userId?: string): Promise<PartsSearchResponse> {
    const audience = this.audience;
    const cacheKey = this.cacheKey('query', audience, toUpstreamParams(dto, audience));
    const cached = await this.cacheGet<PartsSearchResponse>(cacheKey);
    if (cached) {
      this.logQuery(dto, cached, userId, true);
      return { ...cached, meta: { ...cached.meta, cached: true } };
    }

    let response: PartsSearchResponse;
    if (audience === 'internal') {
      try {
        response = await this.client.get<PartsSearchResponse>(
          INTERNAL_SEARCH_PATH,
          toUpstreamParams(dto, 'internal'),
          { internal: true, attempts: 2 },
        );
        response.meta = { ...response.meta, audience: 'internal' };
      } catch (error) {
        if (!this.isInternalFallback(error)) throw this.toHttpError(error);
        const reason = (error as PartsSearchUpstreamError).message;
        this.logger.warn(`Internal parts search unavailable, using public search: ${reason}`);
        response = await this.publicSearch(dto);
        response.meta = { ...response.meta, internalUnavailableReason: reason };
      }
    } else {
      response = await this.publicSearch(dto);
    }

    // A degraded envelope means OpenSearch failed upstream — don't pin it in cache.
    if (!response.meta?.degraded) await this.cacheSet(cacheKey, response, this.cacheTtlSeconds);
    this.logQuery(dto, response, userId, false);
    return response;
  }

  private async publicSearch(dto: PartsSearchQueryDto): Promise<PartsSearchResponse> {
    try {
      const response = await this.client.get<PartsSearchResponse>(
        PUBLIC_SEARCH_PATH,
        toUpstreamParams(dto, 'public'),
        { attempts: 2 },
      );
      return { ...response, meta: { ...response.meta, audience: 'public' } };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async suggest(q: string | undefined): Promise<PartsSearchSuggestResponse> {
    const query = (q ?? '').trim();
    if (query.length < 2) return EMPTY_SUGGEST;
    const cacheKey = this.cacheKey('suggest', 'public', [['q', query.toLowerCase()]]);
    const cached = await this.cacheGet<PartsSearchSuggestResponse>(cacheKey);
    if (cached) return cached;
    try {
      const raw = await this.client.get<Partial<PartsSearchSuggestResponse>>(
        SUGGEST_PATH,
        [['q', query]],
      );
      const response: PartsSearchSuggestResponse = {
        parts: (raw.parts ?? []).slice(0, 8),
        categories: (raw.categories ?? []).slice(0, 6),
        categoryGroups: (raw.categoryGroups ?? []).slice(0, 6),
        brands: (raw.brands ?? []).slice(0, 6),
        makes: (raw.makes ?? []).slice(0, 6),
      };
      await this.cacheSet(cacheKey, response, this.cacheTtlSeconds);
      return response;
    } catch (error) {
      // Typeahead is a convenience: never surface an error for it.
      this.logger.debug(`suggest failed: ${(error as Error)?.message}`);
      return EMPTY_SUGGEST;
    }
  }

  async part(id: string): Promise<Record<string, unknown>> {
    const audience = this.audience;
    const cacheKey = this.cacheKey('part', audience, [['id', id]]);
    const cached = await this.cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const path = `/${encodeURIComponent(id)}`;
    let part: Record<string, unknown>;
    if (audience === 'internal') {
      try {
        part = await this.client.get(`${INTERNAL_SEARCH_PATH}/parts${path}`, [], {
          internal: true,
          attempts: 2,
        });
        part = { ...part, audience: 'internal' };
      } catch (error) {
        // A 404 from a deployed internal endpoint means the part is gone —
        // but a 404 from an *undeployed* one looks the same, so try public.
        if (!this.isInternalFallback(error)) throw this.toHttpError(error);
        const reason = (error as PartsSearchUpstreamError).message;
        part = { ...(await this.publicPart(path)), internalUnavailableReason: reason };
      }
    } else {
      part = await this.publicPart(path);
    }
    await this.cacheSet(cacheKey, part, Math.max(this.cacheTtlSeconds, 120));
    return part;
  }

  private async publicPart(path: string): Promise<Record<string, unknown>> {
    try {
      const part = await this.client.get<Record<string, unknown>>(
        `${PUBLIC_PART_PATH}${path}`,
        [],
        { attempts: 2 },
      );
      return { ...part, audience: 'public' };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async status(): Promise<PartsSearchStatus> {
    const internalConfigured = Boolean(this.client.internalKey);
    const status: PartsSearchStatus = {
      apiUrl: this.client.baseUrl,
      internalConfigured,
      audience: this.audience,
      upstream: { ok: false },
      internal: null,
    };
    try {
      const probe = await this.client.get<PartsSearchResponse>(PUBLIC_SEARCH_PATH, [
        ['pageSize', '24'],
      ]);
      status.upstream = {
        ok: !probe.meta?.degraded,
        index: probe.meta?.index,
        degraded: probe.meta?.degraded,
      };
    } catch (error) {
      status.upstream = { ok: false, message: (error as Error).message };
    }
    if (internalConfigured) {
      try {
        await this.client.get(`${INTERNAL_SEARCH_PATH}/health`, [], { internal: true });
        status.internal = { ok: true };
      } catch (error) {
        status.internal = { ok: false, message: (error as Error).message };
      }
    }
    return status;
  }

  private isInternalFallback(error: unknown): boolean {
    return (
      error instanceof PartsSearchUpstreamError &&
      error.status !== null &&
      INTERNAL_FALLBACK_STATUSES.has(error.status)
    );
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof PartsSearchUpstreamError) {
      if (error.status === 400) return new BadRequestException(error.message);
      // Keep PartsBazar360's reason (e.g. "Part … has no active offers" when its
      // index still lists a part whose offers ended) — it explains the 404.
      if (error.status === 404) return new NotFoundException(error.message || 'Part not found on PartsBazar360');
      this.logger.warn(`PartsBazar360 search failed: ${error.message}`);
      return new ServiceUnavailableException({
        message: 'PartsBazar360 search is unavailable. Please retry.',
        degraded: true,
      });
    }
    return error as Error;
  }

  private cacheKey(
    kind: string,
    audience: PartsSearchAudience,
    params: Array<[string, string]>,
  ): string {
    const normalized = [...params]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('&');
    const digest = createHash('sha1').update(normalized).digest('hex');
    return `parts-search:v1:${kind}:${audience}:${digest}`;
  }

  private async cacheGet<T>(key: string): Promise<T | null> {
    if (this.cacheTtlSeconds === 0) return null;
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* best-effort: no cache is not an error */
    }
  }

  private logQuery(
    dto: PartsSearchQueryDto,
    response: PartsSearchResponse,
    userId: string | undefined,
    cached: boolean,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: 'parts_search.query',
        userId: userId ?? null,
        q: dto.q ?? '',
        filters: Object.keys(dto).filter(
          (key) => key !== 'q' && (dto as Record<string, unknown>)[key] !== undefined,
        ),
        total: response.pagination?.totalResults ?? 0,
        audience: response.meta?.audience,
        tookMs: response.meta?.tookMs,
        degraded: response.meta?.degraded ?? false,
        cached,
      }),
    );
  }
}
