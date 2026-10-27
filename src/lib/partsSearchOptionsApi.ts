/**
 * partsSearchOptionsApi.ts — "every sellable option" search for staff
 * (/api/parts-search/options), sourcing requests, demand report, vehicle
 * picker and VIN decode. Requires the internal PartsBazar360 key on the
 * server; without it `/options` answers 503 INTERNAL_SEARCH_UNAVAILABLE and the
 * portal falls back to the buyer-view results.
 */
import { fetchDownloadResponse, fetchWithAuth } from './authApi';
import type { InternalOffer } from './partsSearchApi';

const base = '/api/parts-search';

/* ── High-quality image downloads ─────────────────────────────────── */

export interface PartImage {
  index: number;
  /** Highest-quality browser preview (original / eBay 1600 px). */
  previewUrl: string;
  filename: string;
  origin: 'omni-core-storage' | 'ebay' | 'partsbazar360' | 'web';
}

export function listPartImages(partId: string, signal?: AbortSignal) {
  return fetchWithAuth<{ partId: string; label: string; images: PartImage[] }>(`${base}/parts/${encodeURIComponent(partId)}/images`, { signal });
}

/** Save an authenticated download using the server's Content-Disposition name. */
async function saveDownload(url: string, fallbackName: string): Promise<void> {
  const res = await fetchDownloadResponse(url);
  const disposition = res.headers.get('content-disposition') ?? '';
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName;
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

export function downloadPartImage(partId: string, index: number) {
  return saveDownload(`${base}/parts/${encodeURIComponent(partId)}/images/${index}/download`, `part-image-${index + 1}`);
}

export function downloadPartImagesZip(partId: string) {
  return saveDownload(`${base}/parts/${encodeURIComponent(partId)}/images/zip`, 'part-images.zip');
}

/** "In our warehouse" rows carry ids like `omni:<inventoryItemId>`. */
export function downloadOmniImage(partId: string) {
  return saveDownload(`${base}/omni/${encodeURIComponent(partId.replace(/^omni:/, ''))}/image/download`, 'omni-core-part');
}

export type OptionRelation =
  | 'exact'
  | 'superseded'
  | 'oem_equivalent'
  | 'aftermarket_equivalent'
  | 'possible'
  | 'text'
  | 'omni_core';
export type OptionVerdict = 'fits' | 'likely' | 'unverified' | 'does_not_fit' | 'universal';
export type OptionAvailability = 'in_stock' | 'can_source' | 'not_available';
export type OptionDroppable = 'number' | 'make' | 'model' | 'year' | 'side' | 'position';

export interface OptionTrailStep {
  number: string;
  relation: string;
  partId: string;
  partLabel: string;
  source: string;
  text: string;
}

export interface OmniStockRow {
  inventoryItemId: string;
  sku: string;
  title: string | null;
  sourcingMode: string;
  warehouses: Array<{ name: string; available: number }>;
  available: number;
}

export interface OptionItem {
  partId: string;
  title: string;
  brand: string | null;
  partSource?: string | null;
  qualityTier?: string | null;
  category?: string | null;
  partType?: string | null;
  manufacturerPartNumber: string | null;
  image: string | null;
  imageCount: number;
  publicUrl: string | null;
  numbers: string[];
  match: { relation: OptionRelation; label: string; matchedNumber: string | null; trail: OptionTrailStep[]; note: string | null; asked?: boolean };
  fitment: {
    verdict: OptionVerdict | null;
    reason: string | null;
    evidence: Array<{ type: string; source: string; strength: 'strong' | 'medium' }>;
    documented: string | null;
  };
  availability: {
    status: OptionAvailability;
    totalQuantity: number;
    sellableOffers: number;
    sellerCount: number;
    priceMin: number | null;
    priceMax: number | null;
    currency: string | null;
    bestCondition: string | null;
    locations: Array<{ warehouse: string; location: string | null; quantity: number; seller: string }>;
    leadTimeDays: number | null;
  };
  offers: InternalOffer[];
  omniStock?: { available: number; canSource: boolean; items: OmniStockRow[] };
}

export interface OptionGroup {
  key: string;
  label: string;
  total: number;
  hiddenUnavailable: number;
  collapsedByDefault: boolean;
  items: OptionItem[];
}

export interface OptionsResponse {
  requestId: string;
  mode: 'number' | 'text' | 'empty';
  query: {
    original: string;
    effective: string;
    numbers: string[];
    interpreted: Array<{ key: OptionDroppable | 'engine'; label: string; value: string }>;
    dropped: OptionDroppable[];
  };
  vehicle: {
    label: string;
    make: string;
    model: string;
    year: number;
    engineLitres?: number;
    exactConfigId?: string;
    source: 'selected' | 'query';
    configCount: number;
    engines: number[];
  } | null;
  summary: {
    totalOptions: number;
    inStock: number;
    inStockFits: number;
    likely: number;
    canSource: number;
    notAvailable: number;
    possibleEquivalents: number;
    excludedOtherMake: number;
    omniInStock?: number;
    sentence: string;
  };
  groups: OptionGroup[];
  didYouMean: Array<{ number: string; parts: number }>;
  pagination?: { page: number; pageSize: number; totalResults: number; totalPages: number };
  corrections: Array<{ type: string; message: string }>;
  meta: { tookMs: number; checkedAt: string; index: string };
}

/** Vehicle selection carried in the results URL. */
export interface VehicleSelection {
  vehicleConfigId?: string;
  makeId?: string;
  modelId?: string;
  make?: string;
  model?: string;
  year?: number;
  engineLitres?: number;
  /** Display only. */
  label?: string;
  vin?: string;
}

export interface OptionsParams {
  q?: string;
  vehicle?: VehicleSelection;
  drop?: OptionDroppable[];
  includeUnavailable?: boolean;
  page?: number;
}

const VEHICLE_KEYS = ['vehicleConfigId', 'makeId', 'modelId', 'make', 'model', 'year', 'engineLitres', 'label', 'vin'] as const;
const urlKey = (key: (typeof VEHICLE_KEYS)[number]) => (key === 'label' ? 'vlabel' : key);

export function optionsParamsFromUrl(search: URLSearchParams): OptionsParams {
  const vehicle: Record<string, unknown> = {};
  for (const key of VEHICLE_KEYS) {
    const value = search.get(urlKey(key));
    if (!value) continue;
    if (key === 'year' || key === 'engineLitres') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) vehicle[key] = parsed;
    } else vehicle[key] = value;
  }
  const drop = (search.get('drop') ?? '').split(',').filter(Boolean) as OptionDroppable[];
  const page = Number(search.get('page'));
  return {
    q: search.get('q')?.trim() || undefined,
    vehicle: Object.keys(vehicle).length ? (vehicle as VehicleSelection) : undefined,
    drop: drop.length ? drop : undefined,
    includeUnavailable: search.get('all') === '1' || undefined,
    page: Number.isFinite(page) && page > 1 ? page : undefined,
  };
}

