import { useEffect, useMemo, useState } from 'react';
import { Loader2, Rocket, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import type { BusinessIndustrialAccount } from '../../catalog/shared/BusinessIndustrialPublishModal';
import { batchApi, messageOf } from './batchApi';

type Props = {
  open: boolean;
  accounts: BusinessIndustrialAccount[];
  organizationId: string | null;
  onClose: () => void;
};

const isActive = (a: BusinessIndustrialAccount) => (a.status || a.connectionStatus || '').toLowerCase() === 'active';

/**
 * "Publish next N": picks the oldest N unpublished Fashion listings, processes
 * their photos into S3, runs the counterfeit/VeRO check and (live only) publishes
 * the ones that pass. Dry run never calls eBay publish.
 */
export default function FashionBatchPublishModal({ open, accounts, organizationId, onClose }: Props) {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canConfirm = permissions.includes('fashion.review') && permissions.includes('fashion.authenticity.review');
  const usable = useMemo(() => accounts.filter((a) => a.storeId), [accounts]);
  const [size, setSize] = useState(100);
  const [dryRun, setDryRun] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmed(false);
    if (!accountId) setAccountId(usable.find(isActive)?.id ?? '');
  }, [open, usable, accountId]);

  if (!open) return null;
  const account = usable.find((a) => a.id === accountId);
  const liveBlocked = !dryRun && (!account || !isActive(account) || !confirmed || !canConfirm);
  const sizeValid = Number.isInteger(size) && size >= 1 && size <= 500;

  async function submit() {
    if (busy || !sizeValid || liveBlocked) return;
    setBusy(true);
    setError('');
    try {
      const result = await batchApi.create({
        size,
        dryRun,
        ebayAccountId: account?.id,
        marketplaceId: account?.marketplaceId ?? undefined,
        confirmAuthenticity: dryRun ? undefined : confirmed,
        organizationId: organizationId ?? undefined,
      });
      onClose();
      navigate(`/fashion/batches/${result.batchId}`);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="batch-publish-title">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="batch-publish-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Publish next listings</h2>
            <p className="mt-1 text-sm text-slate-500">Takes the oldest unpublished Fashion listings, stores their photos in S3, checks them for counterfeit and VeRO risk, then publishes the ones that pass.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            How many listings
            <input type="number" min={1} max={500} value={size} onChange={(e) => setSize(Math.floor(Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />
            {!sizeValid ? <span className="mt-1 block text-xs text-red-600">Enter 1–500.</span> : null}
          </label>

          <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-sm font-medium text-slate-700 dark:text-slate-200">Mode</legend>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input type="radio" name="mode" className="mt-1" checked={dryRun} onChange={() => setDryRun(true)} />
              <span><span className="font-medium">Dry run</span><span className="block text-xs text-slate-500">Process photos and run the checks; shows what would publish. Nothing is sent to eBay and listings are not edited.</span></span>
            </label>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input type="radio" name="mode" className="mt-1" checked={!dryRun} onChange={() => setDryRun(false)} />
              <span><span className="font-medium">Publish live</span><span className="block text-xs text-slate-500">Applies safe fixes and publishes listings that pass to eBay. Listings that need review stay in the review queue.</span></span>
            </label>
          </fieldset>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            eBay store {dryRun ? <span className="font-normal text-slate-500">(optional for a dry run)</span> : null}
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">{dryRun ? 'No store' : 'Choose a store'}</option>
              {usable.map((a) => (
                <option key={a.id} value={a.id} disabled={!dryRun && !isActive(a)}>
                  {a.storeName}{a.marketplaceId ? ` · ${a.marketplaceId}` : ''}{isActive(a) ? '' : ' · needs reconnect'}
                </option>
              ))}
            </select>
          </label>

          {!dryRun ? (
            canConfirm ? (
              <label className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>I confirm authenticity for listings in this batch that <strong>pass</strong> the compliance check. Each one is recorded as approved by me. Listings that need review or are blocked are not published.</span>
              </label>
            ) : (
              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Live batches need a Fashion reviewer (review + authenticity review permissions). Run a dry run, or ask a reviewer to start the live batch.</p>
            )
          ) : null}

          {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy || !sizeValid || liveBlocked} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <Rocket size={16} />}
            {dryRun ? `Dry run next ${sizeValid ? size : ''}` : `Publish next ${sizeValid ? size : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
