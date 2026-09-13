import { Loader2, Send, X } from 'lucide-react';

export type PublishTarget = {
  id?: string;
  status?: string;
  errorMessage?: string;
  lastErrorMessage?: string;
  errorPayload?: { message?: unknown; errors?: unknown } | null;
};

export type CatalogPublishJob = {
  id: string;
  status: string;
  targets?: PublishTarget[];
  targetCount?: number;
  dailyRemaining?: number;
};

const TERMINAL_JOB_STATES = new Set(['completed', 'completed_with_errors', 'failed', 'partial', 'cancelled']);

export function isTerminalPublishJob(status: string) {
  return TERMINAL_JOB_STATES.has(status);
}

function targetError(target: PublishTarget) {
  if (target.errorMessage || target.lastErrorMessage) return target.errorMessage || target.lastErrorMessage || '';
  const payload = target.errorPayload;
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
  if (Array.isArray(payload?.errors)) {
    return payload.errors
      .map((error) => (typeof error === 'string' ? error : (error as { message?: unknown })?.message))
      .filter((error): error is string => typeof error === 'string' && error.trim().length > 0)
      .join('; ');
  }
  return '';
}

function phaseOf(job: CatalogPublishJob) {
  const closing = ' Closing this panel does not cancel the job.';
  const status = job.status;
  if (status === 'queued' || status === 'submitted' || status === 'pending') {
    return { key: 'submitted', label: 'Submitted', detail: 'The publish job has been accepted and is waiting to start.' + closing };
  }
  if (status === 'completed') {
    const failed = (job.targets || []).some((target) => target.status === 'failed' || targetError(target));
    if (failed) {
      return { key: 'partial', label: 'Partially failed', detail: 'Some marketplace targets published and others did not. Review the target details below.' + closing };
    }
    return { key: 'published', label: 'Published', detail: 'Publishing finished. Check each store and marketplace target for listing URLs or remaining warnings.' + closing };
  }
  if (status === 'completed_with_errors' || status === 'partial') {
    return { key: 'partial', label: 'Partially failed', detail: 'Some marketplace targets published and others did not. Review the target details below.' + closing };
  }
  if (status === 'failed') {
    return { key: 'failed', label: 'Failed', detail: 'The publish job did not complete. Review compliance blockers and store errors before retrying.' + closing };
  }
  if (status === 'cancelled') {
    return { key: 'failed', label: 'Cancelled', detail: 'This job is no longer running.' + closing };
  }
  return { key: 'processing', label: 'Processing', detail: 'eBay publication is in progress.' + closing };
}

const PHASE_CLASS: Record<string, string> = {
  submitted: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  processing: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200',
  partial: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
  failed: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200',
};

type Props = {
  job: CatalogPublishJob;
  onClose: () => void;
};

export default function CatalogPublishJobPanel({ job, onClose }: Props) {
  const phase = phaseOf(job);
  const running = !isTerminalPublishJob(job.status);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">
            {running ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            <span>Publish {phase.label.toLowerCase()}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PHASE_CLASS[phase.key]}`}>{phase.label}</span>
            {job.targetCount ? <span className="text-xs font-normal text-slate-500">· {job.targetCount} target(s)</span> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{phase.detail}</p>
          {job.dailyRemaining != null ? <p className="mt-1 text-xs text-slate-500">Daily publish capacity remaining: {job.dailyRemaining}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-700" aria-label="Close publish progress">
          <X size={16} />
        </button>
      </div>
      {job.targets?.length ? (
        <div className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
          {job.targets.map((target, index) => {
            const error = targetError(target);
            const status = target.status || 'pending';
            return (
              <div key={target.id || index} className="rounded bg-slate-50 px-2 py-1 dark:bg-slate-800">
                <div className="flex justify-between gap-2">
                  <span>Target {index + 1}</span>
                  <span className={error || status === 'failed' ? 'text-red-600 dark:text-red-300' : status === 'published' ? 'text-emerald-600 dark:text-emerald-300' : status === 'skipped' ? 'text-amber-600 dark:text-amber-300' : undefined}>
                    {status}
                  </span>
                </div>
                {error ? <p className="mt-1 line-clamp-3 text-red-600 dark:text-red-300" role="alert">{error}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
