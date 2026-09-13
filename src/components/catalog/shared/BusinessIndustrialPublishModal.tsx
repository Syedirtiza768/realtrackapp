import { AlertTriangle, CheckCircle2, Loader2, Send, ShieldCheck, Store as StoreIcon, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../lib/authApi';
import { getStoreProfiles, type StoreProfiles } from '../../../lib/multiStoreApi';
import ProfileSelectors from '../ProfileSelectors';
import {
  EMPTY_PROFILE_SELECTION,
  defaultProfileSelection,
  type ProfileSelection,
} from '../profileUtils';
import type { CatalogItem } from './catalogTypes';

export type BusinessIndustrialAccount = {
  id: string;
  storeId: string;
  storeName: string;
  accountName?: string;
  accountDisplayName?: string;
  status?: string;
  connectionStatus?: string;
  marketplaceId?: string | null;
  locationKey?: string | null;
  marketplaces?: Array<{
    marketplaceId: string;
    defaultPaymentPolicyId?: string | null;
    defaultReturnPolicyId?: string | null;
    defaultFulfillmentPolicyId?: string | null;
    defaultInventoryLocationKey?: string | null;
  }>;
};

type PublishResult = { jobId: string; status: string; targetCount?: number; dailyRemaining?: number };
type ValidationResult = {
  blockingErrors?: unknown[];
  errors?: unknown[];
  warnings?: unknown[];
  status?: string;
};
type Props = {
  open: boolean;
  item?: CatalogItem;
  listingIds: string[];
  accounts: BusinessIndustrialAccount[];
  organizationId: string | null;
  onClose: () => void;
  onSubmitted: (result: PublishResult) => void;
};

function messages(value: unknown): string[] {
  if (!Array.isArray(value)) return value == null ? [] : [typeof value === 'string' ? value : JSON.stringify(value)];
  return value.map((entry) => typeof entry === 'string' ? entry : (entry as { message?: unknown })?.message).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function active(account: BusinessIndustrialAccount) {
  return (account.status || account.connectionStatus || '').toLowerCase() === 'active';
}

function accountMarketplace(account: BusinessIndustrialAccount) {
  return account.marketplaces?.find((marketplace) => marketplace.marketplaceId === account.marketplaceId);
}

function policyNameById(
  options: Array<{ name: string; ebayPolicyId?: string }>,
  policyId: string | null | undefined,
) {
  if (!policyId) return undefined;
  return options.find((option) => option.ebayPolicyId === policyId)?.name;
}

/** Prefer the same /stores/:id/profiles path Auto Parts uses; fall back to B&I account policies. */
async function getConnectedStoreProfiles(account: BusinessIndustrialAccount): Promise<StoreProfiles> {
  try {
    const storeProfiles = await getStoreProfiles(account.storeId);
    const count =
      (storeProfiles.shippingProfiles?.length ?? 0) +
      (storeProfiles.returnProfiles?.length ?? 0) +
      (storeProfiles.paymentProfiles?.length ?? 0);
    if (count > 0) return storeProfiles;
  } catch {
    /* fall through to vertical account policies */
  }
  if (!account.marketplaceId) {
    return { shippingProfiles: [], returnProfiles: [], paymentProfiles: [] };
  }
  const result = await fetchWithAuth<{ policies?: Array<{ id: string; policyType?: string; ebayPolicyId?: string; name?: string }> }>(
    '/api/business-industrial/ebay/accounts/' + encodeURIComponent(account.id) + '/policies?marketplaceId=' + encodeURIComponent(account.marketplaceId),
  );
  const policies = result.policies || [];
  const map = (policy: { id: string; ebayPolicyId?: string; name?: string }) => ({
    id: policy.id,
    name: policy.name || policy.ebayPolicyId || policy.id,
    ebayPolicyId: policy.ebayPolicyId || policy.id,
  });
  return {
    shippingProfiles: policies.filter((policy) => policy.policyType === 'fulfillment').map((policy) => ({ ...map(policy), carrier: '', service: '', costType: '' })),
    returnProfiles: policies.filter((policy) => policy.policyType === 'return').map(map),
    paymentProfiles: policies.filter((policy) => policy.policyType === 'payment').map(map),
  };
}

export default function BusinessIndustrialPublishModal({ open, item, listingIds, accounts, organizationId, onClose, onSubmitted }: Props) {
  const mode = listingIds.length > 1 ? 'bulk' : 'single';
  const activeAccounts = useMemo(() => accounts.filter(active).filter((account) => account.storeId), [accounts]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [profileSourceAccountId, setProfileSourceAccountId] = useState('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [busy, setBusy] = useState<'validate' | 'publish' | ''>('');
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);

  const selectedAccounts = useMemo(
    () => activeAccounts.filter((account) => selectedAccountIds.has(account.id)),
    [activeAccounts, selectedAccountIds],
  );
  const profileSourceAccount = useMemo(
    () => activeAccounts.find((account) => account.id === (profileSourceAccountId || selectedAccounts[0]?.id || '')) ?? null,
    [activeAccounts, profileSourceAccountId, selectedAccounts],
  );
  const { data: storeProfiles, isLoading: profilesLoading, error: profilesError } = useQuery<StoreProfiles>({
    queryKey: ['business-industrial-store-profiles', profileSourceAccount?.id, profileSourceAccount?.storeId, profileSourceAccount?.marketplaceId],
    queryFn: () => getConnectedStoreProfiles(profileSourceAccount!),
    enabled: open && mode === 'single' && Boolean(profileSourceAccount?.id && profileSourceAccount.storeId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    setSelectedAccountIds(new Set());
    setProfileSourceAccountId('');
    setValidation(null);
    setBusy('');
    setError('');
    setProfiles(EMPTY_PROFILE_SELECTION);
  }, [open]);

  useEffect(() => {
    if (open && activeAccounts.length && selectedAccountIds.size === 0) {
      setSelectedAccountIds(new Set(activeAccounts.map((account) => account.id)));
    }
  }, [open, activeAccounts, selectedAccountIds.size]);

  useEffect(() => {
    if (!open || mode !== 'single' || !storeProfiles || !profileSourceAccount) return;
    const marketplace = accountMarketplace(profileSourceAccount);
    const storeLike = {
      fulfillmentPolicyName: policyNameById(storeProfiles.shippingProfiles, marketplace?.defaultFulfillmentPolicyId) ?? undefined,
      returnPolicyName: policyNameById(storeProfiles.returnProfiles, marketplace?.defaultReturnPolicyId) ?? undefined,
      paymentPolicyName: policyNameById(storeProfiles.paymentProfiles, marketplace?.defaultPaymentPolicyId) ?? undefined,
    };
    setProfiles(
      defaultProfileSelection(storeProfiles, storeLike as never, {
        shippingProfileName: item?.shippingProfile,
        returnProfileName: item?.returnProfile,
        paymentProfileName: item?.paymentProfile,
      }),
    );
  }, [open, mode, storeProfiles, profileSourceAccount, item]);

  useEffect(() => { setValidation(null); }, [selectedAccountIds, profiles]);

  const connectedLocationKey = profileSourceAccount
    ? (accountMarketplace(profileSourceAccount)?.defaultInventoryLocationKey || profileSourceAccount.locationKey || null)
    : null;

  const policyOverrides = useMemo(() => ({
    fulfillmentPolicyId: profiles.fulfillmentPolicyId,
    paymentPolicyId: profiles.paymentPolicyId,
    returnPolicyId: profiles.returnPolicyId,
    merchantLocationKey: connectedLocationKey || undefined,
    requestedFulfillmentPolicyName: profiles.shippingProfileName || undefined,
    requestedPaymentPolicyName: profiles.paymentProfileName || undefined,
    requestedReturnPolicyName: profiles.returnProfileName || undefined,
  }), [profiles, connectedLocationKey]);

  if (!open) return null;
  const blockingErrors = messages(validation?.blockingErrors ?? validation?.errors);
  const warnings = messages(validation?.warnings);
  const canValidate = Boolean(item && selectedAccounts.length && selectedAccounts.every((account) => account.marketplaceId) && !busy);
  const canPublishSingle = Boolean(item && selectedAccounts.length && selectedAccounts.every((account) => account.marketplaceId) && validation && blockingErrors.length === 0 && !busy);
  const canPublishBulk = selectedAccounts.length > 0 && selectedAccounts.length <= 10 && !busy;

  const targets = selectedAccounts
    .filter((account) => account.marketplaceId)
    .map((account) => ({ ebayAccountId: account.id, marketplaceId: account.marketplaceId!, ...policyOverrides }));

  const toggleAccount = (accountId: string) => setSelectedAccountIds((current) => {
    const next = new Set(current);
    if (next.has(accountId)) next.delete(accountId); else next.add(accountId);
    return next;
  });
  const selectAll = () => setSelectedAccountIds(new Set(activeAccounts.map((account) => account.id)));
  const deselectAll = () => setSelectedAccountIds(new Set());

  const validate = async () => {
    if (!item || !selectedAccounts.length) return;
    setBusy('validate');
    setError('');
    try {
      const result = await fetchWithAuth<{ results?: ValidationResult[] } | ValidationResult>('/api/business-industrial/ebay/listings/validate', {
        method: 'POST',
        body: JSON.stringify({ catalogProductId: item.id, organizationId: organizationId || undefined, targets }),
      });
      const next: ValidationResult = 'results' in result ? (result.results?.[0] || {}) : (result as ValidationResult);
      setValidation(next);
    } catch (reason) {
      setValidation(null);
      setError(reason instanceof Error ? reason.message : 'Unable to validate this listing.');
    } finally { setBusy(''); }
  };

  const publish = async () => {
    setBusy('publish');
    setError('');
    try {
      if (mode === 'single') {
        if (!item || !selectedAccounts.length) throw new Error('Choose at least one active B&I eBay store with a marketplace.');
        const result = await fetchWithAuth<PublishResult>('/api/business-industrial/ebay/listings/publish', {
          method: 'POST',
          body: JSON.stringify({ catalogProductId: item.id, organizationId: organizationId || undefined, targets, idempotencyKey: 'business-industrial-catalog-' + item.id + '-' + Date.now() }),
        });
        onSubmitted(result);
      } else {
        const storeIds = selectedAccounts.map((account) => account.storeId);
        const result = await fetchWithAuth<PublishResult>('/api/business-industrial/ebay/listings/publish-bulk', {
          method: 'POST',
          body: JSON.stringify({ listingIds, storeIds, organizationId: organizationId || undefined, idempotencyKey: 'business-industrial-catalog-bulk-' + Date.now() }),
        });
        onSubmitted(result);
      }
    } catch (reason) {
      const body = (reason as { responseBody?: { failures?: Array<{ errors?: string[] }> } })?.responseBody;
      const failureDetail = Array.isArray(body?.failures)
        ? body.failures.flatMap((failure) => failure.errors || []).filter(Boolean).slice(0, 8).join('; ')
        : '';
      const base = reason instanceof Error ? reason.message : 'Unable to submit the publish job.';
      setError(failureDetail && !base.includes(failureDetail) ? `${base} ${failureDetail}` : base);
    } finally { setBusy(''); }
  };
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Publish Business and Industrial listings" onClick={onClose}>
      <div className="max-h-[min(85vh,calc(100vh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Business &amp; Industrial eBay</p><h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{mode === 'single' ? 'Validate and publish listing' : 'Publish selected listings'}</h2><p className="mt-1 text-sm text-slate-500">{mode === 'single' ? 'Run the marketplace validation first so category, policy, and item-specific blockers are visible.' : `${listingIds.length.toLocaleString()} records will be checked again by the server before they are queued.`}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close publish dialog"><X size={19} /></button></div>
        {item ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing</p><p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{item.title || 'Untitled product'}</p><p className="mt-1 text-xs text-slate-500">{item.sku || 'No SKU'} · validation status: {item.verticalValidationStatus.replace(/_/g, ' ')}</p></div> : null}
        <section className="mt-5" aria-label="eBay account selection"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Destination stores</h3>{activeAccounts.length > 1 ? <div className="flex gap-2"><button type="button" onClick={selectAll} className="text-[10px] text-cyan-600 hover:text-cyan-500 dark:text-cyan-400">Select all</button><span className="text-slate-400">|</span><button type="button" onClick={deselectAll} className="text-[10px] text-slate-500 hover:text-slate-400">Deselect all</button></div> : null}</div>{!activeAccounts.length ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">No active Business &amp; Industrial eBay store is connected. Connect a dedicated B&amp;I store before publishing.</div> : <div className="mt-2 space-y-2">{activeAccounts.map((account) => { const isChecked = selectedAccountIds.has(account.id); const mp = account.marketplaces?.find((value) => value.marketplaceId === account.marketplaceId); const loc = mp?.defaultInventoryLocationKey || account.locationKey; return <button key={account.id} type="button" onClick={() => toggleAccount(account.id)} className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${isChecked ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-950/30' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'}`}><div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isChecked ? 'border-cyan-600 bg-cyan-600' : 'border-slate-300 dark:border-slate-600'}`}>{isChecked ? <svg viewBox="0 0 12 12\" className="h-3 w-3 text-white"><path d="M3.5 6.5L5 8l3.5-4" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg> : null}</div><div className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{account.storeName || account.accountDisplayName || account.accountName || 'B&amp;I store'}</span><span className="block text-xs text-slate-500">{account.marketplaceId || 'Marketplace not configured'}{loc ? ' · location: ' + loc : ' · no location synced'}</span></div><span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">Active</span></button>; })}<p className="text-xs text-slate-500">{mode === 'single' ? 'Selected stores will each receive this listing with the shared policy overrides below.' : 'Select up to 10 stores. Each store uses its own synced policies and inventory location.'}</p></div>}</section>
        {mode === 'single' && selectedAccounts.length > 0 ? <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Connected store policies and location"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connected store policies &amp; location</h3><p className="mt-1 text-xs text-slate-500">These values are loaded from the selected B&amp;I eBay store and sent with every publish target.</p></div><span className="text-xs text-cyan-700 dark:text-cyan-300">{profileSourceAccount?.marketplaceId || 'Marketplace pending'}</span></div>{selectedAccounts.length > 1 ? <div className="mt-3"><label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Profile source store</label><select value={profileSourceAccountId || selectedAccounts[0]?.id || ''} onChange={(event) => setProfileSourceAccountId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">{selectedAccounts.map((account) => <option key={account.id} value={account.id}>{account.storeName || account.accountDisplayName || account.accountName || 'B&amp;I store'}</option>)}</select></div> : null}{profilesLoading ? <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading connected-store profiles…</div> : profilesError ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Unable to load profiles from this store. Sync eBay policies in B&amp;I Stores, then try again.</p> : <><div className="mt-3"><ProfileSelectors profiles={storeProfiles} loading={false} storeLabel={profileSourceAccount?.storeName} value={profiles} onChange={setProfiles} disabled={!profileSourceAccount} /></div><div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70"><span className="font-medium text-slate-700 dark:text-slate-200">Inventory location:</span>{' '}<span className={connectedLocationKey ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-300'}>{connectedLocationKey || 'Not configured on the connected store'}</span></div>{storeProfiles && !storeProfiles.shippingProfiles.length && !storeProfiles.returnProfiles.length && !storeProfiles.paymentProfiles.length ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">No synced business policies were found for this store. Publishing is blocked until the store policies are synchronized.</p> : null}</>}</section> : null}
        {mode === 'bulk' && selectedAccounts.length > 0 ? <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Connected store defaults"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connected store defaults</h3><p className="mt-1 text-xs text-slate-500">Each selected store supplies its own synced policies and inventory location when the bulk job is built.</p><div className="mt-3 space-y-2">{selectedAccounts.map((account) => { const mp = account.marketplaces?.find((value) => value.marketplaceId === account.marketplaceId); const loc = mp?.defaultInventoryLocationKey || account.locationKey; return <div key={account.storeId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70"><span className="truncate font-medium text-slate-700 dark:text-slate-200">{account.storeName}</span><span className={loc ? 'text-slate-500' : 'text-amber-700 dark:text-amber-300'}>{loc || 'Location not synced'}</span></div>; })}</div></section> : null}
        {mode === 'single' ? <section className="mt-5" aria-label="Listing validation"><div className="flex flex-wrap gap-2"><button type="button" disabled={!canValidate} onClick={() => void validate()} className="inline-flex items-center gap-2 rounded-lg border border-cyan-600 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-400 dark:text-cyan-300 dark:hover:bg-cyan-950/30">{busy === 'validate' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {busy === 'validate' ? 'Validating…' : validation ? 'Run validation again' : 'Validate listing'}</button></div>{validation ? <div className="mt-3 space-y-2">{blockingErrors.length ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><div className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Blocking issues</div><ul className="mt-1 list-disc space-y-1 pl-5">{blockingErrors.map((message, index) => <li key={index}>{message}</li>)}</ul></div> : <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 size={15} /> Validation passed; this listing is ready to queue.</div>}{warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Warnings</div><ul className="mt-1 list-disc space-y-1 pl-5">{warnings.map((message, index) => <li key={index}>{message}</li>)}</ul></div> : null}</div> : null}</section> : null}
        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</div> : null}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button><button type="button" disabled={mode === 'single' ? !canPublishSingle : !canPublishBulk} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy === 'publish' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {busy === 'publish' ? 'Submitting…' : mode === 'single' ? `Publish to ${selectedAccounts.length || '…'} store${selectedAccounts.length !== 1 ? 's' : ''}` : `Publish ${listingIds.length.toLocaleString()} listings`}</button></div>
      </div>
    </div>
  );
}
