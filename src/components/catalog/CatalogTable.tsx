import { ChevronLeft, ChevronRight, Package, Search } from 'lucide-react';
import { sanitizeHighlight } from '../../lib/sanitize';
import { getFirstImageUrl } from '../../lib/searchApi';
import type { SearchItem, SortMode } from '../../types/search';
import { conditionLabel } from '../../types/search';
import TeamBadge from './TeamBadge';
import ListingStatusCell from './ListingStatusCell';

interface Props {
  items: SearchItem[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  sortMode: SortMode;
  onSortChange: (sort: SortMode) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onQuickView: (id: string, item: SearchItem) => void;
  onPublish?: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function formatPrice(raw: string | null) {
  if (!raw) return '—';
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isNaN(n) ? '—' : `$${n.toFixed(2)}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStock(qty: string | null) {
  if (qty == null || qty === '') return '—';
  const n = parseFloat(qty.replace(',', '.'));
  return Number.isNaN(n) ? qty : String(n);
}

export default function CatalogTable({
  items,
  total,
  loading,
  page,
  pageSize,
  sortMode,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onQuickView,
  onPublish,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const allSelected = items.length > 0 && items.every((i) => selectedIds?.has(i.id));
  const someSelected = !allSelected && items.some((i) => selectedIds?.has(i.id));

  const toggleDateSort = () => {
    onSortChange(sortMode === 'newest' ? 'title_asc' : 'newest');
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
            <tr>
              {onToggleSelect && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() => onSelectAll?.(allSelected ? [] : items.map((i) => i.id))}
                    className="h-4 w-4 cursor-pointer rounded accent-blue-600"
                    aria-label="Select all on page"
                  />
                </th>
              )}
              <th className="px-3 py-3">SKU / Identifier</th>
              <th className="w-16 px-3 py-3">Image</th>
              <th className="px-3 py-3">Title</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3">Condition</th>
              <th className="px-3 py-3 text-center">Stock</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3 text-right">Price</th>
              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={toggleDateSort}
                  className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Date Added
                  {sortMode === 'newest' && <span aria-hidden>↓</span>}
                </button>
              </th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && items.length === 0 &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={11} className="px-3 py-4">
                    <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" />
                  </td>
                </tr>
              ))}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-16 text-center">
                  <Search className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={28} />
                  <p className="font-medium text-slate-700 dark:text-slate-200">No results found</p>
                  <p className="mt-1 text-xs text-slate-500">Try adjusting search or filters.</p>
                </td>
              </tr>
            )}

            {items.map((item) => {
              const imageUrl = getFirstImageUrl(item.itemPhotoUrl);
              const isSelected = selectedIds?.has(item.id) ?? false;
              return (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                    isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {onToggleSelect && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(item.id)}
                        className="h-4 w-4 cursor-pointer rounded accent-blue-600"
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                    {item.customLabelSku ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <Package size={16} />
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onQuickView(item.id, item)}
                      className="line-clamp-2 text-left font-medium text-slate-800 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {item.titleHighlight ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHighlight(item.titleHighlight),
                          }}
                        />
                      ) : (
                        item.title ?? 'Untitled'
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <TeamBadge name={item.teamName} color={item.teamColor} />
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {conditionLabel(item.conditionId)}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-600 dark:text-slate-300">
                    {formatStock(item.quantity)}
                  </td>
                  <td className="max-w-[8rem] truncate px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {item.location ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">
                    {formatPrice(item.startPrice)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(item.importedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <ListingStatusCell
                      status={item.catalogStatus}
                      onPublish={
                        item.catalogStatus === 'ready_to_publish' && onPublish
                          ? () => onPublish(item.id)
                          : undefined
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {(selectedIds?.size ?? 0) > 0 && (
            <>
              <span className="font-medium text-blue-700 dark:text-blue-300">
                {(selectedIds?.size ?? 0).toLocaleString()} selected
              </span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
            </>
          )}
          Showing{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{from}</span> to{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{to}</span> of{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {total.toLocaleString()}
          </span>{' '}
          results
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => onPageChange(Math.max(0, page - 1))}
                className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={14} />
              </button>
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === -1 ? (
                  <span key={`e-${i}`} className="px-1">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`min-w-8 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                      p === page
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p + 1}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          <label className="inline-flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && items.length > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-slate-900/40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}
    </div>
  );
}

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
