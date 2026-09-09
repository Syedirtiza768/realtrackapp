import { useEffect, useState, type FormEvent } from 'react';
import { fetchWithAuth } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';

type Store = { id: string; storeName: string; status: string; marketplaceId?: string | null };
type Marketplace = { marketplaceId: string; enabled?: boolean; defaultPaymentPolicyId?: string | null; defaultReturnPolicyId?: string | null; defaultFulfillmentPolicyId?: string | null; defaultInventoryLocationKey?: string | null };
type Account = { id: string; primaryStoreId?: string | null; accountDisplayName?: string | null; ebayUsername?: string | null; environment: string; connectionStatus: string; lastErrorMessage?: string | null; marketplaces?: Marketplace[] };
type Policy = { id: string; marketplaceId: string; policyType: string; ebayPolicyId: string; name: string; isDefault: boolean };
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';

function AccountPolicies({ account, canManage }: { account: Account; canManage: boolean }) {
  const [marketplace, setMarketplace] = useState(account.marketplaces?.[0]?.marketplaceId ?? '');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!marketplace) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setPolicies([]);
    fetchWithAuth<{ policies: Policy[] }>(`/api/fashion/ebay/accounts/${encodeURIComponent(account.id)}/policies?marketplaceId=${encodeURIComponent(marketplace)}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPolicies(result.policies.filter((policy) => policy.marketplaceId === marketplace)); })
      .catch((err) => { if (!controller.signal.aborted) setError(messageOf(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account.id, marketplace, revision]);
  async function sync() {
    if (!canManage || syncing) return;
    setSyncing(true); setError(''); setMessage('');
    try {
      await fetchWithAuth(`/api/fashion/ebay/accounts/${encodeURIComponent(account.id)}/policies/sync`, { method: 'POST' });
      setMessage('Policy synchronization request completed. Reloading the current policy cache.');
      setRevision((n) => n + 1);
    } catch (err) { setError(messageOf(err)); }
    finally { setSyncing(false); }
  }
  const defaults = account.marketplaces?.find((item) => item.marketplaceId === marketplace);
  return <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 text-sm">Policy marketplace<select className={field} value={marketplace} disabled={syncing} onChange={(e) => { setMarketplace(e.target.value); setMessage(''); }}><option value="">Select marketplace</option>{(account.marketplaces ?? []).map((item) => <option value={item.marketplaceId} key={item.marketplaceId}>{item.marketplaceId}</option>)}</select></label>
      <button className={button} disabled={!marketplace || loading || syncing} onClick={() => setRevision((n) => n + 1)}>Reload policies</button>
      {canManage && <button className={button} disabled={syncing || loading} onClick={() => void sync()}>{syncing ? 'Syncing policies…' : 'Sync policies from eBay'}</button>}
    </div>
    {!account.marketplaces?.length && <p className="mt-3 text-sm text-slate-500">No marketplaces are configured for this connection yet.</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
    {loading && <p role="status" className="mt-3 text-sm">Loading business policies…</p>}
    {defaults && <dl className="mt-4 grid gap-3 break-words text-xs sm:grid-cols-2">{[['Payment default', defaults.defaultPaymentPolicyId], ['Returns default', defaults.defaultReturnPolicyId], ['Shipping default', defaults.defaultFulfillmentPolicyId], ['Inventory location', defaults.defaultInventoryLocationKey]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd>{value || 'Not configured'}</dd></div>)}</dl>}
    {marketplace && !loading && !error && <div className="mt-4 overflow-x-auto">{policies.length ? <table className="w-full text-left text-sm"><thead><tr className="border-b dark:border-slate-700"><th className="p-2">Type</th><th className="p-2">Policy</th><th className="p-2">eBay policy ID</th><th className="p-2">Default</th></tr></thead><tbody>{policies.map((policy) => <tr className="border-b dark:border-slate-800" key={policy.id}><td className="p-2">{policy.policyType}</td><td className="p-2">{policy.name}</td><td className="p-2">{policy.ebayPolicyId}</td><td className="p-2">{policy.isDefault ? 'Yes' : '—'}</td></tr>)}</tbody></table> : <p className="text-sm text-slate-500">No cached business policies for this marketplace. A store administrator can sync policies from eBay.</p>}</div>}
    <p className="mt-3 text-xs text-slate-500">Choose shipping, returns, payment and inventory location in the listing editor before publishing. Policy availability does not guarantee eBay approval.</p>
  </div>;
}

export default function FashionStoresPage() {
  const { permissions } = useAuth();
  const canView = permissions.includes('fashion.access') && permissions.includes('fashion.stores.view');
  const canManage = permissions.includes('fashion.stores.manage');
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState('');
  const [marketplace, setMarketplace] = useState('EBAY_US');
  const [environment, setEnvironment] = useState('sandbox');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  useEffect(() => {
    if (!canView) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setAccountError('');
    void Promise.allSettled([
      fetchWithAuth<Store[]>('/api/fashion/stores', { signal: controller.signal }),
      fetchWithAuth<Account[]>('/api/fashion/ebay/accounts', { signal: controller.signal }),
    ]).then(([storeResult, accountResult]) => {
      if (controller.signal.aborted) return;
      if (storeResult.status === 'fulfilled') setStores(storeResult.value); else setError(messageOf(storeResult.reason));
      if (accountResult.status === 'fulfilled') setAccounts(accountResult.value); else { setAccounts([]); setAccountError(messageOf(accountResult.reason)); }
      setLoading(false);
    });
    return () => controller.abort();
  }, [canView, revision]);
  async function connect(event: FormEvent) {
    event.preventDefault();
    if (!canManage || connecting || !name.trim()) return;
    setConnecting(true); setConnectError('');
    try {
      const result = await fetchWithAuth<{ authUrl: string }>('/api/fashion/ebay/oauth/start', { method: 'POST', body: JSON.stringify({ marketplaceId: marketplace, environment, accountDisplayName: name.trim() }) });
      const authUrl = new URL(result.authUrl);
      if (authUrl.protocol !== 'https:' || !(authUrl.hostname === 'ebay.com' || authUrl.hostname.endsWith('.ebay.com'))) throw new Error('The server returned an invalid eBay authorization address.');
      window.location.assign(authUrl.href);
    } catch (err) { setConnectError(messageOf(err)); setConnecting(false); }
  }
  if (!canView) return <p role="alert">You do not have permission to view Fashion stores.</p>;
  return <div><h1 className="text-3xl font-semibold">Fashion stores</h1><p className="mt-2 text-slate-500">Manage dedicated eBay seller connections and inspect marketplace business policies.</p>
    {canManage && <form onSubmit={(e) => void connect(e)} className="my-6 rounded-xl bg-white p-5 dark:bg-slate-900"><h2 className="font-semibold">Connect a Fashion seller</h2><fieldset disabled={connecting} className="mt-4 grid gap-4 sm:grid-cols-3">
      <label className="text-sm">Connection name<input className={field} value={name} required maxLength={160} placeholder="Fashion store name" onChange={(e) => setName(e.target.value)} /></label>
      <label className="text-sm">eBay marketplace<select className={field} value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>{[['EBAY_US', 'United States'], ['EBAY_GB', 'United Kingdom'], ['EBAY_AU', 'Australia'], ['EBAY_DE', 'Germany'], ['EBAY_CA', 'Canada'], ['EBAY_FR', 'France'], ['EBAY_IT', 'Italy'], ['EBAY_ES', 'Spain']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm">Environment<select className={field} value={environment} onChange={(e) => setEnvironment(e.target.value)}><option value="sandbox">Sandbox — test seller</option><option value="production">Production — live seller</option></select></label>
    </fieldset><p className="my-3 text-xs text-slate-500">{environment === 'production' ? 'You will authorize a live eBay seller account.' : 'Use an eBay sandbox seller account for this connection.'} Seller connections cannot be shared with other verticals.</p>
      {connectError && <p role="alert" className="my-3 text-sm text-red-700 dark:text-red-400">{connectError}</p>}
      <button className={`${button} bg-pink-600 text-white`} disabled={connecting} type="submit">{connecting ? 'Opening eBay authorization…' : 'Continue to eBay'}</button>
    </form>}
    <button className={`${button} my-4`} disabled={loading || connecting} onClick={() => setRevision((n) => n + 1)}>Refresh connections</button>
    {loading && <p role="status">Loading authorized stores and connections…</p>}
    {error && <p role="alert" className="my-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
    {accountError && <p role="alert" className="my-3 text-sm text-red-700 dark:text-red-400">eBay account details unavailable: {accountError}</p>}
    {!loading && !error && <div className="space-y-3">{stores.map((store) => <div className="rounded-xl bg-white p-4 dark:bg-slate-900" key={store.id}><p className="font-medium">{store.storeName}</p><p className="text-sm text-slate-500">{store.status} · {store.marketplaceId || 'Marketplace pending'} · Fashion only</p></div>)}{!stores.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 dark:bg-slate-900">No Fashion store connections are available to you.{canManage ? ' Connect a seller account above.' : ' Ask a Fashion administrator to assign a store.'}</p>}</div>}
    {!loading && !accountError && accounts.map((account) => <section className="mt-4 rounded-xl bg-white p-5 dark:bg-slate-900" key={account.id}><h2 className="font-semibold">{account.accountDisplayName || account.ebayUsername || 'eBay seller'}</h2><p className="mt-1 text-sm text-slate-500">{account.environment} · {account.connectionStatus}</p>{account.lastErrorMessage && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{account.lastErrorMessage}</p>}<AccountPolicies account={account} canManage={canManage} /></section>)}
  </div>;
}
