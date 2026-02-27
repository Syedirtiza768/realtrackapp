/* ─── Channel Store Panel ───────────────────────────────────
 *  Multi-store channel management for a single SKU.
 *  Shows: Channel → Store → Instance hierarchy
 *  Supports: demo publish, multi-store publish, end listing
 * ────────────────────────────────────────────────────────── */

import React, { useState, useCallback } from 'react';
import {
  Radio,
  Store as StoreIcon,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Zap,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import {
  useStores,
  useListingChannelOverview,
  publishToMultipleStores,
  endInstance,
  simulateOrder,
} from '../../lib/multiStoreApi';
import type { Store, ListingChannelInstance } from '../../types/multiStore';

const CHANNEL_COLORS: Record<string, string> = {
  ebay: '#E53238',
  shopify: '#96BF48',
  amazon: '#FF9900',
  walmart: '#0071DC',
};

const CHANNEL_LABELS: Record<string, string> = {
  ebay: 'eBay',
  shopify: 'Shopify',
  amazon: 'Amazon',
  walmart: 'Walmart',
};

export default function ChannelStorePanel({ listingId }: { listingId: string }) {
  const { stores, loading: storesLoading } = useStores();
  const { overview, loading: overviewLoading, refresh } = useListingChannelOverview(listingId);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set(['ebay', 'shopify', 'amazon', 'walmart']));
  const [publishing, setPublishing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const toggleChannel = (ch: string) => {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  // Group stores by channel
  const storesByChannel = stores.reduce((acc, store) => {
    (acc[store.channel] ??= []).push(store);
    return acc;
  }, {} as Record<string, Store[]>);

  // Map instances by storeId for quick lookup
  const instanceByStore = (overview?.instances ?? []).reduce((acc, inst) => {
    acc[inst.storeId] = inst;
    return acc;
  }, {} as Record<string, ListingChannelInstance>);

  const handlePublishToStore = useCallback(async (store: Store) => {
    setPublishing(store.id);
    setActionMsg(null);
    try {
      const result = await publishToMultipleStores(listingId, [store.id]);
      const r = result.results[0];
      setActionMsg(r?.status === 'published'
        ? `Published to ${store.storeName}!`
        : `Error: ${r?.error ?? 'Unknown'}`
      );
      await refresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    } finally {
      setPublishing(null);
    }
  }, [listingId, refresh]);

  const handlePublishAll = useCallback(async () => {
    const unpublished = stores.filter((s) => {
      const inst = instanceByStore[s.id];
      return !inst || inst.syncStatus !== 'synced';
    });
    if (unpublished.length === 0) {
      setActionMsg('All stores already published');
      return;
    }
    setPublishing('all');
    try {
      const result = await publishToMultipleStores(
        listingId,
        unpublished.map((s) => s.id),
      );
      const published = result.results.filter((r) => r.status === 'published').length;
      setActionMsg(`Published to ${published}/${unpublished.length} stores`);
      await refresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    } finally {
      setPublishing(null);
    }
  }, [stores, instanceByStore, listingId, refresh]);

  const handleEndInstance = useCallback(async (instanceId: string) => {
    try {
      await endInstance(instanceId);
      setActionMsg('Listing ended');
      await refresh();
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  }, [refresh]);

  const handleSimulateOrder = useCallback(async (instanceId: string) => {
    try {
      const log = await simulateOrder(instanceId);
      setActionMsg(`Simulated order ${log.simulatedExternalId ?? 'created'}!`);
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`);
    }
  }, []);

  const loading = storesLoading || overviewLoading;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }

  const channels = Object.keys(storesByChannel).sort();

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Multi-Store Channel Publishing</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {stores.length} stores across {channels.length} channels
            {overview && ` · ${overview.instances.filter((i) => i.syncStatus === 'synced').length} published`}
          </p>
        </div>
        <button
          onClick={handlePublishAll}
          disabled={publishing !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {publishing === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Publish to All Stores
        </button>
      </div>

      {actionMsg && (
        <div className={`px-3 py-2 rounded-lg text-sm ${actionMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {actionMsg}
        </div>
      )}

      {/* Channel → Store → Instance Tree */}
      {channels.map((channel) => {
        const channelStores = storesByChannel[channel] ?? [];
        const expanded = expandedChannels.has(channel);
        const publishedInChannel = channelStores.filter((s) => instanceByStore[s.id]?.syncStatus === 'synced').length;
        const color = CHANNEL_COLORS[channel] ?? '#6B7280';

        return (
          <div key={channel} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Channel Header */}
            <button
              onClick={() => toggleChannel(channel)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}15` }}
              >
                <Radio className="w-4 h-4" style={{ color }} />
              </div>
              <div className="flex-1 text-left">
                <span className="font-semibold text-slate-800">
                  {CHANNEL_LABELS[channel] ?? channel}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {publishedInChannel}/{channelStores.length} stores published
                </span>
              </div>
              {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Store List */}
            {expanded && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {channelStores.map((store) => {
                  const instance = instanceByStore[store.id];
                  return (
                    <StoreRow
                      key={store.id}
                      store={store}
                      instance={instance}
                      publishing={publishing === store.id}
                      onPublish={() => handlePublishToStore(store)}
                      onEnd={() => instance && handleEndInstance(instance.id)}
                      onSimulateOrder={() => instance && handleSimulateOrder(instance.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {channels.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <StoreIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No stores configured</p>
          <p className="text-sm mt-1">Create stores in Settings to start publishing.</p>
        </div>
      )}
    </div>
  );
}

// ─── Store Row ──────────────────────────────────────────

function StoreRow({
  store,
  instance,
  publishing,
  onPublish,
  onEnd,
  onSimulateOrder,
}: {
  store: Store;
  instance?: ListingChannelInstance;
  publishing: boolean;
  onPublish: () => void;
  onEnd: () => void;
  onSimulateOrder: () => void;
}) {
  const syncStatus = instance?.syncStatus ?? 'not_listed';
  const isPublished = syncStatus === 'synced';

  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-slate-25">
      {/* Store Icon */}
      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 ml-4">
        <StoreIcon className="w-3.5 h-3.5 text-slate-500" />
      </div>

      {/* Store Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">{store.storeName}</span>
          {store.isPrimary && (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">PRIMARY</span>
          )}
          {instance?.isDemo && (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">DEMO</span>
          )}
        </div>
        {instance?.externalId && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-slate-500 font-mono">{instance.externalId}</span>
            {instance.externalUrl && (
              <a href={instance.externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 text-blue-500" />
              </a>
            )}
          </div>
        )}
        {instance?.overridePrice != null && (
          <span className="text-xs text-slate-500">Override: ${Number(instance.overridePrice).toFixed(2)}</span>
        )}
      </div>

      {/* Sync Status */}
      <SyncStatusBadge status={syncStatus} />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!isPublished && syncStatus !== 'ended' && (
          <button
            onClick={onPublish}
            disabled={publishing}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Publish
          </button>
        )}
        {isPublished && (
          <>
            <button
              onClick={onSimulateOrder}
              className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 transition-colors"
              title="Simulate incoming order (demo)"
            >
              <ShoppingCart className="w-3 h-3" />
              Simulate Order
            </button>
            <button
              onClick={onEnd}
              className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-medium rounded hover:bg-red-100 transition-colors"
            >
              <XCircle className="w-3 h-3" />
              End
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ComponentType<any>; bg: string; text: string; label: string }> = {
    synced: { icon: CheckCircle2, bg: 'bg-green-100', text: 'text-green-700', label: 'Published' },
    pending: { icon: Clock, bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
    publishing: { icon: Loader2, bg: 'bg-blue-100', text: 'text-blue-700', label: 'Publishing' },
    error: { icon: AlertCircle, bg: 'bg-red-100', text: 'text-red-700', label: 'Error' },
    ended: { icon: XCircle, bg: 'bg-slate-200', text: 'text-slate-600', label: 'Ended' },
    draft: { icon: Clock, bg: 'bg-slate-100', text: 'text-slate-600', label: 'Draft' },
    not_listed: { icon: Plus, bg: 'bg-slate-100', text: 'text-slate-500', label: 'Not Listed' },
  };

  const c = config[status] ?? config.not_listed;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className={`w-3 h-3 ${status === 'publishing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}
