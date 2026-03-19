/* ─── PublishModal ──────────────────────────────────────────
 *  eBay multi-store publishing modal.
 *  - Loads active eBay stores via TanStack Query
 *  - Store checkboxes with per-store price/qty/title overrides
 *  - Validation warnings for missing fields
 *  - Publishes via publishApi (single & batch)
 *  - Per-store result display
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Store as StoreIcon,
} from 'lucide-react';
import { getStoresByChannel } from '../../lib/multiStoreApi';
import {
  publishToEbay,
  batchPublishToEbay,
  type PublishRequest,
  type PublishResult,
  type BatchPublishResult,
} from '../../lib/publishApi';
import type { SearchItem } from '../../types/search';
import type { Store } from '../../types/multiStore';

/* ── Types ────────────────────────────────────────────────── */

interface StoreOverrides {
  price?: number;
  quantity?: number;
  title?: string;
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
  onComplete?: () => void;
};

type Step = 'select' | 'publishing' | 'results';

/* ── Validation ───────────────────────────────────────────── */

function validateListing(listing: SearchItem): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!listing.title) missing.push('Title');
  if (!listing.startPrice) missing.push('Price');
  if (!listing.quantity) missing.push('Quantity');
  if (!listing.categoryId) missing.push('eBay Category');
  if (!listing.description) missing.push('Description');
  return { valid: missing.length === 0, missing };
}

/* ── Component ────────────────────────────────────────────── */

