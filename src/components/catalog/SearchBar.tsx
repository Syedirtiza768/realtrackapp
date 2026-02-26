/* ─── SearchBar ────────────────────────────────────────────
 *  Search input with real-time auto-suggestions dropdown.
 *  Features: debounced search-as-you-type, suggestion types
 *  (SKU, brand, category, MPN, title), keyboard navigation.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  Tag,
  Layers,
  Box,
  Hash,
  FileText,
  Clock,
  Loader2,
} from 'lucide-react';
import { useSuggest } from '../../lib/searchApi';
import type { Suggestion } from '../../types/search';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  recentSearches?: string[];
  onClearRecent?: () => void;
}

const TYPE_ICONS: Record<string, typeof Tag> = {
  sku: Hash,
  brand: Tag,
  category: Layers,
  mpn: Box,
  title: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  sku: 'SKU',
  brand: 'Brand',
  category: 'Category',
  mpn: 'Part #',
  title: 'Product',
};

export default function SearchBar({
  value,
  onChange,
  onSearch,
  recentSearches = [],
  onClearRecent,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce for suggestions
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  const { data: suggestData, loading: suggestLoading } = useSuggest(debouncedQ, focused);
  const suggestions = suggestData?.suggestions ?? [];
  const showDropdown = focused && (suggestions.length > 0 || (recentSearches.length > 0 && !value.trim()));

  // Reset highlight when suggestions change
  useEffect(() => setHighlightIdx(-1), [suggestions]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectSuggestion = useCallback(
    (s: Suggestion) => {
      if (s.type === 'brand' || s.type === 'category') {
        // For brand/category, search the exact value
        onChange(s.value);
        onSearch(s.value);
      } else {
        onChange(s.value);
        onSearch(s.value);
      }
      setFocused(false);
      inputRef.current?.blur();
    },
    [onChange, onSearch],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = suggestions.length > 0
      ? suggestions
      : (!value.trim() ? recentSearches.map((r) => ({ type: 'title' as const, value: r, label: r, score: 0 })) : []);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < items.length) {
        const item = items[highlightIdx];
        onChange(item.value);
        onSearch(item.value);
        setFocused(false);
      } else {
        onSearch(value);
        setFocused(false);
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-blue-500/30 text-blue-300 rounded-sm">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 transition-all focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50">
        <Search size={18} className="text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search SKU, title, brand, part number, category…"
          className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-200 placeholder:text-slate-600"
          autoComplete="off"
          spellCheck={false}
        />
        {suggestLoading && value.trim() && (
          <Loader2 size={14} className="animate-spin text-slate-500 shrink-0" />
        )}
        {value && (
          <button
            onClick={() => {
              onChange('');
              onSearch('');
              inputRef.current?.focus();
            }}
            className="text-slate-500 hover:text-slate-300 shrink-0"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden max-h-80 overflow-y-auto"
        >
          {/* Recent searches (when empty) */}
          {!value.trim() && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Recent Searches
                </span>
                {onClearRecent && (
                  <button
                    onClick={onClearRecent}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              {recentSearches.map((r, i) => (
                <button
                  key={r}
                  onClick={() => {
                    onChange(r);
                    onSearch(r);
                    setFocused(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left transition-colors ${
                    highlightIdx === i ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <Clock size={13} className="text-slate-600 shrink-0" />
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              {value.trim() && (
                <div className="px-3 py-1.5 border-b border-slate-800">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Suggestions
                    {suggestData?.queryTimeMs != null && (
                      <span className="ml-1 font-normal normal-case">
                        ({suggestData.queryTimeMs}ms)
                      </span>
                    )}
                  </span>
                </div>
              )}
              {suggestions.map((s, i) => {
                const Icon = TYPE_ICONS[s.type] ?? FileText;
                return (
                  <button
                    key={`${s.type}-${s.value}-${i}`}
                    onClick={() => selectSuggestion(s)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className={`w-full px-3 py-2 flex items-center gap-3 text-sm text-left transition-colors ${
                      highlightIdx === i ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon size={14} className="text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {highlightMatch(s.value, value)}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium uppercase text-slate-600 shrink-0">
                      {TYPE_LABELS[s.type] ?? s.type}
                    </span>
                    {s.count != null && (
                      <span className="text-[10px] text-slate-600 shrink-0 tabular-nums">
                        {s.count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
