import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

type ReviewItem = { id: string; listing: { id: string; sku: string | null; title: string; verticalValidationStatus: string; verticalAttributes: Record<string, unknown> } | null; status: string; riskFlags: string[]; evidenceCount: number; provenanceConfirmed: boolean; specificationsVerified: boolean; testingReviewed: boolean; restrictedCategoryCleared: boolean };
type Store = { id: string; storeName: string; status: string; marketplaceId: string | null };
type Unit = { id: string; serialNumberPrivate: string; serialNumberPublic: string | null; status: string; allocatedStoreId: string | null; allocatedOfferId: string | null };
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete review request.';
const input = 'rounded border border-slate-300 dark:border-slate-700';

function ReviewCard({ item, onSaved, stores, selectedStore, setSelectedStore }: { item: ReviewItem; onSaved: (message: string) => void; stores: Store[]; selectedStore: string; setSelectedStore: (value: string) => void }) {
  const [checks, setChecks] = useState({ provenance: item.provenanceConfirmed, specifications: item.specificationsVerified, testing: item.testingReviewed, restricted: item.restrictedCategoryCleared });
  const [notes, setNotes] = useState('');
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function submit(decision: 'approved' | 'rejected') {
    setBusy(decision); setError('');
    try {
      await fetchWithAuth('/api/business-industrial/listings/' + item.listing?.id + '/review', { method: 'POST', body: JSON.stringify({ decision, provenanceConfirmed: checks.provenance, specificationsVerified: checks.specifications, testingReviewed: checks.testing, restrictedCategoryCleared: checks.restricted, evidenceKeys: [], riskFlags: item.riskFlags, notes }) });
      onSaved(decision === 'approved' ? 'Listing approved for B&I publishing.' : 'Listing rejected and returned to the remediation queue.');
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(''); }
  }
  async function inspectUnits() {
    if (!item.listing) return;
    try { const result = await fetchWithAuth<{ units: Unit[] }>('/api/business-industrial/listings/' + item.listing.id + '/review'); setUnits(result.units); } catch (err) { setError(messageOf(err)); }
  }
  async function allocate(unitId: string) {
    if (!selectedStore) { setError('Select a dedicated B&I store before allocating a unit.'); return; }
    try { await fetchWithAuth('/api/business-industrial/units/' + unitId + '/allocate', { method: 'POST', body: JSON.stringify({ storeId: selectedStore }) }); await inspectUnits(); onSaved('Serialized unit allocated to the selected B&I store.'); } catch (err) { setError(messageOf(err)); }
  }
  async function markSold(unitId: string) {
    try { await fetchWithAuth('/api/business-industrial/units/' + unitId + '/sold', { method: 'POST', body: JSON.stringify({}) }); await inspectUnits(); onSaved('Serialized unit marked sold.'); } catch (err) { setError(messageOf(err)); }
  }
  if (!item.listing) return null;
  return <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{item.listing.title}</p><p className="text-sm text-slate-500">{item.listing.sku} · {item.status} · {item.evidenceCount} evidence item(s){item.riskFlags.length ? ' · ' + item.riskFlags.length + ' risk flag(s)' : ''}</p></div><div className="flex flex-wrap gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => void inspectUnits()}>Inspect units</button><button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!!busy} onClick={() => void submit('approved')}>{busy === 'approved' ? 'Approving…' : 'Approve'}</button><button className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50" disabled={!!busy} onClick={() => void submit('rejected')}>{busy === 'rejected' ? 'Rejecting…' : 'Reject'}</button></div></div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><label><input className={input} type="checkbox" checked={checks.provenance} onChange={(event) => setChecks((current) => ({ ...current, provenance: event.target.checked }))} /> <span className="ml-2">Provenance confirmed</span></label><label><input className={input} type="checkbox" checked={checks.specifications} onChange={(event) => setChecks((current) => ({ ...current, specifications: event.target.checked }))} /> <span className="ml-2">Specifications verified</span></label><label><input className={input} type="checkbox" checked={checks.testing} onChange={(event) => setChecks((current) => ({ ...current, testing: event.target.checked }))} /> <span className="ml-2">Testing reviewed</span></label><label><input className={input} type="checkbox" checked={checks.restricted} onChange={(event) => setChecks((current) => ({ ...current, restricted: event.target.checked }))} /> <span className="ml-2">Restricted-category clearance</span></label></div><textarea className="mt-3 w-full rounded-lg border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-700" placeholder="Review notes and evidence references" value={notes} onChange={(event) => setNotes(event.target.value)} />{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{units && <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800"><div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Private unit records</span><select className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}><option value="">Select authorized B&amp;I store</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.storeName}</option>)}</select></div><div className="space-y-2">{units.map((unit) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70" key={unit.id}><span><span className="font-medium">Private: {unit.serialNumberPrivate}</span><span className="ml-3 text-slate-500">Public: {unit.serialNumberPublic || '—'} · {unit.status}</span></span><span>{unit.status === 'available' && <button className="rounded-md bg-cyan-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => void allocate(unit.id)}>Allocate</button>}{unit.status === 'allocated' && <button className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => void markSold(unit.id)}>Mark sold</button>}</span></div>)}</div></div>}</div>;
}

export default function BusinessIndustrialReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [message, setMessage] = useState('');
  const load = () => void fetchWithAuth<ReviewItem[]>('/api/business-industrial/review').then(setItems).catch((err) => setMessage(messageOf(err)));
  useEffect(() => { load(); void fetchWithAuth<Store[]>('/api/business-industrial/stores').then((result) => { setStores(result); setSelectedStore(result[0]?.id ?? ''); }).catch(() => undefined); }, []);
  return <div><h1 className="text-3xl font-semibold">Compliance review</h1><p className="mt-2 text-slate-500">Record provenance, specification, testing, and restricted-category decisions explicitly. Approval is blocked server-side until all required checks pass.</p>{message && <p role="status" className="mt-4 text-sm text-slate-600">{message}</p>}<div className="mt-6 space-y-3">{items.map((item) => <ReviewCard key={item.id} item={item} stores={stores} selectedStore={selectedStore} setSelectedStore={setSelectedStore} onSaved={(text) => { setMessage(text); load(); }} />)}{!items.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No B&amp;I listings are waiting for review.</p>}</div></div>;
}
