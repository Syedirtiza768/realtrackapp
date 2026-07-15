import { useState, useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  Calendar,
  BookMarked,
  MapPin,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  useInventoryListings,
  useInventoryFacets,
  useSendToCatalog,
  useDeleteInventoryListing,
  useBulkDeleteInventoryListings,
  inventoryFiltersToParams,
  INVENTORY_EMPTY_FILTERS,
  countInventoryActiveFilters,
  type InventoryListingItem,
  type EnrichmentStatus,
  type InventoryFilters,
} from '../../lib/inventoryApi';
import { fetchWithAuth } from '../../lib/authApi';
import { usePermissions } from '../../hooks/usePermissions';
import InventoryDetailModal from './InventoryDetailModal';
import InventoryFilterBar from './InventoryFilterBar';
import InventoryFilterSidebar from './InventoryFilterSidebar';
import { MobileFilterDrawer } from '../catalog/FilterSidebar';
import TeamBadge from '../catalog/TeamBadge';
import ImageZoom from '../ui/ImageZoom';

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

export default function InventoryManager() {
  const navigate = useNavigate();
  const { has: canEnrich } = usePermissions();
  const canSendToCatalog = canEnrich('inventory.enrich');
  const canDeleteInventory = canEnrich('inventory.delete');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [zoomImages, setZoomImages] = useState<string[] | null>(null);
  const [zoomIndex, setZoomIndex] = useState(0);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<InventoryFilters>({ ...INVENTORY_EMPTY_FILTERS });
  const [showSidebar, setShowSidebar] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [catalogSuccess, setCatalogSuccess] = useState<string | null>(null);

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationValue, setEditingLocationValue] = useState('');
  const [locationSaving, setLocationSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const apiParams = useMemo(
    () => inventoryFiltersToParams(filters, debouncedSearch, page, limit),
    [filters, debouncedSearch, page, limit],
  );

  const {
    data,
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useInventoryListings(apiParams);

  const { data: facets, isLoading: facetsLoading } = useInventoryFacets(apiParams);

  const sendToCatalogMutation = useSendToCatalog();
  const deleteMutation = useDeleteInventoryListing();
  const bulkDeleteMutation = useBulkDeleteInventoryListings();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

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

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId || !canDeleteInventory) return;
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteConfirmId);
        return next;
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete listing');
    }
  }, [deleteConfirmId, canDeleteInventory, deleteMutation]);

  const handleBulkDelete = useCallback(async () => {
    if (!canDeleteInventory || selected.size === 0) return;
    setActionError(null);
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selected));
      setBulkDeleteConfirm(false);
      setSelected(new Set());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete listings');
    }
  }, [canDeleteInventory, selected, bulkDeleteMutation]);

  const handleSaveLocation = useCallback(async (item: InventoryListingItem) => {
    setLocationSaving(true);
    try {
      await fetchWithAuth(`/api/listings/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          version: item.version,
          location: editingLocationValue.trim() || null,
        }),
      });
      await qc.invalidateQueries({ queryKey: ['inventory-listings'] });
      setEditingLocationId(null);
    } catch {
      // error silently — user can retry
    } finally {
      setLocationSaving(false);
    }
  }, [editingLocationValue, qc]);

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

  const filterCount = countInventoryActiveFilters(filters);

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

          {canDeleteInventory && selected.size > 0 && (
            <button
              type="button"
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-800 text-red-300 text-sm font-medium hover:bg-red-950/50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selected.size})
            </button>
          )}

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
            <InventoryFilterBar
              facets={facets ?? null}
              filters={filters}
              onChange={(updater) => {
                setFilters(typeof updater === 'function' ? updater : updater);
                setPage(1);
              }}
              onAdvancedClick={() => setShowSidebar((v) => !v)}
              advancedFilterCount={filterCount}
              loading={facetsLoading}
            />
          </div>
        </CardContent>
      </Card>

      <MobileFilterDrawer
        open={showSidebar}
        onClose={() => setShowSidebar(false)}
        filterCount={filterCount}
        variant="all"
      >
        <InventoryFilterSidebar
          facets={facets ?? null}
          filters={filters}
          onChange={(f) => { setFilters(f); setPage(1); }}
          loading={facetsLoading}
        />
      </MobileFilterDrawer>

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
                    <th className="pb-3 pr-3">Storage Location</th>
                    <th className="pb-3 pr-3">Team</th>
                    <th className="pb-3 pr-3">
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" /> Fitments
                      </span>
                    </th>
                    <th className="pb-3 pr-3">Validation</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Enrichment</th>
                    <th className="pb-3 pr-3">Catalog</th>
                    {canDeleteInventory && <th className="pb-3 w-10"> </th>}
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
                            className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-700 cursor-zoom-in"
                            loading="lazy"
                            onClick={() => { setZoomImages(item.imageUrls.length ? item.imageUrls : [item.imageUrl]); setZoomIndex(0); }}
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
                      <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                        {editingLocationId === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingLocationValue}
                              onChange={(e) => setEditingLocationValue(e.target.value)}
                              placeholder="e.g. Aisle 3, Bin B12"
                              className="w-28 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleSaveLocation(item);
                                if (e.key === 'Escape') setEditingLocationId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveLocation(item)}
                              disabled={locationSaving}
                              className="p-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {locationSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLocationId(null)}
                              className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                              <XCircle size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLocationId(item.id);
                              setEditingLocationValue(item.location ?? '');
                            }}
                            className="flex items-center gap-1 text-xs hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                          >
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {item.location || (
                              <span className="text-slate-400 italic">Set</span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <TeamBadge name={item.teamName} color={item.teamColor} />
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
                      {canDeleteInventory && (
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Soft-delete listing"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-200 focus:outline-none"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={250}>250 per page</option>
                    <option value={500}>500 per page</option>
                  </select>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Page {page} of {totalPages}
                  </span>
                </div>
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

      {canDeleteInventory && deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Delete inventory listing
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Soft-delete this listing? It will be hidden from inventory and can be restored later by an admin.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canDeleteInventory && bulkDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setBulkDeleteConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Delete {selected.size} listings
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Soft-delete{' '}
              <span className="font-semibold text-slate-600 dark:text-slate-200">{selected.size}</span>{' '}
              selected inventory listings? They can be restored later.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={bulkDeleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {bulkDeleteMutation.isPending ? 'Deleting…' : `Delete ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {zoomImages && (
        <ImageZoom
          images={zoomImages}
          index={zoomIndex}
          onClose={() => setZoomImages(null)}
        />
      )}
    </div>
  );
}
