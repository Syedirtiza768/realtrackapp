import { useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchWithAuth } from '../../lib/authApi';
import type { CatalogField, CatalogImport, ImportListResponse, ImportRowListResponse, UploadResponse } from '../../types/catalogImport';

const base = '/api/catalog-import';
const active = (status?: string) => status === 'validating' || status === 'processing';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Please try again.';
const panel = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900';
const button = 'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600';
const fieldStyle = 'rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800';

export default function FashionImportPage() {
  const [params, setParams] = useSearchParams();
  const importId = params.get('import') ?? '';
  const client = useQueryClient();
  const [mapping, setMapping] = useState<{ id: string; values: Record<string, string> } | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [rowPage, setRowPage] = useState(0);
  const [rowStatus, setRowStatus] = useState('');
  const [localError, setLocalError] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const history = useQuery({
    queryKey: ['fashion-imports', historyPage],
    queryFn: () => fetchWithAuth<ImportListResponse>(`${base}?vertical=fashion&limit=20&offset=${historyPage * 20}`),
    refetchInterval: 5000,
  });
  const detail = useQuery({
    queryKey: ['fashion-import', importId],
    queryFn: () => fetchWithAuth<{ import: CatalogImport }>(`${base}/${encodeURIComponent(importId)}`),
    enabled: !!importId,
    refetchInterval: query => active(query.state.data?.import.status) ? 3000 : false,
  });
  const record = detail.data?.import;
  const editable = record?.status === 'pending' || record?.status === 'paused';
  const preview = useQuery({
    queryKey: ['fashion-import-preview', importId],
    queryFn: () => fetchWithAuth<{ rows: Record<string, string>[]; fields: CatalogField[] }>(`${base}/${encodeURIComponent(importId)}/preview`),
    enabled: !!importId && editable,
    retry: false,
  });
  const rows = useQuery({
    queryKey: ['fashion-import-rows', importId, rowStatus, rowPage],
    queryFn: () => fetchWithAuth<ImportRowListResponse>(`${base}/${encodeURIComponent(importId)}/rows?limit=50&offset=${rowPage * 50}${rowStatus ? `&status=${rowStatus}` : ''}`),
    enabled: !!record && !editable,
    refetchInterval: active(record?.status) ? 5000 : false,
  });
  const selectedMapping = mapping?.id === importId ? mapping.values : record?.columnMapping ?? {};
  const mappedValues = Object.values(selectedMapping).filter(Boolean);
  const mappingValid = mappedValues.includes('title') && new Set(mappedValues).size === mappedValues.length;
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['fashion-imports'] });
    void client.invalidateQueries({ queryKey: ['fashion-import', importId] });
    void client.invalidateQueries({ queryKey: ['fashion-import-rows', importId] });
  };
  function selectImport(id: string) {
    setMapping(null); setRowPage(0); setRowStatus(''); setLocalError('');
    setParams(id ? { import: id } : {});
  }
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error('Choose a CSV or Excel (.xlsx, .xls) file.');
      if (file.size > 200 * 1024 * 1024) throw new Error('The file exceeds the 200 MB limit.');
      if (!file.size) throw new Error('The selected file is empty.');
      const body = new FormData();
      body.append('file', file); body.append('vertical', 'fashion');
      return fetchWithAuth<UploadResponse>(`${base}/upload`, { method: 'POST', body });
    },
    onSuccess: result => {
      selectImport(result.import.id);
      client.setQueryData(['fashion-import', result.import.id], { import: result.import });
      void client.invalidateQueries({ queryKey: ['fashion-imports'] });
    },
  });
  const action = useMutation({
    mutationFn: (kind: 'start' | 'retry' | 'cancel') => fetchWithAuth<{ import: CatalogImport }>(
      kind === 'start' ? `${base}/start` : `${base}/${encodeURIComponent(importId)}/${kind}`,
      { method: 'POST', ...(kind === 'start' ? { body: JSON.stringify({ importId, columnMapping: selectedMapping }) } : {}) },
    ),
    onSuccess: result => {
      client.setQueryData(['fashion-import', result.import.id], result);
      setMapping(null); refresh();
    },
  });
  const busy = upload.isPending || action.isPending || reportBusy;
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    setLocalError(''); action.reset();
    if (file) upload.mutate(file);
  }
  async function downloadReport() {
    setReportBusy(true); setLocalError('');
    try {
      const reportRows: ImportRowListResponse['rows'] = [];
      for (const status of ['invalid', 'error', 'duplicate_flagged']) {
        let offset = 0;
        while (true) {
          const result = await fetchWithAuth<ImportRowListResponse>(`${base}/${encodeURIComponent(importId)}/rows?status=${status}&limit=200&offset=${offset}`);
          reportRows.push(...result.rows); offset += result.rows.length;
          if (!result.rows.length || offset >= result.total) break;
        }
      }
      if (!reportRows.length) { setLocalError('This import has no invalid, failed, or flagged rows to download.'); return; }
      const rawHeaders = [...new Set(reportRows.flatMap(row => Object.keys(row.rawData ?? {})))];
      const cell = (value: unknown) => {
        let text = String(value ?? '');
        if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      };
      const csv = [['Row', 'Status', 'Message', ...rawHeaders].map(cell).join(','),
        ...reportRows.sort((a, b) => a.rowNumber - b.rowNumber).map(row => [row.rowNumber, row.status, row.message, ...rawHeaders.map(header => row.rawData?.[header])].map(cell).join(',')),
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `fashion-import-${importId}-errors.csv`;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setLocalError(errorText(error)); }
    finally { setReportBusy(false); }
  }
  const error = localError || (upload.error && errorText(upload.error)) || (action.error && errorText(action.error)) ||
    (detail.error && errorText(detail.error)) || (history.error && errorText(history.error));
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-semibold">Bulk Fashion import</h1><p className="mt-2 text-slate-500">Upload, preview and map your catalog, then track processing. Imported items require authenticity review before publishing.</p></div>
    {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{error} <button className={button} onClick={refresh}>Refresh</button></div>}
    <section className={panel} aria-label="Upload Fashion catalog">
      <label htmlFor="fashion-import-file" className="block font-semibold">Choose CSV or Excel file</label>
      <p id="fashion-file-help" className="my-2 text-sm text-slate-500">Up to 200 MB. Excel uses the first worksheet. Fashion is fixed for this import. Uploading does not start processing.</p>
      <input id="fashion-import-file" aria-describedby="fashion-file-help" type="file" accept=".csv,.xls,.xlsx" disabled={busy} onChange={chooseFile} className="block w-full text-sm" />
      {upload.isPending && <p role="status" className="mt-3">Uploading and detecting columns… Large files may take a few minutes.</p>}
    </section>
    {!!importId && detail.isLoading && <p role="status">Loading import…</p>}
    {record && <section className={panel} aria-label="Selected import">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{record.fileName}</h2><p className="mt-1 text-sm text-slate-500">Fashion · {record.totalRows.toLocaleString()} source rows · {record.status}</p></div><button className={button} disabled={busy} onClick={() => { selectImport(''); action.reset(); }}>Close import</button></div>
      {editable ? <div className="mt-5 space-y-5">
        <h3 className="font-semibold">Preview and column mapping</h3>
        <p className="text-sm text-slate-500">Map Product Title once. Other fields are optional. Unmapped columns are ignored. Image URLs may be separated by |.</p>
        {preview.isLoading && <p role="status">Loading source preview…</p>}
        {preview.error && <p role="alert" className="text-red-600">{errorText(preview.error)} <button className={button} onClick={() => void preview.refetch()}>Retry preview</button></p>}
        {preview.data && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">First five source rows and column mapping</caption><thead><tr>{record.detectedHeaders.map(header => <th key={header} className="min-w-48 p-2 align-top"><span className="mb-2 block break-words">{header}</span><select aria-label={`Map ${header}`} className={fieldStyle} disabled={busy} value={selectedMapping[header] ?? ''} onChange={event => {
          const next = { ...selectedMapping }; if (event.target.value) next[header] = event.target.value; else delete next[header]; setMapping({ id: importId, values: next });
        }}><option value="">Ignore column</option>{preview.data.fields.map(field => <option key={field.field} value={field.field}>{field.label}{field.required ? ' *' : ''}</option>)}</select></th>)}</tr></thead>
          <tbody>{preview.data.rows.map((row, index) => <tr key={index} className="border-t border-slate-200 dark:border-slate-700">{record.detectedHeaders.map(header => <td key={header} className="max-w-xs break-words p-2 align-top">{row[header] || '—'}</td>)}</tr>)}</tbody></table></div>}
        {!mappingValid && <p role="status" className="text-sm text-amber-700">Map Product Title and avoid assigning the same target field to multiple columns.</p>}
        <button className={`${button} bg-pink-700 text-white`} disabled={busy || !mappingValid || !record.totalRows || !preview.data} onClick={() => action.mutate('start')}>{action.isPending ? 'Starting…' : record.status === 'paused' ? 'Resume import' : 'Start Fashion import'}</button>
      </div> : <div className="mt-5 space-y-4">
        <label htmlFor="fashion-import-progress" className="block text-sm">{record.processedRows.toLocaleString()} / {record.totalRows.toLocaleString()} rows processed</label>
        <progress id="fashion-import-progress" className="h-3 w-full accent-pink-600" max={Math.max(record.totalRows, 1)} value={Math.min(record.processedRows, Math.max(record.totalRows, 1))} />
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[['Created', record.insertedRows], ['Updated', record.updatedRows], ['Duplicates skipped', record.skippedDuplicates], ['Flagged', record.flaggedForReview], ['Invalid', record.invalidRows]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><dt className="text-sm text-slate-500">{label}</dt><dd className="text-xl font-semibold">{value}</dd></div>)}</dl>
        {active(record.status) && <p role="status" className="text-sm">Processing in the background. You can leave and reopen this import from history.</p>}
        {record.errorMessage && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{record.errorMessage}</p>}
        {record.warnings?.map((warning, index) => <p key={index} className="text-sm text-amber-700">{warning}</p>)}
        {record.status === 'completed' && <p className="text-sm">Import completed. Check row results; completion can include invalid or flagged rows. <Link className="text-pink-700 underline" to="/fashion/review">Open Fashion review</Link></p>}
        {record.status === 'failed' && <div><p className="mb-2 text-sm">Retry resumes after checkpoint row {record.lastProcessedRow}. Correct already processed invalid rows and upload again.</p><button className={button} disabled={busy} onClick={() => action.mutate('retry')}>Retry failed import</button></div>}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || active(record.status)} onClick={() => void downloadReport()}>{reportBusy ? 'Preparing report…' : 'Download error report (CSV)'}</button><button className={button} onClick={refresh}>Refresh progress</button></div>
        <p className="text-sm text-slate-500">The report includes invalid, error and duplicate-review rows across all pages. Correct the source values and upload again. Download is available when processing stops.</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Row results</h3><label className="text-sm">Status <select className={fieldStyle} value={rowStatus} onChange={event => { setRowStatus(event.target.value); setRowPage(0); }}><option value="">All rows</option>{['inserted', 'updated', 'duplicate_skipped', 'duplicate_flagged', 'invalid', 'error'].map(status => <option key={status}>{status}</option>)}</select></label></div>
        {rows.error && <p role="alert" className="text-red-600">{errorText(rows.error)}</p>}
        {rows.isLoading ? <p role="status">Loading rows…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Row</th><th className="p-2">Status</th><th className="p-2">Details</th></tr></thead><tbody>{rows.data?.rows.map(row => <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700"><td className="p-2">{row.rowNumber}</td><td className="p-2">{row.status}</td><td className="p-2">{row.message || 'Processed successfully'}</td></tr>)}</tbody></table>{!rows.data?.rows.length && <p className="p-2 text-slate-500">No rows for this filter yet.</p>}</div>}
        <div className="flex items-center gap-3"><button className={button} disabled={!rowPage} onClick={() => setRowPage(page => page - 1)}>Previous rows</button><span className="text-sm">Page {rowPage + 1} · {rows.data?.total ?? 0} rows</span><button className={button} disabled={(rowPage + 1) * 50 >= (rows.data?.total ?? 0)} onClick={() => setRowPage(page => page + 1)}>Next rows</button></div>
      </div>}
      {(editable || active(record.status)) && <button className={`${button} mt-4`} disabled={busy} onClick={() => action.mutate('cancel')}>Cancel import</button>}
    </section>}
    <section className={panel} aria-label="Fashion import history"><h2 className="text-xl font-semibold">Import history</h2><p className="my-2 text-sm text-slate-500">Accessible Fashion imports in this workspace. Select one to resume or inspect results.</p>
      {history.isLoading && <p role="status">Loading history…</p>}
      {!history.isLoading && !history.data?.imports.length && <p className="py-3 text-slate-500">No Fashion imports yet.</p>}
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">{history.data?.imports.map(item => <li key={item.id}><button className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left disabled:opacity-50" disabled={busy} onClick={() => { selectImport(item.id); action.reset(); upload.reset(); }}><span className="font-medium">{item.fileName}<span className="ml-3 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span></span><span className="text-sm">{item.status} · {item.processedRows}/{item.totalRows}</span></button></li>)}</ul>
      <div className="mt-3 flex items-center gap-3"><button className={button} disabled={!historyPage || busy} onClick={() => setHistoryPage(page => page - 1)}>Previous imports</button><span className="text-sm">Page {historyPage + 1}</span><button className={button} disabled={busy || (historyPage + 1) * 20 >= (history.data?.total ?? 0)} onClick={() => setHistoryPage(page => page + 1)}>Next imports</button></div>
    </section>
  </div>;
}
