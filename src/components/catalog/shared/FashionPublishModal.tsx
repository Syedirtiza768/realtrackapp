import { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, Store as StoreIcon, X } from 'lucide-react';
import { fetchWithAuth } from '../../../lib/authApi';
import type { BusinessIndustrialAccount } from './BusinessIndustrialPublishModal';

type Policy = { id: string; ebayPolicyId?: string; name: string; policyType: 'fulfillment' | 'payment' | 'return'; marketplaceId: string };
type PolicySelection = { fulfillment: string; payment: string; return: string };
type PublishResult = { jobId: string; status: string; targetCount?: number; dailyRemaining?: number };
type Props = {
  open: boolean;
  listingIds: string[];
  accounts: BusinessIndustrialAccount[];
  organizationId: string | null;
  onClose: () => void;
  onSubmitted: (result: PublishResult) => void;
};

const emptySelection = (): PolicySelection => ({ fulfillment: '', payment: '', return: '' });
const isActive = (account: BusinessIndustrialAccount) => (account.status || account.connectionStatus || '').toLowerCase() === 'active';
function defaults(account: BusinessIndustrialAccount, policies: Policy[]): PolicySelection {
  const marketplace = account.marketplaces?.find((row) => row.marketplaceId === account.marketplaceId);
  const pick = (kind: PolicySelectionKey, id?: string | null) => policies.find((policy) => policy.policyType === policyType(kind) && policy.ebayPolicyId === id)?.name || '';
  return {
    fulfillment: pick('fulfillment', marketplace?.defaultFulfillmentPolicyId),
    payment: pick('payment', marketplace?.defaultPaymentPolicyId),
    return: pick('return', marketplace?.defaultReturnPolicyId),
  };
}
type PolicySelectionKey = keyof PolicySelection;
const policyType = (kind: PolicySelectionKey): Policy['policyType'] => kind === 'fulfillment' ? 'fulfillment' : kind;

