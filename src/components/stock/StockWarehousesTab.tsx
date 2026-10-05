import { useEffect, useState, type FormEvent } from 'react';
import { Printer } from 'lucide-react';
import { stockApi, type StoreStock, type Warehouse } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import { useLocations } from './StockItemDrawer';
import { Badge, btn, card, Drawer, Empty, field, fmtDate, Notice, PrimaryButton, Section, StatusBadge, td, th, useAction, useLoad } from './stockUi';

export default function StockWarehousesTab() {
  const { org, can, warehouses, reloadWarehouses } = useStock();
  const all = useLoad((s) => stockApi.warehouses(org, true, s), [org]);
  const [editing, setEditing] = useState<Partial<Warehouse> | null>(null);
  const [binsFor, setBinsFor] = useState<Warehouse | null>(null);
  const canManage = can('stock.warehouses.manage');
  const refresh = () => { all.reload(); reloadWarehouses(); };

  return (
    <div className="space-y-4">
      <Section title="Warehouses" actions={canManage ? <PrimaryButton onClick={() => setEditing({ type: 'owned', isSellable: true, active: true })}>Add warehouse</PrimaryButton> : null}>
        <Notice error={all.error} />
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(all.data ?? warehouses).map((w) => (
            <li key={w.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold"><span className="font-mono">{w.code}</span> <span className="font-normal text-slate-500">{w.name}</span></p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {w.isDefault ? <Badge tone="blue">default</Badge> : null}
                    {!w.isSellable ? <Badge tone="amber">not sellable</Badge> : null}
                    {!w.active ? <Badge>inactive</Badge> : null}
                    {w.type !== 'owned' ? <Badge>{w.type}</Badge> : null}
                    {w.countryCode ? <Badge>{w.countryCode}</Badge> : null}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" className={btn} onClick={() => setBinsFor(w)}>Bins ({w.locationCount ?? 0})</button>
                  {canManage ? <button type="button" className={btn} onClick={() => setEditing(w)}>Edit</button> : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{w.onHand ?? 0} on hand · {w.available ?? 0} available · {w.inbound ?? 0} inbound · {w.skuCount ?? 0} SKUs</p>
              {w.ebayMerchantLocationKey ? <p className="text-xs text-slate-500">eBay location <span className="font-mono">{w.ebayMerchantLocationKey}</span></p> : null}
            </li>
          ))}
        </ul>
      </Section>

      <Stores />
      <ChannelSync />

      {editing ? <WarehouseForm value={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} /> : null}
      {binsFor ? <BinsDrawer warehouse={binsFor} canManage={canManage} onClose={() => { setBinsFor(null); refresh(); }} /> : null}
    </div>
  );
}

function WarehouseForm({ value, onClose, onSaved }: { value: Partial<Warehouse>; onClose: () => void; onSaved: () => void }) {
  const { org } = useStock();
  const [w, setW] = useState(value);
  const action = useAction();
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      name: w.name, type: w.type, countryCode: w.countryCode ?? undefined, ebayMerchantLocationKey: w.ebayMerchantLocationKey ?? undefined,
      isDefault: w.isDefault, isSellable: w.isSellable, active: w.active,
    };
    const ok = await action.run(() => (w.id ? stockApi.updateWarehouse(org, w.id, body) : stockApi.createWarehouse(org, { ...body, code: w.code ?? '', name: w.name ?? '' })));
    if (ok) onSaved();
  }
  return (
    <Drawer title={value.id ? `Edit ${value.code}` : 'Add warehouse'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {!value.id ? <label className="text-sm">Code<input className={field} required maxLength={40} value={w.code ?? ''} onChange={(e) => setW({ ...w, code: e.target.value.replace(/[^A-Za-z0-9_.-]/g, '').toUpperCase() })} placeholder="UK_LU7" /></label> : null}
        <label className="text-sm">Name<input className={field} required maxLength={120} value={w.name ?? ''} onChange={(e) => setW({ ...w, name: e.target.value })} /></label>
        <label className="text-sm">Type
          <select className={field} value={w.type ?? 'owned'} onChange={(e) => setW({ ...w, type: e.target.value as Warehouse['type'] })}>
            <option value="owned">Own warehouse</option><option value="3pl">3PL / fulfilment partner</option><option value="virtual">Virtual (returns, quarantine)</option>
          </select>
        </label>
        <label className="text-sm">Country (ISO 2)<input className={field} maxLength={2} value={w.countryCode ?? ''} onChange={(e) => setW({ ...w, countryCode: e.target.value.toUpperCase() })} /></label>
        <label className="text-sm sm:col-span-2">eBay merchant location key
          <input className={field} maxLength={36} value={w.ebayMerchantLocationKey ?? ''} onChange={(e) => setW({ ...w, ebayMerchantLocationKey: e.target.value })} placeholder="AE_Dubai" />
          <span className="text-xs text-slate-500">The eBay inventory location this warehouse ships from.</span>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={w.isSellable ?? true} onChange={(e) => setW({ ...w, isSellable: e.target.checked })} /> Stock here can be sold</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={w.isDefault ?? false} disabled={value.isDefault} onChange={(e) => setW({ ...w, isDefault: e.target.checked })} /> Default warehouse</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={w.active ?? true} disabled={value.isDefault} onChange={(e) => setW({ ...w, active: e.target.checked })} /> Active</label>
        <div className="sm:col-span-2"><Notice error={action.error} /></div>
        <div className="sm:col-span-2"><PrimaryButton type="submit" disabled={action.busy}>Save</PrimaryButton></div>
      </form>
    </Drawer>
  );
}

