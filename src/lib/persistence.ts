export const STORAGE_KEYS = {
    ingestionQueue: 'realtrackapp.ingestion.queue.v1',
    ingestionListingSeed: 'realtrackapp.ingestion.seed.v1',
    listingFormPrefs: 'realtrackapp.listing-form.prefs.v1',
} as const;

export interface ListingFormPrefs {
    partType?: 'OEM' | 'Aftermarket' | 'Salvage';
    conditionId?: '1000' | '3000';
}

export function loadJson<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            return fallback;
        }

        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function saveJson<T>(key: string, value: T): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // intentionally ignored for quota/security errors in prototype mode
    }
}

export function removeKey(key: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(key);
    } catch {
        // intentionally ignored for quota/security errors in prototype mode
    }
}

export function clearIngestionPersistence(): void {
    removeKey(STORAGE_KEYS.ingestionQueue);
    removeKey(STORAGE_KEYS.ingestionListingSeed);
}
