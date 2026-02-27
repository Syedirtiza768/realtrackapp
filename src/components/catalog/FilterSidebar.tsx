/* ─── FilterSidebar ────────────────────────────────────────
 *  Comprehensive filter sidebar with all filter dimensions.
 *  Desktop: visible sidebar with multi-select checkboxes.
 *  Mobile: slide-out drawer panel.
 *
 *  Filter sections (in order):
 *  1. Availability toggles (Has Image, Has Price)
 *  2. Price Range (min/max inputs)
 *  3. Make (vehicle make from fitment, multi-select)
 *  4. Model (vehicle model from fitment, cascading)
 *  5. Brand (multi-select with counts)
 *  6. Category (multi-select, hierarchical path display)
 *  7. Condition (multi-select with labels)
 *  8. Type (multi-select)
 *  9. Format (multi-select — FixedPrice, etc.)
 *  10. Location (multi-select)
 *  11. MPN (multi-select, searchable)
 *  12. Source File (multi-select)
 *
 *  Each section: collapsible, quick-filter search, show all,
 *  selected count badge, dynamic counts from facets API.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Filter,
  Check,
  RotateCcw,
} from 'lucide-react';
import type {
  ActiveFilters,
  DynamicFacets,
  FacetBucket,
  CategoryFacetBucket,
} from '../../types/search';
import { conditionLabel, countActiveFilters, EMPTY_FILTERS } from '../../types/search';

/* ── Props ────────────────────────────────────────────────── */

interface Props {
  facets: DynamicFacets | null;
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  loading?: boolean;
}

/* ── Mobile drawer wrapper ────────────────────────────────── */

