import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { toProxyUrl } from '../../../lib/imageUrl';
import { batchApi, messageOf, SEVERITY_TONE, STATE_LABEL, STATE_TONE, type ReviewView } from './batchApi';
import ListingAuditLog from './ListingAuditLog';

const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
const btn = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';

/** Word-level before/after so reviewers see exactly what the fix changes. */
function Diff({ before, after }: { before: string; after: string }) {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const inB = new Set(b);
  const inA = new Set(a);
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/30"><p className="mb-1 text-xs font-semibold uppercase text-red-700 dark:text-red-300">Before</p><p className="break-words">{a.map((w, i) => (!inB.has(w) && w.trim() ? <del key={i} className="bg-red-200/70 dark:bg-red-900/60">{w}</del> : <span key={i}>{w}</span>))}</p></div>
      <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/30"><p className="mb-1 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">After</p><p className="break-words">{b.map((w, i) => (!inA.has(w) && w.trim() ? <ins key={i} className="bg-emerald-200/70 no-underline dark:bg-emerald-900/60">{w}</ins> : <span key={i}>{w}</span>))}</p></div>
    </div>
  );
}

function ReviewDetail({ item, org, onChanged }: { item: ReviewView; org: string | null; onChanged: (next: ReviewView | null, message: string) => void }) {
  const { permissions } = useAuth();
  const canReview = permissions.includes('fashion.review') && permissions.includes('fashion.authenticity.review');
  const canEdit = canReview && permissions.includes('fashion.listings.update');
  const s = item.suggestion;
  const [title, setTitle] = useState(s?.after.title ?? item.listing.title);
  const [brand, setBrand] = useState(s?.after.brand ?? item.listing.brandSpecific ?? item.listing.brand ?? '');
  const [description, setDescription] = useState(s?.after.description ?? item.listing.description ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [audit, setAudit] = useState(false);

  useEffect(() => {
    setTitle(item.suggestion?.after.title ?? item.listing.title);
    setBrand(item.suggestion?.after.brand ?? item.listing.brandSpecific ?? item.listing.brand ?? '');
    setDescription(item.suggestion?.after.description ?? item.listing.description ?? '');
    setConfirmed(false);
    setError('');
  }, [item]);

  async function run(kind: string, fn: () => Promise<ReviewView>, message: string) {
    setBusy(kind); setError('');
    try { const next = await fn(); onChanged(next, message); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(null); }
  }

  const open = item.issues.filter((i) => !i.autoFixed && i.severity !== 'info');
  const fixed = item.issues.filter((i) => i.autoFixed);
  const blocked = item.state === 'BLOCKED';

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900" aria-label="Listing review">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold">{item.listing.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{item.listing.sku ?? 'No SKU'} · {item.listing.brandSpecific ?? item.listing.brand ?? 'No brand'} · {item.listing.price ? `$${Number(item.listing.price).toFixed(2)}` : 'No price'} · {item.listing.categoryName ?? 'No category'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_TONE[item.state]}`}>{STATE_LABEL[item.state]}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums dark:bg-slate-800">Risk {item.riskScore ?? '—'}</span>
          <button type="button" className={btn} onClick={() => setAudit(true)}><History size={14} /> Audit</button>
        </div>
      </div>

      <h3 className="mt-5 text-sm font-semibold">Issues</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {open.map((i, n) => <li key={n} className={SEVERITY_TONE[i.severity]}><span className="mr-1 rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">{i.severity === 'block' ? 'BLOCK' : i.severity === 'review' ? 'REVIEW' : 'NOTE'}</span>{i.message}{i.source === 'vision' ? <span className="ml-1 text-xs text-slate-500">(image check)</span> : null}</li>)}
        {!open.length ? <li className="text-slate-500">No open issues.</li> : null}
      </ul>
      {fixed.length ? <details className="mt-2 text-sm"><summary className="cursor-pointer text-slate-500">{fixed.length} fixed automatically</summary><ul className="mt-1 space-y-1">{fixed.map((i, n) => <li key={n} className="text-slate-600 dark:text-slate-300">{i.message}</li>)}</ul></details> : null}

      <h3 className="mt-5 text-sm font-semibold">Photos</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        {item.images.map((img) => (
          <figure key={img.index} className="w-28">
            {img.thumb ? <a href={toProxyUrl(img.thumb)} target="_blank" rel="noreferrer"><img src={toProxyUrl(img.thumb)} alt={`Photo ${img.index + 1}`} className={`h-28 w-28 rounded-lg border object-contain ${img.excluded ? 'opacity-40 grayscale' : ''}`} loading="lazy" /></a> : <div className="flex h-28 w-28 items-center justify-center rounded-lg border text-xs text-slate-500">No preview</div>}
            <figcaption className="mt-1 text-xs text-slate-500">#{img.index + 1}{img.width ? ` · ${Math.max(img.width, img.height ?? 0)}px` : ''}{img.flags.includes('low_quality') ? ' · low-res' : ''}{img.excluded ? <span className="block text-amber-700 dark:text-amber-300">Not sent to eBay: {img.excluded.code.replace('IMAGE_', '').toLowerCase().replace('_', ' ')}</span> : null}{img.error ? <span className="block text-red-700">{img.error}</span> : null}</figcaption>
          </figure>
        ))}
      </div>

      {s && s.status === 'pending' ? (
        <div className="mt-5 rounded-xl border border-pink-200 p-4 dark:border-pink-900">
          <h3 className="text-sm font-semibold">Suggested fix {s.model ? <span className="font-normal text-slate-500">· {s.model}</span> : null}</h3>
          {s.rationale ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{s.rationale}</p> : null}
          <div className="mt-3 space-y-3">
            {s.before.title !== s.after.title ? <Diff before={s.before.title} after={s.after.title} /> : null}
            {s.before.brand !== s.after.brand ? <Diff before={s.before.brand ?? '(none)'} after={s.after.brand ?? '(none)'} /> : null}
            {s.before.description !== s.after.description ? <details><summary className="cursor-pointer text-sm">Description change</summary><Diff before={s.before.description ?? ''} after={s.after.description ?? ''} /></details> : null}
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <fieldset disabled={!!busy} className="mt-5 space-y-3">
          <legend className="text-sm font-semibold">{s?.status === 'pending' ? 'Approve, edit or reject the fix' : 'Edit listing'}</legend>
          <label className="block text-sm">Title <span className="text-xs text-slate-500">({title.length}/80)</span><input className={field} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block text-sm">Brand<input className={field} value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
          <details><summary className="cursor-pointer text-sm">Description</summary><textarea className={field} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} /></details>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${btn} bg-pink-600 text-white`} onClick={() => void run('apply', () => batchApi.applySuggestion(item.catalogProductId, { title, brand: brand || null, description: description || null }, org), 'Fix saved and the listing was re-checked.')}>{busy === 'apply' ? <Loader2 size={14} className="animate-spin" /> : null}{s?.status === 'pending' ? 'Apply fix & re-check' : 'Save & re-check'}</button>
            {s?.status === 'pending' ? <button type="button" className={btn} onClick={() => void run('rejectfix', () => batchApi.rejectSuggestion(item.catalogProductId, org), 'Suggested fix rejected.')}>Reject suggested fix</button> : null}
            <button type="button" className={btn} onClick={() => void run('recheck', () => batchApi.recheck(item.catalogProductId, org), 'Listing re-checked.')}>{busy === 'recheck' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Re-run check</button>
          </div>
        </fieldset>
      ) : null}

      {canReview ? (
        <fieldset disabled={!!busy} className="mt-6 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <legend className="sr-only">Decision</legend>
          <label className="block text-sm">Notes<textarea className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for rejection, or what you checked" /></label>
          {!blocked ? (
            <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><input type="checkbox" className="mt-1 h-4 w-4" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I checked the photos and listing and confirm this item is authentic and accurately described.</span></label>
          ) : <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-100">Blocked listings cannot be approved. Fix the listing and re-run the check, or reject it.</p>}
          <div className="flex flex-wrap gap-2">
            {!blocked ? <button type="button" disabled={!confirmed} className={`${btn} bg-emerald-700 text-white`} onClick={() => void run('approve', () => batchApi.approve(item.catalogProductId, { authenticityConfirmed: true, notes: notes || undefined }, org), 'Approved. The next live batch will publish it.')}>Approve</button> : null}
            <button type="button" disabled={!notes.trim()} className={`${btn} text-red-700 dark:text-red-400`} onClick={() => void run('reject', () => batchApi.reject(item.catalogProductId, notes, org), 'Listing rejected and blocked from publishing.')}>Reject listing</button>
          </div>
        </fieldset>
      ) : <p className="mt-4 text-sm text-slate-500">Your permissions allow viewing only.</p>}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p> : null}
      {audit ? <ListingAuditLog productId={item.catalogProductId} organizationId={org} onClose={() => setAudit(false)} /> : null}
    </section>
  );
}

