import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type FeedbackTone = 'success' | 'error' | 'info' | 'warning';

const TONE: Record<FeedbackTone, { wrap: string; icon: typeof Info; role: 'status' | 'alert' }> = {
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200',
    icon: CheckCircle2,
    role: 'status',
  },
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200',
    icon: AlertCircle,
    role: 'alert',
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
    icon: AlertTriangle,
    role: 'status',
  },
  info: {
    wrap: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
    icon: Info,
    role: 'status',
  },
};

type Props = {
  tone?: FeedbackTone;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

export default function FeedbackPanel({ tone = 'info', children, onDismiss, className = '' }: Props) {
  const config = TONE[tone];
  const Icon = config.icon;
  return (
    <div role={config.role} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${config.wrap} ${className}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Dismiss message">
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}
