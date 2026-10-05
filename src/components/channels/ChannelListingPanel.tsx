/* ─── ChannelListingPanel ──────────────────────────────────
 *  Per-SKU channel status panel. Shows each channel as a
 *  tile with status badge, last sync, and action buttons.
 *  Reusable in DetailModal and any detail page.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useState } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Send,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  CHANNEL_META,
  statusLabel,
  statusColor,
  type ChannelKey,
  type SkuChannelStatus,
} from '../../types/channels';
import {
  useConnections,
  usePartsBazarStatus,
  useSkuChannels,
  mergeSkuChannelStatuses,
  publishToChannels,
  refreshPartsBazarListing,
  updateOnChannel,
  endOnChannel,
  retryOnChannel,
} from '../../lib/channelsApi';

interface Props {
  listingId: string;
  onPublish?: (listingId: string) => void;  // opens the PublishModal
}

export default function ChannelListingPanel({ listingId, onPublish }: Props) {
  const { connections } = useConnections();
  const { listings, loading, refetch } = useSkuChannels(listingId);
  const [busy, setBusy] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const { status: partsbazar } = usePartsBazarStatus();
  const [partsbazarStoreId, setPartsbazarStoreId] = useState('');
  const partsbazarStores = (partsbazar?.stores ?? []).filter((s) => s.status === 'active');
  const selectedPartsbazarStore = partsbazarStoreId || partsbazarStores[0]?.storeId;

  const statuses: SkuChannelStatus[] = mergeSkuChannelStatuses(connections, listings);

  const handleAction = useCallback(
    async (action: 'update' | 'end' | 'retry', channel: ChannelKey) => {
      setBusy(`${action}-${channel}`);
      try {
        if (action === 'update') await updateOnChannel(listingId, channel);
        if (action === 'end') await endOnChannel(listingId, channel);
        if (action === 'retry') {
          await retryOnChannel(
            listingId,
            channel,
            channel === 'partsbazar360' ? selectedPartsbazarStore : undefined,
          );
        }
        await refetch();
      } catch {
        // error is shown in the tile via lastError on refetch
      } finally {
        setBusy(null);
      }
    },
    [listingId, refetch, selectedPartsbazarStore],
  );

  /* PartsBazar360 is a direct push channel: publish here instead of opening the eBay store modal. */
  const publishToPartsBazar = useCallback(async () => {
    setBusy('publish-partsbazar360');
    setPanelError(null);
    try {
      const res = await publishToChannels(
        listingId,
        ['partsbazar360'],
        undefined,
        selectedPartsbazarStore,
      );
      const failure = res.results.find((r) => r.error);
      if (failure) setPanelError(failure.error ?? 'Could not queue the publish');
      await refetch();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Could not queue the publish');
    } finally {
      setBusy(null);
    }
  }, [listingId, selectedPartsbazarStore, refetch]);

  const refreshPartsBazar = useCallback(async () => {
    setBusy('refresh-partsbazar360');
    setPanelError(null);
    try {
      await refreshPartsBazarListing(listingId);
      await refetch();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Could not refresh status');
    } finally {
      setBusy(null);
    }
  }, [listingId, refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={18} className="animate-spin text-slate-500 dark:text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Channels</h5>
        {onPublish && (
          <button
            onClick={() => onPublish(listingId)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Send size={11} /> List on Channels
          </button>
        )}
      </div>

      {panelError && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">{panelError}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {statuses.map((s) =>
          s.channel === 'partsbazar360' ? (
            <ChannelTile
              key={s.channel}
              status={s}
              busy={busy}
              onAction={handleAction}
              onPublish={publishToPartsBazar}
              onRefresh={refreshPartsBazar}
              stores={partsbazarStores.map((st) => ({ id: st.storeId, name: st.storeName }))}
              storeId={selectedPartsbazarStore}
              onStoreChange={setPartsbazarStoreId}
            />
          ) : (
            <ChannelTile
              key={s.channel}
              status={s}
              busy={busy}
              onAction={handleAction}
              onPublish={onPublish ? () => onPublish(listingId) : undefined}
            />
          ),
        )}
      </div>
    </div>
  );
}

