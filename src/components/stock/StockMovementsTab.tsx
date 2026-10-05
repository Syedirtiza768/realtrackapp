import { useState } from 'react';
import { Download } from 'lucide-react';
import { stockApi, type StockMovementRow } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import { btn, card, Empty, field, fmtDate, Notice, signed, StatusBadge, td, th, useLoad } from './stockUi';

const TYPES = ['receipt', 'opening_balance', 'adjustment', 'count_variance', 'reserve', 'release', 'pick', 'ship', 'transfer_out', 'transfer_in', 'putaway', 'damage', 'po_ordered', 'po_cancelled', 'dropship'];
const PAGE = 100;

function toCsv(rows: StockMovementRow[]) {
  const head = ['time', 'type', 'sku', 'warehouse', 'bin', 'on_hand_change', 'on_hand_after', 'reserved_change', 'inbound_change', 'damaged_change', 'document', 'order', 'reason', 'note', 'user'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head.join(','), ...rows.map((m) => [m.createdAt, m.type, m.sku, m.warehouseCode, m.locationCode, m.qtyOnHand, m.onHandAfter, m.qtyReserved, m.qtyInbound, m.qtyDamaged, m.documentNumber, m.externalOrderId ?? m.orderId, m.reasonCode, m.note, m.actorEmail].map(esc).join(','))].join('\n');
}

/** The append-only stock ledger: every change, who made it, and why. */
export default function StockMovementsTab() {
  const { org, warehouses } = useStock();
  const [type, setType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const list = useLoad(
    (s) => stockApi.movements(org, { type: type || undefined, warehouseId: warehouseId || undefined, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined, limit: PAGE, offset }, s),
    [org, type, warehouseId, from, to, offset],
  );
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className={`${card} grid gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:items-end`}>
        <label className="text-sm">Type<select className={field} value={type} onChange={(e) => { setType(e.target.value); setOffset(0); }}><option value="">All</option>{TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></label>
        <label className="text-sm">Warehouse<select className={field} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setOffset(0); }}><option value="">All</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}</select></label>
        <label className="text-sm">From<input className={field} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} /></label>
        <label className="text-sm">To<input className={field} type="date" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} /></label>
        <button type="button" className={btn} disabled={!rows.length} onClick={exportCsv}><Download className="h-4 w-4" aria-hidden /> Export page (CSV)</button>
      </div>
      <Notice error={list.error} />
      {list.data && !rows.length ? <Empty title="No movements" /> : null}
      {rows.length ? (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-800"><tr><th className={th}>When</th><th className={th}>Type</th><th className={th}>SKU</th><th className={th}>Where</th><th className={`${th} text-right`}>On hand</th><th className={`${th} text-right`}>Reserved</th><th className={`${th} text-right`}>Inbound</th><th className={th}>Reference</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className={`${td} whitespace-nowrap text-xs`}>{fmtDate(m.createdAt)}<span className="block text-slate-500">{m.actorEmail ?? 'system'}</span></td>
                  <td className={td}><StatusBadge status={m.type} /></td>
                  <td className={`${td} whitespace-nowrap`}><span className="font-mono">{m.sku}</span></td>
                  <td className={`${td} whitespace-nowrap font-mono text-xs`}>{m.warehouseCode}{m.locationCode ? `/${m.locationCode}` : ''}</td>
                  <td className={`${td} text-right tabular-nums`}>{m.qtyOnHand ? <>{signed(m.qtyOnHand)} <span className="text-xs text-slate-500">→ {m.onHandAfter}</span></> : '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>{m.qtyReserved ? signed(m.qtyReserved) : '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>{m.qtyInbound ? signed(m.qtyInbound) : '—'}</td>
                  <td className={`${td} text-xs`}>{[m.documentNumber, m.externalOrderId ? `order ${m.externalOrderId}` : null, m.reasonCode?.replace(/_/g, ' '), m.note].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > PAGE ? (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
          <div className="flex gap-2">
            <button type="button" className={btn} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
            <button type="button" className={btn} disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
