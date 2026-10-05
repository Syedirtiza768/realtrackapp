import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Boxes,
  History,
  LayoutDashboard,
  PackageSearch,
  ShoppingCart,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import WorkspacePageHeader from '../layout/WorkspacePageHeader';
import { stockApi, type Warehouse } from '../../lib/stockApi';
import { useLoad } from './stockUi';
import StockOverviewTab from './StockOverviewTab';
import StockItemsTab from './StockItemsTab';
import StockOrdersTab from './StockOrdersTab';
import StockProcurementTab from './StockProcurementTab';
import StockDocumentsTab from './StockDocumentsTab';
import StockWarehousesTab from './StockWarehousesTab';
import StockMovementsTab from './StockMovementsTab';
import StockSetupPanel from './StockSetupPanel';

export type StockVertical = 'automotive' | 'fashion' | 'business_industrial';

interface StockContextValue {
  org: string | null;
  vertical: StockVertical;
  can: (permission: string) => boolean;
  warehouses: Warehouse[];
  reloadWarehouses: () => void;
  openTab: (tab: string, extra?: Record<string, string>) => void;
}

const StockContext = createContext<StockContextValue | null>(null);

export function useStock(): StockContextValue {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error('useStock must be used inside StockWorkspace');
  return ctx;
}

const TABS: Array<{ id: string; label: string; icon: typeof Boxes; permission?: string }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'items', label: 'Stock', icon: Boxes },
  { id: 'orders', label: 'Orders & picking', icon: ShoppingCart },
  { id: 'procurement', label: 'Procurement', icon: PackageSearch },
  { id: 'operations', label: 'Transfers & counts', icon: ArrowLeftRight },
  { id: 'warehouses', label: 'Warehouses & channels', icon: WarehouseIcon },
  { id: 'movements', label: 'Ledger', icon: History },
];

const COPY: Record<StockVertical, string> = {
  automotive: 'Parts on hand by warehouse and bin, what is reserved for orders, and what must be bought from suppliers to fulfil them.',
  fashion: 'Garments on hand in each warehouse, consignments between sites, and items sourced to order.',
  business_industrial: 'Serialized and bulk equipment by location, reservations for orders, and supplier procurement.',
};

/**
 * Warehouse inventory workspace shared by Auto Parts, Fashion and B&I (CatalogWorkspace pattern).
 * Tabs live in the `tab` query param so links and the back button work.
 */
export default function StockWorkspace({ vertical }: { vertical: StockVertical }) {
  const { activeOrganizationId, permissions } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const org = activeOrganizationId;

  const status = useLoad((signal) => stockApi.setupStatus(org, signal), [org]);
  const warehouses = useLoad((signal) => stockApi.warehouses(org, false, signal), [org]);

  const value = useMemo<StockContextValue>(
    () => ({
      org,
      vertical,
      can: (permission: string) => permissions.includes(permission),
      warehouses: warehouses.data ?? [],
      reloadWarehouses: warehouses.reload,
      openTab: (next, extra) => setParams({ tab: next, ...(extra ?? {}) }),
    }),
    [org, vertical, permissions, warehouses.data, warehouses.reload, setParams],
  );

  const initialized = status.data?.initialized && (warehouses.data?.length ?? 0) > 0;

  let body: ReactNode;
  if (status.loading && !status.data) body = <p role="status" className="text-sm text-slate-500">Loading stock…</p>;
  else if (status.error) body = <p role="alert" className="text-sm text-red-600">{status.error}</p>;
  else if (!initialized)
    body = <StockSetupPanel status={status.data} onDone={() => { status.reload(); warehouses.reload(); }} />;
  else {
    switch (tab) {
      case 'items': body = <StockItemsTab />; break;
      case 'orders': body = <StockOrdersTab />; break;
      case 'procurement': body = <StockProcurementTab />; break;
      case 'operations': body = <StockDocumentsTab />; break;
      case 'warehouses': body = <StockWarehousesTab />; break;
      case 'movements': body = <StockMovementsTab />; break;
      default: body = <StockOverviewTab />;
    }
  }

  return (
    <StockContext.Provider value={value}>
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <WorkspacePageHeader eyebrow="Inventory" title="Warehouse stock" subtitle={COPY[vertical]} />
        {initialized ? (
          <nav aria-label="Stock sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-1 border-b border-slate-200 dark:border-slate-800">
              {TABS.filter((t) => !t.permission || value.can(t.permission)).map((t) => {
                const active = t.id === tab;
                const Icon = t.icon;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ tab: t.id })}
                      aria-current={active ? 'page' : undefined}
                      className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
                        active
                          ? 'border-[color:var(--brand-primary,#2563eb)] text-slate-900 dark:text-slate-100'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
        {body}
      </div>
    </StockContext.Provider>
  );
}

