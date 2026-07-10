import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Package,
  CheckSquare,
  Square,
  DollarSign,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  usePublishedListings,
  usePublishedListingSummary,
  useSyncPublishedListings,
  useBulkPublishedListings,
  type PublishedListing,
} from '../../lib/publishedListingsApi';
import { listEbayAccounts, getEbayWorkspace } from '../../lib/ebayIntegrationsApi';
import { getStores } from '../../lib/multiStoreApi';
import { usePermissions } from '../../hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'secondary'; label: string }> = {
    active: { variant: 'success', label: 'Active' },
    ended: { variant: 'secondary', label: 'Ended' },
    out_of_stock: { variant: 'destructive', label: 'Out of stock' },
    unknown: { variant: 'warning', label: 'Unknown' },
  };
  const cfg = map[status] ?? { variant: 'secondary' as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function HealthIndicators({ flags }: { flags: PublishedListing['healthFlags'] }) {
  if (!flags?.length) return null;
  const critical = flags.filter((f) => f.severity === 'critical').length;
  const warning = flags.filter((f) => f.severity === 'warning').length;
  return (
    <span className="inline-flex items-center gap-1 text-amber-500" title={flags.map((f) => f.message).join('; ')}>
      <AlertTriangle size={14} />
      {critical > 0 && <span className="text-xs">{critical}</span>}
      {warning > 0 && !critical && <span className="text-xs text-amber-400">{warning}</span>}
    </span>
  );
}

export default function PublishedListingsPage() {
  const { has } = usePermissions();
  const canSync = has('published_listings.sync');
  const canManage = has('published_listings.manage');
  const canBulk = has('published_listings.bulk');

  const [organizationId, setOrganizationId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ebayAccountId, setEbayAccountId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState('update_price');
  const [bulkValue, setBulkValue] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: workspace } = useQuery({
    queryKey: ['ebay-workspace'],
    queryFn: getEbayWorkspace,
  });

  useEffect(() => {
    if (workspace?.organizationId && !organizationId) {
      setOrganizationId(workspace.organizationId);
    }
  }, [workspace, organizationId]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['ebay-accounts', organizationId],
    queryFn: () => listEbayAccounts(organizationId),
    enabled: Boolean(organizationId),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
  });

  const query = useMemo(
    () => ({
      organizationId,
      page,
      limit: 50,
      search: debouncedSearch || undefined,
      ebayAccountId: ebayAccountId || undefined,
      storeId: storeId || undefined,
      status: statusFilter || undefined,
      sortBy,
      sortDir: 'desc' as const,
    }),
    [organizationId, page, debouncedSearch, ebayAccountId, storeId, statusFilter, sortBy],
  );

  const { data, isLoading, isFetching, refetch } = usePublishedListings(query);
  const { data: summary } = usePublishedListingSummary(organizationId, ebayAccountId || undefined);
  const syncMutation = useSyncPublishedListings();
  const bulkMutation = useBulkPublishedListings();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }, [items, selected.size]);

  const handleSync = async () => {
    if (!organizationId) return;
    setSyncMessage('');
    try {
      const result = await syncMutation.mutateAsync({
        organizationId,
        ebayAccountId: ebayAccountId || undefined,
      });
      setSyncMessage(`Sync queued (${result.jobIds.length} job(s)). Refresh in a moment.`);
      setTimeout(() => refetch(), 5000);
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : 'Sync failed');
    }
  };

  const handleBulk = async () => {
    if (!organizationId || selected.size === 0) return;
    const payload: Record<string, unknown> = {};
    if (bulkAction === 'update_price') {
      payload.mode = 'set';
      payload.value = Number(bulkValue);
    } else if (bulkAction === 'update_quantity') {
      payload.quantity = Number(bulkValue);
    }
    await bulkMutation.mutateAsync({
      organizationId,
      listingIds: [...selected],
      action: bulkAction,
      payload,
    });
    setShowBulkModal(false);
    setSelected(new Set());
    refetch();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="text-emerald-500" />
            Published Listings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live eBay listings across all connected stores
          </p>
        </div>
        <div className="flex gap-2">
          {canBulk && selected.size > 0 && (
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => setShowBulkModal(true)}
            >
              Bulk ({selected.size})
            </button>
          )}
          {canSync && (
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center"
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <RefreshCw className="mr-2" size={16} />
              )}
              Sync from eBay
            </button>
          )}
        </div>
      </div>

      {syncMessage && (
        <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-lg">
          {syncMessage}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: summary.total },
            { label: 'Active', value: summary.active },
            { label: 'Ended', value: summary.ended },
            { label: 'Out of stock', value: summary.outOfStock },
            { label: 'With warnings', value: summary.withWarnings },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-xl font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                placeholder="Search title, SKU, item ID, store..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={ebayAccountId}
              onChange={(e) => { setEbayAccountId(e.target.value); setPage(1); }}
            >
              <option value="">All eBay accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.accountDisplayName}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={storeId}
              onChange={(e) => { setStoreId(e.target.value); setPage(1); }}
            >
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.storeName}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="ended">Ended</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="updated">Last updated</option>
              <option value="price">Price</option>
              <option value="quantity">Quantity</option>
              <option value="sales">Sales</option>
              <option value="title">Title</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Package className="mx-auto mb-3 opacity-40" size={40} />
              <p>No published listings yet.</p>
              {canSync && (
                <p className="text-sm mt-2">Connect eBay stores and run Sync from eBay.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-slate-500">
                    {canBulk && (
                      <th className="p-3 w-10">
                        <button type="button" onClick={toggleAll} className="text-slate-400 hover:text-slate-600">
                          {selected.size === items.length ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </th>
                    )}
                    <th className="p-3 w-14" />
                    <th className="p-3">Listing</th>
                    <th className="p-3">Store</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Market</th>
                    <th className="p-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      {canBulk && (
                        <td className="p-3">
                          <button type="button" onClick={() => toggleSelect(item.id)}>
                            {selected.has(item.id) ? (
                              <CheckSquare size={16} className="text-emerald-500" />
                            ) : (
                              <Square size={16} className="text-slate-400" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="p-3">
                        {item.imageUrls?.[0] ? (
                          <img
                            src={item.imageUrls[0]}
                            alt=""
                            className="w-10 h-10 object-cover rounded border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Package size={16} className="text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="p-3 max-w-xs">
                        <Link
                          to={`/published-listings/${item.id}`}
                          className="font-medium text-slate-900 dark:text-white hover:text-emerald-500 line-clamp-2"
                        >
                          {item.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.ebayItemId && (
                            <span className="text-xs text-slate-400">#{item.ebayItemId}</span>
                          )}
                          <HealthIndicators flags={item.healthFlags} />
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {item.accountDisplayName ?? '—'}
                      </td>
                      <td className="p-3 font-mono text-xs">{item.sku ?? '—'}</td>
                      <td className="p-3 whitespace-nowrap">
                        {item.price != null ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ${Number(item.price).toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-3">{item.quantityAvailable}</td>
                      <td className="p-3"><StatusBadge status={item.listingStatus} /></td>
                      <td className="p-3 text-xs">{item.marketplaceId?.replace('EBAY_', '') ?? '—'}</td>
                      <td className="p-3">
                        {item.listingUrl && (
                          <a href={item.listingUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-500">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-500">
                {total} listing{total !== 1 ? 's' : ''}
                {isFetching && <Loader2 className="inline ml-2 animate-spin" size={14} />}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm py-1 px-2">{page} / {totalPages}</span>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Bulk action ({selected.size} listings)
                <button type="button" onClick={() => setShowBulkModal(false)}>
                  <XCircle size={20} className="text-slate-400" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="update_price">Set price</option>
                <option value="update_quantity">Set quantity</option>
                <option value="sync">Re-sync from eBay</option>
                <option value="health_check">Re-check health</option>
                {canManage && <option value="end_listing">End listings</option>}
              </select>
              {(bulkAction === 'update_price' || bulkAction === 'update_quantity') && (
                <input
                  type="number"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder={bulkAction === 'update_price' ? 'New price' : 'New quantity'}
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                />
              )}
              {bulkAction === 'end_listing' && (
                <p className="text-sm text-red-500">This will end selected listings on eBay. This cannot be undone easily.</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                  onClick={() => setShowBulkModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50 ${
                    bulkAction === 'end_listing' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                  onClick={handleBulk}
                  disabled={bulkMutation.isPending}
                >
                  {bulkMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
