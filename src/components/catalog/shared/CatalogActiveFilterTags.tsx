import { X } from 'lucide-react';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogFacets, CatalogFilters, FacetBucket } from './catalogTypes';

type Props = {
  config: CatalogConfig;
  filters: CatalogFilters;
  facets?: CatalogFacets | null;
  onChange: (patch: Partial<CatalogFilters>) => void;
};

export default function CatalogActiveFilterTags({ config, filters, facets, onChange }: Props) {
  const tags: Array<{ key: string; label: string; remove: () => void }> = [];
  const fields: Array<[keyof CatalogFilters, string]> = [
    ['brands', config.filterLabels?.brands || 'Brand'], ['categories', 'Category'], ['conditions', 'Condition'], ['types', 'Type'],
    ['sourceFiles', 'Source file'], ['formats', 'Format'], ['locations', 'Location'], ['mpns', 'MPN'],
    ['catalogStatuses', 'Catalog status'], ['validationStatuses', 'Review status'], ['stockLevels', 'Stock'], ['shippingProfiles', 'Shipping'], ['marketplaces', 'Marketplace'],
  ];
  for (const value of filters.teamIds) {
    const bucket = facets?.teams?.find((entry) => entry.value === value);
    tags.push({ key: 'teamIds:' + value, label: 'Team: ' + (bucket?.label || value), remove: () => onChange({ teamIds: filters.teamIds.filter((item) => item !== value) }) });
  }
  for (const [key, title] of fields) {
    for (const value of filters[key] as string[]) {
      const bucket = (facets?.[key as keyof CatalogFacets] as FacetBucket[] | undefined)?.find((entry) => entry.value === value);
      tags.push({ key: String(key) + ':' + value, label: title + ': ' + (bucket?.label || value), remove: () => onChange({ [key]: (filters[key] as string[]).filter((item) => item !== value) } as Partial<CatalogFilters>) });
    }
  }
  for (const [key, rawValues] of Object.entries(filters.attributes)) {
    const values = rawValues as string[];
    const attribute = config.attributes.find((item) => item.key === key);
    for (const value of values) tags.push({ key: 'attribute:' + key + ':' + value, label: (attribute?.label || key) + ': ' + (attribute?.valueLabels?.[value] || value), remove: () => onChange({ attributes: { ...filters.attributes, [key]: values.filter((item) => item !== value) } }) });
  }
  if (filters.minPrice) tags.push({ key: 'minPrice', label: 'Min $' + filters.minPrice, remove: () => onChange({ minPrice: '' }) });
  if (filters.maxPrice) tags.push({ key: 'maxPrice', label: 'Max $' + filters.maxPrice, remove: () => onChange({ maxPrice: '' }) });
  if (filters.importedFrom) tags.push({ key: 'importedFrom', label: 'From ' + filters.importedFrom, remove: () => onChange({ importedFrom: '' }) });
  if (filters.importedTo) tags.push({ key: 'importedTo', label: 'To ' + filters.importedTo, remove: () => onChange({ importedTo: '' }) });
  if (filters.hasImage) tags.push({ key: 'hasImage', label: 'Has image', remove: () => onChange({ hasImage: false }) });
  if (filters.hasPrice) tags.push({ key: 'hasPrice', label: 'Has price', remove: () => onChange({ hasPrice: false }) });
  if (!tags.length) return null;
  return <div className="flex flex-wrap gap-2" aria-label="Active filters">{tags.map((tag) => <button key={tag.key} type="button" onClick={tag.remove} className="inline-flex max-w-full min-h-11 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"><span className="min-w-0 break-words">{tag.label}</span><X size={13} className="shrink-0" /></button>)}</div>;
}
