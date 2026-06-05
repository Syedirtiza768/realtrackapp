import type { CatalogMotorsListQuery, CatalogProductsListResponse } from '../types/catalogMotorsFilters';
import { fetchWithAuth } from './authApi';

function toQueryString(q: CatalogMotorsListQuery): string {
  const p = new URLSearchParams();
  const entries = Object.entries(q) as [keyof CatalogMotorsListQuery, unknown][];
  for (const [k, v] of entries) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'boolean') {
      p.set(k, v ? 'true' : 'false');
    } else {
      p.set(k, String(v));
    }
  }
  return p.toString();
}

export async function fetchCatalogProducts(
  query: CatalogMotorsListQuery,
): Promise<CatalogProductsListResponse> {
  const qs = toQueryString(query);
  return fetchWithAuth<CatalogProductsListResponse>(`/api/catalog-products?${qs}`);
}