export function MobileFilterDrawer({
  open,
  onClose,
  children,
  filterCount,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  filterCount: number;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 animate-fade-in" />
      <div
        className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-900 border-r border-slate-700 shadow-2xl flex flex-col animate-slide-in-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <SlidersHorizontal size={16} />
            Filters
            {filterCount > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
                {filterCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">{children}</div>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Show Results
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main sidebar ─────────────────────────────────────────── */

export default function FilterSidebar({ facets, filters, onChange, loading }: Props) {
  const activeCount = countActiveFilters(filters);

  const clearAll = useCallback(
    () => onChange({ ...EMPTY_FILTERS }),
    [onChange],
  );

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Filter size={14} />
          Filters
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            <RotateCcw size={10} />
            Clear all
          </button>
        )}
      </div>

      {/* ── 1. Availability toggles ───────────────────────── */}
      <ToggleFilterGroup
        label="Availability"
        items={[
          {
            label: 'Has Image',
            checked: filters.hasImage,
            onChange: (v) => onChange({ ...filters, hasImage: v }),
          },
          {
            label: 'Has Price',
            checked: filters.hasPrice,
            onChange: (v) => onChange({ ...filters, hasPrice: v }),
          },
        ]}
      />

      {/* ── 2. Price range ────────────────────────────────── */}
      <PriceRangeFilter
        min={facets?.priceRange.min ?? null}
        max={facets?.priceRange.max ?? null}
        currentMin={filters.minPrice}
        currentMax={filters.maxPrice}
        onChange={(min, max) => onChange({ ...filters, minPrice: min, maxPrice: max })}
      />

      {/* ── 3. Make (vehicle make extracted from title) ────── */}
      <MultiSelectFacet
        title="Make"
        buckets={facets?.makes ?? []}
        selected={filters.makes}
        onChange={(vals) => {
          // When makes change, reset models to avoid stale selections
          onChange({ ...filters, makes: vals, makeNames: vals, models: [], modelNames: [] });
        }}
        getLabel={(b) => b.value}
        loading={loading}
        defaultExpanded
      />

      {/* ── 4. Model (vehicle model extracted from title) ──── */}
      <MultiSelectFacet
        title="Model"
        buckets={facets?.models ?? []}
        selected={filters.models}
        onChange={(vals) => {
          onChange({ ...filters, models: vals, modelNames: vals });
        }}
        getLabel={(b) => b.value}
        loading={loading}
        defaultExpanded={filters.makes.length > 0}
      />

      {/* ── 5. Category ───────────────────────────────────── */}
      <MultiSelectFacet
        title="Category"
        buckets={facets?.categories ?? []}
        selected={filters.categories}
        onChange={(vals) => {
          const catNames = vals.map((catId) => {
            const cat = facets?.categories.find((c) => c.id === catId);
            return cat?.value ?? catId;
          });
          onChange({ ...filters, categories: vals, categoryNames: catNames });
        }}
        getKey={(b) => (b as CategoryFacetBucket).id}
        getLabel={(b) => {
          const parts = b.value.split('/').filter(Boolean);
          return parts.length > 0 ? parts[parts.length - 1] : b.value;
        }}
        getTooltip={(b) => b.value}
        loading={loading}
        defaultExpanded
      />

      {/* ── 7. Condition ──────────────────────────────────── */}
      <MultiSelectFacet
        title="Condition"
        buckets={facets?.conditions ?? []}
        selected={filters.conditions}
        onChange={(vals) => onChange({ ...filters, conditions: vals })}
        getLabel={(b) => conditionLabel(b.value)}
        loading={loading}
        defaultExpanded
      />

      {/* ── 8. Type ───────────────────────────────────────── */}
      <MultiSelectFacet
        title="Type"
        buckets={facets?.types ?? []}
        selected={filters.types}
        onChange={(vals) => onChange({ ...filters, types: vals })}
        loading={loading}
      />

      {/* ── 9. Format ─────────────────────────────────────── */}
      <MultiSelectFacet
        title="Format"
        buckets={facets?.formats ?? []}
        selected={filters.formats}
        onChange={(vals) => onChange({ ...filters, formats: vals })}
        loading={loading}
      />

      {/* ── 10. Location ───────────────────────────────────── */}
      <MultiSelectFacet
        title="Location"
        buckets={facets?.locations ?? []}
        selected={filters.locations}
        onChange={(vals) => onChange({ ...filters, locations: vals })}
        loading={loading}
      />

      {/* ── 11. MPN (Manufacturer Part Number) ─────────────── */}
      <MultiSelectFacet
        title="MPN"
        buckets={facets?.mpns ?? []}
        selected={filters.mpns}
        onChange={(vals) => onChange({ ...filters, mpns: vals })}
        loading={loading}
        initialShowCount={6}
      />

      {/* ── 12. Source File ───────────────────────────────── */}
      <MultiSelectFacet
        title="Source File"
        buckets={facets?.sourceFiles ?? []}
        selected={filters.sourceFiles}
        onChange={(vals) => onChange({ ...filters, sourceFiles: vals })}
        getLabel={(b) => b.value.replace('.xlsx', '')}
        loading={loading}
      />

      {/* Footer info */}
      {facets && (
        <div className="pt-2 border-t border-slate-800">
          <p className="text-[10px] text-slate-600 text-center">
            {facets.totalFiltered.toLocaleString()} matching listings
            {facets.queryTimeMs > 0 && ` · ${facets.queryTimeMs}ms`}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Multi-select facet group ─────────────────────────────── */

function MultiSelectFacet({
  title,
  buckets,
  selected,
  onChange,
  getKey,
  getLabel,
  getTooltip,
  loading,
  defaultExpanded = false,
  initialShowCount = 8,
}: {
  title: string;
  buckets: FacetBucket[];
  selected: string[];
  onChange: (values: string[]) => void;
  getKey?: (b: FacetBucket) => string;
  getLabel?: (b: FacetBucket) => string;
  getTooltip?: (b: FacetBucket) => string;
  loading?: boolean;
  defaultExpanded?: boolean;
  initialShowCount?: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [filterText, setFilterText] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Auto-expand if there are selected values in this section
  useEffect(() => {
    if (selected.length > 0) setExpanded(true);
  }, [selected.length]);

  const keyFn = getKey ?? ((b: FacetBucket) => b.value);
  const labelFn = getLabel ?? ((b: FacetBucket) => b.value);

  // Sort: selected items first, then by count descending
  const sorted = useMemo(() => {
    if (!buckets.length) return [];
    return [...buckets].sort((a, b) => {
      const aSelected = selected.includes(keyFn(a)) ? 1 : 0;
      const bSelected = selected.includes(keyFn(b)) ? 1 : 0;
      if (aSelected !== bSelected) return bSelected - aSelected;
      return b.count - a.count;
    });
  }, [buckets, selected, keyFn]);

  const filtered = useMemo(() => {
    if (!filterText.trim()) return sorted;
    const lc = filterText.toLowerCase();
    return sorted.filter(
      (b) => labelFn(b).toLowerCase().includes(lc) || b.value.toLowerCase().includes(lc),
    );
  }, [sorted, filterText, labelFn]);

  const visible = showAll ? filtered : filtered.slice(0, initialShowCount);
  const hasMore = filtered.length > initialShowCount;

  const toggle = useCallback(
    (key: string) => {
      onChange(
        selected.includes(key)
          ? selected.filter((v) => v !== key)
          : [...selected, key],
      );
    },
    [selected, onChange],
  );

  if (buckets.length === 0 && !loading) return null;

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-800/40 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {title}
          {selected.length > 0 && (
            <span className="bg-blue-600/20 text-blue-400 text-[10px] rounded-full px-1.5 py-0.5 normal-case font-medium tracking-normal">
              {selected.length}
            </span>
          )}
          {loading && buckets.length === 0 && (
            <span className="text-slate-600 text-[10px] normal-case tracking-normal">loading…</span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {/* Quick filter within facets */}
          {buckets.length > 6 && (
            <input
              type="text"
              value={filterText}
              onChange={(e) => { setFilterText(e.target.value); setShowAll(true); }}
              placeholder={`Search ${title.toLowerCase()}…`}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 mb-1"
            />
          )}

          {/* Loading skeleton */}
          {loading && buckets.length === 0 && (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-1.5 py-1">
                  <div className="w-3.5 h-3.5 rounded border border-slate-700 bg-slate-800 animate-pulse" />
                  <div className="h-3 bg-slate-800 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                </div>
              ))}
            </div>
          )}

          {/* Checkbox list — selected pinned to top */}
          {visible.map((b) => {
            const key = keyFn(b);
            const isSelected = selected.includes(key);
            const label = labelFn(b);
            const tooltip = getTooltip?.(b);

            return (
              <label
                key={key}
                title={tooltip}
                className={`flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer text-xs transition-colors ${
                  isSelected
                    ? 'text-blue-300 bg-blue-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-slate-600 bg-transparent'
                  }`}
                >
                  {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(key)}
                  className="sr-only"
                />
                <span className="truncate flex-1">{label}</span>
                <span className="text-[10px] tabular-nums text-slate-600 shrink-0">
                  {loading ? '…' : b.count.toLocaleString()}
                </span>
              </label>
            );
          })}

          {/* No matches */}
          {filterText.trim() && filtered.length === 0 && (
            <p className="text-[11px] text-slate-600 px-1.5 py-1">No matching {title.toLowerCase()}</p>
          )}

          {hasMore && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-[11px] text-blue-400 hover:text-blue-300 mt-1 transition-colors"
            >
              {showAll ? 'Show less' : `Show all ${filtered.length}`}
            </button>
          )}

          {/* Quick clear for this section */}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 mt-0.5 transition-colors"
            >
              Clear {title.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Toggle filter group ──────────────────────────────────── */

function ToggleFilterGroup({
  label,
  items,
}: {
  label: string;
  items: { label: string; checked: boolean; onChange: (v: boolean) => void }[];
}) {
  const [expanded, setExpanded] = useState(true);
  const anyActive = items.some((i) => i.checked);

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-800/40 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {label}
          {anyActive && (
            <span className="bg-blue-600/20 text-blue-400 text-[10px] rounded-full px-1.5 py-0.5 normal-case font-medium tracking-normal">
              {items.filter((i) => i.checked).length}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {items.map((item) => (
            <label
              key={item.label}
              className={`flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer text-xs transition-colors ${
                item.checked
                  ? 'text-blue-300 bg-blue-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  item.checked ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                }`}
              >
                {item.checked && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="sr-only"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Price range filter ───────────────────────────────────── */

function PriceRangeFilter({
  min,
  max,
  currentMin,
  currentMax,
  onChange,
}: {
  min: number | null;
  max: number | null;
  currentMin: number | null;
  currentMax: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [localMin, setLocalMin] = useState(currentMin?.toString() ?? '');
  const [localMax, setLocalMax] = useState(currentMax?.toString() ?? '');

  // Sync when external value resets (e.g., clear all)
  useEffect(() => {
    setLocalMin(currentMin?.toString() ?? '');
    setLocalMax(currentMax?.toString() ?? '');
  }, [currentMin, currentMax]);

  const hasValue = currentMin != null || currentMax != null;

  const apply = () => {
    const parsedMin = localMin.trim() ? parseFloat(localMin) : null;
    const parsedMax = localMax.trim() ? parseFloat(localMax) : null;
    onChange(
      parsedMin != null && !isNaN(parsedMin) ? parsedMin : null,
      parsedMax != null && !isNaN(parsedMax) ? parsedMax : null,
    );
  };

  const clear = () => {
    setLocalMin('');
    setLocalMax('');
    onChange(null, null);
  };

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-800/40 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          Price
          {hasValue && (
            <span className="text-blue-400 normal-case font-normal tracking-normal text-[10px]">
              {currentMin != null ? `$${currentMin}` : '$0'}
              {' — '}
              {currentMax != null ? `$${currentMax}` : 'Any'}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {min != null && max != null && (
            <p className="text-[10px] text-slate-600">
              Range: ${min.toFixed(0)} — ${max.toFixed(0)}
            </p>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-xs">$</span>
              <input
                type="number"
                value={localMin}
                onChange={(e) => setLocalMin(e.target.value)}
                onBlur={apply}
                onKeyDown={(e) => e.key === 'Enter' && apply()}
                placeholder="Min"
                min={0}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-md pl-5 pr-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
            <span className="text-slate-600 text-xs">—</span>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-xs">$</span>
              <input
                type="number"
                value={localMax}
                onChange={(e) => setLocalMax(e.target.value)}
                onBlur={apply}
                onKeyDown={(e) => e.key === 'Enter' && apply()}
                placeholder="Max"
                min={0}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-md pl-5 pr-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={apply}
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-xs text-slate-300 transition-colors"
            >
              Apply
            </button>
            {hasValue && (
              <button
                onClick={clear}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
