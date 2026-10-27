/* ─── Parts Search box ─────────────────────────────────────
 *  One input for part numbers (any separator), OEM numbers,
 *  keywords and year/make/model phrases. Typeahead groups
 *  parts, categories, brands and makes from PartsBazar360.
 * ────────────────────────────────────────────────────────── */

import { Loader2, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatMoney,
  partImageUrl,
  rememberSearch,
  resultsPath,
  suggestParts,
  type PartsSearchParams,
  type PartsSuggestResponse,
} from '../../lib/partsSearchApi';

const DEBOUNCE_MS = 200;

type Option =
  | { kind: 'part'; key: string; label: string; detail: string; image: string | null; to: string }
  | { kind: 'filter'; key: string; label: string; detail: string; to: string };

function useSuggestions(query: string) {
  const [data, setData] = useState<PartsSuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      suggestParts(q, controller.signal)
        .then((response) => {
          if (!controller.signal.aborted) setData(response);
        })
        .catch(() => {
          if (!controller.signal.aborted) setData(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return { data, loading };
}

type Props = {
  initialQuery?: string;
  /** Filters to keep when a plain query is submitted from the results page. */
  keepParams?: Omit<PartsSearchParams, 'q' | 'page'>;
  /**
   * Options results: build the target URL for a query (keeps the selected
   * vehicle). Facet suggestions then refine the query text instead.
   */
  buildPath?: (q: string) => string;
  size?: 'lg' | 'md';
  autoFocus?: boolean;
};

export default function SearchBox({ initialQuery = '', keepParams, buildPath, size = 'md', autoFocus }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { data, loading } = useSuggestions(open ? query : '');

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  // "/" focuses the search box from anywhere in the portal, like most search UIs.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options = useMemo<Option[]>(() => {
    if (!data) return [];
    const q = query.trim();
    const out: Option[] = data.parts.map((part) => ({
      kind: 'part',
      key: `part:${part.id}`,
      label: part.title,
      detail: [part.brand, part.manufacturerPartNumber, formatMoney(part.minPrice, part.currency)]
        .filter((value) => value && value !== '—')
        .join(' · '),
      image: partImageUrl(part.imageUrl),
      to: `/parts-search/parts/${encodeURIComponent(part.id)}`,
    }));
    for (const make of data.makes.slice(0, 3)) {
      out.push({ kind: 'filter', key: `make:${make}`, label: make, detail: 'Vehicle make', to: buildPath ? buildPath(`${make} ${q}`.trim()) : resultsPath({ q, make: [make] }) });
    }
    for (const category of data.categories.slice(0, 3)) {
      out.push({ kind: 'filter', key: `category:${category}`, label: category, detail: 'Category', to: buildPath ? buildPath(`${q} ${category}`.trim()) : resultsPath({ q, category: [category] }) });
    }
    for (const brand of data.brands.slice(0, 3)) {
      out.push({ kind: 'filter', key: `brand:${brand}`, label: brand, detail: 'Brand', to: buildPath ? buildPath(`${brand} ${q}`.trim()) : resultsPath({ q, brand: [brand] }) });
    }
    return out;
  }, [data, query, buildPath]);

  const showList = open && query.trim().length >= 2 && (options.length > 0 || loading);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (active >= 0 && options[active]) {
      go(options[active].to);
      return;
    }
    const q = query.trim();
    if (!q && !keepParams && !buildPath) return;
    rememberSearch(q);
    go(buildPath ? buildPath(q) : resultsPath({ ...keepParams, q: q || undefined }));
  };

  const go = (to: string) => {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    navigate(to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (options.length ? (index + 1) % options.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (options.length ? (index <= 0 ? options.length - 1 : index - 1) : -1));
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const large = size === 'lg';

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search parts by part number, OEM number, keyword or vehicle
      </label>
      <div
        className={`flex items-center gap-2 rounded-xl border border-slate-300 bg-white shadow-sm focus-within:ring-2 dark:border-slate-600 dark:bg-slate-900 ${
          large ? 'px-4 py-3' : 'px-3 py-2'
        }`}
        style={{ ['--tw-ring-color' as string]: 'var(--brand-primary)' }}
      >
        <Search size={large ? 22 : 18} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          maxLength={200}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Part number, OEM number, or e.g. 2019 Toyota Corolla tail light"
          className={`min-w-0 flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden ${
            large ? 'text-lg' : 'text-sm'
          }`}
        />
        {loading && <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" aria-hidden="true" />}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
        <button
          type="submit"
          className={`shrink-0 rounded-lg font-semibold ${large ? 'px-5 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
          style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-fg)' }}
        >
          Search
        </button>
      </div>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {options.length === 0 && loading && (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Searching…</li>
          )}
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                go(option.to);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${
                index === active ? 'bg-slate-100 dark:bg-slate-800' : ''
              }`}
            >
              {option.kind === 'part' ? (
                option.image ? (
                  <img src={option.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded object-contain bg-slate-50 dark:bg-slate-800" />
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded bg-slate-100 dark:bg-slate-800" aria-hidden="true" />
                )
              ) : (
                <Search size={14} className="mx-2.5 shrink-0 text-slate-400" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800 dark:text-slate-100">{option.label}</div>
                {option.detail && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{option.detail}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
