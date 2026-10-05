import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import {
  SOURCING_LABEL,
  stockApi,
  type ItemSource,
  type SourcingMode,
  type StockItemDetail,
  type Supplier,
  type TrackingMode,
} from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import {
  Badge,
  btn,
  Drawer,
  field,
  fmtDate,
  fmtMoney,
  newIdempotencyKey,
  Notice,
  PrimaryButton,
  Section,
  signed,
  StatusBadge,
  useAction,
  useLoad,
} from './stockUi';

type Op = 'receive' | 'adjust' | 'move' | 'damage';
const REASONS: Array<[string, string]> = [
  ['correction', 'Correction'],
  ['found', 'Found'],
  ['lost', 'Lost'],
  ['damaged', 'Damaged beyond sale'],
  ['theft', 'Theft'],
  ['write_off', 'Write-off'],
  ['return_to_supplier', 'Returned to supplier'],
  ['sample', 'Sample / internal use'],
  ['other', 'Other'],
];

export function useLocations(warehouseId: string) {
  const { org } = useStock();
  return useLoad((signal) => (warehouseId ? stockApi.locations(org, warehouseId, false, signal) : Promise.resolve([])), [org, warehouseId]);
}

export default function StockItemDrawer({ itemId, onClose, onChanged }: { itemId: string; onClose: () => void; onChanged?: () => void }) {
  const { org, can } = useStock();
  const detail = useLoad((signal) => stockApi.item(org, itemId, signal), [org, itemId]);
  const refresh = () => { detail.reload(); onChanged?.(); };
  const d = detail.data;

  return (
    <Drawer
      wide
      onClose={onClose}
      title={d ? <span className="font-mono">{d.item.sku}</span> : 'Loading…'}
      subtitle={d?.item.title ?? undefined}
    >
      {detail.error ? <Notice error={detail.error} /> : null}
      {d ? (
        <div className="space-y-4">
          <Header d={d} />
          {can('stock.receive') || can('stock.adjust') || can('stock.move') ? <Operations d={d} onDone={refresh} /> : null}
          <Levels d={d} />
          <Sources itemId={itemId} canEdit={can('stock.procure')} onChanged={refresh} />
          {d.reservations.length || d.procurement.length ? <Demand d={d} /> : null}
          <Channels d={d} />
          {d.units.length ? <Units d={d} /> : null}
          {can('stock.receive') ? <Settings d={d} onSaved={refresh} /> : null}
          <Movements d={d} />
        </div>
      ) : detail.loading ? <p role="status" className="text-sm text-slate-500">Loading…</p> : null}
    </Drawer>
  );
}

