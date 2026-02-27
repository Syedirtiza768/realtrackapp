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
  useSkuChannels,
  mergeSkuChannelStatuses,
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

  const statuses: SkuChannelStatus[] = mergeSkuChannelStatuses(connections, listings);

  const handleAction = useCallback(
    async (action: 'update' | 'end' | 'retry', channel: ChannelKey) => {
      setBusy(`${action}-${channel}`);
      try {
        if (action === 'update') await updateOnChannel(listingId, channel);
        if (action === 'end') await endOnChannel(listingId, channel);
        if (action === 'retry') await retryOnChannel(listingId, channel);
        await refetch();
      } catch {
        // error is shown in the tile via lastError on refetch
      } finally {
        setBusy(null);
      }
    },
    [listingId, refetch],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={18} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Channels</h5>
        {onPublish && (
          <button
            onClick={() => onPublish(listingId)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Send size={11} /> List on Channels
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {statuses.map((s) => (
          <ChannelTile
            key={s.channel}
            status={s}
            busy={busy}
            onAction={handleAction}
            onPublish={onPublish ? () => onPublish(listingId) : undefined}
          />
        ))}
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
}: {
  status: SkuChannelStatus;
  busy: string | null;
  onAction: (action: 'update' | 'end' | 'retry', channel: ChannelKey) => void;
  onPublish?: () => void;
}) {
  const meta = CHANNEL_META[status.channel];
  const listingStatus = status.listing?.status ?? 'not_listed';
  const isBusy = busy?.endsWith(status.channel);

  return (
    <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40 space-y-2">
      {/* Header: channel name + status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{meta.icon}</span>
          <span className="text-sm font-medium text-slate-200">{meta.label}</span>
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
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
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

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        {/* Not listed → Publish */}
        {(listingStatus === 'not_listed' || listingStatus === 'ended') && status.connected && onPublish && (
          <ActionButton icon={<Send size={11} />} label="Publish" onClick={onPublish} busy={false} />
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
      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200';

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
