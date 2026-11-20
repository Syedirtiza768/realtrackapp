import { ConfigService } from '@nestjs/config';
export declare class PartsSearchUpstreamError extends Error {
    readonly status: number | null;
    constructor(message: string, status: number | null);
}
export interface PartsSearchRequestOptions {
    internal?: boolean;
    attempts?: number;
}
export declare class PartsSearchClient {
    private readonly config;
    constructor(config: ConfigService);
    get baseUrl(): string;
    get internalKey(): string | null;
    private get timeoutMs();
    get<T>(path: string, params?: Array<[string, string]>, options?: PartsSearchRequestOptions): Promise<T>;
    private errorMessage;
}