/* ── Channel tile ─────────────────────────────────────────── */

function ChannelTile({
  status,
  busy,
  onAction,
  onPublish,
  onRefresh,
  stores,
  storeId,
  onStoreChange,
}: {
  status: SkuChannelStatus;
  busy: string | null;
  onAction: (action: 'update' | 'end' | 'retry', channel: ChannelKey) => void;
  onPublish?: () => void;
  /** Re-check an in-flight publish (channels that confirm asynchronously). */
  onRefresh?: () => void;
  /** Destinations, when a channel has several to pick from. */
  stores?: Array<{ id: string; name: string }>;
  storeId?: string;
  onStoreChange?: (storeId: string) => void;
}) {
  const meta = CHANNEL_META[status.channel];
  const listingStatus = status.listing?.status ?? 'not_listed';
  const isBusy = busy?.endsWith(status.channel);

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white/40 dark:bg-slate-900/40 space-y-2">
      {/* Header: channel name + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.icon}</span>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-200">{meta.label}</span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor(listingStatus)}`}>
          {statusLabel(listingStatus)}
        </span>
      </div>

      {/* Connection status indicator */}
      {!status.connected && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle size={11} />
          <span>Not connected</span>
        </div>
      )}

      {/* Last sync info */}
      {status.listing?.lastSyncedAt && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Clock size={10} />
          <span>Synced {new Date(status.listing.lastSyncedAt).toLocaleDateString()}</span>
        </div>
      )}

      {/* Error display */}
      {status.listing?.lastError && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1 line-clamp-2">
          {status.listing.lastError}
        </div>
      )}

      {/* External link */}
      {status.listing?.externalUrl && (
        <a
          href={status.listing.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ExternalLink size={10} /> View on {meta.label}
        </a>
      )}

      {/* Destination picker (only when there is a real choice) */}
      {stores && stores.length > 1 && onStoreChange && (
        <select
          value={storeId}
          onChange={(e) => onStoreChange(e.target.value)}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
        >
          {stores.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        {/* Not listed → Publish */}
        {(listingStatus === 'not_listed' || listingStatus === 'ended') && status.connected && onPublish && (
          <ActionButton
            icon={<Send size={11} />}
            label="Publish"
            onClick={onPublish}
            busy={busy === `publish-${status.channel}`}
          />
        )}

        {/* Active → Update / End */}
        {listingStatus === 'active' && (
          <>
            <ActionButton
              icon={<RefreshCw size={11} />}
              label="Update"
              onClick={() => onAction('update', status.channel)}
              busy={isBusy && busy?.startsWith('update')}
            />
            <ActionButton
              icon={<XCircle size={11} />}
              label="End"
              variant="danger"
              onClick={() => onAction('end', status.channel)}
              busy={isBusy && busy?.startsWith('end')}
            />
          </>
        )}

        {/* Failed → Retry */}
        {listingStatus === 'failed' && (
          <ActionButton
            icon={<RefreshCw size={11} />}
            label="Retry"
            onClick={() => onAction('retry', status.channel)}
            busy={isBusy && busy?.startsWith('retry')}
          />
        )}

        {/* Publishing → spinner */}
        {listingStatus === 'publishing' && (
          <div className="flex items-center gap-1.5 text-xs text-blue-400">
            <Loader2 size={11} className="animate-spin" />
            Publishing…
            {onRefresh && (
              <ActionButton
                icon={<RefreshCw size={11} />}
                label="Check"
                onClick={onRefresh}
                busy={busy === `refresh-${status.channel}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Reusable action button ───────────────────────────────── */

function ActionButton({
  icon,
  label,
  onClick,
  busy,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  busy?: boolean | null;
  variant?: 'default' | 'danger';
}) {
  const colors =
    variant === 'danger'
      ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-600 dark:text-slate-200';

  return (
    <button
      onClick={onClick}
      disabled={!!busy}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors disabled:opacity-50 ${colors}`}
    >
      {busy ? <Loader2 size={11} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
