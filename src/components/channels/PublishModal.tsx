/* ─── PublishModal ──────────────────────────────────────────
 *  eBay multi-store publishing modal — store selection only.
 *  After the user clicks "Publish", the modal closes and
 *  CatalogManager takes over with an inline progress panel.
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
} from 'lucide-react';
import { getStoresByChannel, getStoreProfiles } from '../../lib/multiStoreApi';
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

/* ── Component ────────────────────────────────────────────── */

export default function PublishModal(props: Props) {
  const { open, onClose, onPublishStart, mode } = props;
  const listing = mode === 'single' ? props.listing : undefined;
  const listingIds = mode === 'bulk' ? props.listingIds : undefined;

  /* ── eBay stores ─────────────────────────────────────────── */
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['ebay-stores'],
    queryFn: () => getStoresByChannel('ebay'),
    enabled: open,
    staleTime: 60_000,
  });

  const activeStores = useMemo(
    () => stores.filter((s) => s.status === 'active'),
    [stores],
  );

  /* ── Local state ─────────────────────────────────────────── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, StoreOverrides>>({});
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);
  const [profileStoreId, setProfileStoreId] = useState<string>('');

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setOverrides({});
      setExpandedOverride(null);
      setProfiles(EMPTY_PROFILE_SELECTION);
      setProfileStoreId('');
    }
  }, [open]);

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
  const handlePublish = useCallback(() => {
    if (selected.size === 0) return;
    const selectedStores = activeStores.filter((s) => selected.has(s.id));
    onPublishStart({
      mode,
      listing,
      listingIds,
      stores: selectedStores,
      overrides,
      profiles,
    });
  }, [selected, activeStores, mode, listing, listingIds, overrides, profiles, onPublishStart]);

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
                ? `Publish ${listingIds?.length ?? 0} Listings to eBay`
                : 'Publish to eBay Stores'}
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
          {!validation.valid && (
            <div className="border border-amber-800/60 bg-amber-950/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-300 font-medium">Missing recommended fields</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  {validation.missing.join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {storesLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading eBay stores…</span>
            </div>
          )}

          {/* Store checkboxes */}
          {!storesLoading && (
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
              {!storesLoading && activeStores.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
                  <StoreIcon size={24} className="mx-auto mb-2 text-slate-500 dark:text-slate-600" />
                  <p>No active eBay stores found.</p>
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
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={selected.size === 0 || storesLoading || (mode === 'single' && hasNoPolicies)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Send size={13} />
            Publish to {selected.size || '…'} Store{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
