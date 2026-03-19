import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';

/* ── Types ── */

export interface SelectOption {
  label: string;
  value: string;
}

export interface SearchableSelectProps {
  /** Async function to load options. Receives query text and page number (0-based). */
  fetchOptions: (
    query: string,
    page: number,
  ) => Promise<{ options: SelectOption[]; hasMore: boolean }>;
  /** Currently selected value */
  value: SelectOption | null;
  /** Selection change handler */
  onChange: (selected: SelectOption | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in ms (default 300) */
  debounceMs?: number;
  /** Page size for pagination (default 50) */
  pageSize?: number;
  /** Parent value that triggers a refetch when it changes */
  dependsOn?: string;
  /** Disable the select */
  disabled?: boolean;
  /** Label shown above the select */
  label?: string;
  /** Error message */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SearchableSelect — Async, paginated, debounced select component.
 *
 * Used throughout the app for fitment cascading dropdowns,
 * category selection, and any other large-dataset selects.
 *
 * Features:
 * - Debounced search-as-you-type
 * - Infinite scroll pagination
 * - Cascade support via `dependsOn` prop (resets on parent change)
 * - Keyboard navigation (Arrow Up/Down, Enter, Escape)
 * - Click-outside-to-close
 */
export default function SearchableSelect({
  fetchOptions,
  value,
  onChange,
  placeholder = 'Select...',
  debounceMs = 300,
  // pageSize is intentionally part of the public API for documentation,
  // but actual page size is controlled by the fetchOptions callback.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pageSize: _pageSize = 50,
  dependsOn,
  disabled = false,
  label,
  error,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Reset on parent value change ──
  useEffect(() => {
    setOptions([]);
    setPage(0);
    setQuery('');
    setHighlightedIndex(-1);
    onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependsOn]);

  // ── Fetch options (debounced) ──
  const loadOptions = useCallback(
    async (searchQuery: string, pageNum: number, append = false) => {
      setLoading(true);
      try {
        const result = await fetchOptions(searchQuery, pageNum);
        setOptions((prev) =>
          append ? [...prev, ...result.options] : result.options,
        );
        setHasMore(result.hasMore);
      } catch {
        setOptions([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [fetchOptions],
  );

  // ── Debounced search ──
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      setPage(0);
      setHighlightedIndex(-1);
      loadOptions(query, 0);
    }, debounceMs);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, isOpen, debounceMs, loadOptions]);

  // ── Load more on scroll ──
  const handleScroll = useCallback(() => {
    if (!listRef.current || loading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadOptions(query, nextPage, true);
    }
  }, [loading, hasMore, page, query, loadOptions]);

  // ── Click outside to close ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            handleSelect(options[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, options, highlightedIndex],
  );

  // ── Scroll highlighted option into view ──
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlighted = listRef.current.children[highlightedIndex] as HTMLElement;
      highlighted?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // ── Select handler ──
  const handleSelect = useCallback(
    (option: SelectOption) => {
      onChange(option);
      setQuery('');
      setIsOpen(false);
    },
    [onChange],
  );

  // ── Clear handler ──
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setQuery('');
    },
    [onChange],
  );

  // ── Memoized display value ──
  const displayValue = useMemo(
    () => (value ? value.label : ''),
    [value],
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      {/* ── Trigger ── */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors
          ${disabled
            ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
            : error
              ? 'bg-slate-900 border-red-500/50 text-slate-200 hover:border-red-400'
              : isOpen
                ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500/20 text-slate-200'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
          }
        `}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
      >
        {isOpen ? (
          <>
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-slate-200 placeholder:text-slate-600 min-w-0"
              placeholder={placeholder}
              autoComplete="off"
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : (
          <span className={`flex-1 truncate ${!value ? 'text-slate-500' : ''}`}>
            {displayValue || placeholder}
          </span>
        )}

        {loading && <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />}
        {value && !disabled && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-slate-500 hover:text-slate-300 shrink-0"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown
          size={14}
          className={`text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}

      {/* ── Dropdown ── */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          <div
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto"
            onScroll={handleScroll}
          >
            {options.length === 0 && !loading && (
              <div className="px-3 py-6 text-center text-slate-500 text-sm">
                {query ? 'No results found' : 'Type to search...'}
              </div>
            )}

            {options.map((option, idx) => (
              <div
                key={`${option.value}-${idx}`}
                role="option"
                aria-selected={value?.value === option.value}
                className={`
                  px-3 py-2 text-sm cursor-pointer transition-colors
                  ${idx === highlightedIndex
                    ? 'bg-blue-600/20 text-blue-300'
                    : value?.value === option.value
                      ? 'bg-slate-800 text-blue-400'
                      : 'text-slate-300 hover:bg-slate-800'
                  }
                `}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                {option.label}
              </div>
            ))}

            {loading && (
              <div className="px-3 py-3 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin" />
                Loading...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
