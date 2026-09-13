import { CheckSquare, Edit3, Eye, ImageOff, MoreHorizontal, Send, Square } from 'lucide-react';
import OptimizedImage from '../../ui/OptimizedImage';
import type { CatalogConfig } from './catalogTypes';
import type { CatalogItem } from './catalogTypes';

type Props = {
  config: CatalogConfig;
  items: CatalogItem[];
  selected: Set<string>;
  loading: boolean;
  error: string;
  canPublish: boolean;
  onRetry: () => void;
  onToggle: (id: string) => void;
  onTogglePage: () => void;
  onView: (item: CatalogItem) => void;
  onEdit: (item: CatalogItem) => void;
  onPublish: (item: CatalogItem) => void;
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

export default function CatalogResultsTable({ config, items, selected, loading, error, canPublish, onRetry, onToggle, onTogglePage, onView, onEdit, onPublish }: Props) {
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" role="alert"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-white px-3 py-1.5 font-medium text-red-700 shadow-sm dark:bg-slate-900">Retry</button></div>;
  if (loading && !items.length) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">Loading catalog records…</div>;
  if (!items.length) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><MoreHorizontal className="mx-auto mb-2 text-slate-400" /><p className="font-medium text-slate-700 dark:text-slate-200">No catalog records match these filters.</p><p className="mt-1 text-sm text-slate-500">Try clearing a filter or broadening the search.</p></div>;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <caption className="sr-only">{config.label} catalog results</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/70">
            <tr><th className="w-10 px-3 py-3"><button type="button" onClick={onTogglePage} aria-label={allSelected ? 'Clear page selection' : 'Select page'}>{allSelected ? <CheckSquare size={17} /> : <Square size={17} />}</button></th><th className="px-3 py-3">Product</th><th className="px-3 py-3">SKU / MPN</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Condition</th><th className="px-3 py-3">Price / stock</th><th className="px-3 py-3">Images</th><th className="px-3 py-3">Date added</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Publications</th><th className="px-3 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={item.id} className={selected.has(item.id) ? 'bg-blue-50/50 dark:bg-blue-950/10' : undefined}>
                <td className="px-3 py-3 align-top"><button type="button" onClick={() => onToggle(item.id)} aria-label={selected.has(item.id) ? 'Clear ' + item.title : 'Select ' + item.title}>{selected.has(item.id) ? <CheckSquare size={17} className="text-blue-600" /> : <Square size={17} className="text-slate-400" />}</button></td>
                <td className="max-w-[320px] px-3 py-3 align-top"><div className="flex gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">{item.imageUrls[0] ? <OptimizedImage src={item.imageUrls[0]} alt="" variant="thumb" className="h-full w-full object-cover" /> : <ImageOff className="m-3 text-slate-400" size={24} />}</div><div className="min-w-0"><button type="button" onClick={() => onView(item)} className="line-clamp-2 text-left font-medium text-slate-900 hover:text-blue-600 dark:text-white">{item.title || 'Untitled product'}</button><p className="mt-1 truncate text-xs text-slate-500">{textAttribute(item, 'manufacturer') || item.brand || 'No manufacturer'}{textAttribute(item, 'model') ? ' · ' + textAttribute(item, 'model') : ''}{item.manualReview ? ' · review hold' : ''}</p></div></div></td>
                <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300"><div>{item.sku || '—'}</div><div className="mt-1">{textAttribute(item, 'mpn') || item.mpn || '—'}</div></td>
                <td className="max-w-[220px] px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300"><span className="line-clamp-2">{item.categoryName || item.categoryId || '—'}</span>{textAttribute(item, 'categoryFamily') ? <div className="mt-1 text-slate-500">{config.attributes.find((attribute) => attribute.key === 'categoryFamily')?.valueLabels?.[textAttribute(item, 'categoryFamily')] || textAttribute(item, 'categoryFamily').replace(/_/g, ' ')}</div> : null}<div className="mt-1 text-slate-400">{item.teamName || 'Unassigned'}</div></td>
                <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300">{(item.conditionLabel || item.conditionId || '—').replace(/_/g, ' ')}</td>
                <td className="px-3 py-3 align-top"><div className="font-medium text-slate-900 dark:text-white">{price(item.price)}</div><div className="mt-1 text-xs text-slate-500">{item.quantity ?? 0} in stock</div></td>
                <td className="px-3 py-3 align-top text-xs text-slate-500">{item.imageUrls.length || 0}</td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-slate-500 dark:text-slate-400">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-3 align-top"><span className={'inline-flex rounded-full px-2 py-1 text-xs font-medium ' + statusClass(item.publicationStatus === 'blocked' ? 'blocked' : item.verticalValidationStatus)}>{item.publicationStatus === 'blocked' ? 'Blocked' : item.verticalValidationStatus.replace(/_/g, ' ')}</span><div className="mt-1 text-xs text-slate-500">{item.reviewStatus || 'No review'}</div>{item.publicationStatus !== 'blocked' && item.verticalValidationStatus !== 'approved' ? <div className="mt-1 max-w-[150px] text-[11px] text-amber-700 dark:text-amber-300">Compliance approval required before publish.</div> : null}</td>
                <td className="px-3 py-3 align-top"><div className="space-y-1">{item.publications.length ? item.publications.slice(0, 3).map((publication) => <div key={publication.id} className="max-w-[190px]"><a href={publication.listingUrl || '#'} target="_blank" rel="noreferrer" className={'inline-flex rounded-full px-2 py-1 text-[11px] ' + statusClass(publication.listingStatus)}>{publication.storeName}: {publication.listingStatus}</a>{publication.lastErrorMessage ? <p className="mt-1 line-clamp-2 text-[11px] text-red-600 dark:text-red-300" title={publication.lastErrorMessage}>Error: {publication.lastErrorMessage}</p> : null}</div>) : <span className="text-xs text-slate-500">Unpublished</span>}</div></td>
                <td className="px-3 py-3 align-top"><div className="flex justify-end gap-1"><button type="button" onClick={() => onView(item)} title="Quick view" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"><Eye size={16} /></button><button type="button" onClick={() => onEdit(item)} title="Open full editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"><Edit3 size={16} /></button>{canPublish && item.publicationStatus !== 'blocked' && item.verticalValidationStatus === 'approved' ? <button type="button" onClick={() => onPublish(item)} title="Publish" className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"><Send size={16} /></button> : null}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700">Refreshing results…</div> : null}
    </div>
  );
}
