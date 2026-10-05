import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { stockError } from '../../lib/stockApi';

export const field =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 sm:text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
export const btn =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
export const btnPrimary =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
export const primaryStyle = { backgroundColor: 'var(--brand-primary, #2563eb)' } as const;
export const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';
export const th = 'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
export const td = 'px-3 py-2 align-top text-sm text-slate-700 dark:text-slate-200';

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`${btnPrimary} ${props.className ?? ''}`} style={primaryStyle} />;
}

const tones: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
};

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof tones | string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

const statusTone: Record<string, string> = {
  completed: 'green', synced: 'green', reserved: 'green', shipped: 'green', received: 'green', fulfilled: 'green', available: 'green', active: 'green',
  picked: 'blue', ordered: 'blue', in_transit: 'blue', partially_received: 'blue', dropshipped: 'violet', shadow: 'violet',
  draft: 'slate', open: 'amber', pending: 'amber', pending_approval: 'amber', awaiting_procurement: 'amber', no_target: 'slate',
  backorder: 'red', unmatched: 'red', failed: 'red', cancelled: 'slate', released: 'slate', quarantined: 'amber', written_off: 'slate',
};

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <Badge>—</Badge>;
  return <Badge tone={statusTone[status] ?? 'slate'}>{label ?? status.replace(/_/g, ' ')}</Badge>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'warn' | 'bad' }) {
  return (
    <div className={card}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone === 'bad' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Notice({ error, message }: { error?: string | null; message?: string | null }) {
  return (
    <>
      {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{message}</p> : null}
    </>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {children ? <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{children}</div> : null}
    </div>
  );
}

/** Right-hand panel on desktop, full screen on phones. Escape closes. */
export function Drawer({ title, subtitle, onClose, children, wide }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={`relative flex h-[100dvh] w-full flex-col bg-slate-50 shadow-xl outline-none dark:bg-slate-950 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle ? <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
          </div>
          <button type="button" className={btn} onClick={onClose} aria-label="Close panel"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Loads data with abort-on-change; `reload()` re-runs it. */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    load(controller.signal)
      .then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((err) => { if (!controller.signal.aborted) setError(stockError(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}

/** Runs a mutation with busy/error/message state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string | ((result: T) => string)) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await fn();
      if (success) setMessage(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (err) {
      setError(stockError(err));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, message, run, setError, setMessage };
}

export const fmtDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const fmtDay = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');
export const fmtMoney = (value: string | number | null | undefined, currency = 'USD') =>
  value == null || value === '' ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value));
export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function Thumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover dark:border-slate-700" />
  ) : (
    <div className="h-10 w-10 shrink-0 rounded-md border border-dashed border-slate-300 dark:border-slate-700" aria-hidden />
  );
}

export function newIdempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
