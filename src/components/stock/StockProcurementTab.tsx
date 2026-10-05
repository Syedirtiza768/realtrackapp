import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { stockApi, type ProcurementRequestRow, type Supplier } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import { useLocations } from './StockItemDrawer';
import {
  Badge,
  btn,
  card,
  Drawer,
  Empty,
  field,
  fmtDay,
  fmtMoney,
  Notice,
  PrimaryButton,
  Section,
  StatusBadge,
  td,
  th,
  Thumb,
  useAction,
  useLoad,
} from './stockUi';

const VIEWS: Array<[string, string]> = [['requests', 'To acquire'], ['pos', 'Purchase orders'], ['suppliers', 'Suppliers'], ['reorder', 'Reorder']];

export default function StockProcurementTab() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'requests';
  const set = (v: string) => { const next = new URLSearchParams(params); next.set('view', v); next.delete('po'); setParams(next); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map(([v, l]) => (
          <button key={v} type="button" className={`${btn} ${view === v ? 'ring-2 ring-[color:var(--brand-primary,#2563eb)]' : ''}`} onClick={() => set(v)}>{l}</button>
        ))}
      </div>
      {view === 'pos' ? <PurchaseOrders /> : view === 'suppliers' ? <Suppliers /> : view === 'reorder' ? <Reorder /> : <Requests />}
    </div>
  );
}

/* ── Requests ─────────────────────────────────────────────────────── */

