import { useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Check } from 'lucide-react';
import type {
  ActiveFilters,
  DynamicFacets,
  DateAddedPreset,
  StockLevelFilter,
  CatalogListingStatus,
} from '../../types/search';
import { conditionLabel } from '../../types/search';

interface Props {
  facets: DynamicFacets | null;
  filters: ActiveFilters;
  onChange: (updater: ActiveFilters | ((prev: ActiveFilters) => ActiveFilters)) => void;
  onAdvancedClick: () => void;
  advancedFilterCount: number;
  loading?: boolean;
}

function FilterDropdown({
  label,
  summary,
  children,
  align = 'left',
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className="max-w-[8rem] truncate">{summary}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function CheckboxOption({
  checked,
  label,
  count,
  dotColor,
  onToggle,
}: {
  checked: boolean;
  label: string;
  count?: number;
  dotColor?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {checked && <Check size={10} />}
      </span>
      {dotColor && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      {count != null && (
        <span className="text-slate-400 tabular-nums">{count.toLocaleString()}</span>
      )}
    </button>
  );
}

const STOCK_OPTIONS: { value: StockLevelFilter; label: string }[] = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock (1–2)' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

const STATUS_OPTIONS: { value: CatalogListingStatus; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'ready_to_publish', label: 'Ready to Publish' },
  { value: 'need_images', label: 'Need Images' },
];

const DATE_OPTIONS: { value: DateAddedPreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom Range' },
];

export default function CatalogFilterBar({
  facets,
  filters,
  onChange,
  onAdvancedClick,
  advancedFilterCount,
  loading,
}: Props) {
  const stockSummary =
    filters.stockLevels.length === 0
      ? 'All'
      : filters.stockLevels.length === 1
        ? STOCK_OPTIONS.find((o) => o.value === filters.stockLevels[0])?.label ?? 'Selected'
        : `${filters.stockLevels.length} selected`;

  const brandSummary =
    filters.brands.length === 0
      ? 'All'
      : filters.brands.length === 1
        ? filters.brands[0]
        : `${filters.brands.length} selected`;

  const conditionSummary =
    filters.conditions.length === 0
      ? 'All'
      : filters.conditions.length === 1
        ? conditionLabel(filters.conditions[0])
        : `${filters.conditions.length} selected`;

  const teamSummary =
    filters.teamIds.length === 0
      ? 'All'
      : filters.teamIds.length === 1
        ? facets?.teams.find((t) => t.value === filters.teamIds[0])?.label ?? '1 team'
        : `${filters.teamIds.length} teams`;

  const shippingSummary =
    filters.shippingProfiles.length === 0
      ? 'All'
      : filters.shippingProfiles.length === 1
        ? filters.shippingProfiles[0]
        : `${filters.shippingProfiles.length} selected`;

  const statusSummary =
    filters.catalogStatuses.length === 0
      ? 'All'
      : filters.catalogStatuses.length === 1
        ? STATUS_OPTIONS.find((o) => o.value === filters.catalogStatuses[0])?.label ?? 'Selected'
        : `${filters.catalogStatuses.length} selected`;

  const dateSummary =
    filters.dateAddedPreset === 'custom'
      ? (filters.dateAddedFrom || filters.dateAddedTo)
        ? `${filters.dateAddedFrom || '…'} – ${filters.dateAddedTo || '…'}`
        : 'Custom Range'
      : DATE_OPTIONS.find((o) => o.value === filters.dateAddedPreset)?.label ?? 'All time';

  const toggleInList = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterDropdown label="Stock Level" summary={stockSummary}>
        {STOCK_OPTIONS.map((opt) => (
          <CheckboxOption
            key={opt.value}
            checked={filters.stockLevels.includes(opt.value)}
            label={opt.label}
            onToggle={() =>
              onChange((prev) => ({
                ...prev,
                stockLevels: toggleInList(prev.stockLevels, opt.value),
              }))
            }
          />
        ))}
      </FilterDropdown>

      <FilterDropdown label="Brand" summary={brandSummary}>
        {(facets?.brands ?? []).slice(0, 30).map((b) => (
          <CheckboxOption
            key={b.value}
            checked={filters.brands.includes(b.value)}
            label={b.value}
            count={b.count}
            onToggle={() =>
              onChange((prev) => ({ ...prev, brands: toggleInList(prev.brands, b.value) }))
            }
          />
        ))}
        {!loading && (facets?.brands.length ?? 0) === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400">No brands in results</p>
        )}
      </FilterDropdown>

      <FilterDropdown label="Condition" summary={conditionSummary}>
        {(facets?.conditions ?? []).map((c) => (
          <CheckboxOption
            key={c.value}
            checked={filters.conditions.includes(c.value)}
            label={conditionLabel(c.value)}
            count={c.count}
            onToggle={() =>
              onChange((prev) => ({
                ...prev,
                conditions: toggleInList(prev.conditions, c.value),
              }))
            }
          />
        ))}
      </FilterDropdown>

      <FilterDropdown label="Team" summary={teamSummary}>
        {(facets?.teams ?? []).map((t) => (
          <CheckboxOption
            key={t.value}
            checked={filters.teamIds.includes(t.value)}
            label={t.label}
            count={t.count}
            dotColor={t.color}
            onToggle={() =>
              onChange((prev) => ({
                ...prev,
                teamIds: toggleInList(prev.teamIds, t.value),
              }))
            }
          />
        ))}
        {!loading && (facets?.teams.length ?? 0) === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400">No teams in results</p>
        )}
      </FilterDropdown>

      <FilterDropdown label="Shipping" summary={shippingSummary}>
        {(facets?.shippingProfiles ?? []).map((s) => (
          <CheckboxOption
            key={s.value}
            checked={filters.shippingProfiles.includes(s.value)}
            label={s.value}
            count={s.count}
            onToggle={() =>
              onChange((prev) => ({
                ...prev,
                shippingProfiles: toggleInList(prev.shippingProfiles, s.value),
              }))
            }
          />
        ))}
        {!loading && (facets?.shippingProfiles?.length ?? 0) === 0 && (
          <p className="px-3 py-2 text-xs text-slate-400">No shipping profiles</p>
        )}
      </FilterDropdown>

      <FilterDropdown label="Status" summary={statusSummary}>
        {STATUS_OPTIONS.map((opt) => (
          <CheckboxOption
            key={opt.value}
            checked={filters.catalogStatuses.includes(opt.value)}
            label={opt.label}
            onToggle={() =>
              onChange((prev) => ({
                ...prev,
                catalogStatuses: toggleInList(prev.catalogStatuses, opt.value),
              }))
            }
          />
        ))}
      </FilterDropdown>

      <FilterDropdown label="Date Added" summary={dateSummary}>
        {DATE_OPTIONS.map((opt) => (
          <CheckboxOption
            key={opt.value}
            checked={filters.dateAddedPreset === opt.value}
            label={opt.label}
            onToggle={() => onChange((prev) => ({ ...prev, dateAddedPreset: opt.value }))}
          />
        ))}
        {filters.dateAddedPreset === 'custom' && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 space-y-2">
            <div>
              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">From</label>
              <input
                type="date"
                value={filters.dateAddedFrom}
                onChange={(e) => onChange((prev) => ({ ...prev, dateAddedFrom: e.target.value }))}
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">To</label>
              <input
                type="date"
                value={filters.dateAddedTo}
                onChange={(e) => onChange((prev) => ({ ...prev, dateAddedTo: e.target.value }))}
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
              />
            </div>
          </div>
        )}
      </FilterDropdown>

      <button
        type="button"
        onClick={onAdvancedClick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <SlidersHorizontal size={14} />
        Advanced Filters
        {advancedFilterCount > 0 && (
          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
            {advancedFilterCount}
          </span>
        )}
      </button>
    </div>
  );
}
