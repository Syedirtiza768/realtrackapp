import { Filter, RotateCcw } from 'lucide-react';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogFacets, CatalogFilters, FacetBucket } from './catalogTypes';

type Props = {
  config: CatalogConfig;
  filters: CatalogFilters;
  facets: CatalogFacets | null;
  onChange: (patch: Partial<CatalogFilters>) => void;
  onReset: () => void;
};

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function facetOptions(buckets: FacetBucket[] | undefined) {
  return buckets ?? [];
}

export default function CatalogFilterControls({ config, filters, facets, onChange, onReset }: Props) {
  const fields: Array<{ key: keyof CatalogFilters; label: string; buckets: FacetBucket[] }> = [
    { key: 'brands', label: 'Brand', buckets: facetOptions(facets?.brands) },
    { key: 'categories', label: 'Category', buckets: facetOptions(facets?.categories) },
    { key: 'conditions', label: 'Condition', buckets: facetOptions(facets?.conditions) },
    { key: 'catalogStatuses', label: 'Catalog status', buckets: facetOptions(facets?.catalogStatuses) },
    { key: 'stockLevels', label: 'Stock', buckets: facetOptions(facets?.stockLevels) },
    { key: 'shippingProfiles', label: 'Shipping policy', buckets: facetOptions(facets?.shippingProfiles) },
  ];

  return (
    <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:w-72" aria-label="Catalog filters">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Filter size={16} /> Filters</h2>
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"><RotateCcw size={13} /> Reset</button>
      </div>
      <div className="space-y-3">
        {fields.map((field) => (
          <label key={String(field.key)} className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            {field.label}
            <select
              multiple
              value={filters[field.key] as string[]}
              onChange={(event) => onChange({ [field.key]: Array.from(event.target.selectedOptions, (option) => option.value) } as Partial<CatalogFilters>)}
              className="mt-1 h-20 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-normal dark:border-slate-600 dark:bg-slate-800"
              aria-label={field.label}
            >
              {field.buckets.map((bucket) => <option key={bucket.value} value={bucket.value}>{bucket.label || bucket.value} ({bucket.count})</option>)}
            </select>
          </label>
        ))}
        {facets?.marketplaces.length ? (
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Marketplace
            <select multiple value={filters.marketplaces} onChange={(event) => onChange({ marketplaces: Array.from(event.target.selectedOptions, (option) => option.value) })} className="mt-1 h-20 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-normal dark:border-slate-600 dark:bg-slate-800">
              {facets.marketplaces.map((bucket) => <option key={bucket.value} value={bucket.value}>{bucket.label || bucket.value} ({bucket.count})</option>)}
            </select>
          </label>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Min price<input inputMode="decimal" value={filters.minPrice} onChange={(event) => onChange({ minPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Max price<input inputMode="decimal" value={filters.maxPrice} onChange={(event) => onChange({ maxPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filters.hasImage} onChange={(event) => onChange({ hasImage: event.target.checked })} /> Has image</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filters.hasPrice} onChange={(event) => onChange({ hasPrice: event.target.checked })} /> Has price</label>
        </div>
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">Vertical attributes</summary>
          <div className="mt-2 space-y-2">
            {config.attributes.map((attribute) => {
              const buckets = facets?.attributeFacets[attribute.key] ?? [];
              if (!buckets.length) return null;
              const selected = filters.attributes[attribute.key] ?? [];
              return <label key={attribute.key} className="block text-xs font-medium text-slate-600 dark:text-slate-300">{attribute.label}<select multiple value={selected} onChange={(event) => onChange({ attributes: { ...filters.attributes, [attribute.key]: Array.from(event.target.selectedOptions, (option) => option.value) } })} className="mt-1 h-16 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-normal dark:border-slate-600 dark:bg-slate-800">{buckets.map((bucket) => <option key={bucket.value} value={bucket.value}>{bucket.label || bucket.value} ({bucket.count})</option>)}</select></label>;
            })}
          </div>
        </details>
      </div>
    </aside>
  );
}
