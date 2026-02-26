/* ─── ResultsGrid ──────────────────────────────────────────
 *  Grid / List view for search results with infinite scroll
 *  support, loading skeletons, and empty state.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  LayoutList,
  Eye,
  Package,
  Sparkles,
  ArrowDown,
} from 'lucide-react';
import ListingCard from './ListingCard';
import { getFirstImageUrl } from '../../lib/searchApi';
import type { SearchItem } from '../../types/search';
import { conditionLabel } from '../../types/search';

type ViewMode = 'grid' | 'list';

interface Props {
  items: SearchItem[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPageChange: (page: number) => void;
  onQuickView: (id: string) => void;
  /** For infinite scroll: call to load more items */
  onLoadMore?: () => void;
  hasMore?: boolean;
  /** Use infinite scroll instead of pagination */
  infiniteScroll?: boolean;
}

const formatPrice = (raw: string | null) => {
  if (!raw) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
};

export default function ResultsGrid({
  items,
  total,
  loading,
  page,
  pageSize,
  viewMode,
  onViewModeChange,
  onPageChange,
  onQuickView,
  onLoadMore,
  hasMore,
  infiniteScroll,
}: Props) {
  const totalPages = Math.ceil(total / pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* ── Infinite scroll observer ────────────────────────────── */
  useEffect(() => {
    if (!infiniteScroll || !onLoadMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [infiniteScroll, onLoadMore, hasMore, loading]);

  return (
    <div>
      {/* View toggle toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 border border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`px-2.5 py-1.5 transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-2.5 py-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutList size={14} />
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && items.length === 0 && (
        <div className={viewMode === 'grid'
          ? 'grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'space-y-2'
        }>
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} viewMode={viewMode} />
          ))}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && items.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ListingCard key={item.id} item={item} onQuickView={onQuickView} />
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && items.length > 0 && (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-900/80 text-slate-500 font-medium sticky top-0">
              <tr>
                <th className="p-3 w-16">Image</th>
                <th className="p-3">Product</th>
                <th className="p-3 hidden md:table-cell">Brand</th>
                <th className="p-3 hidden lg:table-cell">Category</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 hidden sm:table-cell text-center">Qty</th>
                <th className="p-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.map((item) => {
                const imageUrl = getFirstImageUrl(item.itemPhotoUrl);
                const price = formatPrice(item.startPrice);
                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" loading="lazy" className="w-12 h-12 object-cover rounded-lg" />
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center text-slate-700 bg-slate-800 rounded-lg">
                          <Package size={16} />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); onQuickView(item.id); }}
                        className="font-medium text-slate-200 hover:text-blue-400 line-clamp-1 transition-colors"
                      >
                        {item.titleHighlight ? (
                          <span dangerouslySetInnerHTML={{ __html: item.titleHighlight }} />
                        ) : (
                          item.title ?? 'Untitled'
                        )}
                      </a>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{item.customLabelSku}</div>
                    </td>
                    <td className="p-3 text-slate-400 text-xs hidden md:table-cell">{item.cBrand ?? '—'}</td>
                    <td className="p-3 text-slate-500 text-xs max-w-48 truncate hidden lg:table-cell">
                      {item.categoryName ? (() => {
                        const parts = item.categoryName.split('/').filter(Boolean);
                        return parts.length > 1 ? parts[parts.length - 1] : item.categoryName;
                      })() : '—'}
                    </td>
                    <td className="p-3 text-right text-slate-200 font-semibold">
                      {price !== null ? `$${price.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-3 text-center text-slate-400 text-xs hidden sm:table-cell">
                      {item.quantity ?? '—'}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => onQuickView(item.id)}
                        className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Sparkles className="mx-auto text-slate-600 mb-4" size={32} />
          <h4 className="text-lg font-semibold text-slate-200 mb-1">No results found</h4>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Try adjusting your search terms or removing some filters to see more results.
          </p>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {infiniteScroll && hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-8">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ArrowDown size={16} className="animate-bounce" />
              Loading more…
            </div>
          )}
        </div>
      )}

      {/* Pagination (when not infinite scroll) */}
      {!infiniteScroll && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />
      )}

      {/* Loading overlay for page transitions */}
      {loading && items.length > 0 && !infiniteScroll && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center rounded-xl pointer-events-none">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

/* ── Pagination ───────────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = generatePageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6">
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      {pages.map((p, i) =>
        p === -1 ? (
          <span key={`e-${i}`} className="px-2 text-slate-600">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-[36px] py-2 rounded-lg border text-sm font-medium transition-colors ${
              p === page
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {p + 1}
          </button>
        ),
      )}

      <button
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page >= totalPages - 1}
        className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ── Skeleton card ────────────────────────────────────────── */

function SkeletonCard({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-3 p-3 border border-slate-800 rounded-lg animate-pulse">
        <div className="w-12 h-12 bg-slate-800 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-800 rounded w-3/4" />
          <div className="h-3 bg-slate-800 rounded w-1/3" />
        </div>
        <div className="h-5 bg-slate-800 rounded w-16" />
      </div>
    );
  }

  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden animate-pulse">
      <div className="h-44 bg-slate-800" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-slate-800 rounded w-full" />
        <div className="h-3 bg-slate-800 rounded w-2/3" />
        <div className="h-3 bg-slate-800 rounded w-1/3" />
        <div className="flex justify-between items-end pt-2">
          <div className="h-6 bg-slate-800 rounded w-20" />
          <div className="h-7 bg-slate-800 rounded w-14" />
        </div>
      </div>
    </div>
  );
}

/* ── Page number generator ────────────────────────────────── */

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const pages: number[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);

  if (start > 1) pages.push(-1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 2) pages.push(-1);
  pages.push(total - 1);

  return pages;
}