function Requests() {
  const { org, can, openTab } = useStock();
  const [status, setStatus] = useState('open,ordered');
  const list = useLoad((s) => stockApi.requests(org, { status, limit: 200 }, s), [org, status]);
  const suppliers = useLoad((s) => stockApi.suppliers(org, false, s), [org]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropshipping, setDropshipping] = useState<ProcurementRequestRow | null>(null);
  const action = useAction();
  const canProcure = can('stock.procure');

  const rows = list.data?.items ?? [];
  const selectable = (r: ProcurementRequestRow) => r.status === 'open' && r.fulfillmentMode === 'ship_to_warehouse' && !!r.supplierId;
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function makePos() {
    const created = await action.run(() => stockApi.poFromRequests(org, [...selected]), (pos) => `Created ${pos.length} draft purchase order(s): ${pos.map((p) => p.docNumber).join(', ')}.`);
    if (created) { setSelected(new Set()); list.reload(); }
  }
  async function update(r: ProcurementRequestRow, body: Parameters<typeof stockApi.updateRequest>[2]) {
    const ok = await action.run(() => stockApi.updateRequest(org, r.id, body), 'Updated.');
    if (ok !== undefined) list.reload();
  }
  async function cancel(r: ProcurementRequestRow) {
    if (!window.confirm(`Cancel the request for ${r.quantity} × ${r.sku}?${r.orderId ? ' The order line will become a backorder.' : ''}`)) return;
    const ok = await action.run(() => stockApi.cancelRequest(org, r.id), 'Request cancelled.');
    if (ok !== undefined) list.reload();
  }

  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-end justify-between gap-2`}>
        <label className="text-sm sm:w-64">Show
          <select className={field} value={status} onChange={(e) => { setStatus(e.target.value); setSelected(new Set()); }}>
            <option value="open,ordered">Open and ordered</option>
            <option value="open">Open — not ordered yet</option>
            <option value="ordered">Ordered from supplier</option>
            <option value="received,dropshipped,fulfilled">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        {canProcure ? (
          <PrimaryButton disabled={!selected.size || action.busy} onClick={() => void makePos()}>
            Create purchase orders ({selected.size})
          </PrimaryButton>
        ) : null}
        <p className="w-full text-xs text-slate-500">
          Requests are created automatically when an order cannot be filled from stock. Select open requests to group them into one purchase order per supplier.
          When the goods are received, they are reserved for the waiting orders. Dropship requests are closed by entering the supplier’s tracking.
        </p>
      </div>
      <Notice error={list.error || action.error} message={action.message} />
      {list.data && !rows.length ? <Empty title="Nothing to acquire">Order lines that are short of stock will show up here.</Empty> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={`${card} space-y-2`}>
            <div className="flex flex-wrap items-start gap-3">
              {canProcure && selectable(r) ? (
                <input type="checkbox" className="mt-3 h-4 w-4" aria-label={`Select ${r.sku}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              ) : <span className="w-4" />}
              <Thumb src={r.imageUrl} alt="" />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-semibold tabular-nums">{r.quantity - r.receivedQty}</span> × <span className="font-mono font-semibold">{r.sku}</span> <span className="text-slate-500">{r.title}</span></p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <StatusBadge status={r.status} />
                  {r.fulfillmentMode === 'dropship' ? <Badge tone="violet">dropship</Badge> : null}
                  {r.reason !== 'order' ? <Badge>{r.reason}</Badge> : null}
                  {r.externalOrderId ? <span>for order <span className="font-mono">{r.externalOrderId}</span>{r.storeName ? ` (${r.storeName})` : ''}</span> : null}
                  {r.purchaseOrderNumber ? <span>on <span className="font-mono">{r.purchaseOrderNumber}</span></span> : null}
                  {r.neededBy ? <span className={new Date(r.neededBy) < new Date() ? 'text-red-600' : ''}>needed by {fmtDay(r.neededBy)}</span> : null}
                  {r.estimatedUnitCost ? <span>~{fmtMoney(r.estimatedUnitCost)} each</span> : null}
                  {r.supplierTracking ? <span>tracking {r.supplierTracking}</span> : null}
                </p>
              </div>
            </div>
            {canProcure && r.status === 'open' ? (
              <div className="flex flex-wrap items-end gap-2 pl-7">
                <label className="text-xs sm:w-56">Supplier
                  <select className={field} value={r.supplierId ?? ''} onChange={(e) => e.target.value && void update(r, { supplierId: e.target.value })}>
                    <option value="">Choose supplier…</option>
                    {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                {r.orderId ? (
                  <label className="text-xs sm:w-56">Fulfilment
                    <select className={field} value={r.fulfillmentMode} onChange={(e) => void update(r, { fulfillmentMode: e.target.value as 'ship_to_warehouse' | 'dropship' })}>
                      <option value="ship_to_warehouse">Ship to our warehouse</option>
                      <option value="dropship">Supplier dropships to buyer</option>
                    </select>
                  </label>
                ) : null}
                {r.sourceUrl ? <a className={btn} href={r.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden /> Supplier page</a> : null}
                {r.orderId ? <button type="button" className={btn} onClick={() => setDropshipping(r)}>Supplier shipped it to the buyer…</button> : null}
                <button type="button" className={btn} onClick={() => void cancel(r)}>Cancel</button>
              </div>
            ) : null}
            {r.status === 'ordered' && r.purchaseOrderId ? (
              <div className="pl-7"><button type="button" className={btn} onClick={() => openTab('procurement', { view: 'pos', po: r.purchaseOrderId! })}>Open purchase order</button></div>
            ) : null}
          </li>
        ))}
      </ul>
      {dropshipping ? <DropshipDrawer row={dropshipping} onClose={() => setDropshipping(null)} onDone={() => { setDropshipping(null); list.reload(); }} /> : null}
    </div>
  );
}

