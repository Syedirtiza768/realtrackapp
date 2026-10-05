import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { stockApi, type DocType } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import { useLocations } from './StockItemDrawer';
import { btn, card, Drawer, Empty, field, fmtDate, Notice, PrimaryButton, Section, signed, StatusBadge, td, th, useAction, useLoad } from './stockUi';

const TYPES: Array<[DocType | '', string]> = [['', 'All'], ['transfer', 'Transfers'], ['count', 'Counts'], ['adjustment', 'Adjustments'], ['receipt', 'Receipts']];

export default function StockDocumentsTab() {
  const { org, can } = useStock();
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') ?? '') as DocType | '';
  const status = params.get('status') ?? '';
  const openDoc = params.get('doc');
  const [creating, setCreating] = useState<'transfer' | 'count' | null>(null);
  const list = useLoad(
    (s) => stockApi.documents(org, { type: type || undefined, status: status || undefined, limit: 100 }, s).then((r) => ({ ...r, items: r.items.filter((d) => d.docType !== 'purchase_order') })),
    [org, type, status],
  );
  const set = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); };

  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-end gap-2`}>
        <label className="text-sm sm:w-48">Type<select className={field} value={type} onChange={(e) => set('type', e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm sm:w-56">Status
          <select className={field} value={status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Any</option><option value="draft">Draft</option><option value="pending_approval">Awaiting approval</option>
            <option value="in_transit,partially_received">In transit</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          {can('stock.move') ? <PrimaryButton onClick={() => setCreating('transfer')}>New transfer</PrimaryButton> : null}
          {can('stock.count') ? <button type="button" className={btn} onClick={() => setCreating('count')}>New count</button> : null}
        </div>
      </div>
      <Notice error={list.error} />
      {list.data && !list.data.items.length ? <Empty title="No documents" /> : null}
      {list.data?.items.length ? (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-800"><tr><th className={th}>Number</th><th className={th}>Type</th><th className={th}>Warehouse</th><th className={th}>Status</th><th className={`${th} text-right`}>Lines</th><th className={th}>Created</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.items.map((d) => (
                <tr key={d.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => set('doc', d.id)}>
                  <td className={`${td} font-mono font-semibold`}>{d.docNumber}</td>
                  <td className={td}>{d.docType}{d.reasonCode ? <span className="text-xs text-slate-500"> · {d.reasonCode.replace(/_/g, ' ')}</span> : null}</td>
                  <td className={`${td} font-mono`}>{d.warehouseCode}{d.destWarehouseCode ? ` → ${d.destWarehouseCode}` : ''}</td>
                  <td className={td}><StatusBadge status={d.status} /></td>
                  <td className={`${td} text-right tabular-nums`}>{d.lineCount}</td>
                  <td className={td}>{fmtDate(d.createdAt)}{d.createdByEmail ? <span className="block text-xs text-slate-500">{d.createdByEmail}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {openDoc ? <DocumentDrawer id={openDoc} onClose={() => set('doc', '')} onChanged={list.reload} /> : null}
      {creating === 'transfer' ? <NewTransfer onClose={() => setCreating(null)} onCreated={(id) => { setCreating(null); list.reload(); set('doc', id); }} /> : null}
      {creating === 'count' ? <NewCount onClose={() => setCreating(null)} onCreated={(id) => { setCreating(null); list.reload(); set('doc', id); }} /> : null}
    </div>
  );
}

function DocumentDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { org, can } = useStock();
  const doc = useLoad((s) => stockApi.document(org, id, s), [org, id]);
  const d = doc.data;
  const destLocations = useLocations(d?.destWarehouseId ?? '');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [bins, setBins] = useState<Record<string, string>>({});
  const action = useAction();
  const done = () => { setQty({}); doc.reload(); onChanged(); };
  async function act(fn: () => Promise<unknown>, msg?: string | ((r: unknown) => string)) {
    const r = await action.run(fn, msg);
    if (r !== undefined) done();
  }

  const lines = d?.lines ?? [];
  const isCount = d?.docType === 'count';
  const isTransfer = d?.docType === 'transfer';

  return (
    <Drawer wide onClose={onClose} title={d ? <span className="font-mono">{d.docNumber}</span> : 'Loading…'}
      subtitle={d ? <>{d.docType} · {d.warehouse?.code}{d.destWarehouse ? ` → ${d.destWarehouse.code}` : ''} · <StatusBadge status={d.status} /></> : undefined}>
      <Notice error={doc.error || action.error} message={action.message} />
      {d ? (
        <div className="space-y-4">
          {d.note ? <p className="text-sm text-slate-600 dark:text-slate-300">{d.note}</p> : null}
          <div className="flex flex-wrap gap-2">
            {isTransfer && d.status === 'draft' && can('stock.move') ? <PrimaryButton disabled={action.busy} onClick={() => void act(() => stockApi.shipTransfer(org, id), 'Shipped. The destination now shows it as inbound.')}>Ship transfer</PrimaryButton> : null}
            {(d.docType === 'adjustment' || isCount) && d.status === 'pending_approval' && can('stock.adjust.approve') ? <PrimaryButton disabled={action.busy} onClick={() => void act(() => stockApi.approveAdjustment(org, id), 'Approved and applied.')}>Approve and apply</PrimaryButton> : null}
            {['draft', 'pending_approval'].includes(d.status) && can('stock.move') ? <button type="button" className={btn} disabled={action.busy} onClick={() => { if (window.confirm('Cancel this document? Nothing has been applied to stock yet.')) void act(() => stockApi.cancelDocument(org, id), 'Cancelled.'); }}>Cancel</button> : null}
          </div>

          <Section title={isCount ? (d.status === 'draft' ? 'Count — enter what you find' : 'Count results') : 'Lines'}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((l) => {
                const variance = l.countedQty != null && l.systemQty != null ? l.countedQty - l.systemQty : null;
                return (
                  <li key={l.id} className="flex flex-wrap items-end gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p><span className="font-mono font-semibold">{l.sku}</span> <span className="text-slate-500">{l.title}</span></p>
                      <p className="text-xs text-slate-500">
                        {l.locationCode ? `bin ${l.locationCode}` : 'unassigned'}{l.destLocationCode ? ` → ${l.destLocationCode}` : ''}
                        {!isCount ? ` · ${isTransfer ? `${l.processedQty} of ${l.quantity} received` : signed(l.quantity)}` : ''}
                        {isCount && l.systemQty != null ? ` · system ${l.systemQty}` : ''}
                        {isCount && variance != null && d.status !== 'draft' ? ` · variance ${signed(variance)}` : ''}
                      </p>
                    </div>
                    {isCount && d.status === 'draft' && can('stock.count') ? (
                      <label className="w-28 text-xs">Counted<input className={field} type="number" min={0} inputMode="numeric" value={qty[l.id] ?? (l.countedQty ?? '')} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} /></label>
                    ) : null}
                    {isTransfer && ['in_transit', 'partially_received'].includes(d.status) && l.processedQty < l.quantity && can('stock.receive') ? (
                      <>
                        <label className="w-24 text-xs">Receive<input className={field} type="number" min={0} max={l.quantity - l.processedQty} value={qty[l.id] ?? ''} placeholder={String(l.quantity - l.processedQty)} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} /></label>
                        <label className="w-32 text-xs">Into bin
                          <select className={field} value={bins[l.id] ?? l.destLocationId ?? ''} onChange={(e) => setBins({ ...bins, [l.id]: e.target.value })}>
                            <option value="">Unassigned</option>
                            {(destLocations.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
                          </select>
                        </label>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {isCount && d.status === 'draft' && can('stock.count') ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} disabled={action.busy || !Object.keys(qty).length}
                  onClick={() => void act(() => stockApi.recordCount(org, id, Object.entries(qty).filter(([, v]) => v !== '').map(([lineId, v]) => ({ lineId, countedQty: Number(v) }))), 'Counts saved.')}>Save counts</button>
                <PrimaryButton disabled={action.busy}
                  onClick={() => void act(async () => {
                    const pending = Object.entries(qty).filter(([, v]) => v !== '');
                    if (pending.length) await stockApi.recordCount(org, id, pending.map(([lineId, v]) => ({ lineId, countedQty: Number(v) })));
                    return stockApi.submitCount(org, id);
                  }, (r) => ((r as { status?: string; message?: string }).status === 'completed' ? 'Count applied.' : (r as { message?: string }).message ?? 'Submitted for approval.'))}>Submit count</PrimaryButton>
              </div>
            ) : null}
            {isTransfer && ['in_transit', 'partially_received'].includes(d.status) && can('stock.receive') ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => setQty(Object.fromEntries(lines.filter((l) => l.processedQty < l.quantity).map((l) => [l.id, String(l.quantity - l.processedQty)])))}>Fill all</button>
                <PrimaryButton disabled={action.busy || !Object.values(qty).some((v) => Number(v) > 0)}
                  onClick={() => void act(() => stockApi.receiveTransfer(org, id, Object.entries(qty).filter(([, v]) => Number(v) > 0).map(([lineId, v]) => ({ lineId, quantity: Number(v), locationId: bins[lineId] || undefined }))), 'Received.')}>Receive</PrimaryButton>
              </div>
            ) : null}
          </Section>
        </div>
      ) : null}
    </Drawer>
  );
}

function NewTransfer({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { org, warehouses } = useStock();
  const [from, setFrom] = useState(warehouses.find((w) => w.isDefault)?.id ?? '');
  const [to, setTo] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Array<{ itemId: string; sku: string; quantity: number; available: number }>>([]);
  const [q, setQ] = useState('');
  const results = useLoad((s) => (q.trim().length >= 2 && from ? stockApi.items(org, { q: q.trim(), warehouseId: from, filter: 'in_stock', limit: 8 }, s) : Promise.resolve({ items: [], total: 0, limit: 8, offset: 0 })), [org, q, from]);
  const action = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const doc = await action.run(() => stockApi.createTransfer(org, { warehouseId: from, destWarehouseId: to, reference: reference || undefined, lines: lines.map(({ itemId, quantity }) => ({ itemId, quantity })) }));
    if (doc) onCreated(doc.id);
  }
  return (
    <Drawer title="New transfer" subtitle="Moves stock between warehouses. It stays in transit until the destination receives it." onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">From<select className={field} required value={from} onChange={(e) => { setFrom(e.target.value); setLines([]); }}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}</select></label>
          <label className="text-sm">To<select className={field} required value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose…</option>{warehouses.filter((w) => w.id !== from).map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}</select></label>
        </div>
        <label className="block text-sm">Reference (consignment, AWB…)<input className={field} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
        <label className="block text-sm">Add SKU<input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock in the source warehouse" /></label>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {(results.data?.items ?? []).filter((i) => !lines.some((l) => l.itemId === i.id)).map((i) => (
            <li key={i.id} className="flex justify-between gap-2 py-1"><span><span className="font-mono">{i.sku}</span> · {i.available} available</span><button type="button" className={btn} onClick={() => { setLines([...lines, { itemId: i.id, sku: i.sku, quantity: 1, available: i.available }]); setQ(''); }}>Add</button></li>
          ))}
        </ul>
        {lines.map((l, idx) => (
          <div key={l.itemId} className="flex items-end gap-2 text-sm">
            <span className="flex-1 pb-2 font-mono">{l.sku} <span className="text-xs text-slate-500">({l.available} available)</span></span>
            <label className="w-24 text-xs">Qty<input className={field} type="number" min={1} max={l.available} value={l.quantity} onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))} /></label>
            <button type="button" className={btn} onClick={() => setLines(lines.filter((_, i) => i !== idx))}>Remove</button>
          </div>
        ))}
        <Notice error={action.error} />
        <PrimaryButton type="submit" disabled={action.busy || !from || !to || !lines.length}>Create draft transfer</PrimaryButton>
      </form>
    </Drawer>
  );
}

function NewCount({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { org, warehouses } = useStock();
  const [warehouseId, setWarehouseId] = useState(warehouses.find((w) => w.isDefault)?.id ?? '');
  const locations = useLocations(warehouseId);
  const [picked, setPicked] = useState<string[]>([]);
  const action = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const doc = await action.run(() => stockApi.createCount(org, { warehouseId, locationIds: picked.length ? picked : undefined }));
    if (doc) onCreated(doc.id);
  }
  return (
    <Drawer title="New cycle count" subtitle="Blind count: counters enter what they find without seeing the system quantity." onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Warehouse<select className={field} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPicked([]); }}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}</select></label>
        <fieldset className="text-sm">
          <legend className="mb-1">Bins (leave empty to count every bin with stock)</legend>
          <div className="flex max-h-60 flex-wrap gap-1.5 overflow-y-auto">
            {(locations.data ?? []).map((l) => (
              <label key={l.id} className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs ${picked.includes(l.id) ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-700'}`}>
                <input type="checkbox" className="sr-only" checked={picked.includes(l.id)} onChange={() => setPicked(picked.includes(l.id) ? picked.filter((x) => x !== l.id) : [...picked, l.id])} />
                {l.code}
              </label>
            ))}
          </div>
        </fieldset>
        <Notice error={action.error} />
        <PrimaryButton type="submit" disabled={action.busy || !warehouseId}>Start count</PrimaryButton>
      </form>
    </Drawer>
  );
}
