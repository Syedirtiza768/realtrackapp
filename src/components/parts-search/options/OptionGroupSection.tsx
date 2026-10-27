import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { OptionGroup, OptionItem } from '../../../lib/partsSearchOptionsApi';
import type { GalleryTarget } from './ImageGalleryDialog';
import OptionRow from './OptionRow';

const PAGE = 25;

const ACCENT: Record<string, string> = {
  exact: 'border-l-sky-500',
  superseded: 'border-l-indigo-500',
  oem_equivalent: 'border-l-teal-500',
  aftermarket_equivalent: 'border-l-violet-500',
  possible: 'border-l-amber-400',
  fits: 'border-l-emerald-600',
  likely: 'border-l-emerald-300',
  universal: 'border-l-violet-400',
  unverified: 'border-l-slate-300',
  does_not_fit: 'border-l-red-400',
  omni_core_stock: 'border-l-emerald-500',
  matches: 'border-l-slate-300',
  related: 'border-l-slate-200',
};

type Props = {
  group: OptionGroup;
  query: string;
  requestRef: string;
  hasVehicle: boolean;
  showingUnavailable: boolean;
  onShowUnavailable: () => void;
  onImage: (target: GalleryTarget) => void;
  onOpen: (item: OptionItem) => void;
  /** Part picked from the typeahead: its group opens and pages far enough to show it. */
  focusId?: string | null;
};

/** One equivalence / verdict group: always complete, paged client-side. */
export default function OptionGroupSection({ group, query, requestRef, hasVehicle, showingUnavailable, onShowUnavailable, onImage, onOpen, focusId }: Props) {
  const focusIndex = focusId ? group.items.findIndex((item) => item.partId === focusId) : -1;
  const [open, setOpen] = useState(!group.collapsedByDefault || focusIndex >= 0);
  const [shown, setShown] = useState(Math.max(PAGE, focusIndex + 1));
  const inStock = group.items.filter((i) => i.availability.status === 'in_stock' || (i.omniStock?.available ?? 0) > 0).length;

  return (
    <section className={`rounded-xl border border-l-4 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${ACCENT[group.key] ?? ''}`} aria-label={group.label}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left"
      >
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{group.label}</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {group.items.length} shown{inStock ? ` · ${inStock} in stock` : ''}
          {group.hiddenUnavailable ? ` · ${group.hiddenUnavailable} not available hidden` : ''}
        </span>
        {group.key === 'possible' && (
          <span className="text-xs text-amber-700 dark:text-amber-400">Reached through unverified cross-references — check before offering</span>
        )}
      </button>
      {open && (
        <>
          {group.items.length > 0 ? (
            <ul className="border-t border-slate-100 dark:border-slate-800">
              {group.items.slice(0, shown).map((item) => (
                <OptionRow
                  key={item.partId}
                  item={item}
                  query={query}
                  requestRef={requestRef}
                  hasVehicle={hasVehicle}
                  onImage={onImage}
                  onOpen={onOpen}
                  focused={item.partId === focusId}
                />
              ))}
            </ul>
          ) : (
            <p className="border-t border-slate-100 px-3 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">Nothing sellable now in this group.</p>
          )}
          <div className="flex flex-wrap gap-3 px-3 pb-2 pt-1 text-xs">
            {group.items.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="font-medium hover:underline" style={{ color: 'var(--brand-primary)' }}>
                Show {Math.min(PAGE, group.items.length - shown)} more of {group.items.length - shown}
              </button>
            )}
            {group.hiddenUnavailable > 0 && !showingUnavailable && (
              <button type="button" onClick={onShowUnavailable} className="font-medium text-slate-500 hover:underline dark:text-slate-400">
                Show {group.hiddenUnavailable} not available (we had it)
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
