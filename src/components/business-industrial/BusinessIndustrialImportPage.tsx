import { ChangeEvent, useEffect, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

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

export default function BusinessIndustrialImportPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [selected, setSelected] = useState<ImportRecord | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await fetchWithAuth<{ imports: ImportRecord[] }>('/api/catalog-import?vertical=business_industrial&limit=20');
      setImports(result.imports);
      if (selected) setSelected(result.imports.find((item) => item.id === selected.id) ?? null);
    } catch (err) { setMessage(messageOf(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10000); return () => window.clearInterval(timer); }, [selected?.id]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { setMessage('The selected file is larger than the 200 MB limit.'); return; }
    setMessage('Uploading…');
    const body = new FormData(); body.append('file', file); body.append('vertical', 'business_industrial');
    try {
      const result = await fetchWithAuth<{ import?: ImportRecord }>('/api/catalog-import/upload', { method: 'POST', body });
      if (result.import?.id) await fetchWithAuth('/api/catalog-import/start', { method: 'POST', body: JSON.stringify({ importId: result.import.id }) });
      setMessage('B&I import queued. Invalid specifications remain visible in the row report and compliance review queue.');
      await load();
    } catch (err) { setMessage(messageOf(err)); }
  }
  async function inspect(item: ImportRecord) {
    setMessage('');
    try {
      const [detail, rowResult] = await Promise.all([
        fetchWithAuth<{ import: ImportRecord }>('/api/catalog-import/' + item.id),
        fetchWithAuth<{ rows: ImportRow[] }>('/api/catalog-import/' + item.id + '/rows?limit=500'),
      ]);
      setSelected(detail.import); setRows(rowResult.rows);
      const previewResult = await fetchWithAuth<{ rows: Record<string, string>[] }>('/api/catalog-import/' + item.id + '/preview');
      setPreview(previewResult.rows);
    } catch (err) { setMessage(messageOf(err)); }
  }
  async function mutate(item: ImportRecord, action: 'retry' | 'cancel') {
    try {
      await fetchWithAuth('/api/catalog-import/' + item.id + '/' + action, { method: 'POST' });
      setMessage(action === 'retry' ? 'Import retry queued; processing resumes from the last checkpoint.' : 'Import cancellation requested.');
      await load();
    } catch (err) { setMessage(messageOf(err)); }
  }
  async function downloadErrors(item: ImportRecord) {
    try {
      const result = await fetchWithAuth<{ rows: ImportRow[] }>('/api/catalog-import/' + item.id + '/rows?limit=500');
      const errors = result.rows.filter((row) => row.status === 'invalid' || row.status === 'duplicate_flagged');
      const header = ['rowNumber', 'status', 'message', 'rawData'];
      const csv = [header, ...errors.map((row) => [String(row.rowNumber), row.status, row.message ?? '', JSON.stringify(row.rawData ?? {})])].map((line) => line.map((value) => '"' + value.replace(/"/g, '""') + '"').join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'omni-core-bi-import-errors-' + item.id + '.csv'; anchor.click(); URL.revokeObjectURL(url);
      setMessage(errors.length + ' error row(s) exported.');
    } catch (err) { setMessage(messageOf(err)); }
  }
  const progress = selected && selected.totalRows ? Math.min(100, Math.round((selected.processedRows / selected.totalRows) * 100)) : 0;

  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-cyan-600">Business &amp; Industrial intake</p><h1 className="text-3xl font-semibold">Bulk import</h1><p className="mt-2 text-slate-500">Upload CSV or Excel data with explicit category families, units, condition/testing, inventory, and shipping fields. Imports are scoped to this B&amp;I workspace.</p></div><label className="cursor-pointer rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">Choose file<input className="hidden" type="file" accept=".csv,.xls,.xlsx" onChange={upload} /></label></div>
    {message && <p role="status" className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{message}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]"><section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent B&amp;I imports</h2><button className="text-sm text-cyan-700" onClick={() => void load()}>Refresh</button></div>{loading && <p className="text-sm text-slate-500">Loading imports…</p>}{!loading && <div className="space-y-3">{imports.map((item) => <button key={item.id} className={'block w-full rounded-xl bg-white p-4 text-left shadow-sm dark:bg-slate-900 ' + (selected?.id === item.id ? 'ring-2 ring-cyan-500' : '')} onClick={() => void inspect(item)}><div className="flex items-center justify-between gap-3"><span className="font-medium">{item.originalFileName || 'B&I import ' + item.id.slice(0, 8)}</span><span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs font-semibold capitalize text-cyan-700">{statusLabel(item.status)}</span></div><p className="mt-2 text-xs text-slate-500">{item.processedRows || 0} / {item.totalRows || 0} rows · {item.insertedRows || 0} inserted · {item.invalidRows || 0} invalid · {item.flaggedForReview || 0} flagged</p></button>)}{!imports.length && <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900">No B&amp;I imports yet.</p>}</div>}</section>
      <section className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900"><h2 className="font-semibold">Import details</h2>{!selected ? <p className="mt-3 text-sm text-slate-500">Select an import to inspect progress, preview source rows, or export failures.</p> : <div className="mt-4 space-y-4"><div><div className="flex justify-between text-sm"><span className="capitalize">{statusLabel(selected.status)}</span><span>{progress}%</span></div><div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-2 rounded-full bg-cyan-600" style={{ width: progress + '%' }} /></div></div><div className="grid grid-cols-2 gap-3 text-sm"><span>Inserted: {selected.insertedRows}</span><span>Updated: {selected.updatedRows}</span><span>Invalid: {selected.invalidRows}</span><span>Flagged: {selected.flaggedForReview}</span><span>Duplicates: {selected.skippedDuplicates}</span><span>Rows: {selected.processedRows} / {selected.totalRows}</span></div>{selected.errorMessage && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-700">{selected.errorMessage}</p>}<div className="flex flex-wrap gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => void downloadErrors(selected)}>Download error report</button>{selected.status === 'failed' && <button className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => void mutate(selected, 'retry')}>Retry from checkpoint</button>}{['pending', 'validating', 'processing', 'paused'].includes(selected.status) && <button className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700" onClick={() => void mutate(selected, 'cancel')}>Cancel import</button>}</div><details><summary className="cursor-pointer text-sm font-medium">Source preview</summary><div className="mt-2 max-h-48 overflow-auto text-xs">{preview.slice(0, 5).map((row, index) => <pre className="mb-2 rounded bg-slate-50 p-2 dark:bg-slate-800" key={index}>{JSON.stringify(row, null, 2)}</pre>)}</div></details><details><summary className="cursor-pointer text-sm font-medium">Row report ({rows.length})</summary><div className="mt-2 max-h-64 overflow-auto space-y-2 text-xs">{rows.filter((row) => row.status === 'invalid' || row.status === 'duplicate_flagged').map((row) => <div className="rounded bg-red-500/10 p-2" key={row.rowNumber}>Row {row.rowNumber} · {row.status} · {row.message}</div>)}{!rows.some((row) => row.status === 'invalid' || row.status === 'duplicate_flagged') && <p className="text-slate-500">No invalid or protected rows in the loaded report.</p>}</div></details></div>}</section></div>
  </div>;
}
