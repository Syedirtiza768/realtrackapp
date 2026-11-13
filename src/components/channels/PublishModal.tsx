/* ─── PublishModal ──────────────────────────────────────────
 *  Multi-store publishing modal — destination selection only.
 *  Destinations: eBay stores (handed to CatalogManager, which
 *  shows an inline progress panel) and linked PartsBazar360
 *  sellers (queued directly from here via /channels/bulk-publish;
 *  partsbazar360.com is a push channel, not an eBay store).
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Send,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Store as StoreIcon,
  CheckCircle2,
} from 'lucide-react';
import { getStoresByChannel, getStoreProfiles } from '../../lib/multiStoreApi';
import { listEbayAccounts } from '../../lib/ebayIntegrationsApi';
import { bulkPublish, getPartsBazarStatus } from '../../lib/channelsApi';
import type { SearchItem } from '../../types/search';
import type { Store } from '../../types/multiStore';
import { getAllImageUrls } from '../../lib/listingsApi';
import ProfileSelectors from '../catalog/ProfileSelectors';
import {
  EMPTY_PROFILE_SELECTION,
  defaultProfileSelection,
  type ProfileSelection,
} from '../catalog/profileUtils';
import type { StoreOverrides } from '../catalog/PublishProgressPanel';

/* ── Types ────────────────────────────────────────────────── */

export interface PublishStartParams {
  mode: 'single' | 'bulk';
  organizationId: string;
  listing?: SearchItem;
  listingIds?: string[];
  stores: Store[];
  overrides: Record<string, StoreOverrides>;
  profiles: ProfileSelection;
}

interface SingleProps {
  mode: 'single';
  listing: SearchItem;
  listingIds?: undefined;
}

interface BulkProps {
  mode: 'bulk';
  listing?: undefined;
  listingIds: string[];
}

type Props = (SingleProps | BulkProps) & {
  open: boolean;
  organizationId: string | null;
  onClose: () => void;
  onPublishStart: (params: PublishStartParams) => void;
};

/* ── Validation ───────────────────────────────────────────── */

function validateListing(listing: SearchItem): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!listing.title) missing.push('Title');
  if (!listing.startPrice) missing.push('Price');
  if (!listing.quantity) missing.push('Quantity');
  if (!listing.categoryId) missing.push('eBay Category');
  if (!getAllImageUrls(listing.itemPhotoUrl).length) missing.push('Images');
  return { valid: missing.length === 0, missing };
}

/** Mirrors the hard requirements in backend partsbazar360-listing.mapper.ts
 *  (title, price > 0, at least one image). PartsBazar360 needs no eBay category. */
function validateForPartsBazar(listing: SearchItem): string[] {
  const missing: string[] = [];
  if (!listing.title) missing.push('Title');
  if (!(parseFloat(listing.startPrice ?? '') > 0)) missing.push('Price');
  if (!getAllImageUrls(listing.itemPhotoUrl).length) missing.push('Images');
  return missing;
}

/** bulk-publish errors are "<listingId>@<channel>: <message>"; keep the message. */
function cleanBulkError(error: string): string {
  return error.replace(/^[^@\s]+@partsbazar360:\s*/, '');
}

/* ── Component ────────────────────────────────────────────── */

