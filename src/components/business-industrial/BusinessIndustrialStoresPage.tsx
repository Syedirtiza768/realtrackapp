import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

type Store = { id: string; storeName: string; status: string; marketplaceId: string | null };
type Account = { id: string; storeName: string; accountDisplayName: string; marketplaceId: string | null; environment: string; status: string; marketplaces: { marketplaceId: string; defaultPaymentPolicyId?: string | null; defaultReturnPolicyId?: string | null; defaultFulfillmentPolicyId?: string | null }[] };
type Policy = { policyType?: string; name?: string; id?: string; marketplaceId?: string };
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete store request.';

export default function BusinessIndustrialStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [policies, setPolicies] = useState<Record<string, Policy[]>>({});
  const [message, setMessage] = useState('');
  const [name, setName] = useState('Business & Industrial eBay store');
  const [marketplaceId, setMarketplaceId] = useState('EBAY_US');
  const [environment, setEnvironment] = useState('production');
  const load = async () => {
    try { const [storeResult, accountResult] = await Promise.all([fetchWithAuth<Store[]>('/api/business-industrial/stores'), fetchWithAuth<Account[]>('/api/business-industrial/ebay/accounts')]); setStores(storeResult); setAccounts(accountResult); } catch (err) { setMessage(messageOf(err)); }
  };
  useEffect(() => { void load(); }, []);
  async function connect(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try { const result = await fetchWithAuth<{ authUrl: string }>('/api/business-industrial/ebay/oauth/start', { method: 'POST', body: JSON.stringify({ marketplaceId, environment, accountDisplayName: name.trim() || 'Business & Industrial eBay store' }) }); window.location.href = result.authUrl; } catch (err) { setMessage(messageOf(err)); }
  }
  async function inspectPolicies(account: Account) {
    try { const result = await fetchWithAuth<{ policies: Policy[] }>('/api/business-industrial/ebay/accounts/' + account.id + '/policies?marketplaceId=' + encodeURIComponent(account.marketplaceId || marketplaceId)); setPolicies((current) => ({ ...current, [account.id]: result.policies })); } catch (err) { setMessage(messageOf(err)); }
  }
  async function syncPolicies(account: Account) {
    try { await fetchWithAuth('/api/business-industrial/ebay/accounts/' + account.id + '/policies/sync', { method: 'POST' }); setMessage('eBay business policies synchronized for ' + account.storeName + '.'); await inspectPolicies(account); } catch (err) { setMessage(messageOf(err)); }
  }
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">B&amp;I stores</h1><p className="mt-2 text-slate-500">Seller accounts are dedicated to Business &amp; Industrial and cannot be reused by Fashion or Automotive.</p></div></div>{message && <p role="status" className="mt-4 text-sm text-slate-600">{message}</p>}<form onSubmit={(event) => void connect(event)} className="my-6 grid gap-4 rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900 sm:grid-cols-4"><label className="text-sm sm:col-span-2">Connection name<input className={field} value={name} maxLength={160} onChange={(event) => setName(event.target.value)} /></label><label className="text-sm">Marketplace<select className={field} value={marketplaceId} onChange={(event) => setMarketplaceId(event.target.value)}><option value="EBAY_US">eBay US</option><option value="EBAY_GB">eBay UK</option><option value="EBAY_DE">eBay Germany</option><option value="EBAY_AU">eBay Australia</option></select></label><label className="text-sm">Environment<select className={field} value={environment} onChange={(event) => setEnvironment(event.target.value)}><option value="production">Production</option><option value="sandbox">Sandbox</option></select></label><button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white sm:col-span-4" type="submit">Connect dedicated B&amp;I eBay seller</button></form><div className="mt-6 space-y-3">{accounts.map((account) => <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900" key={account.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{account.storeName}</p><p className="text-sm text-slate-500">{account.status} · {account.marketplaceId || 'marketplace pending'} · {account.environment}</p></div><div className="flex gap-2"><button className={button} onClick={() => void inspectPolicies(account)}>View policies</button><button className={button} onClick={() => void syncPolicies(account)}>Sync policies</button></div></div>{policies[account.id] && <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{policies[account.id].map((policy, index) => <div className="rounded bg-slate-50 p-2 dark:bg-slate-800" key={policy.id || String(index)}>{policy.policyType || 'Policy'} · {policy.name || policy.id || 'Unnamed'}{policy.marketplaceId ? ' · ' + policy.marketplaceId : ''}</div>)}{!policies[account.id].length && <p className="text-slate-500">No cached policies for this marketplace.</p>}</div>}</div>)}{!accounts.length && !stores.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No dedicated B&amp;I store connections are available.</p>}</div></div>;
}
