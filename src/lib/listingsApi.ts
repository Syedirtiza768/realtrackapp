import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ListingRecord,
  ListingRecordFull,
  ListingsFacets,
  ListingsQuery,
  ListingsResponse,
  ListingsSummary,
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
