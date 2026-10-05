import { ArrowRight } from 'lucide-react';
import { stockApi } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import { card, fmtMoney, Notice, Section, Stat, useLoad } from './stockUi';

export default function StockOverviewTab() {
  const { org, can, openTab } = useStock();
  const summary = useLoad((s) => stockApi.summary(org, s), [org]);
  const procurement = useLoad((s) => stockApi.procurementSummary(org, s), [org]);
  const channel = useLoad((s) => stockApi.channelSummary(org, s), [org]);
  const aging = useLoad((s) => stockApi.aging(org, s), [org]);
  const canValue = can('stock.valuation.view');
  const valuation = useLoad((s) => (canValue ? stockApi.valuation(org, s) : Promise.resolve([])), [org, canValue]);

  const d = summary.data;
  type Attention = { label: string; count: number; tab: string; extra?: Record<string, string>; tone: 'bad' | 'warn' };
  const attention: Attention[] = d
    ? ([
        { label: 'Order lines backordered or not matched to stock', count: d.orderExceptions, tab: 'orders', extra: { view: 'exceptions' }, tone: 'bad' as const },
        { label: 'Order lines waiting on a supplier', count: d.awaitingProcurement, tab: 'procurement', tone: 'warn' as const },
        { label: 'Reserved items to pick', count: d.toPick, tab: 'orders', tone: 'warn' as const },
        { label: 'Procurement requests needing a supplier', count: procurement.data?.needsSupplier ?? 0, tab: 'procurement', tone: 'bad' as const },
        { label: 'Adjustments / counts awaiting approval', count: d.pendingApprovals, tab: 'operations', tone: 'warn' as const },
        { label: 'SKUs at or below low-stock threshold', count: d.lowStock, tab: 'items', extra: { filter: 'low_stock' }, tone: 'warn' as const },
        { label: 'Channel quantity push failures', count: channel.data?.failed ?? 0, tab: 'warehouses', tone: 'bad' as const },
      ] as Attention[]).filter((a) => a.count > 0)
    : [];

  return (
    <div className="space-y-4">
      <Notice error={summary.error} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="On hand" value={d?.onHand ?? '—'} hint={d ? `${d.skusInStock} SKUs in stock` : undefined} />
        <Stat label="Available to sell" value={d?.available ?? '—'} hint={d ? `${d.reserved} reserved · ${d.damaged} damaged` : undefined} />
        <Stat label="Inbound" value={d?.inbound ?? '—'} hint={d ? `${d.openPurchaseOrders} open POs · ${d.transfersInTransit} transfers` : undefined} />
        {canValue ? (
          <Stat label="Stock value" value={fmtMoney(d?.stockValue)} hint="Weighted-average cost" />
        ) : (
          <Stat label="Sourced to order" value={d?.sourceableSkus ?? '—'} hint="SKUs sold before they are bought" />
        )}
      </div>

      <Section title="Needs attention">
        {summary.loading && !d ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : attention.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {attention.map((a) => (
              <li key={a.label}>
                <button type="button" onClick={() => openTab(a.tab, a.extra)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-slate-900 dark:hover:text-white">
                  <span>{a.label}</span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${a.tone === 'bad' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'}`}>{a.count}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing needs attention right now.</p>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Channel quantities">
          {channel.data ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {channel.data.pushGloballyEnabled
                  ? 'Pushing is enabled for this installation; each store still needs its own switch.'
                  : 'Shadow mode: quantities are calculated and compared with the channel, but nothing is sent.'}
              </p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-slate-500">In sync</dt><dd className="font-semibold tabular-nums">{channel.data.synced}</dd></div>
                <div><dt className="text-slate-500">Shadow</dt><dd className="font-semibold tabular-nums">{channel.data.shadow}</dd></div>
                <div><dt className="text-slate-500">Different on channel</dt><dd className="font-semibold tabular-nums">{channel.data.drift}</dd></div>
              </dl>
            </>
          ) : <p className="text-sm text-slate-500">{channel.error || 'Loading…'}</p>}
        </Section>
        <Section title="Stock age (since last received)">
          {aging.data?.buckets.length ? (
            <ul className="space-y-2 text-sm">
              {aging.data.buckets.map((b) => {
                const max = Math.max(...aging.data!.buckets.map((x) => x.units), 1);
                return (
                  <li key={b.bucket} className="grid grid-cols-[5rem_1fr_6rem] items-center gap-2">
                    <span className="text-slate-500">{b.bucket} days</span>
                    <span className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <span className="block h-2 rounded-full" style={{ width: `${(b.units / max) * 100}%`, backgroundColor: 'var(--brand-primary, #2563eb)' }} />
                    </span>
                    <span className="text-right tabular-nums">{b.units} units</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-slate-500">{aging.loading ? 'Loading…' : 'No stock on hand yet.'}</p>}
        </Section>
      </div>

      {canValue && valuation.data?.length ? (
        <div className={`${card} overflow-x-auto`}>
          <h3 className="mb-2 font-semibold">Value by warehouse</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">Warehouse</th><th className="py-1 text-right">Units</th><th className="py-1 text-right">Value</th><th className="py-1 text-right">SKUs without cost</th></tr></thead>
            <tbody>
              {valuation.data.map((v) => (
                <tr key={v.warehouseId} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5"><span className="font-mono font-semibold">{v.code}</span> <span className="text-slate-500">{v.name}</span></td>
                  <td className="py-1.5 text-right tabular-nums">{v.onHand}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(v.value)}</td>
                  <td className="py-1.5 text-right tabular-nums">{v.unCostedSkus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
