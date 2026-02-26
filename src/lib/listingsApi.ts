import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BulkUpdateResponse,
  CreateListingResponse,
  ListingRecord,
  ListingRecordFull,
  ListingRevision,
  ListingsFacets,
  ListingsQuery,
  ListingsResponse,
  ListingsSummary,
  ListingStatus,
  PatchStatusResponse,
  RevisionsResponse,
  UpdateListingResponse,
} from '../types/listings';

const API_BASE = '/api';

/* ── Helpers ──────────────────────────────────────────────── */

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
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
    (err as ApiError).status = res.status;
    (err as ApiError).body = errorBody;
    throw err;
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof Error && 'status' in err;
}

/* ── useListings ──────────────────────────────────────────── */

export function useListings(query: ListingsQuery) {
  const [data, setData] = useState<ListingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchListings = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(query as Record<string, string | number | undefined>);
      const res = await fetch(`${API_BASE}/listings${qs}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = (await res.json()) as ListingsResponse;
      if (!controller.signal.aborted) {
        setData(json);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchListings();
    return () => abortRef.current?.abort();
  }, [fetchListings]);

  return { data, loading, error, refetch: fetchListings };
}

/* ── useListingDetail ─────────────────────────────────────── */

export function useListingDetail(id: string | null) {
  const [data, setData] = useState<ListingRecordFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch<ListingRecordFull>(`/listings/${id}`)
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return { data, loading, error };
}

/* ── useFacets ────────────────────────────────────────────── */

export function useFacets() {
  const [data, setData] = useState<ListingsFacets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ListingsFacets>('/listings/facets')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

/* ── useSummary ───────────────────────────────────────────── */

export function useSummary() {
  const [data, setData] = useState<ListingsSummary | null>(null);

  useEffect(() => {
    apiFetch<ListingsSummary>('/listings/summary')
      .then(setData)
      .catch(() => {});
  }, []);

  return data;
}

/* ── Image helpers ────────────────────────────────────────── */

/** eBay image URLs are pipe-separated. Returns the first one. */
export function getFirstImageUrl(itemPhotoUrl: string | null | undefined): string | null {
  if (!itemPhotoUrl) return null;
  const first = itemPhotoUrl.split('|')[0]?.trim();
  return first || null;
}

/** Returns all image URLs from a pipe-separated string. */
export function getAllImageUrls(itemPhotoUrl: string | null | undefined): string[] {
  if (!itemPhotoUrl) return [];
  return itemPhotoUrl.split('|').map((u) => u.trim()).filter(Boolean);
}

/** Re-export types for convenience */
export type { ListingRecord, ListingRecordFull, ListingsFacets, ListingsQuery, ListingsResponse, ListingsSummary };

/* ── CRUD Operations ──────────────────────────────────────── */

/** Create a new listing (POST /api/listings) */
export async function createListing(
  data: Partial<ListingRecordFull> & { status?: 'draft' | 'ready' },
): Promise<CreateListingResponse> {
  return apiMutate<CreateListingResponse>('/listings', 'POST', data);
}

/** Update an existing listing with optimistic locking (PUT /api/listings/:id) */
export async function updateListing(
  id: string,
  data: Partial<ListingRecordFull> & { version: number },
): Promise<UpdateListingResponse> {
  return apiMutate<UpdateListingResponse>(`/listings/${id}`, 'PUT', data);
}

/** Change listing status (PATCH /api/listings/:id/status) */
export async function patchListingStatus(
  id: string,
  status: ListingStatus,
  reason?: string,
): Promise<PatchStatusResponse> {
  return apiMutate<PatchStatusResponse>(`/listings/${id}/status`, 'PATCH', { status, reason });
}

/** Soft-delete a listing (DELETE /api/listings/:id) */
export async function deleteListing(id: string): Promise<void> {
  return apiMutate<void>(`/listings/${id}`, 'DELETE');
}

/** Restore a soft-deleted listing (POST /api/listings/:id/restore) */
export async function restoreListing(id: string): Promise<{ listing: ListingRecordFull }> {
  return apiMutate<{ listing: ListingRecordFull }>(`/listings/${id}/restore`, 'POST');
}

/** Bulk update listings (POST /api/listings/bulk) */
export async function bulkUpdateListings(
  ids: string[],
  changes: Partial<ListingRecordFull>,
): Promise<BulkUpdateResponse> {
  return apiMutate<BulkUpdateResponse>('/listings/bulk', 'POST', { ids, changes });
}

/** Fetch revision history for a listing */
export async function fetchRevisions(
  id: string,
  limit = 20,
  offset = 0,
): Promise<RevisionsResponse> {
  return apiFetch<RevisionsResponse>(`/listings/${id}/revisions?limit=${limit}&offset=${offset}`);
}

/* ── useRevisions Hook ────────────────────────────────────── */

export function useRevisions(id: string | null, limit = 20) {
  const [data, setData] = useState<ListingRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRevisions(id, limit)
      .then((res) => { if (!cancelled) setData(res.revisions); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, limit]);

  return { data, loading, error };
}
