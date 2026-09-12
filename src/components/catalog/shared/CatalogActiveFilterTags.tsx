import { X } from 'lucide-react';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogFilters } from './catalogTypes';

type Props = {
  config: CatalogConfig;
  filters: CatalogFilters;
  onChange: (patch: Partial<CatalogFilters>) => void;
};

export default function CatalogActiveFilterTags({ config, filters, onChange }: Props) {
  const tags: Array<{ key: string; label: string; remove: () => void }> = [];
  const fields: Array<[keyof CatalogFilters, string]> = [
    ['brands', 'Brand'], ['categories', 'Category'], ['conditions', 'Condition'], ['catalogStatuses', 'Status'],
    ['stockLevels', 'Stock'], ['shippingProfiles', 'Shipping'], ['marketplaces', 'Marketplace'],
  ];
  for (const [key, title] of fields) {
    for (const value of filters[key] as string[]) {
      tags.push({ key: String(key) + ':' + value, label: title + ': ' + value, remove: () => onChange({ [key]: (filters[key] as string[]).filter((item) => item !== value) } as Partial<CatalogFilters>) });
    }
  }
  for (const [key, rawValues] of Object.entries(filters.attributes)) {
    const values = rawValues as string[];
    for (const value of values) tags.push({ key: 'attribute:' + key + ':' + value, label: (config.attributes.find((item) => item.key === key)?.label || key) + ': ' + value, remove: () => onChange({ attributes: { ...filters.attributes, [key]: values.filter((item) => item !== value) } }) });
  }
  if (filters.minPrice) tags.push({ key: 'minPrice', label: 'Min $' + filters.minPrice, remove: () => onChange({ minPrice: '' }) });
  if (filters.maxPrice) tags.push({ key: 'maxPrice', label: 'Max $' + filters.maxPrice, remove: () => onChange({ maxPrice: '' }) });
  if (filters.hasImage) tags.push({ key: 'hasImage', label: 'Has image', remove: () => onChange({ hasImage: false }) });
  if (filters.hasPrice) tags.push({ key: 'hasPrice', label: 'Has price', remove: () => onChange({ hasPrice: false }) });
  if (!tags.length) return null;
  return <div className="flex flex-wrap gap-2" aria-label="Active filters">{tags.map((tag) => <button key={tag.key} type="button" onClick={tag.remove} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"><span>{tag.label}</span><X size={13} /></button>)}</div>;
}
