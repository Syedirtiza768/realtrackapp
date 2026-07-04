import { MoreHorizontal, Pencil, Send, Truck, X } from 'lucide-react';

interface Props {
  count: number;
  onPublish: () => void;
  onEditPolicies: () => void;
  onExport: () => void;
  onMore?: () => void;
  onClear: () => void;
}

export default function CatalogBulkBar({
  count,
  onPublish,
  onEditPolicies,
  onExport,
  onMore,
  onClear,
}: Props) {
  if (count === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/30">
      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
        {count} item{count === 1 ? '' : 's'} selected
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPublish}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Send size={12} /> Publish
        </button>
        <button
          type="button"
          onClick={onEditPolicies}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <Truck size={12} /> Shipping
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <Pencil size={12} /> Edit
        </button>
        {onMore && (
          <button
            type="button"
            onClick={onMore}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <MoreHorizontal size={14} /> More
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-lg p-1 text-slate-500 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-slate-800"
        aria-label="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  );
}
