/* ─── PartsBazar360BulkPublish ─────────────────────────────
 *  Catalog bulk bar → "More". Queues the selected listings for
 *  publishing into partsbazar360.com. Renders nothing until the
 *  channel is configured and a seller is linked.
 * ────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { Loader2, Store } from 'lucide-react';
import { bulkPublish, usePartsBazarStatus } from '../../lib/channelsApi';

interface Props {
  listingIds: string[];
}

export default function PartsBazar360BulkPublish({ listingIds }: Props) {
  const { status } = usePartsBazarStatus();
  const [storeId, setStoreId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const stores = (status?.stores ?? []).filter((s) => s.status === 'active');
  if (!status?.configured || stores.length === 0) return null;

  const target = stores.find((s) => s.storeId === storeId) ?? stores[0];

  const publish = async () => {
    const count = listingIds.length;
    if (
      !window.confirm(
        `Publish ${count} listing${count === 1 ? '' : 's'} to ${target.storeName} on partsbazar360.com?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await bulkPublish(listingIds, ['partsbazar360'], target.storeId);
      const skipped = res.errors.length;
      setResult({
        ok: skipped === 0,
        text:
          `Queued ${res.enqueued} of ${res.total}. Imports finish in the background.` +
          (skipped ? ` ${skipped} could not be queued: ${res.errors.slice(0, 3).join('; ')}` : ''),
      });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'Bulk publish failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stores.length > 1 && (
        <select
          value={target.storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
        >
          {stores.map((s) => (
            <option key={s.storeId} value={s.storeId}>
              {s.storeName}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={publish}
        disabled={busy || listingIds.length === 0}
        className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1.5 text-xs text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-900 dark:text-teal-400 dark:hover:bg-teal-950/30"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Store size={12} />}
        Publish to PartsBazar360
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? 'text-emerald-500' : 'text-red-400'}`}>{result.text}</span>
      )}
    </div>
  );
}
