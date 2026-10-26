import { useState } from 'react';
import {
  PARTS_SEARCH_LIST_FILTERS,
  type FacetBucket,
  type PartsSearchAudience,
  type PartsSearchListFilter,
  type PartsSearchParams,
} from '../../lib/partsSearchApi';

const LABELS: Record<PartsSearchListFilter, string> = {
  make: 'Make',
  model: 'Model',
  category: 'Category',
  brand: 'Brand',
  partType: 'Part type',
  condition: 'Condition',
  seller: 'Seller',
  sourceTag: 'Source',
};

const COLLAPSED_COUNT = 6;

function FacetGroup({
  field,
  buckets,
  selected,
  onToggle,
}: {
  field: PartsSearchListFilter;
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (field: PartsSearchListFilter, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Keep selected values visible even when their bucket fell out of the top N.
  const merged = [
    ...buckets,
    ...selected
      .filter((value) => !buckets.some((bucket) => bucket.value.toLowerCase() === value.toLowerCase()))
      .map((value) => ({ value, count: 0 })),
  ];
  if (merged.length === 0) return null;
  const visible = expanded ? merged : merged.slice(0, COLLAPSED_COUNT);
  return (
    <fieldset className="border-b border-slate-200 py-3 dark:border-slate-700">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{LABELS[field]}</legend>
      <ul className="space-y-0.5">
        {visible.map((bucket) => {
          const checked = selected.some((value) => value.toLowerCase() === bucket.value.toLowerCase());
          return (
            <li key={bucket.value}>
              <label className="flex min-h-[32px] cursor-pointer items-center gap-2 rounded px-1 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(field, bucket.value)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="min-w-0 flex-1 truncate capitalize">{bucket.value.toLowerCase()}</span>
                {bucket.count > 0 && <span className="text-xs tabular-nums text-slate-400">{bucket.count.toLocaleString()}</span>}
              </label>
            </li>
          );
        })}
      </ul>
      {merged.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 px-1 text-xs font-medium hover:underline"
          style={{ color: 'var(--brand-primary)' }}
        >
          {expanded ? 'Show fewer' : `Show all ${merged.length}`}
        </button>
      )}
    </fieldset>
  );
}

type Props = {
  facets: Record<string, FacetBucket[]>;
  params: PartsSearchParams;
  /** Seller/source filters only work against the internal search. */
  audience: PartsSearchAudience;
  onChange: (next: PartsSearchParams) => void;
};

const INTERNAL_ONLY: PartsSearchListFilter[] = ['seller', 'sourceTag'];

export default function FacetSidebar({ facets, params, audience, onChange }: Props) {
  const toggle = (field: PartsSearchListFilter, value: string) => {
    const current = params[field] ?? [];
    const exists = current.some((item) => item.toLowerCase() === value.toLowerCase());
    const next = exists ? current.filter((item) => item.toLowerCase() !== value.toLowerCase()) : [...current, value];
    onChange({ ...params, [field]: next.length ? next : undefined, page: undefined });
  };

  const years = facets.year ?? [];
  const availability = Object.fromEntries((facets.availability ?? []).map((bucket) => [bucket.value, bucket.count]));

  return (
    <div>
      <fieldset className="border-b border-slate-200 py-3 dark:border-slate-700">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Availability</legend>
        {(['inStock', 'hasImage'] as const).map((key) => (
          <label key={key} className="flex min-h-[32px] cursor-pointer items-center gap-2 rounded px-1 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            <input
              type="checkbox"
              checked={Boolean(params[key])}
              onChange={() => onChange({ ...params, [key]: params[key] ? undefined : true, page: undefined })}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
            />
            <span className="flex-1">{key === 'inStock' ? 'In stock' : 'Has photos'}</span>
            {availability[key] ? <span className="text-xs tabular-nums text-slate-400">{availability[key].toLocaleString()}</span> : null}
          </label>
        ))}
      </fieldset>

      {years.length > 0 && (
        <div className="border-b border-slate-200 py-3 dark:border-slate-700">
          <label htmlFor="parts-search-year" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Vehicle year
          </label>
          <select
            id="parts-search-year"
            value={params.year ?? ''}
            onChange={(event) => onChange({ ...params, year: event.target.value ? Number(event.target.value) : undefined, page: undefined })}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Any year</option>
            {years.map((bucket) => (
              <option key={bucket.value} value={bucket.value}>
                {bucket.value} ({bucket.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      )}

      {PARTS_SEARCH_LIST_FILTERS.filter((field) => audience === 'internal' || !INTERNAL_ONLY.includes(field)).map((field) => (
        <FacetGroup key={field} field={field} buckets={facets[field] ?? []} selected={params[field] ?? []} onToggle={toggle} />
      ))}
    </div>
  );
}
