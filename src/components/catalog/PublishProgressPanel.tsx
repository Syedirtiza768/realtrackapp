/* ─── PublishProgressPanel ────────────────────────────────────
 *  Inline progress panel for eBay publishing — renders on the
 *  catalog page instead of a blocking overlay modal.
 *  Shows per-store progress during publishing and results after.
 * ─────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react';
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
} from 'lucide-react';
import {
  publishToEbay,
  publishListingIdsToEbay,
  type BatchPublishResult,
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

export interface PublishJob {
  id: string;
  mode: 'single' | 'bulk';
  listing?: SearchItem;
  listingIds?: string[];
  stores: Store[];
  overrides: Record<string, StoreOverrides>;
  profiles: ProfileSelection;
}

interface Props {
  job: PublishJob;
  onDismiss: () => void;
}

/* ── Component ────────────────────────────────────────────── */

export default function PublishProgressPanel({ job, onDismiss }: Props) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [storeProgress, setStoreProgress] = useState<StoreProgress[]>(() =>
    job.stores.map((s) => ({
      storeId: s.id,
      storeName: s.storeName,
      status: 'pending' as StorePublishStatus,
    })),
  );
  const [bulkResults, setBulkResults] = useState<BatchPublishResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'publishing' | 'complete'>('publishing');

  const successCount = storeProgress.filter((s) => s.status === 'success').length;
  const failCount = storeProgress.filter((s) => s.status === 'failed').length;
  const completedCount = successCount + failCount;
  const totalCount = job.stores.length;

  /* ── Build publish request ──────────────────────────────── */
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

    const run = async () => {
      if (job.mode === 'single' && job.listing) {
        // Sequential per-store publishing with progress updates
        for (const store of job.stores) {
          if (cancelled) return;

          setStoreProgress((prev) =>
            prev.map((s) =>
              s.storeId === store.id ? { ...s, status: 'publishing' } : s,
            ),
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
              prev.map((s) =>
                s.storeId === store.id
                  ? { ...s, status: 'failed', error: msg }
                  : s,
              ),
            );
          }
        }
      } else if (job.mode === 'bulk' && job.listingIds) {
        // Bulk publish — mark all as publishing, then update
        setStoreProgress((prev) =>
          prev.map((s) => ({ ...s, status: 'publishing' as StorePublishStatus })),
        );

        try {
          const storeIdArray = job.stores.map((s) => s.id);
          const batchRes = await publishListingIdsToEbay(job.listingIds, storeIdArray);
          if (cancelled) return;

          setBulkResults(batchRes);

          // Aggregate results per store
          const storeResults = new Map<string, { success: number; failed: number; error?: string }>();
          for (const br of batchRes) {
            for (const r of br.results) {
              const existing = storeResults.get(r.storeId) ?? { success: 0, failed: 0 };
              if (r.success) existing.success++;
              else {
                existing.failed++;
                if (!existing.error) existing.error = r.error;
              }
              storeResults.set(r.storeId, existing);
            }
          }

          setStoreProgress((prev) =>
            prev.map((s) => {
              const agg = storeResults.get(s.storeId);
              if (!agg) return { ...s, status: 'failed' as StorePublishStatus, error: 'No result' };
              return {
                ...s,
                status: agg.failed === 0 ? ('success' as const) : ('failed' as const),
                error: agg.error,
              };
            }),
          );
        } catch (err: unknown) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setStoreProgress((prev) =>
            prev.map((s) => ({ ...s, status: 'failed' as StorePublishStatus, error: msg })),
          );
        }
      }

      if (!cancelled) {
        setOverallStatus('complete');
        queryClient.invalidateQueries({ queryKey: ['ebay-stores'] });
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [job, buildRequest, queryClient]);

  /* ── Auto-collapse during publishing, expand on complete ── */
  useEffect(() => {
    if (overallStatus === 'complete') setCollapsed(false);
  }, [overallStatus]);

  const allSuccess = failCount === 0 && overallStatus === 'complete';
  const allFailed = successCount === 0 && overallStatus === 'complete';
  const partial = overallStatus === 'complete' && successCount > 0 && failCount > 0;

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header — always visible, clickable to collapse */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {overallStatus === 'publishing'
              ? `Publishing to eBay${job.mode === 'bulk' ? ` (${job.listingIds?.length ?? 0} listings)` : ''}…`
              : allSuccess
                ? 'Published successfully'
                : allFailed
                  ? 'Publishing failed'
                  : 'Publishing complete (partial)'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {overallStatus === 'publishing'
              ? `${completedCount} of ${totalCount} store${totalCount !== 1 ? 's' : ''} processed`
              : `${successCount} succeeded, ${failCount} failed`}
          </p>
        </div>

        {/* Progress fraction */}
        {overallStatus === 'publishing' && (
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
            {completedCount}/{totalCount}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {overallStatus === 'complete' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onDismiss(); } }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Dismiss"
            >
              <X size={14} />
            </span>
          )}
          {collapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
        </div>
      </button>

      {/* Progress bar */}
      {overallStatus === 'publishing' && (
        <div className="h-0.5 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Body — per-store status */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1.5">
          {storeProgress.map((sp) => (
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
                <span className="text-slate-400 dark:text-slate-500">Waiting</span>
              )}
              {sp.status === 'publishing' && (
                <Loader2 size={12} className="animate-spin text-blue-500" />
              )}
              {sp.status === 'success' && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                  Published
                </span>
              )}
              {sp.status === 'failed' && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400 truncate max-w-[200px]" title={sp.error}>
                  <XCircle size={12} />
                  {sp.error ?? 'Failed'}
                </span>
              )}

              {sp.offerId && sp.status === 'success' && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">
                  {sp.offerId}
                </span>
              )}
            </div>
          ))}

          {/* Bulk mode: listing count summary */}
          {job.mode === 'bulk' && overallStatus === 'complete' && bulkResults.length > 0 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
              {bulkResults.length} listing{bulkResults.length !== 1 ? 's' : ''} processed across {totalCount} store{totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
