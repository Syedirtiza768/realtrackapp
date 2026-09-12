import { useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

type Target = { channelId?: string; status?: string; remoteRemovalVerified?: boolean; attemptedAt?: string; message?: string };
type Incident = { id: string; catalogProductId: string; incidentType: string; status: string; remoteActionRequired: boolean; notes: string | null; takedownAttempts: Target[]; firstTakedownAttemptAt: string | null; takedownCompletedAt: string | null };
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete incident request.';

export default function BusinessIndustrialIncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [message, setMessage] = useState('');
  const load = () => void fetchWithAuth<Incident[]>('/api/business-industrial/incidents').then(setItems).catch((err) => setMessage(messageOf(err)));
  useEffect(load, []);
  async function retry(id: string) {
    try { await fetchWithAuth('/api/business-industrial/incidents/' + id + '/takedown', { method: 'POST' }); setMessage('Authorized eBay takedown retry completed; refresh the incident for verification.'); load(); } catch (err) { setMessage(messageOf(err)); }
  }
  async function release(item: Incident) {
    const notes = window.prompt('Document the authorization and evidence for releasing this incident:');
    if (!notes?.trim()) return;
    try { await fetchWithAuth('/api/business-industrial/incidents/' + item.id + '/release', { method: 'POST', body: JSON.stringify({ notes }) }); setMessage('Incident released to the compliance review queue.'); load(); } catch (err) { setMessage(messageOf(err)); }
  }
  return <div><h1 className="text-3xl font-semibold">Enforcement incidents</h1><p className="mt-2 text-slate-500">Verified signals quarantine local listings immediately, attempt authorized eBay withdrawal, record each target result, and keep relisting blocked until remote removal is verified.</p>{message && <p role="status" className="mt-4 text-sm text-slate-600">{message}</p>}<div className="mt-6 space-y-3">{items.map((incident) => <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900" key={incident.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium capitalize">{incident.incidentType.replace(/_/g, ' ')}</p><p className="text-sm text-slate-500">Product {incident.catalogProductId} · {incident.status} · {incident.takedownAttempts?.length ?? 0} target attempt(s)</p></div><div className="flex flex-wrap gap-2">{incident.remoteActionRequired && <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void retry(incident.id)}>Retry eBay takedown</button>}{incident.status === 'takedown_complete' && <button className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700" onClick={() => void release(incident)}>Release after documented review</button>}</div></div>{incident.firstTakedownAttemptAt && <p className="mt-3 text-xs text-slate-500">First takedown attempt: {new Date(incident.firstTakedownAttemptAt).toLocaleString()}{incident.takedownCompletedAt ? ' · verified: ' + new Date(incident.takedownCompletedAt).toLocaleString() : ''}</p>}{incident.takedownAttempts?.length > 0 && <div className="mt-3 space-y-2">{incident.takedownAttempts.map((attempt, index) => <div className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800" key={(attempt.channelId || '') + '-' + index}>{attempt.channelId || 'target'} · {attempt.status} · {attempt.remoteRemovalVerified ? 'verified' : 'not verified'}{attempt.message ? ' · ' + attempt.message : ''}</div>)}</div>}{incident.notes && <p className="mt-3 text-sm text-slate-600">{incident.notes}</p>}</div>)}{!items.length && <p className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No enforcement incidents recorded.</p>}</div></div>;
}
