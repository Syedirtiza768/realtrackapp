import { useState } from 'react';
import { stockApi, type BootstrapReport, type SetupStatus } from '../../lib/stockApi';
import { useStock } from './StockWorkspace';
import { btn, card, field, Notice, PrimaryButton, Section, useAction } from './stockUi';

/**
 * First-run setup: preview (dry run) then create the default warehouse, the SKU master,
 * opening balances from current product quantities, and store links in shadow mode.
 */
export default function StockSetupPanel({ status, onDone }: { status: SetupStatus | null; onDone: () => void }) {
  const { org, can, vertical } = useStock();
  const [code, setCode] = useState('MAIN');
  const [name, setName] = useState('Main warehouse');
  const [openingBalances, setOpeningBalances] = useState(true);
  const [claimUnscoped, setClaimUnscoped] = useState(false);
  const [report, setReport] = useState<BootstrapReport | null>(null);
  const action = useAction();
  const canSetup = can('stock.warehouses.manage');

  const run = (dryRun: boolean) =>
    action.run(
      async () => {
        const r = await stockApi.bootstrap(org, {
          dryRun,
          openingBalances,
          claimUnscopedAutomotive: claimUnscoped,
          defaultWarehouseCode: code.trim() || undefined,
          defaultWarehouseName: name.trim() || undefined,
        });
        setReport(r);
        if (!dryRun) onDone();
        return r;
      },
      dryRun ? 'Preview ready — nothing has been saved yet.' : 'Stock is set up. Channel quantities are in shadow mode until you enable pushing per store.',
    );

  return (
    <div className="space-y-4">
      <Section title="Set up warehouse stock for this workspace">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This creates a default warehouse, one stock record per SKU (linked to your catalog products and listings), and opening
          balances from today’s product quantities. Fashion warehouses become stock warehouses with the same codes. Nothing is sent
          to eBay or PartsBazar360 — every store starts in <strong>shadow mode</strong>, where you can compare the quantity stock
          would publish with what the channel shows before switching pushing on.
        </p>
        {status ? (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-slate-500">Catalog products with SKU</dt><dd className="font-semibold tabular-nums">{status.catalogProducts}</dd></div>
            <div><dt className="text-slate-500">Fashion warehouses</dt><dd className="font-semibold tabular-nums">{status.fashionWarehouses}</dd></div>
            <div><dt className="text-slate-500">Stores</dt><dd className="font-semibold tabular-nums">{status.stores}</dd></div>
            <div><dt className="text-slate-500">Stock items</dt><dd className="font-semibold tabular-nums">{status.items}</dd></div>
          </dl>
        ) : null}
        {!canSetup ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">Ask a workspace administrator (stock.warehouses.manage) to set up stock.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <label className="text-sm">Default warehouse code
                <input className={field} value={code} maxLength={40} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9_.-]/g, '').toUpperCase())} />
              </label>
              <label className="text-sm">Name
                <input className={field} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={openingBalances} onChange={(e) => setOpeningBalances(e.target.checked)} />
              <span>Use current product quantities as opening stock. Untick if you will count everything instead.</span>
            </label>
            {vertical === 'automotive' ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={claimUnscoped} onChange={(e) => setClaimUnscoped(e.target.checked)} />
                <span>Include Auto Parts listings and catalog rows that are not assigned to any workspace yet (older imports). Only one workspace should do this.</span>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} disabled={action.busy} onClick={() => void run(true)}>
                {action.busy ? 'Working…' : 'Preview'}
              </button>
              <PrimaryButton disabled={action.busy || !report?.dryRun} onClick={() => void run(false)} title={!report?.dryRun ? 'Run a preview first' : undefined}>
                Set up stock
              </PrimaryButton>
            </div>
          </>
        )}
        <Notice error={action.error} message={action.message} />
      </Section>

      {report ? (
        <div className={card}>
          <h3 className="font-semibold">{report.dryRun ? 'Preview' : 'Result'}</h3>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            <li>Default warehouse: <strong>{report.defaultWarehouse.code}</strong></li>
            <li>Warehouses copied from Fashion: <strong>{report.warehousesFromFashion}</strong></li>
            <li>Stock items: <strong>{report.items.total}</strong> ({report.items.fromCatalog} catalog, {report.items.fromListings} listings, {report.items.fromVariants} variants)</li>
            <li>Serialized units imported: <strong>{report.serialUnitsImported}</strong></li>
            <li>Opening balances: <strong>{report.openingBalances.items}</strong> items, {report.openingBalances.units} units</li>
            <li>Stores linked to the default warehouse: <strong>{report.storesLinked}</strong></li>
          </ul>
          {report.conflicts.length ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">{report.conflicts.length} item(s) need a look</summary>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {report.conflicts.map((c, i) => <li key={i}><span className="font-mono">{c.sku}</span> — {c.detail}</li>)}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
