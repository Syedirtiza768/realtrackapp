/* ─── Demand: what buyers asked for that we could not sell ──
 *  From parts_search_events: searches with no results or no
 *  stock (top numbers, queries, vehicles) and explicit
 *  sourcing requests, which procurement works off here.
 * ────────────────────────────────────────────────────────── */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getDemandReport, optionsPath, updateSourcingRequest, type SourcingRequest } from '../../lib/partsSearchOptionsApi';

const cell = 'px-3 py-1.5';

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Table({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <h2 className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">{title}</h2>
      {empty ? <p className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">Nothing in this period.</p> : <div className="overflow-x-auto">{children}</div>}
    </section>
  );
}

export default function PartsSearchDemandPage() {
  const [days, setDays] = useState(7);
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ['parts-search', 'demand', days], queryFn: ({ signal }) => getDemandReport(days, signal), staleTime: 30_000 });
  const data = report.data;

  const setStatus = async (request: SourcingRequest, status: 'open' | 'done' | 'dismissed') => {
    await updateSourcingRequest(request.id, status);
    await queryClient.invalidateQueries({ queryKey: ['parts-search', 'demand'] });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Demand</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Searches we could not sell from, and sourcing requests.</p>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" aria-label="Period">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {report.isError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{(report.error as Error).message}</p>}
      {!data && report.isLoading && <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Searches', data.totals.searches],
              ['Could not sell', data.totals.unmet],
              ['Sourcing requests', data.totals.requests],
              ['Open requests', data.totals.openRequests],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                <div className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{Number(value).toLocaleString()}</div>
              </div>
            ))}
          </div>

          <Table title="Sourcing requests" empty={!data.requests.length}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr><th className={cell}>When</th><th className={cell}>Query</th><th className={cell}>Vehicle</th><th className={cell}>Note</th><th className={cell}>By</th><th className={cell}>Status</th></tr>
              </thead>
              <tbody>
                {data.requests.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className={`${cell} whitespace-nowrap text-slate-500`}>{when(r.createdAt)}</td>
                    <td className={cell}><Link to={optionsPath({ q: r.query })} className="font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>{r.query || '—'}</Link></td>
                    <td className={cell}>{String((r.vehicle as { label?: string } | null)?.label ?? '—')}</td>
                    <td className={`${cell} max-w-xs whitespace-pre-line text-slate-600 dark:text-slate-300`}>{r.note ?? '—'}</td>
                    <td className={`${cell} text-slate-500`}>{r.userEmail ?? '—'}</td>
                    <td className={cell}>
                      <select value={r.status ?? 'open'} onChange={(e) => void setStatus(r, e.target.value as 'open' | 'done' | 'dismissed')} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" aria-label="Request status">
                        <option value="open">Open</option>
                        <option value="done">Sourced</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Table>

          <div className="grid gap-4 lg:grid-cols-2">
            <Table title="Part numbers searched but not sellable" empty={!data.topNumbers.length}>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className={cell}>Number</th><th className={cell}>Searches</th><th className={cell}>Staff</th><th className={cell}>Last</th></tr></thead>
                <tbody>
                  {data.topNumbers.map((row) => (
                    <tr key={row.number} className="border-t border-slate-100 dark:border-slate-800">
                      <td className={cell}><Link to={optionsPath({ q: row.number })} className="font-mono hover:underline" style={{ color: 'var(--brand-primary)' }}>{row.number}</Link></td>
                      <td className={`${cell} tabular-nums`}>{row.searches}</td>
                      <td className={`${cell} tabular-nums`}>{row.users}</td>
                      <td className={`${cell} whitespace-nowrap text-slate-500`}>{when(row.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
            <Table title="Searches with nothing to sell" empty={!data.topQueries.length}>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className={cell}>Query</th><th className={cell}>Searches</th><th className={cell}>Last</th></tr></thead>
                <tbody>
                  {data.topQueries.map((row) => (
                    <tr key={row.query} className="border-t border-slate-100 dark:border-slate-800">
                      <td className={cell}>
                        <Link to={optionsPath({ q: row.query })} className="hover:underline" style={{ color: 'var(--brand-primary)' }}>{row.query}</Link>
                        {row.zeroResults && <span className="ml-1 text-xs text-slate-400">(no results)</span>}
                      </td>
                      <td className={`${cell} tabular-nums`}>{row.searches}</td>
                      <td className={`${cell} whitespace-nowrap text-slate-500`}>{when(row.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Table>
          </div>

          <Table title="Vehicles we could not supply" empty={!data.topVehicles.length}>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"><tr><th className={cell}>Vehicle</th><th className={cell}>Searches</th><th className={cell}>Last</th></tr></thead>
              <tbody>
                {data.topVehicles.map((row) => (
                  <tr key={row.vehicle} className="border-t border-slate-100 dark:border-slate-800">
                    <td className={cell}>{row.vehicle}</td>
                    <td className={`${cell} tabular-nums`}>{row.searches}</td>
                    <td className={`${cell} whitespace-nowrap text-slate-500`}>{when(row.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Table>
        </>
      )}
    </div>
  );
}
