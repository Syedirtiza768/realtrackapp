import 'reflect-metadata';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PERMISSIONS_KEY } from '../rbac/decorators/require-permissions.decorator.js';
import { ROLE_SLUGS, permissionsForRole } from '../rbac/permission-registry.js';
import {
  PARTS_SEARCH_MAX_PAGE,
  PartsSearchQueryDto,
  toUpstreamParams,
} from './dto/parts-search-query.dto.js';
import { PartsSearchUpstreamError } from './parts-search.client.js';
import { PartsSearchController } from './parts-search.controller.js';
import { PartsSearchService } from './parts-search.service.js';

function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(PartsSearchQueryDto, query);
  return { dto, errors: validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }) };
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    query: { original: 'x', normalized: 'x', interpreted: {} },
    results: [{ id: 'p1' }],
    facets: {},
    appliedFilters: {},
    pagination: {
      page: 1,
      pageSize: 24,
      totalResults: 1,
      totalRelation: 'eq',
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    corrections: [],
    meta: { tookMs: 5, index: 'parts_search', degraded: false },
    requestId: 'r1',
    ...overrides,
  };
}

function makeService(options: { key?: string | null; get?: jest.Mock } = {}) {
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
  };
  const client = {
    internalKey: options.key ?? null,
    baseUrl: 'https://partsbazar360.com/api',
    get: options.get ?? jest.fn(),
  };
  const config = { get: jest.fn((_key: string, fallback?: string) => fallback) };
  const service = new PartsSearchService(client as any, config as any, redis as any);
  return { service, client, redis };
}

describe('Parts Search access', () => {
  it('is gated on dashboard.view, the Auto Parts workspace permission', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, PartsSearchController)).toEqual([
      'dashboard.view',
    ]);
  });

  it('lets Auto Parts roles in and keeps Fashion / B&I roles out', () => {
    for (const role of [
      ROLE_SLUGS.ADMIN,
      ROLE_SLUGS.STAFF,
      ROLE_SLUGS.VIEWER,
      ROLE_SLUGS.LISTING_USER,
      ROLE_SLUGS.SUPERVISOR,
    ]) {
      expect(permissionsForRole(role)).toContain('dashboard.view');
    }
    for (const role of [
      ROLE_SLUGS.FASHION_OPERATOR,
      ROLE_SLUGS.FASHION_ADMIN,
      ROLE_SLUGS.BUSINESS_INDUSTRIAL_OPERATOR,
    ]) {
      expect(permissionsForRole(role)).not.toContain('dashboard.view');
    }
  });
});

describe('PartsSearchQueryDto', () => {
  it('accepts comma lists and repeated params, bounded and de-duplicated', () => {
    const { dto, errors } = parse({
      q: '  86401-12020 ',
      make: 'Toyota,Lexus,Toyota',
      category: ['Lights, Lamps', 'Mirrors'],
      page: '2',
      pageSize: '48',
      inStock: 'true',
    });
    expect(errors).toHaveLength(0);
    expect(dto.q).toBe('86401-12020');
    expect(dto.make).toEqual(['Toyota', 'Lexus']);
    // Repeated params are kept whole, so a value containing a comma survives.
    expect(dto.category).toEqual(['Lights, Lamps', 'Mirrors']);
    expect(dto.page).toBe(2);
    expect(dto.inStock).toBe(true);
  });

  it('rejects out-of-range input instead of forwarding it', () => {
    expect(parse({ q: 'x'.repeat(201) }).errors).not.toHaveLength(0);
    expect(parse({ page: String(PARTS_SEARCH_MAX_PAGE + 1) }).errors).not.toHaveLength(0);
    expect(parse({ pageSize: '1000' }).errors).not.toHaveLength(0);
    expect(parse({ sort: 'price; drop' }).errors).not.toHaveLength(0);
    expect(parse({ year: '1800' }).errors).not.toHaveLength(0);
    expect(parse({ script: 'x' }).errors).not.toHaveLength(0);
  });

  it('sends lists as repeated params and hides seller filters from public search', () => {
    const { dto } = parse({ q: 'mirror', category: ['Lights, Lamps'], seller: 'Acme', page: '1' });
    expect(toUpstreamParams(dto, 'internal')).toEqual([
      ['q', 'mirror'],
      ['category', 'Lights, Lamps'],
      ['seller', 'Acme'],
      ['page', '1'],
    ]);
    expect(toUpstreamParams(dto, 'public')).toEqual([
      ['q', 'mirror'],
      ['category', 'Lights, Lamps'],
      ['page', '1'],
    ]);
  });
});

