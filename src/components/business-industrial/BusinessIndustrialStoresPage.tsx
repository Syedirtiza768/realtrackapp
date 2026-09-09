import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

type Store = { id: string; storeName: string; status: string; marketplaceId: string | null };
export default function BusinessIndustrialStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [message, setMessage] = useState('');
  const load = () => void fetchWithAuth<Store[]>('/api/business-industrial/stores').then(setStores).catch((err) => setMessage(err instanceof Error ? err.message : 'Unable to load stores'));
  useEffect(load, []);
  async function connect() { try { const result = await fetchWithAuth<{ authUrl: string }>('/api/business-industrial/ebay/oauth/start', { method: 'POST', body: JSON.stringify({ marketplaceId: 'EBAY_US', environment: 'production', accountDisplayName: 'Business & Industrial eBay store' }) }); window.location.href = result.authUrl; } catch (err) { setMessage(err instanceof Error ? err.message : 'Unable to start eBay connection'); } }
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">B&amp;I stores</h1><p className="mt-2 text-slate-500">Seller accounts are dedicated to this vertical and cannot be reused by Fashion or automotive.</p></div><button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white" onClick={connect}>Connect B&amp;I eBay seller</button></div>{message && <p className="mt-4 text-sm text-red-600">{message}</p>}<div className="mt-6 space-y-3">{stores.map((store) => <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900" key={store.id}><div><p className="font-medium">{store.storeName}</p><p className="text-sm text-slate-500">{store.status} · {store.marketplaceId || 'marketplace pending'}</p></div><span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700">B&amp;I only</span></div>)}{!stores.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No dedicated B&amp;I store connections are available.</p>}</div></div>;
}
