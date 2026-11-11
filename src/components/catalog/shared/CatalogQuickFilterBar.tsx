import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import type {
  CatalogConfig,
  CatalogFacets,
  CatalogFilters,
  CatalogStock,
  FacetBucket,
} from './catalogTypes';
import { activeFilterCount } from './CatalogFilterControls';

type Props = {
  config: CatalogConfig;
  facets: CatalogFacets | null;
  filters: CatalogFilters;
  onChange: (patch: Partial<CatalogFilters>) => void;
  onAdvancedClick: () => void;
  loading?: boolean;
};

const STOCK_OPTIONS: Array<{ value: CatalogStock; label: string }> = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

function formatFacetLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function FilterDropdown({
  label,
  summary,
  children,
  disabled = false,
  active = false,
  fashion = false,
}: {
  label: string;
  summary: string;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  fashion?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-slate-200 ${active ? (fashion ? 'border-pink-200 bg-pink-50 text-pink-800 hover:border-pink-300 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-200' : 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200') : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'}`}
        aria-expanded={open}
        aria-label={`${label}${summary !== 'All' ? `: ${summary}` : ''}`}
      >
        <span>{label}</span>
        {summary !== 'All' ? (
          <span className="max-w-28 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {summary}
          </span>
        ) : null}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1 min-w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function CheckboxOption({
  checked,
  label,
  count,
  onToggle,
}: {
  checked: boolean;
  label: string;
  count?: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          checked
            ? 'border-indigo-600 bg-indigo-600 text-white'
            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
        }`}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === 'number' ? (
        <span className="text-[11px] text-slate-400">{count}</span>
      ) : null}
    </button>
  );
}

function facetLabel(bucket: FacetBucket | undefined, value: string): string {
  return bucket?.label || formatFacetLabel(value);
}

function FacetDropdown({
  label,
  buckets,
  selected,
  onChange,
  loading,
  valueLabels,
  fashion = false,
}: {
  label: string;
  buckets: FacetBucket[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading: boolean;
  valueLabels?: Record<string, string>;
  fashion?: boolean;
}) {
  const [search, setSearch] = useState('');
  const visibleBuckets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...buckets]
      .filter((bucket) => !query || (valueLabels?.[bucket.value] || facetLabel(bucket, bucket.value)).toLocaleLowerCase().includes(query) || bucket.value.toLocaleLowerCase().includes(query))
      .sort((left, right) => Number(selected.includes(right.value)) - Number(selected.includes(left.value)) || right.count - left.count || facetLabel(left, left.value).localeCompare(facetLabel(right, right.value)));
  }, [buckets, search, selected, valueLabels]);
  const selectedLabel =
    selected.length === 0
      ? 'All'
      : selected.length === 1
        ? valueLabels?.[selected[0]] || facetLabel(buckets.find((bucket) => bucket.value === selected[0]), selected[0])
        : `${selected.length} selected`;

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  return (
    <FilterDropdown label={label} summary={selectedLabel} active={selected.length > 0} fashion={fashion}>
      {buckets.length > 8 ? (
        <label className="relative block border-b border-slate-100 px-2 py-2 dark:border-slate-800">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={13} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            aria-label={`Search ${label}`}
          />
        </label>
      ) : null}
      <div className="max-h-72 overflow-y-auto py-1">
        {loading ? (
          <p className="px-3 py-3 text-xs text-slate-500">Loading…</p>
        ) : !visibleBuckets.length ? (
          <p className="px-3 py-3 text-xs text-slate-500">No options available</p>
        ) : (
          visibleBuckets.map((bucket) => (
            <CheckboxOption
              key={bucket.value}
              checked={selected.includes(bucket.value)}
              label={valueLabels?.[bucket.value] || facetLabel(bucket, bucket.value)}
              count={bucket.count}
              onToggle={() => toggle(bucket.value)}
            />
          ))
        )}
      </div>
    </FilterDropdown>
  );
}

function selectedCount(values: string[] | CatalogStock[]): number {
  return values.length;
}

