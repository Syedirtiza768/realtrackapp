/* ─── CatalogManager ──────────────────────────────────────
 *  State-of-the-art catalogue search system.
 *  Orchestrates: SearchBar, FilterSidebar, ResultsGrid,
 *  DetailModal, ActiveFilterTags, breadcrumbs, sorting.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  SlidersHorizontal,
  Zap,
  ChevronRight,
  Home,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import SearchBar from './SearchBar';
import FilterSidebar, { MobileFilterDrawer } from './FilterSidebar';
import ActiveFilterTags from './ActiveFilterTags';
import ResultsGrid from './ResultsGrid';
import DetailModal from './DetailModal';
import { useSearch, useSummary, useDynamicFacets } from '../../lib/searchApi';
import type { SearchQuery, SortMode, ActiveFilters } from '../../types/search';
import { EMPTY_FILTERS, filtersToQuery, countActiveFilters } from '../../types/search';

const PAGE_SIZE = 60;
const RECENT_KEY = 'lp_recent_searches';

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
  /* ── State ─────────────────────────────────────────────── */
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent());

  // For infinite scroll mode
  const [infiniteScroll, setInfiniteScroll] = useState(false);
  const [accumulatedItems, setAccumulatedItems] = useState<import('../../types/search').SearchItem[]>([]);

  /* ── Build search query object ──────────────────────────── */
  const apiQuery: SearchQuery = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: infiniteScroll ? 0 : page * PAGE_SIZE,
      q: searchQuery || undefined,
      sort: sortMode,
      ...filtersToQuery(filters),
    }),
    [searchQuery, page, sortMode, filters, infiniteScroll],
  );

  // For infinite scroll, use cursor-based loading
  const infiniteQuery: SearchQuery = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: accumulatedItems.length,
      q: searchQuery || undefined,
      sort: sortMode,
      ...filtersToQuery(filters),
    }),
    [searchQuery, sortMode, filters, accumulatedItems.length],
  );

  const { data, loading, error } = useSearch(infiniteScroll ? infiniteQuery : apiQuery);
  const { data: facets, loading: facetsLoading } = useDynamicFacets(apiQuery);
  const summary = useSummary();

  /* ── Infinite scroll accumulation ──────────────────────── */
  useEffect(() => {
    if (infiniteScroll && data?.items) {
      if (data.offset === 0) {
        setAccumulatedItems(data.items);
      } else {
        setAccumulatedItems((prev) => [...prev, ...data.items]);
      }
    }
  }, [data, infiniteScroll]);

  // Reset accumulated items when query changes fundamentally
  useEffect(() => {
    setAccumulatedItems([]);
  }, [searchQuery, sortMode, filters]);

  const displayItems = infiniteScroll ? accumulatedItems : (data?.items ?? []);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasMore = infiniteScroll && data?.nextCursor !== null;
  const queryTimeMs = data?.queryTimeMs ?? 0;

  /* ── Reset page on filter/search change ─────────────────── */
  useEffect(() => { setPage(0); }, [searchQuery, filters, sortMode]);

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

  const handleFilterChange = useCallback((f: ActiveFilters) => {
    setFilters(f);
  }, []);

  const loadMore = useCallback(() => {
    // Trigger re-fetch with new offset
    setAccumulatedItems((prev) => prev); // force update
  }, []);

  const activeFilterCount = countActiveFilters(filters);

  /* ── Breadcrumbs ────────────────────────────────────────── */
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick?: () => void }[] = [
      { label: 'Home', onClick: () => { /* navigate to / */ } },
      { label: 'Catalog' },
    ];
    if (searchQuery.trim()) {
      crumbs.push({ label: `"${searchQuery}"` });
    }
    if (filters.brands.length === 1) {
      crumbs.push({
        label: filters.brands[0],
        onClick: () => setFilters({ ...EMPTY_FILTERS, brands: filters.brands }),
      });
    }
    if (filters.categoryNames.length === 1) {
      const parts = filters.categoryNames[0].split('/').filter(Boolean);
      crumbs.push({ label: parts[parts.length - 1] });
    }
    return crumbs;
  }, [searchQuery, filters]);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="space-y-4 pb-24">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} className="text-slate-700" />}
            {i === 0 && <Home size={11} />}
            {crumb.onClick ? (
              <button onClick={crumb.onClick} className="hover:text-slate-300 transition-colors">
                {crumb.label}
              </button>
            ) : (
              <span className={i === breadcrumbs.length - 1 ? 'text-slate-300' : ''}>
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100">Catalog</h2>
          <p className="text-sm text-slate-500 mt-1">
            {summary
              ? `${summary.totalRecords.toLocaleString()} listings · ${summary.uniqueSkus.toLocaleString()} unique SKUs · ${summary.files} source files`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle infinite scroll */}
          <button
            onClick={() => {
              setInfiniteScroll((v) => !v);
              setAccumulatedItems([]);
              setPage(0);
            }}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs transition-colors ${
              infiniteScroll
                ? 'border-blue-600 text-blue-400 bg-blue-600/10'
                : 'border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Zap size={13} />
            {infiniteScroll ? 'Infinite Scroll' : 'Pagination'}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 text-xs transition-colors">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Search bar */}
      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onSearch={handleSearch}
        recentSearches={recentSearches}
        onClearRecent={() => { setRecentSearches([]); saveRecent([]); }}
      />

      {/* Active filter tags */}
      <ActiveFilterTags
        filters={filters}
        searchQuery={searchQuery}
        onChange={handleFilterChange}
        onClearSearch={handleClearSearch}
      />

      {/* Main content layout: sidebar + results */}
      <div className="flex gap-5">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <FilterSidebar
            facets={facets}
            filters={filters}
            onChange={handleFilterChange}
            loading={facetsLoading}
          />
        </aside>

        {/* Results area */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="border-b border-slate-800 py-3 px-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Left: result info */}
                <div className="flex items-center gap-3">
                  {/* Mobile filter button */}
                  <button
                    onClick={() => setMobileFilterOpen(true)}
                    className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <SlidersHorizontal size={13} />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 py-0.5 ml-0.5">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <span className="text-xs text-slate-500">
                    {loading ? (
                      'Searching…'
                    ) : (
                      <>
                        <span className="text-slate-300 font-semibold">{total.toLocaleString()}</span> results
                        {queryTimeMs > 0 && (
                          <span className="text-slate-600"> ({queryTimeMs}ms)</span>
                        )}
                        {!infiniteScroll && totalPages > 1 && (
                          <span className="text-slate-600">
                            {' · Page '}
                            <span className="text-slate-400">{page + 1}</span>
                            {' of '}
                            {totalPages}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </div>

                {/* Right: sort + view */}
                <div className="flex items-center gap-2">
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                    <option value="newest">Newest First</option>
                    <option value="title_asc">Title: A → Z</option>
                    <option value="title_desc">Title: Z → A</option>
                    <option value="sku_asc">SKU: A → Z</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 relative">
              {/* Error state */}
              {error && (
                <div className="rounded-xl border border-red-800 bg-red-950/40 p-5 text-center text-red-400 text-sm mb-4">
                  <p className="font-medium mb-1">Failed to load results</p>
                  <p className="text-xs text-red-500">{error}. Make sure the backend is running.</p>
                </div>
              )}

              <ResultsGrid
                items={displayItems}
                total={total}
                loading={loading}
                page={page}
                pageSize={PAGE_SIZE}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onPageChange={setPage}
                onQuickView={setDetailId}
                infiniteScroll={infiniteScroll}
                hasMore={hasMore}
                onLoadMore={loadMore}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <MobileFilterDrawer
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        filterCount={activeFilterCount}
      >
        <FilterSidebar
          facets={facets}
          filters={filters}
          onChange={handleFilterChange}
          loading={facetsLoading}
        />
      </MobileFilterDrawer>

      {/* Detail modal */}
      <DetailModal id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
