/* ─── PublishProgressPanel ────────────────────────────────────
 *  Inline progress panel for eBay publishing — renders on the
 *  catalog page instead of a blocking overlay modal.
 *
 *  Two modes:
 *   • single — one listing → many stores. Animates per store.
 *   • bulk   — many listings → many stores. One durable server-side
 *     BullMQ job survives browser refresh/closure; polling reveals each
 *     listing's name, live counter, and per-listing errors as targets resolve.
 *
 *  A "View summary" section expands after completion with totals,
 *  a per-store breakdown, and every failed/partial listing.
 * ─────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Store as StoreIcon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ListChecks,
  Package,
} from 'lucide-react';
import {
  createDurableBulkPublishJob,
  fetchDurableBulkPublishTargets,
  publishToEbay,
  type PublishResult,
  type PublishRequest,
} from '../../lib/publishApi';
import type { SearchItem } from '../../types/search';
import type { Store } from '../../types/multiStore';
import { getAllImageUrls } from '../../lib/listingsApi';
import type { ProfileSelection } from './profileUtils';

/* ── Types ────────────────────────────────────────────────── */

export interface StoreOverrides {
  price?: number;
  quantity?: number;
  title?: string;
}

export type StorePublishStatus = 'pending' | 'publishing' | 'success' | 'failed';

export interface StoreProgress {
  storeId: string;
  storeName: string;
  status: StorePublishStatus;
  offerId?: string;
  listingId?: string;
  error?: string;
}

/** Per-listing status for bulk mode. `partial` = some stores ok, some failed. */
export type ListingPublishStatus =
  | 'pending'
  | 'publishing'
  | 'success'
  | 'partial'
  | 'failed';

export interface ListingProgress {
  listingId: string;
  name: string;
  status: ListingPublishStatus;
  successStores: number;
  failedStores: number;
  error?: string;
  storeResults?: PublishResult[];
}

export interface PublishJob {
  id: string;
  mode: 'single' | 'bulk';
  listing?: SearchItem;
  listingIds?: string[];
  /** listingId → human-readable title, for bulk progress rows. */
  listingNames?: Record<string, string>;
  stores: Store[];
  overrides: Record<string, StoreOverrides>;
  profiles: ProfileSelection;
}

interface Props {
  job: PublishJob;
  onDismiss: () => void;
}