export default function PublishModal(props: Props) {
  const { open, organizationId, onClose, onPublishStart, mode } = props;
  const listing = mode === 'single' ? props.listing : undefined;
  const listingIds = mode === 'bulk' ? props.listingIds : undefined;

  /* ── eBay stores ─────────────────────────────────────────── */
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['ebay-stores', organizationId],
    queryFn: () => getStoresByChannel('ebay'),
    enabled: open,
    staleTime: 60_000,
  });

  const {
    data: ebayAccounts = [],
    isLoading: accountsLoading,
    isError: accountsError,
  } = useQuery({
    queryKey: ['ebay-accounts', organizationId],
    queryFn: () => listEbayAccounts(organizationId ?? undefined),
    enabled: open && !!organizationId,
    staleTime: 60_000,
  });

  const accountStoreIds = useMemo(
    () => new Set(
      ebayAccounts
        .filter((account) => account.connectionStatus === 'active')
        .map((account) => account.primaryStoreId),
    ),
    [ebayAccounts],
  );
  const activeStores = useMemo(
    () => stores.filter(
      (store) => store.status === 'active' && accountStoreIds.has(store.id),
    ),
    [stores, accountStoreIds],
  );
  const storeScopeLoading = storesLoading || (!!organizationId && accountsLoading);

  /* ── PartsBazar360 sellers (push channel) ────────────────── */
  const { data: partsBazar } = useQuery({
    queryKey: ['partsbazar360-status'],
    queryFn: getPartsBazarStatus,
    enabled: open,
    staleTime: 60_000,
    retry: false,
  });
  const partsBazarStores = useMemo(
    () => (partsBazar?.configured ? partsBazar.stores.filter((s) => s.status === 'active') : []),
    [partsBazar],
  );

  /* ── Local state ─────────────────────────────────────────── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pbSelected, setPbSelected] = useState<Set<string>>(new Set());
  const [pbBusy, setPbBusy] = useState(false);
  const [pbResult, setPbResult] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, StoreOverrides>>({});
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);
  const [profileStoreId, setProfileStoreId] = useState<string>('');

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setPbSelected(new Set());
      setPbBusy(false);
      setPbResult(null);
      setOverrides({});
      setExpandedOverride(null);
      setProfiles(EMPTY_PROFILE_SELECTION);
      setProfileStoreId('');
    }
  }, [open, organizationId]);

  const profileSourceStoreId = useMemo(() => {
    if (profileStoreId) return profileStoreId;
    const selectedStores = activeStores.filter((s) => selected.has(s.id));
    return selectedStores[0]?.id ?? '';
  }, [profileStoreId, activeStores, selected]);

  const profileSourceStore = useMemo(
    () => activeStores.find((s) => s.id === profileSourceStoreId) ?? null,
    [activeStores, profileSourceStoreId],
  );

  const { data: storeProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['store-profiles-publish', profileSourceStoreId],
    queryFn: () => getStoreProfiles(profileSourceStoreId),
    enabled: open && !!profileSourceStoreId,
    staleTime: 60_000,
  });

  const hasNoPolicies = useMemo(() => {
    if (!storeProfiles) return false;
    return (
      (storeProfiles.shippingProfiles?.length ?? 0) +
      (storeProfiles.returnProfiles?.length ?? 0) +
      (storeProfiles.paymentProfiles?.length ?? 0)
    ) === 0;
  }, [storeProfiles]);

  useEffect(() => {
    if (!storeProfiles || !profileSourceStore) return;
    const listingProfiles =
      mode === 'single' && listing
        ? {
            shippingProfileName: (listing as SearchItem & { shippingProfileName?: string | null }).shippingProfileName,
            returnProfileName: (listing as SearchItem & { returnProfileName?: string | null }).returnProfileName,
            paymentProfileName: (listing as SearchItem & { paymentProfileName?: string | null }).paymentProfileName,
          }
        : null;
    setProfiles(defaultProfileSelection(storeProfiles, profileSourceStore, listingProfiles));
  }, [storeProfiles, profileSourceStore, mode, listing]);

  /* ── Validation (single mode only) ─────────────────────── */
  const validation = useMemo(() => {
    if (!listing) return { valid: true, missing: [] as string[] };
    return validateListing(listing);
  }, [listing]);
  const pbMissing = useMemo(
    () => (listing ? validateForPartsBazar(listing) : []),
    [listing],
  );
  // eBay-only gaps (e.g. category) are irrelevant when only PartsBazar360 is picked.
  const showEbayWarning =
    !validation.valid && (selected.size > 0 || (pbSelected.size === 0 && !pbResult?.ok));
  const totalSelected = selected.size + pbSelected.size;

  const togglePartsBazar = useCallback((storeId: string) => {
    setPbResult(null);
    setPbSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }, []);

  /* ── Toggle store selection ─────────────────────────────── */
  const toggleStore = useCallback((storeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(activeStores.map((s) => s.id)));
  }, [activeStores]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  /* ── Override helpers ───────────────────────────────────── */
  const setOverride = useCallback(
    (storeId: string, field: keyof StoreOverrides, value: string) => {
      setOverrides((prev) => {
        const current = prev[storeId] ?? {};
        let parsed: string | number | undefined;
        if (value === '') {
          parsed = undefined;
        } else if (field === 'quantity') {
          parsed = parseInt(value, 10);
        } else if (field === 'price') {
          parsed = parseFloat(value);
        } else {
          parsed = value;
        }
        return { ...prev, [storeId]: { ...current, [field]: parsed } };
      });
    },
    [],
  );

  /* ── Handler: hand off to parent ────────────────────────── */
  const handlePublish = useCallback(async () => {
    if (!organizationId || totalSelected === 0 || pbBusy) return;

    // PartsBazar360 first: it only queues jobs, so it returns quickly and its
    // outcome can be shown here before the eBay progress panel takes over.
    if (pbSelected.size > 0) {
      const ids = mode === 'single' ? (listing ? [listing.id] : []) : listingIds ?? [];
      const queued: string[] = [];
      const failures: string[] = [];
      setPbBusy(true);
      setPbResult(null);
      for (const store of partsBazarStores.filter((s) => pbSelected.has(s.storeId))) {
        try {
          const res = await bulkPublish(ids, ['partsbazar360'], store.storeId);
          if (res.enqueued > 0) {
            queued.push(
              mode === 'single'
                ? `Queued on ${store.storeName}.`
                : `Queued ${res.enqueued} of ${ids.length} on ${store.storeName}.`,
            );
          }
          for (const e of res.errors.slice(0, 5)) failures.push(`${store.storeName}: ${cleanBulkError(e)}`);
          if (res.errors.length > 5) failures.push(`${store.storeName}: …and ${res.errors.length - 5} more`);
        } catch (err) {
          failures.push(`${store.storeName}: ${err instanceof Error ? err.message : 'Could not queue the publish'}`);
        }
      }
      setPbBusy(false);
      const ok = failures.length === 0;
      setPbResult({
        ok,
        lines: [
          ...queued,
          ...(queued.length ? ['The import finishes in the background — check the listing’s Channels panel for the result.'] : []),
          ...failures,
        ],
      });
      if (ok) setPbSelected(new Set());
      // Stop before eBay if PartsBazar360 had problems so the user sees them.
      if (!ok || selected.size === 0) return;
    }

    if (selected.size === 0) return;
    const selectedStores = activeStores.filter((s) => selected.has(s.id));
    onPublishStart({
      mode,
      organizationId,
      listing,
      listingIds,
      stores: selectedStores,
      overrides,
      profiles,
    });
  }, [selected, pbSelected, pbBusy, totalSelected, partsBazarStores, activeStores, mode, listing, listingIds, overrides, profiles, organizationId, onPublishStart]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-blue-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {mode === 'bulk'
                ? `Publish ${listingIds?.length ?? 0} Listings${partsBazarStores.length ? '' : ' to eBay'}`
                : partsBazarStores.length ? 'Publish to Stores' : 'Publish to eBay Stores'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 p-1 rounded-lg hover:bg-slate-100 dark:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Listing info (single mode) */}
          {listing && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-600 dark:text-slate-200 font-medium truncate">
                  {listing.title ?? 'Untitled'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {listing.customLabelSku ?? listing.id}
                </p>
              </div>
              {listing.startPrice && (
                <span className="text-sm font-bold text-slate-600 dark:text-slate-200">
                  ${parseFloat(listing.startPrice).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Validation warnings */}
          {showEbayWarning && (
            <div className="border border-amber-800/60 bg-amber-950/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-300 font-medium">
                  Missing recommended fields{partsBazarStores.length ? ' for eBay' : ''}
                </p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  {validation.missing.join(', ')}
                </p>
              </div>
            </div>
          )}
          {pbSelected.size > 0 && pbMissing.length > 0 && (
            <div role="alert" className="border border-red-800/60 bg-red-950/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-300 font-medium">PartsBazar360 will reject this listing</p>
                <p className="text-xs text-red-400/70 mt-0.5">Missing: {pbMissing.join(', ')}</p>
              </div>
            </div>
          )}

          {/* PartsBazar360 sellers */}
          {partsBazarStores.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                PartsBazar360.com
              </p>
              {partsBazarStores.map((store) => {
                const isChecked = pbSelected.has(store.storeId);
                return (
                  <button
                    key={store.storeId}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => togglePartsBazar(store.storeId)}
                    disabled={pbBusy}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isChecked
                        ? 'border-teal-600/60 bg-teal-50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isChecked ? 'bg-teal-600 border-teal-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isChecked && (
                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white">
                          <path d="M3.5 6.5L5 8l3.5-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </svg>
                      )}
                    </div>
                    <StoreIcon size={14} className="text-teal-500 shrink-0" />
                    <span className="flex-1 text-left text-sm text-slate-600 dark:text-slate-200 font-medium truncate">
                      {store.storeName}
                    </span>
                    <span className="text-xs text-emerald-500 shrink-0">Linked</span>
                  </button>
                );
              })}
            </div>
          )}

          {pbBusy && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Queuing on PartsBazar360…
            </div>
          )}
          {pbResult && (
            <div
              role={pbResult.ok ? 'status' : 'alert'}
              className={`rounded-lg border p-3 text-xs flex items-start gap-2 ${
                pbResult.ok
                  ? 'border-emerald-700/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-red-800/60 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
              }`}
            >
              {pbResult.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
              <div className="space-y-0.5">
                {pbResult.lines.map((line, i) => <p key={i}>{line}</p>)}
                {!pbResult.ok && selected.size > 0 && (
                  <p className="font-medium">eBay publishing was not started. Fix or deselect PartsBazar360, then publish again.</p>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {storeScopeLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading eBay stores…</span>
            </div>
          )}

          {!organizationId && (
            <div role="alert" className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-300">
              The active workspace is still loading. Reopen this dialog before publishing.
            </div>
          )}

          {accountsError && (
            <div role="alert" className="rounded-lg border border-red-800/60 bg-red-950/30 p-3 text-sm text-red-300">
              Unable to load eBay accounts for this workspace. Refresh and try again.
            </div>
          )}

          {/* Store checkboxes */}
          {!storeScopeLoading && organizationId && !accountsError && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  Select eBay Stores
                </p>
                {activeStores.length > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      Select all
                    </button>
                    <span className="text-slate-600 dark:text-slate-700">|</span>
                    <button
                      onClick={deselectAll}
                      className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-500 dark:text-slate-400"
                    >
                      Deselect all
                    </button>
                  </div>
                )}
              </div>

              {activeStores.map((store) => {
                const isChecked = selected.has(store.id);

                return (
                  <div key={store.id} className="space-y-0">
                    <button
                      onClick={() => toggleStore(store.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isChecked
                          ? 'border-blue-600/60 bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && (
                          <svg viewBox="0 0 12 12" className="w-3 h-3 text-white">
                            <path
                              d="M3.5 6.5L5 8l3.5-4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              fill="none"
                            />
                          </svg>
                        )}
                      </div>
                      <StoreIcon size={14} className="text-blue-400 shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <span className="text-sm text-slate-600 dark:text-slate-200 font-medium block truncate">
                          {store.storeName}
                        </span>
                        {store.externalStoreId && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            {store.externalStoreId}
                          </span>
                        )}
                      </div>
                      {store.isPrimary && (
                        <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                      <span className="text-xs text-emerald-400 shrink-0">Active</span>

                      {/* Override toggle */}
                      {isChecked && mode === 'single' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedOverride(
                              expandedOverride === store.id ? null : store.id,
                            );
                          }}
                          className="text-slate-500 dark:text-slate-400 hover:text-slate-500 dark:text-slate-300 p-0.5"
                        >
                          {expandedOverride === store.id ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      )}
                    </button>

                    {/* Per-store overrides */}
                    {isChecked && expandedOverride === store.id && mode === 'single' && (
                      <div className="border border-slate-200 dark:border-slate-800 border-t-0 rounded-b-lg p-3 bg-white/60 dark:bg-slate-900/60 space-y-2">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Store-specific overrides (optional)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                              Price
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={listing?.startPrice ?? ''}
                              value={overrides[store.id]?.price ?? ''}
                              onChange={(e) =>
                                setOverride(store.id, 'price', e.target.value)
                              }
                              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-600 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              placeholder={listing?.quantity?.toString() ?? ''}
                              value={overrides[store.id]?.quantity ?? ''}
                              onChange={(e) =>
                                setOverride(store.id, 'quantity', e.target.value)
                              }
                              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-600 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              placeholder="Custom title…"
                              value={overrides[store.id]?.title ?? ''}
                              onChange={(e) =>
                                setOverride(store.id, 'title', e.target.value)
                              }
                              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-600 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* No stores */}
              {!storeScopeLoading && organizationId && !accountsError && activeStores.length === 0 && partsBazarStores.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
                  <StoreIcon size={24} className="mx-auto mb-2 text-slate-500 dark:text-slate-600" />
                  <p>No active eBay stores found in this workspace.</p>
                  <p className="text-xs mt-1">
                    Go to Settings → Channels to connect your eBay account.
                  </p>
                </div>
              )}

              {/* Shipping / return / payment profiles (single mode only) */}
              {mode === 'single' && selected.size > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                    Shipping / Return / Payment
                  </p>
                  {selected.size > 1 && (
                    <div>
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                        Profile source store
                      </label>
                      <select
                        value={profileStoreId || profileSourceStoreId}
                        onChange={(e) => setProfileStoreId(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      >
                        {activeStores
                          .filter((s) => selected.has(s.id))
                          .map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.storeName}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <ProfileSelectors
                    profiles={storeProfiles}
                    loading={profilesLoading && !!profileSourceStoreId}
                    storeLabel={profileSourceStore?.storeName}
                    value={profiles}
                    onChange={setProfiles}
                    disabled={!profileSourceStoreId}
                  />
                  {hasNoPolicies && (
                    <div className="border border-red-800/60 bg-red-950/30 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-red-300 font-medium">No eBay policies found</p>
                        <p className="text-xs text-red-400/70 mt-0.5">
                          This store has no shipping, return, or payment policies synced from eBay.
                          Publishing will fail until you sync policies.
                          Go to Settings → eBay Integrations and click &quot;Sync Policies&quot;.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bulk mode: use existing policies */}
              {mode === 'bulk' && selected.size > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                  Policies (shipping, return, payment) will use each listing&apos;s existing assignments.
                  To change policies, use the <strong>Shipping</strong> button in the bulk action bar.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            {pbResult?.ok && totalSelected === 0 ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={() => { void handlePublish(); }}
            disabled={
              totalSelected === 0 ||
              pbBusy ||
              !organizationId ||
              (pbSelected.size > 0 && pbMissing.length > 0) ||
              (selected.size > 0 && (storeScopeLoading || accountsError || (mode === 'single' && hasNoPolicies)))
            }
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {pbBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Publish to {totalSelected || '…'} Store{totalSelected !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
