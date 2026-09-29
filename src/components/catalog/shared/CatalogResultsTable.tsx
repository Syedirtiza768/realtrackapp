import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownAZ, ArrowUpAZ, Edit3, Eye, Filter, ImageOff, Send, SlidersHorizontal, X } from 'lucide-react';
import OptimizedImage from '../../ui/OptimizedImage';
import { EmptyState } from '../../ui/StatusBlock';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogFacets, CatalogFilters, CatalogItem, CatalogSort, FacetBucket } from './catalogTypes';

type Props = {
  config: CatalogConfig;
  items: CatalogItem[];
  selected: Set<string>;
  loading: boolean;
  error: string;
  canPublish: boolean;
  hasActiveQuery: boolean;
  catalogTotal: number | null;
  sort: CatalogSort;
  filters: CatalogFilters;
  facets: CatalogFacets | null;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRetry: () => void;
  onToggle: (id: string) => void;
  onTogglePage: () => void;
  onView: (item: CatalogItem) => void;
  onEdit: (item: CatalogItem) => void;
  onPublish: (item: CatalogItem) => void;
  onSort: (sort: CatalogSort) => void;
  onFilterChange: (patch: Partial<CatalogFilters>) => void;
};

function statusClass(status: string) {
  if (status === 'published' || status === 'approved') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  if (status === 'blocked' || status === 'quarantined' || status === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300';
  if (status === 'needs_review') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function price(value: number | null) {
  return value == null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
}

function textAttribute(item: CatalogItem, key: string) {
  const value = item.verticalAttributes[key];
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(', ');
  return value == null ? '' : String(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function identityLine(item: CatalogItem) {
  const manufacturer = textAttribute(item, 'manufacturer') || item.brand || 'No manufacturer';
  const model = textAttribute(item, 'model');
  return manufacturer + (model ? ' · ' + model : '') + (item.manualReview ? ' · review hold' : '');
}

function statusLabel(item: CatalogItem) {
  if (item.publicationStatus === 'published') return 'Published';
  if (item.publicationStatus === 'blocked') return 'Blocked';
  return 'Unpublished';
}

function publicationUrl(publication: CatalogItem['publications'][number]) {
  return publication.listingUrl || (publication.listingId ? `https://www.ebay.com/itm/${publication.listingId}` : null);
}

function isLivePublicationStatus(status: string) {
  return ['published', 'active', 'out_of_stock'].includes(status.toLowerCase());
}

function sortDirection(sort: CatalogSort, asc: CatalogSort, desc?: CatalogSort) {
  if (sort === asc) return 'ascending' as const;
  if (desc && sort === desc) return 'descending' as const;
  return 'none' as const;
}

function SortButton({ label, sort, asc, desc, onSort }: { label: string; sort: CatalogSort; asc: CatalogSort; desc?: CatalogSort; onSort: (sort: CatalogSort) => void }) {
  const direction = sortDirection(sort, asc, desc);
  const nextSort = direction === 'ascending' && desc ? desc : asc;
  return (
    <button type="button" onClick={() => onSort(nextSort)} className="inline-flex min-h-8 items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white" aria-label={`Sort by ${label}${direction === 'ascending' ? ', currently ascending' : direction === 'descending' ? ', currently descending' : ''}`}>
      <span>{label}</span>
      {direction === 'ascending' ? <ArrowDownAZ size={14} aria-hidden="true" /> : direction === 'descending' ? <ArrowUpAZ size={14} aria-hidden="true" /> : <SlidersHorizontal size={13} aria-hidden="true" />}
    </button>
  );
}

function mergeSelectedBuckets(buckets: FacetBucket[], selected: string[]) {
  const existing = new Set(buckets.map((bucket) => bucket.value));
  return [...buckets, ...selected.filter((value) => !existing.has(value)).map((value) => ({ value, label: value, count: 0 }))];
}

function HeaderFilter({ label, active, children, onClear }: { label: string; active: boolean; children: ReactNode; onClear?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button type="button" onClick={() => setOpen((current) => !current)} className={`inline-flex min-h-8 items-center gap-1 rounded px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${active ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'}`} aria-label={`${active ? 'Edit' : 'Set'} ${label} filter`} aria-haspopup="dialog" aria-expanded={open}>
        <Filter size={13} aria-hidden="true" />{active ? <span className="sr-only">Filter active</span> : null}
      </button>
      {open ? <div role="dialog" aria-label={`${label} filter`} className="absolute left-0 top-full z-30 mt-1 min-w-64 rounded-lg border border-slate-200 bg-white p-2 text-left normal-case tracking-normal shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-1 flex items-center justify-between gap-2 px-1 text-xs font-semibold text-slate-700 dark:text-slate-200"><span>{label} filter</span>{active && onClear ? <button type="button" onClick={() => { onClear(); setOpen(false); }} className="inline-flex min-h-7 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"><X size={12} aria-hidden="true" /> Clear</button> : null}</div>
        {children}
      </div> : null}
    </div>
  );
}

function HeaderFacetFilter({ label, buckets, selected, onChange }: { label: string; buckets: FacetBucket[]; selected: string[]; onChange: (values: string[]) => void }) {
  const options = mergeSelectedBuckets(buckets, selected);
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return <HeaderFilter label={label} active={selected.length > 0} onClear={() => onChange([])}><div className="max-h-56 overflow-y-auto py-1">
    {options.length ? options.map((bucket) => <label key={bucket.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={selected.includes(bucket.value)} onChange={() => toggle(bucket.value)} className="h-4 w-4 accent-cyan-600" /><span className="min-w-0 flex-1 truncate">{bucket.label || bucket.value}</span><span className="text-[10px] tabular-nums text-slate-400">{bucket.count.toLocaleString()}</span></label>) : <p className="px-2 py-3 text-xs text-slate-500">No filter options available.</p>}
  </div></HeaderFilter>;
}

function HeaderRangeFilter({ filters, onChange }: { filters: CatalogFilters; onChange: (patch: Partial<CatalogFilters>) => void }) {
  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  useEffect(() => { setMinPrice(filters.minPrice); setMaxPrice(filters.maxPrice); }, [filters.minPrice, filters.maxPrice]);
  const active = Boolean(filters.minPrice || filters.maxPrice || filters.stockLevels.length);
  const apply = () => onChange({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() });
  return <HeaderFilter label="Price and stock" active={active} onClear={() => { setMinPrice(''); setMaxPrice(''); onChange({ minPrice: '', maxPrice: '', stockLevels: [] }); }}><div className="grid grid-cols-2 gap-2 p-1">
    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Min price<input type="number" min="0" step="0.01" inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Max price<input type="number" min="0" step="0.01" inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
  </div><div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">{(['in_stock', 'low_stock', 'out_of_stock'] as const).map((value) => <label key={value} className="flex min-h-9 items-center gap-2 rounded px-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={filters.stockLevels.includes(value)} onChange={() => onChange({ stockLevels: filters.stockLevels.includes(value) ? filters.stockLevels.filter((item) => item !== value) : [...filters.stockLevels, value] })} className="h-4 w-4 accent-cyan-600" />{value === 'in_stock' ? 'In stock' : value === 'low_stock' ? 'Low stock' : 'Out of stock'}</label>)}</div>
  <button type="button" onClick={apply} className="mt-2 min-h-9 w-full rounded bg-cyan-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700">Apply price</button></HeaderFilter>;
}

function HeaderDateFilter({ filters, onChange }: { filters: CatalogFilters; onChange: (patch: Partial<CatalogFilters>) => void }) {
  const [from, setFrom] = useState(filters.importedFrom);
  const [to, setTo] = useState(filters.importedTo);
  useEffect(() => { setFrom(filters.importedFrom); setTo(filters.importedTo); }, [filters.importedFrom, filters.importedTo]);
  const active = Boolean(filters.importedFrom || filters.importedTo);
  return <HeaderFilter label="Date added" active={active} onClear={() => { setFrom(''); setTo(''); onChange({ importedFrom: '', importedTo: '' }); }}><div className="space-y-2 p-1">
    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" /></label>
    <button type="button" onClick={() => onChange({ importedFrom: from, importedTo: to })} className="min-h-9 w-full rounded bg-cyan-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700">Apply dates</button>
  </div></HeaderFilter>;
}

function HeaderCell({ label, sort, asc, desc, onSort, filter }: { label: string; sort?: CatalogSort; asc?: CatalogSort; desc?: CatalogSort; onSort: (sort: CatalogSort) => void; filter?: ReactNode }) {
  const direction = sort && asc ? sortDirection(sort, asc, desc) : 'none';
  return <th aria-sort={direction} className="px-3 py-2 align-top"><div className="flex items-center gap-0.5">{sort && asc ? <SortButton label={label} sort={sort} asc={asc} desc={desc} onSort={onSort} /> : <span className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>}{filter}</div></th>;
}

export default function CatalogResultsTable({
  config,
  items,
  selected,
  loading,
  error,
  canPublish,
  hasActiveQuery,
  catalogTotal,
  emptyActionLabel,
  onEmptyAction,
  onRetry,
  onToggle,
  onTogglePage,
  onView,
  onEdit,
  onPublish,
  sort,
  filters,
  facets,
  onSort,
  onFilterChange,
}: Props) {
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const someSelected = items.some((item) => selected.has(item.id));

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert">
        <p>{error}</p>
        <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg bg-white px-3 py-1.5 font-medium text-red-700 shadow-sm dark:bg-slate-900">
          Retry
        </button>
      </div>
    );
  }

  if (loading && !items.length) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" role="status">
        <span className="sr-only">Loading catalog records</span>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    if (!hasActiveQuery && (catalogTotal === 0 || catalogTotal == null)) {
      return (
        <EmptyState
          title="This catalog is empty"
          description="No products have been added to this workspace yet."
          action={
            onEmptyAction ? (
              <button
                type="button"
                onClick={onEmptyAction}
                className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}
              >
                {emptyActionLabel || 'Add item'}
              </button>
            ) : null
          }
        />
      );
    }
    return (
      <EmptyState
        title="No catalog records match these filters"
        description="Try clearing a filter or broadening the search. The catalog still contains records outside this result set."
      />
    );
  }

  const rowActions = (item: CatalogItem) => (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => onView(item)} title="Quick view" aria-label={`Quick view ${item.title}`} className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
        <Eye size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onEdit(item)} title="Open full editor" aria-label={`Edit ${item.title}`} className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
        <Edit3 size={16} aria-hidden="true" />
      </button>
      {canPublish && item.publicationStatus !== 'published' && item.publicationStatus !== 'blocked' && item.verticalValidationStatus === 'approved' ? (
        <button type="button" onClick={() => onPublish(item)} title="Publish" aria-label={`Publish ${item.title}`} className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300">
          <Send size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="space-y-3 p-3 lg:hidden">
        {items.map((item) => (
          <article key={item.id} className={`rounded-xl border border-slate-200 p-3 dark:border-slate-700 ${selected.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
            <div className="flex gap-3">
              <label className="mt-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center">
                <span className="sr-only">{selected.has(item.id) ? 'Clear ' : 'Select '}{item.title}</span>
                <input type="checkbox" className="h-4 w-4" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
              </label>
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                {item.imageUrls[0] ? <OptimizedImage src={item.imageUrls[0]} alt="" variant="thumb" className="h-full w-full object-cover" /> : <ImageOff className="m-4 text-slate-400" size={24} />}
              </div>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onView(item)} className="line-clamp-2 text-left text-sm font-medium text-slate-900 dark:text-white">
                  {item.title || 'Untitled product'}
                </button>
                <p className="mt-1 truncate text-xs text-slate-500">{identityLine(item)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white">{price(item.price)}</span>
                  <span>{item.quantity ?? 0} in stock</span>
                  <span className={'rounded-full px-2 py-0.5 font-medium ' + statusClass(item.publicationStatus === 'blocked' ? 'blocked' : item.publicationStatus)}>
                    {statusLabel(item)}
                  </span>
                </div>
                {item.publications.filter((publication) => isLivePublicationStatus(publication.listingStatus)).map((publication) => {
                  const url = publicationUrl(publication);
                  return url ? <a key={publication.id} href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400">View published listing</a> : null;
                })}
              </div>
            </div>
            <div className="mt-2 flex justify-end">{rowActions(item)}</div>
          </article>
        ))}
      </div>
      <div className="hidden max-h-[min(68vh,720px)] max-w-full overflow-auto overscroll-contain lg:block">
        <table className="min-w-[980px] w-full text-left text-sm">
          <caption className="sr-only">{config.label} catalog results</caption>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/95">
            <tr>
              <th className="w-10 px-3 py-3">
                <label className="flex items-center justify-center">
                  <span className="sr-only">{allSelected ? 'Clear page selection' : someSelected ? 'Page partially selected' : 'Select page'}</span>
                  <input ref={headerCheckboxRef} type="checkbox" className="h-4 w-4" checked={allSelected} onChange={onTogglePage} />
                </label>
              </th>
              <HeaderCell label="Product" sort={sort} asc="title_asc" desc="title_desc" onSort={onSort} />
              <HeaderCell label="SKU / MPN" sort={sort} asc="sku_asc" onSort={onSort} filter={<HeaderFacetFilter label="MPN" buckets={facets?.mpns || []} selected={filters.mpns} onChange={(mpns) => onFilterChange({ mpns })} />} />
              <HeaderCell label="Category" onSort={onSort} filter={<HeaderFacetFilter label="Category" buckets={facets?.categories || []} selected={filters.categories} onChange={(categories) => onFilterChange({ categories })} />} />
              <HeaderCell label="Condition" onSort={onSort} filter={<HeaderFacetFilter label="Condition" buckets={facets?.conditions || []} selected={filters.conditions} onChange={(conditions) => onFilterChange({ conditions })} />} />
              <HeaderCell label="Price / stock" sort={sort} asc="price_asc" desc="price_desc" onSort={onSort} filter={<HeaderRangeFilter filters={filters} onChange={onFilterChange} />} />
              <HeaderCell label="Images" onSort={onSort} filter={<HeaderFilter label="Images" active={filters.hasImage} onClear={() => onFilterChange({ hasImage: false })}><label className="flex min-h-10 items-center gap-2 px-2 text-xs text-slate-700 dark:text-slate-200"><input type="checkbox" checked={filters.hasImage} onChange={(event) => onFilterChange({ hasImage: event.target.checked })} className="h-4 w-4 accent-cyan-600" /> Has images</label></HeaderFilter>} />
              <HeaderCell label="Date added" sort={sort} asc="newest" onSort={onSort} filter={<HeaderDateFilter filters={filters} onChange={onFilterChange} />} />
              <HeaderCell label="Status" onSort={onSort} filter={<HeaderFacetFilter label="Publication status" buckets={facets?.catalogStatuses || []} selected={filters.catalogStatuses} onChange={(catalogStatuses) => onFilterChange({ catalogStatuses })} />} />
              <th className="px-3 py-3">Publications</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={item.id} className={selected.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-950/10' : undefined}>
                <td className="px-3 py-3 align-top">
                  <label className="flex items-center justify-center">
                    <span className="sr-only">{selected.has(item.id) ? 'Clear ' : 'Select '}{item.title}</span>
                    <input type="checkbox" className="h-4 w-4" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
                  </label>
                </td>
                <td className="max-w-[320px] px-3 py-3 align-top">
                  <div className="flex gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                      {item.imageUrls[0] ? <OptimizedImage src={item.imageUrls[0]} alt="" variant="thumb" className="h-full w-full object-cover" /> : <ImageOff className="m-3 text-slate-400" size={24} />}
                    </div>
                    <div className="min-w-0">
                      <button type="button" onClick={() => onView(item)} className="line-clamp-2 text-left font-medium text-slate-900 hover:text-blue-600 dark:text-white">
                        {item.title || 'Untitled product'}
                      </button>
                      <p className="mt-1 truncate text-xs text-slate-500">{identityLine(item)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300">
                  <div>{item.sku || '—'}</div>
                  <div className="mt-1">{textAttribute(item, 'mpn') || item.mpn || '—'}</div>
                </td>
                <td className="max-w-[220px] px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300">
                  <span className="line-clamp-2">{item.categoryName || item.categoryId || '—'}</span>
                  {textAttribute(item, 'categoryFamily') ? (
                    <div className="mt-1 text-slate-500">
                      {config.attributes.find((attribute) => attribute.key === 'categoryFamily')?.valueLabels?.[textAttribute(item, 'categoryFamily')] || textAttribute(item, 'categoryFamily').replace(/_/g, ' ')}
                    </div>
                  ) : null}
                  <div className="mt-1 text-slate-400">{item.teamName || 'Unassigned'}</div>
                </td>
                <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300">{(item.conditionLabel || item.conditionId || '—').replace(/_/g, ' ')}</td>
                <td className="px-3 py-3 align-top">
                  <div className="font-medium text-slate-900 dark:text-white">{price(item.price)}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.quantity ?? 0} in stock</div>
                </td>
                <td className="px-3 py-3 align-top text-xs text-slate-500">{item.imageUrls.length || 0}</td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-slate-500 dark:text-slate-400">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-3 align-top">
                  <span className={'inline-flex rounded-full px-2 py-1 text-xs font-medium ' + statusClass(item.publicationStatus === 'blocked' ? 'blocked' : item.publicationStatus)}>
                    {statusLabel(item)}
                  </span>
                  <div className="mt-1 text-xs text-slate-500">{item.reviewStatus || 'No review'}</div>
                  {item.publicationStatus !== 'blocked' && item.verticalValidationStatus !== 'approved' ? (
                    <div className="mt-1 max-w-[150px] text-[11px] text-amber-700 dark:text-amber-300">Compliance approval required before publish.</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="space-y-1">
                    {item.publications.length ? item.publications.slice(0, 3).map((publication) => {
                      const url = publicationUrl(publication);
                      return <div key={publication.id} className="max-w-[190px]">
                        {url ? <a href={url} target="_blank" rel="noreferrer" className={'inline-flex rounded-full px-2 py-1 text-[11px] ' + statusClass(publication.listingStatus)}>
                          {publication.storeName}: {publication.listingStatus} · Open listing
                        </a> : <span className={'inline-flex rounded-full px-2 py-1 text-[11px] ' + statusClass(publication.listingStatus)}>
                          {publication.storeName}: {publication.listingStatus}
                        </span>}
                        {publication.lastErrorMessage ? <p className="mt-1 line-clamp-2 text-[11px] text-red-600 dark:text-red-300" title={publication.lastErrorMessage}>Error: {publication.lastErrorMessage}</p> : null}
                      </div>
                    }) : <span className="text-xs text-slate-500">{item.publicationStatus === 'published' ? 'Published' : 'Unpublished'}</span>}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">{rowActions(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Refreshing results…</div> : null}
    </div>
  );
}
