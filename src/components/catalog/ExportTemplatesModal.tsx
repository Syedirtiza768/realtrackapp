import { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { authHeaders } from '../../lib/authApi';

interface Props {
  open: boolean;
  listingIds: string[];
  teamIds?: string[];
  teamLabels?: string[];
  onClose: () => void;
  onComplete?: () => void;
}

export default function ExportTemplatesModal({
  open,
  listingIds,
  teamIds = [],
  teamLabels = [],
  onClose,
  onComplete,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setExporting(false);
    }
  }, [open]);

  const handleExport = async () => {
    if (listingIds.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/catalog-products/export-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          listingIds,
          teamIds: teamIds.length ? teamIds : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers.get('Content-Disposition');
      a.download = disp?.match(/filename="(.+)"/)?.[1] || 'listings.zip';
      a.click();
      URL.revokeObjectURL(url);
      onComplete?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-emerald-400" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Export Templates ({listingIds.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 p-1 rounded-lg hover:bg-slate-100 dark:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Export eBay listing templates using the policies already assigned to each listing.
          </p>

          {teamLabels.length > 0 && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
              Export respects active team filter: <strong>{teamLabels.join(', ')}</strong>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
            Policies (shipping, return, payment) will use each listing's existing assignments.
            To change policies, use the <strong>Shipping</strong> button in the bulk action bar.
          </div>

          {error && (
            <div className="text-xs text-red-400 border border-red-800/60 bg-red-950/20 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || listingIds.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exporting ? 'Exporting…' : 'Download Templates'}
          </button>
        </div>
      </div>
    </div>
  );
}
