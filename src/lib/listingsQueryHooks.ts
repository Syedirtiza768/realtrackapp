/**
 * React Query hooks for listings API.
 *
 * These provide the same data as the existing useListings/useListingDetail/etc.
 * hooks in listingsApi.ts, but backed by TanStack Query for:
 * - Automatic caching & deduplication
 * - Background refetching
 * - Optimistic updates on mutations
 * - Loading/error state management
 *
 * Gradually migrate components from useListings → useListingsQuery, etc.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type {
  ListingsResponse,
  ListingsQuery,
  ListingRecordFull,
  ListingsFacets,
  ListingsSummary,
  ListingStatus,
  CreateListingResponse,
  UpdateListingResponse,
  PatchStatusResponse,
  BulkUpdateResponse,
  RevisionsResponse,
} from '../types/listings';

const API_BASE = '/api';

/* ── Low-level fetch helpers ── */

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function apiMutate<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const err = new Error(`API ${res.status}: ${res.statusText}`);
    (err as any).status = res.status;
    (err as any).body = errorBody;
    throw err;
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

function buildQs(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/* ── Query Keys ── */

export const listingKeys = {
  all: ['listings'] as const,
  lists: () => [...listingKeys.all, 'list'] as const,
  list: (query: ListingsQuery) => [...listingKeys.lists(), query] as const,
  details: () => [...listingKeys.all, 'detail'] as const,
  detail: (id: string) => [...listingKeys.details(), id] as const,
  facets: () => [...listingKeys.all, 'facets'] as const,
  summary: () => [...listingKeys.all, 'summary'] as const,
  revisions: (id: string) => [...listingKeys.all, 'revisions', id] as const,
};

/* ── Query Hooks ── */

/** Fetch paginated listing list with filters */
export function useListingsQuery(
  query: ListingsQuery,
  options?: Omit<UseQueryOptions<ListingsResponse>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ListingsResponse>({
    queryKey: listingKeys.list(query),
    queryFn: () => {
      const qs = buildQs(query as Record<string, string | number | undefined>);
      return apiFetch<ListingsResponse>(`/listings${qs}`);
    },
    ...options,
  });
}

/** Fetch a single listing by ID */
export function useListingDetailQuery(
  id: string | null,
  options?: Omit<UseQueryOptions<ListingRecordFull>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ListingRecordFull>({
    queryKey: listingKeys.detail(id ?? ''),
    queryFn: () => apiFetch<ListingRecordFull>(`/listings/${id}`),
    enabled: !!id,
    ...options,
  });
}

/** Fetch filter facets */
export function useFacetsQuery(
  options?: Omit<UseQueryOptions<ListingsFacets>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ListingsFacets>({
    queryKey: listingKeys.facets(),
    queryFn: () => apiFetch<ListingsFacets>('/listings/facets'),
    staleTime: 60_000, // facets change less frequently
    ...options,
  });
}

/** Fetch summary stats */
export function useSummaryQuery(
  options?: Omit<UseQueryOptions<ListingsSummary>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<ListingsSummary>({
    queryKey: listingKeys.summary(),
    queryFn: () => apiFetch<ListingsSummary>('/listings/summary'),
    staleTime: 60_000,
    ...options,
  });
}

/** Fetch revision history for a listing */
export function useRevisionsQuery(
  id: string | null,
  limit = 20,
  options?: Omit<UseQueryOptions<RevisionsResponse>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<RevisionsResponse>({
    queryKey: listingKeys.revisions(id ?? ''),
    queryFn: () => apiFetch<RevisionsResponse>(`/listings/${id}/revisions?limit=${limit}`),
    enabled: !!id,
    ...options,
  });
}

/* ── Mutation Hooks ── */

/** Create a new listing */
export function useCreateListingMutation() {
  const qc = useQueryClient();
  return useMutation<CreateListingResponse, Error, Partial<ListingRecordFull> & { status?: 'draft' | 'ready' }>({
    mutationFn: (data) => apiMutate<CreateListingResponse>('/listings', 'POST', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
      qc.invalidateQueries({ queryKey: listingKeys.summary() });
    },
  });
}

/** Update an existing listing */
export function useUpdateListingMutation() {
  const qc = useQueryClient();
  return useMutation<
    UpdateListingResponse,
    Error,
    { id: string; data: Partial<ListingRecordFull> & { version: number } }
  >({
    mutationFn: ({ id, data }) => apiMutate<UpdateListingResponse>(`/listings/${id}`, 'PUT', data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: listingKeys.detail(result.listing.id) });
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
    },
  });
}

/** Change listing status */
export function usePatchStatusMutation() {
  const qc = useQueryClient();
  return useMutation<
    PatchStatusResponse,
    Error,
    { id: string; status: ListingStatus; reason?: string }
  >({
    mutationFn: ({ id, status, reason }) =>
      apiMutate<PatchStatusResponse>(`/listings/${id}/status`, 'PATCH', { status, reason }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: listingKeys.detail(result.listing.id) });
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
    },
  });
}

/** Soft-delete a listing */
export function useDeleteListingMutation() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiMutate<void>(`/listings/${id}`, 'DELETE'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
      qc.invalidateQueries({ queryKey: listingKeys.summary() });
    },
  });
}

/** Restore a soft-deleted listing */
export function useRestoreListingMutation() {
  const qc = useQueryClient();
  return useMutation<{ listing: ListingRecordFull }, Error, string>({
    mutationFn: (id) => apiMutate<{ listing: ListingRecordFull }>(`/listings/${id}/restore`, 'POST'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.lists() });
      qc.invalidateQueries({ queryKey: listingKeys.summary() });
    },
  });
}

/** Bulk update listings */
export function useBulkUpdateMutation() {
  const qc = useQueryClient();
  return useMutation<
    BulkUpdateResponse,
    Error,
    { ids: string[]; changes: Partial<ListingRecordFull> }
  >({
    mutationFn: ({ ids, changes }) =>
      apiMutate<BulkUpdateResponse>('/listings/bulk', 'POST', { ids, changes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}
