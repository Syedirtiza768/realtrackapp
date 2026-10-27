import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import type { User } from '../auth/entities/user.entity.js';
import { APP_REDIS } from '../common/redis/app-redis.constants.js';
import {
  PartsSearchOptionsDto,
  PartsSearchRequestDto,
  PartsSearchSelectDto,
  toOptionsParams,
} from './dto/parts-search-options.dto.js';
import { PartsSearchEvent } from './entities/parts-search-event.entity.js';
import { PartsSearchClient, PartsSearchUpstreamError } from './parts-search.client.js';

const OPTIONS_PATH = '/integrations/realtrack/search/options';

/** A row of Omni Core's own automotive warehouse stock matched by part number. */
export interface OmniStockRow {
  inventoryItemId: string;
  sku: string;
  title: string | null;
  imageUrl: string | null;
  sourcingMode: string;
  mpn: string | null;
  oemPartNumber: string | null;
  brand: string | null;
  numbers: string[];
  warehouses: Array<{ name: string; available: number }>;
  available: number;
}

export interface OmniStockSummary {
  available: number;
  canSource: boolean;
  items: OmniStockRow[];
}

type OptionItem = {
  partId: string;
  numbers: string[];
  availability: { status: string };
  fitment: { verdict: string | null };
  omniStock?: OmniStockSummary;
  [key: string]: unknown;
};
type OptionGroup = { key: string; label: string; total: number; hiddenUnavailable: number; collapsedByDefault: boolean; items: OptionItem[] };
export type OptionsResponse = {
  requestId: string;
  mode: string;
  query: { original: string; numbers: string[]; [key: string]: unknown };
  vehicle: { label: string; make: string; model: string; year: number; engineLitres?: number } | null;
  summary: Record<string, number | string> & { totalOptions: number; inStock: number; inStockFits: number; sentence: string };
  groups: OptionGroup[];
  omniStock?: { inStockItems: number; items: number };
  meta: Record<string, unknown>;
  [key: string]: unknown;
};

