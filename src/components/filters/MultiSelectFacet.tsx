/* ─── MultiSelectFacet ──────────────────────────────────────
 *  Reusable multi-select checkbox group with facet counts,
 *  in-list search, show-all expansion, and skeleton loading.
 *  Extracted from CatalogFilterSidebar for cross-page reuse.
 * ────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

export interface FacetBucket {
  value: string;
  count: number;
  label?: string;
  color?: string;
}

interface Props {
  title: string;
  buckets: FacetBucket[];
  selected: string[];
  onChange: (values: string[]) => void;
  getKey?: (b: FacetBucket) => string;
  getLabel?: (b: FacetBucket) => string;
  getTooltip?: (b: FacetBucket) => string;
  loading?: boolean;
  defaultExpanded?: boolean;
  initialShowCount?: number;
  emptyMessage?: string;
}

export default function MultiSelectFacet({
  title,
  buckets,
  selected,
  onChange,
  getKey,
  getLabel,
  getTooltip,
  loading,
  defaultExpanded = false,
  initialShowCount = 8,
  emptyMessage,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [filterText, setFilterText] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (selected.length > 0) setExpanded(true);
  }, [selected.length]);

  const keyFn = getKey ?? ((b: FacetBucket) => b.value);
  const labelFn = getLabel ?? ((b: FacetBucket) => b.label ?? b.value);

  const sorted = useMemo(() => {
    if (!buckets.length) return [];
    return [...buckets].sort((a, b) => {
      const aSel = selected.includes(keyFn(a)) ? 1 : 0;
      const bSel = selected.includes(keyFn(b)) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      return b.count - a.count;
    });
  }, [buckets, selected, keyFn]);

  const filtered = useMemo(() => {
    if (!filterText.trim()) return sorted;
    const lc = filterText.toLowerCase();
    return sorted.filter(
      (b) => labelFn(b).toLowerCase().includes(lc) || b.value.toLowerCase().includes(lc),
    );
  }, [sorted, filterText, labelFn]);

  const visible = showAll ? filtered : filtered.slice(0, initialShowCount);
  const hasMore = filtered.length > initialShowCount;

  const toggle = useCallback(
    (key: string) => {
      onChange(
        selected.includes(key)
          ? selected.filter((v) => v !== key)
          : [...selected, key],
      );
    },
    [selected, onChange],
  );

  if (buckets.length === 0 && !loading && emptyMessage) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100/40 dark:bg-slate-800/40 transition-colors"
        >
          <span className="flex items-center gap-1.5">{title}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {expanded && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 px-3 pb-3 leading-relaxed">{emptyMessage}</p>
        )}
      </div>
    );
  }

  if (buckets.length === 0 && !loading && !emptyMessage) return null;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100/40 dark:bg-slate-800/40 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {title}
          {selected.length > 0 && (
            <span className="bg-blue-600/20 text-blue-400 text-[10px] rounded-full px-1.5 py-0.5 normal-case font-medium tracking-normal">
              {selected.length}
            </span>
          )}
          {loading && buckets.length === 0 && (
            <span className="text-slate-500 dark:text-slate-600 text-[10px] normal-case tracking-normal">loading\u2026</span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {buckets.length > 6 && (
            <input
              type="text"
              value={filterText}
              onChange={(e) => { setFilterText(e.target.value); setShowAll(true); }}
              placeholder={`Search ${title.toLowerCase()}\u2026`}
              className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-500 dark:text-slate-300 placeholder:text-slate-500 dark:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 mb-1"
            />
          )}

          {loading && buckets.length === 0 && (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-1.5 py-1">
                  <div className="w-3.5 h-3.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-800 animate-pulse" />
                  <div className="h-3 bg-slate-800 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                </div>
              ))}
            </div>
          )}

          {visible.map((b) => {
            const key = keyFn(b);
            const isSelected = selected.includes(key);
            const label = labelFn(b);
            const tooltip = getTooltip?.(b);

            return (
              <label
                key={key}
                title={tooltip}
                className={`flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer text-xs transition-colors ${
                  isSelected
                    ? 'text-blue-300 bg-blue-600/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-200 hover:bg-slate-100/40 dark:bg-slate-800/40'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-slate-300 dark:border-slate-600 bg-transparent'
                  }`}
                >
                  {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(key)}
                  className="sr-only"
                />
                <span className="truncate flex-1">{label}</span>
                <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-600 shrink-0">
                  {b.count}
                </span>
              </label>
            );
          })}

          {hasMore && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-[11px] text-blue-400 hover:text-blue-300 px-1.5 py-1 transition-colors"
            >
              Show all {filtered.length}
            </button>
          )}
          {showAll && filtered.length > initialShowCount && (
            <button
              type="button"
              onClick={() => { setShowAll(false); setFilterText(''); }}
              className="text-[11px] text-blue-400 hover:text-blue-300 px-1.5 py-1 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
