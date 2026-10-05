import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';
import { Badge } from '../ui/badge';
import FeedbackPanel, { type FeedbackTone } from '../ui/FeedbackPanel';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { EmptyState, ErrorState, LoadingPlaceholder } from '../ui/StatusBlock';

type ImportRecord = {
  id: string;
  originalFileName?: string;
  status: string;
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  invalidRows: number;
  flaggedForReview: number;
  skippedDuplicates: number;
  warnings?: string[] | null;
  errorMessage?: string | null;
  createdAt: string;
};
type ImportRow = { rowNumber: number; status: string; message?: string | null; rawData?: Record<string, string> };

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete import request.';
const statusLabel = (status: string) => status.replace(/_/g, ' ');
const statusVariant = (status: string) => status === 'completed' ? 'success' : status === 'failed' ? 'destructive' : status.includes('process') || status === 'pending' ? 'warning' : 'secondary';

export default function BusinessIndustrialImportPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [selected, setSelected] = useState<ImportRecord | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<FeedbackTone>('info');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState('');
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;

  async function load(initial = false) {
    if (initial) setLoading(true);
    try {
      const result = await fetchWithAuth<{ imports: ImportRecord[] }>('/api/catalog-import?vertical=business_industrial&limit=20');
      setImports(result.imports);
      setError('');
      const currentId = selectedIdRef.current;
      if (currentId) setSelected(result.imports.find((item) => item.id === currentId) ?? null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(false), 10000);
    return () => window.clearInterval(timer);
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { setMessage('The selected file is larger than the 200 MB limit.'); setMessageTone('error'); return; }
    setPending('upload');
    setMessage('Uploading…');
    setMessageTone('info');
    const body = new FormData(); body.append('file', file); body.append('vertical', 'business_industrial');
    try {
      const result = await fetchWithAuth<{ import?: ImportRecord }>('/api/catalog-import/upload', { method: 'POST', body });
      if (result.import?.id) await fetchWithAuth('/api/catalog-import/start', { method: 'POST', body: JSON.stringify({ importId: result.import.id }) });
      setMessage('B&I import queued. Invalid specifications remain visible in the row report and compliance review queue.');
      setMessageTone('success');
      await load(false);
    } catch (err) {
      setMessage(messageOf(err));
      setMessageTone('error');
    } finally {
      setPending('');
    }
  }

  async function inspect(item: ImportRecord) {
    setPending('inspect-' + item.id);
    try {
      const [detail, rowResult] = await Promise.all([
        fetchWithAuth<{ import: ImportRecord }>('/api/catalog-import/' + item.id),
        fetchWithAuth<{ rows: ImportRow[] }>('/api/catalog-import/' + item.id + '/rows?limit=500'),
      ]);
      setSelected(detail.import); setRows(rowResult.rows);
      const previewResult = await fetchWithAuth<{ rows: Record<string, string>[] }>('/api/catalog-import/' + item.id + '/preview');
      setPreview(previewResult.rows);
      setError('');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending('');
    }
  }

  async function mutate(item: ImportRecord, action: 'retry' | 'cancel') {
    setPending(action);
    try {
      await fetchWithAuth('/api/catalog-import/' + item.id + '/' + action, { method: 'POST' });
      setMessage(action === 'retry' ? 'Import retry queued; processing resumes from the last checkpoint.' : 'Import cancellation requested.');
      setMessageTone(action === 'retry' ? 'success' : 'warning');
      await load(false);
    } catch (err) {
      setMessage(messageOf(err));
      setMessageTone('error');
    } finally {
      setPending('');
    }
  }

  async function downloadErrors(item: ImportRecord) {
    setPending('export');
    try {
      const result = await fetchWithAuth<{ rows: ImportRow[] }>('/api/catalog-import/' + item.id + '/rows?limit=500');
      const errors = result.rows.filter((row) => row.status === 'invalid' || row.status === 'duplicate_flagged');
      const header = ['rowNumber', 'status', 'message', 'rawData'];
      const csv = [header, ...errors.map((row) => [String(row.rowNumber), row.status, row.message ?? '', JSON.stringify(row.rawData ?? {})])].map((line) => line.map((value) => '"' + value.replace(/"/g, '""') + '"').join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'omni-core-bi-import-errors-' + item.id + '.csv'; anchor.click(); URL.revokeObjectURL(url);
      setMessage(errors.length + ' error row(s) exported.');
      setMessageTone('success');
    } catch (err) {
      setMessage(messageOf(err));
      setMessageTone('error');
    } finally {
      setPending('');
    }
  }

  const progress = selected && selected.totalRows ? Math.min(100, Math.round((selected.processedRows / selected.totalRows) * 100)) : 0;
  const failedRows = rows.filter((row) => row.status === 'invalid' || row.status === 'duplicate_flagged');

  return (
    <div className="space-y-5">
      <WorkspacePageHeader
        eyebrow="Business & Industrial intake"
        title="Bulk import"
        subtitle="Upload CSV or Excel data with explicit category families, units, condition/testing, inventory, and shipping fields. Imports are scoped to this B&I workspace. Supported formats: CSV, XLS, XLSX. Maximum file size: 200 MB."
      >
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-semibold text-white">
          <span style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }} className="rounded-lg px-4 py-2">{pending === 'upload' ? 'Uploading…' : 'Choose file'}</span>
          <input className="hidden" type="file" accept=".csv,.xls,.xlsx" disabled={pending === 'upload'} onChange={upload} />
        </label>
      </WorkspacePageHeader>
      {message ? <FeedbackPanel tone={messageTone} onDismiss={() => setMessage('')}>{message}</FeedbackPanel> : null}
      {error ? <ErrorState message={error} onRetry={() => void load(true)} /> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent B&amp;I imports</h2>
            <button className="min-h-11 text-sm font-medium" style={{ color: 'var(--brand-primary)' }} onClick={() => void load(false)}>Refresh</button>
          </div>
          {loading ? <LoadingPlaceholder label="Loading imports" /> : null}
          {!loading ? (
            <div className="space-y-3">
              {imports.map((item) => (
                <button key={item.id} className={'block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-700 dark:bg-slate-900 ' + (selected?.id === item.id ? 'ring-2 ring-offset-1' : '')} style={selected?.id === item.id ? { ['--tw-ring-color' as string]: 'var(--brand-primary)' } : undefined} onClick={() => void inspect(item)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.originalFileName || 'B&I import ' + item.id.slice(0, 8)}</span>
                    <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{item.processedRows || 0} / {item.totalRows || 0} rows · {item.insertedRows || 0} inserted · {item.invalidRows || 0} invalid · {item.flaggedForReview || 0} flagged</p>
                </button>
              ))}
              {!imports.length ? <EmptyState title="No B&I imports yet" description="Choose a CSV or Excel file to start an organization-scoped import." /> : null}
            </div>
          ) : null}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold">Import details</h2>
          {!selected ? <p className="mt-3 text-sm text-slate-500">Select an import to inspect progress, preview source rows, or export failures.</p> : (
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-sm"><span className="capitalize">{statusLabel(selected.status)}</span><span>{progress}%</span></div>
                <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-2 rounded-full" style={{ width: progress + '%', backgroundColor: 'var(--brand-primary)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <span>Inserted: {selected.insertedRows}</span>
                <span>Updated: {selected.updatedRows}</span>
                <span>Invalid: {selected.invalidRows}</span>
                <span>Flagged: {selected.flaggedForReview}</span>
                <span>Duplicates: {selected.skippedDuplicates}</span>
                <span>Rows: {selected.processedRows} / {selected.totalRows}</span>
              </div>
              {selected.errorMessage ? <FeedbackPanel tone="error">{selected.errorMessage}</FeedbackPanel> : null}
              <div className="flex flex-wrap gap-2">
                <button className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={!!pending} onClick={() => void downloadErrors(selected)}>{pending === 'export' ? 'Exporting…' : 'Download error report'}</button>
                {selected.status === 'failed' ? <button className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--brand-primary)' }} disabled={!!pending} onClick={() => void mutate(selected, 'retry')}>{pending === 'retry' ? 'Retrying…' : 'Retry from checkpoint'}</button> : null}
                {['pending', 'validating', 'processing', 'paused'].includes(selected.status) ? <button className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50" disabled={!!pending} onClick={() => void mutate(selected, 'cancel')}>{pending === 'cancel' ? 'Cancelling…' : 'Cancel import'}</button> : null}
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-medium">Source preview</summary>
                <div className="mt-2 max-h-48 overflow-auto text-xs">{preview.slice(0, 5).map((row, index) => <pre className="mb-2 rounded bg-slate-50 p-2 dark:bg-slate-800" key={index}>{JSON.stringify(row, null, 2)}</pre>)}</div>
              </details>
              <details>
                <summary className="cursor-pointer text-sm font-medium">Row report ({failedRows.length} failure{failedRows.length === 1 ? '' : 's'})</summary>
                <div className="mt-2 max-h-64 space-y-2 overflow-auto text-xs">
                  {failedRows.map((row) => <div className="rounded bg-red-500/10 p-2" key={row.rowNumber}>Row {row.rowNumber} · {row.status} · {row.message}</div>)}
                  {!failedRows.length ? <p className="text-slate-500">No invalid or protected rows in the loaded report.</p> : null}
                </div>
              </details>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
