import { AlertTriangle, CheckCircle2, Loader2, Send, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '../../../lib/authApi';
import type { StoreProfiles } from '../../../lib/multiStoreApi';
import ProfileSelectors from '../ProfileSelectors';
import { EMPTY_PROFILE_SELECTION, type ProfileSelection } from '../profileUtils';
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
type ValidationResult = { blockingErrors?: unknown[]; warnings?: unknown[]; status?: string };
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

function pickConnectedProfile(
  options: Array<{ name: string; ebayPolicyId?: string }>,
  defaultPolicyId: string | null | undefined,
  listingName: string | null | undefined,
) {
  return (
    (defaultPolicyId && options.find((option) => option.ebayPolicyId === defaultPolicyId)?.name) ||
    (listingName && options.some((option) => option.name === listingName) ? listingName : '') ||
    options[0]?.name ||
    ''
  );
}

async function getConnectedStoreProfiles(accountId: string, marketplaceId: string): Promise<StoreProfiles> {
  const result = await fetchWithAuth<{ policies?: Array<{ id: string; policyType?: string; ebayPolicyId?: string; name?: string }> }>(
    '/api/business-industrial/ebay/accounts/' + encodeURIComponent(accountId) + '/policies?marketplaceId=' + encodeURIComponent(marketplaceId),
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
  const [accountId, setAccountId] = useState('');
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [busy, setBusy] = useState<'validate' | 'publish' | ''>('');
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<ProfileSelection>(EMPTY_PROFILE_SELECTION);

  const selectedAccount = activeAccounts.find((account) => account.id === accountId);
  const selectedMarketplace = selectedAccount?.marketplaces?.find(
    (marketplace) => marketplace.marketplaceId === selectedAccount.marketplaceId,
  );
  const connectedLocationKey =
    selectedMarketplace?.defaultInventoryLocationKey || selectedAccount?.locationKey || null;
  const { data: storeProfiles, isLoading: profilesLoading, error: profilesError } = useQuery<StoreProfiles>({
    queryKey: ['business-industrial-store-profiles', selectedAccount?.id, selectedAccount?.marketplaceId],
    queryFn: () => getConnectedStoreProfiles(selectedAccount!.id, selectedAccount!.marketplaceId!),
    enabled: open && mode === 'single' && Boolean(selectedAccount?.id && selectedAccount.marketplaceId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const first = activeAccounts.find((account) => account.marketplaceId) || activeAccounts[0];
    setAccountId(first?.id || '');
    setStoreIds(first ? [first.storeId] : []);
    setValidation(null);
    setBusy('');
    setError('');
    setProfiles(EMPTY_PROFILE_SELECTION);
  }, [open, activeAccounts]);

  useEffect(() => {
    if (!open || mode !== 'single' || !storeProfiles || !selectedAccount) return;
    const next = {
      shippingProfileName: pickConnectedProfile(
        storeProfiles.shippingProfiles,
        selectedMarketplace?.defaultFulfillmentPolicyId,
        item?.shippingProfile,
      ),
      returnProfileName: pickConnectedProfile(
        storeProfiles.returnProfiles,
        selectedMarketplace?.defaultReturnPolicyId,
        item?.returnProfile,
      ),
      paymentProfileName: pickConnectedProfile(
        storeProfiles.paymentProfiles,
        selectedMarketplace?.defaultPaymentPolicyId,
        item?.paymentProfile,
      ),
    };
    const shipping = storeProfiles.shippingProfiles.find((profile) => profile.name === next.shippingProfileName);
    const returns = storeProfiles.returnProfiles.find((profile) => profile.name === next.returnProfileName);
    const payment = storeProfiles.paymentProfiles.find((profile) => profile.name === next.paymentProfileName);
    setProfiles({
      ...next,
      fulfillmentPolicyId: shipping?.ebayPolicyId,
      returnPolicyId: returns?.ebayPolicyId,
      paymentPolicyId: payment?.ebayPolicyId,
    });
  }, [open, mode, storeProfiles, selectedAccount, selectedMarketplace, item]);

  if (!open) return null;
  const blockingErrors = messages(validation?.blockingErrors);
  const warnings = messages(validation?.warnings);
  const canValidate = Boolean(item && selectedAccount?.marketplaceId && !busy);
  const canPublishSingle = Boolean(item && selectedAccount?.marketplaceId && validation && blockingErrors.length === 0 && !busy);
  const canPublishBulk = storeIds.length > 0 && storeIds.length <= 10 && !busy;
  const policyOverrides = useMemo(() => ({
    fulfillmentPolicyId: profiles.fulfillmentPolicyId,
    paymentPolicyId: profiles.paymentPolicyId,
    returnPolicyId: profiles.returnPolicyId,
    merchantLocationKey: connectedLocationKey || undefined,
    requestedFulfillmentPolicyName: profiles.shippingProfileName || undefined,
    requestedPaymentPolicyName: profiles.paymentProfileName || undefined,
    requestedReturnPolicyName: profiles.returnProfileName || undefined,
  }), [profiles, connectedLocationKey]);

  const selectedTarget = selectedAccount?.marketplaceId ? {
    ebayAccountId: selectedAccount.id,
    marketplaceId: selectedAccount.marketplaceId,
    ...policyOverrides,
  } : null;

  const validate = async () => {
    if (!item || !selectedAccount?.marketplaceId) return;
    setBusy('validate');
    setError('');
    try {
      const result = await fetchWithAuth<{ results?: ValidationResult[] } | ValidationResult>('/api/business-industrial/ebay/listings/validate', {
        method: 'POST',
        body: JSON.stringify({
          catalogProductId: item.id,
          organizationId: organizationId || undefined,
          targets: selectedTarget ? [selectedTarget] : [],
        }),
      });
      const next: ValidationResult = 'results' in result
        ? (result.results?.[0] || {})
        : (result as ValidationResult);
      setValidation(next);
    } catch (reason) {
      setValidation(null);
      setError(reason instanceof Error ? reason.message : 'Unable to validate this listing.');
    } finally {
      setBusy('');
    }
  };

  const publish = async () => {
    setBusy('publish');
    setError('');
    try {
      if (mode === 'single') {
        if (!item || !selectedAccount?.marketplaceId) throw new Error('Choose an active B&I eBay account with a marketplace.');
        const result = await fetchWithAuth<PublishResult>('/api/business-industrial/ebay/listings/publish', {
          method: 'POST',
          body: JSON.stringify({
            catalogProductId: item.id,
            organizationId: organizationId || undefined,
            targets: selectedTarget ? [selectedTarget] : [],
            idempotencyKey: 'business-industrial-catalog-' + item.id + '-' + Date.now(),
          }),
        });
        onSubmitted(result);
      } else {
        const result = await fetchWithAuth<PublishResult>('/api/business-industrial/ebay/listings/publish-bulk', {
          method: 'POST',
          body: JSON.stringify({
            listingIds,
            storeIds,
            organizationId: organizationId || undefined,
            idempotencyKey: 'business-industrial-catalog-bulk-' + Date.now(),
          }),
        });
        onSubmitted(result);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit the publish job.');
    } finally {
      setBusy('');
    }
  };

  const toggleStore = (storeId: string) => setStoreIds((current) => current.includes(storeId) ? current.filter((id) => id !== storeId) : [...current, storeId].slice(0, 10));
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Publish Business and Industrial listings">
      <div className="max-h-[min(760px,calc(100vh-2rem))] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Business &amp; Industrial eBay</p><h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{mode === 'single' ? 'Validate and publish listing' : 'Publish selected listings'}</h2><p className="mt-1 text-sm text-slate-500">{mode === 'single' ? 'Run the marketplace validation first so category, policy, and item-specific blockers are visible.' : `${listingIds.length.toLocaleString()} records will be checked again by the server before they are queued.`}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close publish dialog"><X size={19} /></button></div>
        {item ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing</p><p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{item.title || 'Untitled product'}</p><p className="mt-1 text-xs text-slate-500">{item.sku || 'No SKU'} · validation status: {item.verticalValidationStatus.replace(/_/g, ' ')}</p></div> : null}
        <section className="mt-5" aria-label="eBay account selection"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">{mode === 'single' ? 'Destination account' : 'Destination stores'}</h3>{!activeAccounts.length ? <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">No active Business &amp; Industrial eBay store is connected. Connect a dedicated B&amp;I store before publishing.</div> : mode === 'single' ? <div className="mt-2 space-y-2">{activeAccounts.map((account) => <label key={account.id} className={'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ' + (account.id === accountId ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-950/30' : 'border-slate-200 dark:border-slate-700')}><input type="radio" name="bi-publish-account" checked={account.id === accountId} onChange={() => { setAccountId(account.id); setValidation(null); }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{account.storeName || account.accountDisplayName || account.accountName || 'B&amp;I store'}</span><span className="block text-xs text-slate-500">{account.marketplaceId || 'Marketplace not configured'} · connected</span></span></label>)}</div> : <div className="mt-2 space-y-2">{activeAccounts.map((account) => <label key={account.storeId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700"><input type="checkbox" checked={storeIds.includes(account.storeId)} onChange={() => toggleStore(account.storeId)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{account.storeName || account.accountDisplayName || account.accountName || 'B&amp;I store'}</span><span className="block text-xs text-slate-500">{account.marketplaceId || 'Marketplace not configured'}</span></span></label>)}<p className="text-xs text-slate-500">Select up to 10 stores. The server re-checks approval, category, policies, and B&amp;I store ownership for every record.</p></div>}</section>
        {mode === 'single' ? <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Connected store policies"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connected store policies &amp; location</h3><p className="mt-1 text-xs text-slate-500">These values are loaded from the selected B&amp;I eBay store and sent with the publish request.</p></div><span className="text-xs text-cyan-700 dark:text-cyan-300">{selectedAccount?.marketplaceId || 'Marketplace pending'}</span></div>{profilesLoading ? <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading connected-store profiles…</div> : profilesError ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Unable to load profiles from this store. Sync eBay policies in B&amp;I Stores, then try again.</p> : <><div className="mt-3"><ProfileSelectors profiles={storeProfiles} loading={false} storeLabel={selectedAccount?.storeName} value={profiles} onChange={setProfiles} disabled={!selectedAccount} /></div><div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70"><span className="font-medium text-slate-700 dark:text-slate-200">Inventory location:</span>{' '}<span className={connectedLocationKey ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-300'}>{connectedLocationKey || 'Not configured on the connected store'}</span></div>{storeProfiles && !storeProfiles.shippingProfiles.length && !storeProfiles.returnProfiles.length && !storeProfiles.paymentProfiles.length ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">No synced business policies were found for this store. Publishing is blocked until the store policies are synchronized.</p> : null}</>}</section> : <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Connected store defaults"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connected store defaults</h3><p className="mt-1 text-xs text-slate-500">Each selected store supplies its own synced policies and inventory location when the bulk job is built.</p><div className="mt-3 space-y-2">{activeAccounts.filter((account) => storeIds.includes(account.storeId)).map((account) => { const marketplace = account.marketplaces?.find((value) => value.marketplaceId === account.marketplaceId); const location = marketplace?.defaultInventoryLocationKey || account.locationKey; return <div key={account.storeId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/70"><span className="truncate font-medium text-slate-700 dark:text-slate-200">{account.storeName}</span><span className={location ? 'text-slate-500' : 'text-amber-700 dark:text-amber-300'}>{location || 'Location not synced'}</span></div>; })}</div></section>}
        {mode === 'single' ? <section className="mt-5" aria-label="Listing validation"><div className="flex flex-wrap gap-2"><button type="button" disabled={!canValidate} onClick={() => void validate()} className="inline-flex items-center gap-2 rounded-lg border border-cyan-600 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-400 dark:text-cyan-300 dark:hover:bg-cyan-950/30">{busy === 'validate' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {busy === 'validate' ? 'Validating…' : validation ? 'Run validation again' : 'Validate listing'}</button></div>{validation ? <div className="mt-3 space-y-2">{blockingErrors.length ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><div className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Blocking issues</div><ul className="mt-1 list-disc space-y-1 pl-5">{blockingErrors.map((message, index) => <li key={index}>{message}</li>)}</ul></div> : <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 size={15} /> Validation passed; this listing is ready to queue.</div>}{warnings.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Warnings</div><ul className="mt-1 list-disc space-y-1 pl-5">{warnings.map((message, index) => <li key={index}>{message}</li>)}</ul></div> : null}</div> : null}</section> : null}
        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</div> : null}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button><button type="button" disabled={mode === 'single' ? !canPublishSingle : !canPublishBulk} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy === 'publish' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {busy === 'publish' ? 'Submitting…' : mode === 'single' ? 'Publish listing' : `Publish ${listingIds.length.toLocaleString()} listings`}</button></div>
      </div>
    </div>
  );
}
