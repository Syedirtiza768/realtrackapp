import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import type { CatalogConfig, CatalogFacets, CatalogFilters, CatalogStock, FacetBucket } from './catalogTypes';
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

function formatLabel(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function labelFor(bucket: FacetBucket | undefined, value: string, valueLabels?: Record<string, string>): string {
  return valueLabels?.[value] || bucket?.label || formatLabel(value);
}

function FilterDropdown({
  label,
  summary,
  children,
  active = false,
}: {
  label: string;
  summary: string;
  children: ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm transition ${active ? 'border-pink-200 bg-pink-50 text-pink-800 hover:border-pink-300 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-200' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'}`}
        aria-expanded={open}
        aria-label={`${label}${summary !== 'All' ? `: ${summary}` : ''}`}
      >
        <span>{label}</span>
        {summary !== 'All' ? <span className="max-w-28 truncate text-[11px] opacity-75">{summary}</span> : null}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
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
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-pink-600 bg-pink-600 text-white' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>
        {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof count === 'number' ? <span className="text-[11px] text-slate-400">{count.toLocaleString()}</span> : null}
    </button>
  );
}

function FacetDropdown({
  label,
  buckets,
  selected,
  onChange,
  loading,
  valueLabels,
}: {
  label: string;
  buckets: FacetBucket[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading: boolean;
  valueLabels?: Record<string, string>;
}) {
  const [search, setSearch] = useState('');
  const visibleBuckets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...buckets]
      .filter((bucket) => !query || labelFor(bucket, bucket.value, valueLabels).toLocaleLowerCase().includes(query) || bucket.value.toLocaleLowerCase().includes(query))
      .sort((left, right) => Number(selected.includes(right.value)) - Number(selected.includes(left.value)) || right.count - left.count || labelFor(left, left.value, valueLabels).localeCompare(labelFor(right, right.value, valueLabels)));
  }, [buckets, search, selected, valueLabels]);
  const summary = selected.length === 0
    ? 'All'
    : selected.length === 1
      ? labelFor(buckets.find((bucket) => bucket.value === selected[0]), selected[0], valueLabels)
      : `${selected.length} selected`;
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);

  return (
    <FilterDropdown label={label} summary={summary} active={selected.length > 0}>
      {buckets.length > 8 ? (
        <label className="relative block border-b border-slate-100 px-2 py-2 dark:border-slate-800">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={13} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs outline-none focus:border-pink-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            aria-label={`Search ${label}`}
          />
        </label>
      ) : null}
      <div className="max-h-72 overflow-y-auto py-1">
        {loading ? <p className="px-3 py-3 text-xs text-slate-500">Loading…</p> : visibleBuckets.length ? visibleBuckets.map((bucket) => (
          <CheckboxOption
            key={bucket.value}
            checked={selected.includes(bucket.value)}
            label={labelFor(bucket, bucket.value, valueLabels)}
            count={bucket.count}
            onToggle={() => toggle(bucket.value)}
          />
        )) : <p className="px-3 py-3 text-xs text-slate-500">No options available</p>}
      </div>
    </FilterDropdown>
  );
}

export default function CatalogQuickFilterBar({ config, facets, filters, onChange, onAdvancedClick, loading = false }: Props) {
  const quickAttributes = config.attributes.filter((attribute) =>
    (config.quickAttributes.includes(attribute.key) && attribute.key !== 'brand') || attribute.key === 'categoryFamily',
  );
  const selectedQuickCount =
    filters.brands.length +
    filters.categories.length +
    filters.conditions.length +
    filters.catalogStatuses.length +
    filters.stockLevels.length +
    quickAttributes.reduce((total, attribute) => total + (filters.attributes[attribute.key]?.length || 0), 0);
  const advancedCount = Math.max(0, activeFilterCount(filters) - selectedQuickCount);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Fashion catalog filters">
      <FilterDropdown label="Stock" summary={filters.stockLevels.length ? `${filters.stockLevels.length} selected` : 'All'} active={filters.stockLevels.length > 0}>
        <div className="py-1">
          {STOCK_OPTIONS.map((option) => (
            <CheckboxOption
              key={option.value}
              checked={filters.stockLevels.includes(option.value)}
              label={option.label}
              onToggle={() => onChange({ stockLevels: filters.stockLevels.includes(option.value) ? filters.stockLevels.filter((item) => item !== option.value) : [...filters.stockLevels, option.value] })}
            />
          ))}
        </div>
      </FilterDropdown>
      <FacetDropdown label="Brand" buckets={facets?.brands || []} selected={filters.brands} onChange={(brands) => onChange({ brands })} loading={loading} />
      <FacetDropdown label="Category" buckets={facets?.categories || []} selected={filters.categories} onChange={(categories) => onChange({ categories })} loading={loading} />
      <FacetDropdown label="Condition" buckets={facets?.conditions || []} selected={filters.conditions} onChange={(conditions) => onChange({ conditions })} loading={loading} />
      <FacetDropdown label="Status" buckets={facets?.catalogStatuses || []} selected={filters.catalogStatuses} onChange={(catalogStatuses) => onChange({ catalogStatuses })} loading={loading} />
      {quickAttributes.map((attribute) => (
        <FacetDropdown
          key={attribute.key}
          label={attribute.label}
          buckets={facets?.attributeFacets[attribute.key] || []}
          selected={filters.attributes[attribute.key] || []}
          onChange={(values) => onChange({ attributes: { ...filters.attributes, [attribute.key]: values } })}
          loading={loading}
          valueLabels={attribute.valueLabels}
        />
      ))}
      <button
        type="button"
        onClick={onAdvancedClick}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Advanced Filters</span>
        {advancedCount > 0 ? <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700 dark:bg-pink-900/50 dark:text-pink-200">{advancedCount}</span> : null}
      </button>
    </div>
  );
}