export function optionsPath(params: OptionsParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  for (const key of VEHICLE_KEYS) {
    const value = params.vehicle?.[key];
    if (value !== undefined && value !== null && value !== '') query.set(urlKey(key), String(value));
  }
  if (params.drop?.length) query.set('drop', params.drop.join(','));
  if (params.includeUnavailable) query.set('all', '1');
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const text = query.toString();
  return `/parts-search/results${text ? `?${text}` : ''}`;
}

export function searchOptions(params: OptionsParams, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  const v = params.vehicle;
  if (v?.vehicleConfigId) query.set('vehicleConfigId', v.vehicleConfigId);
  if (v?.makeId) query.set('makeId', v.makeId);
  if (v?.modelId) query.set('modelId', v.modelId);
  if (!v?.makeId && v?.make) query.set('make', v.make);
  if (!v?.modelId && v?.model) query.set('model', v.model);
  if (v?.year) query.set('year', String(v.year));
  if (v?.engineLitres) query.set('engineLitres', String(v.engineLitres));
  if (params.drop?.length) query.set('drop', params.drop.join(','));
  if (params.includeUnavailable) query.set('includeUnavailable', 'true');
  if (params.page) query.set('page', String(params.page));
  return fetchWithAuth<OptionsResponse>(`${base}/options?${query.toString()}`, { signal });
}

/** True when the server has no internal key / PartsBazar360 endpoint yet. */
export function isInternalUnavailable(error: unknown): boolean {
  const body = (error as { responseBody?: { code?: string; message?: unknown } } | null)?.responseBody;
  return body?.code === 'INTERNAL_SEARCH_UNAVAILABLE' || /INTERNAL_SEARCH_UNAVAILABLE|not configured/i.test(String((error as Error)?.message ?? ''));
}

