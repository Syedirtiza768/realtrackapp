import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, ExternalLink, History, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { toProxyUrl } from '../../../lib/imageUrl';
import {
  batchApi,
  messageOf,
  STATE_LABEL,
  STATE_TONE,
  type BatchDetail,
  type BatchSummary,
  type PipelineState,
} from './batchApi';
import ListingAuditLog from './ListingAuditLog';

const ORDER: PipelineState[] = ['UNPUBLISHED', 'IMAGES_PROCESSING', 'IMAGES_READY', 'COMPLIANCE_CHECK', 'READY', 'NEEDS_REVIEW', 'BLOCKED', 'PUBLISHING', 'PUBLISHED', 'FAILED'];
const btn = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

function useOrg() {
  return useAuth().activeOrganizationId;
}

function StateBadge({ state }: { state: PipelineState }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>;
}

function total(counts: Partial<Record<PipelineState, number>>) {
  return Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
}

function BatchList() {
  const org = useOrg();
  const [rows, setRows] = useState<BatchSummary[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    batchApi.list(org).then(setRows).catch((e) => setError(messageOf(e)));
  }, [org]);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Publish batches</h1>
      <p className="mt-2 text-slate-500">Start a batch from the Catalog with <strong>Publish next</strong>. Each batch processes photos, runs the counterfeit/VeRO check and publishes listings that pass.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {!rows && !error ? <p className="mt-4 text-sm text-slate-500" role="status">Loading…</p> : null}
      {rows && !rows.length ? <p className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-500 dark:bg-slate-900">No batches yet. Open the <Link className="underline" to="/fashion/catalog">Catalog</Link> and choose “Publish next”.</p> : null}
      <div className="mt-6 space-y-3">
        {rows?.map((b) => (
          <Link key={b.id} to={`/fashion/batches/${b.id}`} className="block rounded-xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-pink-200 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{b.dryRun ? 'Dry run' : 'Live publish'} · {total(b.counts)} listing(s)</p>
              <span className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()} · {b.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ORDER.filter((s) => b.counts[s]).map((s) => <span key={s} className={`rounded-full px-2 py-0.5 text-xs ${STATE_TONE[s]}`}>{STATE_LABEL[s]} {b.counts[s]}</span>)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function BatchDetailView({ id }: { id: string }) {
  const org = useOrg();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canRetry = permissions.includes('fashion.publish');
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<PipelineState | 'ALL'>('ALL');
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => batchApi.get(id, org).then((b) => { setBatch(b); setError(''); }).catch((e) => setError(messageOf(e))), [id, org]);
  useEffect(() => { void load(); }, [load]);
  const running = batch && batch.status !== 'completed';
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [running, load]);

  const items = useMemo(() => (batch?.items ?? []).filter((i) => filter === 'ALL' || i.state === filter), [batch, filter]);
  if (error && !batch) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!batch) return <p role="status" className="text-sm text-slate-500">Loading batch…</p>;
  const n = total(batch.counts);
  const done = batch.items.filter((i) => i.finishedAt).length;

  async function retry(itemId: string) {
    setBusy(itemId);
    try { await batchApi.retry(itemId, org); await load(); } catch (e) { setError(messageOf(e)); } finally { setBusy(null); }
  }

  return (
    <div>
      <button type="button" className="text-sm text-slate-500 underline" onClick={() => navigate('/fashion/batches')}>← All batches</button>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{batch.dryRun ? 'Dry run' : 'Live publish'} · {n} listing(s)</h1>
          <p className="mt-1 text-sm text-slate-500">Started {new Date(batch.createdAt).toLocaleString()} · {batch.status === 'completed' ? `finished ${batch.completedAt ? new Date(batch.completedAt).toLocaleString() : ''}` : `${done} of ${n} done`}{batch.marketplaceId ? ` · ${batch.marketplaceId}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => void load()}><RefreshCw size={14} className={running ? 'animate-spin motion-reduce:animate-none' : ''} /> Refresh</button>
          <button type="button" className={btn} onClick={() => batchApi.downloadReport(batch.id, org).catch((e) => setError(messageOf(e)))}><Download size={14} /> Report CSV</button>
          {(batch.counts.NEEDS_REVIEW ?? 0) > 0 ? <Link className={btn} to="/fashion/compliance-review">Review queue ({batch.counts.NEEDS_REVIEW})</Link> : null}
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={done}>
        <div className="h-full bg-pink-600 transition-all" style={{ width: `${n ? (done / n) * 100 : 0}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ORDER.filter((s) => batch.counts[s]).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(filter === s ? 'ALL' : s)} className={`rounded-xl p-3 text-left ring-1 ring-slate-200 dark:ring-slate-700 ${filter === s ? 'bg-pink-50 ring-pink-400 dark:bg-pink-950/30' : 'bg-white dark:bg-slate-900'}`}>
            <span className="block text-2xl font-semibold tabular-nums">{batch.counts[s]}</span>
            <span className="text-xs text-slate-500">{STATE_LABEL[s]}</span>
          </button>
        ))}
      </div>

      {batch.topIssues.length ? (
        <section className="mt-5 rounded-xl bg-white p-4 dark:bg-slate-900">
          <h2 className="text-sm font-semibold">Top issue types</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">{batch.topIssues.map((t) => <span key={t.code} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{t.code} · {t.count}</span>)}</div>
        </section>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="p-3">#</th><th className="p-3">Listing</th><th className="p-3">Status</th><th className="p-3">Risk</th><th className="p-3">Issues</th><th className="p-3">eBay</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                <td className="p-3 tabular-nums text-slate-500">{i.position + 1}</td>
                <td className="p-3">
                  <div className="flex gap-3">
                    {i.thumbUrl ? <img src={toProxyUrl(i.thumbUrl)} alt="" className="h-12 w-12 flex-none rounded object-cover" loading="lazy" /> : <div className="h-12 w-12 flex-none rounded bg-slate-100 dark:bg-slate-800" />}
                    <div className="min-w-0"><p className="line-clamp-2 font-medium">{i.title}</p><p className="text-xs text-slate-500">{i.sku ?? 'No SKU'}{i.brand ? ` · ${i.brand}` : ''}{i.price ? ` · $${Number(i.price).toFixed(2)}` : ''}</p></div>
                  </div>
                </td>
                <td className="p-3"><StateBadge state={i.state} />{i.complianceResult ? <p className="mt-1 text-xs text-slate-500">{i.complianceResult.replace('_', ' ').toLowerCase()}</p> : null}</td>
                <td className="p-3 tabular-nums">{i.riskScore ?? '—'}</td>
                <td className="max-w-xs p-3 text-xs text-slate-600 dark:text-slate-300">{i.issueCodes.join(', ') || '—'}{i.error ? <p className="mt-1 break-words text-red-700 dark:text-red-400">{i.error}</p> : null}</td>
                <td className="p-3">{i.ebayItemId ? <a className="inline-flex items-center gap-1 text-pink-700 underline" href={`https://www.ebay.com/itm/${i.ebayItemId}`} target="_blank" rel="noreferrer">{i.ebayItemId} <ExternalLink size={12} /></a> : '—'}</td>
                <td className="whitespace-nowrap p-3 text-right">
                  <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Audit log" aria-label="Audit log" onClick={() => setAuditFor(i.catalogProductId)}><History size={16} /></button>
                  {i.state === 'FAILED' && canRetry ? <button type="button" disabled={busy === i.id} className="ml-1 inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700" onClick={() => void retry(i.id)}>{busy === i.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Retry</button> : null}
                  {i.state === 'NEEDS_REVIEW' || i.state === 'BLOCKED' ? <Link className="ml-1 text-xs text-pink-700 underline" to={`/fashion/compliance-review?listing=${i.catalogProductId}`}>Review</Link> : null}
                </td>
              </tr>
            ))}
            {!items.length ? <tr><td colSpan={7} className="p-5 text-center text-slate-500">No listings in this view.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {auditFor ? <ListingAuditLog productId={auditFor} organizationId={org} onClose={() => setAuditFor(null)} /> : null}
    </div>
  );
}

export default function FashionBatchesPage() {
  const { id } = useParams();
  return id ? <BatchDetailView id={id} /> : <BatchList />;
}
