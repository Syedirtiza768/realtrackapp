/* ─── InventoryFilterSidebar ────────────────────────────────
 *  Filter sidebar for the inventory page with all inventory-
 *  relevant filter dimensions. Mirrors CatalogFilterSidebar
 *  patterns using shared MultiSelectFacet.
 *
 *  Sections: Stock Level, Price Range, Weight Range, Brand,
 *  Make, Model, Category, Condition, Team, Location,
 *  Marketplace, Status, Date Range.
 * ────────────────────────────────────────────────────────── */

import { useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import type { InventoryFilters, InventoryFacets, FacetBucket } from '../../lib/inventoryApi';
import { INVENTORY_EMPTY_FILTERS, countInventoryActiveFilters } from '../../lib/inventoryApi';
import { conditionLabel } from '../../types/search';
import MultiSelectFacet from '../filters/MultiSelectFacet';

interface Props {
  facets: InventoryFacets | null;
  filters: InventoryFilters;
  onChange: (filters: InventoryFilters) => void;
  loading?: boolean;
}

export default function InventoryFilterSidebar({ facets, filters, onChange, loading }: Props) {
  const activeCount = countInventoryActiveFilters(filters);

  const clearAll = useCallback(() => onChange({ ...INVENTORY_EMPTY_FILTERS }), [onChange]);

  const updateArray = useCallback(
    (key: keyof InventoryFilters, values: string[]) => {
      onChange({ ...filters, [key]: values });
    },
    [filters, onChange],
  );

  const updateScalar = useCallback(
    (key: keyof InventoryFilters, value: string | boolean) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange],
  );

  return (
    <div className="space-y-1.5">
      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-red-400 dark:hover:text-red-400 px-1 py-1 transition-colors"
        >
          <RotateCcw size={12} />
          Clear all filters ({activeCount})
        </button>
      )}

      {/* Stock Level */}
      <MultiSelectFacet
        title="Stock Level"
        buckets={facets?.stockLevels ?? []}
        selected={filters.stockLevels}
        onChange={(v) => updateArray('stockLevels', v)}
        loading={loading}
        defaultExpanded={filters.stockLevels.length > 0}
        getLabel={(b) => {
          if (b.value === 'in_stock') return 'In Stock';
          if (b.value === 'low_stock') return 'Low Stock';
          if (b.value === 'out_of_stock') return 'Out of Stock';
          return b.value;
        }}
      />

      {/* Price Range */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Price Range
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={`$${facets?.priceRange.min ?? 0}`}
            value={filters.minPrice}
            onChange={(e) => updateScalar('minPrice', e.target.value)}
            className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <span className="text-xs text-slate-500 dark:text-slate-600">\u2013</span>
          <input
            type="number"
            placeholder={`$${facets?.priceRange.max ?? 0}`}
            value={filters.maxPrice}
            onChange={(e) => updateScalar('maxPrice', e.target.value)}
            className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Weight Range */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Weight Range (kg)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={`Min`}
            value={filters.minWeight}
            onChange={(e) => updateScalar('minWeight', e.target.value)}
            className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <span className="text-xs text-slate-500 dark:text-slate-600">\u2013</span>
          <input
            type="number"
            placeholder={`Max`}
            value={filters.maxWeight}
            onChange={(e) => updateScalar('maxWeight', e.target.value)}
            className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-500 dark:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Brand */}
      <MultiSelectFacet
        title="Brand"
        buckets={(facets?.brands ?? []).map((b) => ({ ...b, value: b.value }))}
        selected={filters.brands}
        onChange={(v) => updateArray('brands', v)}
        loading={loading}
      />

      {/* Make */}
      <MultiSelectFacet
        title="Make"
        buckets={facets?.makes ?? []}
        selected={[]} // Make is single-select via filter bar, not multi here
        onChange={() => {}}
        loading={loading}
        emptyMessage="Select a Make from the top filter bar"
      />

      {/* Model */}
      <MultiSelectFacet
        title="Model"
        buckets={facets?.models ?? []}
        selected={[]}
        onChange={() => {}}
        loading={loading}
        emptyMessage="Select a Make first, then filter by Model"
      />

      {/* Category */}
      <MultiSelectFacet
        title="Category"
        buckets={(facets?.categories ?? []).map((b) => ({ ...b }))}
        selected={[]} // Category is single-select via filter bar
        onChange={() => {}}
        loading={loading}
      />

      {/* Condition */}
      <MultiSelectFacet
        title="Condition"
        buckets={(facets?.conditions ?? []).map((b) => ({
          ...b,
          label: conditionLabel(b.value) ?? b.value,
        }))}
        selected={filters.conditions}
        onChange={(v) => updateArray('conditions', v)}
        loading={loading}
        defaultExpanded={filters.conditions.length > 0}
        getLabel={(b) => b.label ?? b.value}
      />

      {/* Team */}
      <MultiSelectFacet
        title="Team"
        buckets={(facets?.teams ?? []).map((b) => ({
          value: b.value,
          count: b.count,
          label: b.label ?? b.value,
          color: b.color,
        }))}
        selected={filters.teamIds}
        onChange={(v) => updateArray('teamIds', v)}
        loading={loading}
        defaultExpanded={filters.teamIds.length > 0}
        getLabel={(b) => b.label ?? b.value}
        getTooltip={(b) => b.value}
      />

      {/* Location */}
      <MultiSelectFacet
        title="Location"
        buckets={facets?.locations ?? []}
        selected={filters.locations}
        onChange={(v) => updateArray('locations', v)}
        loading={loading}
      />

      {/* Marketplace */}
      <MultiSelectFacet
        title="Marketplace"
        buckets={facets?.marketplaces ?? []}
        selected={filters.marketplaces}
        onChange={(v) => updateArray('marketplaces', v)}
        loading={loading}
        defaultExpanded={filters.marketplaces.length > 0}
      />

      {/* Status */}
      <MultiSelectFacet
        title="Status"
        buckets={(facets?.statuses ?? []).map((b) => ({
          ...b,
          label: b.value.charAt(0).toUpperCase() + b.value.slice(1),
        }))}
        selected={filters.status ? [filters.status] : []}
        onChange={(v) => updateScalar('status', v[0] ?? '')}
        loading={loading}
        getLabel={(b) => b.label ?? b.value}
      />

      {/* Date Range */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Date Added
        </p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateAddedFrom}
            onChange={(e) => updateScalar('dateAddedFrom', e.target.value)}
            className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          <span className="text-xs text-slate-500 dark:text-slate-600">\u2013</span>
          <input
            type="date"
            value={filters.dateAddedTo}
            onChange={(e) => updateScalar('dateAddedTo', e.target.value)}
            className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Missing Images toggle */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.missingImages}
            onChange={(e) => updateScalar('missingImages', e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500/50"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300">Missing images only</span>
        </label>
      </div>
    </div>
  );
}
