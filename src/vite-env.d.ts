/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_INGESTION_PROVIDER?: 'mock' | 'api';
    readonly VITE_INGESTION_API_BASE_URL?: string;
    readonly VITE_INGESTION_HEALTH_PATH?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
