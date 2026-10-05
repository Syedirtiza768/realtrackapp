import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import { useAuth } from '../auth/AuthContext';

type Listing = { id: string; title: string; sku: string | null; brand?: string | null; verticalValidationStatus: string; updatedAt?: string };
type Review = { status: string; notes: string | null; evidenceKeys?: string[]; reviewedAt: string | null; reviewedByUserId?: string | null };
const button = 'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';
const field = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete request.';

function IncidentDetails({ item }: { item: Listing }) {
  const { permissions } = useAuth();
  const canEvidence = permissions.includes('fashion.authenticity.review');
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!canEvidence) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    fetchWithAuth<Review>(`/api/fashion/listings/${encodeURIComponent(item.id)}/review`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setReview(data); })
      .catch((err) => { if (!controller.signal.aborted) setError(messageOf(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [item.id, canEvidence, revision]);
  return <div className="mt-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-800"><dl className="space-y-2"><div><dt className="text-slate-500">Listing ID</dt><dd className="break-all">{item.id}</dd></div><div><dt className="text-slate-500">Last listing update</dt><dd>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Unavailable'}</dd></div><div><dt className="text-slate-500">Local status</dt><dd>Quarantined</dd></div><div><dt className="text-slate-500">Remote removal</dt><dd>Not verified by this incident view. Check each active eBay offer separately.</dd></div></dl>
    {!canEvidence ? <p className="mt-3 text-slate-500">Private evidence requires authenticity review permission.</p> : <>
      {loading && <p role="status" className="mt-3">Loading private compliance record…</p>}
      {error && <p role="alert" className="mt-3 text-red-700 dark:text-red-400">{error} <button className={button} onClick={() => setRevision((n) => n + 1)}>Retry details</button></p>}
      {!loading && !error && review && <div className="mt-4 space-y-3"><p>Review status: {review.status} · {review.reviewedAt ? new Date(review.reviewedAt).toLocaleString() : 'No review timestamp'}</p>{review.reviewedByUserId && <p className="break-all">Recorded by: {review.reviewedByUserId}</p>}<div><h3 className="font-medium">Private review notes</h3><p className="mt-1 whitespace-pre-wrap break-words">{review.notes || 'No notes recorded.'}</p></div><div><h3 className="font-medium">Private evidence references</h3>{review.evidenceKeys?.length ? <ul className="mt-1 list-inside list-disc space-y-1">{review.evidenceKeys.map((key, index) => <li className="break-all" key={index}>{key}</li>)}</ul> : <p className="mt-1 text-slate-500">No evidence references recorded.</p>}</div></div>}
    </>}
  </div>;
}

export default function FashionIncidentsPage() {
  const { permissions } = useAuth();
  const canManage = permissions.includes('fashion.access') && permissions.includes('fashion.incidents.manage');
  const canListings = permissions.includes('fashion.listings.view');
  const [items, setItems] = useState<Listing[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [listingError, setListingError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState('');
  const [target, setTarget] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setListingError(''); setTarget(''); setConfirmed(false);
    void Promise.allSettled([
      fetchWithAuth<Listing[]>('/api/fashion/incidents', { signal: controller.signal }),
      canListings ? fetchWithAuth<Listing[]>('/api/fashion/listings?limit=200', { signal: controller.signal }) : Promise.resolve([] as Listing[]),
    ]).then(([incidents, candidates]) => {
      if (controller.signal.aborted) return;
      if (incidents.status === 'fulfilled') setItems(incidents.value); else setError(messageOf(incidents.reason));
      if (candidates.status === 'fulfilled') setListings(candidates.value); else { setListings([]); setListingError(messageOf(candidates.reason)); }
      setLoading(false);
    });
    return () => controller.abort();
  }, [canManage, canListings, revision]);
  async function quarantine() {
    if (!canManage || saving || !confirmed || !target || loading) return;
    const listing = listings.find((item) => item.id === target && item.verticalValidationStatus !== 'quarantined');
    if (!listing) return;
    setSaving(true); setActionError(''); setMessage('');
    try {
      await fetchWithAuth(`/api/fashion/listings/${encodeURIComponent(target)}/quarantine`, { method: 'POST' });
      setMessage(`${listing.sku || listing.title} is quarantined locally. Remote removal has not been verified. Inspect its active eBay offers and follow the incident response procedure.`);
      setConfirmed(false); setTarget(''); setRevision((n) => n + 1);
    } catch (err) { setActionError(messageOf(err)); }
    finally { setSaving(false); }
  }
  if (!canManage) return <p role="alert">You do not have permission to manage Fashion incidents.</p>;
  const candidates = listings.filter((item) => item.verticalValidationStatus !== 'quarantined');
  return <div><h1 className="text-3xl font-semibold">Quarantine incidents</h1><p className="mt-2 text-slate-500">Inspect locally quarantined items and record a manual quarantine when a policy issue is confirmed.</p>
    <div className="my-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Local quarantine blocks further publication. This view does not verify remote removal or provide an automatic counterfeit notification feed. Check active offers on eBay and escalate unavailable authorization or failed withdrawal. Quarantine release is not available here.</div>
    {canListings && <section className="mb-5 rounded-xl bg-white p-5 dark:bg-slate-900"><h2 className="font-semibold">Quarantine a listing</h2><p className="mt-1 text-xs text-slate-500">Selection covers the latest 200 listings. This action records a local block; it does not end an eBay offer.</p>
      {listingError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{listingError}</p>}
      <fieldset disabled={saving || loading || !!listingError} className="mt-3 space-y-3"><label className="block text-sm">Affected item<select className={field} value={target} onChange={(e) => { setTarget(e.target.value); setConfirmed(false); }}><option value="">Select the affected listing</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.sku || 'No SKU'} — {item.title}</option>)}</select></label>
        {!loading && !listingError && !candidates.length && <p className="text-sm text-slate-500">No eligible listings in the loaded records.</p>}
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I verified the affected item and want to quarantine it locally. Remote takedown needs separate verification.</span></label>
        <button className={`${button} bg-red-700 text-white`} disabled={!target || !confirmed} onClick={() => void quarantine()}>{saving ? 'Quarantining…' : 'Quarantine selected item'}</button>
      </fieldset>{actionError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{actionError}</p>}
    </section>}
    {message && <p role="status" className="my-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    <button className={`${button} mb-4`} disabled={loading || saving} onClick={() => { setSelected(''); setRevision((n) => n + 1); }}>Refresh incidents</button>
    {loading && <p role="status">Loading quarantined listings…</p>}
    {error && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-400">{error}</p>}
    {!loading && !error && <div className="space-y-3">{items.map((item) => <section className="rounded-xl bg-white p-5 dark:bg-slate-900" key={item.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">{item.title}</h2><p className="text-sm text-slate-500">{item.sku || 'No SKU'} · {item.brand || 'No brand'} · Quarantined</p></div><button className={button} onClick={() => setSelected((id) => id === item.id ? '' : item.id)} aria-expanded={selected === item.id}>{selected === item.id ? 'Close incident' : 'View incident'}</button></div>{selected === item.id && <IncidentDetails key={item.id} item={item} />}</section>)}{!items.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 dark:bg-slate-900">No locally quarantined Fashion listings were returned.</p>}</div>}
    {canListings && <Link className="mt-5 inline-block text-sm text-pink-700 underline dark:text-pink-400" to="/fashion/listings">Open Fashion listings</Link>}
  </div>;
}