function BinsDrawer({ warehouse, canManage, onClose }: { warehouse: Warehouse; canManage: boolean; onClose: () => void }) {
  const { org } = useStock();
  const locations = useLocations(warehouse.id);
  const [code, setCode] = useState('');
  const [type, setType] = useState('storage');
  const [grid, setGrid] = useState({ aisles: 'A,B,C', racks: '5', shelves: '4', prefix: '' });
  const action = useAction();
  async function add(e: FormEvent) {
    e.preventDefault();
    const ok = await action.run(() => stockApi.createLocation(org, warehouse.id, { code, type: type as never }), 'Bin added.');
    if (ok) { setCode(''); locations.reload(); }
  }
  async function generate(e: FormEvent) {
    e.preventDefault();
    const ok = await action.run(() => stockApi.generateLocations(org, warehouse.id, {
      aisles: grid.aisles.split(/[\s,]+/).filter(Boolean), racks: Number(grid.racks), shelves: Number(grid.shelves), prefix: grid.prefix || undefined,
    }), (r) => `Created ${r.created} of ${r.requested} bins (existing codes skipped).`);
    if (ok) locations.reload();
  }
  async function toggle(id: string, active: boolean) {
    const ok = await action.run(() => stockApi.updateLocation(org, id, { active }), active ? 'Bin reactivated.' : 'Bin deactivated.');
    if (ok) locations.reload();
  }
  function printLabels() {
    const codes = (locations.data ?? []).filter((l) => l.active).map((l) => l.code);
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><title>${warehouse.code} bin labels</title><style>body{font-family:system-ui;margin:12mm}div{display:inline-block;width:60mm;height:25mm;border:1px dashed #999;margin:2mm;text-align:center;vertical-align:top}b{display:block;font:700 22pt ui-monospace,monospace;margin-top:4mm}span{font-size:9pt;color:#555}</style>${codes.map((c) => `<div><b>${c.replace(/[<>&]/g, '')}</b><span>${warehouse.code.replace(/[<>&]/g, '')}</span></div>`).join('')}<script>print()</script>`);
    w.document.close();
  }

  return (
    <Drawer wide title={`Bins in ${warehouse.code}`} subtitle={warehouse.name} onClose={onClose}>
      <div className="space-y-4">
        <Notice error={locations.error || action.error} message={action.message} />
        {canManage ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <form onSubmit={add} className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold">Add a bin</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Code<input className={field} required value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9_.-]/g, '').toUpperCase())} placeholder="A-01-1" /></label>
                <label className="text-xs">Type
                  <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
                    {['storage', 'receiving', 'staging', 'returns', 'quarantine'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <button type="submit" className={btn} disabled={action.busy || !code}>Add bin</button>
            </form>
            <form onSubmit={generate} className={`${card} space-y-2`}>
              <h3 className="text-sm font-semibold">Generate a grid</h3>
              <div className="grid grid-cols-4 gap-2">
                <label className="col-span-2 text-xs">Aisles<input className={field} value={grid.aisles} onChange={(e) => setGrid({ ...grid, aisles: e.target.value.toUpperCase() })} /></label>
                <label className="text-xs">Racks<input className={field} type="number" min={1} max={99} value={grid.racks} onChange={(e) => setGrid({ ...grid, racks: e.target.value })} /></label>
                <label className="text-xs">Shelves<input className={field} type="number" min={1} max={20} value={grid.shelves} onChange={(e) => setGrid({ ...grid, shelves: e.target.value })} /></label>
              </div>
              <p className="text-xs text-slate-500">Creates codes like {grid.prefix}{grid.aisles.split(/[\s,]+/)[0] || 'A'}-01-1.</p>
              <button type="submit" className={btn} disabled={action.busy}>Generate</button>
            </form>
          </div>
        ) : null}
        <div className="flex justify-end"><button type="button" className={btn} onClick={printLabels}><Printer className="h-4 w-4" aria-hidden /> Print labels</button></div>
        {locations.data && !locations.data.length ? <Empty title="No bins yet">Stock can still be held as “unassigned” in this warehouse.</Empty> : null}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {(locations.data ?? []).map((l) => (
            <li key={l.id} className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-800">
              <p className="font-mono font-semibold">{l.code}</p>
              <p className="text-xs text-slate-500">{l.type}{!l.isPickable ? ' · not pickable' : ''} · {l.onHand} units · {l.skuCount} SKUs</p>
              {canManage ? <button type="button" className="mt-1 text-xs text-slate-500 underline" onClick={() => void toggle(l.id, false)}>Deactivate</button> : null}
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  );
}

function Stores() {
  const { org, can, warehouses } = useStock();
  const stores = useLoad((s) => stockApi.stores(org, s), [org]);
  const [editing, setEditing] = useState<StoreStock | null>(null);
  return (
    <Section title="Sales channels">
      <p className="text-xs text-slate-500">
        Each store sells from the warehouses linked to it. Its quantity = available stock in those warehouses − buffer, plus (for on-demand and stock + source SKUs)
        what suppliers report available, capped. Stores stay in <strong>shadow mode</strong> until pushing is switched on, so you can compare first.
      </p>
      <Notice error={stores.error} />
      {stores.data && !stores.data.length ? <Empty title="No stores connected to this workspace" /> : null}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {(stores.data ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.storeName} <span className="text-xs text-slate-500">{s.channel}</span></p>
              <p className="text-xs text-slate-500">
                {s.links.length ? `Sells from ${s.links.map((l) => l.code).join(', ')}` : 'Not linked to any warehouse — sells nothing from stock'}
                {` · buffer ${s.bufferQty}`}{s.maxQty != null ? ` · max ${s.maxQty}` : ''}{s.includeSourceable ? ` · sourced up to ${s.maxSourceableQty}` : ' · no sourced quantity'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {s.pushEnabled ? <Badge tone="green">pushing</Badge> : <Badge tone="violet">shadow</Badge>}
              {s.syncCounts?.failed ? <Badge tone="red">{s.syncCounts.failed} failed</Badge> : null}
              {can('stock.warehouses.manage') || can('stock.channel_sync.manage') ? <button type="button" className={btn} onClick={() => setEditing(s)}>Configure</button> : null}
            </div>
          </li>
        ))}
      </ul>
      {editing ? <StoreDrawer store={editing} warehouses={warehouses} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); stores.reload(); }} /> : null}
    </Section>
  );
}

function StoreDrawer({ store, warehouses, onClose, onSaved }: { store: StoreStock; warehouses: Warehouse[]; onClose: () => void; onSaved: () => void }) {
  const { org, can } = useStock();
  const [links, setLinks] = useState(store.links.map((l) => ({ warehouseId: l.warehouseId, priority: l.priority })));
  const [policy, setPolicy] = useState({
    pushEnabled: store.pushEnabled, bufferQty: String(store.bufferQty), maxQty: store.maxQty == null ? '' : String(store.maxQty),
    includeSourceable: store.includeSourceable, maxSourceableQty: String(store.maxSourceableQty),
  });
  const action = useAction();
  const canLinks = can('stock.warehouses.manage');
  const canPolicy = can('stock.channel_sync.manage');
  async function save(e: FormEvent) {
    e.preventDefault();
    if (policy.pushEnabled && !store.pushEnabled && !window.confirm(`Start sending stock quantities to ${store.storeName}? Listings will be revised to match stock.`)) return;
    const ok = await action.run(async () => {
      if (canLinks) await stockApi.setStoreLinks(org, store.id, links);
      if (canPolicy) await stockApi.setStorePolicy(org, store.id, {
        pushEnabled: policy.pushEnabled, bufferQty: Number(policy.bufferQty), maxQty: policy.maxQty === '' ? null : Number(policy.maxQty),
        includeSourceable: policy.includeSourceable, maxSourceableQty: Number(policy.maxSourceableQty),
      });
      return true;
    });
    if (ok) onSaved();
  }
  return (
    <Drawer title={store.storeName} subtitle={`${store.channel} store`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={!canLinks} className="space-y-2">
          <legend className="text-sm font-semibold">Sells from (lower priority is used first for orders)</legend>
          {warehouses.map((w) => {
            const link = links.find((l) => l.warehouseId === w.id);
            return (
              <div key={w.id} className="flex items-center gap-3 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <input type="checkbox" checked={!!link} onChange={(e) => setLinks(e.target.checked ? [...links, { warehouseId: w.id, priority: (links.length + 1) * 10 }] : links.filter((l) => l.warehouseId !== w.id))} />
                  <span className="font-mono">{w.code}</span> <span className="text-slate-500">{w.name}</span>
                </label>
                {link ? <input className={`${field} mt-0 w-20`} type="number" min={0} aria-label={`Priority for ${w.code}`} value={link.priority} onChange={(e) => setLinks(links.map((l) => (l.warehouseId === w.id ? { ...l, priority: Number(e.target.value) } : l)))} /> : null}
              </div>
            );
          })}
        </fieldset>
        <fieldset disabled={!canPolicy} className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Quantity rules</legend>
          <label className="text-sm">Safety buffer<input className={field} type="number" min={0} value={policy.bufferQty} onChange={(e) => setPolicy({ ...policy, bufferQty: e.target.value })} /></label>
          <label className="text-sm">Never show more than<input className={field} type="number" min={0} placeholder="No cap" value={policy.maxQty} onChange={(e) => setPolicy({ ...policy, maxQty: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={policy.includeSourceable} onChange={(e) => setPolicy({ ...policy, includeSourceable: e.target.checked })} /> Add supplier quantity for SKUs bought to order</label>
          <label className="text-sm">Max sourced quantity<input className={field} type="number" min={0} value={policy.maxSourceableQty} onChange={(e) => setPolicy({ ...policy, maxSourceableQty: e.target.value })} /></label>
          <label className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm sm:col-span-2 dark:bg-amber-500/10">
            <input type="checkbox" checked={policy.pushEnabled} onChange={(e) => setPolicy({ ...policy, pushEnabled: e.target.checked })} />
            Push quantities to this store (requires the installation-wide <code>stock_channel_push</code> flag)
          </label>
        </fieldset>
        <Notice error={action.error} />
        <PrimaryButton type="submit" disabled={action.busy}>Save</PrimaryButton>
      </form>
    </Drawer>
  );
}

function ChannelSync() {
  const { org, can } = useStock();
  const [status, setStatus] = useState('');
  const [driftOnly, setDriftOnly] = useState(true);
  const list = useLoad((s) => stockApi.channelSync(org, { status: status || undefined, driftOnly, limit: 200 }, s), [org, status, driftOnly]);
  const action = useAction();
  useEffect(() => { if (status) setDriftOnly(false); }, [status]);
  return (
    <Section title="Channel quantity check"
      actions={can('stock.channel_sync.manage') ? <button type="button" className={btn} disabled={action.busy} onClick={() => void action.run(() => stockApi.resync(org), (r) => `Recalculated ${r.processed} SKU × store pairs (${r.pushed} pushed, ${r.failed} failed).`).then(() => list.reload())}>Recalculate now</button> : null}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm sm:w-48">Status
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any</option>{['shadow', 'synced', 'failed', 'pending', 'no_target'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={driftOnly} onChange={(e) => setDriftOnly(e.target.checked)} /> Only where the channel differs</label>
      </div>
      <Notice error={list.error || action.error} message={action.message} />
      {list.data && !list.data.items.length ? <p className="text-sm text-slate-500">{driftOnly ? 'Every channel quantity matches stock.' : 'No rows.'}</p> : null}
      {list.data?.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>SKU</th><th className={th}>Store</th><th className={`${th} text-right`}>Stock says</th><th className={`${th} text-right`}>Channel shows</th><th className={th}>Status</th><th className={th}>Updated</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.items.map((r) => (
                <tr key={`${r.storeId}-${r.itemId}`}>
                  <td className={td}><span className="font-mono">{r.sku}</span>{r.sourcingMode !== 'stocked' ? <Badge tone="violet">sourced</Badge> : null}</td>
                  <td className={td}>{r.storeName}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{r.desiredQty ?? '—'}</td>
                  <td className={`${td} text-right tabular-nums ${r.channelQty != null && r.desiredQty != null && r.channelQty !== r.desiredQty ? 'text-amber-600' : ''}`}>{r.channelQty ?? '—'}</td>
                  <td className={td}><StatusBadge status={r.status} label={r.status === 'no_target' ? 'not listed' : undefined} />{r.lastError ? <p className="max-w-xs text-xs text-red-600">{r.lastError}</p> : null}</td>
                  <td className={`${td} text-xs`}>{fmtDate(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Section>
  );
}