function DropshipDrawer({ row, onClose, onDone }: { row: ProcurementRequestRow; onClose: () => void; onDone: () => void }) {
  const { org } = useStock();
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [cost, setCost] = useState(row.estimatedUnitCost ?? '');
  const action = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await action.run(() => stockApi.dropship(org, row.id, { supplierTracking: tracking.trim() || undefined, carrier: carrier.trim() || undefined, unitCost: cost ? Number(cost) : undefined }));
    if (ok !== undefined) onDone();
  }
  return (
    <Drawer title="Mark as dropshipped" subtitle={`${row.quantity} × ${row.sku} for order ${row.externalOrderId ?? ''}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">The supplier shipped this directly to the buyer, so no stock moves through your warehouse. Add the same tracking to the order when you mark it shipped.</p>
        <label className="block text-sm">Carrier<input className={field} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="UPS" /></label>
        <label className="block text-sm">Tracking number<input className={field} value={tracking} onChange={(e) => setTracking(e.target.value)} /></label>
        <label className="block text-sm">Actual unit cost<input className={field} type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
        <Notice error={action.error} />
        <PrimaryButton type="submit" disabled={action.busy}>Mark dropshipped</PrimaryButton>
      </form>
    </Drawer>
  );
}

/* ── Purchase orders ──────────────────────────────────────────────── */

function PurchaseOrders() {
  const { org, can, warehouses } = useStock();
  const [params, setParams] = useSearchParams();
  const openPo = params.get('po');
  const [status, setStatus] = useState('draft,ordered,partially_received');
  const list = useLoad((s) => stockApi.documents(org, { type: 'purchase_order', status, limit: 100 }, s), [org, status]);
  const suppliers = useLoad((s) => stockApi.suppliers(org, false, s), [org]);
  const [creating, setCreating] = useState(false);
  const setPo = (id: string | null) => { const next = new URLSearchParams(params); if (id) next.set('po', id); else next.delete('po'); setParams(next); };

  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-end justify-between gap-2`}>
        <label className="text-sm sm:w-64">Show
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft,ordered,partially_received">Open</option>
            <option value="draft">Draft</option>
            <option value="ordered,partially_received">Ordered / arriving</option>
            <option value="completed">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        {can('stock.procure') ? <PrimaryButton onClick={() => setCreating(true)}>New purchase order</PrimaryButton> : null}
      </div>
      <Notice error={list.error} />
      {list.data && !list.data.items.length ? <Empty title="No purchase orders" /> : null}
      {list.data?.items.length ? (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-800"><tr><th className={th}>PO</th><th className={th}>Supplier</th><th className={th}>Into</th><th className={th}>Status</th><th className={`${th} text-right`}>Received</th><th className={th}>Expected</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.items.map((d) => (
                <tr key={d.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setPo(d.id)}>
                  <td className={`${td} font-mono font-semibold`}>{d.docNumber}</td>
                  <td className={td}>{d.supplierName}</td>
                  <td className={`${td} font-mono`}>{d.warehouseCode}</td>
                  <td className={td}><StatusBadge status={d.status} /></td>
                  <td className={`${td} text-right tabular-nums`}>{d.processedQty} / {d.totalQty}</td>
                  <td className={td}>{fmtDay(d.expectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {openPo ? <PurchaseOrderDrawer id={openPo} onClose={() => setPo(null)} onChanged={list.reload} /> : null}
      {creating ? (
        <NewPoDrawer suppliers={suppliers.data ?? []} defaultWarehouse={warehouses.find((w) => w.isDefault)?.id ?? ''}
          onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); list.reload(); setPo(id); }} />
      ) : null}
    </div>
  );
}

function PurchaseOrderDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { org, can } = useStock();
  const doc = useLoad((s) => stockApi.document(org, id, s), [org, id]);
  const d = doc.data;
  const locations = useLocations(d?.warehouseId ?? '');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [bins, setBins] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<string, string>>({});
  const action = useAction();
  const refresh = () => { doc.reload(); onChanged(); };

  async function act(fn: () => Promise<unknown>, msg: string) {
    const ok = await action.run(fn, msg);
    if (ok !== undefined) { setQty({}); setSerials({}); refresh(); }
  }
  const receivable = d && ['ordered', 'partially_received'].includes(d.status);
  const lines = (d?.lines ?? []).map((l) => ({ ...l, outstanding: l.quantity - l.processedQty }));
  const toReceive = lines
    .map((l) => ({ lineId: l.id, quantity: Number(qty[l.id] ?? 0), locationId: bins[l.id] || undefined, serials: serials[l.id]?.trim() ? serials[l.id].split(/[\s,]+/).filter(Boolean) : undefined }))
    .filter((l) => l.quantity > 0);

  return (
    <Drawer wide onClose={onClose} title={d ? <span className="font-mono">{d.docNumber}</span> : 'Loading…'} subtitle={d ? <>{d.supplier?.name} → {d.warehouse?.code} · <StatusBadge status={d.status} /></> : undefined}>
      <Notice error={doc.error || action.error} message={action.message} />
      {d ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {d.status === 'draft' && can('stock.procure') ? <PrimaryButton disabled={action.busy} onClick={() => void act(() => stockApi.orderPurchaseOrder(org, id), 'Marked as ordered. Quantities now show as inbound.')}>Mark as ordered</PrimaryButton> : null}
            {['draft', 'ordered', 'partially_received'].includes(d.status) && can('stock.procure') ? (
              <button type="button" className={btn} disabled={action.busy} onClick={() => { if (window.confirm(d.status === 'draft' ? 'Cancel this draft? Its requests go back to open.' : 'Close this purchase order? Anything not yet received is cancelled and its requests reopen.')) void act(() => stockApi.cancelPurchaseOrder(org, id), 'Purchase order closed.'); }}>
                {d.status === 'draft' ? 'Cancel draft' : 'Close (cancel the rest)'}
              </button>
            ) : null}
            {d.supplier?.email ? <a className={btn} href={`mailto:${d.supplier.email}?subject=${encodeURIComponent(`Purchase order ${d.docNumber}`)}&body=${encodeURIComponent(lines.map((l) => `${l.quantity} x ${l.sku}${l.note ? ` (${l.note})` : ''}`).join('\n'))}`}>Email supplier</a> : null}
          </div>
          <Section title="Lines">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.map((l) => (
                <li key={l.id} className="space-y-2 py-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Thumb src={l.imageUrl} alt="" />
                    <div className="min-w-0 flex-1">
                      <p><span className="font-mono font-semibold">{l.sku}</span> <span className="text-slate-500">{l.title}</span></p>
                      <p className="text-xs text-slate-500">{l.processedQty} of {l.quantity} received · {fmtMoney(l.unitCost)} each{l.note ? ` · ${l.note}` : ''}</p>
                      {l.requests?.some((r) => r.orderId) ? <p className="text-xs text-violet-700 dark:text-violet-300">Reserved on receipt for {l.requests.filter((r) => r.orderId).length} waiting order line(s)</p> : null}
                    </div>
                  </div>
                  {receivable && l.outstanding > 0 && can('stock.receive') ? (
                    <div className="grid gap-2 pl-[3.25rem] sm:grid-cols-[6rem_1fr]">
                      <label className="text-xs">Receive now<input className={field} type="number" min={0} max={l.outstanding} value={qty[l.id] ?? ''} placeholder={String(l.outstanding)} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} /></label>
                      <label className="text-xs">Into bin
                        <select className={field} value={bins[l.id] ?? ''} onChange={(e) => setBins({ ...bins, [l.id]: e.target.value })}>
                          <option value="">Unassigned</option>
                          {(locations.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
                        </select>
                      </label>
                      {l.trackingMode === 'serial' ? (
                        <label className="text-xs sm:col-span-2">Serial numbers<textarea className={field} rows={2} value={serials[l.id] ?? ''} onChange={(e) => setSerials({ ...serials, [l.id]: e.target.value })} /></label>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {receivable && can('stock.receive') ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => setQty(Object.fromEntries(lines.filter((l) => l.outstanding > 0).map((l) => [l.id, String(l.outstanding)])))}>Fill all outstanding</button>
                <PrimaryButton disabled={action.busy || !toReceive.length} onClick={() => void act(() => stockApi.receivePurchaseOrder(org, id, toReceive), 'Received. Stock waiting for orders has been reserved.')}>Receive {toReceive.reduce((n, l) => n + l.quantity, 0) || ''}</PrimaryButton>
              </div>
            ) : null}
          </Section>
        </div>
      ) : null}
    </Drawer>
  );
}

function NewPoDrawer({ suppliers, defaultWarehouse, onClose, onCreated }: { suppliers: Supplier[]; defaultWarehouse: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { org, warehouses } = useStock();
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse);
  const [lines, setLines] = useState<Array<{ itemId: string; sku: string; quantity: number; unitCost?: number }>>([]);
  const [q, setQ] = useState('');
  const results = useLoad((s) => (q.trim().length >= 2 ? stockApi.items(org, { q: q.trim(), limit: 8 }, s) : Promise.resolve({ items: [], total: 0, limit: 8, offset: 0 })), [org, q]);
  const action = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const po = await action.run(() => stockApi.createPurchaseOrder(org, { supplierId, warehouseId, lines: lines.map(({ itemId, quantity, unitCost }) => ({ itemId, quantity, unitCost })) }));
    if (po) onCreated(po.id);
  }
  return (
    <Drawer title="New purchase order" subtitle="For replenishment. Order-driven purchases are created from the To acquire list." onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Supplier<select className={field} required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Choose…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block text-sm">Receive into<select className={field} required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
        <label className="block text-sm">Add SKU<input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU or title" /></label>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {(results.data?.items ?? []).filter((i) => !lines.some((l) => l.itemId === i.id)).map((i) => (
            <li key={i.id} className="flex justify-between gap-2 py-1"><span className="font-mono">{i.sku}</span><button type="button" className={btn} onClick={() => { setLines([...lines, { itemId: i.id, sku: i.sku, quantity: 1 }]); setQ(''); }}>Add</button></li>
          ))}
        </ul>
        {lines.map((l, idx) => (
          <div key={l.itemId} className="grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2 text-sm">
            <span className="pb-2 font-mono">{l.sku}</span>
            <label className="text-xs">Qty<input className={field} type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))} /></label>
            <label className="text-xs">Cost<input className={field} type="number" min={0} step="0.01" value={l.unitCost ?? ''} onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, unitCost: e.target.value ? Number(e.target.value) : undefined } : x)))} /></label>
            <button type="button" className={btn} onClick={() => setLines(lines.filter((_, i) => i !== idx))}>Remove</button>
          </div>
        ))}
        <Notice error={action.error} />
        <PrimaryButton type="submit" disabled={action.busy || !supplierId || !warehouseId || !lines.length}>Create draft</PrimaryButton>
      </form>
    </Drawer>
  );
}

