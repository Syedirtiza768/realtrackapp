import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, Loader2, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PARTS_SEARCH_LIST_FILTERS,
  PARTS_SEARCH_PAGE_SIZES,
  PARTS_SEARCH_SORTS,
  formatTotal,
  paramsFromUrl,
  rememberSearch,
  resultsPath,
  searchParts,
  type PartsSearchParams,
} from '../../lib/partsSearchApi';
import DataSourceNotice from './DataSourceNotice';
import FacetSidebar from './FacetSidebar';
import ResultCard from './ResultCard';
import SearchBox from './SearchBox';

const INTERPRETED_LABELS: Record<string, string> = {
  partNumbers: 'Part number',
  make: 'Make',
  model: 'Model',
  year: 'Year',
  yearRange: 'Years',
  chassis: 'Chassis',
  engineLitres: 'Engine',
  side: 'Side',
  positions: 'Position',
  condition: 'Condition',
  partType: 'Part type',
};

function interpretedChips(interpreted: Record<string, unknown>): Array<{ label: string; value: string }> {
  return Object.entries(interpreted)
    .filter(([key]) => INTERPRETED_LABELS[key])
    .map(([key, value]) => {
      let text: string;
      if (Array.isArray(value)) text = value.join(', ');
      else if (value && typeof value === 'object') {
        const range = value as { from?: number; to?: number };
        text = range.from && range.to ? `${range.from}–${range.to}` : JSON.stringify(value);
      } else text = String(value);
      if (key === 'engineLitres') text = `${text} L`;
      return { label: INTERPRETED_LABELS[key], value: text };
    });
}

export default function PartsSearchClassicResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const params = useMemo(() => paramsFromUrl(searchParams), [searchParams]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (params.q) rememberSearch(params.q);
  }, [params.q]);

  const search = useQuery({
    queryKey: ['parts-search', 'query', searchParams.toString()],
    queryFn: ({ signal }) => searchParts(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  });

  const update = (next: PartsSearchParams) => navigate(resultsPath(next));
  const data = search.data;
  const { q: _q, page: _page, ...keepParams } = params;

  const activeFilters = PARTS_SEARCH_LIST_FILTERS.flatMap((field) => (params[field] ?? []).map((value) => ({ field, value })));
  const extraFilters: Array<{ key: keyof PartsSearchParams; label: string }> = [];
  if (params.year) extraFilters.push({ key: 'year', label: `Year ${params.year}` });
  if (params.inStock) extraFilters.push({ key: 'inStock', label: 'In stock' });
  if (params.hasImage) extraFilters.push({ key: 'hasImage', label: 'Has photos' });
  const filterCount = activeFilters.length + extraFilters.length;

  const sidebar = data ? (
    <FacetSidebar facets={data.facets ?? {}} params={params} audience={data.meta.audience} onChange={update} />
  ) : null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4">
        <SearchBox initialQuery={params.q ?? ''} keepParams={keepParams} />
      </div>

      <div className="flex gap-6">
        <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filters">
          {sidebar}
        </aside>

        <div className="min-w-0 flex-1">
          {/* Summary row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              {data ? (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">{formatTotal(data)}</span> result{data.pagination.totalResults === 1 ? '' : 's'}
                  {params.q && (
                    <>
                      {' '}for <span className="font-semibold">“{params.q}”</span>
                    </>
                  )}
                  {search.isFetching && <Loader2 size={14} className="ml-2 inline animate-spin text-slate-400" aria-label="Updating" />}
                </p>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">{search.isError ? ' ' : 'Searching…'}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-200 lg:hidden"
            >
              <Filter size={14} aria-hidden="true" /> Filters{filterCount ? ` (${filterCount})` : ''}
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                value={params.sort ?? 'relevance'}
                onChange={(event) => update({ ...params, sort: event.target.value, page: undefined })}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {PARTS_SEARCH_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="sr-only">Results per page</span>
              <select
                value={params.pageSize ?? 24}
                onChange={(event) => update({ ...params, pageSize: Number(event.target.value), page: undefined })}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {PARTS_SEARCH_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
            </label>
          </div>

          {data && (
            <div className="mt-2 space-y-2">
              <DataSourceNotice audience={data.meta.audience} internalUnavailableReason={data.meta.internalUnavailableReason} />
              {interpretedChips(data.query.interpreted ?? {}).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Understood as</span>
                  {interpretedChips(data.query.interpreted).map((chip) => (
                    <span key={chip.label} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <span className="text-slate-500 dark:text-slate-400">{chip.label}:</span> {chip.value}
                    </span>
                  ))}
                </div>
              )}
              {data.corrections
                .filter((correction) => correction.type !== 'error')
                .map((correction) => (
                  <p
                    key={correction.type + correction.message}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      correction.type === 'relaxed'
                        ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                        : 'bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300'
                    }`}
                  >
                    {correction.message}
                  </p>
                ))}
            </div>
          )}

          {filterCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeFilters.map(({ field, value }) => (
                <button
                  key={`${field}:${value}`}
                  type="button"
                  onClick={() => {
                    const rest = (params[field] ?? []).filter((item) => item !== value);
                    update({ ...params, [field]: rest.length ? rest : undefined, page: undefined });
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs capitalize text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {value.toLowerCase()} <X size={12} aria-label="Remove filter" />
                </button>
              ))}
              {extraFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => update({ ...params, [filter.key]: undefined, page: undefined })}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {filter.label} <X size={12} aria-label="Remove filter" />
                </button>
              ))}
              <button type="button" onClick={() => update({ q: params.q })} className="px-1 text-xs font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
                Clear all
              </button>
            </div>
          )}

          {/* Body */}
          <div className="mt-4 space-y-3">
            {search.isError && (
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-medium">Search didn’t complete</p>
                  <p className="mt-0.5">{(search.error as Error)?.message ?? 'PartsBazar360 search is unavailable.'}</p>
                </div>
                <button type="button" onClick={() => void search.refetch()} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium dark:border-red-800">
                  <RefreshCw size={12} aria-hidden="true" /> Retry
                </button>
              </div>
            )}

            {data?.meta.degraded && (
              <div role="alert" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
                <span className="flex-1">PartsBazar360’s search index is temporarily unavailable.</span>
                <button type="button" onClick={() => void search.refetch()} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium dark:border-amber-800">
                  <RefreshCw size={12} aria-hidden="true" /> Retry
                </button>
              </div>
            )}

            {!data && search.isLoading &&
              Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
              ))}

            {data && !data.meta.degraded && data.results.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
                <p className="font-medium text-slate-800 dark:text-slate-100">No parts found</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Check the part number, try fewer words, or {filterCount ? 'remove a filter' : 'search by make and part type'}.
                </p>
              </div>
            )}

            {data?.results.map((result) => <ResultCard key={result.id} result={result} />)}
          </div>

          {data && data.pagination.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={!data.pagination.hasPreviousPage}
                onClick={() => update({ ...params, page: data.pagination.page - 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
              >
                <ChevronLeft size={14} aria-hidden="true" /> Previous
              </button>
              <span className="tabular-nums text-slate-600 dark:text-slate-300">
                Page {data.pagination.page} of {Math.min(data.pagination.totalPages, 400).toLocaleString()}
              </span>
              <button
                type="button"
                disabled={!data.pagination.hasNextPage || data.pagination.page >= 400}
                onClick={() => update({ ...params, page: data.pagination.page + 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
              >
                Next <ChevronRight size={14} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(20rem,90vw)] overflow-y-auto bg-white p-4 shadow-xl dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} className="rounded p-1 text-slate-500" aria-label="Close filters">
                <X size={18} />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
