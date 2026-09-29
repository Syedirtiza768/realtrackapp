/* ─── PartsBazar360SetupCard ───────────────────────────────
 *  Settings → Channels. Links a PartsBazar360 seller as a
 *  publish destination. The link is verified against the live
 *  partsbazar360.com API before anything is saved.
 * ────────────────────────────────────────────────────────── */

import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { connectPartsBazar, usePartsBazarStatus } from '../../lib/channelsApi';

interface Props {
  /** Called after a seller is linked so the parent can refresh its lists. */
  onConnected?: () => void;
}

export default function PartsBazar360SetupCard({ onConnected }: Props) {
  const { status, loading, refetch } = usePartsBazarStatus();
  const [storeName, setStoreName] = useState('');
  const [sellerStoreId, setSellerStoreId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!storeName.trim() || !sellerStoreId.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await connectPartsBazar({
        storeName: storeName.trim(),
        sellerStoreId: sellerStoreId.trim(),
      });
      setMessage({
        ok: true,
        text: `Linked${result.seller ? ` to ${result.seller.name}` : ''}. You can now publish listings to it.`,
      });
      setStoreName('');
      setSellerStoreId('');
      await refetch();
      onConnected?.();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not link seller' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store size={18} className="text-teal-500" />
          PartsBazar360
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Publish listings straight into{' '}
          <span className="font-medium text-slate-600 dark:text-slate-200">partsbazar360.com</span>. Each destination is
          one PartsBazar360 seller, identified by its store ID on that site. Price is sent as the seller price; the
          marketplace applies its own pricing.
        </p>

        {loading ? (
          <Loader2 size={16} className="animate-spin text-slate-500" />
        ) : !status ? (
          <p className="text-sm text-red-400">Could not read PartsBazar360 status.</p>
        ) : !status.configured ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>
              Not enabled on this server. Set <code>PARTSBAZAR360_API_KEY</code> (the same value as{' '}
              <code>REALTRACK_PUSH_API_KEY</code> on partsbazar360.com) and restart the backend.
            </span>
          </div>
        ) : (
          <>
            {status.stores.length > 0 && (
              <ul className="space-y-2">
                {status.stores.map((store) => (
                  <li
                    key={store.storeId}
                    className="flex items-center justify-between rounded-lg bg-slate-100/50 px-3 py-2 dark:bg-slate-800/50"
                  >
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{store.storeName}</p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{store.sellerStoreId}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        store.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {store.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Label, e.g. PartsBazar – Blackline"
                maxLength={200}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <input
                value={sellerStoreId}
                onChange={(e) => setSellerStoreId(e.target.value)}
                placeholder="Seller store ID on PartsBazar360"
                maxLength={120}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-900"
              />
              <button
                type="submit"
                disabled={busy || !storeName.trim() || !sellerStoreId.trim()}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Link seller
              </button>
            </form>
          </>
        )}

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
              message.ok
                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border border-red-500/20 bg-red-500/10 text-red-400'
            }`}
          >
            {message.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