/** Fashion multi-item publisher. Store and policy choices are made here in Catalog. */
export default function FashionPublishModal({ open, listingIds, accounts, organizationId, onClose, onSubmitted }: Props) {
  const activeAccounts = useMemo(() => accounts.filter((account) => isActive(account) && account.storeId && account.marketplaceId), [accounts]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [policies, setPolicies] = useState<Record<string, Policy[]>>({});
  const [selections, setSelections] = useState<Record<string, PolicySelection>>({});
  const [policyLoading, setPolicyLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelected(new Set()); setPolicies({}); setSelections({}); setPolicyLoading(false); setBusy(false); setError('');
  }, [open]);
  useEffect(() => {
    if (!open || selected.size === 0) return;
    let cancelled = false;
    const chosen = activeAccounts.filter((account) => selected.has(account.id));
    setPolicyLoading(true);
    Promise.all(chosen.map(async (account) => {
      const query = new URLSearchParams({ marketplaceId: account.marketplaceId || '' });
      if (organizationId) query.set('organizationId', organizationId);
      const result = await fetchWithAuth<{ policies?: Policy[] }>(`/api/fashion/ebay/accounts/${encodeURIComponent(account.id)}/policies?${query}`);
      return [account, result.policies || []] as const;
    })).then((rows) => {
      if (cancelled) return;
      setPolicies((current) => Object.fromEntries([...Object.entries(current), ...rows.map(([account, values]) => [account.id, values])]));
      setSelections((current) => {
        const next = { ...current };
        for (const [account, values] of rows) next[account.id] ??= defaults(account, values);
        return next;
      });
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load store policies.');
    }).finally(() => { if (!cancelled) setPolicyLoading(false); });
    return () => { cancelled = true; };
  }, [open, selected, activeAccounts, organizationId]);

  if (!open) return null;
  const chosenAccounts = activeAccounts.filter((account) => selected.has(account.id));
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const updatePolicy = (id: string, key: PolicySelectionKey, value: string) => setSelections((current) => ({ ...current, [id]: { ...emptySelection(), ...current[id], [key]: value } }));
  const publish = async () => {
    if (!chosenAccounts.length) return;
    setBusy(true); setError('');
    try {
      const result = await fetchWithAuth<PublishResult>('/api/fashion/ebay/listings/publish-bulk', {
        method: 'POST',
        body: JSON.stringify({
          listingIds,
          storeIds: chosenAccounts.map((account) => account.storeId),
          storePolicies: chosenAccounts.map((account) => ({
            storeId: account.storeId,
            ...(selections[account.id]?.fulfillment ? { requestedFulfillmentPolicyName: selections[account.id].fulfillment } : {}),
            ...(selections[account.id]?.payment ? { requestedPaymentPolicyName: selections[account.id].payment } : {}),
            ...(selections[account.id]?.return ? { requestedReturnPolicyName: selections[account.id].return } : {}),
          })),
          organizationId: organizationId || undefined,
          idempotencyKey: `fashion-catalog-${crypto.randomUUID()}`,
        }),
      });
      onSubmitted(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the Fashion publish job.');
    } finally { setBusy(false); }
  };

  const field = (account: BusinessIndustrialAccount, key: PolicySelectionKey, label: string) => {
    const options = policies[account.id]?.filter((policy) => policy.policyType === policyType(key)) || [];
    return <label className="grid gap-1 text-xs text-slate-500" key={key}>{label}
      <select className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" value={selections[account.id]?.[key] || ''} onChange={(event) => updatePolicy(account.id, key, event.target.value)}>
        <option value="">Use store default</option>
        {options.map((policy) => <option key={policy.ebayPolicyId || policy.id} value={policy.name}>{policy.name}</option>)}
      </select>
    </label>;
  };

  return <div className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Publish Fashion catalog items" onClick={onClose}>
    <div className="max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-slate-900 sm:rounded-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-pink-600">Fashion Catalog</p><h2 className="mt-1 text-xl font-semibold">Choose stores and policies</h2><p className="mt-1 text-sm text-slate-500">{listingIds.length.toLocaleString()} selected item{listingIds.length === 1 ? '' : 's'}. Each chosen store gets its own policy selection.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close publish dialog"><X size={19} /></button></div>
      <section className="mt-5" aria-label="Destination stores">
        {!activeAccounts.length ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">No active Fashion eBay stores are available to your account. Connect one in <a href="/fashion/stores" className="underline">Fashion Stores</a>.</p> : <div className="space-y-3">
          {activeAccounts.map((account) => {
            const checked = selected.has(account.id);
            return <div key={account.id} className={`rounded-xl border p-3 ${checked ? 'border-pink-400 bg-pink-50/60 dark:border-pink-700 dark:bg-pink-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={checked} onChange={() => toggle(account.id)} className="h-4 w-4 accent-pink-600" /><StoreIcon size={17} className="text-pink-600" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{account.storeName || account.accountName || 'Fashion eBay store'}</span><span className="block text-xs text-slate-500">{account.marketplaceId}</span></span><span className="text-xs text-emerald-700 dark:text-emerald-300">Active</span></label>
              {checked && <div className="mt-3 grid gap-3 border-t border-pink-100 pt-3 sm:grid-cols-3 dark:border-pink-900/50">
                {policyLoading && !policies[account.id] ? <p className="text-xs text-slate-500 sm:col-span-3"><Loader2 size={14} className="mr-1 inline animate-spin" />Loading this store's policies…</p> : <>{field(account, 'fulfillment', 'Shipping policy')}{field(account, 'payment', 'Payment policy')}{field(account, 'return', 'Return policy')}</>}
                {policies[account.id] && !policies[account.id].length && <p className="text-xs text-amber-700 sm:col-span-3 dark:text-amber-300">No synced policies were returned. The store's defaults will be used; sync policies under Fashion Stores to choose different ones.</p>}
              </div>}
            </div>;
          })}
          <p className="text-xs text-slate-500">Unselected items stay in Catalog. Marketplace validation and Fashion authenticity approval are checked by the server before jobs are queued.</p>
        </div>}
      </section>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
      <div className="mt-6 flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border px-4 text-sm">Cancel</button><button type="button" disabled={!chosenAccounts.length || busy || policyLoading} onClick={() => void publish()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{busy ? 'Submitting…' : `Publish to ${chosenAccounts.length} store${chosenAccounts.length === 1 ? '' : 's'}`}</button></div>
    </div>
  </div>;
}
