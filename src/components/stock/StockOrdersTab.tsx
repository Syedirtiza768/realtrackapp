import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { STOCK_STATUS_LABEL, stockApi, type OrderException, type PickRow } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import { btn, card, Empty, field, fmtDate, Notice, PrimaryButton, StatusBadge, Thumb, useAction, useLoad } from './stockUi';

export default function StockOrdersTab() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'pick';
  const set = (v: string) => { const next = new URLSearchParams(params); next.set('view', v); setParams(next); };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" className={`${btn} ${view === 'pick' ? 'ring-2 ring-[color:var(--brand-primary,#2563eb)]' : ''}`} onClick={() => set('pick')}>Pick list</button>
        <button type="button" className={`${btn} ${view === 'exceptions' ? 'ring-2 ring-[color:var(--brand-primary,#2563eb)]' : ''}`} onClick={() => set('exceptions')}>Stock exceptions</button>
      </div>
      {view === 'exceptions' ? <Exceptions /> : <PickList />}
    </div>
  );
}

function PickList() {
  const { org, warehouses, can } = useStock();
  const [warehouseId, setWarehouseId] = useState('');
  const list = useLoad((s) => stockApi.pickList(org, warehouseId || undefined, s), [org, warehouseId]);
  const action = useAction();

  const groups = useMemo(() => {
    const byWh = new Map<string, Map<string, PickRow[]>>();
    for (const r of list.data ?? []) {
      const wh = byWh.get(r.warehouseCode) ?? new Map<string, PickRow[]>();
      wh.set(r.orderId, [...(wh.get(r.orderId) ?? []), r]);
      byWh.set(r.warehouseCode, wh);
    }
    return byWh;
  }, [list.data]);

  async function pick(orderId: string) {
    const r = await action.run(() => stockApi.pickOrder(org, orderId), (x) => `${x.picked} reservation(s) marked picked.`);
    if (r) list.reload();
  }

  return (
    <div className="space-y-3">
      <div className={`${card} flex flex-wrap items-end gap-2 print:hidden`}>
        <label className="text-sm sm:w-72">Warehouse
          <select className={field} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
        </label>
        <button type="button" className={btn} onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> Print</button>
        <p className="w-full text-xs text-slate-500">Stock is reserved automatically when an order is imported. Picking is optional bookkeeping; shipping the order (adding tracking) deducts the stock.</p>
      </div>
      <Notice error={list.error || action.error} message={action.message} />
      {list.loading && !list.data ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {list.data && !list.data.length ? <Empty title="Nothing to pick">Reserved order lines will appear here.</Empty> : null}
      {[...groups.entries()].map(([wh, orders]) => (
        <section key={wh} className={card}>
          <h3 className="mb-2 font-semibold">Warehouse <span className="font-mono">{wh}</span> · {orders.size} order(s)</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...orders.entries()].map(([orderId, rows]) => (
              <li key={orderId} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm"><span className="font-mono font-semibold">{rows[0].externalOrderId ?? orderId.slice(0, 8)}</span> · {rows[0].shippingName ?? rows[0].buyerUsername ?? 'buyer'} {rows[0].shippingCountry ? `(${rows[0].shippingCountry})` : ''} · {rows[0].storeName} · {fmtDate(rows[0].orderedAt)}</p>
                  {can('stock.fulfil') && rows.some((r) => r.status === 'active') ? (
                    <button type="button" className={`${btn} print:hidden`} disabled={action.busy} onClick={() => void pick(orderId)}>Mark picked</button>
                  ) : <StatusBadge status={rows.every((r) => r.status === 'picked') ? 'picked' : 'active'} label={rows.every((r) => r.status === 'picked') ? 'picked' : 'to pick'} />}
                </div>
                <ul className="mt-1 space-y-1">
                  {rows.map((r) => (
                    <li key={r.reservationId} className="flex items-center gap-3 text-sm">
                      <Thumb src={r.imageUrl} alt="" />
                      <span className="w-20 shrink-0 font-mono font-semibold">{r.locationCode ?? '—'}</span>
                      <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{r.quantity}×</span>
                      <span className="min-w-0 flex-1"><span className="font-mono">{r.sku}</span> <span className="text-slate-500">{r.title}</span>{r.units ? <span className="block text-xs text-slate-500">Units: {r.units}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Exceptions() {
  const { org, can, openTab } = useStock();
  const list = useLoad((s) => stockApi.orderExceptions(org, s), [org]);
  const action = useAction();
  const [linking, setLinking] = useState<OrderException | null>(null);

  async function retry(orderId: string) {
    const r = await action.run(() => stockApi.allocateOrder(org, orderId), 'Allocation re-run.');
    if (r !== undefined) list.reload();
  }
  async function source(row: OrderException) {
    if (!row.itemId) return;
    const r = await action.run(() => stockApi.createRequest(org, { itemId: row.itemId!, quantity: row.quantity, note: `For order ${row.externalOrderId ?? row.orderId}` }), 'Procurement request created — choose a supplier under Procurement.');
    if (r !== undefined) { await stockApi.allocateOrder(org, row.orderId).catch(() => undefined); list.reload(); }
  }

  return (
    <div className="space-y-3">
      <Notice error={list.error || action.error} message={action.message} />
      {list.loading && !list.data ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {list.data && !list.data.length ? <Empty title="No stock exceptions">Every open order line is reserved, picked, or being acquired.</Empty> : null}
      {list.data?.length ? (
        <ul className="space-y-2">
          {list.data.map((r) => (
            <li key={r.orderItemId} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className="text-sm"><StatusBadge status={r.stockStatus} label={STOCK_STATUS_LABEL[r.stockStatus]} /> <span className="font-mono font-semibold">{r.externalOrderId ?? r.orderId.slice(0, 8)}</span> · {r.storeName} · {fmtDate(r.orderedAt)}</p>
                <p className="mt-1 text-sm">{r.quantity} × <span className="font-mono">{r.sku ?? 'no SKU'}</span> <span className="text-slate-500">{r.title}</span></p>
                <p className="text-xs text-slate-500">
                  {r.stockStatus === 'unmatched' ? 'The order line’s SKU does not match any stock item. Link it to the right SKU.' :
                   r.stockStatus === 'backorder' ? 'Not enough stock and no supplier offer to buy it from. Source it, or receive stock and it will be reserved automatically.' :
                   'Waiting on a supplier. Track it under Procurement.'}
                </p>
              </div>
              {can('stock.fulfil') ? (
                <div className="flex flex-wrap gap-2">
                  {r.stockStatus === 'unmatched' ? <button type="button" className={btn} onClick={() => setLinking(r)}>Link to SKU</button> : null}
                  {r.stockStatus === 'backorder' && can('stock.procure') ? <PrimaryButton disabled={action.busy} onClick={() => void source(r)}>Source it</PrimaryButton> : null}
                  {r.stockStatus === 'awaiting_procurement' ? <button type="button" className={btn} onClick={() => openTab('procurement')}>Open procurement</button> : null}
                  <button type="button" className={btn} disabled={action.busy} onClick={() => void retry(r.orderId)}>Retry allocation</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {linking ? <LinkLine row={linking} onClose={() => setLinking(null)} onLinked={() => { setLinking(null); list.reload(); }} /> : null}
    </div>
  );
}

function LinkLine({ row, onClose, onLinked }: { row: OrderException; onClose: () => void; onLinked: () => void }) {
  const { org } = useStock();
  const [q, setQ] = useState(row.sku ?? '');
  const results = useLoad((s) => (q.trim().length >= 2 ? stockApi.items(org, { q: q.trim(), limit: 10 }, s) : Promise.resolve({ items: [], total: 0, limit: 10, offset: 0 })), [org, q]);
  const action = useAction();
  async function link(itemId: string) {
    const r = await action.run(() => stockApi.linkOrderLine(org, row.orderId, row.orderItemId, itemId), 'Linked and allocated.');
    if (r !== undefined) onLinked();
  }
  return (
    <div className={`${card} space-y-2`}>
      <div className="flex items-center justify-between"><h3 className="font-semibold">Link order line “{row.title}”</h3><button type="button" className={btn} onClick={onClose}>Close</button></div>
      <input className={field} placeholder="Search SKU or title" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {(results.data?.items ?? []).map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span><span className="font-mono">{i.sku}</span> <span className="text-slate-500">{i.title}</span> · {i.available} available</span>
            <button type="button" className={btn} disabled={action.busy} onClick={() => void link(i.id)}>Use this</button>
          </li>
        ))}
      </ul>
      <Notice error={action.error} message={action.message} />
    </div>
  );
}
