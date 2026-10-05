import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Eye, ImageOff, Package, Pencil, Plus, RefreshCw, Search, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import OptimizedImage from '../ui/OptimizedImage';
import { useAuth } from '../auth/AuthContext';

type Listing = {
  id: string; sku: string | null; title: string; description: string | null;
  brand: string | null; mpn: string | null; conditionId: string | null; conditionLabel: string | null;
  price: string | number | null; imageUrls: string[]; verticalValidationStatus: string;
  quantity: number | null; categoryId: string | null; categoryName: string | null;
  verticalAttributes: Record<string, unknown>; serializedUnitCount: number; createdAt?: string | null; updatedAt?: string | null;
};
type Account = { id: string; accountDisplayName: string; storeName: string; marketplaceId: string | null; status: string };
type Channel = { id: string; listingStatus: string; listingUrl: string | null; storeName: string; marketplaceId: string; offerId: string | null };
type SortMode = 'newest' | 'title' | 'sku' | 'price_low' | 'price_high' | 'readiness';

const CONDITIONS: Record<string, string> = { '1000': 'New', '1500': 'New other / open box', '2000': 'Certified refurbished', '2500': 'Seller refurbished', '3000': 'Used', '4000': 'Used - very good', '5000': 'Used - good', '6000': 'Used - acceptable', '7000': 'For parts or not working' };
const STATUSES = ['draft', 'needs_review', 'approved', 'rejected', 'published'];
const PAGE_SIZES = [25, 50, 100];
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';
const withOrganization = (path: string, organizationId: string | null) => organizationId ? path + (path.includes('?') ? '&' : '?') + 'organizationId=' + encodeURIComponent(organizationId) : path;
const textAttribute = (item: Listing, key: string) => { const value = item.verticalAttributes?.[key]; return Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value); };
const numericAttribute = (item: Listing, key: string) => { const value = Number(textAttribute(item, key)); return Number.isFinite(value) ? value : 0; };
const labelFor = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const priceFor = (value: string | number | null) => { if (value == null || value === '') return '--'; const parsed = Number(value); return Number.isFinite(parsed) ? '$' + parsed.toFixed(2) : String(value); };
const badgeFor = (status: string) => status === 'approved' || status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : status === 'needs_review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