/** Fire-and-forget audit of what staff picked from the results. */
export function logSelection(event: { query: string; partId: string; requestRef?: string; action: 'open' | 'copy' | 'external' | 'quote' }): void {
  if (event.partId.startsWith('omni:')) return;
  void fetchWithAuth(`${base}/events/select`, { method: 'POST', body: JSON.stringify(event) }).catch(() => undefined);
}

export interface SourcingRequest {
  id: string;
  createdAt: string;
  userEmail: string | null;
  query: string;
  numbers: string[];
  vehicle: Record<string, unknown> | null;
  partId: string | null;
  note: string | null;
  status: 'open' | 'done' | 'dismissed' | null;
}

export function createSourcingRequest(body: { query: string; numbers?: string[]; vehicle?: Record<string, unknown>; partId?: string; note?: string }) {
  return fetchWithAuth<SourcingRequest>(`${base}/requests`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateSourcingRequest(id: string, status: 'open' | 'done' | 'dismissed') {
  return fetchWithAuth<SourcingRequest>(`${base}/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export interface DemandReport {
  days: number;
  since: string;
  totals: { searches: number; unmet: number; requests: number; openRequests: number };
  topNumbers: Array<{ number: string; searches: number; users: number; lastAt: string }>;
  topQueries: Array<{ query: string; searches: number; lastAt: string; zeroResults: boolean }>;
  topVehicles: Array<{ vehicle: string; searches: number; lastAt: string }>;
  requests: SourcingRequest[];
}

export function getDemandReport(days: number, signal?: AbortSignal) {
  return fetchWithAuth<DemandReport>(`${base}/demand?days=${days}`, { signal });
}

export interface VehicleOption {
  id: string;
  name: string;
  startYear?: number | null;
  endYear?: number | null;
  trim?: string | null;
  engine?: string | null;
  market?: string | null;
}

function unwrap(data: unknown): VehicleOption[] {
  if (Array.isArray(data)) return data as VehicleOption[];
  const obj = data as { data?: unknown; items?: unknown } | null;
  if (Array.isArray(obj?.data)) return obj.data as VehicleOption[];
  if (Array.isArray(obj?.items)) return obj.items as VehicleOption[];
  return [];
}

export const vehicleApi = {
  makes: (signal?: AbortSignal) => fetchWithAuth<unknown>(`${base}/vehicles/makes`, { signal }).then(unwrap),
  models: (makeId: string, signal?: AbortSignal) =>
    fetchWithAuth<unknown>(`${base}/vehicles/makes/${encodeURIComponent(makeId)}/models`, { signal }).then(unwrap),
  generations: (modelId: string, signal?: AbortSignal) =>
    fetchWithAuth<unknown>(`${base}/vehicles/models/${encodeURIComponent(modelId)}/generations`, { signal }).then(unwrap),
  configurations: (generationId: string, signal?: AbortSignal) =>
    fetchWithAuth<unknown>(`${base}/vehicles/generations/${encodeURIComponent(generationId)}/configurations`, { signal }).then(unwrap),
};

export interface VinDecode {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engineLitres: number | null;
  engine: string | null;
  decoded: boolean;
  message: string | null;
}

export function decodeVin(vin: string) {
  return fetchWithAuth<VinDecode>(`${base}/vin/${encodeURIComponent(vin.trim())}`);
}

/** Last vehicle used, per browser (convenience only). */
const VEHICLE_KEY = 'mk_parts_search_vehicle';

export function readLastVehicle(): VehicleSelection | null {
  try {
    const raw = localStorage.getItem(VEHICLE_KEY);
    const value = raw ? (JSON.parse(raw) as VehicleSelection) : null;
    return value && typeof value === 'object' && value.label ? value : null;
  } catch {
    return null;
  }
}

export function rememberVehicle(vehicle: VehicleSelection | null): void {
  try {
    if (vehicle?.label) localStorage.setItem(VEHICLE_KEY, JSON.stringify(vehicle));
  } catch {
    /* storage unavailable */
  }
}

export function vehicleLabel(v: VehicleSelection | undefined | null): string | null {
  if (!v) return null;
  if (v.label) return v.label;
  const parts = [v.year, v.make, v.model].filter(Boolean).join(' ');
  return parts ? `${parts}${v.engineLitres ? ` ${v.engineLitres.toFixed(1)} L` : ''}` : null;
}
