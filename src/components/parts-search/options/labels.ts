import type { OptionVerdict } from '../../../lib/partsSearchOptionsApi';

/** How an option relates to the number asked for (row badge + modal context). */
export const MATCH_STYLE: Record<string, string> = {
  exact: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  superseded: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  oem_equivalent: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  aftermarket_equivalent: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  possible: 'border border-dashed border-amber-400 text-amber-800 dark:border-amber-600 dark:text-amber-300',
  omni_core: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

export const MATCH_LABEL: Record<string, string> = {
  exact: 'Exact number',
  superseded: 'Superseded',
  oem_equivalent: 'OEM equivalent',
  aftermarket_equivalent: 'Aftermarket equivalent',
  possible: 'Unverified equivalent',
  omni_core: 'Omni Core stock',
};

export const VERDICT: Record<OptionVerdict, { label: string; className: string }> = {
  fits: { label: 'Fits', className: 'bg-emerald-600 text-white' },
  likely: { label: 'Likely fits', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  universal: { label: 'Universal', className: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
  unverified: { label: 'Not confirmed', className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  does_not_fit: { label: 'Does not fit', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};
