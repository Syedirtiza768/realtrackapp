import 'reflect-metadata';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PartsSearchOptionsDto, toOptionsParams } from './dto/parts-search-options.dto.js';
import { PartsSearchUpstreamError } from './parts-search.client.js';
import { PartsSearchOptionsService } from './parts-search-options.service.js';

function item(partId: string, status: string, numbers: string[]) {
  return {
    partId,
    numbers,
    availability: { status },
    fitment: { verdict: null },
  };
}

function upstream(groups: any[], summary: Record<string, unknown> = {}) {
  return {
    requestId: 'req-1',
    mode: 'number',
    query: { original: '86401-12020', numbers: ['8640112020'] },
    vehicle: { label: '2019 Toyota Corolla', make: 'Toyota', model: 'Corolla', year: 2019 },
    summary: { totalOptions: 3, inStock: 1, inStockFits: 0, sentence: '3 options: 1 in stock.', ...summary },
    groups,
    meta: {},
  };
}

function makeService(options: { key?: string | null; response?: any; error?: Error; stockRows?: any[] } = {}) {
  const client = {
    internalKey: options.key === undefined ? 'k' : options.key,
    get: options.error ? jest.fn().mockRejectedValue(options.error) : jest.fn().mockResolvedValue(options.response),
  };
  const dataSource = { query: jest.fn().mockResolvedValue(options.stockRows ?? []) };
  const userOrgs = { listForUser: jest.fn().mockResolvedValue([{ organizationId: 'org-1' }]) };
  const saved: any[] = [];
  const events = {
    create: jest.fn((value: any) => value),
    save: jest.fn(async (value: any) => {
      saved.push(value);
      return value;
    }),
  };
  const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') };
  const service = new PartsSearchOptionsService(client as any, dataSource as any, userOrgs as any, events as any, redis as any);
  return { service, client, dataSource, saved };
}

const user = { id: 'u1', email: 'staff@example.com' } as any;
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('PartsSearchOptionsDto', () => {
  it('validates and always asks PartsBazar360 for unavailable parts (hidden after the merge)', () => {
    const dto = plainToInstance(PartsSearchOptionsDto, { q: '86401-12020', year: '2019', make: 'Toyota', drop: 'side,year' });
    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    const params = toOptionsParams(dto);
    expect(params).toContainEqual(['includeUnavailable', 'true']);
    expect(params).toContainEqual(['drop', 'side,year']);
    expect(params).toContainEqual(['year', '2019']);
  });

  it('rejects unknown drops and bad ids', () => {
    expect(validateSync(plainToInstance(PartsSearchOptionsDto, { drop: 'everything' }))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(PartsSearchOptionsDto, { vehicleConfigId: "x'; drop" }))).not.toHaveLength(0);
  });
});

describe('PartsSearchOptionsService.options', () => {
  it('needs the internal key', async () => {
    const { service } = makeService({ key: null });
    await expect(service.options({} as any, user)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps upstream 400 to 400 and "not deployed" to INTERNAL_SEARCH_UNAVAILABLE', async () => {
    await expect(
      makeService({ error: new PartsSearchUpstreamError('bad', 400) }).service.options({} as any, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    const error = await makeService({ error: new PartsSearchUpstreamError('Cannot GET', 404) })
      .service.options({} as any, user)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse().code).toBe('INTERNAL_SEARCH_UNAVAILABLE');
  });

  it('lists Omni Core stock as its own entries and never un-hides another seller ended listing', async () => {
    const response = upstream([
      { key: 'exact', label: 'Exact number', total: 2, hiddenUnavailable: 0, collapsedByDefault: false, items: [item('t1', 'in_stock', ['8640112020']), item('gone', 'not_available', ['8640112099'])] },
      { key: 'possible', label: 'Possible', total: 1, hiddenUnavailable: 0, collapsedByDefault: true, items: [item('x', 'not_available', ['ZZZ99999'])] },
    ]);
    const stockRows = [
      { id: 'ii-1', sku: 'AP-1', title: 'Camera', image_url: null, sourcing_mode: 'stocked', mpn: '86401-12099', oem_part_number: null, brand: 'Toyota', warehouse: 'Main', available: '2' },
      { id: 'ii-2', sku: 'AP-2', title: 'Unlisted camera', image_url: null, sourcing_mode: 'stocked', mpn: '8640112020X', oem_part_number: '86401-12020', brand: 'Toyota', warehouse: 'Main', available: '1' },
      { id: 'ii-3', sku: 'AP-3', title: 'Sold out', image_url: null, sourcing_mode: 'stocked', mpn: '86401-12020', oem_part_number: null, brand: 'Toyota', warehouse: null, available: '0' },
    ];
    const { service, dataSource } = makeService({ response, stockRows });
    const result = await service.options({ q: '86401-12020' } as any, user);

    expect(dataSource.query.mock.calls[0][1][0]).toEqual(['org-1']);
    // Our stock comes first, as separate entries; a stocked-mode item with 0 on hand is not shown.
    expect(result.groups[0].key).toBe('omni_core_stock');
    const own = result.groups[0].items;
    expect(own.map((i) => i.partId)).toEqual(['omni:ii-1', 'omni:ii-2']);
    expect((own[1] as any).match.label).toBe('Exact number');
    expect((own[0] as any).match.label).toBe('Same number as a listed equivalent');

    const exact = result.groups.find((g) => g.key === 'exact')!;
    // 'gone' ended on PartsBazar360: still hidden even though we hold its number.
    expect(exact.items.map((i) => i.partId)).toEqual(['t1']);
    expect(exact.hiddenUnavailable).toBe(1);
    // t1 just carries a badge for our matching stock.
    expect(exact.items[0].omniStock?.items.map((r) => r.sku)).toEqual(['AP-2']);
    expect(result.summary.omniInStock).toBe(2);
  });

  it('counts a search answered only from our warehouse as sellable (not demand)', async () => {
    const response = upstream([], { totalOptions: 0, inStock: 0 });
    const stockRows = [{ id: 'ii-9', sku: 'AP-9', title: 'Our only one', image_url: null, sourcing_mode: 'stocked', mpn: '86401-12020', oem_part_number: null, brand: 'Toyota', warehouse: 'Main', available: '1' }];
    const { service, saved } = makeService({ response, stockRows });
    const result = await service.options({ q: '86401-12020' } as any, user);
    expect(result.groups.find((g) => g.key === 'omni_core_stock')!.items[0].partId).toBe('omni:ii-9');
    await flush();
    expect(saved[0]).toMatchObject({ type: 'query', demand: false, inStockCount: 1, resultCount: 1 });
  });

  it('logs zero-result searches as demand', async () => {
    const { service, saved } = makeService({ response: upstream([], { totalOptions: 0, inStock: 0 }) });
    await service.options({ q: '86401-12020' } as any, user);
    await flush();
    expect(saved[0]).toMatchObject({ type: 'query', demand: true, numbers: ['8640112020'], userId: 'u1', requestRef: 'req-1' });
    expect(saved[0].vehicle).toMatchObject({ label: '2019 Toyota Corolla' });
  });
});

describe('VIN decode', () => {
  it('rejects malformed VINs before calling NHTSA', async () => {
    const { service } = makeService();
    await expect(service.decodeVin('ABC')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.decodeVin('1HGCV1F34LA00000I')).rejects.toBeInstanceOf(BadRequestException);
  });
});
