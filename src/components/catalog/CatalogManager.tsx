/* ─── CatalogManager ──────────────────────────────────────
 *  State-of-the-art catalogue search system.
 *  Orchestrates: SearchBar, FilterSidebar, ResultsGrid,
 *  DetailModal, ActiveFilterTags, breadcrumbs, sorting.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  PlusCircle,
  Shield,
  RefreshCw,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchBar from './SearchBar';
import FilterSidebar, { MobileFilterDrawer } from './FilterSidebar';
import ActiveFilterTags from './ActiveFilterTags';
import CatalogInventoryDetailModal from './CatalogInventoryDetailModal';
import PublishModal from '../channels/PublishModal';
import ExportTemplatesModal from './ExportTemplatesModal';
import BulkPolicyEditModal from './BulkPolicyEditModal';
import CatalogFilterBar from './CatalogFilterBar';
import CatalogBulkBar from './CatalogBulkBar';
import CatalogTable from './CatalogTable';
import { useSearch, useSummary, useDynamicFacets } from '../../lib/searchApi';
import { deleteListing } from '../../lib/listingsApi';
import { useListingDetailQuery } from '../../lib/listingsQueryHooks';
import type { SearchItem } from '../../types/search';
import { authHeaders } from '../../lib/authApi';
import { showCatalogDestructiveUi } from '../../lib/catalogDestructiveUi';
import type { SearchQuery, SortMode, ActiveFilters } from '../../types/search';
import { EMPTY_FILTERS, filtersToQuery } from '../../types/search';

const DEFAULT_PAGE_SIZE = 25;
const RECENT_KEY = 'lp_recent_searches';

function countAdvancedFilters(f: ActiveFilters): number {
  let count = 0;
  count += f.categories.length;
  count += f.makes.length;
  count += f.models.length;
  count += f.types.length;
  count += f.sourceFiles.length;
  count += f.formats.length;
  count += f.locations.length;
  count += f.mpns.length;
  count += f.pipelineJobIds.length;
  count += f.marketplaces.length;
  count += f.catalogStatuses.length;
  if (f.minPrice != null) count++;
  if (f.maxPrice != null) count++;
  if (f.hasImage) count++;
  if (f.hasPrice) count++;
  return count;
}

/* ── Recent searches persistence ──────────────────────────── */
function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveRecent(terms: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(terms.slice(0, 10)));
}

