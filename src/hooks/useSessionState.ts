import { useCallback, useState } from 'react';

/**
 * useState backed by sessionStorage. Persists state across SPA navigation
 * within the same browser session. Clears when the tab closes.
 *
 * Priority on init: URL search params (urlOverrides) > sessionStorage > defaultValue
 *
 * @param key sessionStorage key (namespaced per page, e.g. 'catalog-filters')
 * @param defaultValue default state when nothing is stored or in URL
 * @param urlOverrides optional partial state parsed from URL (e.g. bookmarked
 *        link with query params). When provided and non-empty, these override
 *        sessionStorage on first mount only.
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T,
  urlOverrides?: Partial<T> | null,
): [T, (update: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    // URL overrides take priority (bookmark/share links)
    if (urlOverrides && hasAnyValue(urlOverrides)) {
      const merged = { ...defaultValue, ...urlOverrides } as T;
      try {
        sessionStorage.setItem(key, JSON.stringify(merged));
      } catch {
        /* storage full */
      }
      return merged;
    }

    // Then sessionStorage
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) return { ...defaultValue, ...JSON.parse(stored) } as T;
    } catch {
      /* corrupt storage */
    }

    return defaultValue;
  });

  const setSessionState = useCallback(
    (update: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof update === 'function' ? (update as (p: T) => T)(prev) : update;
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage full */
        }
        return next;
      });
    },
    [key],
  );

  return [state, setSessionState];
}

function hasAnyValue(obj: Record<string, unknown>): boolean {
  for (const v of Object.values(obj)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length > 0) return true;
    } else if (typeof v === 'boolean') {
      if (v) return true;
    } else if (typeof v === 'number') {
      if (!Number.isNaN(v)) return true;
    } else if (typeof v === 'string') {
      if (v !== '' && v !== 'all') return true;
    }
  }
  return false;
}