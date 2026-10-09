import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  downloadFashionActivityReport,
  fashionError,
  getFashionActivityReport,
  listFashionAccounts,
  type FashionAccount,
  type FashionActivityFilters,
  type FashionActivityItem,
  type FashionActivityReport,
} from '../../lib/fashionListingsApi';

const input = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : '—';
const actorLabel = (actor: { name: string; email: string } | null | undefined) => actor?.name || actor?.email || 'Unknown';
const pretty = (value: unknown) => Array.isArray(value) ? value.join(', ') : String(value ?? '');

function ProductDetails({ item }: { item: FashionActivityItem }) {
  const details = Object.entries(item.attributes).filter(([, value]) => value != null && pretty(value).trim());
  return <details className="mt-2 text-xs">
    <summary className="cursor-pointer font-medium text-pink-700 dark:text-pink-300">All item details</summary>
    <div className="mt-2 grid gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800">
      <p><span className="font-medium">SKU:</span> {item.sku || '—'}</p>
      <p><span className="font-medium">Brand:</span> {item.brand || '—'}</p>
      <p><span className="font-medium">Category:</span> {item.categoryName || item.categoryId || '—'}</p>
      <p><span className="font-medium">Condition:</span> {item.conditionLabel || item.conditionId || '—'}</p>
      <p><span className="font-medium">Price / quantity:</span> {item.price ?? '—'} / {item.quantity ?? '—'}</p>
      <p className="sm:col-span-2"><span className="font-medium">Description:</span> {item.description || '—'}</p>
      {details.map(([key, value]) => <p key={key}><span className="font-medium">{key.replace(/([A-Z])/g, ' $1')}:</span> {pretty(value)}</p>)}
      {item.imageUrls.map((url, index) => <p className="break-all sm:col-span-2" key={`${url}-${index}`}><span className="font-medium">Photo {index + 1}:</span> {url}</p>)}
      {item.publicationTargets.map((target, index) => <p className="sm:col-span-2" key={`${target.storeId}-${target.createdAt}-${index}`}>
        <span className="font-medium">{target.storeName}:</span> {target.marketplaceId} · {target.status} · requested by {actorLabel(target.requestedBy)} · {JSON.stringify(target.policies)}
      </p>)}
    </div>
  </details>;
}

