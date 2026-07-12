/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_INGESTION_PROVIDER?: 'mock' | 'api';
    readonly VITE_INGESTION_API_BASE_URL?: string;
    readonly VITE_INGESTION_HEALTH_PATH?: string;
    /** @deprecated Use RBAC `listings.delete` / `catalog.clear` instead of this env flag. */
    readonly VITE_SHOW_CATALOG_DESTRUCTIVE_UI?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
