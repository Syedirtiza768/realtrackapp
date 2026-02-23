export const STORAGE_KEYS = {
    ingestionQueue: 'listingpro.ingestion.queue.v1',
    ingestionListingSeed: 'listingpro.ingestion.seed.v1',
} as const;

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