export default function FashionActivityReportPage() {
  const { activeOrganizationId } = useAuth();
  const [filters, setFilters] = useState<FashionActivityFilters>({ page: 1, pageSize: 25 });
  const [form, setForm] = useState<FashionActivityFilters>(filters);
  const [data, setData] = useState<FashionActivityReport | null>(null);
  const [accounts, setAccounts] = useState<FashionAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    listFashionAccounts(controller.signal, activeOrganizationId).then(setAccounts).catch(() => setAccounts([]));
    return () => controller.abort();
  }, [activeOrganizationId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getFashionActivityReport(filters, controller.signal, activeOrganizationId)
      .then(setData)
      .catch((reason) => { if (!controller.signal.aborted) setError(fashionError(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeOrganizationId, filters]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 25))), [data]);
  function update<K extends keyof FashionActivityFilters>(key: K, value: FashionActivityFilters[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    setFilters({ ...form, page: 1 });
  }
  function reset() {
    const next: FashionActivityFilters = { page: 1, pageSize: 25 };
    setForm(next); setFilters(next);
  }
  async function exportCsv() {
    setExporting(true); setError('');
    try {
      const blob = await downloadFashionActivityReport(filters, activeOrganizationId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'fashion-activity-report.csv'; link.click();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(fashionError(reason)); }
    finally { setExporting(false); }
  }

  return <div className="space-y-5 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold sm:text-3xl">Fashion activity report</h1><p className="mt-1 text-sm text-slate-500">Track who uploaded and cataloged each item, its processing and review status, and its store publishing activity.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setFilters((current) => ({ ...current }))} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm"><RefreshCw size={15} /> Refresh</button>
        <button type="button" disabled={exporting} onClick={() => void exportCsv()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-pink-600 px-3 text-sm font-semibold text-white disabled:opacity-50"><Download size={15} />{exporting ? 'Exporting…' : 'Export CSV'}</button>
      </div>
    </div>

    {data && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Fashion activity totals">
      {[
        ['Items in report', data.summary.total],
        ['Processed', data.summary.processed],
        ['Added to catalog', data.summary.catalogAdded],
        ['Waiting in intake', data.summary.waitingInIntake],
        ['Identification failed', data.summary.failed],
      ].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{Number(count).toLocaleString()}</p></div>)}
    </section>}

    {data && <section className="grid gap-3 sm:grid-cols-2" aria-label="User activity totals">
      {[
        { title: 'Uploads by user', rows: data.uploadedBy },
        { title: 'Catalog additions by user', rows: data.addedBy },
      ].map((group) => <div key={group.title} className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-semibold">{group.title}</h2><div className="mt-2 flex flex-wrap gap-2">{group.rows.length ? group.rows.map((row) => <span key={row.user.id} className="rounded-full bg-pink-50 px-3 py-1 text-xs text-pink-900 dark:bg-pink-950/40 dark:text-pink-100">{actorLabel(row.user)} · {row.itemCount.toLocaleString()} items</span>) : <span className="text-sm text-slate-500">None in this report</span>}</div></div>)}
    </section>}

    <form onSubmit={apply} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-700 dark:bg-slate-900">
      <label className="grid gap-1 text-xs text-slate-500">Activity from<input type="date" className={input} value={form.from || ''} onChange={(event) => update('from', event.target.value)} /></label>
      <label className="grid gap-1 text-xs text-slate-500">Activity to<input type="date" className={input} value={form.to || ''} onChange={(event) => update('to', event.target.value)} /></label>
      <label className="grid gap-1 text-xs text-slate-500">Uploaded by<select className={input} value={form.uploadedBy || ''} onChange={(event) => update('uploadedBy', event.target.value)}><option value="">All users</option>{data?.users.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Added to catalog by<select className={input} value={form.addedBy || ''} onChange={(event) => update('addedBy', event.target.value)}><option value="">All users</option>{data?.users.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Catalog status<select className={input} value={form.catalogStatus || ''} onChange={(event) => update('catalogStatus', event.target.value as FashionActivityFilters['catalogStatus'])}><option value="">All</option><option value="pending">Waiting in intake</option><option value="added">Added to catalog</option></select></label>
      <label className="grid gap-1 text-xs text-slate-500">Identification<select className={input} value={form.analysisStatus || ''} onChange={(event) => update('analysisStatus', event.target.value)}><option value="">All statuses</option>{['queued', 'processing', 'suggested', 'failed', 'skipped', 'manual'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Authenticity review<select className={input} value={form.reviewStatus || ''} onChange={(event) => update('reviewStatus', event.target.value)}><option value="">All statuses</option>{['pending', 'approved', 'rejected', 'quarantined'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Store<select className={input} value={form.storeId || ''} onChange={(event) => update('storeId', event.target.value)}><option value="">All stores</option>{accounts.map((account) => <option key={account.storeId} value={account.storeId}>{account.storeName} · {account.marketplaceId}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Publish status<select className={input} value={form.publicationStatus || ''} onChange={(event) => update('publicationStatus', event.target.value)}><option value="">All statuses</option>{['pending', 'processing', 'success', 'failed', 'skipped'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="grid gap-1 text-xs text-slate-500">Batch<input className={input} value={form.batch || ''} onChange={(event) => update('batch', event.target.value)} placeholder="All batches" /></label>
      <label className="grid gap-1 text-xs text-slate-500 sm:col-span-2">Search all item details<input className={input} value={form.q || ''} onChange={(event) => update('q', event.target.value)} placeholder="SKU, category, condition, price, photos, specifics…" /></label>
      <label className="grid gap-1 text-xs text-slate-500">Attribute name<input className={input} value={form.attributeKey || ''} onChange={(event) => update('attributeKey', event.target.value)} placeholder="For example color or size" /></label>
      <label className="grid gap-1 text-xs text-slate-500">Attribute value<input className={input} value={form.attributeValue || ''} onChange={(event) => update('attributeValue', event.target.value)} placeholder="Exact value when attribute name is set" /></label>
      <div className="flex items-end gap-2 lg:col-span-4"><button type="submit" className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Apply filters</button><button type="button" onClick={reset} className="min-h-10 rounded-lg border px-4 text-sm">Clear filters</button></div>
    </form>

    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
    <div className="overflow-x-auto rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="w-full min-w-[1050px] text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Item</th><th className="p-3">Uploaded by</th><th className="p-3">Identification</th><th className="p-3">Catalog</th><th className="p-3">Review</th><th className="p-3">Store activity</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading && !data ? <tr><td className="p-8 text-center" colSpan={6}>Loading report…</td></tr> : data?.items.map((item) => <tr key={item.id} className="align-top">
            <td className="p-3"><Link to={`/fashion/listings/${item.id}`} className="font-semibold text-pink-700 hover:underline dark:text-pink-300">{item.title}</Link><p className="font-mono text-xs text-slate-500">{item.sku || 'No SKU'} · {item.brand || 'No brand'}</p><ProductDetails item={item} /></td>
            <td className="p-3">{actorLabel(item.uploadedBy)}<span className="block text-xs text-slate-500">{dateLabel(item.createdAt)}</span></td>
            <td className="p-3 capitalize">{item.analysisStatus.replace(/_/g, ' ')}</td>
            <td className="p-3">{item.addedToCatalog ? <>{actorLabel(item.addedBy)}<span className="block text-xs text-slate-500">{dateLabel(item.catalogAddedAt)}</span></> : <span className="text-amber-700 dark:text-amber-300">Waiting in intake</span>}</td>
            <td className="p-3 capitalize">{(item.reviewStatus || item.validationStatus).replace(/_/g, ' ')}</td>
            <td className="p-3">{item.publicationTargets.length ? item.publicationTargets.map((target, index) => <p key={`${target.storeId}-${target.createdAt}-${index}`} className="mb-2"><span className="font-medium">{target.storeName}</span><span className="block text-xs text-slate-500">{target.marketplaceId} · {target.status} · {actorLabel(target.requestedBy)}</span></p>) : <span className="text-slate-500">Not published</span>}</td>
          </tr>)}
          {data && !data.items.length && <tr><td className="p-8 text-center text-slate-500" colSpan={6}>No items match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
      <label className="inline-flex items-center gap-2">Rows<select className={input} value={filters.pageSize || 25} onChange={(event) => setFilters((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) }))}>{[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <span>{data?.total.toLocaleString() ?? 0} items · Page {data?.page ?? 1} of {pageCount}</span>
      <button type="button" disabled={(filters.page || 1) <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
      <button type="button" disabled={(filters.page || 1) >= pageCount || loading} onClick={() => setFilters((current) => ({ ...current, page: (current.page || 1) + 1 }))} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
    </div>
  </div>;
}
