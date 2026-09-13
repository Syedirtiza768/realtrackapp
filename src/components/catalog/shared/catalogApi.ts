import { fetchWithAuth } from '../../../lib/authApi';
import type { CatalogConfig, ProductVertical } from './catalogTypes';
import type { CatalogFacets, CatalogFilters, CatalogItem, CatalogResponse, CatalogSummary } from './catalogTypes';

function queryString(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
}

function withOrganization(path: string, organizationId?: string | null) {
  if (!organizationId) return path;
  return `${path}${path.includes('?') ? '&' : '?'}organizationId=${encodeURIComponent(organizationId)}`;
}

function isoDateBoundary(value: string, dayOffset = 0) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset)).toISOString();
}

export function filtersToParams(filters: CatalogFilters) {
  const params: Record<string, string | number | undefined> = {
    brands: filters.brands.join(','), categories: filters.categories.join(','), conditions: filters.conditions.join(','), types: filters.types.join(','), sourceFiles: filters.sourceFiles.join(','), formats: filters.formats.join(','), locations: filters.locations.join(','), mpns: filters.mpns.join(','), teamIds: filters.teamIds.join(','), marketplaces: filters.marketplaces.join(','), shippingProfiles: filters.shippingProfiles.join(','), stockLevel: filters.stockLevels.join(','), catalogStatus: filters.catalogStatuses.join(','), validationStatuses: filters.validationStatuses.join(','), minPrice: filters.minPrice, maxPrice: filters.maxPrice, hasImage: filters.hasImage ? '1' : undefined, hasPrice: filters.hasPrice ? '1' : undefined, importedFrom: filters.importedFrom ? isoDateBoundary(filters.importedFrom) : undefined, importedTo: filters.importedTo ? isoDateBoundary(filters.importedTo, 1) : undefined,
  };
  if (Object.keys(filters.attributes).length) params.attributes = JSON.stringify(filters.attributes);
  return params;
}

export function paramsToFilters(params: URLSearchParams): Partial<CatalogFilters> {
  const result: Partial<CatalogFilters> = {};
  const arrays: Array<keyof CatalogFilters> = ['brands', 'categories', 'conditions', 'types', 'sourceFiles', 'formats', 'locations', 'mpns', 'teamIds', 'marketplaces', 'shippingProfiles', 'stockLevels', 'catalogStatuses', 'validationStatuses'];
  for (const key of arrays) { const value = params.get(key === 'stockLevels' ? 'stockLevel' : key); if (value) (result as Record<string, unknown>)[key] = value.split(',').filter(Boolean); }
  for (const key of ['minPrice', 'maxPrice', 'importedFrom', 'importedTo'] as const) { const value = params.get(key); if (value) (result as Record<string, unknown>)[key] = key.startsWith('imported') ? value.slice(0, 10) : value; }
  result.hasImage = params.get('hasImage') === '1'; result.hasPrice = params.get('hasPrice') === '1';
  const attributes = params.get('attributes');
  if (attributes) { try { const parsed = JSON.parse(attributes); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) result.attributes = parsed; } catch { /* malformed share links are ignored */ } }
  return result;
}

export function catalogBase(config: CatalogConfig) { return `/api/${config.vertical === 'business_industrial' ? 'business-industrial' : config.vertical}/catalog`; }

export async function getCatalog(config: CatalogConfig, input: { q: string; page: number; pageSize: number; sort: string; filters: CatalogFilters; organizationId?: string | null }, signal?: AbortSignal) {
  const params = queryString({ organizationId: input.organizationId || undefined, q: input.q.trim() || undefined, offset: input.page * input.pageSize, limit: input.pageSize, sort: input.sort, ...filtersToParams(input.filters) });
  return fetchWithAuth<CatalogResponse>(`${catalogBase(config)}/search?${params}`, { signal });
}

export async function getCatalogFacets(config: CatalogConfig, input: { q: string; sort: string; filters: CatalogFilters; organizationId?: string | null }, signal?: AbortSignal) {
  const params = queryString({ organizationId: input.organizationId || undefined, q: input.q.trim() || undefined, sort: input.sort, ...filtersToParams(input.filters) });
  return fetchWithAuth<CatalogFacets>(`${catalogBase(config)}/search/facets?${params}`, { signal });
}

export async function getCatalogSuggestions(config: CatalogConfig, q: string, organizationId?: string | null, signal?: AbortSignal) {
  if (!q.trim()) return { suggestions: [] as Array<{ type: string; value: string; label: string; count: number; score: number }> };
  return fetchWithAuth<{ suggestions: Array<{ type: string; value: string; label: string; count: number; score: number }> }>(`${catalogBase(config)}/search/suggest?${queryString({ organizationId: organizationId || undefined, q: q.trim(), limit: 8 })}`, { signal });
}

export async function getCatalogSummary(config: CatalogConfig, organizationId?: string | null, signal?: AbortSignal) {
  return fetchWithAuth<CatalogSummary>(withOrganization(`${catalogBase(config)}/summary`, organizationId), { signal });
}

export async function getCatalogProduct(config: CatalogConfig, id: string, organizationId?: string | null) { return fetchWithAuth<CatalogItem>(withOrganization(`${catalogBase(config)}/products/${encodeURIComponent(id)}`, organizationId)); }
export async function patchCatalogProduct(config: CatalogConfig, id: string, body: Partial<CatalogItem>, organizationId?: string | null) { return fetchWithAuth<CatalogItem>(withOrganization(`${catalogBase(config)}/products/${encodeURIComponent(id)}`, organizationId), { method: 'PATCH', body: JSON.stringify(body) }); }
export async function bulkCatalog(config: CatalogConfig, action: 'team' | 'policies' | 'delete', body: unknown) { return fetchWithAuth<{ results: Array<{ id: string; success: boolean; error?: string }>; succeeded: number; failed: number }>(`${catalogBase(config)}/bulk/${action}`, { method: 'POST', body: JSON.stringify(body) }); }
export async function downloadCatalogCsv(config: CatalogConfig, query: Record<string, unknown>, productIds?: string[], organizationId?: string | null) {
  const token = localStorage.getItem('mk_auth_token');
  const response = await fetch(`${catalogBase(config)}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query: { ...query, organizationId: organizationId || undefined }, productIds }) });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  return response.blob();
}

export type { ProductVertical };
