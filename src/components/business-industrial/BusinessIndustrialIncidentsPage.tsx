import { useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';
import { Badge } from '../ui/badge';
import ConfirmDialog from '../ui/ConfirmDialog';
import FeedbackPanel from '../ui/FeedbackPanel';
import Field, { FIELD_CONTROL } from '../ui/Field';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { EmptyState, ErrorState, LoadingPlaceholder } from '../ui/StatusBlock';

type Target = { channelId?: string; status?: string; remoteRemovalVerified?: boolean; attemptedAt?: string; message?: string };
type Incident = { id: string; catalogProductId: string; incidentType: string; status: string; remoteActionRequired: boolean; notes: string | null; takedownAttempts: Target[]; firstTakedownAttemptAt: string | null; takedownCompletedAt: string | null };
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete incident request.';

function severityOf(incident: Incident) {
  if (incident.status === 'open' || incident.remoteActionRequired) return { label: 'Action required', variant: 'destructive' as const };
  if (incident.status === 'takedown_complete') return { label: 'Ready for release review', variant: 'warning' as const };
  return { label: incident.status.replace(/_/g, ' '), variant: 'secondary' as const };
}

export default function BusinessIndustrialIncidentsPage() {
  const [items, setItems] = useState<Incident[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [releaseTarget, setReleaseTarget] = useState<Incident | null>(null);
  const [releaseNotes, setReleaseNotes] = useState('');
  const requestId = useRef(0);

  const load = () => {
    const current = ++requestId.current;
    setLoading(items.length === 0);
    void fetchWithAuth<Incident[]>('/api/business-industrial/incidents')
      .then((result) => { if (requestId.current === current) { setItems(result); setError(''); } })
      .catch((err) => { if (requestId.current === current) setError(messageOf(err)); })
      .finally(() => { if (requestId.current === current) setLoading(false); });
  };

  useEffect(load, []);

  async function retry(id: string) {
    setBusyId(id);
    try {
      await fetchWithAuth('/api/business-industrial/incidents/' + id + '/takedown', { method: 'POST' });
      setMessage('Authorized eBay takedown retry completed; refresh the incident for verification.');
      load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId('');
    }
  }

  async function confirmRelease() {
    if (!releaseTarget || !releaseNotes.trim()) return;
    setBusyId(releaseTarget.id);
    try {
      await fetchWithAuth('/api/business-industrial/incidents/' + releaseTarget.id + '/release', { method: 'POST', body: JSON.stringify({ notes: releaseNotes.trim() }) });
      setMessage('Incident released to the compliance review queue.');
      setReleaseTarget(null);
      setReleaseNotes('');
      load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-5">
      <WorkspacePageHeader title="Enforcement incidents" subtitle="Verified signals quarantine local listings immediately, attempt authorized eBay withdrawal, record each target result, and keep relisting blocked until remote removal is verified." />
      {message ? <FeedbackPanel tone="success" onDismiss={() => setMessage('')}>{message}</FeedbackPanel> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingPlaceholder label="Loading enforcement incidents" /> : null}
      {!loading && !error && !items.length ? <EmptyState title="No enforcement incidents recorded" /> : null}
      <div className="space-y-3">
        {items.map((incident) => {
          const severity = severityOf(incident);
          return (
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" key={incident.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium capitalize">{incident.incidentType.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-slate-500">Product {incident.catalogProductId} · {incident.takedownAttempts?.length ?? 0} target attempt(s)</p>
                  <div className="mt-2"><Badge variant={severity.variant}>{severity.label}</Badge></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {incident.remoteActionRequired ? (
                    <button className="min-h-11 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={busyId === incident.id} onClick={() => void retry(incident.id)}>
                      {busyId === incident.id ? 'Retrying…' : 'Retry eBay takedown'}
                    </button>
                  ) : null}
                  {incident.status === 'takedown_complete' ? (
                    <button className="min-h-11 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700" onClick={() => { setReleaseTarget(incident); setReleaseNotes(''); }}>
                      Release after documented review
                    </button>
                  ) : null}
                </div>
              </div>
              {incident.firstTakedownAttemptAt ? <p className="mt-3 text-xs text-slate-500">First takedown attempt: {new Date(incident.firstTakedownAttemptAt).toLocaleString()}{incident.takedownCompletedAt ? ' · verified: ' + new Date(incident.takedownCompletedAt).toLocaleString() : ''}</p> : null}
              {incident.takedownAttempts?.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {incident.takedownAttempts.map((attempt, index) => (
                    <div className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800" key={(attempt.channelId || '') + '-' + index}>
                      {attempt.channelId || 'target'} · {attempt.status} · {attempt.remoteRemovalVerified ? 'verified' : 'not verified'}{attempt.message ? ' · ' + attempt.message : ''}
                    </div>
                  ))}
                </div>
              ) : null}
              {incident.notes ? <p className="mt-3 text-sm text-slate-600">{incident.notes}</p> : null}
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(releaseTarget)}
        title="Release incident after documented review"
        description="Document the authorization and evidence. Release returns the listing to the compliance review queue; it does not publish it."
        confirmLabel="Release incident"
        busy={Boolean(releaseTarget && busyId === releaseTarget.id)}
        onClose={() => setReleaseTarget(null)}
        onConfirm={() => void confirmRelease()}
      >
        <Field label="Authorization notes" htmlFor="release-notes" required>
          <textarea id="release-notes" required maxLength={2000} className={FIELD_CONTROL + ' min-h-24'} value={releaseNotes} onChange={(event) => setReleaseNotes(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
