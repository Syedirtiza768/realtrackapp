/* ─── Part description modal (over the option list) ────────
 *  Opens from a result row. Shows why the part is in the list
 *  (match, trail, fitment verdict, stock) above the full part
 *  description, steps through the list with ← / →, and keeps
 *  the list (scroll, expanded groups) untouched behind it.
 *  Omni Core warehouse rows have no PartsBazar360 record, so
 *  they show what Omni Core knows.
 * ────────────────────────────────────────────────────────── */

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, Warehouse, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef } from 'react';
import { formatMoney, getPartDetail, partImageUrl } from '../../../lib/partsSearchApi';
import type { OptionItem } from '../../../lib/partsSearchOptionsApi';
import PartDetailView from '../PartDetailView';
import { MATCH_LABEL, MATCH_STYLE, VERDICT } from './labels';

export type PartDetailTarget = { partId: string; title: string; item?: OptionItem };

type Props = {
  target: PartDetailTarget | null;
  /** The options in list order, for previous / next. */
  sequence: OptionItem[];
  hasVehicle: boolean;
  onNavigate: (target: PartDetailTarget) => void;
  onClose: () => void;
  onSearchNumber: (number: string) => void;
};

function WhyInList({ item, hasVehicle }: { item: OptionItem; hasVehicle: boolean }) {
  const verdict = item.fitment.verdict ? VERDICT[item.fitment.verdict] : null;
  const a = item.availability;
  const omni = item.omniStock;
  const price =
    a.priceMin != null && a.priceMax != null && a.priceMax > a.priceMin
      ? `${formatMoney(a.priceMin, a.currency)} – ${formatMoney(a.priceMax, a.currency)}`
      : formatMoney(a.priceMin, a.currency);
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-slate-500 dark:text-slate-400">In your list as</span>
        {item.match.relation !== 'text' ? (
          <span className={`rounded px-1.5 py-0.5 font-medium ${MATCH_STYLE[item.match.relation] ?? ''}`}>
            {MATCH_LABEL[item.match.relation] ?? item.match.label}
            {item.match.matchedNumber && item.match.relation !== 'exact' ? ` of ${item.match.matchedNumber}` : ''}
          </span>
        ) : (
          <span className="rounded bg-slate-200 px-1.5 py-0.5 font-medium dark:bg-slate-700">Text match</span>
        )}
        {verdict && (hasVehicle || item.fitment.verdict === 'does_not_fit') && (
          <span className={`rounded px-1.5 py-0.5 font-semibold ${verdict.className}`}>{verdict.label}</span>
        )}
        {(hasVehicle || item.fitment.verdict === 'does_not_fit') && item.fitment.reason && <span>{item.fitment.reason}</span>}
        {!hasVehicle && item.fitment.documented && <span className="text-slate-500 dark:text-slate-400">Fits: {item.fitment.documented}</span>}
      </div>
      {item.match.note && <p className="text-amber-700 dark:text-amber-400">{item.match.note}</p>}
      {item.match.trail.length > 0 && (item.match.trail.length > 1 || item.match.relation !== 'exact') && (
        <ol className="space-y-0.5">
          {item.match.trail.map((step, index) => (
            <li key={`${step.partId}-${index}`}>
              <span className="text-slate-400">{index + 1}.</span> {step.text} <span className="text-slate-400">— {step.source}</span>
            </li>
          ))}
        </ol>
      )}
      {item.fitment.evidence.length > 0 && hasVehicle && (
        <p className="text-slate-500 dark:text-slate-400">
          Evidence: {item.fitment.evidence.map((e) => `${e.source} (${e.strength})`).join('; ')}
        </p>
      )}
      <p>
        <span className="font-semibold">{a.priceMin != null ? price : 'No live price'}</span>
        {' · '}
        {a.status === 'in_stock'
          ? `${a.totalQuantity} in stock${a.locations[0] ? ` · ${a.locations[0].warehouse}` : ''}`
          : a.status === 'can_source'
            ? `Can source${a.leadTimeDays ? ` · ${a.leadTimeDays} days` : ''}`
            : 'Not available now'}
        {a.sellerCount ? ` · ${a.sellerCount} seller${a.sellerCount === 1 ? '' : 's'}` : ''}
        {omni && omni.available > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            · <Warehouse size={11} aria-hidden="true" /> Omni Core: {omni.available}
          </span>
        )}
      </p>
    </div>
  );
}

