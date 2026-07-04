import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Search,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Car,
  RefreshCw,
  Send,
  Calendar,
  BookMarked,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  useInventoryListings,
  useFilterBrands,
  useFilterMakes,
  useFilterModels,
  useFilterCategories,
  useSendToCatalog,
  type InventoryListingItem,
  type EnrichmentStatus,
  type InventoryStoreListing,
} from '../../lib/inventoryApi';
import { usePermissions } from '../../hooks/usePermissions';
import InventoryDetailModal from './InventoryDetailModal';

function StatusBadge({ status }: { status: InventoryListingItem['status'] }) {
  const config: Record<
    string,
    { variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary'; label: string }
  > = {
    draft: { variant: 'secondary', label: 'Draft' },
    ready: { variant: 'default', label: 'Ready' },
    publishing: { variant: 'warning', label: 'Publishing...' },
    published: { variant: 'success', label: 'Published' },
    error: { variant: 'destructive', label: 'Error' },
  };
  const cfg = config[status] ?? { variant: 'secondary', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function EnrichmentBadge({ status, stage }: { status: EnrichmentStatus; stage?: string | null }) {
  const stageHint = stage
    ? { vision_lookup: 'Vision...', enrichment: 'Enrich...', generating_us: 'US...', generating_au: 'AU...', generating_de: 'DE...' }[stage] ?? stage
    : undefined;

  const config: Record<
    EnrichmentStatus,
    { variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary' | 'outline'; label: string; pulse?: boolean }
  > = {
    idle: { variant: 'outline', label: 'Idle' },
    ready: { variant: 'warning', label: 'Ready', pulse: true },
    enriching: { variant: 'default', label: stageHint ?? 'Enriching...', pulse: true },
    completed: { variant: 'success', label: 'Enriched' },
    needs_review: { variant: 'warning', label: 'Needs review' },
    failed: { variant: 'destructive', label: 'Failed' },
  };
  const cfg = config[status] ?? { variant: 'outline', label: status };
  return (
    <Badge variant={cfg.variant} className={cfg.pulse ? 'animate-pulse' : ''}>
      {cfg.label}
    </Badge>
  );
}

function MarketplaceSummary({ item }: { item: InventoryListingItem }) {
  const mkts = (item.marketplaceVariants ?? [])
    .map((v) => v.marketplace)
    .filter((m): m is string => Boolean(m));
  if (mkts.length === 0) return <span className="text-xs text-slate-500">—</span>;
  return (
    <span className="text-xs">
      {mkts.map((m) => (
        <span key={m} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 text-[10px] font-medium">
          {m}
        </span>
      ))}
    </span>
  );
}

function marketplaceShort(id: string): string {
  if (id.includes('AU')) return 'AU';
  if (id.includes('DE')) return 'DE';
  return 'US';
}

function StoreListingsSummary({ listings }: { listings: InventoryStoreListing[] }) {
  if (!listings.length) {
    return <span className="text-xs text-slate-500">—</span>;
  }
  return (
    <div className="space-y-1 max-w-[200px]">
      {listings.map((s) => (
        <div
          key={`${s.storeId}-${s.marketplaceId}`}
          className="text-[10px] leading-tight"
          title={s.offerId ? `Offer: ${s.offerId}` : undefined}
        >
          <span className="text-slate-600 dark:text-slate-300 truncate">{s.storeName}</span>
          <span className="text-slate-400"> · {marketplaceShort(s.marketplaceId)}</span>
          {s.price != null && (
            <span className="text-emerald-500 dark:text-emerald-400"> ${s.price.toFixed(2)}</span>
          )}
          {s.quantity != null && (
            <span className="text-slate-500"> ×{s.quantity}</span>
          )}
          <span
            className={`ml-1 capitalize ${
              s.status === 'published'
                ? 'text-emerald-500'
                : s.status === 'failed'
                  ? 'text-red-400'
                  : 'text-slate-400'
            }`}
          >
            {s.status}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InventoryManager() {
  const navigate = useNavigate();
  const { has: canEnrich } = usePermissions();
  const canSendToCatalog = canEnrich('inventory.enrich');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [missingImagesFilter, setMissingImagesFilter] = useState(false);

  // Advanced filters
  const [dateAddedFrom, setDateAddedFrom] = useState('');
  const [dateAddedTo, setDateAddedTo] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [makeFilter, setMakeFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [catalogSuccess, setCatalogSuccess] = useState<string | null>(null);
  const limit = 25;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useInventoryListings({
    page,
    limit,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
    missingImages: missingImagesFilter || undefined,
    dateAddedFrom: dateAddedFrom || undefined,
    dateAddedTo: dateAddedTo || undefined,
    brand: brandFilter || undefined,
    make: makeFilter || undefined,
    model: modelFilter || undefined,
    category: categoryFilter || undefined,
  });

  // Filter metadata
  const { data: brands } = useFilterBrands();
  const { data: makes } = useFilterMakes();
  const { data: models } = useFilterModels(makeFilter || undefined);
  const { data: categories } = useFilterCategories();

  const sendToCatalogMutation = useSendToCatalog();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const selectedItems = items.filter((i) => selected.has(i.id));

  const handleSendToCatalog = useCallback(async () => {
    if (!canSendToCatalog || selected.size === 0) return;
    setActionError(null);
    setCatalogSuccess(null);
    try {
      const result = await sendToCatalogMutation.mutateAsync(Array.from(selected));
      const succeeded = result.results.filter((r) => r.success).length;
      const failed = result.results.filter((r) => !r.success);
      setCatalogSuccess(`${succeeded} part(s) sent to catalog`);
      if (failed.length > 0) {
        setActionError(`${failed.length} failed: ${failed.map((f) => f.error).filter(Boolean).join('; ')}`);
      }
      setSelected(new Set());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to send to catalog');
    }
  }, [canSendToCatalog, selected, sendToCatalogMutation]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const clearFilters = () => {
    setDateAddedFrom('');
    setDateAddedTo('');
    setBrandFilter('');
    setMakeFilter('');
    setModelFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  const hasActiveFilters = dateAddedFrom || dateAddedTo || brandFilter || makeFilter || modelFilter || categoryFilter;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-400" />
            Inventory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload 2 photos per part to auto-enrich listings for US/AU/DE. Then send to catalog.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canSendToCatalog && selected.size > 0 && (
            <button
              type="button"
              onClick={handleSendToCatalog}
              disabled={sendToCatalogMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {sendToCatalogMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookMarked className="h-4 w-4" />
              )}
              Send to catalog ({selected.size})
            </button>
          )}
        </div>
      </div>

      {catalogSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/50">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <p className="text-emerald-400 text-sm">{catalogSuccess}</p>
        </div>
      )}

      {(actionError || loadError) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/50">
          <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
          <p className="text-red-400 text-sm">
            {actionError ??
              (loadError instanceof Error ? loadError.message : 'Failed to load inventory')}
          </p>
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search by SKU, title, brand, OEM..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="published">Published</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={missingImagesFilter}
                onChange={(e) => {
                  setMissingImagesFilter(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
              />
              <ImageIcon className="h-4 w-4 text-amber-400" />
              Missing Images
            </label>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showAdvancedFilters || hasActiveFilters
                  ? 'bg-blue-900/30 border-blue-700/50 text-blue-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Filters
              {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-blue-400" />}
            </button>
          </div>

          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date Added From</label>
                  <input
                    type="date"
                    value={dateAddedFrom}
                    onChange={(e) => { setDateAddedFrom(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date Added To</label>
                  <input
                    type="date"
                    value={dateAddedTo}
                    onChange={(e) => { setDateAddedTo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Brand</label>
                  <select
                    value={brandFilter}
                    onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Brands</option>
                    {(brands ?? []).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Make</label>
                  <select
                    value={makeFilter}
                    onChange={(e) => { setMakeFilter(e.target.value); setModelFilter(''); setPage(1); }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Makes</option>
                    {(makes ?? []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Model</label>
                  <select
                    value={modelFilter}
                    onChange={(e) => { setModelFilter(e.target.value); setPage(1); }}
                    disabled={!makeFilter}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-40"
                  >
                    <option value="">All Models</option>
                    {(models ?? []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    {(categories ?? []).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-3 text-xs text-blue-400 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-300">
                {total} part{total !== 1 ? 's' : ''} (one row per SKU)
                {selected.size > 0 && (
                  <span className="ml-2 text-blue-400">({selected.size} selected)</span>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-left">
                    <th className="pb-3 pr-3 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={toggleAll}
                        className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
                      />
                    </th>
                    <th className="pb-3 pr-3 w-16">Image</th>
                    <th className="pb-3 pr-3">SKU / Title</th>
                    <th className="pb-3 pr-3">Brand</th>
                    <th className="pb-3 pr-3">Marketplaces</th>
                    <th className="pb-3 pr-3">eBay Stores</th>
                    <th className="pb-3 pr-3">
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" /> Fitments
                      </span>
                    </th>
                    <th className="pb-3 pr-3">Validation</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Enrichment</th>
                    <th className="pb-3">Catalog</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setDetailId(item.id)}
                    >
                      <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-slate-300 dark:border-slate-600 bg-slate-800 text-blue-500"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded border border-amber-600/50 bg-amber-900/20 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-amber-400" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 max-w-[300px]">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {item.sku}
                          {item.intakeSource && (
                            <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                              Intake
                            </Badge>
                          )}
                          {item.enrichmentStatus === 'completed' && (
                            <Badge variant="warning" className="ml-2 text-[10px] py-0">
                              Enriched
                            </Badge>
                          )}
                        </div>
                        <div
                          className="text-slate-600 dark:text-slate-200 truncate"
                          title={item.title}
                        >
                          {item.title}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={
                            item.brand === 'Generic'
                              ? 'text-amber-400'
                              : 'text-slate-600 dark:text-slate-200'
                          }
                        >
                          {item.brand}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <MarketplaceSummary item={item} />
                      </td>
                      <td className="py-3 pr-3">
                        <StoreListingsSummary listings={item.storeListings ?? []} />
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                            item.fitmentCount > 0
                              ? 'bg-blue-900/30 text-blue-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <Car className="h-3 w-3" />
                          {item.fitmentCount}
                        </span>
                      </td>
                      <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                        {item.missingFields.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedErrors((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            className="flex items-center gap-1 text-amber-400"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs">{item.missingFields.length}</span>
                            {expandedErrors.has(item.id) ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )}
                        {expandedErrors.has(item.id) && item.missingFields.length > 0 && (
                          <div className="mt-1 text-xs text-amber-400/80 space-y-0.5">
                            {item.missingFields.map((f) => (
                              <div key={f}>{f}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3 pr-3">
                        <EnrichmentBadge status={item.enrichmentStatus} stage={item.enrichmentStage} />
                      </td>
                      <td className="py-3" onClick={(e) => e.stopPropagation()}>
                        {item.enrichmentStatus === 'completed' ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200 text-xs disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200 text-xs disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && items.length === 0 && !loadError && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-slate-500 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">No parts match your filters.</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Use{' '}
              <Link to="/listings/new" className="text-blue-400 hover:underline">
                Add Part
              </Link>{' '}
              for warehouse intake, then upload 2 photos to auto-enrich.
            </p>
          </CardContent>
        </Card>
      )}

      <InventoryDetailModal
        listingId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
