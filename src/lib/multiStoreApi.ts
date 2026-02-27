/* ─── Multi-Store + AI Enhancement API ──────────────────────
 *  Frontend API layer for multi-store publishing,
 *  AI enhancements, and demo simulation.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Store,
  ListingChannelInstance,
  ListingChannelOverview,
  MultiStorePublishResult,
  AiEnhancement,
  AiEnhancementStats,
  DemoSimulationLog,
  MultiStoreMetrics,
  EnhancementType,
} from '../types/multiStore';

const API = '/api';

/* ── Helpers ──────────────────────────────────────────────── */

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(`API ${res.status}: ${res.statusText}`);
    (err as any).body = errBody;
    throw err;
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

async function putJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/* ── Stores ───────────────────────────────────────────────── */

export async function getStores(connectionId?: string): Promise<Store[]> {
  const qs = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : '';
  return fetchJson<Store[]>(`/stores${qs}`);
}

export async function getStoresByChannel(channel: string): Promise<Store[]> {
  return fetchJson<Store[]>(`/stores/by-channel/${channel}`);
}

export async function createStore(data: {
  connectionId: string;
  channel: string;
  storeName: string;
  storeUrl?: string;
  isPrimary?: boolean;
}): Promise<Store> {
  return postJson<Store>('/stores', data);
}

export async function updateStore(
  storeId: string,
  data: Partial<{ storeName: string; status: string; isPrimary: boolean }>,
): Promise<Store> {
  return putJson<Store>(`/stores/${storeId}`, data);
}

/* ── Listing Channel Instances ────────────────────────────── */

export async function getInstances(filters: {
  listingId?: string;
  storeId?: string;
  channel?: string;
  syncStatus?: string;
}): Promise<ListingChannelInstance[]> {
  const params = new URLSearchParams();
  if (filters.listingId) params.set('listingId', filters.listingId);
  if (filters.storeId) params.set('storeId', filters.storeId);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.syncStatus) params.set('syncStatus', filters.syncStatus);
  const qs = params.toString();
  return fetchJson<ListingChannelInstance[]>(`/stores/instances/list${qs ? `?${qs}` : ''}`);
}

export async function createInstance(data: {
  listingId: string;
  storeId: string;
  overridePrice?: number;
  overrideQuantity?: number;
  overrideTitle?: string;
}): Promise<ListingChannelInstance> {
  return postJson<ListingChannelInstance>('/stores/instances', data);
}

export async function publishInstance(instanceId: string): Promise<ListingChannelInstance> {
  return postJson<ListingChannelInstance>('/stores/instances/publish', { instanceId });
}

export async function bulkPublishInstances(instanceIds: string[]): Promise<{ results: Array<{ instanceId: string; status: string; error?: string }> }> {
  return postJson('/stores/instances/bulk-publish', { instanceIds });
}

export async function endInstance(instanceId: string): Promise<ListingChannelInstance> {
  return postJson<ListingChannelInstance>(`/stores/instances/${instanceId}/end`);
}

// ─── Multi-store publish ───

export async function publishToMultipleStores(
  listingId: string,
  storeIds: string[],
  overrides?: Record<string, { price?: number; quantity?: number; title?: string }>,
): Promise<MultiStorePublishResult> {
  return postJson<MultiStorePublishResult>('/stores/publish-multi-store', {
    listingId,
    storeIds,
    overrides,
  });
}

export async function getListingChannelOverview(listingId: string): Promise<ListingChannelOverview> {
  return fetchJson<ListingChannelOverview>(`/stores/listing/${listingId}/overview`);
}

// ─── Demo simulation ───

export async function getDemoLogs(filters?: {
  channel?: string;
  operationType?: string;
  limit?: number;
}): Promise<{ logs: DemoSimulationLog[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.channel) params.set('channel', filters.channel);
  if (filters?.operationType) params.set('operationType', filters.operationType);
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return fetchJson(`/stores/demo/logs${qs ? `?${qs}` : ''}`);
}

export async function simulateOrder(instanceId: string): Promise<DemoSimulationLog> {
  return postJson<DemoSimulationLog>(`/stores/demo/simulate-order/${instanceId}`);
}

