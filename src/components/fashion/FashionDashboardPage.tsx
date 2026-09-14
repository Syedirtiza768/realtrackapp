import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';

type Workspace = { metrics: { listingCount: number; pendingReviewCount: number }; stores: { id: string; storeName: string; status: string }[] };

export default function FashionDashboardPage() {
  const { permissions } = useAuth();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void fetchWithAuth<Workspace>('/api/fashion/workspace', { signal: controller.signal }).then(setData).catch((err) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load Fashion workspace');
    });
    return () => controller.abort();
  }, [revision]);
  const actions = [
    ['/fashion/listings/new', 'Add Item', 'fashion.listings.create'],
    ['/fashion/import', 'Import catalog', 'fashion.import'],
    ['/fashion/review', 'Review authenticity', 'fashion.authenticity.review'],
    ['/fashion/stores', 'Manage stores', 'fashion.stores.view'],
  ];
  return <div>
    <p className="text-sm font-medium text-pink-600">Fashion vertical</p>
    <h1 className="mt-1 text-3xl font-semibold">Fashion overview</h1>
    <p className="mt-2 text-slate-500">Identify garments from photos, complete Fashion attributes, and manage authenticity reviews and seller stores.</p>
    <div className="mt-5 flex flex-wrap gap-3">{actions.filter(([, , permission]) => permissions.includes(permission)).map(([path, label]) => <Link key={path} className="rounded-lg border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-600 dark:border-pink-800 dark:text-pink-300" to={path}>{label}</Link>)}</div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-500/10 p-4 text-red-600">{error} <button className="ml-2 underline" onClick={() => setRevision((value) => value + 1)}>Retry</button></p>}
    {!data && !error && <p role="status" className="mt-5 text-slate-500">Loading Fashion workspace…</p>}
    {data && <>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">{[['Fashion listings', data.metrics.listingCount], ['Pending authenticity review', data.metrics.pendingReviewCount], ['Accessible Fashion stores', data.stores.length]].map(([label, count]) => <div key={label} className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{count}</p></div>)}</div>
      <section className="mt-8 rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900"><h2 className="font-semibold">Fashion stores</h2>{data.stores.length ? <ul className="mt-3 space-y-2">{data.stores.map((store) => <li className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800" key={store.id}><span>{store.storeName}</span><span className="text-slate-500">{store.status}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No Fashion store is available. A Fashion administrator can connect a dedicated seller store and grant access.</p>}</section>
    </>}
  </div>;
}
