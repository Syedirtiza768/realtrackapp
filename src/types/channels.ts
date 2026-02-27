/* ─── Channel Types ────────────────────────────────────────
 *  Types for multi-channel publishing system.
 *  Covers connections, per-SKU channel status, publishing
 *  flow, and validation.
 * ────────────────────────────────────────────────────────── */

/* ── Channel identifiers ──────────────────────────────────── */
export type ChannelKey = 'ebay' | 'shopify';

export const CHANNEL_META: Record<ChannelKey, { label: string; color: string; icon: string }> = {
  ebay:    { label: 'eBay',    color: '#0064D2', icon: '🛒' },
  shopify: { label: 'Shopify', color: '#96BF48', icon: '🟢' },
};

export const ALL_CHANNELS: ChannelKey[] = ['ebay', 'shopify'];

/* ── Connection (tenant-level) ────────────────────────────── */
export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

export interface ChannelConnection {
  id: string;
  channel: ChannelKey;
  accountName: string | null;
  externalAccountId: string | null;
  status: ConnectionStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/* ── Per-SKU channel listing status ───────────────────────── */
export type ChannelListingStatus =
  | 'not_listed'
  | 'draft'
  | 'publishing'
  | 'active'
  | 'failed'
  | 'ended';

export interface ChannelListingInfo {
  id: string;                    // channel_listings.id
  channel: ChannelKey;
  connectionId: string;
  externalId: string;
  externalUrl: string | null;
  status: ChannelListingStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/* ── Per-SKU aggregate (what the UI renders) ─────────────── */
export interface SkuChannelStatus {
  channel: ChannelKey;
  connected: boolean;
  connectionId: string | null;
  listing: ChannelListingInfo | null;   // null = not listed
}

/* ── Publish request / response ───────────────────────────── */
export interface PublishRequest {
  listingId: string;
  channels: ChannelKey[];
  overrides?: Partial<Record<ChannelKey, ChannelOverrides>>;
}

export interface ChannelOverrides {
  price?: number;
  title?: string;
  quantity?: number;
}

export interface PublishResult {
  channel: ChannelKey;
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface PublishResponse {
  results: PublishResult[];
}

/* ── Update / End ─────────────────────────────────────────── */
export interface ChannelActionResponse {
  success: boolean;
  error?: string;
}

/* ── Validation ───────────────────────────────────────────── */
export interface ListingValidation {
  valid: boolean;
  missing: string[];    // e.g. ['title', 'price', 'images']
}

export function validateListingForPublish(listing: {
  title?: string | null;
  startPrice?: string | null;
  itemPhotoUrl?: string | null;
  quantity?: number | string | null;
  categoryId?: string | null;
}): ListingValidation {
  const missing: string[] = [];
  if (!listing.title) missing.push('title');
  if (!listing.startPrice) missing.push('price');
  if (!listing.itemPhotoUrl) missing.push('images');
  if (!listing.quantity) missing.push('quantity');
  if (!listing.categoryId) missing.push('category');
  return { valid: missing.length === 0, missing };
}

/* ── Status helpers ───────────────────────────────────────── */
export function statusLabel(s: ChannelListingStatus): string {
  const map: Record<ChannelListingStatus, string> = {
    not_listed: 'Not Listed',
    draft: 'Draft',
    publishing: 'Publishing',
    active: 'Active',
    failed: 'Failed',
    ended: 'Ended',
  };
  return map[s];
}

export function statusColor(s: ChannelListingStatus): string {
  const map: Record<ChannelListingStatus, string> = {
    not_listed: 'bg-slate-700 text-slate-300',
    draft: 'bg-amber-900/60 text-amber-300',
    publishing: 'bg-blue-900/60 text-blue-300',
    active: 'bg-emerald-900/60 text-emerald-300',
    failed: 'bg-red-900/60 text-red-300',
    ended: 'bg-slate-800 text-slate-400',
  };
  return map[s];
}
