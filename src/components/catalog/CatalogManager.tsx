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
import { useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';
import FilterSidebar, { MobileFilterDrawer } from './FilterSidebar';
import ActiveFilterTags from './ActiveFilterTags';
import CatalogInventoryDetailModal from './CatalogInventoryDetailModal';
import PublishModal, { type PublishStartParams } from '../channels/PublishModal';
import PublishProgressPanel, { type PublishJob } from './PublishProgressPanel';
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
import { usePermissions } from '../../hooks/usePermissions';
import type { SearchQuery, SortMode, ActiveFilters, DateAddedPreset } from '../../types/search';
import { EMPTY_FILTERS, filtersToQuery, countActiveFilters } from '../../types/search';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useSessionState } from '../../hooks/useSessionState';

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
  const { has } = usePermissions();
  const canDeleteListings = has('listings.delete');
  /* ── State (synced to URL) ─────────────────────────────── */
  const [urlState, setUrlState] = useUrlFilters({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: 'newest' as string,
    q: '',
  }, 'catalog-url');
  const page = urlState.page;
  const pageSize = urlState.pageSize;
  const sortMode = urlState.sort as SortMode;
  const searchQuery = urlState.q;
  const setPage = (v: number | ((prev: number) => number)) =>
    setUrlState(typeof v === 'function' ? (prev) => ({ page: v(prev.page) }) : { page: v });
  const setPageSize = (size: number) => setUrlState({ pageSize: size, page: 0 });
  const setSortMode = (m: SortMode) => setUrlState({ sort: m, page: 0 });
  const setSearchQuery = (q: string) => setUrlState({ q, page: 0 });

  const [searchInput, setSearchInput] = useState(searchQuery);
  const [filters, setFilters] = useSessionState<ActiveFilters>(
    'catalog-filters',
    EMPTY_FILTERS,
    urlFilterOverrides,
  );
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
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);

  // Parse URL filter overrides for bookmarked/shared links
  const urlFilterOverrides = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    const result: Partial<ActiveFilters> = {};
    const arrayFields: (keyof ActiveFilters)[] = [
      'brands', 'categories', 'conditions', 'types', 'sourceFiles',
      'formats', 'locations', 'mpns', 'makes', 'models',
      'pipelineJobIds', 'teamIds', 'marketplaces', 'stockLevels',
      'shippingProfiles', 'catalogStatuses',
    ];
    let hasAny = false;
    for (const field of arrayFields) {
      const val = sp.get(field);
      if (val) {
        (result as Record<string, unknown>)[field] = val.split(',').filter(Boolean);
        hasAny = true;
      }
    }
    const minPrice = sp.get('minPrice');
    const maxPrice = sp.get('maxPrice');
    const hasImage = sp.get('hasImage');
    const hasPrice = sp.get('hasPrice');
    const dateAddedPreset = sp.get('dateAddedPreset');
    const dateAddedFrom = sp.get('dateAddedFrom');
    const dateAddedTo = sp.get('dateAddedTo');
    if (minPrice) { result.minPrice = Number(minPrice); hasAny = true; }
    if (maxPrice) { result.maxPrice = Number(maxPrice); hasAny = true; }
    if (hasImage === '1') { result.hasImage = true; hasAny = true; }
    if (hasPrice === '1') { result.hasPrice = true; hasAny = true; }
    if (dateAddedPreset) { result.dateAddedPreset = dateAddedPreset as DateAddedPreset; hasAny = true; }
    if (dateAddedFrom) { result.dateAddedFrom = dateAddedFrom; hasAny = true; }
    if (dateAddedTo) { result.dateAddedTo = dateAddedTo; hasAny = true; }
    return hasAny ? result : null;
  }, []);

  // Sync filters → URL (on filter change)
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  useEffect(() => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    const f = filters;
    const arrayFields: { key: keyof ActiveFilters; param: string }[] = [
      { key: 'brands', param: 'brands' },
      { key: 'categories', param: 'categories' },
      { key: 'conditions', param: 'conditions' },
      { key: 'types', param: 'types' },
      { key: 'sourceFiles', param: 'sourceFiles' },
      { key: 'formats', param: 'formats' },
      { key: 'locations', param: 'locations' },
      { key: 'mpns', param: 'mpns' },
      { key: 'makes', param: 'makes' },
      { key: 'models', param: 'models' },
      { key: 'pipelineJobIds', param: 'pipelineJobIds' },
      { key: 'teamIds', param: 'teamIds' },
      { key: 'marketplaces', param: 'marketplaces' },
      { key: 'stockLevels', param: 'stockLevels' },
      { key: 'shippingProfiles', param: 'shippingProfiles' },
      { key: 'catalogStatuses', param: 'catalogStatuses' },
    ];
    for (const { key, param } of arrayFields) {
      const arr = f[key] as string[];
      if (arr.length > 0) sp.set(param, arr.join(','));
      else sp.delete(param);
    }
    // Scalar filter fields
    const setOrDel = (k: string, v: unknown, def?: unknown) => {
      if (v != null && v !== false && v !== '' && v !== def) sp.set(k, String(v));
      else sp.delete(k);
    };
    setOrDel('minPrice', f.minPrice);
    setOrDel('maxPrice', f.maxPrice);
    setOrDel('hasImage', f.hasImage);
    setOrDel('hasPrice', f.hasPrice);
    setOrDel('dateAddedPreset', f.dateAddedPreset, 'all');
    setOrDel('dateAddedFrom', f.dateAddedFrom);
    setOrDel('dateAddedTo', f.dateAddedTo);
    window.history.replaceState(null, '', url.toString());
  }, [filters]);

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
      // Collapse marketplace/SKU siblings server-side so total + pagination
      // reflect unique SKUs (backend aggregates sibling marketplaces).
      groupBySku: '1',
      ...filtersToQuery(filters),
    }),
    [searchQuery, page, pageSize, sortMode, filters],
  );

  const { data, loading, error, refetch } = useSearch(apiQuery);
  const { data: facets, loading: facetsLoading } = useDynamicFacets(apiQuery);
  const summary = useSummary();

  const displayItems = data?.items ?? [];

  // The backend collapses marketplace/SKU siblings into one row per SKU (see
  // groupBySku in apiQuery) and returns aggregated `marketplaces`, so the grid
  // renders the server rows directly — no client-side dedup needed.
  const dedupedItems = displayItems;

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
  const hasActiveFilters = !!searchQuery?.trim() || countActiveFilters(filters) > 0;

  /* ── Reset page on filter change ──────────────────────── */
  useEffect(() => { setPage(0); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleFilterChange = useCallback((f: ActiveFilters | ((prev: ActiveFilters) => ActiveFilters)) => {
    setFilters(f);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
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

  const handlePublishStart = useCallback((params: PublishStartParams) => {
    setPublishModalOpen(false);
    setBulkPublishOpen(false);

    // Build a listingId → title map from the loaded catalog rows so the
    // bulk progress panel can show each listing's name as it publishes.
    let listingNames: Record<string, string> | undefined;
    if (params.listingIds?.length) {
      const idSet = new Set(params.listingIds);
      listingNames = {};
      for (const item of displayItems) {
        if (idSet.has(item.id) && item.title) listingNames[item.id] = item.title;
      }
    }

    setPublishJob({
      id: `pub-${Date.now()}`,
      mode: params.mode,
      listing: params.listing,
      listingIds: params.listingIds,
      listingNames,
      stores: params.stores,
      overrides: params.overrides,
      profiles: params.profiles,
    });
  }, [displayItems]);

  const handlePublishDismiss = useCallback(() => {
    setPublishJob(null);
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

      {/* Filter summary bar */}
      {hasActiveFilters && summary && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs dark:border-blue-800 dark:bg-blue-950/30">
          <span className="font-medium text-blue-700 dark:text-blue-300">
            {total.toLocaleString()}
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            of {summary.totalRecords.toLocaleString()} listings match your filters
          </span>
          <span className="ml-auto text-[10px] text-blue-500 dark:text-blue-500">
            {data?.queryTimeMs != null && `${data.queryTimeMs}ms`}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Failed to load results: {error}
        </div>
      )}

      <div className="relative">
        {/* Inline publish progress panel */}
        {publishJob && (
          <div className="mb-3">
            <PublishProgressPanel
              key={publishJob.id}
              job={publishJob}
              onDismiss={handlePublishDismiss}
            />
          </div>
        )}

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
            {canDeleteListings && (
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
          onDelete={canDeleteListings ? handleDelete : undefined}
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
        onSaved={() => refetch()}
      />

      {/* Delete confirmation modal */}
      {canDeleteListings && deleteConfirmId && (
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
      {canDeleteListings && bulkDeleteConfirm && (
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
          onPublishStart={handlePublishStart}
        />
      )}

      {/* Bulk publish modal */}
      <PublishModal
        mode="bulk"
        listingIds={Array.from(selectedIds)}
        open={bulkPublishOpen}
        onClose={() => setBulkPublishOpen(false)}
        onPublishStart={handlePublishStart}
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
