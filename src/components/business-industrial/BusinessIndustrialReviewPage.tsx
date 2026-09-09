import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

type ReviewItem = {
  listing: { id: string; sku: string | null; title: string; verticalValidationStatus: string } | null;
  status: string;
  riskFlags: string[];
  evidenceCount: number;
};

type Store = { id: string; storeName: string; status: string; marketplaceId: string | null };
type Unit = { id: string; serialNumberPrivate: string; serialNumberPublic: string | null; status: string; allocatedStoreId: string | null; allocatedOfferId: string | null };

export default function BusinessIndustrialReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [unitsByListing, setUnitsByListing] = useState<Record<string, Unit[]>>({});
  const [selectedStore, setSelectedStore] = useState('');
  const [message, setMessage] = useState('');

  const load = () => void fetchWithAuth<ReviewItem[]>('/api/business-industrial/review').then(setItems).catch((err) => setMessage(err instanceof Error ? err.message : 'Unable to load review queue'));

  useEffect(() => {
    load();
    void fetchWithAuth<Store[]>('/api/business-industrial/stores').then((result) => {
      setStores(result);
      setSelectedStore(result[0]?.id ?? '');
    }).catch(() => undefined);
  }, []);

  async function approve(id: string) {
    setMessage('');
    try {
      await fetchWithAuth(`/api/business-industrial/listings/${id}/review`, { method: 'POST', body: JSON.stringify({ decision: 'approved', provenanceConfirmed: true, specificationsVerified: true, testingReviewed: true, restrictedCategoryCleared: true, evidenceKeys: [], riskFlags: [], notes: 'Reviewed in Business & Industrial workspace' }) });
      setMessage('Listing approved for publishing.');
      load();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Review failed'); }
  }

  async function inspectUnits(id: string) {
    setMessage('');
    try {
      const result = await fetchWithAuth<{ units: Unit[] }>(`/api/business-industrial/listings/${id}/review`);
      setUnitsByListing((current) => ({ ...current, [id]: result.units }));
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Unable to load private unit records'); }
  }

  async function allocate(unitId: string, listingId: string) {
    if (!selectedStore) { setMessage('Connect or select a dedicated B&I store before allocating a unit.'); return; }
    setMessage('');
    try {
      await fetchWithAuth(`/api/business-industrial/units/${unitId}/allocate`, { method: 'POST', body: JSON.stringify({ storeId: selectedStore }) });
      setMessage('Serialized unit allocated to the selected B&I store.');
      await inspectUnits(listingId);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Unit allocation failed'); }
  }

  async function markSold(unitId: string, listingId: string) {
    setMessage('');
    try {
      await fetchWithAuth(`/api/business-industrial/units/${unitId}/sold`, { method: 'POST', body: JSON.stringify({}) });
      setMessage('Serialized unit marked sold.');
      await inspectUnits(listingId);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Unit sale update failed'); }
  }

  return <div>
    <h1 className="text-3xl font-semibold">Compliance review</h1>
    <p className="mt-2 text-slate-500">Review provenance, specifications, testing evidence, restricted-category clearance, and risk flags before approval.</p>
    {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
    <div className="mt-6 space-y-3">
      {items.map((item) => item.listing && <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900" key={item.listing.id}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-medium">{item.listing.title}</p><p className="text-sm text-slate-500">{item.listing.sku} · {item.status} · {item.evidenceCount} evidence item(s){item.riskFlags.length ? ` · ${item.riskFlags.length} risk flag(s)` : ''}</p></div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700" onClick={() => inspectUnits(item.listing!.id)}>Inspect serialized units</button>
            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => approve(item.listing!.id)}>Approve compliance</button>
          </div>
        </div>
        {unitsByListing[item.listing.id] && <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Internal unit records</span><select className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" value={selectedStore} onChange={(event) => setSelectedStore(event.target.value)}><option value="">Select authorized B&amp;I store</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.storeName}</option>)}</select></div>
          <div className="space-y-2">{unitsByListing[item.listing.id].map((unit) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/70" key={unit.id}><span><span className="font-medium">Private: {unit.serialNumberPrivate}</span><span className="ml-3 text-slate-500">Public: {unit.serialNumberPublic || '—'} · {unit.status}</span></span><span className="flex gap-2">{unit.status === 'available' && <button className="rounded-md bg-cyan-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => allocate(unit.id, item.listing!.id)}>Allocate</button>}{unit.status === 'allocated' && <button className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => markSold(unit.id, item.listing!.id)}>Mark sold</button>}</span></div>)}</div>
        </div>}
      </div>)}
      {!items.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No B&amp;I listings are waiting for review.</p>}
    </div>
  </div>;
}
