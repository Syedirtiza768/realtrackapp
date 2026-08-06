import { useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';

type Primitive = string | number | boolean | string[] | null | undefined;

/**
 * Two-way sync between component filter/pagination state and URL search params.
 *
 * Priority on init: URL search params > sessionStorage (if key provided) > defaults.
 * On change: writes non-default values to both URL (replace) and sessionStorage.
 *
 * @param defaults initial filter values
 * @param storageKey optional sessionStorage key for cross-navigation persistence.
 *        When provided, state survives SPA navigation even when URLs reset.
 *
 * @example
 * const [state, setState] = useUrlFilters({
 *   page: 0,
 *   search: '',
 *   brands: [] as string[],
 * }, 'catalog-filters');
 */
export function useUrlFilters<T extends Record<string, Primitive>>(
  defaults: T,
  storageKey?: string,
): [T, (update: Partial<T> | ((prev: T) => Partial<T>)) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultsRef = useRef(defaults);
  const storageKeyRef = useRef(storageKey);

  // Hydrate initial state: URL > sessionStorage > defaults (runs once)
  const initialState = useRef<T | null>(null);
  if (initialState.current === null) {
    const state = { ...defaults };
    let fromUrl = false;

    // 1. Read from URL
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const param = searchParams.get(key as string);
      if (param !== null) {
        const def = defaults[key];
        if (Array.isArray(def)) {
          (state as Record<string, unknown>)[key as string] = param
            ? param.split(',').filter(Boolean)
            : [];
        } else if (typeof def === 'number') {
          const n = Number(param);
          if (!Number.isNaN(n)) (state as Record<string, unknown>)[key as string] = n;
        } else if (typeof def === 'boolean') {
          (state as Record<string, unknown>)[key as string] = param === '1' || param === 'true';
        } else {
          (state as Record<string, unknown>)[key as string] = param;
        }
        fromUrl = true;
      }
    }

    // 2. If URL had no relevant params, try sessionStorage
    if (!fromUrl && storageKey) {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<T>;
          for (const key of Object.keys(defaults) as (keyof T)[]) {
            if (parsed[key] !== undefined) {
              (state as Record<string, unknown>)[key as string] = parsed[key];
            }
          }
        }
      } catch {
        /* corrupt storage, ignore */
      }
    }

    // 3. If URL had params, also write them to sessionStorage for future nav
    if (fromUrl && storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* storage full */
      }
    }

    initialState.current = state;
  }

  const [state, setState] = useState<T>(initialState.current);
  const pendingPatch = useRef<Partial<T> | null>(null);

  // Sync changed fields to URL after state updates
  useEffect(() => {
    if (!pendingPatch.current) return;
    const patch = pendingPatch.current;
    pendingPatch.current = null;

    setSearchParams(
      (prevParams) => {
        const nextParams = new URLSearchParams(prevParams);
        const defs = defaultsRef.current;

        for (const [key, value] of Object.entries(patch) as [string, Primitive][]) {
          const def = defs[key as keyof T];
          const isDefault = isEqual(value, def);

          if (isDefault) {
            nextParams.delete(key);
          } else if (Array.isArray(value)) {
            if (value.length === 0) nextParams.delete(key);
            else nextParams.set(key, value.filter(Boolean).join(','));
          } else if (typeof value === 'boolean') {
            nextParams.set(key, value ? '1' : '');
          } else if (value != null && value !== '') {
            nextParams.set(key, String(value));
          } else {
            nextParams.delete(key);
          }
        }

        return nextParams;
      },
      { replace: true },
    );
  });

  const setUrlState = useCallback(
    (update: Partial<T> | ((prev: T) => Partial<T>)) => {
      setState((prev) => {
        const patch = typeof update === 'function' ? update(prev) : update;
        const next = { ...prev, ...patch } as T;
        // Accumulate patches so the effect picks up all changes in a single batch
        pendingPatch.current = pendingPatch.current
          ? { ...pendingPatch.current, ...patch }
          : patch;
        // Write to sessionStorage immediately (not deferred to effect)
        if (storageKeyRef.current) {
          try {
            sessionStorage.setItem(storageKeyRef.current, JSON.stringify(next));
          } catch {
            /* storage full */
          }
        }
        return next;
      });
    },
    [],
  );

  return [state, setUrlState];
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return false;
}