import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth } from './authApi';

const API = '/api';

export interface PublishedListingHealthFlag {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface PublishedListing {
  id: string;
  organizationId: string;
  ebayAccountId: string;
  storeId: string;
  marketplaceId: string;
  ebayItemId: string | null;
  offerId: string | null;
  sku: string | null;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  price: string | null;
  currency: string;
  quantityAvailable: number;
  quantitySold: number;
  listingStatus: string;
  listingFormat: string;
  condition: string | null;
  listingUrl: string | null;
  imageUrls: string[];
  itemSpecifics: Record<string, string[]>;
  shippingDetails: Record<string, unknown> | null;
  listingPolicies: Record<string, unknown> | null;
  compatibility: Record<string, unknown> | null;
  performanceMetrics: Record<string, unknown>;
  healthFlags: PublishedListingHealthFlag[];
  location: Record<string, unknown> | null;
  rawEbayResponse: Record<string, unknown> | null;
  accountDisplayName: string | null;
  ebayStartTime: string | null;
  ebayEndTime: string | null;
  ebayLastModifiedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedListingsSummary {
  total: number;
  active: number;
  ended: number;
  outOfStock: number;
  withWarnings: number;
  lastSyncedAt: string | null;
}

export interface PublishedListingsQuery {
  organizationId?: string;
  ebayAccountId?: string;
  storeId?: string;
  marketplaceId?: string;
  status?: string;
  format?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  priceMin?: number;
  priceMax?: number;
  lowStock?: string;
  page?: number;
  limit?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchPublishedListings(query: PublishedListingsQuery = {}) {
  return fetchWithAuth<{
    items: PublishedListing[];
    total: number;
    page: number;
    limit: number;
  }>(`${API}/published-listings${buildQuery(query as Record<string, string | number | undefined>)}`);
}

export async function fetchPublishedListingSummary(organizationId?: string, ebayAccountId?: string) {
  return fetchWithAuth<PublishedListingsSummary>(
    `${API}/published-listings/summary${buildQuery({ organizationId, ebayAccountId })}`,
  );
}

export async function fetchPublishedListing(id: string, organizationId?: string) {
  return fetchWithAuth<PublishedListing>(
    `${API}/published-listings/${id}${buildQuery({ organizationId })}`,
  );
}

export async function syncPublishedListings(body: {
  organizationId?: string;
  ebayAccountId?: string;
  marketplaceId?: string;
}) {
  return fetchWithAuth<{ jobIds: string[]; syncLogIds: string[] }>(
    `${API}/published-listings/sync`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
}

export async function revisePublishedListing(
  id: string,
  body: {
    title?: string;
    description?: string;
    price?: number;
    quantity?: number;
    imageUrls?: string[];
    itemSpecifics?: Record<string, string[]>;
  },
  organizationId?: string,
) {
  return fetchWithAuth<PublishedListing>(
    `${API}/published-listings/${id}${buildQuery({ organizationId })}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
}

export async function endPublishedListing(id: string, organizationId?: string) {
  return fetchWithAuth<PublishedListing>(
    `${API}/published-listings/${id}/end${buildQuery({ organizationId })}`,
    { method: 'POST' },
  );
}

export async function refreshPublishedListing(id: string, organizationId?: string) {
  return fetchWithAuth<PublishedListing>(
    `${API}/published-listings/${id}/refresh${buildQuery({ organizationId })}`,
    { method: 'POST' },
  );
}

export async function bulkPublishedListingsAction(body: {
  organizationId?: string;
  listingIds: string[];
  action: string;
  payload?: Record<string, unknown>;
}) {
  return fetchWithAuth<{ jobId: string; status: string; totalItems: number }>(
    `${API}/published-listings/bulk`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
}

export async function refreshCompetitorPricing(
  id: string,
  organizationId?: string,
) {
  return fetchWithAuth<PublishedListing>(
    `${API}/published-listings/${id}/competitor-pricing${buildQuery({ organizationId })}`,
    { method: 'POST' },
  );
}

export async function refreshAllCompetitorPricing(body: {
  organizationId?: string;
  ebayAccountId?: string;
}) {
  return fetchWithAuth<{ processed?: number; updated: number; skipped: number; accounts?: number }>(
    `${API}/published-listings/competitor-pricing/refresh`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
}

export function usePublishedListings(query: PublishedListingsQuery) {
  return useQuery({
    queryKey: ['published-listings', query],
    queryFn: () => fetchPublishedListings(query),
  });
}

export function usePublishedListingSummary(organizationId?: string, ebayAccountId?: string) {
  return useQuery({
    queryKey: ['published-listings-summary', organizationId, ebayAccountId],
    queryFn: () => fetchPublishedListingSummary(organizationId, ebayAccountId),
  });
}

export function usePublishedListing(id: string, organizationId?: string) {
  return useQuery({
    queryKey: ['published-listing', id, organizationId],
    queryFn: () => fetchPublishedListing(id, organizationId),
    enabled: Boolean(id),
  });
}

export function useSyncPublishedListings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: syncPublishedListings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['published-listings'] });
      qc.invalidateQueries({ queryKey: ['published-listings-summary'] });
    },
  });
}

export function useBulkPublishedListings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkPublishedListingsAction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['published-listings'] });
    },
  });
}
