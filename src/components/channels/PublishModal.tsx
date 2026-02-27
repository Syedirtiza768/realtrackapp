/* ─── PublishModal ──────────────────────────────────────────
 *  Multi-channel publishing modal with channel checkboxes,
 *  validation warnings, per-channel overrides (price/title/qty),
 *  and per-channel result display.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ALL_CHANNELS,
  CHANNEL_META,
  validateListingForPublish,
  type ChannelKey,
  type ChannelOverrides,
  type PublishResult,
} from '../../types/channels';
import { useConnections, publishToChannels, bulkPublish } from '../../lib/channelsApi';
import type { SearchItem } from '../../types/search';

/* ── Types ────────────────────────────────────────────────── */

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

export default function PublishModal(props: Props) {
  const { open, onClose, onComplete, mode } = props;
  const listing = mode === 'single' ? props.listing : undefined;
  const listingIds = mode === 'bulk' ? props.listingIds : undefined;

  const { connections } = useConnections();
  const [selected, setSelected] = useState<Set<ChannelKey>>(new Set());
  const [overrides, setOverrides] = useState<Partial<Record<ChannelKey, ChannelOverrides>>>({});
  const [expandedOverride, setExpandedOverride] = useState<ChannelKey | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [results, setResults] = useState<PublishResult[]>([]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setOverrides({});
      setExpandedOverride(null);
      setStep('select');
      setResults([]);
    }
  }, [open]);

  /* ── Validation (single mode only) ─────────────────────── */
  const validation = useMemo(() => {
    if (!listing) return { valid: true, missing: [] };
    return validateListingForPublish(listing);
  }, [listing]);

  /* ── Connected channels ─────────────────────────────────── */
  const connectedChannels = useMemo(() => {
    return ALL_CHANNELS.filter((ch) =>
      connections.some((c) => c.channel === ch && c.status === 'active'),
    );
  }, [connections]);

  const disconnectedChannels = useMemo(() => {
    return ALL_CHANNELS.filter((ch) => !connectedChannels.includes(ch));
  }, [connectedChannels]);

  /* ── Toggle channel selection ───────────────────────────── */
  const toggle = useCallback((ch: ChannelKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }, []);

  /* ── Override helpers ───────────────────────────────────── */
  const setOverride = useCallback((ch: ChannelKey, field: keyof ChannelOverrides, value: string) => {
    setOverrides((prev) => {
      const current = prev[ch] ?? {};
      const parsed = field === 'quantity' ? parseInt(value, 10) : field === 'price' ? parseFloat(value) : value;
      return {
        ...prev,
        [ch]: { ...current, [field]: value === '' ? undefined : parsed },
      };
    });
  }, []);

  /* ── Publish handler ────────────────────────────────────── */
  const handlePublish = useCallback(async () => {
    if (selected.size === 0) return;
    setStep('publishing');

    try {
      if (mode === 'single' && listing) {
        const channels = Array.from(selected);
        const res = await publishToChannels(listing.id, channels, overrides as any);
        setResults(
          res.results.map((r: any) => ({
            channel: r.channel as ChannelKey,
            success: !!r.jobId,
            jobId: r.jobId,
            error: r.error,
          })),
        );
      } else if (mode === 'bulk' && listingIds) {
        const channels = Array.from(selected);
        const res = await bulkPublish(listingIds, channels);
        // For bulk, create a summary result
        setResults([
          {
            channel: 'ebay' as ChannelKey,
            success: true,
            jobId: `bulk-${(res as any).enqueued}`,
          },
        ]);
      }
    } catch (err: any) {
      setResults(
        Array.from(selected).map((ch) => ({
          channel: ch,
          success: false,
          error: err.message,
        })),
      );
    }

    setStep('results');
  }, [selected, overrides, mode, listing, listingIds]);

  /* ── Close + complete ───────────────────────────────────── */
  const handleDone = useCallback(() => {
    onComplete?.();
    onClose();
  }, [onClose, onComplete]);

  if (!open) return null;

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
                ? `Publish ${listingIds?.length} Listings`
                : 'Publish to Channels'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Step 1: Selection */}
          {step === 'select' && (
            <>
              {/* Listing info (single mode) */}
              {listing && (
                <div className="border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{listing.title}</p>
                    <p className="text-xs text-slate-500 font-mono">{listing.customLabelSku}</p>
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
                    <p className="text-xs text-amber-300 font-medium">Missing required fields</p>
                    <p className="text-xs text-amber-400/70 mt-0.5">
                      {validation.missing.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Channel checkboxes */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Select Channels
                </p>

                {connectedChannels.map((ch) => {
                  const meta = CHANNEL_META[ch];
                  const isChecked = selected.has(ch);

                  return (
                    <div key={ch} className="space-y-0">
                      <button
                        onClick={() => toggle(ch)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isChecked
                            ? 'border-blue-600/60 bg-blue-950/30'
                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-slate-600'
                          }`}
                        >
                          {isChecked && (
                            <svg viewBox="0 0 12 12" className="w-3 h-3 text-white">
                              <path d="M3.5 6.5L5 8l3.5-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm">{meta.icon}</span>
                        <span className="text-sm text-slate-200 font-medium">{meta.label}</span>
                        <span className="ml-auto text-xs text-emerald-400">Connected</span>

                        {/* Override toggle */}
                        {isChecked && mode === 'single' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedOverride(expandedOverride === ch ? null : ch);
                            }}
                            className="text-slate-500 hover:text-slate-300 p-0.5"
                          >
                            {expandedOverride === ch ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </button>

                      {/* Per-channel overrides */}
                      {isChecked && expandedOverride === ch && mode === 'single' && (
                        <div className="border border-slate-800 border-t-0 rounded-b-lg p-3 bg-slate-900/60 space-y-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Channel-specific overrides (optional)
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1">Price</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={listing?.startPrice ?? ''}
                                value={overrides[ch]?.price ?? ''}
                                onChange={(e) => setOverride(ch, 'price', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1">Quantity</label>
                              <input
                                type="number"
                                placeholder={listing?.quantity?.toString() ?? ''}
                                value={overrides[ch]?.quantity ?? ''}
                                onChange={(e) => setOverride(ch, 'quantity', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-1">Title</label>
                              <input
                                type="text"
                                placeholder="Custom title…"
                                value={overrides[ch]?.title ?? ''}
                                onChange={(e) => setOverride(ch, 'title', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Disconnected channels (disabled) */}
                {disconnectedChannels.map((ch) => {
                  const meta = CHANNEL_META[ch];
                  return (
                    <div
                      key={ch}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-800/50 bg-slate-900/20 opacity-50 cursor-not-allowed"
                    >
                      <div className="w-4 h-4 rounded border border-slate-700" />
                      <span className="text-sm">{meta.icon}</span>
                      <span className="text-sm text-slate-400">{meta.label}</span>
                      <span className="ml-auto text-xs text-slate-600">Not connected</span>
                    </div>
                  );
                })}

                {connectedChannels.length === 0 && (
                  <div className="text-center py-6 text-sm text-slate-500">
                    <p>No channels connected.</p>
                    <p className="text-xs mt-1">Go to Settings to connect eBay or Shopify.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 2: Publishing progress */}
          {step === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-blue-400 mb-4" />
              <p className="text-sm text-slate-300 font-medium">
                Publishing to {selected.size} channel{selected.size > 1 ? 's' : ''}…
              </p>
              <p className="text-xs text-slate-500 mt-1">This may take a moment.</p>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'results' && (
            <div className="space-y-3">
              <div className="text-center mb-4">
                {results.every((r) => r.success) ? (
                  <>
                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-200 font-medium">All published successfully!</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jobs are queued and will be processed shortly.
                    </p>
                  </>
                ) : results.every((r) => !r.success) ? (
                  <>
                    <XCircle size={32} className="text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-200 font-medium">Publishing failed</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={32} className="text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-200 font-medium">Partial success</p>
                  </>
                )}
              </div>

              {results.map((r) => {
                const meta = CHANNEL_META[r.channel];
                return (
                  <div
                    key={r.channel}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      r.success
                        ? 'border-emerald-800/60 bg-emerald-950/20'
                        : 'border-red-800/60 bg-red-950/20'
                    }`}
                  >
                    <span className="text-sm">{meta?.icon ?? '📦'}</span>
                    <span className="text-sm text-slate-200 font-medium">{meta?.label ?? r.channel}</span>
                    <span className="ml-auto flex items-center gap-1.5 text-xs">
                      {r.success ? (
                        <CheckCircle2 size={13} className="text-emerald-400" />
                      ) : (
                        <XCircle size={13} className="text-red-400" />
                      )}
                      <span className={r.success ? 'text-emerald-400' : 'text-red-400'}>
                        {r.success ? 'Queued' : r.error ?? 'Failed'}
                      </span>
                    </span>
                  </div>
                );
              })}
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
                disabled={selected.size === 0}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Send size={13} />
                Publish to {selected.size || '…'} Channel{selected.size !== 1 ? 's' : ''}
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