describe('PartsSearchService.search', () => {
  it('uses public search when no internal key is configured', async () => {
    const get = jest.fn().mockResolvedValue(envelope());
    const { service } = makeService({ get });
    const response = await service.search({ q: 'alternator' } as PartsSearchQueryDto);
    expect(get).toHaveBeenCalledWith('/v1/search', [['q', 'alternator']], { attempts: 2 });
    expect(response.meta.audience).toBe('public');
  });

  it('uses internal search with the key when configured', async () => {
    const get = jest.fn().mockResolvedValue(envelope());
    const { service } = makeService({ key: 'k', get });
    const response = await service.search({ q: 'alternator' } as PartsSearchQueryDto);
    expect(get).toHaveBeenCalledWith(
      '/integrations/realtrack/search',
      [['q', 'alternator']],
      { internal: true, attempts: 2 },
    );
    expect(response.meta.audience).toBe('internal');
    expect(response.meta.internalUnavailableReason).toBeUndefined();
  });

  it('falls back to public search, and says why, when internal is not deployed', async () => {
    const get = jest
      .fn()
      .mockRejectedValueOnce(new PartsSearchUpstreamError('Cannot GET /integrations/realtrack/search', 404))
      .mockResolvedValueOnce(envelope());
    const { service } = makeService({ key: 'k', get });
    const response = await service.search({ q: 'x' } as PartsSearchQueryDto);
    expect(get).toHaveBeenLastCalledWith('/v1/search', [['q', 'x']], { attempts: 2 });
    expect(response.meta).toMatchObject({
      audience: 'public',
      internalUnavailableReason: 'Cannot GET /integrations/realtrack/search',
    });
  });

  it('maps an outage to 503 rather than falling back', async () => {
    const get = jest.fn().mockRejectedValue(new PartsSearchUpstreamError('timeout', null));
    const { service } = makeService({ key: 'k', get });
    await expect(service.search({ q: 'x' } as PartsSearchQueryDto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('passes upstream validation errors through as 400', async () => {
    const get = jest.fn().mockRejectedValue(new PartsSearchUpstreamError('bad sort', 400));
    const { service } = makeService({ get });
    await expect(service.search({ q: 'x' } as PartsSearchQueryDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('serves a repeat query from cache, but never caches a degraded answer', async () => {
    const get = jest.fn().mockResolvedValue(envelope());
    const { service } = makeService({ get });
    await service.search({ q: 'x' } as PartsSearchQueryDto);
    const second = await service.search({ q: 'x' } as PartsSearchQueryDto);
    expect(get).toHaveBeenCalledTimes(1);
    expect(second.meta.cached).toBe(true);

    const degraded = jest
      .fn()
      .mockResolvedValue(envelope({ meta: { tookMs: 1, index: 'parts_search', degraded: true } }));
    const other = makeService({ get: degraded });
    await other.service.search({ q: 'y' } as PartsSearchQueryDto);
    await other.service.search({ q: 'y' } as PartsSearchQueryDto);
    expect(degraded).toHaveBeenCalledTimes(2);
  });

  it('keeps public and internal answers in separate cache entries', async () => {
    const get = jest.fn().mockResolvedValue(envelope());
    const shared = makeService({ get });
    await shared.service.search({ q: 'x' } as PartsSearchQueryDto);
    (shared.client as any).internalKey = 'k';
    await shared.service.search({ q: 'x' } as PartsSearchQueryDto);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('PartsSearchService.suggest / part', () => {
  it('skips the upstream call for one-character input and swallows suggest errors', async () => {
    const get = jest.fn().mockRejectedValue(new PartsSearchUpstreamError('down', null));
    const { service } = makeService({ get });
    expect((await service.suggest('a')).parts).toEqual([]);
    expect(get).not.toHaveBeenCalled();
    expect((await service.suggest('alt')).parts).toEqual([]);
  });

  it('returns 404 for a part PartsBazar360 does not have', async () => {
    const get = jest.fn().mockRejectedValue(new PartsSearchUpstreamError('nope', 404));
    const { service } = makeService({ get });
    await expect(service.part('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reads the internal part view when keyed', async () => {
    const get = jest.fn().mockResolvedValue({ id: 'p1', internalOffers: [] });
    const { service } = makeService({ key: 'k', get });
    const part = await service.part('p1');
    expect(get).toHaveBeenCalledWith('/integrations/realtrack/search/parts/p1', [], {
      internal: true,
      attempts: 2,
    });
    expect(part).toMatchObject({ id: 'p1', audience: 'internal' });
  });
});
