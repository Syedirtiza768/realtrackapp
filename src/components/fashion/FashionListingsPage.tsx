import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fashionError, listFashionAccounts, listFashionListings, type FashionAccount, type FashionListing } from '../../lib/fashionListingsApi';
import FashionListingPublishPanel from './FashionListingPublishPanel';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800';
export default function FashionListingsPage() {
  const { permissions } = useAuth();
  const [listings, setListings] = useState<FashionListing[]>([]);
  const [accounts, setAccounts] = useState<FashionAccount[]>([]);
  const [accountKey, setAccountKey] = useState('');
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [stock, setStock] = useState('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canView = permissions.includes('fashion.listings.view');
  const canPublish = permissions.includes('fashion.publish');
  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(''); setSelected(new Set());
    listFashionListings(controller.signal).then(setListings).catch((err) => { if (!controller.signal.aborted) setError(fashionError(err)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canView, reload]);
  useEffect(() => {
    if (!canPublish) return;
    const controller = new AbortController();
    setAccountError('');
    listFashionAccounts(controller.signal).then(setAccounts).catch((err) => { if (!controller.signal.aborted) setAccountError(fashionError(err)); });
    return () => controller.abort();
  }, [canPublish, reload]);
  const filtered = useMemo(() => listings.filter((item) => {
    const search = [item.sku, item.title, item.brand, item.categoryName, ...Object.values(item.verticalAttributes ?? {})].join(' ').toLowerCase();
    return search.includes(query.toLowerCase().trim()) && (!status || item.verticalValidationStatus === status) && (!stock || (stock === 'available' ? (item.quantity ?? 0) > 0 : (item.quantity ?? 0) === 0));
  }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'price' ? Number(b.price ?? 0) - Number(a.price ?? 0) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [listings, query, status, stock, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const activePage = Math.min(page, pages);
  const visible = filtered.slice((activePage - 1) * 25, activePage * 25);
  const selectedListings = listings.filter((item) => selected.has(item.id));
  const account = accounts.find((item) => `${item.id}:${item.marketplaceId}` === accountKey);
  function toggle(id: string) { setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function resetSelection() { setPage(1); setSelected(new Set()); }
  if (!canView) return <p role="alert">You do not have permission to view Fashion listings.</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">Fashion listings</h1><p className="mt-2 text-slate-500">Prepare items, review readiness, and publish approved listings.</p></div><div className="flex gap-3"><button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Refresh</button>{permissions.includes('fashion.listings.create') && <Link className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white" to="/fashion/listings/new">Create listing</Link>}</div></div>
    <div className="grid gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm">Search<input className={input} placeholder="SKU, title, brand or attributes" value={query} onChange={(e) => { setQuery(e.target.value); resetSelection(); }} /></label>
      <label className="text-sm">Review status<select className={input} value={status} onChange={(e) => { setStatus(e.target.value); resetSelection(); }}><option value="">All statuses</option>{['draft', 'needs_review', 'approved', 'rejected', 'quarantined'].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>
      <label className="text-sm">Stock<select className={input} value={stock} onChange={(e) => { setStock(e.target.value); resetSelection(); }}><option value="">All stock</option><option value="available">In stock</option><option value="empty">Out of stock</option></select></label>
      <label className="text-sm">Sort<select className={input} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="price">Highest price</option></select></label>
    </div>
    {error && <p role="alert" className="text-red-600">{error} Use Refresh to try again.</p>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <p className="px-4 py-3 text-sm text-slate-500">{filtered.length} matching · {listings.length} loaded (latest 200 maximum). Filters apply to loaded listings.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-4"><input type="checkbox" aria-label="Select all listings on this page" disabled={loading || !!error || !visible.length} checked={visible.length > 0 && visible.every((item) => selected.has(item.id))} onChange={(e) => setSelected((previous) => { const next = new Set(previous); visible.forEach((item) => e.target.checked ? next.add(item.id) : next.delete(item.id)); return next; })} /></th>{['Item', 'Category', 'Review', 'Price', 'Qty', 'Action'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>
        {loading ? <tr><td colSpan={7} className="p-8 text-center" role="status">Loading Fashion listings…</td></tr> : !error && visible.map((item) => <tr className="border-t border-slate-100 dark:border-slate-800" key={item.id}><td className="p-4"><input type="checkbox" aria-label={`Select ${item.sku || item.title}`} checked={selected.has(item.id)} onChange={() => toggle(item.id)} /></td><td className="min-w-64 px-4 py-3"><Link className="font-semibold hover:text-pink-600" to={`/fashion/listings/${item.id}`}>{item.title}</Link><p className="mt-1 text-xs text-slate-500">{item.sku || 'No SKU'} · {item.brand || 'No brand'}</p></td><td className="px-4 py-3">{item.categoryName || item.categoryId || 'Not set'}</td><td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${item.verticalValidationStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' : item.verticalValidationStatus === 'quarantined' || item.verticalValidationStatus === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{item.verticalValidationStatus.replace(/_/g, ' ')}</span></td><td className="px-4 py-3 tabular-nums">{item.price == null ? 'Not set' : Number(item.price).toFixed(2)}</td><td className="px-4 py-3 tabular-nums">{item.quantity ?? 0}</td><td className="px-4 py-3"><Link className="font-semibold text-pink-600" to={`/fashion/listings/${item.id}`}>{permissions.includes('fashion.listings.update') && item.verticalValidationStatus !== 'quarantined' && !item.manualReview ? 'Edit' : 'View'}</Link></td></tr>)}
        {!loading && !error && !visible.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">{listings.length ? 'No listings match these filters.' : 'No Fashion listings yet. Create your first draft to get started.'}</td></tr>}
      </tbody></table></div>
      <div className="flex items-center justify-between border-t px-4 py-3 text-sm"><span>Page {activePage} of {pages}</span><div className="flex gap-4"><button type="button" disabled={activePage === 1} onClick={() => setPage(activePage - 1)} className="disabled:opacity-40">Previous</button><button type="button" disabled={activePage === pages} onClick={() => setPage(activePage + 1)} className="disabled:opacity-40">Next</button></div></div>
    </div>
    {selected.size > 0 && !loading && !error && <div className="space-y-3"><div className="flex flex-wrap items-center gap-4"><span className="font-semibold">{selected.size} selected</span><button type="button" onClick={() => setSelected(new Set())} className="text-sm text-pink-600">Clear selection</button>{canPublish && <label className="text-sm">Seller / marketplace<select aria-label="Publish seller and marketplace" className={input} value={accountKey} onChange={(e) => setAccountKey(e.target.value)}><option value="">Choose a Fashion seller</option>{accounts.map((item) => <option key={`${item.id}:${item.marketplaceId}`} value={`${item.id}:${item.marketplaceId}`}>{item.storeName || item.accountName} · {item.marketplaceId} · {item.status}</option>)}</select></label>}</div>{accountError && <p role="alert" className="text-red-600">Unable to load sellers: {accountError}</p>}<FashionListingPublishPanel listings={selectedListings} account={account} /></div>}
  </div>;
}