export default function CatalogManager() {
  const navigate = useNavigate();
  /* ── State ─────────────────────────────────────────────── */
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [detailSelection, setDetailSelection] = useState<{
    id: string;
    item: SearchItem;
  } | null>(null);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishTargetId, setPublishTargetId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Hydrate filters from URL params on mount
  useEffect(() => {
    const pjParam = searchParams.get('pipelineJobIds');
    const teamParam = searchParams.get('teamIds');
    const mktParam = searchParams.get('marketplaces');
    const qParam = searchParams.get('q');
    if (pjParam || teamParam || mktParam || qParam) {
      setFilters(prev => ({
        ...prev,
        pipelineJobIds: pjParam ? pjParam.split(',').filter(Boolean) : prev.pipelineJobIds,
        teamIds: teamParam ? teamParam.split(',').filter(Boolean) : prev.teamIds,
        marketplaces: mktParam ? mktParam.split(',').filter(Boolean) : prev.marketplaces,
      }));
      if (qParam) {
        setSearchInput(qParam);
        setSearchQuery(qParam);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [exportMenuOpen]);

  /* ── Build search query object ──────────────────────────── */
  const apiQuery: SearchQuery = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      q: searchQuery || undefined,
      sort: sortMode,
      ...filtersToQuery(filters),
    }),
    [searchQuery, page, pageSize, sortMode, filters],
  );

  const { data, loading, error, refetch } = useSearch(apiQuery);
  const { data: facets, loading: facetsLoading } = useDynamicFacets(apiQuery);
  const summary = useSummary();

  const displayItems = data?.items ?? [];

  // Deduplicate by SKU: group items with the same SKU, show one card per SKU
  // with aggregated marketplace badges.
  const dedupedItems = useMemo(() => {
    const groups = new Map<string, { item: SearchItem; marketplaces: Set<string> }>();

    for (const item of displayItems) {
      const sku = item.customLabelSku?.trim();
      if (!sku) {
        // Items without SKU stay as-is (one card per listing record)
        groups.set(item.id, { item, marketplaces: new Set(item.marketplace ? [item.marketplace] : []) });
        continue;
      }

      if (!groups.has(sku)) {
        groups.set(sku, { item, marketplaces: new Set() });
      }

      const group = groups.get(sku)!;
      if (item.marketplace) group.marketplaces.add(item.marketplace);

      // Prefer items with: US marketplace > title > image > later marketplace > current group
      const existing = group.item;
      const preferNew =
        (item.marketplace === 'US' && existing.marketplace !== 'US') ||
        (item.marketplace !== 'DE' && existing.marketplace === 'DE' && item.marketplace !== 'US') ||
        (item.title && !existing.title) ||
        (item.itemPhotoUrl && !existing.itemPhotoUrl) ||
        (item.marketplace && !existing.marketplace) ||
        (item.teamName && !existing.teamName);
      if (preferNew) {
        group.item = item;
      }
    }

    return Array.from(groups.values()).map(({ item, marketplaces }) => ({
      ...item,
      marketplaces: marketplaces.size > 0 ? [...marketplaces].sort() : undefined,
    }));
  }, [displayItems]);

  const { data: publishListingDetail, isLoading: publishListingLoading } =
    useListingDetailQuery(publishModalOpen ? publishTargetId : null);

  const publishListing: SearchItem | null = useMemo(() => {
    if (!publishTargetId) return null;
    const fromGrid = dedupedItems.find((i) => i.id === publishTargetId);
    if (fromGrid) return fromGrid;
    if (!publishListingDetail) return null;
    return {
      ...publishListingDetail,
      relevanceScore: null,
      titleHighlight: null,
      fitmentCount: null,
      cFeatures: null,
    };
  }, [publishTargetId, displayItems, publishListingDetail]);

  const total = data?.total ?? 0;
  const advancedFilterCount = countAdvancedFilters(filters);

  /* ── Reset page on filter/search change ─────────────────── */
  useEffect(() => { setPage(0); }, [searchQuery, filters, sortMode, pageSize]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleSearch = useCallback((val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      setRecentSearches((prev) => {
        const next = [val, ...prev.filter((s) => s !== val)].slice(0, 10);
        saveRecent(next);
        return next;
      });
    }
    // Auto-switch to relevance sort when searching
    if (val.trim()) setSortMode('relevance');
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids.length === 0 ? new Set() : new Set(ids));
  }, []);

  const handleFilterChange = useCallback((f: ActiveFilters) => {
    setFilters(f);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const handlePublish = useCallback((id: string) => {
    setPublishTargetId(id);
    setPublishModalOpen(true);
  }, []);

  const handleBulkPublish = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBulkPublishOpen(true);
  }, [selectedIds]);

  const [exporting, setExporting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleExportTemplates = useCallback(() => {
    if (selectedIds.size === 0) return;
    setExportModalOpen(true);
  }, [selectedIds]);

  const handleBulkPolicyEdit = useCallback(() => {
    if (selectedIds.size === 0) return;
    setPolicyModalOpen(true);
  }, [selectedIds]);

  const handleHeaderPolicyEdit = useCallback(() => {
    if (selectedIds.size === 0) return;
    setPolicyModalOpen(true);
  }, [selectedIds]);

  const teamFilterLabels = useMemo(() => {
    if (!filters.teamIds.length || !facets?.teams) return [];
    return filters.teamIds.map(
      (id) => facets.teams.find((t) => t.value === id)?.label ?? id.slice(0, 8),
    );
  }, [filters.teamIds, facets?.teams]);

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      const fq = filtersToQuery(filters);
      for (const [k, v] of Object.entries(fq)) {
        if (v !== undefined && v !== '') params.set(k, String(v));
      }
      const res = await fetch(`/api/listings/export?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers.get('Content-Disposition');
      a.download = disp?.match(/filename="(.+)"/)?.[1] || 'listings-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [searchQuery, filters]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/listings/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');
      setBulkDeleteConfirm(false);
      setSelectedIds(new Set());
      refetch();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, refetch]);

  const handlePublishComplete = useCallback(() => {
    setPublishModalOpen(false);
    setPublishTargetId(null);
    setBulkPublishOpen(false);
    setExportModalOpen(false);
    setSelectedIds(new Set());
    refetch();
  }, [refetch]);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await deleteListing(deleteConfirmId);
      setDeleteConfirmId(null);
      refetch();
    } catch {
      // keep modal open on error
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmId, refetch]);

  const teamLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of facets?.teams ?? []) {
      if (t.label) map.set(t.value, t.label);
    }
    return map;
  }, [facets?.teams]);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-[1920px] space-y-4 px-2 pb-12 sm:px-4 lg:px-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Catalog
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Search, review, assign teams, and manage parts.
          </p>
          {summary && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {summary.totalRecords.toLocaleString()} listings ·{' '}
              {summary.uniqueSkus.toLocaleString()} SKUs
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Download size={14} /> Export
              <ChevronDown size={12} />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    void handleExportCsv();
                  }}
                  disabled={exporting}
                  className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen(false);
                    if (selectedIds.size > 0) setExportModalOpen(true);
                  }}
                  disabled={selectedIds.size === 0}
                  className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Export templates…
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleHeaderPolicyEdit}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Shield size={14} /> Edit Policies
          </button>

          <button
            type="button"
            onClick={() => navigate('/listings/new')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <PlusCircle size={14} /> Add Part
          </button>
        </div>
      </div>

      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onSearch={handleSearch}
        recentSearches={recentSearches}
        onClearRecent={() => {
          setRecentSearches([]);
          saveRecent([]);
        }}
        placeholder="Search by SKU, title, part number, or notes…"
      />

      <CatalogFilterBar
        facets={facets}
        filters={filters}
        onChange={handleFilterChange}
        onAdvancedClick={() => setAdvancedFilterOpen(true)}
        advancedFilterCount={advancedFilterCount}
        loading={facetsLoading}
      />

      <ActiveFilterTags
        filters={filters}
        searchQuery={searchQuery}
        onChange={handleFilterChange}
        onClearSearch={handleClearSearch}
        teamLabels={teamLabelById}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load results: {error}
        </div>
      )}

      <div className="relative">
        <CatalogBulkBar
          count={selectedIds.size}
          onPublish={handleBulkPublish}
          onEditPolicies={handleBulkPolicyEdit}
          onExport={handleExportTemplates}
          onMore={() => setMoreMenuOpen((v) => !v)}
          onClear={() => setSelectedIds(new Set())}
        />

        {moreMenuOpen && selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {showCatalogDestructiveUi && (
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
              >
                <Trash2 size={12} /> Delete selected
              </button>
            )}
          </div>
        )}

        <CatalogTable
          items={dedupedItems}
          total={total}
          loading={loading}
          page={page}
          pageSize={pageSize}
          sortMode={sortMode}
          onSortChange={setSortMode}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onQuickView={(id, item) => setDetailSelection({ id, item })}
          onPublish={handlePublish}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
        />
      </div>

      {/* Advanced filter drawer (all breakpoints) */}
      <MobileFilterDrawer
        open={advancedFilterOpen}
        onClose={() => setAdvancedFilterOpen(false)}
        filterCount={advancedFilterCount}
        variant="all"
      >
        <FilterSidebar
          facets={facets}
          filters={filters}
          onChange={handleFilterChange}
          loading={facetsLoading}
        />
      </MobileFilterDrawer>

      {/* Inventory summary modal */}
      <CatalogInventoryDetailModal
        id={detailSelection?.id ?? null}
        searchItem={detailSelection?.item ?? null}
        onClose={() => setDetailSelection(null)}
      />

      {/* Delete confirmation modal */}
      {showCatalogDestructiveUi && deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete Listing</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete this listing? It will be soft-deleted and can be restored later.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {showCatalogDestructiveUi && bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete {selectedIds.size} Listings</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete <span className="font-semibold text-slate-600 dark:text-slate-200">{selectedIds.size}</span> selected listings? They will be soft-deleted and can be restored later.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single-item publish modal */}
      {publishTargetId && publishModalOpen && (publishListing || publishListingLoading) && (
        <PublishModal
          mode="single"
          listing={
            publishListing ??
            ({ id: publishTargetId, title: null, customLabelSku: null } as SearchItem)
          }
          open={publishModalOpen && (!publishListingLoading || !!publishListing)}
          onClose={() => { setPublishModalOpen(false); setPublishTargetId(null); }}
          onComplete={handlePublishComplete}
        />
      )}

      {/* Bulk publish modal */}
      <PublishModal
        mode="bulk"
        listingIds={Array.from(selectedIds)}
        open={bulkPublishOpen}
        onClose={() => setBulkPublishOpen(false)}
        onComplete={handlePublishComplete}
      />

      {/* Export templates modal */}
      <ExportTemplatesModal
        open={exportModalOpen}
        listingIds={Array.from(selectedIds)}
        teamIds={filters.teamIds}
        teamLabels={teamFilterLabels}
        onClose={() => setExportModalOpen(false)}
        onComplete={handlePublishComplete}
      />

      <BulkPolicyEditModal
        open={policyModalOpen}
        listingIds={Array.from(selectedIds)}
        teamIds={filters.teamIds}
        teamLabels={teamFilterLabels}
        onClose={() => setPolicyModalOpen(false)}
        onComplete={handlePublishComplete}
      />
    </div>
  );
}
