import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';
import { Badge } from '../ui/badge';
import FeedbackPanel from '../ui/FeedbackPanel';
import Field, { FIELD_CONTROL, fieldControlStyle } from '../ui/Field';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { EmptyState, ErrorState, LoadingPlaceholder } from '../ui/StatusBlock';

type Store = { id: string; storeName: string; status: string; marketplaceId: string | null };
type Account = { id: string; storeName: string; accountDisplayName: string; marketplaceId: string | null; environment: string; status: string; marketplaces: { marketplaceId: string; defaultPaymentPolicyId?: string | null; defaultReturnPolicyId?: string | null; defaultFulfillmentPolicyId?: string | null }[] };
type Policy = { policyType?: string; name?: string; id?: string; marketplaceId?: string };
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete store request.';

export default function BusinessIndustrialStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [policies, setPolicies] = useState<Record<string, Policy[]>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [name, setName] = useState('Business & Industrial eBay store');
  const [marketplaceId, setMarketplaceId] = useState('EBAY_US');
  const [environment, setEnvironment] = useState('production');

  const load = async () => {
    setLoading(accounts.length === 0 && stores.length === 0);
    try {
      const [storeResult, accountResult] = await Promise.all([
        fetchWithAuth<Store[]>('/api/business-industrial/stores'),
        fetchWithAuth<Account[]>('/api/business-industrial/ebay/accounts'),
      ]);
      setStores(storeResult);
      setAccounts(accountResult);
      setError('');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setConnecting(true);
    try {
      const result = await fetchWithAuth<{ authUrl: string }>('/api/business-industrial/ebay/oauth/start', { method: 'POST', body: JSON.stringify({ marketplaceId, environment, accountDisplayName: name.trim() || 'Business & Industrial eBay store' }) });
      window.location.href = result.authUrl;
    } catch (err) {
      setError(messageOf(err));
      setConnecting(false);
    }
  }

  async function inspectPolicies(account: Account) {
    setBusyId('view-' + account.id);
    setError('');
    try {
      const result = await fetchWithAuth<{ policies: Policy[] }>('/api/business-industrial/ebay/accounts/' + account.id + '/policies?marketplaceId=' + encodeURIComponent(account.marketplaceId || marketplaceId));
      setPolicies((current) => ({ ...current, [account.id]: result.policies }));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId('');
    }
  }

  async function syncPolicies(account: Account) {
    setBusyId('sync-' + account.id);
    setError('');
    try {
      await fetchWithAuth('/api/business-industrial/ebay/accounts/' + account.id + '/policies/sync', { method: 'POST' });
      setMessage('eBay business policies synchronized for ' + account.storeName + '.');
      await inspectPolicies(account);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-5">
      <WorkspacePageHeader title="B&I stores" subtitle="Seller accounts are dedicated to Business & Industrial and cannot be reused by Fashion or Automotive." />
      {message ? <FeedbackPanel tone="success" onDismiss={() => setMessage('')}>{message}</FeedbackPanel> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      <form onSubmit={(event) => void connect(event)} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-4">
        <Field label="Connection name" htmlFor="store-name" className="sm:col-span-2">
          <input id="store-name" className={FIELD_CONTROL} style={fieldControlStyle} value={name} maxLength={160} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Marketplace" htmlFor="marketplace">
          <select id="marketplace" className={FIELD_CONTROL} value={marketplaceId} onChange={(event) => setMarketplaceId(event.target.value)}>
            <option value="EBAY_US">eBay US</option>
            <option value="EBAY_GB">eBay UK</option>
            <option value="EBAY_DE">eBay Germany</option>
            <option value="EBAY_AU">eBay Australia</option>
          </select>
        </Field>
        <Field label="Environment" htmlFor="environment">
          <select id="environment" className={FIELD_CONTROL} value={environment} onChange={(event) => setEnvironment(event.target.value)}>
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </Field>
        <button className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-4" style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }} disabled={connecting} type="submit">
          {connecting ? 'Redirecting to eBay…' : 'Connect dedicated B&I eBay seller'}
        </button>
      </form>
      {loading ? <LoadingPlaceholder label="Loading dedicated B&I stores" /> : null}
      <div className="space-y-3">
        {accounts.map((account) => (
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" key={account.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{account.storeName}</p>
                <p className="text-sm text-slate-500">{account.marketplaceId || 'marketplace pending'} · {account.environment}</p>
                <div className="mt-2"><Badge variant={account.status === 'active' ? 'success' : 'warning'}>{account.status}</Badge></div>
              </div>
              <div className="flex gap-2">
                <button className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700" disabled={!!busyId} onClick={() => void inspectPolicies(account)}>
                  {busyId === 'view-' + account.id ? 'Loading policies…' : 'View policies'}
                </button>
                <button className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700" disabled={!!busyId} onClick={() => void syncPolicies(account)}>
                  {busyId === 'sync-' + account.id ? 'Syncing…' : 'Sync policies'}
                </button>
              </div>
            </div>
            {policies[account.id] ? (
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                {policies[account.id].map((policy, index) => (
                  <div className="rounded bg-slate-50 p-2 dark:bg-slate-800" key={policy.id || String(index)}>
                    {policy.policyType || 'Policy'} · {policy.name || policy.id || 'Unnamed'}{policy.marketplaceId ? ' · ' + policy.marketplaceId : ''}
                  </div>
                ))}
                {!policies[account.id].length ? <p className="text-slate-500">No cached policies for this marketplace.</p> : null}
              </div>
            ) : null}
          </article>
        ))}
        {!loading && !accounts.length && !stores.length ? <EmptyState title="No dedicated B&I store connections are available" description="Connect a dedicated seller above. These accounts cannot be reused by other verticals." /> : null}
      </div>
    </div>
  );
}