export default function BusinessIndustrialCatalogPage() {
  const { activeOrganizationId } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [channels, setChannels] = useState<Record<string, Channel[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [condition, setCondition] = useState('all');
  const [images, setImages] = useState('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Listing | null>(null);
  const [accountId, setAccountId] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const account = accounts.find((item) => item.id === accountId) ?? accounts[0];

  async function load() {
    setLoading(true);
    try {
      const [items, sellers] = await Promise.all([
        fetchWithAuth<Listing[]>(withOrganization('/api/business-industrial/listings?limit=200', activeOrganizationId)),
        fetchWithAuth<Account[]>(withOrganization('/api/business-industrial/ebay/accounts', activeOrganizationId)),
      ]);
      setListings(items); setAccounts(sellers);
      setAccountId((current) => current && sellers.some((seller) => seller.id === current) ? current : sellers[0]?.id || '');
      setSelected((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))));
    } catch (error) { setMessage(messageOf(error)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [activeOrganizationId]);
  useEffect(() => { setPage(0); }, [search, status, category, condition, images, pageSize]);

  const categories = useMemo(() => Array.from(new Map(listings.filter((item) => item.categoryName || item.categoryId).map((item) => [item.categoryId || item.categoryName || '', item.categoryName || item.categoryId || ''])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [listings]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((item) => {
      const haystack = [item.title, item.sku, item.brand, item.mpn, item.categoryName, item.categoryId, item.description].filter(Boolean).join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (status === 'all' || item.verticalValidationStatus === status) && (category === 'all' || (item.categoryId || item.categoryName) === category) && (condition === 'all' || item.conditionId === condition) && (images === 'all' || (images === 'with_images' ? item.imageUrls.length > 0 : item.imageUrls.length === 0));
    }).sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'sku') return (a.sku || '').localeCompare(b.sku || '');
      if (sort === 'price_low') return Number(a.price || 0) - Number(b.price || 0);
      if (sort === 'price_high') return Number(b.price || 0) - Number(a.price || 0);
      if (sort === 'readiness') return numericAttribute(b, 'readinessScore') - numericAttribute(a, 'readinessScore');
      return new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime();
    });
  }, [listings, search, status, category, condition, images, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const allSelected = rows.length > 0 && rows.every((item) => selected.has(item.id));
  const selectedListings = listings.filter((item) => selected.has(item.id));
  useEffect(() => { if (page >= totalPages) setPage(Math.max(0, totalPages - 1)); }, [page, totalPages]);

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function toggleAll() { setSelected((current) => { const next = new Set(current); rows.forEach((item) => allSelected ? next.delete(item.id) : next.add(item.id)); return next; }); }
  function exportCsv(items: Listing[], filename: string) {
    const escape = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const data = [['SKU', 'Title', 'Brand', 'MPN', 'Category', 'Condition', 'Price', 'Quantity', 'Status', 'Images'], ...items.map((item) => [item.sku, item.title, item.brand, item.mpn, item.categoryName || item.categoryId, item.conditionLabel || item.conditionId, item.price, item.quantity, item.verticalValidationStatus, item.imageUrls.length])];
    const url = URL.createObjectURL(new Blob([data.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  async function publish(item: Listing) {
    if (!account?.marketplaceId) { setMessage('Connect an enabled B&I eBay seller before publishing.'); return; }
    setPublishingId(item.id);
    try {
      const target = { ebayAccountId: account.id, marketplaceId: account.marketplaceId };
      const validation = await fetchWithAuth<{ results: Array<{ blockingErrors?: string[] }> }>('/api/business-industrial/ebay/listings/validate', { method: 'POST', body: JSON.stringify({ catalogProductId: item.id, targets: [target], organizationId: activeOrganizationId ?? undefined }) });
      const blocking = validation.results.flatMap((result) => result.blockingErrors ?? []);
      if (blocking.length) { setMessage('Publish blocked: ' + blocking.join('; ')); return; }
      const result = await fetchWithAuth<{ jobId: string }>('/api/business-industrial/ebay/listings/publish', { method: 'POST', body: JSON.stringify({ catalogProductId: item.id, targets: [target], organizationId: activeOrganizationId ?? undefined, idempotencyKey: 'bi-' + item.id + '-' + Date.now() }) });
      setMessage('B&I publish job ' + result.jobId + ' queued for ' + account.storeName + '.');
      void watchJob(result.jobId, item.id, account.storeName);
    } catch (error) { setMessage(messageOf(error)); } finally { setPublishingId(null); }
  }
  async function publishSelected() {
    const approved = selectedListings.filter((item) => item.verticalValidationStatus === 'approved');
    if (!approved.length) { setMessage('Select at least one approved B&I listing to publish.'); return; }
    if (!window.confirm('Queue ' + approved.length + ' approved listing(s) for eBay publication?')) return;
    for (const item of approved) await publish(item);
  }
  async function watchJob(jobId: string, listingId: string, storeName: string, attempt = 0) {
    try {
      const job = await fetchWithAuth<{ status: string; targets: Array<{ status: string; errorPayload?: unknown }> }>(withOrganization('/api/business-industrial/ebay/listing-jobs/' + jobId, activeOrganizationId));
      if (['completed', 'partial', 'failed'].includes(job.status) || job.targets.every((target) => ['published', 'failed', 'skipped'].includes(target.status))) {
        const failed = job.targets.filter((target) => target.status === 'failed');
        setMessage(failed.length ? 'eBay publish failed for ' + storeName + ': ' + failed.map((item) => JSON.stringify(item.errorPayload ?? 'Unknown eBay error')).join('; ') : 'Published successfully to ' + storeName + '.');
        await inspect(listingId); return;
      }
      if (attempt < 40) window.setTimeout(() => void watchJob(jobId, listingId, storeName, attempt + 1), 3000);
      else setMessage('Publish is still processing. Use Publications to refresh its status.');
    } catch (error) { setMessage(messageOf(error)); }
  }
  async function inspect(listingId: string) {
    try { const result = await fetchWithAuth<{ items: Channel[] }>(withOrganization('/api/business-industrial/ebay/listings?catalogProductId=' + encodeURIComponent(listingId), activeOrganizationId)); setChannels((current) => ({ ...current, [listingId]: result.items })); } catch (error) { setMessage(messageOf(error)); }
  }
  async function endChannel(channel: Channel, listingId: string) {
    try { await fetchWithAuth(withOrganization('/api/business-industrial/ebay/listings/' + channel.id + '/end', activeOrganizationId), { method: 'POST' }); setMessage('eBay publication ended and verified.'); await inspect(listingId); } catch (error) { setMessage(messageOf(error)); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-cyan-600">Business &amp; Industrial</p><h1 className="mt-1 text-3xl font-semibold">Catalog</h1><p className="mt-2 text-sm text-slate-500">Search, review, enrich and publish your B&amp;I inventory from one catalogue.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void refresh()} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh</button><button type="button" onClick={() => exportCsv(selectedListings.length ? selectedListings : filtered, selectedListings.length ? 'bni-selected-catalog.csv' : 'bni-catalog.csv')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900"><Download size={15} /> Export</button><button type="button" onClick={() => navigate('/business-industrial/listings/editor')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white"><Plus size={15} /> New listing</button></div></div>
    {message && <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200"><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss message"><X size={16} /></button></div>}
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU, title, brand, MPN or category" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">All categories</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select value={condition} onChange={(event) => setCondition(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">All conditions</option>{Object.entries(CONDITIONS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select value={images} onChange={(event) => setImages(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="all">All images</option><option value="with_images">With images</option><option value="without_images">Missing images</option></select><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="newest">Newest first</option><option value="title">Title A-Z</option><option value="sku">SKU A-Z</option><option value="price_low">Price low-high</option><option value="price_high">Price high-low</option><option value="readiness">Readiness score</option></select></div><div className="mt-3 flex flex-wrap justify-between gap-3 text-xs text-slate-500"><span>{filtered.length.toLocaleString()} of {listings.length.toLocaleString()} catalogue records</span><span>Selected seller: {account?.storeName || 'No B&I eBay seller connected'}</span></div></section>
    {selected.size > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm dark:border-cyan-900 dark:bg-cyan-950/30"><span className="font-semibold text-cyan-900 dark:text-cyan-200">{selected.size} selected</span><div className="flex flex-wrap gap-2"><button type="button" onClick={() => exportCsv(selectedListings, 'bni-selected-catalog.csv')} className="rounded-md border border-cyan-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-cyan-800 dark:bg-slate-900">Export selected</button><button type="button" onClick={() => void publishSelected()} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"><Send size={13} /> Publish approved</button><button type="button" onClick={() => setSelected(new Set())} className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600">Clear</button></div></div>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/50"><tr><th className="w-10 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on page" className="h-4 w-4 accent-cyan-600" /></th><th className="w-12 px-3 py-3 text-center">#</th><th className="w-16 px-3 py-3">Image</th><th className="px-3 py-3">SKU / Product</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Condition</th><th className="px-3 py-3 text-center">Stock</th><th className="px-3 py-3 text-right">Price</th><th className="px-3 py-3 text-center">Readiness</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{loading && <tr><td colSpan={11} className="px-6 py-16 text-center text-sm text-slate-500">Loading B&amp;I catalogue...</td></tr>}{!loading && !rows.length && <tr><td colSpan={11} className="px-6 py-16 text-center"><Package className="mx-auto mb-3 text-slate-300" size={30} /><p className="font-medium">No catalogue records found</p><p className="mt-1 text-xs text-slate-500">Try adjusting the search or filters, or create a new B&amp;I listing.</p></td></tr>}{!loading && rows.map((item, index) => <tr key={item.id} className={selected.has(item.id) ? 'bg-cyan-50/60 dark:bg-cyan-950/20' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'}><td className="px-3 py-3"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={'Select ' + item.title} className="h-4 w-4 accent-cyan-600" /></td><td className="px-3 py-3 text-center text-xs text-slate-500">{page * pageSize + index + 1}</td><td className="px-3 py-3">{item.imageUrls[0] ? <OptimizedImage src={item.imageUrls[0]} alt="" variant="thumb" aspectRatio="1/1" className="h-12 w-12 rounded-lg" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800"><ImageOff size={17} /></div>}</td><td className="max-w-[320px] px-3 py-3"><button type="button" onClick={() => setDetail(item)} className="line-clamp-2 text-left font-semibold text-slate-800 hover:text-cyan-700 dark:text-slate-100">{item.title || 'Untitled listing'}</button><p className="mt-1 truncate font-mono text-xs text-slate-500">{item.sku || 'No SKU'}{item.brand ? ' · ' + item.brand : ''}{item.mpn ? ' · ' + item.mpn : ''}</p></td><td className="max-w-[190px] px-3 py-3 text-xs text-slate-600 dark:text-slate-300"><span className="line-clamp-2">{item.categoryName || item.categoryId || 'Category pending'}</span></td><td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{item.conditionLabel || CONDITIONS[item.conditionId || ''] || item.conditionId || '--'}</td><td className="px-3 py-3 text-center text-xs text-slate-600 dark:text-slate-300">{item.quantity ?? 0}{item.serializedUnitCount ? <span className="block text-[10px] text-slate-400">{item.serializedUnitCount} serialized</span> : null}</td><td className="px-3 py-3 text-right font-semibold">{priceFor(item.price)}</td><td className="px-3 py-3 text-center text-xs font-semibold">{numericAttribute(item, 'readinessScore') ? numericAttribute(item, 'readinessScore') + '%' : '--'}</td><td className="px-3 py-3"><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ' + badgeFor(item.verticalValidationStatus)}>{labelFor(item.verticalValidationStatus)}</span></td><td className="px-3 py-3"><div className="flex justify-end gap-1"><button type="button" title="View details" onClick={() => setDetail(item)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Eye size={15} /></button><button type="button" title="Edit listing" onClick={() => navigate('/business-industrial/listings/editor?edit=' + encodeURIComponent(item.id))} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={15} /></button>{item.verticalValidationStatus === 'approved' && <button type="button" title="Validate and publish" disabled={publishingId === item.id} onClick={() => void publish(item)} className="rounded-md p-2 text-emerald-600 disabled:opacity-50"><Send size={15} /></button>}<button type="button" title="View publications" onClick={() => void inspect(item.id)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ExternalLink size={15} /></button></div></td></tr>)}{!loading && rows.flatMap((item) => channels[item.id] ? [<tr key={item.id + '-channels'}><td colSpan={11} className="bg-slate-50 px-6 py-3 dark:bg-slate-950/40"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Publications</p>{channels[item.id].length ? channels[item.id].map((channel) => <div key={channel.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-xs dark:bg-slate-900"><span>{channel.storeName} · {channel.marketplaceId} · {channel.listingStatus}{channel.listingUrl ? ' · ' + channel.listingUrl : ''}</span>{channel.listingStatus === 'published' && <button type="button" onClick={() => void endChannel(channel, item.id)} className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white">End publication</button>}</div>) : <span className="text-xs text-slate-500">No eBay publication records.</span>}</td></tr>] : [])}</tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><span>Showing {filtered.length ? page * pageSize + 1 : 0} to {Math.min(filtered.length, (page + 1) * pageSize)} of {filtered.length} results</span><div className="flex items-center gap-3"><div className="flex items-center gap-1"><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"><ChevronLeft size={14} /></button><span className="min-w-16 text-center">Page {page + 1} / {totalPages}</span><button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"><ChevronRight size={14} /></button></div><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}</select></div></div></div>
    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setDetail(null)}><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800"><div><p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">B&amp;I catalogue record</p><h2 className="mt-1 text-xl font-semibold">{detail.title}</h2><p className="mt-1 text-sm text-slate-500">{detail.sku || 'No SKU'} · {detail.categoryName || detail.categoryId || 'Category pending'}</p></div><button type="button" onClick={() => setDetail(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button></div><div className="grid gap-6 p-6 md:grid-cols-[220px_1fr]"><div>{detail.imageUrls[0] ? <OptimizedImage src={detail.imageUrls[0]} alt={detail.title} variant="medium" aspectRatio="1/1" className="w-full rounded-xl" /> : <div className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800"><ImageOff size={32} /></div>}<div className="mt-3 grid grid-cols-4 gap-2">{detail.imageUrls.slice(0, 8).map((url) => <OptimizedImage key={url} src={url} alt="" variant="thumb" aspectRatio="1/1" className="rounded-md" />)}</div></div><div className="space-y-5"><div className="flex flex-wrap gap-2"><span className={'rounded-full px-3 py-1 text-xs font-semibold ' + badgeFor(detail.verticalValidationStatus)}>{labelFor(detail.verticalValidationStatus)}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">{detail.imageUrls.length} image(s)</span></div><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Brand / MPN</p><p className="mt-1 text-sm font-medium">{detail.brand || '--'}{detail.mpn ? ' / ' + detail.mpn : ''}</p></div><div><p className="text-xs text-slate-500">Condition</p><p className="mt-1 text-sm font-medium">{detail.conditionLabel || CONDITIONS[detail.conditionId || ''] || detail.conditionId || '--'}</p></div><div><p className="text-xs text-slate-500">Price / quantity</p><p className="mt-1 text-sm font-medium">{priceFor(detail.price)} / {detail.quantity ?? 0}</p></div><div><p className="text-xs text-slate-500">Readiness / SEO</p><p className="mt-1 text-sm font-medium">{textAttribute(detail, 'readinessScore') || '--'} / {textAttribute(detail, 'seoScore') || '--'}</p></div></div><div><p className="text-xs text-slate-500">Description</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{detail.description || 'No description provided.'}</p></div><div><p className="text-xs text-slate-500">Technical attributes</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(detail.verticalAttributes || {}).filter(([, value]) => value != null && String(value).trim()).slice(0, 16).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800"><span className="font-semibold">{labelFor(key)}:</span> {Array.isArray(value) ? value.join(', ') : String(value)}</div>)}</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => navigate('/business-industrial/listings/editor?edit=' + encodeURIComponent(detail.id))} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700"><Pencil size={15} /> Edit listing</button>{detail.verticalValidationStatus === 'approved' && <button type="button" onClick={() => { setDetail(null); void publish(detail); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><Send size={15} /> Validate &amp; publish</button>}</div></div></div></div></div>}
  </div>;
}
