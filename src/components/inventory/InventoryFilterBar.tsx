/* ─── InventoryFilterBar ────────────────────────────────────
 *  Top filter bar for the inventory page with quick-filter
 *  dropdowns for the most common filter dimensions.
 *  Mirrors CatalogFilterBar patterns.
 * ────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Check } from 'lucide-react';
import type { InventoryFilters, InventoryFacets, FacetBucket } from '../../lib/inventoryApi';
import { countInventoryActiveFilters } from '../../lib/inventoryApi';
import { conditionLabel } from '../../types/search';

interface Props {
  facets: InventoryFacets | null;
  filters: InventoryFilters;
  onChange: (updater: InventoryFilters | ((prev: InventoryFilters) => InventoryFilters)) => void;
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
      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
    >
      <div
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
          checked
            ? 'bg-blue-600 border-blue-600'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </div>
      <span className={`flex-1 text-left ${checked ? 'text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}>
        {label}
      </span>
      {count != null && (
        <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-600">{count}</span>
      )}
    </button>
  );
}

function findCount(buckets: FacetBucket[], value: string): number | undefined {
  return buckets.find((b) => b.value === value)?.count;
}

export default function InventoryFilterBar({
  facets,
  filters,
  onChange,
  onAdvancedClick,
  advancedFilterCount,
  loading,
}: Props) {
  const activeCount = countInventoryActiveFilters(filters);

  // Stock Level summary
  const stockSummary = filters.stockLevels.length === 0
    ? 'All'
    : filters.stockLevels.map((s) => {
        if (s === 'in_stock') return 'In Stock';
        if (s === 'low_stock') return 'Low Stock';
        return 'Out of Stock';
      }).join(', ');

  // Condition summary
  const condSummary = filters.conditions.length === 0
    ? 'All'
    : filters.conditions.map((c) => conditionLabel(c) ?? c).join(', ');

  // Team summary
  const teamSummary = filters.teamIds.length === 0
    ? 'All'
    : `${filters.teamIds.length} selected`;

  // Marketplace summary
  const mktSummary = filters.marketplaces.length === 0
    ? 'All'
    : filters.marketplaces.join(', ');

  const toggleMultiValue = (
    key: 'stockLevels' | 'conditions' | 'teamIds' | 'marketplaces',
    value: string,
  ) => {
    onChange((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Stock Level */}
      <FilterDropdown label="Stock" summary={stockSummary}>
        {['in_stock', 'low_stock', 'out_of_stock'].map((level) => (
          <CheckboxOption
            key={level}
            checked={filters.stockLevels.includes(level)}
            label={level === 'in_stock' ? 'In Stock' : level === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
            count={findCount(facets?.stockLevels ?? [], level)}
            onToggle={() => toggleMultiValue('stockLevels', level)}
          />
        ))}
      </FilterDropdown>

      {/* Condition */}
      <FilterDropdown label="Condition" summary={condSummary}>
        {(facets?.conditions ?? []).map((c) => (
          <CheckboxOption
            key={c.value}
            checked={filters.conditions.includes(c.value)}
            label={conditionLabel(c.value) ?? c.value}
            count={c.count}
            onToggle={() => toggleMultiValue('conditions', c.value)}
          />
        ))}
        {(facets?.conditions ?? []).length === 0 && !loading && (
          <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-600">No conditions found</p>
        )}
      </FilterDropdown>

      {/* Team */}
      <FilterDropdown label="Team" summary={teamSummary}>
        {(facets?.teams ?? []).map((t) => (
          <CheckboxOption
            key={t.value}
            checked={filters.teamIds.includes(t.value)}
            label={t.label ?? t.value}
            count={t.count}
            onToggle={() => toggleMultiValue('teamIds', t.value)}
          />
        ))}
        {(facets?.teams ?? []).length === 0 && !loading && (
          <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-600">No teams found</p>
        )}
      </FilterDropdown>

      {/* Marketplace */}
      <FilterDropdown label="Marketplace" summary={mktSummary}>
        {(facets?.marketplaces ?? []).map((m) => (
          <CheckboxOption
            key={m.value}
            checked={filters.marketplaces.includes(m.value)}
            label={m.value}
            count={m.count}
            onToggle={() => toggleMultiValue('marketplaces', m.value)}
          />
        ))}
        {(facets?.marketplaces ?? []).length === 0 && !loading && (
          <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-600">No marketplaces found</p>
        )}
      </FilterDropdown>

      {/* Advanced Filters toggle */}
      <button
        type="button"
        onClick={onAdvancedClick}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
          advancedFilterCount > 0
            ? 'border-blue-600 bg-blue-600/10 text-blue-400'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <SlidersHorizontal size={14} />
        Filters
        {advancedFilterCount > 0 && (
          <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
            {advancedFilterCount}
          </span>
        )}
      </button>
    </div>
  );
}
