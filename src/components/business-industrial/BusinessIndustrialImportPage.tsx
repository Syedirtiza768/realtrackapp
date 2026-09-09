import { ChangeEvent, useState } from 'react';
import { fetchWithAuth } from '../../lib/authApi';

export default function BusinessIndustrialImportPage() {
  const [message, setMessage] = useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return; setMessage('Uploading…');
    const body = new FormData(); body.append('file', file); body.append('vertical', 'business_industrial');
    try { const result = await fetchWithAuth<{ import?: { id: string } }>('/api/catalog-import/upload', { method: 'POST', body }); if (result.import?.id) await fetchWithAuth('/api/catalog-import/start', { method: 'POST', body: JSON.stringify({ importId: result.import.id }) }); setMessage('B&I import queued. Invalid specifications remain in the import report and approved review queue.'); } catch (err) { setMessage(err instanceof Error ? err.message : 'B&I import failed'); }
  }
  return <div><h1 className="text-3xl font-semibold">Bulk Business &amp; Industrial import</h1><p className="mt-2 text-slate-500">Upload CSV or Excel data with an explicit category family, units for measurements, inventory model, and shipping fields.</p><label className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-300 bg-white p-12 text-center shadow-sm dark:bg-slate-900"><span className="font-semibold">Choose CSV or Excel file</span><span className="mt-2 text-sm text-slate-500">Up to 200 MB · B&amp;I vertical is immutable for this import</span><input className="hidden" type="file" accept=".csv,.xls,.xlsx" onChange={upload} /></label>{message && <p className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{message}</p>}</div>;
}
