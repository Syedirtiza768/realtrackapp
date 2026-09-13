import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  filterCount: number;
  children: ReactNode;
};

export default function CatalogMobileFilterDrawer({ open, onClose, filterCount, children }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previouslyHidden = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    window.requestAnimationFrame(() => focusables()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div id={titleId} className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
            {filterCount > 0 ? (
              <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white dark:bg-slate-100 dark:text-slate-900">{filterCount}</span>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Close filters">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full rounded-lg py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
