import { Check, ChevronDown, ChevronUp, Filter, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CatalogConfig, CatalogFacets, CatalogFilters, FacetBucket } from './catalogTypes';

type Props = { config: CatalogConfig; filters: CatalogFilters; facets: CatalogFacets | null; facetsError?: string; compact?: boolean; onChange: (patch: Partial<CatalogFilters>) => void; onReset: () => void };
type FacetSectionProps = { title: string; buckets: FacetBucket[]; selected: string[]; loading?: boolean; defaultExpanded?: boolean; valueLabels?: Record<string, string>; onChange: (values: string[]) => void };

function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function displayLabel(bucket: FacetBucket, valueLabels?: Record<string, string>) { return valueLabels?.[bucket.value] || bucket.label || bucket.value.replace(/[_-]+/g, ' '); }

function FacetSection({ title, buckets, selected, loading = false, defaultExpanded = false, valueLabels, onChange }: FacetSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || selected.length > 0);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { if (selected.length) setExpanded(true); }, [selected.length]);
  const orderedBuckets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...buckets].filter((bucket) => !term || displayLabel(bucket, valueLabels).toLowerCase().includes(term) || bucket.value.toLowerCase().includes(term)).sort((a, b) => Number(selected.includes(b.value)) - Number(selected.includes(a.value)) || b.count - a.count || displayLabel(a, valueLabels).localeCompare(displayLabel(b, valueLabels)));
  }, [buckets, search, selected, valueLabels]);
  if (!loading && !buckets.length && !selected.length) return null;
  const visibleBuckets = showAll ? orderedBuckets : orderedBuckets.slice(0, 8);
  return (
    <section className="border-b border-slate-100 pb-3 last:border-b-0 dark:border-slate-800" aria-label={`${title} filter`}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 text-left text-xs font-semibold text-slate-700 dark:text-slate-200" aria-expanded={expanded}><span className="truncate">{title}{selected.length ? <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{selected.length}</span> : null}</span>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        {selected.length ? <button type="button" onClick={() => onChange([])} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label={`Clear ${title} filter`}><X size={13} /></button> : null}
      </div>
      {expanded ? <div className="mt-2">{loading ? <div className="space-y-2" role="status" aria-label={`Loading ${title} options`}>{[0, 1, 2].map((row) => <div key={row} className="h-5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />)}</div> : <>
        {buckets.length > 6 ? <label className="relative mb-2 block"><Search size={13} className="absolute left-2 top-2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" aria-label={`Search ${title}`} /></label> : null}
        <div className="space-y-1">{visibleBuckets.map((bucket) => { const checked = selected.includes(bucket.value); return <label key={bucket.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/70"><span className={'flex h-4 w-4 shrink-0 items-center justify-center rounded border ' + (checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900')}>{checked ? <Check size={11} strokeWidth={3} /> : null}</span><input type="checkbox" className="sr-only" checked={checked} onChange={() => onChange(toggle(selected, bucket.value))} /><span className="min-w-0 flex-1 truncate">{displayLabel(bucket, valueLabels)}</span><span className="text-[10px] tabular-nums text-slate-400">{bucket.count.toLocaleString()}</span></label>; })}{!visibleBuckets.length ? <p className="px-1 py-1 text-xs text-slate-400">No matching options.</p> : null}</div>
        {orderedBuckets.length > 8 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-2 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">{showAll ? 'Show less' : `Show all ${orderedBuckets.length}`}</button> : null}
      </>}</div> : null}
    </section>
  );
}

export function activeFilterCount(filters: CatalogFilters) {
  const arrayCount = Object.entries(filters).reduce((total, [key, value]) => total + (key !== 'attributes' && Array.isArray(value) ? value.length : 0), 0);
  const attributeCount = Object.values(filters.attributes).reduce((total, values) => total + values.length, 0);
  return arrayCount + attributeCount + [filters.minPrice, filters.maxPrice, filters.importedFrom, filters.importedTo].filter(Boolean).length + Number(filters.hasImage) + Number(filters.hasPrice);
}

export default function CatalogFilterControls({ config, filters, facets, facetsError = '', compact = false, onChange, onReset }: Props) {
  const isBusinessIndustrial = config.vertical === 'business_industrial';
  const primaryFields: Array<{ key: keyof CatalogFilters; label: string; buckets: FacetBucket[]; expanded?: boolean }> = isBusinessIndustrial ? [
    { key: 'brands', label: 'Brand / manufacturer', buckets: facets?.brands || [], expanded: true },
    { key: 'categories', label: 'eBay category', buckets: facets?.categories || [], expanded: true },
    { key: 'conditions', label: 'Condition', buckets: facets?.conditions || [], expanded: true },
    { key: 'validationStatuses', label: 'Review status', buckets: facets?.validationStatuses || [], expanded: true },
    { key: 'stockLevels', label: 'Stock', buckets: facets?.stockLevels || [] },
  ] : [
    { key: 'brands', label: 'Brand', buckets: facets?.brands || [], expanded: true }, { key: 'categories', label: 'Category', buckets: facets?.categories || [], expanded: true }, { key: 'conditions', label: 'Condition', buckets: facets?.conditions || [] }, { key: 'catalogStatuses', label: 'Catalog status', buckets: facets?.catalogStatuses || [] }, { key: 'stockLevels', label: 'Stock', buckets: facets?.stockLevels || [] },
  ];
  const additionalFields: Array<{ key: keyof CatalogFilters; label: string; buckets: FacetBucket[] }> = [
    ...(isBusinessIndustrial ? [] : [{ key: 'types' as const, label: 'Type', buckets: facets?.types || [] }, { key: 'sourceFiles' as const, label: 'Source file', buckets: facets?.sourceFiles || [] }, { key: 'formats' as const, label: 'Format', buckets: facets?.formats || [] }, { key: 'locations' as const, label: 'Location', buckets: facets?.locations || [] }, { key: 'mpns' as const, label: 'MPN', buckets: facets?.mpns || [] }, { key: 'shippingProfiles' as const, label: 'Shipping policy', buckets: facets?.shippingProfiles || [] }]),
    { key: 'teamIds', label: 'Team', buckets: facets?.teams || [] },
    { key: 'marketplaces', label: 'Marketplace', buckets: facets?.marketplaces || [] },
  ];
  const count = activeFilterCount(filters);
  const loading = facets === null && !facetsError;
  const renderFacet = (field: { key: keyof CatalogFilters; label: string; buckets: FacetBucket[]; expanded?: boolean }) => { const selected = (filters[field.key] as string[] | undefined) || []; return <FacetSection key={String(field.key)} title={field.label} buckets={field.buckets} selected={selected} loading={loading} defaultExpanded={field.expanded} onChange={(values) => onChange({ [field.key]: values } as Partial<CatalogFilters>)} />; };
  return (
    <aside className={compact ? 'w-full' : 'hidden w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:block lg:w-72'} aria-label="Catalog filters">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Filter size={16} /> Filters{count ? <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{count}</span> : null}</h2><button type="button" onClick={onReset} disabled={!count} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 disabled:opacity-40 dark:hover:text-white"><RotateCcw size={13} /> Reset</button></div>
      {loading ? <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-500 dark:bg-slate-800/70"><Loader2 size={13} className="animate-spin" /> Loading filter options…</div> : null}
      {facetsError ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">{facetsError}</div> : null}
      <div className="space-y-3">{primaryFields.map(renderFacet)}
        <details open={isBusinessIndustrial} className="border-b border-slate-100 pb-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">{config.label} filters</summary><div className="mt-3 space-y-3">{config.attributes.map((attribute) => { const buckets = facets?.attributeFacets[attribute.key] || []; const selected = filters.attributes[attribute.key] || []; if (!loading && !buckets.length && !selected.length) return null; return <FacetSection key={attribute.key} title={attribute.label} buckets={buckets} selected={selected} loading={loading} valueLabels={attribute.valueLabels} onChange={(values) => onChange({ attributes: { ...filters.attributes, [attribute.key]: values } })} />; })}</div></details>
        {additionalFields.some((field) => field.buckets.length || (filters[field.key] as string[]).length) ? <details className="border-b border-slate-100 pb-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">More catalog filters</summary><div className="mt-3 space-y-3">{additionalFields.map(renderFacet)}</div></details> : null}
        <div className="grid grid-cols-2 gap-2"><label className="text-xs font-medium text-slate-600 dark:text-slate-300">Min price<input inputMode="decimal" min="0" step="0.01" type="number" value={filters.minPrice} onChange={(event) => onChange({ minPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label><label className="text-xs font-medium text-slate-600 dark:text-slate-300">Max price<input inputMode="decimal" min="0" step="0.01" type="number" value={filters.maxPrice} onChange={(event) => onChange({ maxPrice: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label></div>
        <details><summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">Availability & import date</summary><div className="mt-3 space-y-3"><div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300"><label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filters.hasImage} onChange={(event) => onChange({ hasImage: event.target.checked })} /> Has image</label><label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={filters.hasPrice} onChange={(event) => onChange({ hasPrice: event.target.checked })} /> Has price</label></div><div className="grid grid-cols-2 gap-2"><label className="text-xs font-medium text-slate-600 dark:text-slate-300">Imported from<input type="date" value={filters.importedFrom} onChange={(event) => onChange({ importedFrom: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label><label className="text-xs font-medium text-slate-600 dark:text-slate-300">Imported to<input type="date" value={filters.importedTo} onChange={(event) => onChange({ importedTo: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal dark:border-slate-600 dark:bg-slate-800" /></label></div></div></details>
      </div>
    </aside>
  );
}
