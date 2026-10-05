import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';
import { Badge } from '../ui/badge';
import FeedbackPanel from '../ui/FeedbackPanel';
import Field, { FIELD_CONTROL } from '../ui/Field';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { EmptyState, ErrorState, LoadingPlaceholder } from '../ui/StatusBlock';

type ReviewItem = {
  id: string;
  listing: { id: string; sku: string | null; title: string; verticalValidationStatus: string; verticalAttributes: Record<string, unknown> } | null;
  status: string;
  riskFlags: string[];
  evidenceCount: number;
  provenanceConfirmed: boolean;
  specificationsVerified: boolean;
  testingReviewed: boolean;
  restrictedCategoryCleared: boolean;
};
type Store = { id: string; storeName: string; status: string; marketplaceId: string | null };
type Unit = { id: string; serialNumberPrivate: string; serialNumberPublic: string | null; status: string; allocatedStoreId: string | null; allocatedOfferId: string | null };
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete review request.';

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
    setBusy('units'); setError('');
    try { const result = await fetchWithAuth<{ units: Unit[] }>('/api/business-industrial/listings/' + item.listing.id + '/review'); setUnits(result.units); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(''); }
  }
  async function allocate(unitId: string) {
    if (!selectedStore) { setError('Select a dedicated B&I store before allocating a unit.'); return; }
    setBusy('allocate-' + unitId);
    try { await fetchWithAuth('/api/business-industrial/units/' + unitId + '/allocate', { method: 'POST', body: JSON.stringify({ storeId: selectedStore }) }); await inspectUnits(); onSaved('Serialized unit allocated to the selected B&I store.'); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(''); }
  }
  async function markSold(unitId: string) {
    setBusy('sold-' + unitId);
    try { await fetchWithAuth('/api/business-industrial/units/' + unitId + '/sold', { method: 'POST', body: JSON.stringify({}) }); await inspectUnits(); onSaved('Serialized unit marked sold.'); }
    catch (err) { setError(messageOf(err)); }
    finally { setBusy(''); }
  }
  if (!item.listing) return null;
  const family = String(item.listing.verticalAttributes?.categoryFamily || '').replace(/_/g, ' ');
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.listing.title}</p>
          <p className="text-sm text-slate-500">{item.listing.sku} · {family || 'Family pending'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{item.status.replace(/_/g, ' ')}</Badge>
            <Badge variant="outline">{item.evidenceCount} evidence item(s)</Badge>
            {item.riskFlags.length ? <Badge variant="warning">{item.riskFlags.length} risk flag(s)</Badge> : <Badge variant="success">No risk flags</Badge>}
          </div>
          {item.riskFlags.length ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Risk: {item.riskFlags.join(', ')}. Approval remains blocked until these are cleared server-side.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={!!busy} onClick={() => void inspectUnits()}>{busy === 'units' ? 'Loading units…' : 'Inspect units'}</button>
          <button className="min-h-11 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!!busy} onClick={() => void submit('approved')}>{busy === 'approved' ? 'Approving…' : 'Approve'}</button>
          <button className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50" disabled={!!busy} onClick={() => void submit('rejected')}>{busy === 'rejected' ? 'Rejecting…' : 'Reject'}</button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={checks.provenance} onChange={(event) => setChecks((current) => ({ ...current, provenance: event.target.checked }))} /> Provenance confirmed</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={checks.specifications} onChange={(event) => setChecks((current) => ({ ...current, specifications: event.target.checked }))} /> Specifications verified</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={checks.testing} onChange={(event) => setChecks((current) => ({ ...current, testing: event.target.checked }))} /> Testing reviewed</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={checks.restricted} onChange={(event) => setChecks((current) => ({ ...current, restricted: event.target.checked }))} /> Restricted-category clearance</label>
      </div>
      <Field label="Review notes" htmlFor={'notes-' + item.id} hint="Document evidence references. Notes are required for a complete review trail." className="mt-3">
        <textarea id={'notes-' + item.id} className={FIELD_CONTROL + ' min-h-20'} placeholder="Review notes and evidence references" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {error ? <FeedbackPanel tone="error" className="mt-3">{error}</FeedbackPanel> : null}
      {units ? (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Private unit records</span>
            <select aria-label="Authorized B&I store" className="min-h-11 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}>
              <option value="">Select authorized B&amp;I store</option>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.storeName}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {units.map((unit) => (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70" key={unit.id}>
                <span><span className="font-medium">Private: {unit.serialNumberPrivate}</span><span className="ml-3 text-slate-500">Public: {unit.serialNumberPublic || '—'} · {unit.status}</span></span>
                <span>
                  {unit.status === 'available' ? <button className="rounded-md px-2 py-1 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--brand-primary)' }} disabled={!!busy} onClick={() => void allocate(unit.id)}>{busy === 'allocate-' + unit.id ? 'Allocating…' : 'Allocate'}</button> : null}
                  {unit.status === 'allocated' ? <button className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50" disabled={!!busy} onClick={() => void markSold(unit.id)}>{busy === 'sold-' + unit.id ? 'Updating…' : 'Mark sold'}</button> : null}
                </span>
              </div>
            ))}
            {!units.length ? <p className="text-sm text-slate-500">No serialized unit records for this listing.</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function BusinessIndustrialReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = () => {
    const current = ++requestId.current;
    setLoading(items.length === 0);
    setError('');
    void fetchWithAuth<ReviewItem[]>('/api/business-industrial/review')
      .then((result) => { if (requestId.current === current) { setItems(result); setError(''); } })
      .catch((err) => { if (requestId.current === current) setError(messageOf(err)); })
      .finally(() => { if (requestId.current === current) setLoading(false); });
  };

  useEffect(() => {
    load();
    void fetchWithAuth<Store[]>('/api/business-industrial/stores').then((result) => { setStores(result); setSelectedStore(result[0]?.id ?? ''); }).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-5">
      <WorkspacePageHeader title="Compliance review" subtitle="Record provenance, specification, testing, and restricted-category decisions explicitly. Approval is blocked server-side until all required checks pass." />
      {message ? <FeedbackPanel tone="success" onDismiss={() => setMessage('')}>{message}</FeedbackPanel> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingPlaceholder label="Loading compliance review queue" /> : null}
      {!loading && !error && !items.length ? <EmptyState title="No B&I listings are waiting for review" description="Approved, rejected, and quarantined records stay out of this queue until they require another decision." /> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <ReviewCard key={item.id} item={item} stores={stores} selectedStore={selectedStore} setSelectedStore={setSelectedStore} onSaved={(text) => { setMessage(text); load(); }} />
        ))}
      </div>
    </div>
  );
}
