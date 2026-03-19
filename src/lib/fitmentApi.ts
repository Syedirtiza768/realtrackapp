/**
 * fitmentApi — Typed frontend client for Fitment & eBay MVL endpoints.
 *
 * All calls go through `authGet` / `authPost` from @/lib/authApi to
 * inject the JWT token and handle 401 redirects.
 */

import { authGet, authPost, authDelete, fetchWithAuth } from './authApi';
import type { SelectOption } from '../components/ui/SearchableSelect';

const BASE = '/api/fitment';

/* ── Shared types ── */

export interface CompatibilityProperty {
  propertyName: string;
  localizedPropertyName: string;
}

export interface CompatibilityTree {
  categoryId: string;
  categoryTreeId: string;
  properties: CompatibilityProperty[];
}

export interface PropertyValuesResponse {
  options: SelectOption[];
  hasMore: boolean;
}

export interface VinDecodeResult {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  driveType: string | null;
  engineCylinders: string | null;
  engineDisplacementL: string | null;
  fuelType: string | null;
  plantCountry: string | null;
  vehicleType: string | null;
  raw: Record<string, string>;
}

export interface FitmentSelection {
  make: string;
  model: string;
  year: string;
  trim?: string;
  engine?: string;
  notes?: string;
}

export interface EbayCompatibilityEntry {
  compatibilityProperties: Array<{ name: string; value: string }>;
  notes?: string;
}

export interface PartFitmentRow {
  id: string;
  listingId: string;
  makeId: number;
  modelId: number;
  submodelId: number | null;
  yearStart: number;
  yearEnd: number;
  engineId: number | null;
  source: string;
  confidence: number | null;
  verified: boolean;
  verifiedBy: string | null;
  make?: { id: number; name: string };
  model?: { id: number; name: string };
  submodel?: { id: number; name: string };
  engine?: { id: number; name: string };
}

/* ── Reference data (existing backend fitment tables) ── */

export function getMakes(q?: string): Promise<Array<{ id: number; name: string }>> {
  const params = q ? `?q=${encodeURIComponent(q)}` : '';
  return authGet(`${BASE}/makes${params}`);
}

export function getModelsForMake(makeId: number): Promise<Array<{ id: number; name: string }>> {
  return authGet(`${BASE}/makes/${makeId}/models`);
}

export function getSubmodels(modelId: number): Promise<Array<{ id: number; name: string }>> {
  return authGet(`${BASE}/models/${modelId}/submodels`);
}

export function getEngines(q?: string): Promise<Array<{ id: number; name: string }>> {
  const params = q ? `?q=${encodeURIComponent(q)}` : '';
  return authGet(`${BASE}/engines${params}`);
}

/* ── Listing fitment CRUD ── */

export function getListingFitments(listingId: string): Promise<PartFitmentRow[]> {
  return authGet(`${BASE}/listing/${listingId}`);
}

export function addListingFitment(
  listingId: string,
  data: {
    makeId: number;
    modelId: number;
    submodelId?: number;
    yearStart: number;
    yearEnd: number;
    engineId?: number;
    source?: string;
    confidence?: number;
  },
): Promise<PartFitmentRow> {
  return authPost(`${BASE}/listing/${listingId}`, data);
}

export function deleteFitment(fitmentId: string): Promise<void> {
  return authDelete(`${BASE}/${fitmentId}`);
}

export function verifyFitment(fitmentId: string, verified: boolean): Promise<PartFitmentRow> {
  return fetchWithAuth(`${BASE}/${fitmentId}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ verified }),
  });
}

/* ── AI detection ── */

export function detectFitmentFromText(
  text: string,
): Promise<Array<{ make: string; model: string; yearStart: number; yearEnd: number }>> {
  return authPost(`${BASE}/detect`, { text });
}

/* ── eBay MVL (Compatibility) ── */

/**
 * Get ordered compatibility properties for an eBay category.
 * Returns the property names available (Make, Model, Year, Trim, Engine, etc.)
 */
export function getCompatibilityProperties(
  categoryId = '6000',
  treeId?: string,
): Promise<CompatibilityTree> {
  const params = treeId ? `?treeId=${encodeURIComponent(treeId)}` : '';
  return authGet(`${BASE}/compatibility-properties/${categoryId}${params}`);
}

/**
 * Get cascading property values for a given property.
 * Pass parent filters as key-value pairs (e.g. `{ Make: 'Toyota' }` to
 * filter Model values to Toyota models only).
 *
 * Compatible with SearchableSelect's `fetchOptions` signature when curried.
 */
export function getPropertyValues(
  categoryId: string,
  propertyName: string,
  filters: Record<string, string> = {},
  query?: string,
  limit = 50,
  offset = 0,
): Promise<PropertyValuesResponse> {
  const params = new URLSearchParams();

  // Parent filters
  for (const [key, val] of Object.entries(filters)) {
    if (val) params.set(key, val);
  }

  if (query) params.set('q', query);
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  return authGet(`${BASE}/property-values/${categoryId}/${encodeURIComponent(propertyName)}?${params}`);
}

/**
 * Convenience wrapper for eBay Makes (paginated).
 * Returns `{ options, hasMore }` matching SearchableSelect's expected shape.
 */
export function getEbayMakes(
  query?: string,
  limit = 50,
  offset = 0,
  categoryId = '6000',
): Promise<PropertyValuesResponse> {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  params.set('categoryId', categoryId);
  return authGet(`${BASE}/ebay-makes?${params}`);
}

/**
 * Convenience wrapper for eBay Models filtered by Make (paginated).
 * Returns `{ options, hasMore }` matching SearchableSelect's expected shape.
 */
export function getEbayModels(
  make: string,
  query?: string,
  limit = 50,
  offset = 0,
  categoryId = '6000',
): Promise<PropertyValuesResponse> {
  const params = new URLSearchParams();
  params.set('make', make);
  if (query) params.set('q', query);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  params.set('categoryId', categoryId);
  return authGet(`${BASE}/ebay-models?${params}`);
}

/**
 * Convert user fitment selections to eBay-format compatibility JSON.
 */
export function buildCompatibility(
  selections: FitmentSelection[],
): Promise<EbayCompatibilityEntry[]> {
  return authPost(`${BASE}/build-compatibility`, { selections });
}

/* ── VIN Decode ── */

/**
 * Decode a 17-character VIN via NHTSA. Results are DB-cached for 30 days.
 */
export function decodeVin(vin: string): Promise<VinDecodeResult> {
  return authGet(`${BASE}/vin/${encodeURIComponent(vin)}`);
}

/**
 * Decode a VIN and return a pre-mapped eBay compatibility filter object
 * (e.g. `{ Make: 'Toyota', Model: 'Camry', Year: '2024' }`).
 */
export function vinToEbayFilter(vin: string): Promise<Record<string, string>> {
  return authGet(`${BASE}/vin/${encodeURIComponent(vin)}/ebay-filter`);
}