function waitForPoll(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

/* ── Component ────────────────────────────────────────────── */

export default function PublishProgressPanel({ job, onDismiss }: Props) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [overallStatus, setOverallStatus] = useState<'publishing' | 'complete'>('publishing');

  const isBulk = job.mode === 'bulk';

  /* ── Single-mode: per-store progress ────────────────────── */
  const [storeProgress, setStoreProgress] = useState<StoreProgress[]>(() =>
    job.stores.map((s) => ({
      storeId: s.id,
      storeName: s.storeName,
      status: 'pending' as StorePublishStatus,
    })),
  );

  /* ── Bulk-mode: per-listing progress ────────────────────── */
  const [listingProgress, setListingProgress] = useState<ListingProgress[]>(() =>
    (job.listingIds ?? []).map((id) => ({
      listingId: id,
      name: job.listingNames?.[id]?.trim() || `Listing ${id.slice(0, 8)}`,
      status: 'pending' as ListingPublishStatus,
      successStores: 0,
      failedStores: 0,
    })),
  );

  /* ── Build single-publish request ───────────────────────── */
  const buildRequest = useCallback(
    (store: Store): PublishRequest => {
      if (!job.listing) throw new Error('No listing data');
      const ov = job.overrides[store.id];
      return {
        listingId: job.listing.id,
        storeIds: [store.id],
        sku: job.listing.customLabelSku ?? job.listing.id,
        title: ov?.title ?? job.listing.title ?? '',
        description: job.listing.description ?? '',
        categoryId: job.listing.categoryId ?? '',
        condition: job.listing.conditionId ?? '3000',
        price: ov?.price ?? parseFloat(job.listing.startPrice ?? '0'),
        quantity: ov?.quantity ?? parseInt(job.listing.quantity ?? '0', 10),
        imageUrls: getAllImageUrls(job.listing.itemPhotoUrl),
        aspects: {},
        fulfillmentPolicyId:
          job.profiles.fulfillmentPolicyId ??
          (store.config as Record<string, string>)?.fulfillmentPolicyId ??
          store.fulfillmentPolicyId ??
          undefined,
        paymentPolicyId:
          job.profiles.paymentPolicyId ??
          (store.config as Record<string, string>)?.paymentPolicyId ??
          store.paymentPolicyId ??
          undefined,
        returnPolicyId:
          job.profiles.returnPolicyId ??
          (store.config as Record<string, string>)?.returnPolicyId ??
          store.returnPolicyId ??
          undefined,
        merchantLocationKey: (store.config as Record<string, string>)?.locationKey ?? undefined,
        requestedFulfillmentPolicyName: job.profiles.shippingProfileName || undefined,
        requestedReturnPolicyName: job.profiles.returnProfileName || undefined,
        requestedPaymentPolicyName: job.profiles.paymentProfileName || undefined,
      };
    },
    [job],
  );

  /* ── Execute publish ────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    const runSingle = async () => {
      if (!job.listing) return;
      for (const store of job.stores) {
        if (cancelled) return;

        setStoreProgress((prev) =>
          prev.map((s) => (s.storeId === store.id ? { ...s, status: 'publishing' } : s)),
        );

        try {
          const req = buildRequest(store);
          const res = await publishToEbay(req);
          if (cancelled) return;

          for (const r of res) {
            setStoreProgress((prev) =>
              prev.map((s) =>
                s.storeId === r.storeId
                  ? {
                      ...s,
                      status: r.success ? 'success' : 'failed',
                      offerId: r.offerId,
                      listingId: r.listingId,
                      error: r.error,
                    }
                  : s,
              ),
            );
          }
        } catch (err: unknown) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setStoreProgress((prev) =>
            prev.map((s) => (s.storeId === store.id ? { ...s, status: 'failed', error: msg } : s)),
          );
        }
      }
    };

    const runBulk = async () => {
      const ids = job.listingIds ?? [];
      const storeIdArray = job.stores.map((s) => s.id);
      if (!ids.length || !storeIdArray.length) return;
      try {
        const submitted = await createDurableBulkPublishJob(
          ids,
          storeIdArray,
          job.id,
        );
        while (!cancelled) {
          const targets = await fetchDurableBulkPublishTargets(submitted.jobId);
          if (cancelled) return;
          const byListing = new Map<string, typeof targets>();
          for (const target of targets) {
            const sourceId = target.resultPayload?.sourceListingId;
            if (!sourceId) continue;
            const rows = byListing.get(sourceId) ?? [];
            rows.push(target);
            byListing.set(sourceId, rows);
          }

          setListingProgress((prev) =>
            prev.map((lp) => {
              const rows = byListing.get(lp.listingId) ?? [];
              if (!rows.length) return lp;
              const pending = rows.some(
                (row) => row.status === 'pending' || row.status === 'processing',
              );
              const successStores = rows.filter((row) => row.status === 'success').length;
              const failedStores = rows.filter(
                (row) => row.status === 'failed' || row.status === 'skipped',
              ).length;
              const storeResults: PublishResult[] = rows
                .filter((row) => row.status === 'success' || row.status === 'failed')
                .map((row) => ({
                  storeId: row.storeId ?? row.ebayAccountId,
                  storeName: row.storeName ?? row.ebayAccountId,
                  success: row.status === 'success',
                  offerId: row.resultPayload?.offerId,
                  listingId: row.resultPayload?.listingId,
                  error:
                    row.errorPayload?.message ?? row.errorPayload?.errors?.join('; '),
                }));
              const status: ListingPublishStatus = pending
                ? 'publishing'
                : failedStores === 0
                  ? 'success'
                  : successStores === 0
                    ? 'failed'
                    : 'partial';
              return {
                ...lp,
                status,
                successStores,
                failedStores,
                error: storeResults.find((result) => !result.success)?.error,
                storeResults,
              };
            }),
          );

          const pendingTargets = targets.some(
            (target) => target.status === 'pending' || target.status === 'processing',
          );
          if (!pendingTargets && targets.length >= submitted.targetCount) break;
          await waitForPoll(3_000);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setListingProgress((prev) =>
          prev.map((lp) => ({
            ...lp,
            status: 'failed',
            failedStores: storeIdArray.length,
            error: msg,
          })),
        );
      }
    };

    const run = async () => {
      if (isBulk) await runBulk();
      else await runSingle();

      if (!cancelled) {
        setOverallStatus('complete');
        queryClient.invalidateQueries({ queryKey: ['ebay-stores'] });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [job, buildRequest, queryClient, isBulk]);

  /* ── Derived counts ─────────────────────────────────────── */
  const counts = useMemo(() => {
    if (isBulk) {
      const total = listingProgress.length;
      const success = listingProgress.filter((l) => l.status === 'success').length;
      const partial = listingProgress.filter((l) => l.status === 'partial').length;
      const failed = listingProgress.filter((l) => l.status === 'failed').length;
      const completed = success + partial + failed;
      return { total, success, partial, failed, completed };
    }
    const total = storeProgress.length;
    const success = storeProgress.filter((s) => s.status === 'success').length;
    const failed = storeProgress.filter((s) => s.status === 'failed').length;
    return { total, success, partial: 0, failed, completed: success + failed };
  }, [isBulk, listingProgress, storeProgress]);

  const { total, success, partial, failed, completed } = counts;
  const unit = isBulk ? 'listing' : 'store';
  const pct = total > 0 ? (completed / total) * 100 : 0;

  const allSuccess = overallStatus === 'complete' && failed === 0 && partial === 0;
  const allFailed = overallStatus === 'complete' && success === 0 && partial === 0 && failed > 0;
  const hasIssues = overallStatus === 'complete' && !allSuccess;

  /* ── Per-store aggregate for the summary (bulk) ─────────── */
  const storeAggregate = useMemo(() => {
    if (!isBulk) return [];
    const map = new Map<string, { storeName: string; success: number; failed: number }>();
    for (const s of job.stores) map.set(s.id, { storeName: s.storeName, success: 0, failed: 0 });
    for (const lp of listingProgress) {
      for (const r of lp.storeResults ?? []) {
        const agg = map.get(r.storeId) ?? { storeName: r.storeName || r.storeId, success: 0, failed: 0 };
        if (r.success) agg.success++;
        else agg.failed++;
        map.set(r.storeId, agg);
      }
    }
    return Array.from(map.values());
  }, [isBulk, job.stores, listingProgress]);

  const problemListings = useMemo(
    () => listingProgress.filter((l) => l.status === 'failed' || l.status === 'partial'),
    [listingProgress],
  );

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header — always visible, clickable to collapse */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        {overallStatus === 'publishing' ? (
          <Loader2 size={16} className="animate-spin text-blue-500 shrink-0" />
        ) : allSuccess ? (
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        ) : allFailed ? (
          <XCircle size={16} className="text-red-500 shrink-0" />
        ) : (
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {overallStatus === 'publishing'
              ? isBulk
                ? `Publishing to eBay — ${completed} of ${total} listings`
                : `Publishing to eBay${total !== 1 ? ` (${total} stores)` : ''}…`
              : allSuccess
                ? isBulk
                  ? `Published ${success} listing${success !== 1 ? 's' : ''}`
                  : 'Published successfully'
                : allFailed
                  ? 'Publishing failed'
                  : 'Publishing complete (partial)'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {overallStatus === 'publishing'
              ? `${completed} of ${total} ${unit}${total !== 1 ? 's' : ''} processed`
              : isBulk
                ? `${success} published${partial > 0 ? `, ${partial} partial` : ''}${failed > 0 ? `, ${failed} failed` : ''}`
                : `${success} succeeded, ${failed} failed`}
          </p>
        </div>

        {/* Progress fraction */}
        {overallStatus === 'publishing' && (
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
            {completed}/{total}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {overallStatus === 'complete' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onDismiss();
                }
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Dismiss"
            >
              <X size={14} />
            </span>
          )}
          {collapsed ? (
            <ChevronDown size={14} className="text-slate-400" />
          ) : (
            <ChevronUp size={14} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      {overallStatus === 'publishing' && (
        <div
          className="h-1 bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Body */}
      {!collapsed && (
        <div className="px-3 sm:px-4 pb-3 space-y-1.5">
          {/* ── Single mode: per-store rows ─────────────────── */}
          {!isBulk &&
            storeProgress.map((sp) => (
              <div
                key={sp.storeId}
                className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-xs transition-colors ${
                  sp.status === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20'
                    : sp.status === 'failed'
                      ? 'bg-red-50 dark:bg-red-950/20'
                      : sp.status === 'publishing'
                        ? 'bg-blue-50 dark:bg-blue-950/20'
                        : 'bg-slate-50 dark:bg-slate-800/30'
                }`}
              >
                <StoreIcon size={12} className="text-slate-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 font-medium truncate flex-1">
                  {sp.storeName}
                </span>
                {sp.status === 'pending' && (
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">Waiting</span>
                )}
                {sp.status === 'publishing' && (
                  <Loader2 size={12} className="animate-spin text-blue-500 shrink-0" />
                )}
                {sp.status === 'success' && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 size={12} />
                    Published
                  </span>
                )}
                {sp.status === 'failed' && (
                  <span
                    className="flex items-center gap-1 text-red-600 dark:text-red-400 truncate max-w-[55%] sm:max-w-[240px]"
                    title={sp.error}
                  >
                    <XCircle size={12} className="shrink-0" />
                    <span className="truncate">{sp.error ?? 'Failed'}</span>
                  </span>
                )}
                {sp.offerId && sp.status === 'success' && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline shrink-0">
                    {sp.offerId}
                  </span>
                )}
              </div>
            ))}

          {/* ── Bulk mode: per-listing rows ─────────────────── */}
          {isBulk && (
            <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
              {listingProgress.map((lp) => (
                <div
                  key={lp.listingId}
                  className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-xs transition-colors ${
                    lp.status === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20'
                      : lp.status === 'failed'
                        ? 'bg-red-50 dark:bg-red-950/20'
                        : lp.status === 'partial'
                          ? 'bg-amber-50 dark:bg-amber-950/20'
                          : lp.status === 'publishing'
                            ? 'bg-blue-50 dark:bg-blue-950/20'
                            : 'bg-slate-50 dark:bg-slate-800/30'
                  }`}
                >
                  <Package size={12} className="text-slate-400 shrink-0" />
                  <span
                    className="text-slate-700 dark:text-slate-300 font-medium truncate flex-1 min-w-0"
                    title={lp.name}
                  >
                    {lp.name}
                  </span>

                  {lp.status === 'pending' && (
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">Waiting</span>
                  )}
                  {lp.status === 'publishing' && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 shrink-0">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="hidden sm:inline">Publishing…</span>
                    </span>
                  )}
                  {lp.status === 'success' && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 size={12} />
                      <span className="hidden sm:inline">
                        {lp.successStores} store{lp.successStores !== 1 ? 's' : ''}
                      </span>
                    </span>
                  )}
                  {lp.status === 'partial' && (
                    <span
                      className="flex items-center gap-1 text-amber-600 dark:text-amber-400 shrink-0"
                      title={lp.error}
                    >
                      <AlertTriangle size={12} />
                      <span>
                        {lp.successStores}/{lp.successStores + lp.failedStores}
                      </span>
                    </span>
                  )}
                  {lp.status === 'failed' && (
                    <span
                      className="flex items-center gap-1 text-red-600 dark:text-red-400 truncate max-w-[50%] sm:max-w-[260px]"
                      title={lp.error}
                    >
                      <XCircle size={12} className="shrink-0" />
                      <span className="truncate">{lp.error ?? 'Failed'}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Summary toggle + section ────────────────────── */}
          {overallStatus === 'complete' && (
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => setShowSummary((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ListChecks size={13} />
                {showSummary ? 'Hide summary' : 'View summary'}
                {showSummary ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {showSummary && (
                <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-3">
                  {/* Totals */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <SummaryStat label={isBulk ? 'Listings' : 'Stores'} value={total} tone="neutral" />
                    <SummaryStat label="Published" value={success} tone="success" />
                    {isBulk && <SummaryStat label="Partial" value={partial} tone="warn" />}
                    <SummaryStat label="Failed" value={failed} tone="danger" />
                  </div>

                  {/* Per-store breakdown (bulk) */}
                  {isBulk && storeAggregate.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                        Per store
                      </p>
                      <div className="space-y-1">
                        {storeAggregate.map((agg) => (
                          <div
                            key={agg.storeName}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <StoreIcon size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate flex-1">{agg.storeName}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 shrink-0">
                              {agg.success} ✓
                            </span>
                            {agg.failed > 0 && (
                              <span className="text-red-600 dark:text-red-400 shrink-0">
                                {agg.failed} ✕
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Problem listings (bulk) */}
                  {isBulk && problemListings.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                        Needs attention ({problemListings.length})
                      </p>
                      <div className="space-y-1">
                        {problemListings.map((lp) => (
                          <div
                            key={lp.listingId}
                            className="flex items-start gap-2 text-xs"
                          >
                            {lp.status === 'partial' ? (
                              <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle size={12} className="text-red-500 shrink-0 mt-0.5" />
                            )}
                            <span className="text-slate-700 dark:text-slate-300 font-medium shrink-0 max-w-[40%] truncate" title={lp.name}>
                              {lp.name}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 truncate flex-1" title={lp.error}>
                              {lp.error ?? (lp.status === 'partial' ? 'Some stores failed' : 'Failed')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Summary stat tile ────────────────────────────────────── */

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'warn' | 'danger';
}) {
  const toneCls =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'danger'
          ? 'text-red-600 dark:text-red-400'
          : 'text-slate-800 dark:text-slate-100';
  return (
    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-center">
      <p className={`text-lg font-semibold tabular-nums ${toneCls}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
    </div>
  );
}
