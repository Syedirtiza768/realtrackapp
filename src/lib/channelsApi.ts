/* ─── Channels API ─────────────────────────────────────────
 *  Frontend API layer for multi-channel publishing.
 *  All buttons wire to real backend endpoints.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ALL_CHANNELS,
  type BulkPublishResponse,
  type ChannelConnection,
  type ChannelKey,
  type ChannelListingInfo,
  type ChannelListingStatus,
  type ChannelOverrides,
  type PartsBazarStatus,
  type PublishResponse,
  type ChannelActionResponse,
  type SkuChannelStatus,
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

/**
 * The backend reports listing_channel_instances.sync_status; the UI speaks in
 * ChannelListingStatus. Without this mapping a synced listing had no badge
 * style at all.
 */
const SYNC_STATUS_TO_UI: Record<string, ChannelListingStatus> = {
  synced: 'active',
  pending: 'publishing',
  publishing: 'publishing',
  error: 'failed',
  ended: 'ended',
  draft: 'draft',
};

/** Get channel listing statuses for a specific SKU */
export async function getListingChannels(listingId: string): Promise<ChannelListingInfo[]> {
  const rows = await fetchJson<Array<Omit<ChannelListingInfo, 'status'> & { status: string }>>(
    `/channels/listings/${listingId}/channels`,
  );
  return rows.map((row) => ({
    ...row,
    status: SYNC_STATUS_TO_UI[row.status] ?? (row.status as ChannelListingStatus),
  }));
}

/* ── Publishing ───────────────────────────────────────────── */

/** Publish a listing to one or more channels */
export async function publishToChannels(
  listingId: string,
  channels: ChannelKey[],
  overrides?: Partial<Record<ChannelKey, ChannelOverrides>>,
  /** Target one specific store when a channel has several. */
  storeId?: string,
): Promise<PublishResponse> {
  return postJson<PublishResponse>('/channels/publish-multi', {
    listingId,
    channels,
    overrides,
    storeId,
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
  storeId?: string,
): Promise<PublishResponse> {
  return postJson<PublishResponse>('/channels/publish-multi', {
    listingId,
    channels: [channel],
    storeId,
  });
}

/** Bulk publish multiple listings to channels */
export async function bulkPublish(
  listingIds: string[],
  channels: ChannelKey[],
  storeId?: string,
): Promise<BulkPublishResponse> {
  return postJson<BulkPublishResponse>('/channels/bulk-publish', {
    listingIds,
    channels,
    storeId,
  });
}

/* ── PartsBazar360 ────────────────────────────────────────── */

/** Is PartsBazar360 publishing configured, and which sellers are linked? */
export async function getPartsBazarStatus(): Promise<PartsBazarStatus> {
  return fetchJson<PartsBazarStatus>('/channels/partsbazar360/status');
}

/** Link a PartsBazar360 seller as a publish destination (verified live). */
export async function connectPartsBazar(input: {
  storeName: string;
  sellerStoreId: string;
}): Promise<{ connectionId: string; storeId: string; seller: { id: string; name: string } | null }> {
  return postJson('/channels/partsbazar360/connect', input);
}

/** Re-check a listing's import state on PartsBazar360. */
export async function refreshPartsBazarListing(listingId: string): Promise<void> {
  await postJson(`/channels/partsbazar360/listings/${listingId}/refresh`);
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

/** Hook: PartsBazar360 configuration and linked sellers */
export function usePartsBazarStatus() {
  const [status, setStatus] = useState<PartsBazarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPartsBazarStatus();
      if (mountedRef.current) setStatus(data);
    } catch {
      if (mountedRef.current) setStatus(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => { mountedRef.current = false; };
  }, [refetch]);

  return { status, loading, refetch };
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
  return ALL_CHANNELS.map((ch) => {
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
