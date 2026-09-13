import type { ReactNode } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';

type LoadingProps = {
  label?: string;
  rows?: number;
};

export function LoadingPlaceholder({ label = 'Loading…', rows = 3 }: LoadingProps) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

type EmptyProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <Inbox className="mx-auto text-slate-400" size={28} aria-hidden="true" />
      <p className="mt-3 font-medium text-slate-800 dark:text-slate-100">{title}</p>
      {description ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

type ErrorProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ title = 'Could not load', message, onRetry }: ErrorProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200" role="alert">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 py-2 font-medium text-red-700 shadow-sm dark:bg-slate-900 dark:text-red-200"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </div>
  );
}