export default function FashionComplianceReviewPage() {
  const { activeOrganizationId: org } = useAuth();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<'NEEDS_REVIEW' | 'BLOCKED'>('NEEDS_REVIEW');
  const [rows, setRows] = useState<ReviewView[] | null>(null);
  const [selected, setSelected] = useState<ReviewView | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => {
    setRows(null);
    batchApi.queue(state, org).then(setRows).catch((e) => { setRows([]); setError(messageOf(e)); });
  }, [state, org]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = params.get('listing');
    if (id) batchApi.listing(id, org).then(setSelected).catch((e) => setError(messageOf(e)));
  }, [params, org]);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Compliance review</h1>
      <p className="mt-2 text-slate-500">Listings the counterfeit/VeRO check could not pass on its own. Approve accurate listings, apply or edit the suggested fix, or reject.</p>
      {message ? <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      <div className="my-5 flex flex-wrap gap-2">
        {(['NEEDS_REVIEW', 'BLOCKED'] as const).map((s) => <button key={s} type="button" className={`${btn} ${state === s ? 'bg-pink-600 text-white' : ''}`} onClick={() => { setState(s); setSelected(null); }}>{STATE_LABEL[s]}</button>)}
        <button type="button" className={btn} onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          {!rows ? <p role="status" className="text-sm text-slate-500">Loading…</p> : null}
          {rows && !rows.length ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500 dark:bg-slate-900">Nothing here.</p> : null}
          {rows?.map((r) => (
            <button key={r.catalogProductId} type="button" onClick={() => { setSelected(r); setMessage(''); setParams({ listing: r.catalogProductId }); }} className={`block w-full rounded-xl p-3 text-left shadow-sm ${selected?.catalogProductId === r.catalogProductId ? 'bg-pink-50 ring-2 ring-pink-300 dark:bg-pink-950/30' : 'bg-white dark:bg-slate-900'}`}>
              <p className="line-clamp-2 text-sm font-medium">{r.listing.title}</p>
              <p className="mt-1 text-xs text-slate-500">Risk {r.riskScore ?? '—'} · {r.issues.filter((i) => !i.autoFixed && (i.severity === 'review' || i.severity === 'block')).map((i) => i.code).join(', ') || 'no open issues'}</p>
            </button>
          ))}
        </div>
        <div>
          {selected ? <ReviewDetail item={selected} org={org} onChanged={(next, msg) => { setMessage(msg); setSelected(next); load(); }} /> : <p className="rounded-xl bg-white p-5 text-sm text-slate-500 dark:bg-slate-900">Choose a listing to review.</p>}
        </div>
      </div>
    </div>
  );
}