function Header({ d }: { d: StockItemDetail }) {
  const totals = d.levels.reduce(
    (a, l) => ({ onHand: a.onHand + l.onHand, reserved: a.reserved + l.reserved, available: a.available + l.available, inbound: a.inbound + l.inbound, damaged: a.damaged + l.damaged }),
    { onHand: 0, reserved: 0, available: 0, inbound: 0, damaged: 0 },
  );
  const link = d.links.catalogProduct ?? d.links.listingRecord;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      {d.item.imageUrl ? <img src={d.item.imageUrl} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover dark:border-slate-700" /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="violet">{SOURCING_LABEL[d.item.sourcingMode]}</Badge>
          <Badge>{d.item.trackingMode === 'quantity' ? 'Tracked by quantity' : d.item.trackingMode === 'serial' ? 'Serialized' : 'One-off units'}</Badge>
          {d.item.status !== 'active' ? <StatusBadge status={d.item.status} /> : null}
          {link ? <Badge tone="blue">Linked to {d.links.catalogProduct ? 'catalog product' : 'listing'}</Badge> : <Badge tone="amber">Not linked to a product</Badge>}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          {([['On hand', totals.onHand], ['Reserved', totals.reserved], ['Available', totals.available], ['Inbound', totals.inbound], ['Damaged', totals.damaged]] as const).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white p-2 dark:bg-slate-900">
              <dt className="text-[11px] uppercase text-slate-500">{label}</dt>
              <dd className="text-lg font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Operations({ d, onDone }: { d: StockItemDetail; onDone: () => void }) {
  const { org, can, warehouses } = useStock();
  const available: Op[] = ([
    can('stock.receive') ? 'receive' : null,
    can('stock.adjust') ? 'adjust' : null,
    can('stock.move') ? 'move' : null,
    can('stock.adjust') ? 'damage' : null,
  ] as Array<Op | null>).filter(Boolean) as Op[];
  const [op, setOp] = useState<Op>(available[0] ?? 'receive');
  const defaultWh = warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? '';
  const [warehouseId, setWarehouseId] = useState(defaultWh);
  const [locationId, setLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [serials, setSerials] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [reason, setReason] = useState('correction');
  const [note, setNote] = useState('');
  const locations = useLocations(warehouseId);
  const action = useAction();
  const [key, setKey] = useState(newIdempotencyKey);
  useEffect(() => { setLocationId(''); setToLocationId(''); }, [warehouseId]);

  const n = Number(qty);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!warehouseId || !Number.isInteger(n) || n === 0) return;
    const res = await action.run(async () => {
      if (op === 'receive') {
        return stockApi.receive(org, {
          itemId: d.item.id, warehouseId, locationId: locationId || undefined, quantity: n,
          unitCost: unitCost ? Number(unitCost) : undefined,
          serials: serials.trim() ? serials.split(/[\s,]+/).filter(Boolean) : undefined,
          lotCode: lotCode.trim() || undefined, note: note.trim() || undefined, idempotencyKey: key,
        });
      }
      if (op === 'adjust') return stockApi.adjust(org, { itemId: d.item.id, warehouseId, locationId: locationId || undefined, quantity: n, reasonCode: reason, note: note.trim() || undefined, idempotencyKey: key });
      if (op === 'move') return stockApi.move(org, { itemId: d.item.id, warehouseId, fromLocationId: locationId || null, toLocationId: toLocationId || null, quantity: n });
      return stockApi.damage(org, { itemId: d.item.id, warehouseId, locationId: locationId || undefined, quantity: n, note: note.trim() || undefined });
    }, (r) => {
      const status = (r as { status?: string; message?: string } | undefined);
      return status?.status === 'pending_approval' ? status.message ?? 'Sent for approval.' : 'Saved.';
    });
    if (res !== undefined) { setKey(newIdempotencyKey()); setNote(''); setSerials(''); onDone(); }
  }

  const binOptions = (locations.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.code}{l.type !== 'storage' ? ` (${l.type})` : ''}</option>);
  return (
    <Section title="Update stock">
      <div role="tablist" className="flex flex-wrap gap-1">
        {available.map((o) => (
          <button key={o} type="button" role="tab" aria-selected={op === o} onClick={() => { setOp(o); action.setError(''); action.setMessage(''); }}
            className={`rounded-full px-3 py-1 text-sm ${op === o ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
            {o === 'receive' ? 'Receive' : o === 'adjust' ? 'Adjust' : o === 'move' ? 'Move bin' : 'Damage'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Warehouse
          <select className={field} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
        </label>
        <label className="text-sm">{op === 'move' ? 'From bin' : 'Bin'}
          <select className={field} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Unassigned</option>{binOptions}
          </select>
        </label>
        {op === 'move' ? (
          <label className="text-sm">To bin
            <select className={field} value={toLocationId} onChange={(e) => setToLocationId(e.target.value)}>
              <option value="">Unassigned</option>{binOptions}
            </select>
          </label>
        ) : null}
        <label className="text-sm">{op === 'adjust' ? 'Change (+/−)' : op === 'damage' ? 'Units damaged (− to restore)' : 'Quantity'}
          <input className={field} type="number" inputMode="numeric" step={1} min={op === 'adjust' || op === 'damage' ? undefined : 1} value={qty} onChange={(e) => setQty(e.target.value)} required />
        </label>
        {op === 'receive' ? (
          <>
            <label className="text-sm">Unit cost (optional)<input className={field} type="number" min={0} step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></label>
            {d.item.trackingMode === 'serial' ? (
              <label className="text-sm sm:col-span-2">Serial numbers (one per line or comma separated)
                <textarea className={field} rows={3} value={serials} onChange={(e) => setSerials(e.target.value)} required />
              </label>
            ) : null}
            {d.item.trackingMode !== 'quantity' ? (
              <label className="text-sm">Lot / donor VIN (optional)<input className={field} maxLength={80} value={lotCode} onChange={(e) => setLotCode(e.target.value)} /></label>
            ) : null}
          </>
        ) : null}
        {op === 'adjust' ? (
          <label className="text-sm">Reason
            <select className={field} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        ) : null}
        {op !== 'move' ? <label className="text-sm sm:col-span-2">Note<input className={field} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label> : null}
        <div className="sm:col-span-2"><PrimaryButton type="submit" disabled={action.busy || !warehouseId}>{action.busy ? 'Saving…' : 'Save'}</PrimaryButton></div>
      </form>
      <Notice error={action.error} message={action.message} />
    </Section>
  );
}

function Levels({ d }: { d: StockItemDetail }) {
  return (
    <Section title="Where it is">
      {d.levels.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Warehouse / bin</th><th className="py-1 text-right">On hand</th><th className="py-1 text-right">Reserved</th><th className="py-1 text-right">Available</th><th className="py-1 text-right">Inbound</th></tr></thead>
            <tbody>
              {d.levels.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5"><span className="font-mono font-semibold">{l.warehouseCode}</span>{l.locationCode ? <span className="font-mono"> / {l.locationCode}</span> : <span className="text-slate-500"> / unassigned</span>}{!l.isSellable ? <span className="ml-1 text-xs text-amber-600">not sellable</span> : null}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.onHand}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.reserved || '—'}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{l.available}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.inbound || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-500">Not held in any warehouse.{d.item.sourcingMode !== 'stocked' ? ' It is acquired from a supplier when it sells.' : ''}</p>}
    </Section>
  );
}

function Sources({ itemId, canEdit, onChanged }: { itemId: string; canEdit: boolean; onChanged: () => void }) {
  const { org } = useStock();
  const sources = useLoad((s) => stockApi.sources(org, itemId, s), [org, itemId]);
  const suppliers = useLoad((s) => (canEdit ? stockApi.suppliers(org, false, s) : Promise.resolve([] as Supplier[])), [org, canEdit]);
  const [editing, setEditing] = useState<Partial<ItemSource> | null>(null);
  const action = useAction();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing?.supplierId) return;
    const ok = await action.run(() => stockApi.upsertSource(org, itemId, {
      supplierId: editing.supplierId!,
      supplierSku: editing.supplierSku ?? undefined,
      unitCost: editing.unitCost ? Number(editing.unitCost) : undefined,
      availableQty: editing.availableQty === undefined || editing.availableQty === null || String(editing.availableQty) === '' ? null : Number(editing.availableQty),
      leadTimeDays: editing.leadTimeDays != null && String(editing.leadTimeDays) !== '' ? Number(editing.leadTimeDays) : undefined,
      priority: editing.priority != null ? Number(editing.priority) : undefined,
      fulfillmentMode: editing.fulfillmentMode,
      url: editing.url ?? undefined,
      active: editing.active ?? true,
    }), 'Supplier offer saved.');
    if (ok !== undefined) { setEditing(null); sources.reload(); onChanged(); }
  }
  async function remove(id: string) {
    if (!window.confirm('Remove this supplier offer?')) return;
    const ok = await action.run(() => stockApi.removeSource(org, itemId, id), 'Removed.');
    if (ok !== undefined) { sources.reload(); onChanged(); }
  }

  return (
    <Section
      title="Where to acquire it"
      actions={canEdit ? <button type="button" className={btn} onClick={() => setEditing({ fulfillmentMode: 'ship_to_warehouse', priority: 100, active: true })}>Add supplier offer</button> : null}
    >
      <p className="text-xs text-slate-500">When an order cannot be filled from stock, the best active offer (in stock at the supplier, then priority, then cost) is used for the procurement request. For on-demand and stock + source SKUs, supplier availability (capped per store) is added to channel quantity.</p>
      {sources.data?.length ? (
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {sources.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-medium">{s.supplierName} {s.supplierSku ? <span className="font-mono text-xs text-slate-500">#{s.supplierSku}</span> : null}{!s.active || !s.supplierActive ? <span className="ml-1 text-xs text-slate-500">(inactive)</span> : null}</p>
                <p className="text-xs text-slate-500">
                  {fmtMoney(s.unitCost, s.currency)} · {s.availableQty == null ? 'availability unknown' : `${s.availableQty} available`} · {s.leadTimeDays ?? '?'} day lead · {s.fulfillmentMode === 'dropship' ? 'dropships to buyer' : 'ships to our warehouse'} · priority {s.priority}
                </p>
              </div>
              <div className="flex gap-1">
                {s.url ? <a className={btn} href={s.url} target="_blank" rel="noreferrer" aria-label="Open supplier page"><ExternalLink className="h-4 w-4" /></a> : null}
                {canEdit ? <button type="button" className={btn} onClick={() => setEditing(s)}>Edit</button> : null}
                {canEdit ? <button type="button" className={btn} onClick={() => void remove(s.id)} aria-label="Remove"><Trash2 className="h-4 w-4" /></button> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">{sources.loading ? 'Loading…' : 'No supplier offers yet.'}</p>}
      {editing ? (
        <form onSubmit={save} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-950">
          <label className="text-sm sm:col-span-2">Supplier
            <select className={field} required value={editing.supplierId ?? ''} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, supplierId: e.target.value })}>
              <option value="">Choose…</option>
              {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
            {suppliers.data && !suppliers.data.length ? <span className="text-xs text-amber-700">Add suppliers under Procurement first.</span> : null}
          </label>
          <label className="text-sm">Supplier SKU<input className={field} value={editing.supplierSku ?? ''} onChange={(e) => setEditing({ ...editing, supplierSku: e.target.value })} /></label>
          <label className="text-sm">Unit cost<input className={field} type="number" min={0} step="0.01" value={editing.unitCost ?? ''} onChange={(e) => setEditing({ ...editing, unitCost: e.target.value })} /></label>
          <label className="text-sm">Available at supplier<input className={field} type="number" min={0} placeholder="Unknown" value={editing.availableQty ?? ''} onChange={(e) => setEditing({ ...editing, availableQty: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label className="text-sm">Lead time (days)<input className={field} type="number" min={0} max={365} value={editing.leadTimeDays ?? ''} onChange={(e) => setEditing({ ...editing, leadTimeDays: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label className="text-sm">Fulfilment
            <select className={field} value={editing.fulfillmentMode} onChange={(e) => setEditing({ ...editing, fulfillmentMode: e.target.value as ItemSource['fulfillmentMode'] })}>
              <option value="ship_to_warehouse">Supplier ships to our warehouse</option>
              <option value="dropship">Supplier dropships to the buyer</option>
            </select>
          </label>
          <label className="text-sm">Priority (lower first)<input className={field} type="number" min={0} value={editing.priority ?? 100} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })} /></label>
          <label className="text-sm sm:col-span-2">Supplier page URL<input className={field} type="url" value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active</label>
          <div className="flex gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={action.busy}>Save offer</PrimaryButton>
            <button type="button" className={btn} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      ) : null}
      <Notice error={action.error} message={action.message} />
    </Section>
  );
}

function Demand({ d }: { d: StockItemDetail }) {
  return (
    <Section title="Committed to orders">
      <ul className="space-y-1 text-sm">
        {d.reservations.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2"><StatusBadge status={r.status} /> {r.quantity} × order <span className="font-mono">{r.externalOrderId ?? r.orderId?.slice(0, 8)}</span> from <span className="font-mono">{r.warehouseCode}{r.locationCode ? `/${r.locationCode}` : ''}</span></li>
        ))}
        {d.procurement.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} label={p.status === 'open' ? 'to buy' : undefined} /> {p.quantity - p.receivedQty} from {p.supplierName ?? 'supplier not chosen'}{p.purchaseOrderNumber ? <> on <span className="font-mono">{p.purchaseOrderNumber}</span></> : null}{p.externalOrderId ? <> for order <span className="font-mono">{p.externalOrderId}</span></> : null}{p.fulfillmentMode === 'dropship' ? <Badge tone="violet">dropship</Badge> : null}</li>
        ))}
      </ul>
    </Section>
  );
}

function Channels({ d }: { d: StockItemDetail }) {
  if (!d.channels.length) return null;
  return (
    <Section title="Quantity on sales channels">
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {d.channels.map((c) => (
          <li key={c.storeId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span>{c.storeName} <span className="text-xs text-slate-500">{c.channel}</span></span>
            <span className="flex items-center gap-2 text-xs">
              <span>stock says <strong className="tabular-nums">{c.desiredQty ?? '—'}</strong></span>
              <span>channel shows <strong className={`tabular-nums ${c.channelQty != null && c.desiredQty != null && c.channelQty !== c.desiredQty ? 'text-amber-600' : ''}`}>{c.channelQty ?? '—'}</strong></span>
              <StatusBadge status={c.status} label={c.status === 'no_target' ? 'not listed' : undefined} />
            </span>
            {c.lastError ? <p className="w-full text-xs text-red-600">{c.lastError}</p> : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Units({ d }: { d: StockItemDetail }) {
  return (
    <Section title={`Units (${d.units.length})`}>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Serial / lot</th><th className="py-1">Status</th><th className="py-1">Location</th><th className="py-1">Received</th></tr></thead>
          <tbody>
            {d.units.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 font-mono text-xs">{u.serialPrivate ?? u.serialPublic ?? u.lotCode ?? u.id.slice(0, 8)}</td>
                <td className="py-1"><StatusBadge status={u.status} /></td>
                <td className="py-1 font-mono text-xs">{u.warehouseCode ? `${u.warehouseCode}${u.locationCode ? `/${u.locationCode}` : ''}` : '—'}</td>
                <td className="py-1 text-xs">{fmtDate(u.receivedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Settings({ d, onSaved }: { d: StockItemDetail; onSaved: () => void }) {
  const { org } = useStock();
  const [form, setForm] = useState({
    sourcingMode: d.item.sourcingMode as SourcingMode,
    trackingMode: d.item.trackingMode as TrackingMode,
    lowStockThreshold: String(d.item.lowStockThreshold),
    reorderPoint: String(d.item.reorderPoint),
    reorderQty: String(d.item.reorderQty),
    barcode: d.item.barcode ?? '',
    status: d.item.status,
  });
  const action = useAction();
  async function save(e: FormEvent) {
    e.preventDefault();
    const ok = await action.run(() => stockApi.updateItem(org, d.item.id, {
      sourcingMode: form.sourcingMode,
      trackingMode: form.trackingMode,
      lowStockThreshold: Number(form.lowStockThreshold),
      reorderPoint: Number(form.reorderPoint),
      reorderQty: Number(form.reorderQty),
      barcode: form.barcode.trim() || null,
      status: form.status,
    }), 'Settings saved.');
    if (ok !== undefined) onSaved();
  }
  return (
    <Section title="Stock settings">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-3">Sourcing
          <select className={field} value={form.sourcingMode} onChange={(e) => setForm({ ...form, sourcingMode: e.target.value as SourcingMode })}>
            <option value="stocked">Stocked — sell only what is on hand</option>
            <option value="hybrid">Stock + source — use stock first, then buy from a supplier</option>
            <option value="on_demand">On demand — always buy from a supplier after a sale</option>
          </select>
        </label>
        <label className="text-sm">Tracking
          <select className={field} value={form.trackingMode} onChange={(e) => setForm({ ...form, trackingMode: e.target.value as TrackingMode })}>
            <option value="quantity">Quantity</option><option value="one_off">One-off units</option><option value="serial">Serial numbers</option>
          </select>
        </label>
        <label className="text-sm">Low-stock alert at<input className={field} type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} /></label>
        <label className="text-sm">Status
          <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option><option value="discontinued">Discontinued</option><option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm">Reorder point<input className={field} type="number" min={0} value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} /></label>
        <label className="text-sm">Reorder quantity<input className={field} type="number" min={0} value={form.reorderQty} onChange={(e) => setForm({ ...form, reorderQty: e.target.value })} /></label>
        <label className="text-sm">Barcode<input className={field} maxLength={80} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></label>
        <div className="sm:col-span-3"><PrimaryButton type="submit" disabled={action.busy}>Save settings</PrimaryButton></div>
      </form>
      <Notice error={action.error} message={action.message} />
    </Section>
  );
}

function Movements({ d }: { d: StockItemDetail }) {
  return (
    <Section title="History">
      {d.movements.length ? (
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto text-sm dark:divide-slate-800">
          {d.movements.map((m) => (
            <li key={m.id} className="py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2"><StatusBadge status={m.type} /> <span className="font-mono text-xs">{m.warehouseCode}{m.locationCode ? `/${m.locationCode}` : ''}</span></span>
                <span className="text-xs text-slate-500">{fmtDate(m.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {m.qtyOnHand ? `on hand ${signed(m.qtyOnHand)} → ${m.onHandAfter}` : ''}
                {m.qtyReserved ? ` · reserved ${signed(m.qtyReserved)}` : ''}
                {m.qtyInbound ? ` · inbound ${signed(m.qtyInbound)}` : ''}
                {m.qtyDamaged ? ` · damaged ${signed(m.qtyDamaged)}` : ''}
                {m.documentNumber ? ` · ${m.documentNumber}` : ''}
                {m.reasonCode ? ` · ${m.reasonCode.replace(/_/g, ' ')}` : ''}
                {m.actorEmail ? ` · ${m.actorEmail}` : ''}
              </p>
              {m.note ? <p className="text-xs text-slate-500">{m.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">No movements yet.</p>}
    </Section>
  );
}

