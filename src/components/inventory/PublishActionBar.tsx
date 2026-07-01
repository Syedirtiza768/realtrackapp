import { useState } from 'react';
import {
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { usePublishListing, usePublishJobTargets } from '../../lib/inventoryPublishApi';
import type { EditorStore } from '../../lib/inventoryApi';

interface PublishActionBarProps {
  listingId: string;
  stores: EditorStore[];
  selectedStoreId: string | null;
  selectedMarketplaceId: string | null;
  selectedPaymentPolicyId: string | null;
  selectedReturnPolicyId: string | null;
  selectedFulfillmentPolicyId: string | null;
  selectedLocationKey: string | null;
}

const MARKETPLACE_SHORT: Record<string, string> = {
  EBAY_US: 'US',
  EBAY_AU: 'AU',
  EBAY_DE: 'DE',
  EBAY_MOTORS_US: 'US',
};

const MARKETPLACE_FLAG: Record<string, string> = {
  EBAY_US: '🇺🇸',
  EBAY_AU: '🇦🇺',
  EBAY_DE: '🇩🇪',
};

export default function PublishActionBar({
  listingId,
  stores,
  selectedStoreId,
  selectedMarketplaceId,
  selectedPaymentPolicyId,
  selectedReturnPolicyId,
  selectedFulfillmentPolicyId,
  selectedLocationKey,
}: PublishActionBarProps) {
  const publishMutation = usePublishListing();
  const qc = useQueryClient();
  const [publishJobId, setPublishJobId] = useState<string | null>(null);

  const jobTargets = usePublishJobTargets(publishJobId);

  // Find the selected store
  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const availableMarketplaces = selectedStore?.marketplaces ?? [];

  // Determine which marketplaces to publish to
  // If user selected a specific marketplace, only publish to that one
  // Otherwise, publish to all marketplaces the store supports
  const targetMarketplaces = selectedMarketplaceId
    ? availableMarketplaces.filter((m) => m.marketplaceId === selectedMarketplaceId)
    : availableMarketplaces;

  const canPublish = Boolean(selectedStore && targetMarketplaces.length > 0 && !publishMutation.isPending);
  const isPublishing = publishMutation.isPending;
  const isDone = jobTargets.data?.length
    ? jobTargets.data.every((t) => ['success', 'failed', 'skipped'].includes(t.status))
    : false;

  const handlePublish = async () => {
    if (!canPublish) return;

    const selectedMarketplace = selectedStore?.marketplaces.find(
      (m) => m.marketplaceId === (selectedMarketplaceId ?? targetMarketplaces[0]?.marketplaceId),
    );

    const policyOverrides = {
      paymentPolicyId:
        selectedPaymentPolicyId ?? selectedMarketplace?.defaultPaymentPolicyId ?? undefined,
      returnPolicyId:
        selectedReturnPolicyId ?? selectedMarketplace?.defaultReturnPolicyId ?? undefined,
      fulfillmentPolicyId:
        selectedFulfillmentPolicyId ?? selectedMarketplace?.defaultFulfillmentPolicyId ?? undefined,
      merchantLocationKey:
        selectedLocationKey ?? selectedMarketplace?.defaultInventoryLocationKey ?? undefined,
    };

    const targets = targetMarketplaces.map((m) => ({
      storeId: selectedStore!.id,
      marketplaceId: m.marketplaceId,
      policyOverrides,
    }));

    try {
      const result = await publishMutation.mutateAsync({ listingId, targets });
      setPublishJobId(result.jobId);
      void qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      void qc.invalidateQueries({ queryKey: ['inventory-detail', listingId] });
    } catch {
      // Error handled by mutation state
    }
  };

  const handleReset = () => {
    setPublishJobId(null);
    publishMutation.reset();
  };

  return (
    <div className="sticky bottom-0 z-10 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Target marketplace badges */}
          {!publishJobId && targetMarketplaces.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Publishing to:</span>
              {targetMarketplaces.map((m) => (
                <span
                  key={m.marketplaceId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                >
                  {MARKETPLACE_FLAG[m.marketplaceId] ?? ''}
                  {MARKETPLACE_SHORT[m.marketplaceId] ?? m.marketplaceId}
                </span>
              ))}
            </div>
          )}

          {/* Job target statuses */}
          {jobTargets.data && (
            <div className="flex items-center gap-2">
              {jobTargets.data.map((t) => (
                <span
                  key={t.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    t.status === 'success'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : t.status === 'failed'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : t.status === 'skipped'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t.status === 'success' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : t.status === 'failed' ? (
                    <XCircle className="h-3 w-3" />
                  ) : t.status === 'skipped' ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {MARKETPLACE_SHORT[t.marketplaceId] ?? t.marketplaceId}: {t.status}
                </span>
              ))}
            </div>
          )}

          {/* Error display */}
          {publishMutation.isError && (
            <span className="text-xs text-red-400">
              {publishMutation.error instanceof Error
                ? publishMutation.error.message
                : 'Publish failed'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(publishJobId || isDone) && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDone ? 'Clear' : 'Reset'}
            </button>
          )}

          {!publishJobId && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish to eBay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