export default function PublishModal(props: Props) {
  const { open, onClose, onComplete, mode } = props;
  const listing = mode === 'single' ? props.listing : undefined;
  const listingIds = mode === 'bulk' ? props.listingIds : undefined;

  const queryClient = useQueryClient();

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
  const [step, setStep] = useState<Step>('select');
  const [results, setResults] = useState<PublishResult[]>([]);
  const [bulkResults, setBulkResults] = useState<BatchPublishResult[]>([]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setOverrides({});
      setExpandedOverride(null);
      setStep('select');
      setResults([]);
      setBulkResults([]);
    }
  }, [open]);

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

  /* ── Build publish request from listing + store ─────────── */
  const buildRequest = useCallback(
    (store: Store): PublishRequest => {
      if (!listing) throw new Error('No listing data');
      const ov = overrides[store.id];
      return {
        listingId: listing.id,
        storeIds: [store.id],
        sku: listing.customLabelSku ?? listing.id,
        title: ov?.title ?? listing.title ?? '',
        description: listing.description ?? '',
        categoryId: listing.categoryId ?? '',
        condition: listing.conditionId ?? 'NEW',
        price: ov?.price ?? parseFloat(listing.startPrice ?? '0'),
        quantity: ov?.quantity ?? parseInt(listing.quantity ?? '0', 10),
        imageUrls: listing.itemPhotoUrl ? [listing.itemPhotoUrl] : [],
        aspects: {},
        fulfillmentPolicyId: (store.config as Record<string, string>)?.fulfillmentPolicyId ?? undefined,
        paymentPolicyId: (store.config as Record<string, string>)?.paymentPolicyId ?? undefined,
        returnPolicyId: (store.config as Record<string, string>)?.returnPolicyId ?? undefined,
        merchantLocationKey: (store.config as Record<string, string>)?.locationKey ?? undefined,
      };
    },
    [listing, overrides],
  );

  /* ── Publish mutation ───────────────────────────────────── */
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'single' && listing) {
        const selectedStores = activeStores.filter((s) => selected.has(s.id));
        const allResults: PublishResult[] = [];

        for (const store of selectedStores) {
          try {
            const req = buildRequest(store);
            const res = await publishToEbay(req);
            allResults.push(...res);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            allResults.push({
              storeId: store.id,
              storeName: store.storeName,
              success: false,
              error: msg,
            });
          }
        }
        return { type: 'single' as const, results: allResults };
      } else if (mode === 'bulk' && listingIds) {
        const storeIdArray = Array.from(selected);
        const items: PublishRequest[] = listingIds.map((lid) => ({
          listingId: lid,
          storeIds: storeIdArray,
          sku: lid,
          title: '',
          description: '',
          categoryId: '',
          condition: 'NEW',
          price: 0,
          quantity: 0,
          imageUrls: [],
          aspects: {},
        }));
        const batchRes = await batchPublishToEbay(items);
        return { type: 'bulk' as const, batchResults: batchRes };
      }
      throw new Error('Invalid mode');
    },
    onSuccess: (data) => {
      if (data.type === 'single') {
        setResults(data.results);
      } else {
        setBulkResults(data.batchResults);
        const flat = data.batchResults.flatMap((br) => br.results);
        setResults(flat);
      }
      setStep('results');
      queryClient.invalidateQueries({ queryKey: ['ebay-stores'] });
    },
    onError: (err: Error) => {
      setResults(
        Array.from(selected).map((sid) => ({
          storeId: sid,
          storeName: activeStores.find((s) => s.id === sid)?.storeName ?? sid,
          success: false,
          error: err.message,
        })),
      );
      setStep('results');
    },
  });

  /* ── Handlers ───────────────────────────────────────────── */
  const handlePublish = useCallback(() => {
    if (selected.size === 0) return;
    setStep('publishing');
    publishMutation.mutate();
  }, [selected, publishMutation]);

  const handleDone = useCallback(() => {
    onComplete?.();
    onClose();
  }, [onClose, onComplete]);

  if (!open) return null;

  /* ── Helpers for rendering ──────────────────────────────── */
  const storeMap = useMemo(
    () => new Map(stores.map((s) => [s.id, s])),
    [stores],
  );

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-blue-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              {mode === 'bulk'
                ? `Publish ${listingIds?.length ?? 0} Listings to eBay`
                : 'Publish to eBay Stores'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* ─── Step 1: Store Selection ─────────────────── */}
          {step === 'select' && (
            <>
              {/* Listing info (single mode) */}
              {listing && (
                <div className="border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">
                      {listing.title ?? 'Untitled'}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      {listing.customLabelSku ?? listing.id}
                    </p>
                  </div>
                  {listing.startPrice && (
                    <span className="text-sm font-bold text-slate-200">
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
                <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading eBay stores…</span>
                </div>
              )}

              {/* Store checkboxes */}
              {!storesLoading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
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
                        <span className="text-slate-700">|</span>
                        <button
                          onClick={deselectAll}
                          className="text-[10px] text-slate-500 hover:text-slate-400"
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
                              : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-slate-600'
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
                            <span className="text-sm text-slate-200 font-medium block truncate">
                              {store.storeName}
                            </span>
                            {store.externalStoreId && (
                              <span className="text-[10px] text-slate-500 block">
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
                              className="text-slate-500 hover:text-slate-300 p-0.5"
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
                          <div className="border border-slate-800 border-t-0 rounded-b-lg p-3 bg-slate-900/60 space-y-2">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                              Store-specific overrides (optional)
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">
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
                                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  placeholder={listing?.quantity?.toString() ?? ''}
                                  value={overrides[store.id]?.quantity ?? ''}
                                  onChange={(e) =>
                                    setOverride(store.id, 'quantity', e.target.value)
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">
                                  Title
                                </label>
                                <input
                                  type="text"
                                  placeholder="Custom title…"
                                  value={overrides[store.id]?.title ?? ''}
                                  onChange={(e) =>
                                    setOverride(store.id, 'title', e.target.value)
                                  }
                                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
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
                    <div className="text-center py-6 text-sm text-slate-500">
                      <StoreIcon size={24} className="mx-auto mb-2 text-slate-600" />
                      <p>No active eBay stores found.</p>
                      <p className="text-xs mt-1">
                        Go to Settings → Channels to connect your eBay account.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── Step 2: Publishing progress ─────────────── */}
          {step === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-400 mb-4" />
              <p className="text-sm text-slate-300 font-medium">
                Publishing to {selected.size} store{selected.size !== 1 ? 's' : ''}…
              </p>
              <p className="text-xs text-slate-500 mt-1">This may take a moment.</p>
            </div>
          )}

          {/* ─── Step 3: Results ─────────────────────────── */}
          {step === 'results' && (
            <div className="space-y-3">
              {/* Summary header */}
              <div className="text-center mb-4">
                {failCount === 0 ? (
                  <>
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-200 font-medium">
                      All published successfully!
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {successCount} offer{successCount !== 1 ? 's' : ''} created on eBay.
                    </p>
                  </>
                ) : successCount === 0 ? (
                  <>
                    <XCircle size={32} className="text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-200 font-medium">Publishing failed</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {failCount} store{failCount !== 1 ? 's' : ''} failed.
                    </p>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={32} className="text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-200 font-medium">Partial success</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {successCount} succeeded, {failCount} failed.
                    </p>
                  </>
                )}
              </div>

              {/* Per-store results */}
              {results.map((r, idx) => {
                const store = storeMap.get(r.storeId);
                return (
                  <div
                    key={`${r.storeId}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      r.success
                        ? 'border-emerald-800/60 bg-emerald-950/20'
                        : 'border-red-800/60 bg-red-950/20'
                    }`}
                  >
                    <StoreIcon size={14} className="text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-200 font-medium block truncate">
                        {r.storeName ?? store?.storeName ?? r.storeId}
                      </span>
                      {r.offerId && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Offer: {r.offerId}
                        </span>
                      )}
                      {r.listingId && (
                        <span className="text-[10px] text-slate-500 font-mono ml-2">
                          Listing: {r.listingId}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-xs shrink-0">
                      {r.success ? (
                        <CheckCircle2 size={13} className="text-emerald-400" />
                      ) : (
                        <XCircle size={13} className="text-red-400" />
                      )}
                      <span className={r.success ? 'text-emerald-400' : 'text-red-400'}>
                        {r.success ? 'Published' : r.error ?? 'Failed'}
                      </span>
                    </span>
                  </div>
                );
              })}

              {/* Bulk results breakdown */}
              {mode === 'bulk' && bulkResults.length > 0 && (
                <div className="border-t border-slate-800 pt-3 mt-3">
                  <p className="text-xs text-slate-500 mb-2">
                    {bulkResults.length} listing{bulkResults.length !== 1 ? 's' : ''} processed
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
          {step === 'select' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={selected.size === 0 || storesLoading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Send size={13} />
                Publish to {selected.size || '…'} Store{selected.size !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'results' && (
            <button
              onClick={handleDone}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
