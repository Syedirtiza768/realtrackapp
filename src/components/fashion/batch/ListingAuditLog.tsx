import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { batchApi, messageOf, type AuditEntry } from './batchApi';

const ACTION_LABEL: Record<string, string> = {
  'fashion.batch.images': 'Photos processed',
  'fashion.batch.compliance': 'Compliance check',
  'fashion.batch.compliance.recheck': 'Compliance re-check',
  'fashion.batch.autofix': 'Auto-fix applied',
  'fashion.batch.publish.queued': 'Publish started',
  'fashion.batch.publish.success': 'Published to eBay',
  'fashion.batch.publish.failed': 'Publish failed',
  'fashion.batch.failed': 'Pipeline error',
  'fashion.review.approved': 'Approved by reviewer',
  'fashion.review.rejected': 'Rejected by reviewer',
  'fashion.review.suggestion.applied': 'AI fix applied',
  'fashion.review.suggestion.edited': 'AI fix edited and applied',
  'fashion.review.suggestion.rejected': 'AI fix rejected',
  'fashion.review.edited': 'Edited in review',
};

function summary(entry: AuditEntry): string {
  const a = entry.afterSnapshot ?? {};
  const parts: string[] = [];
  if (typeof a.riskScore === 'number') parts.push(`risk ${a.riskScore}`);
  if (Array.isArray(a.issues)) parts.push(`${(a.issues as Array<{ severity?: string }>).filter((i) => i.severity !== 'info').length} issue(s)`);
  if (typeof a.usable === 'number') parts.push(`${a.usable} of ${a.processed} photos usable`);
  if (typeof a.ebayItemId === 'string') parts.push(`eBay item ${a.ebayItemId}`);
  if (typeof a.message === 'string') parts.push(a.message);
  if (typeof a.notes === 'string' && a.notes) parts.push(a.notes);
  if (typeof a.title === 'string' && entry.beforeSnapshot && entry.beforeSnapshot.title !== a.title) parts.push(`title → “${a.title}”`);
  if (a.dryRun === true) parts.push('dry run');
  return parts.join(' · ');
}

/** Every check, fix and publish attempt for one listing (listing_action_logs). */
export default function ListingAuditLog({ productId, organizationId, onClose }: { productId: string; organizationId: string | null; onClose: () => void }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    batchApi.audit(productId, organizationId).then((r) => live && setRows(r)).catch((e) => live && setError(messageOf(e)));
    return () => { live = false; };
  }, [productId, organizationId]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label="Listing audit log" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X size={18} /></button>
        </div>
        {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
        {!rows && !error ? <p className="mt-4 text-sm text-slate-500" role="status">Loading…</p> : null}
        {rows && !rows.length ? <p className="mt-4 text-sm text-slate-500">No recorded activity.</p> : null}
        <ol className="mt-4 space-y-3">
          {rows?.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{ACTION_LABEL[r.action] ?? r.action}</span>
                <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{r.result}{r.userId ? ' · by user' : ' · system'}</p>
              {summary(r) ? <p className="mt-1 break-words text-slate-700 dark:text-slate-300">{summary(r)}</p> : null}
              <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">Details</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify({ before: r.beforeSnapshot, after: r.afterSnapshot }, null, 2)}</pre></details>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