/* ── AI Enhancements ──────────────────────────────────────── */

export async function getAiEnhancements(filters?: {
  listingId?: string;
  enhancementType?: string;
  status?: string;
  limit?: number;
}): Promise<{ items: AiEnhancement[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.listingId) params.set('listingId', filters.listingId);
  if (filters?.enhancementType) params.set('enhancementType', filters.enhancementType);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return fetchJson(`/ai-enhancements${qs ? `?${qs}` : ''}`);
}

export async function getAiEnhancement(id: string): Promise<AiEnhancement> {
  return fetchJson<AiEnhancement>(`/ai-enhancements/${id}`);
}

export async function getListingEnhancements(listingId: string): Promise<AiEnhancement[]> {
  return fetchJson<AiEnhancement[]>(`/ai-enhancements/listing/${listingId}`);
}

export async function requestEnhancement(
  listingId: string,
  enhancementType: EnhancementType,
): Promise<AiEnhancement> {
  return postJson<AiEnhancement>('/ai-enhancements/request', {
    listingId,
    enhancementType,
  });
}

export async function bulkRequestEnhancements(
  listingIds: string[],
  enhancementType: EnhancementType,
): Promise<{ results: Array<{ listingId: string; enhancementId?: string; status: string; error?: string }> }> {
  return postJson('/ai-enhancements/bulk-request', { listingIds, enhancementType });
}

export async function approveEnhancement(id: string): Promise<AiEnhancement> {
  return postJson<AiEnhancement>(`/ai-enhancements/${id}/approve`, {});
}

export async function applyEnhancement(id: string): Promise<{ enhancement: AiEnhancement }> {
  return postJson(`/ai-enhancements/${id}/apply`);
}

export async function rejectEnhancement(id: string, reason: string): Promise<AiEnhancement> {
  return postJson<AiEnhancement>(`/ai-enhancements/${id}/reject`, { reason });
}

export async function getAiStats(): Promise<AiEnhancementStats> {
  return fetchJson<AiEnhancementStats>('/ai-enhancements/stats');
}

/* ── Dashboard Multi-Store Metrics ────────────────────────── */

export async function getMultiStoreMetrics(): Promise<MultiStoreMetrics> {
  return fetchJson<MultiStoreMetrics>('/dashboard/multi-store');
}

/* ── Inventory (reexport for convenience) ─────────────────── */

export async function getInventoryLedger(listingId: string): Promise<{
  ledger: {
    id: string;
    listingId: string;
    quantityTotal: number;
    quantityReserved: number;
    quantityAvailable: number | null;
    lowStockThreshold: number;
    lastReconciledAt: string | null;
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    quantityChange: number;
    quantityBefore: number;
    quantityAfter: number;
    sourceChannel: string | null;
    reason: string | null;
    createdAt: string;
  }>;
}> {
  return fetchJson(`/inventory/${listingId}`);
}

export async function adjustInventory(
  listingId: string,
  change: number,
  reason: string,
): Promise<unknown> {
  return postJson(`/inventory/${listingId}/adjust`, {
    change,
    reason,
    idempotencyKey: `manual:${listingId}:${Date.now()}`,
  });
}

/* ── Hooks ────────────────────────────────────────────────── */

export function useStores(connectionId?: string) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStores(connectionId);
      setStores(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { stores, loading, error, refresh };
}

export function useListingChannelOverview(listingId: string | null) {
  const [overview, setOverview] = useState<ListingChannelOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!listingId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const data = await getListingChannelOverview(listingId);
      if (!ctrl.signal.aborted) {
        setOverview(data);
        setError(null);
      }
    } catch (err: any) {
      if (!ctrl.signal.aborted) setError(err.message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [listingId]);

  useEffect(() => { refresh(); return () => abortRef.current?.abort(); }, [refresh]);

  return { overview, loading, error, refresh };
}

export function useListingEnhancements(listingId: string | null) {
  const [enhancements, setEnhancements] = useState<AiEnhancement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    try {
      const data = await getListingEnhancements(listingId);
      setEnhancements(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { enhancements, loading, error, refresh };
}
