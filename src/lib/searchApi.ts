/* ─── Search API Hooks ─────────────────────────────────────
 *  React hooks for the advanced search engine API.
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

/* ── useSearch ────────────────────────────────────────────── */

export function useSearch(query: SearchQuery) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
  }, [query]);

  useEffect(() => {
    doFetch();
    return () => abortRef.current?.abort();
  }, [doFetch]);

  return { data, loading, error, refetch: doFetch };
}

/* ── useSuggest ───────────────────────────────────────────── */

export function useSuggest(q: string, enabled = true) {
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !q.trim()) {
      setData(null);
      return;
    }

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

    return () => ac.abort();
  }, [q, enabled]);

  return { data, loading };
}

/* ── useDynamicFacets ─────────────────────────────────────── */

export function useDynamicFacets(query: SearchQuery) {
  const [data, setData] = useState<DynamicFacets | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    const q = qs(query as Record<string, string | number | undefined>);
    fetchJson<DynamicFacets>(`/listings/search/facets${q}`, ac.signal)
      .then((json) => { if (!ac.signal.aborted) setData(json); })
      .catch(() => {})
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });

    return () => ac.abort();
  }, [query]);

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
