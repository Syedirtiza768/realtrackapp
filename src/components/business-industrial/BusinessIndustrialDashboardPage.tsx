import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';

type Workspace = { metrics: { listingCount: number; draftCount: number; pendingReviewCount: number; openIncidentCount: number }; stores: { id: string; storeName: string; status: string }[] };

export default function BusinessIndustrialDashboardPage() {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void fetchWithAuth<Workspace>('/api/business-industrial/workspace').then(setData).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load workspace')); }, []);
  if (error) return <p className="rounded-lg bg-red-500/10 p-4 text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading Business &amp; Industrial workspace…</p>;
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-cyan-600">Business &amp; Industrial vertical</p><h1 className="mt-1 text-3xl font-semibold">Operational overview</h1><p className="mt-2 text-slate-500">Manage industrial catalog data, compliance evidence, shipping readiness, and dedicated seller stores.</p></div><Link className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white" to="/business-industrial/listings">Create listing</Link></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Listings', data.metrics.listingCount, 'text-slate-900'], ['Drafts', data.metrics.draftCount, 'text-amber-600'], ['Pending review', data.metrics.pendingReviewCount, 'text-amber-600'], ['Open incidents', data.metrics.openIncidentCount, 'text-red-600']].map(([label, value, color]) => <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900" key={String(label)}><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p></div>)}</div><section className="mt-8 rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900"><h2 className="font-semibold">Dedicated B&amp;I stores</h2>{data.stores.length ? <ul className="mt-3 space-y-2">{data.stores.map((store) => <li className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800" key={store.id}><span>{store.storeName}</span><span className="text-slate-500">{store.status}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No dedicated seller store is connected yet. Open Stores to connect one.</p>}</section></div>;
}
