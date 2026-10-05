import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ScanLine, Search } from 'lucide-react';
import { SOURCING_LABEL, stockApi, type SourcingMode, type StockItemRow, type TrackingMode } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import StockItemDrawer from './StockItemDrawer';
import { btn, card, Drawer, Empty, field, fmtMoney, Notice, PrimaryButton, td, th, Thumb, useAction, useLoad } from './stockUi';

const FILTERS: Array<[string, string]> = [
  ['', 'All SKUs'],
  ['in_stock', 'In stock'],
  ['out_of_stock', 'Out of stock'],
  ['low_stock', 'Low stock'],
  ['reserved', 'Has reservations'],
  ['inbound', 'Inbound'],
  ['sourceable', 'Sourceable from suppliers'],
  ['unlinked', 'Not linked to a product'],
];
const PAGE = 50;

export default function StockItemsTab() {
  const { org, warehouses, can, vertical } = useStock();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const filter = params.get('filter') ?? '';
  const warehouseId = params.get('warehouseId') ?? '';
  const sourcingMode = params.get('sourcing') ?? '';
  const offset = Number(params.get('offset') ?? 0);
  const selected = params.get('item');
  const [creating, setCreating] = useState(false);
  const [scan, setScan] = useState('');
  const scanAction = useAction();
  const canSeeCost = can('stock.valuation.view');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'offset' && key !== 'item') next.delete('offset');
    setParams(next);
  };

  useEffect(() => {
    const t = setTimeout(() => { if ((params.get('q') ?? '') !== q) setParam('q', q); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const list = useLoad(
    (signal) => stockApi.items(org, { q: params.get('q') ?? undefined, filter: filter || undefined, warehouseId: warehouseId || undefined, sourcingMode: sourcingMode || undefined, limit: PAGE, offset }, signal),
    [org, params.get('q'), filter, warehouseId, sourcingMode, offset],
  );

  async function onScan(e: FormEvent) {
    e.preventDefault();
    if (!scan.trim()) return;
    const result = await scanAction.run(() => stockApi.scan(org, scan.trim()));
    if (!result) return;
    const itemId = result.items[0]?.id ?? result.units[0]?.itemId;
    if (itemId) { setParam('item', itemId); setScan(''); }
    else if (result.locations[0]) { setParam('warehouseId', result.locations[0].warehouseId); scanAction.setMessage(`Bin ${result.locations[0].code} in ${result.locations[0].warehouseCode}`); }
    else scanAction.setError(`Nothing matches “${result.code}”.`);
  }

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <div className="space-y-3">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
          <label className="flex-1 text-sm">
            <span className="sr-only">Search SKU or title</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input className={`${field} pl-9`} placeholder="Search SKU, title or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
            </span>
          </label>
          <form onSubmit={onScan} className="flex gap-2 lg:w-72">
            <label className="flex-1 text-sm">
              <span className="sr-only">Scan barcode</span>
              <input className={field} placeholder="Scan SKU / bin / serial" value={scan} onChange={(e) => setScan(e.target.value)} />
            </label>
            <button type="submit" className={`${btn} mt-1`} disabled={scanAction.busy} aria-label="Look up scanned code"><ScanLine className="h-4 w-4" /></button>
          </form>
          {can('stock.receive') ? (
            <PrimaryButton className="mt-1" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden /> New SKU</PrimaryButton>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select className={field} value={filter} onChange={(e) => setParam('filter', e.target.value)} aria-label="Stock filter">
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className={field} value={warehouseId} onChange={(e) => setParam('warehouseId', e.target.value)} aria-label="Warehouse">
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
          <select className={field} value={sourcingMode} onChange={(e) => setParam('sourcing', e.target.value)} aria-label="Sourcing">
            <option value="">Any sourcing</option>
            {(Object.keys(SOURCING_LABEL) as SourcingMode[]).map((m) => <option key={m} value={m}>{SOURCING_LABEL[m]}</option>)}
          </select>
        </div>
        <Notice error={list.error || scanAction.error} message={scanAction.message} />
      </div>

      {list.loading && !list.data ? (
        <p role="status" className="text-sm text-slate-500">Loading stock…</p>
      ) : rows.length === 0 ? (
        <Empty title="No SKUs match">Change the filters, or create a SKU for something you sell but do not hold yet.</Empty>
      ) : (
        <>
          <div className={`${card} hidden overflow-x-auto p-0 lg:block`}>
            <table className="w-full">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className={th}>SKU</th>
                  <th className={`${th} text-right`}>On hand</th>
                  <th className={`${th} text-right`}>Reserved</th>
                  <th className={`${th} text-right`}>Available</th>
                  <th className={`${th} text-right`}>Inbound</th>
                  <th className={`${th} text-right`}>Sourceable</th>
                  <th className={th}>Where</th>
                  {canSeeCost ? <th className={`${th} text-right`}>Avg cost</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setParam('item', r.id)}>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <Thumb src={r.imageUrl} alt="" />
                        <div className="min-w-0">
                          <button type="button" className="font-mono text-sm font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); setParam('item', r.id); }}>{r.sku}</button>
                          <p className="max-w-xs truncate text-xs text-slate-500">{r.title ?? '—'}</p>
                          <ItemTags row={r} />
                        </div>
                      </div>
                    </td>
                    <td className={`${td} text-right tabular-nums`}>{r.onHand}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.reserved || '—'}</td>
                    <td className={`${td} text-right font-semibold tabular-nums ${r.available <= 0 ? 'text-red-600 dark:text-red-400' : r.available <= r.lowStockThreshold ? 'text-amber-600 dark:text-amber-400' : ''}`}>{r.available}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.inbound || '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{r.sourceCount ? r.sourceable : '—'}</td>
                    <td className={`${td} text-xs text-slate-500`}>{r.breakdown.slice(0, 3).map((b) => `${b.code}${b.bin ? `/${b.bin}` : ''}: ${b.onHand}`).join(' · ') || '—'}</td>
                    {canSeeCost ? <td className={`${td} text-right tabular-nums`}>{fmtMoney(r.unitCost)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 lg:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setParam('item', r.id)} className={`${card} flex w-full items-center gap-3 text-left`}>
                  <Thumb src={r.imageUrl} alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{r.sku}</p>
                    <p className="truncate text-xs text-slate-500">{r.title ?? '—'}</p>
                    <ItemTags row={r} />
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-lg font-bold tabular-nums">{r.available}</p>
                    <p className="text-slate-500">of {r.onHand} on hand</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
            <div className="flex gap-2">
              <button type="button" className={btn} disabled={offset === 0} onClick={() => setParam('offset', String(Math.max(0, offset - PAGE)))}>Previous</button>
              <button type="button" className={btn} disabled={offset + PAGE >= total} onClick={() => setParam('offset', String(offset + PAGE))}>Next</button>
            </div>
          </div>
        </>
      )}

      {selected ? <StockItemDrawer itemId={selected} onClose={() => setParam('item', '')} onChanged={list.reload} /> : null}
      {creating ? <NewItemDrawer vertical={vertical} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); list.reload(); setParam('item', id); }} /> : null}
    </div>
  );
}

function ItemTags({ row }: { row: StockItemRow }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {row.sourcingMode !== 'stocked' ? <span className="rounded bg-violet-50 px-1.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">{SOURCING_LABEL[row.sourcingMode]}</span> : null}
      {row.trackingMode !== 'quantity' ? <span className="rounded bg-slate-100 px-1.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{row.trackingMode === 'serial' ? 'Serialized' : 'One-off'}</span> : null}
      {row.pendingProcurement ? <span className="rounded bg-amber-50 px-1.5 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{row.pendingProcurement} being acquired</span> : null}
    </div>
  );
}

function NewItemDrawer({ vertical, onClose, onCreated }: { vertical: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { org } = useStock();
  const [sku, setSku] = useState('');
  const [title, setTitle] = useState('');
  const [tracking, setTracking] = useState<TrackingMode>(vertical === 'fashion' ? 'one_off' : 'quantity');
  const [sourcing, setSourcing] = useState<SourcingMode>('stocked');
  const action = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const created = await action.run(() => stockApi.createItem(org, { sku: sku.trim(), title: title.trim() || undefined, vertical, trackingMode: tracking, sourcingMode: sourcing }));
    if (created) onCreated(created.id);
  }
  return (
    <Drawer title="New SKU" subtitle="Usually created automatically from intake and setup. Create one here for parts you sell before you hold them." onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">SKU<input className={field} required maxLength={160} value={sku} onChange={(e) => setSku(e.target.value)} /></label>
        <label className="block text-sm">Title<input className={field} maxLength={500} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm">Tracking
          <select className={field} value={tracking} onChange={(e) => setTracking(e.target.value as TrackingMode)}>
            <option value="quantity">By quantity</option>
            <option value="one_off">One-off pieces (each unit is unique)</option>
            <option value="serial">Serial numbers</option>
          </select>
        </label>
        <label className="block text-sm">Sourcing
          <select className={field} value={sourcing} onChange={(e) => setSourcing(e.target.value as SourcingMode)}>
            <option value="stocked">Stocked — sell only what is on hand</option>
            <option value="hybrid">Stock + source — use stock first, buy the rest after a sale</option>
            <option value="on_demand">On demand — always buy from a supplier after a sale</option>
          </select>
        </label>
        <Notice error={action.error} />
        <PrimaryButton type="submit" disabled={action.busy || !sku.trim()}>{action.busy ? 'Creating…' : 'Create SKU'}</PrimaryButton>
      </form>
    </Drawer>
  );
}
