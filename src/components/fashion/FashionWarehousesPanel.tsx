import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  createFashionWarehouse,
  fashionError,
  listFashionWarehouses,
  updateFashionWarehouse,
  type FashionWarehouse,
} from '../../lib/fashionListingsApi';

const control = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';

/** Fashion warehouses offered at quick capture. Deactivated codes stay on past items. */
export default function FashionWarehousesPanel() {
  const { activeOrganizationId } = useAuth();
  const [items, setItems] = useState<FashionWarehouse[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listFashionWarehouses(controller.signal, activeOrganizationId, true).then(setItems).catch((err) => { if (!controller.signal.aborted) setError(fashionError(err)); });
    return () => controller.abort();
  }, [activeOrganizationId, reload]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setBusy(true); setError('');
    try {
      await createFashionWarehouse({ code: code.trim(), name: name.trim(), ...(country.trim() ? { countryCode: country.trim() } : {}) }, activeOrganizationId);
      setCode(''); setName(''); setCountry(''); setReload((value) => value + 1);
    } catch (err) { setError(fashionError(err)); }
    finally { setBusy(false); }
  }
  async function toggle(item: FashionWarehouse) {
    setBusy(true); setError('');
    try { await updateFashionWarehouse(item.id, { active: !item.active }, activeOrganizationId); setReload((value) => value + 1); }
    catch (err) { setError(fashionError(err)); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-6 space-y-4 rounded-xl bg-white p-5 dark:bg-slate-900" aria-labelledby="fashion-warehouses">
      <div>
        <h2 id="fashion-warehouses" className="font-semibold">Warehouses</h2>
        <p className="mt-1 text-sm text-slate-500">Stock locations chosen at quick capture and shown in intake history. They do not change the eBay ship-from location used when publishing.</p>
      </div>
      {items.length > 0 && <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
          <span><span className="font-mono font-semibold">{item.code}</span> — {item.name}{item.countryCode ? ` · ${item.countryCode}` : ''}{!item.active && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Inactive</span>}</span>
          <button type="button" disabled={busy} onClick={() => void toggle(item)} className="rounded-lg border px-3 py-1 text-xs disabled:opacity-40">{item.active ? 'Deactivate' : 'Activate'}</button>
        </li>)}
      </ul>}
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[8rem_1fr_6rem_auto] sm:items-end">
        <label className="text-sm">Code<input className={control} required maxLength={40} value={code} onChange={(event) => setCode(event.target.value.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase())} placeholder="PAK_KHI" /></label>
        <label className="text-sm">Name<input className={control} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Karachi warehouse" /></label>
        <label className="text-sm">Country<input className={control} maxLength={2} value={country} onChange={(event) => setCountry(event.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())} placeholder="PK" /></label>
        <button type="submit" disabled={busy || !code.trim() || !name.trim()} className="min-h-10 rounded-lg bg-pink-600 px-4 text-sm font-semibold text-white disabled:opacity-40">Add warehouse</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
