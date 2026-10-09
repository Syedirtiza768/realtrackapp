import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ImageOff, PackagePlus, RotateCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  fashionError,
  addFashionIntakeToCatalog,
  listFashionBatches,
  listFashionIntake,
  requestFashionIdentification,
  type FashionBatch,
  type FashionIntakePage as IntakePage,
} from '../../lib/fashionListingsApi';
import { toProxyUrl } from '../../lib/imageUrl';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  processing: { label: 'Identifying', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  suggested: { label: 'Identified', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  skipped: { label: 'Manual', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
};
const control = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';

/** Paginated Fashion intake history with batch/status filters and identification retry. */
export default function FashionIntakePage() {
  const { permissions, activeOrganizationId } = useAuth();
  const canRetry = permissions.includes('fashion.listings.update');
  const canAdd = permissions.includes('fashion.listings.create');
  const [batches, setBatches] = useState<FashionBatch[]>([]);
  const [batch, setBatch] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'capture' | 'all'>('capture');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<IntakePage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listFashionBatches(controller.signal, activeOrganizationId).then(setBatches).catch(() => undefined);
    return () => controller.abort();
  }, [activeOrganizationId]);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    listFashionIntake({ batch, status, q: search, source, page, pageSize }, controller.signal, activeOrganizationId)
      .then(setData)
      .catch((err) => { if (!controller.signal.aborted) setError(fashionError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [batch, status, search, source, page, pageSize, tick, activeOrganizationId]);
  // Refresh while any visible item is still being identified.
  const pending = data?.items.some((item) => item.analysisStatus === 'queued' || item.analysisStatus === 'processing');
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), 5000);
    return () => window.clearTimeout(timer);
  }, [pending, data]);

  async function retry(id: string) {
    setRetrying(id); setError('');
    try { await requestFashionIdentification(id, activeOrganizationId); setTick((value) => value + 1); }
    catch (err) { setError(fashionError(err)); }
    finally { setRetrying(null); }
  }

  async function addToCatalog(id: string) {
    setAdding(id); setError(''); setMessage('');
    try {
      await addFashionIntakeToCatalog(id, activeOrganizationId);
      setMessage('Item added to the Fashion catalog.');
      setTick((value) => value + 1);
    } catch (err) { setError(fashionError(err)); }
    finally { setAdding(null); }
  }

  const total = data?.total ?? 0;
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Intake history</h1>
          <p className="mt-1 text-sm text-slate-500">Every captured garment, with its batch, photos, warehouse and identification status.</p>
        </div>
        {permissions.includes('fashion.listings.create') && <Link to="/fashion/capture" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-pink-600 px-4 text-sm font-semibold text-white"><Camera size={16} /> Quick capture</Link>}
      </div>
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(q.trim()); }}>
        <label className="text-sm">Batch<select className={`mt-1 block ${control}`} value={batch} onChange={(event) => { setBatch(event.target.value); setPage(1); }}><option value="">All batches</option>{batches.map((item) => <option key={item.batch} value={item.batch}>{item.batch} ({item.itemCount})</option>)}</select></label>
        <label className="text-sm">Identification<select className={`mt-1 block ${control}`} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Any status</option>{Object.entries(STATUS_LABELS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
        <label className="text-sm">Show<select className={`mt-1 block ${control}`} value={source} onChange={(event) => { setSource(event.target.value as 'capture' | 'all'); setPage(1); }}><option value="capture">Quick capture only</option><option value="all">All Fashion items</option></select></label>
        <label className="min-w-48 flex-1 text-sm">Search<input className={`mt-1 block w-full ${control}`} value={q} onChange={(event) => setQ(event.target.value)} placeholder="SKU or title" /></label>
        <button type="submit" className="min-h-10 rounded-lg border px-4 text-sm">Search</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading && !data ? <p role="status">Loading intake history…</p> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60"><tr>
              <th className="p-3 font-medium">Item</th><th className="p-3 font-medium">Batch</th><th className="p-3 font-medium">Images</th><th className="p-3 font-medium">Warehouse</th><th className="p-3 font-medium">Identification</th><th className="p-3 font-medium">Catalog</th><th className="p-3 font-medium">Review</th><th className="p-3 font-medium">Captured</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.items.map((item) => {
                const badge = STATUS_LABELS[item.analysisStatus ?? ''] ?? { label: '—', className: 'text-slate-500' };
                return (
                  <tr key={item.id} className="align-top">
                    <td className="p-3"><Link to={`/fashion/listings/${item.id}`} className="flex items-start gap-3">
                      {item.primaryImageUrl ? <img src={toProxyUrl(item.primaryImageUrl)} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800"><ImageOff size={16} /></span>}
                      <span><span className="block font-mono font-semibold text-pink-700 dark:text-pink-400">{item.sku}</span><span className="line-clamp-2 text-slate-600 dark:text-slate-300">{item.title}</span></span>
                    </Link></td>
                    <td className="p-3">{item.batch ?? '—'}</td>
                    <td className="p-3">{item.imageCount}{item.hasSizeChart ? <span className="ml-1 text-xs text-slate-500">+ chart</span> : null}</td>
                    <td className="p-3">{item.warehouseCode ?? '—'}</td>
                    <td className="p-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                      {canRetry && (item.analysisStatus === 'failed' || item.analysisStatus === 'skipped') && item.imageCount > 0 && <button type="button" disabled={retrying === item.id} onClick={() => void retry(item.id)} className="mt-1 flex items-center gap-1 text-xs text-pink-600 disabled:opacity-40"><RotateCw size={12} /> {item.analysisStatus === 'failed' ? 'Retry' : 'Identify'}</button>}
                    </td>
                    <td className="p-3">
                      {item.addedToCatalog ? <span className="text-emerald-700 dark:text-emerald-300">Added</span> : ['suggested', 'skipped'].includes(item.analysisStatus ?? '') && canAdd && !item.manualReview && !['quarantined', 'blocked', 'rejected'].includes(item.validationStatus) ? <button type="button" disabled={adding === item.id} onClick={() => void addToCatalog(item.id)} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-pink-700 disabled:opacity-40 dark:text-pink-300"><PackagePlus size={13} /> {adding === item.id ? 'Adding…' : 'Add to catalog'}</button> : item.manualReview || ['quarantined', 'blocked', 'rejected'].includes(item.validationStatus) ? <span className="text-amber-700 dark:text-amber-300">Review required</span> : <span className="text-slate-500">Waiting for processing</span>}
                    </td>
                    <td className="p-3 capitalize">{item.reviewStatus.replace(/_/g, ' ')}</td>
                    <td className="p-3 whitespace-nowrap text-slate-500">{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
              {data && !data.items.length && <tr><td colSpan={8} className="p-6 text-center text-slate-500">No intake items match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
        <label className="inline-flex items-center gap-2">Rows per page<select className={control} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        <span>{first}–{last} of {total}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
          <button type="button" disabled={last >= total} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