/** Omni Core warehouse item (not in PartsBazar360). */
function OmniItemDetail({ item, headingId }: { item: OptionItem; headingId: string }) {
  const image = partImageUrl(item.image);
  const omni = item.omniStock;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {image ? (
        <img src={image} alt={item.title} referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-slate-200 bg-white object-contain dark:border-slate-700 dark:bg-slate-900" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <ImageOff size={32} aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 space-y-3">
        <h2 id={headingId} className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.title}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-3">
          {[
            ['Brand', item.brand],
            ['Part number', item.manufacturerPartNumber || item.match.matchedNumber],
            ['Category', item.category],
            ['Numbers', item.numbers.join(', ')],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label as string} className="min-w-0">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{value}</dd>
              </div>
            ))}
        </dl>
        {omni && omni.items.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Omni Core stock</h3>
            <ul className="space-y-1.5">
              {omni.items.map((row) => (
                <li key={row.inventoryItemId} className="text-slate-700 dark:text-slate-200">
                  <span className="font-mono text-xs">{row.sku}</span> · {row.available} available
                  {row.warehouses.length > 0 && <span className="text-slate-500 dark:text-slate-400"> · {row.warehouses.map((w) => `${w.name} (${w.available})`).join(', ')}</span>}
                  {row.sourcingMode && row.sourcingMode !== 'STOCKED' && <span className="text-slate-500 dark:text-slate-400"> · {row.sourcingMode.toLowerCase().replace(/_/g, ' ')}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">This item is in Omni Core’s own inventory and has no PartsBazar360 record.</p>
      </div>
    </div>
  );
}

export default function PartDetailDialog({ target, sequence, hasVehicle, onNavigate, onClose, onSearchNumber }: Props) {
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const index = target ? sequence.findIndex((item) => item.partId === target.partId) : -1;
  const item = target?.item ?? (index >= 0 ? sequence[index] : undefined);
  const isOmni = Boolean(target?.partId.startsWith('omni:'));
  // Same query as PartDetailView (shared cache): the header shows the real title once loaded.
  const loaded = useQuery({
    queryKey: ['parts-search', 'part', target?.partId ?? ''],
    queryFn: ({ signal }) => getPartDetail(target!.partId, signal),
    enabled: Boolean(target) && !isOmni,
    staleTime: 60_000,
    retry: 1,
  });
  const headerTitle = loaded.data?.title ?? item?.title ?? target?.title ?? '';

  const step = useCallback(
    (delta: number) => {
      if (index < 0 || !sequence.length) return;
      const next = sequence[(index + delta + sequence.length) % sequence.length];
      onNavigate({ partId: next.partId, title: next.title, item: next });
    },
    [index, sequence, onNavigate],
  );

  // Focus the panel on open, restore it on close; lock page scroll meanwhile.
  const open = Boolean(target);
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      returnFocus.current?.focus?.();
    };
  }, [open]);

  // New part → back to the top of the panel.
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [target?.partId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing = el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (event.key === 'Escape') onClose();
      else if (!typing && event.key === 'ArrowRight') step(1);
      else if (!typing && event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'Tab' && panelRef.current) {
        // Keep focus inside the dialog.
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, step]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-0 sm:p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className="relative flex h-full w-full max-w-6xl flex-col overflow-y-auto bg-slate-50 shadow-2xl outline-none dark:bg-slate-950 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200" aria-hidden="true">
            {headerTitle}
          </p>
          {index >= 0 && sequence.length > 1 && (
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <button type="button" onClick={() => step(-1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Previous option" title="Previous option (←)">
                <ChevronLeft size={16} />
              </button>
              <span className="tabular-nums">
                {index + 1} / {sequence.length}
              </span>
              <button type="button" onClick={() => step(1)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Next option" title="Next option (→)">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          {!isOmni && (
            <a
              href={`/parts-search/parts/${encodeURIComponent(target.partId)}`}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-flex"
              title="Open this part on its own page in a new tab"
            >
              Full page <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100" aria-label="Close part details">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {isOmni && item ? (
            <div className="space-y-4">
              <WhyInList item={item} hasVehicle={hasVehicle} />
              <OmniItemDetail item={item} headingId={headingId} />
            </div>
          ) : (
            <PartDetailView
              key={target.partId}
              id={target.partId}
              as="modal"
              headingId={headingId}
              onSearchNumber={onSearchNumber}
              context={item ? <WhyInList item={item} hasVehicle={hasVehicle} /> : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