export default function CatalogQuickFilterBar({
  config,
  facets,
  filters,
  onChange,
  onAdvancedClick,
  loading = false,
}: Props) {
  const isFashion = config.vertical === 'fashion';
  const fashionAttributes = isFashion
    ? config.attributes.filter((attribute) => config.quickAttributes.includes(attribute.key) && attribute.key !== 'brand')
    : [];
  const quickCount =
    isFashion
      ? selectedCount(filters.brands) +
        selectedCount(filters.categories) +
        selectedCount(filters.conditions) +
        selectedCount(filters.catalogStatuses) +
        selectedCount(filters.stockLevels) +
        fashionAttributes.reduce((count, attribute) => count + selectedCount(filters.attributes[attribute.key] || []), 0)
      : selectedCount(filters.brands) +
        selectedCount(filters.conditions) +
        selectedCount(filters.validationStatuses) +
        selectedCount(filters.catalogStatuses) +
        selectedCount(filters.stockLevels) +
        selectedCount(filters.teamIds) +
        selectedCount(filters.shippingProfiles);
  const advancedCount = Math.max(0, activeFilterCount(filters) - quickCount);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Catalog quick filters">
      <FilterDropdown
        label={isFashion ? 'Stock' : 'Stock Level'}
        summary={filters.stockLevels.length === 0 ? 'All' : `${filters.stockLevels.length} selected`}
        active={filters.stockLevels.length > 0}
        fashion={isFashion}
      >
        <div className="py-1">
          {STOCK_OPTIONS.map((option) => (
            <CheckboxOption
              key={option.value}
              checked={filters.stockLevels.includes(option.value)}
              label={option.label}
              onToggle={() =>
                onChange({
                  stockLevels: filters.stockLevels.includes(option.value)
                    ? filters.stockLevels.filter((item) => item !== option.value)
                    : [...filters.stockLevels, option.value],
                })
              }
            />
          ))}
        </div>
      </FilterDropdown>

      <FacetDropdown
        label={config.filterLabels?.brands || 'Brand'}
        buckets={facets?.brands ?? []}
        selected={filters.brands}
        onChange={(brands) => onChange({ brands })}
        loading={loading}
        fashion={isFashion}
      />
      {isFashion ? (
        <FacetDropdown
          label={config.filterLabels?.categories || 'Category'}
          buckets={facets?.categories ?? []}
          selected={filters.categories}
          onChange={(categories) => onChange({ categories })}
          loading={loading}
          fashion
        />
      ) : null}
      <FacetDropdown
        label="Condition"
        buckets={facets?.conditions ?? []}
        selected={filters.conditions}
        onChange={(conditions) => onChange({ conditions })}
        loading={loading}
        fashion={isFashion}
      />
      {!isFashion ? (
        <FacetDropdown
          label="Review Status"
          buckets={facets?.validationStatuses ?? []}
          selected={filters.validationStatuses}
          onChange={(validationStatuses) => onChange({ validationStatuses })}
          loading={loading}
        />
      ) : null}
      <FacetDropdown
        label="Status"
        buckets={facets?.catalogStatuses ?? []}
        selected={filters.catalogStatuses}
        onChange={(catalogStatuses) => onChange({ catalogStatuses })}
        loading={loading}
        fashion={isFashion}
      />
      {isFashion ? fashionAttributes.map((attribute) => (
        <FacetDropdown
          key={attribute.key}
          label={attribute.label}
          buckets={facets?.attributeFacets[attribute.key] ?? []}
          selected={filters.attributes[attribute.key] || []}
          onChange={(values) => onChange({ attributes: { ...filters.attributes, [attribute.key]: values } })}
          loading={loading}
          valueLabels={attribute.valueLabels}
          fashion
        />
      )) : (
        <>
          <FacetDropdown
            label="Team"
            buckets={facets?.teams ?? []}
            selected={filters.teamIds}
            onChange={(teamIds) => onChange({ teamIds })}
            loading={loading}
          />
          <FacetDropdown
            label="Shipping"
            buckets={facets?.shippingProfiles ?? []}
            selected={filters.shippingProfiles}
            onChange={(shippingProfiles) => onChange({ shippingProfiles })}
            loading={loading}
          />
        </>
      )}

      <button
        type="button"
        onClick={onAdvancedClick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>Advanced Filters</span>
        {advancedCount > 0 ? (
          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
            {advancedCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