/* ── Suppliers ────────────────────────────────────────────────────── */

function Suppliers() {
  const { org, can } = useStock();
  const list = useLoad((s) => stockApi.suppliers(org, true, s), [org]);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const action = useAction();
  const canEdit = can('stock.procure');
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const body = {
      name: editing.name?.trim(), type: editing.type, contactName: editing.contactName || undefined, email: editing.email || undefined,
      phone: editing.phone || undefined, website: editing.website || undefined, currency: editing.currency || undefined,
      defaultLeadTimeDays: editing.defaultLeadTimeDays != null ? Number(editing.defaultLeadTimeDays) : undefined,
      supportsDropship: editing.supportsDropship ?? false, notes: editing.notes || undefined, active: editing.active ?? true,
    };
    const ok = await action.run(
      () => (editing.id ? stockApi.updateSupplier(org, editing.id, body) : stockApi.createSupplier(org, { ...body, code: (editing.code ?? '').trim(), name: body.name ?? '' })),
      'Supplier saved.',
    );
    if (ok) { setEditing(null); list.reload(); }
  }
  return (
    <div className="space-y-3">
      {canEdit ? <div><PrimaryButton onClick={() => setEditing({ type: 'distributor', currency: 'USD', defaultLeadTimeDays: 3, active: true })}>Add supplier</PrimaryButton></div> : null}
      <Notice error={list.error || action.error} message={action.message} />
      {list.data && !list.data.length ? <Empty title="No suppliers yet">Add the distributors, marketplaces or salvage yards you buy from.</Empty> : null}
      <ul className="grid gap-2 md:grid-cols-2">
        {(list.data ?? []).map((s) => (
          <li key={s.id} className={`${card} space-y-1`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{s.name} <span className="font-mono text-xs text-slate-500">{s.code}</span>{!s.active ? <span className="ml-1 text-xs text-slate-500">(inactive)</span> : null}</p>
              {canEdit ? <button type="button" className={btn} onClick={() => setEditing(s)}>Edit</button> : null}
            </div>
            <p className="text-xs text-slate-500">{s.type.replace(/_/g, ' ')} · {s.currency} · {s.defaultLeadTimeDays} day lead{s.supportsDropship ? ' · dropships' : ''}</p>
            <p className="text-xs text-slate-500">{s.skuCount ?? 0} SKUs · {s.openRequests ?? 0} open requests · {s.openPurchaseOrders ?? 0} open POs</p>
            {s.email || s.phone ? <p className="text-xs">{[s.contactName, s.email, s.phone].filter(Boolean).join(' · ')}</p> : null}
          </li>
        ))}
      </ul>
      {editing ? (
        <Drawer title={editing.id ? `Edit ${editing.name}` : 'Add supplier'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            {!editing.id ? <label className="text-sm">Code<input className={field} required maxLength={40} value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.replace(/[^A-Za-z0-9_.-]/g, '').toUpperCase() })} placeholder="NAPA" /></label> : null}
            <label className="text-sm">Name<input className={field} required maxLength={160} value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="text-sm">Type
              <select className={field} value={editing.type ?? 'distributor'} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                {['distributor', 'manufacturer', 'marketplace', 'salvage_yard', 'individual', 'other'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="text-sm">Currency<input className={field} maxLength={3} value={editing.currency ?? 'USD'} onChange={(e) => setEditing({ ...editing, currency: e.target.value.toUpperCase() })} /></label>
            <label className="text-sm">Default lead time (days)<input className={field} type="number" min={0} max={365} value={editing.defaultLeadTimeDays ?? 3} onChange={(e) => setEditing({ ...editing, defaultLeadTimeDays: Number(e.target.value) })} /></label>
            <label className="text-sm">Contact<input className={field} value={editing.contactName ?? ''} onChange={(e) => setEditing({ ...editing, contactName: e.target.value })} /></label>
            <label className="text-sm">Email<input className={field} type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label>
            <label className="text-sm">Phone<input className={field} value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label>
            <label className="text-sm">Website<input className={field} value={editing.website ?? ''} onChange={(e) => setEditing({ ...editing, website: e.target.value })} /></label>
            <label className="text-sm sm:col-span-2">Notes<textarea className={field} rows={2} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.supportsDropship ?? false} onChange={(e) => setEditing({ ...editing, supportsDropship: e.target.checked })} /> Can dropship to buyers</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
            <div className="sm:col-span-2"><PrimaryButton type="submit" disabled={action.busy}>Save</PrimaryButton></div>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}

/* ── Reorder ──────────────────────────────────────────────────────── */

function Reorder() {
  const { org, can } = useStock();
  const list = useLoad((s) => stockApi.reorder(org, s), [org]);
  const action = useAction();
  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
        <p className="text-sm text-slate-600 dark:text-slate-300">SKUs whose available + inbound + already-requested quantity is at or below their reorder point. Set reorder points in each SKU’s stock settings.</p>
        {can('stock.procure') && list.data?.suggestions.length ? (
          <PrimaryButton disabled={action.busy} onClick={() => void action.run(() => stockApi.createReorderRequests(org), (r) => `Created ${r.created} replenishment request(s).`).then(() => list.reload())}>Create requests</PrimaryButton>
        ) : null}
      </div>
      <Notice error={list.error || action.error} message={action.message} />
      {list.data && !list.data.suggestions.length ? <Empty title="Nothing to reorder" /> : null}
      {list.data?.suggestions.length ? (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-800"><tr><th className={th}>SKU</th><th className={`${th} text-right`}>Available</th><th className={`${th} text-right`}>Inbound</th><th className={`${th} text-right`}>Requested</th><th className={`${th} text-right`}>Reorder at</th><th className={`${th} text-right`}>Suggest</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.suggestions.map((s) => (
                <tr key={s.id}><td className={td}><span className="font-mono">{s.sku}</span> <span className="text-xs text-slate-500">{s.title}</span></td><td className={`${td} text-right`}>{s.available}</td><td className={`${td} text-right`}>{s.inbound}</td><td className={`${td} text-right`}>{s.openRequests}</td><td className={`${td} text-right`}>{s.reorderPoint}</td><td className={`${td} text-right font-semibold`}>{s.suggestedQty}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
