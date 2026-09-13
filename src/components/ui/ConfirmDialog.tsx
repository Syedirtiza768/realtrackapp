import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onClose,
  children,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previouslyHidden = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (node) => !node.hasAttribute('disabled'),
      );
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previouslyHidden;
      restoreRef.current?.focus();
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60" onClick={() => { if (!busy) onClose(); }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {description ? (
          <div id={descriptionId} className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {description}
          </div>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : ''
            }`}
            style={tone === 'danger' ? undefined : { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}
          >
            {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
