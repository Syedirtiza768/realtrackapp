/* ─── Search API Hooks ─────────────────────────────────────
 *  React hooks for the advanced search engine API.
 *  Optimized: debouncing, stable refs, abort on unmount.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DynamicFacets,
  ListingDetail,
  SearchQuery,
  SearchResponse,
  SuggestResponse,
} from '../types/search';

const API = '/api';

/* ── Helpers ──────────────────────────────────────────────── */

function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '' && v !== undefined) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** Stable serialization of a query object for dependency tracking */
function stableKey(query: Record<string, unknown>): string {
  const keys = Object.keys(query).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = query[k];
    if (v != null && v !== '' && v !== undefined) parts.push(`${k}=${v}`);
  }
  return parts.join('&');
}

/* ── useSearch ────────────────────────────────────────────── */

export function useSearch(query: SearchQuery) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable key so we only refetch when actual values change
  const queryKey = stableKey(query as Record<string, unknown>);

  const doFetch = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);
    try {
      const q = qs(query as Record<string, string | number | undefined>);
      const json = await fetchJson<SearchResponse>(`/listings/search${q}`, ac.signal);
      if (!ac.signal.aborted) setData(json);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    doFetch();
    return () => abortRef.current?.abort();
  }, [doFetch]);

  return { data, loading, error, refetch: doFetch };
}

/* ── useSuggest (debounced 200ms) ──────────────────────────── */

export function useSuggest(q: string, enabled = true) {
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !q.trim()) {
      setData(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      fetchJson<SuggestResponse>(
        `/listings/search/suggest?q=${encodeURIComponent(q.trim())}&limit=10`,
        ac.signal,
      )
        .then((json) => { if (!ac.signal.aborted) setData(json); })
        .catch(() => {})
        .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [q, enabled]);

  return { data, loading };
}

/* ── useDynamicFacets (debounced 300ms) ──────────────────── */

export function useDynamicFacets(query: SearchQuery) {
  const [data, setData] = useState<DynamicFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable key — only refetch when actual query values change
  const queryKey = stableKey(query as Record<string, unknown>);

  useEffect(() => {
    // Debounce facet requests by 300ms to prevent rapid-fire calls
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      const q = qs(query as Record<string, string | number | undefined>);
      fetchJson<DynamicFacets>(`/listings/search/facets${q}`, ac.signal)
        .then((json) => { if (!ac.signal.aborted) setData(json); })
        .catch(() => {})
        .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return { data, loading };
}

/* ── useListingDetail ─────────────────────────────────────── */

export function useListingDetail(id: string | null) {
  const [data, setData] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    fetchJson<ListingDetail>(`/listings/${id}`)
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { data, loading };
}

/* ── useSummary ───────────────────────────────────────────── */

export function useSummary() {
  const [data, setData] = useState<{ totalRecords: number; uniqueSkus: number; files: number } | null>(null);

  useEffect(() => {
    fetchJson<{ totalRecords: number; uniqueSkus: number; files: number }>('/listings/summary')
      .then(setData)
      .catch(() => {});
  }, []);

  return data;
}

/* ── Image helpers ────────────────────────────────────────── */

export function getFirstImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const first = url.split('|')[0]?.trim();
  return first || null;
}

export function getAllImageUrls(url: string | null | undefined): string[] {
  if (!url) return [];
  return url.split('|').map((u) => u.trim()).filter(Boolean);
}
