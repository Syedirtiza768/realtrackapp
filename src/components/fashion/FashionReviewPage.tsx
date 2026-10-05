import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import { toProxyUrl } from '../../lib/imageUrl';
import { useAuth } from '../auth/AuthContext';

type Listing = { id: string; sku: string | null; title: string; verticalValidationStatus: string; description?: string | null; brand?: string | null; imageUrls?: string[]; verticalAttributes?: Record<string, unknown> };
type Review = { status: string; evidenceKeys: string[]; notes: string | null; reviewedAt: string | null; reviewedByUserId?: string | null };
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';

function ReviewDetails({ item, onClose, onSaved }: { item: Listing; onClose: () => void; onSaved: (message: string) => void }) {
  const { permissions } = useAuth();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const canReview = permissions.includes('fashion.review');
  const quarantined = item.verticalValidationStatus === 'quarantined' || review?.status === 'quarantined';
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setConfirmed(false);
    fetchWithAuth<Review>(`/api/fashion/listings/${encodeURIComponent(item.id)}/review`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setReview(data); setEvidence((data.evidenceKeys ?? []).join('\n')); setNotes(data.notes ?? ''); } })
      .catch((err) => { if (!controller.signal.aborted) setError(messageOf(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [item.id, revision]);
  async function submit(decision: 'approved' | 'rejected') {
    if (!canReview || !review || saving || loading || quarantined || (decision === 'approved' && !confirmed)) return;
    if (decision === 'rejected' && !notes.trim()) { setError('Add a reason before rejecting this listing.'); return; }
    setSaving(true); setError('');
    try {
      await fetchWithAuth(`/api/fashion/listings/${encodeURIComponent(item.id)}/review`, { method: 'POST', body: JSON.stringify({
        decision, authenticityConfirmed: decision === 'approved' && confirmed,
        evidenceKeys: [...new Set(evidence.split('\n').map((key) => key.trim()).filter(Boolean))], notes: notes.trim(),
      }) });
      onSaved(decision === 'approved' ? 'Authenticity approved. Publishing requires a separate action.' : 'Listing rejected. Review notes and evidence references saved.');
    } catch (err) { setConfirmed(false); setError(messageOf(err)); }
    finally { setSaving(false); }
  }
  return <section className="mt-6 rounded-xl border border-pink-200 bg-white p-5 dark:border-pink-900 dark:bg-slate-900" aria-label="Listing review details">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-1 text-sm text-slate-500">{item.sku || 'No SKU'} · {item.brand || 'Brand not provided'} · {item.verticalValidationStatus}</p></div><button className={button} disabled={saving} onClick={onClose}>Close details</button></div>
    {item.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm">{item.description}</p>}
    <div className="my-4 flex flex-wrap gap-3">{(item.imageUrls ?? []).filter((url) => /^https?:\/\//i.test(url) || url.startsWith('/api/storage/serve/')).map((url, index) => <a href={toProxyUrl(url)} target="_blank" rel="noreferrer" key={index}><img className="h-28 w-28 rounded-lg border object-contain" src={toProxyUrl(url)} alt={`${item.title}, image ${index + 1}`} loading="lazy" /></a>)}</div>
    <details className="my-4 text-sm"><summary className="cursor-pointer font-medium">Fashion attributes</summary><dl className="mt-2 space-y-2">{Object.entries(item.verticalAttributes ?? {}).map(([key, value]) => <div className="break-words" key={key}><dt className="font-medium">{key}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl></details>
    {loading && <p role="status">Loading private review details…</p>}
    {error && <p role="alert" className="my-4 text-sm text-red-700 dark:text-red-400">{error} {!review && !loading && <button className={button} onClick={() => setRevision((n) => n + 1)}>Retry details</button>}</p>}
    {!loading && review && <><p className="my-4 text-xs text-slate-500">Review: {review.status} · {review.reviewedAt ? new Date(review.reviewedAt).toLocaleString() : 'Not yet reviewed'}{review.reviewedByUserId ? ` · Reviewer ${review.reviewedByUserId}` : ''}</p>
      {quarantined && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Quarantine blocks approval and rejection here. <Link to="/fashion/incidents" className="underline">View incidents</Link>.</p>}
      <fieldset disabled={saving || !canReview || quarantined} className="space-y-4">
        <label className="block text-sm font-medium">Private evidence references<textarea className={field} rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="One existing private evidence key or reference per line" /><span className="mt-1 block text-xs font-normal text-slate-500">References only; this form does not upload or verify evidence. Inspect the supporting records before confirming authenticity.</span></label>
        <label className="block text-sm font-medium">Review notes<textarea className={field} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Record your assessment and a reason for rejection." /></label>
        <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800"><input type="checkbox" className="mt-1 h-4 w-4" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I inspected this listing and supporting evidence, and explicitly confirm its authenticity for this approval.</span></label>
        {canReview && !quarantined && <div className="flex flex-wrap gap-3"><button className={`${button} bg-emerald-700 font-semibold text-white`} disabled={!confirmed || saving} onClick={() => void submit('approved')}>{saving ? 'Saving review…' : 'Approve authenticity'}</button><button className={`${button} text-red-700 dark:text-red-400`} disabled={!notes.trim() || saving} onClick={() => void submit('rejected')}>Reject listing</button></div>}
      </fieldset>{!canReview && <p className="mt-3 text-sm text-slate-500">Your permissions allow viewing evidence only.</p>}
    </>}
  </section>;
}

export default function FashionReviewPage() {
  const { permissions } = useAuth();
  const canView = ['fashion.access', 'fashion.listings.view', 'fashion.authenticity.review'].every((key) => permissions.includes(key));
  const [items, setItems] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState('pending');
  useEffect(() => {
    if (!canView) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchWithAuth<Listing[]>('/api/fashion/listings?limit=200', { signal: controller.signal })
      .then((rows) => { if (!controller.signal.aborted) setItems(rows); })
      .catch((err) => { if (!controller.signal.aborted) setError(messageOf(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canView, revision]);
  if (!canView) return <p role="alert">You do not have permission to view Fashion listings and private authenticity evidence.</p>;
  const visible = items.filter((item) => filter === 'all' || (filter === 'pending' ? ['draft', 'pending', 'needs_review', 'unvalidated'].includes(item.verticalValidationStatus) : item.verticalValidationStatus === filter));
  return <div><h1 className="text-3xl font-semibold">Authenticity review</h1><p className="mt-2 text-slate-500">Inspect each listing and its private evidence before recording a decision.</p>
    {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    <div className="my-5 flex flex-wrap items-center gap-3"><label className="text-sm">Review status <select className={button} disabled={!!selected} value={filter} onChange={(e) => setFilter(e.target.value)}>{[['pending', 'Awaiting review'], ['rejected', 'Rejected'], ['approved', 'Approved'], ['quarantined', 'Quarantined'], ['all', 'All statuses']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className={button} disabled={loading || !!selected} onClick={() => setRevision((n) => n + 1)}>Refresh queue</button></div>
    {loading && <p role="status">Loading review queue…</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error} <button className={button} onClick={() => setRevision((n) => n + 1)}>Retry</button></p>}
    {!loading && !error && <><p className="mb-3 text-xs text-slate-500">{visible.length} matching listings in the latest {items.length} records (maximum 200).</p><div className="space-y-3">{visible.map((item) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900" key={item.id}><div><p className="font-medium">{item.title}</p><p className="text-sm text-slate-500">{item.sku || 'No SKU'} · {item.verticalValidationStatus}</p></div><button className={button} disabled={!!selected} onClick={() => { setSelected(item); setMessage(''); }}>Review details</button></div>)}{!visible.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 dark:bg-slate-900">No listings match this review status.</p>}</div></>}
    {selected && <ReviewDetails key={selected.id} item={selected} onClose={() => setSelected(null)} onSaved={(text) => { setMessage(text); setSelected(null); setRevision((n) => n + 1); }} />}
  </div>;
}