/** NHTSA returns makes in capitals; keep acronym makes as acronyms. */
const ACRONYM_MAKES = new Set(['BMW', 'GMC', 'MINI', 'RAM', 'AMC', 'MG', 'DS', 'SRT', 'BYD']);
const displayMake = (make: string) =>
  make
    .split(/(\s+|-)/)
    .map((word) =>
      ACRONYM_MAKES.has(word.toUpperCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('');

const normalize = (value: unknown) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/**
 * Parts Search "every sellable option" for staff: proxies PartsBazar360's
 * internal options search, adds Omni Core's own automotive warehouse stock by
 * part number, and records the search (audit + demand log).
 */
@Injectable()
export class PartsSearchOptionsService {
  private readonly logger = new Logger(PartsSearchOptionsService.name);

  constructor(
    private readonly client: PartsSearchClient,
    private readonly dataSource: DataSource,
    private readonly userOrgs: UserOrganizationService,
    @InjectRepository(PartsSearchEvent) private readonly events: Repository<PartsSearchEvent>,
    @Inject(APP_REDIS) private readonly redis: Redis,
  ) {}

  async options(dto: PartsSearchOptionsDto, user?: User): Promise<OptionsResponse> {
    if (!this.client.internalKey) {
      throw new ServiceUnavailableException({
        code: 'INTERNAL_SEARCH_UNAVAILABLE',
        message: 'Internal PartsBazar360 search is not configured (PARTSBAZAR360_SEARCH_API_KEY).',
      });
    }
    let response: OptionsResponse;
    try {
      response = await this.client.get<OptionsResponse>(OPTIONS_PATH, toOptionsParams(dto), { internal: true, attempts: 2 });
    } catch (error) {
      if (error instanceof PartsSearchUpstreamError) {
        if (error.status === 400) throw new BadRequestException(error.message);
        if (error.status !== null && [401, 403, 404, 503].includes(error.status)) {
          throw new ServiceUnavailableException({ code: 'INTERNAL_SEARCH_UNAVAILABLE', message: error.message });
        }
        this.logger.warn(`options search failed: ${error.message}`);
        throw new ServiceUnavailableException({ message: 'PartsBazar360 search is unavailable. Please retry.', degraded: true });
      }
      throw error;
    }

    const stock = user ? await this.omniStock(response, user).catch((error) => {
      this.logger.warn(`Omni Core stock lookup failed: ${(error as Error).message}`);
      return [] as OmniStockRow[];
    }) : [];
    this.mergeOmniStock(response, stock);
    this.applyVisibility(response, dto.includeUnavailable === true);
    void this.logQuery(response, user).catch((error) => this.logger.warn(`parts search log failed: ${(error as Error).message}`));
    return response;
  }

  // ------------------------------------------------------ Omni Core stock

  private async omniStock(response: OptionsResponse, user: User): Promise<OmniStockRow[]> {
    const numbers = new Set<string>(response.query.numbers.map(normalize).filter((n) => n.length >= 5));
    for (const group of response.groups) for (const item of group.items) for (const n of item.numbers ?? []) numbers.add(n);
    if (!numbers.size) return [];
    const orgIds = (await this.userOrgs.listForUser(user.id)).map((org) => org.organizationId);
    if (!orgIds.length) return [];
    const rows: Array<{
      id: string;
      sku: string;
      title: string | null;
      image_url: string | null;
      sourcing_mode: string;
      mpn: string | null;
      oem_part_number: string | null;
      brand: string | null;
      warehouse: string | null;
      available: string | number | null;
    }> = await this.dataSource.query(
      `SELECT ii.id, ii.sku, coalesce(ii.title, cp.title) AS title, coalesce(ii.image_url, cp.image_urls[1]) AS image_url,
              ii.sourcing_mode, cp.mpn, cp.oem_part_number, cp.brand, w.name AS warehouse,
              sum(greatest(coalesce(sl.on_hand, 0) - coalesce(sl.reserved, 0) - coalesce(sl.damaged, 0), 0)) AS available
         FROM inventory_items ii
         JOIN catalog_products cp ON cp.id = ii.catalog_product_id
         LEFT JOIN stock_levels sl ON sl.inventory_item_id = ii.id
         LEFT JOIN warehouses w ON w.id = sl.warehouse_id AND w.active AND w.is_sellable
        WHERE ii.vertical = 'automotive'
          AND ii.organization_id = ANY($1::uuid[])
          AND coalesce(ii.status, 'active') = 'active'
          AND (regexp_replace(upper(coalesce(cp.mpn, '')), '[^A-Z0-9]', '', 'g') = ANY($2::text[])
               OR regexp_replace(upper(coalesce(cp.oem_part_number, '')), '[^A-Z0-9]', '', 'g') = ANY($2::text[]))
        GROUP BY ii.id, cp.id, w.name
        LIMIT 500`,
      [orgIds, [...numbers]],
    );
    const byItem = new Map<string, OmniStockRow>();
    for (const row of rows) {
      const existing =
        byItem.get(row.id) ??
        ({
          inventoryItemId: row.id,
          sku: row.sku,
          title: row.title,
          imageUrl: row.image_url,
          sourcingMode: row.sourcing_mode,
          mpn: row.mpn,
          oemPartNumber: row.oem_part_number,
          brand: row.brand,
          numbers: [...new Set([normalize(row.mpn), normalize(row.oem_part_number)].filter((n) => n.length >= 3))],
          warehouses: [],
          available: 0,
        } as OmniStockRow);
      const available = Number(row.available ?? 0);
      if (row.warehouse && available > 0) existing.warehouses.push({ name: row.warehouse, available });
      existing.available += available;
      byItem.set(row.id, existing);
    }
    return [...byItem.values()];
  }

  /**
   * Omni Core's own stock is its own entry: one row per inventory item, in an
   * "In our warehouse" group, labelled by how it matches the query. PartsBazar360
   * rows that share a number get an informational badge only — our stock never
   * makes another seller's ended listing look sellable.
   */
  private mergeOmniStock(response: OptionsResponse, rows: OmniStockRow[]): void {
    const queryNumbers = new Set(response.query.numbers.map(normalize));
    const sellable = rows.filter((row) => row.available > 0 || ['on_demand', 'hybrid'].includes(row.sourcingMode));
    const linkedTo = new Map<string, string>();
    for (const group of response.groups) {
      for (const item of group.items) {
        const numbers = new Set(item.numbers ?? []);
        const matches = sellable.filter((row) => row.numbers.some((n) => numbers.has(n)));
        if (!matches.length) continue;
        for (const row of matches) if (!linkedTo.has(row.inventoryItemId)) linkedTo.set(row.inventoryItemId, String((item as { title?: string }).title ?? item.partId));
        item.omniStock = {
          available: matches.reduce((sum, row) => sum + row.available, 0),
          canSource: matches.some((row) => row.available <= 0),
          items: matches,
        };
      }
    }
    if (sellable.length) {
      response.groups.unshift({
        key: 'omni_core_stock',
        label: 'In our warehouse (Omni Core)',
        total: sellable.length,
        hiddenUnavailable: 0,
        collapsedByDefault: false,
        items: sellable.map((row) => {
          const exact = row.numbers.some((n) => queryNumbers.has(n));
          const via = linkedTo.get(row.inventoryItemId);
          return {
            partId: `omni:${row.inventoryItemId}`,
            title: row.title ?? row.sku,
            brand: row.brand,
            manufacturerPartNumber: row.mpn ?? row.oemPartNumber,
            image: row.imageUrl,
            imageCount: row.imageUrl ? 1 : 0,
            numbers: row.numbers,
            publicUrl: null,
            match: {
              relation: 'omni_core',
              label: exact ? 'Exact number' : 'Same number as a listed equivalent',
              matchedNumber: row.mpn ?? row.oemPartNumber,
              trail: [],
              note: exact ? `SKU ${row.sku}` : `SKU ${row.sku} · same number as ${via ?? 'an equivalent above'}`,
            },
            fitment: { verdict: null, reason: null, evidence: [], documented: null },
            availability: {
              status: row.available > 0 ? 'in_stock' : 'can_source',
              totalQuantity: row.available,
              sellableOffers: 0,
              sellerCount: 0,
              priceMin: null,
              priceMax: null,
              currency: null,
              bestCondition: null,
              locations: row.warehouses.map((w) => ({ warehouse: w.name, location: null, quantity: w.available, seller: 'Omni Core' })),
              leadTimeDays: null,
            },
            offers: [],
            omniStock: { available: row.available, canSource: row.available <= 0, items: [row] },
            relevanceRank: 0,
          } as OptionItem;
        }),
      });
    }
    const omniInStock = sellable.filter((row) => row.available > 0).length;
    response.omniStock = { inStockItems: omniInStock, items: sellable.length };
    response.summary.omniInStock = omniInStock;
    if (omniInStock) {
      response.summary.sentence = `${String(response.summary.sentence).replace(/\.$/, '')}, ${omniInStock} in our warehouses.`;
    }
  }

  /** Hide not-available PartsBazar360 parts unless asked (counted per group). */
  private applyVisibility(response: OptionsResponse, includeUnavailable: boolean): void {
    for (const group of response.groups) {
      const all = group.items;
      const visible = includeUnavailable ? all : all.filter((item) => item.availability.status !== 'not_available');
      group.hiddenUnavailable = all.length - visible.length;
      group.items = visible;
    }
  }

  // ------------------------------------------------------------- events

  private async logQuery(response: OptionsResponse, user?: User): Promise<void> {
    const inStock = Number(response.summary.inStock ?? 0) + Number(response.summary.omniInStock ?? 0);
    const total = Number(response.summary.totalOptions ?? 0) + Number(response.omniStock?.items ?? 0);
    const vehicle: Record<string, unknown> | null = response.vehicle
      ? {
          label: response.vehicle.label,
          make: response.vehicle.make,
          model: response.vehicle.model,
          year: response.vehicle.year,
          engineLitres: response.vehicle.engineLitres ?? null,
        }
      : null;
    await this.events.save(this.events.create({
      type: 'query',
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      query: String(response.query.original ?? '').slice(0, 200),
      numbers: (response.query.numbers ?? []).slice(0, 10),
      vehicle,
      resultCount: total,
      inStockCount: inStock,
      fitsCount: Number(response.summary.inStockFits ?? 0),
      demand: total === 0 || inStock === 0,
      requestRef: response.requestId ?? null,
    }));
  }

  async select(dto: PartsSearchSelectDto, user?: User): Promise<{ ok: true }> {
    await this.events.insert({
      type: 'select',
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      query: dto.query,
      partId: dto.partId,
      requestRef: dto.requestRef ?? null,
      note: dto.action ?? null,
    });
    return { ok: true };
  }

  async request(dto: PartsSearchRequestDto, user?: User): Promise<PartsSearchEvent> {
    const event = this.events.create({
      type: 'request',
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      query: dto.query,
      numbers: (dto.numbers ?? []).map(normalize).filter(Boolean).slice(0, 10),
      vehicle: dto.vehicle ?? null,
      partId: dto.partId ?? null,
      note: dto.note?.trim() || null,
      demand: true,
      status: 'open',
    });
    return this.events.save(event);
  }

  async updateRequest(id: string, status: 'open' | 'done' | 'dismissed', user?: User): Promise<PartsSearchEvent> {
    const event = await this.events.findOne({ where: { id, type: 'request' } });
    if (!event) throw new NotFoundException('Sourcing request not found');
    event.status = status;
    event.updatedBy = user?.id ?? null;
    event.updatedAt = new Date();
    return this.events.save(event);
  }

  /** Searched-but-unavailable report (numbers, queries, vehicles) + requests. */
  async demand(days = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [totals] = await this.dataSource.query(
      `SELECT count(*) FILTER (WHERE type = 'query')::int AS searches,
              count(*) FILTER (WHERE type = 'query' AND demand)::int AS unmet,
              count(*) FILTER (WHERE type = 'request')::int AS requests,
              count(*) FILTER (WHERE type = 'request' AND status = 'open')::int AS open_requests
         FROM parts_search_events WHERE created_at >= $1`,
      [since],
    );
    const topNumbers = await this.dataSource.query(
      `SELECT n AS number, count(*)::int AS searches, count(DISTINCT user_id)::int AS users, max(created_at) AS "lastAt"
         FROM parts_search_events, unnest(numbers) n
        WHERE type IN ('query', 'request') AND demand AND created_at >= $1
        GROUP BY n ORDER BY searches DESC, "lastAt" DESC LIMIT 50`,
      [since],
    );
    const topQueries = await this.dataSource.query(
      `SELECT lower(query) AS query, count(*)::int AS searches, max(created_at) AS "lastAt",
              bool_or(result_count = 0) AS "zeroResults"
         FROM parts_search_events
        WHERE type = 'query' AND demand AND cardinality(numbers) = 0 AND query <> '' AND created_at >= $1
        GROUP BY lower(query) ORDER BY searches DESC, "lastAt" DESC LIMIT 50`,
      [since],
    );
    const topVehicles = await this.dataSource.query(
      `SELECT vehicle->>'label' AS vehicle, count(*)::int AS searches, max(created_at) AS "lastAt"
         FROM parts_search_events
        WHERE type = 'query' AND demand AND vehicle IS NOT NULL AND created_at >= $1
        GROUP BY vehicle->>'label' ORDER BY searches DESC LIMIT 30`,
      [since],
    );
    const requests = await this.events.find({
      where: { type: 'request' },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return {
      days,
      since: since.toISOString(),
      totals: {
        searches: totals?.searches ?? 0,
        unmet: totals?.unmet ?? 0,
        requests: totals?.requests ?? 0,
        openRequests: totals?.open_requests ?? 0,
      },
      topNumbers,
      topQueries,
      topVehicles,
      requests: requests.sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open')),
    };
  }

  // ----------------------------------------------------- vehicles / VIN

  /** PartsBazar360 vehicle hierarchy (public endpoints), cached an hour. */
  async vehicles(path: string): Promise<unknown> {
    const key = `parts-search:v1:vehicles:${path}`;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      /* no cache */
    }
    try {
      const data = await this.client.get<unknown>(`/vehicles${path}`, [], { attempts: 2 });
      void this.redis.set(key, JSON.stringify(data), 'EX', 3600).catch(() => undefined);
      return data;
    } catch (error) {
      if (error instanceof PartsSearchUpstreamError && error.status === 404) throw new NotFoundException('Vehicle not found');
      throw new ServiceUnavailableException('Vehicle list is unavailable. Please retry.');
    }
  }

  /** VIN → year/make/model/engine via NHTSA vPIC; cached 30 days. */
  async decodeVin(vinRaw: string) {
    const vin = vinRaw.trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) throw new BadRequestException('A VIN has 17 characters (no I, O or Q).');
    const key = `parts-search:v1:vin:${vin}`;
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      /* no cache */
    }
    let row: Record<string, string> | undefined;
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      row = ((await res.json()) as { Results?: Array<Record<string, string>> }).Results?.[0];
    } catch (error) {
      throw new ServiceUnavailableException(`VIN decoder is unavailable: ${(error as Error).message}`);
    }
    const year = Number(row?.ModelYear) || null;
    const litres = Number(row?.DisplacementL);
    const result = {
      vin,
      year,
      make: row?.Make ? displayMake(row.Make) : null,
      model: row?.Model || null,
      trim: row?.Trim || null,
      engineLitres: Number.isFinite(litres) && litres > 0 ? Math.round(litres * 10) / 10 : null,
      engine: [row?.DisplacementL ? `${Number(row.DisplacementL).toFixed(1)} L` : null, row?.EngineCylinders ? `${row.EngineCylinders} cyl` : null, row?.FuelTypePrimary || null]
        .filter(Boolean)
        .join(', ') || null,
      decoded: Boolean(year && row?.Make && row?.Model),
      message: row?.ErrorText && !/^0\b/.test(row.ErrorText) ? row.ErrorText : null,
    };
    if (result.decoded) void this.redis.set(key, JSON.stringify(result), 'EX', 30 * 86_400).catch(() => undefined);
    return result;
  }
}
