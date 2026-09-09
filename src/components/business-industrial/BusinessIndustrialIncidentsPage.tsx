import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

type Incident = { id: string; catalogProductId: string; incidentType: string; status: string; remoteActionRequired: boolean; notes: string | null };
export default function BusinessIndustrialIncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [message, setMessage] = useState('');
  const load = () => void fetchWithAuth<Incident[]>('/api/business-industrial/incidents').then(setItems).catch((err) => setMessage(err instanceof Error ? err.message : 'Unable to load incidents'));
  useEffect(load, []);
  return <div><h1 className="text-3xl font-semibold">Enforcement incidents</h1><p className="mt-2 text-slate-500">Verified signals quarantine local listings immediately. Any published eBay action is recorded for authorized manual completion.</p>{message && <p className="mt-4 text-sm text-red-600">{message}</p>}<div className="mt-6 space-y-3">{items.map((incident) => <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900" key={incident.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{incident.incidentType}</p><p className="text-sm text-slate-500">Product {incident.catalogProductId} · {incident.status}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${incident.remoteActionRequired ? 'bg-red-500/10 text-red-700' : 'bg-emerald-500/10 text-emerald-700'}`}>{incident.remoteActionRequired ? 'Manual eBay action required' : 'Local containment complete'}</span></div>{incident.notes && <p className="mt-3 text-sm text-slate-600">{incident.notes}</p>}</div>)}{!items.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No enforcement incidents recorded.</p>}</div></div>;
}
