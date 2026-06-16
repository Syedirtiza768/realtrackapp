/* ─── Channels API ─────────────────────────────────────────
 *  Frontend API layer for multi-channel publishing.
 *  All buttons wire to real backend endpoints.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChannelConnection,
  ChannelKey,
  ChannelListingInfo,
  ChannelOverrides,
  PublishResponse,
  ChannelActionResponse,
  SkuChannelStatus,
} from '../types/channels';
import { fetchWithAuth } from './authApi';

const API = '/api';

/* ── Helpers ──────────────────────────────────────────────── */

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return fetchWithAuth<T>(`${API}${path}`, { signal });
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return fetchWithAuth<T>(`${API}${path}`, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/* ── Connections (tenant-level) ───────────────────────────── */

/** Get channel connections for the authenticated user. */
export async function getConnections(): Promise<ChannelConnection[]> {
  return fetchJson<ChannelConnection[]>('/channels');
}

/** Start OAuth flow — returns the authorization URL */
export async function getAuthUrl(channel: ChannelKey, state = 'connect:system'): Promise<string> {
  const res = await fetchJson<{ url: string }>(`/channels/${channel}/auth-url?state=${encodeURIComponent(state)}`);
  return res.url;
}

/** Test a channel connection */
export async function testConnection(connectionId: string): Promise<{ ok: boolean; error?: string }> {
  return postJson<{ ok: boolean; error?: string }>(`/channels/${connectionId}/test`);
}

/** Disconnect a channel */
export async function disconnectChannel(connectionId: string): Promise<void> {
  await fetchWithAuth(`${API}/channels/${connectionId}`, { method: 'DELETE' });
}

/* ── Per-SKU channel statuses ─────────────────────────────── */

/** Get channel listing statuses for a specific SKU */
export async function getListingChannels(listingId: string): Promise<ChannelListingInfo[]> {
  return fetchJson<ChannelListingInfo[]>(`/channels/listings/${listingId}/channels`);
}

/* ── Publishing ───────────────────────────────────────────── */

/** Publish a listing to one or more channels */
export async function publishToChannels(
  listingId: string,
  channels: ChannelKey[],
  overrides?: Partial<Record<ChannelKey, ChannelOverrides>>,
): Promise<PublishResponse> {
  return postJson<PublishResponse>('/channels/publish-multi', {
    listingId,
    channels,
    overrides,
  });
}

/** Update a listing on a specific channel */
export async function updateOnChannel(
  listingId: string,
  channel: ChannelKey,
): Promise<ChannelActionResponse> {
  return postJson<ChannelActionResponse>(`/channels/listings/${listingId}/channel/${channel}/update`);
}

/** End/delist a listing from a specific channel */
export async function endOnChannel(
  listingId: string,
  channel: ChannelKey,
): Promise<ChannelActionResponse> {
  return postJson<ChannelActionResponse>(`/channels/listings/${listingId}/channel/${channel}/end`);
}

/** Retry a failed listing on a specific channel */
export async function retryOnChannel(
  listingId: string,
  channel: ChannelKey,
): Promise<PublishResponse> {
  return postJson<PublishResponse>('/channels/publish-multi', {
    listingId,
    channels: [channel],
  });
}

/** Bulk publish multiple listings to channels */
export async function bulkPublish(
  listingIds: string[],
  channels: ChannelKey[],
): Promise<{ queued: number }> {
  return postJson<{ queued: number }>('/channels/bulk-publish', {
    listingIds,
    channels,
  });
}

/* ─── React Hooks ─────────────────────────────────────────── */

/** Hook: get all connections for the current user */
export function useConnections() {
  const [data, setData] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conns = await getConnections();
      if (mountedRef.current) setData(conns);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { connections: data, loading, error, refetch };
}

/** Hook: get per-SKU channel statuses merged with connections */
export function useSkuChannels(listingId: string | null) {
  const [listings, setListings] = useState<ChannelListingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    try {
      const data = await getListingChannels(listingId);
      if (mountedRef.current) setListings(data);
    } catch {
      if (mountedRef.current) setListings([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { listings, loading, refetch };
}

/** Merge connections + per-SKU listings into SkuChannelStatus[] */
export function mergeSkuChannelStatuses(
  connections: ChannelConnection[],
  channelListings: ChannelListingInfo[],
): SkuChannelStatus[] {
  const ALL: ChannelKey[] = ['ebay', 'shopify'];
  return ALL.map((ch) => {
    const conn = connections.find((c) => c.channel === ch && c.status === 'active');
    const listing = channelListings.find((l) => l.channel === ch);
    return {
      channel: ch,
      connected: !!conn,
      connectionId: conn?.id ?? null,
      listing: listing ?? null,
    };
  });
}
