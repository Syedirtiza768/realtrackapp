export declare const PIPELINE_IMAGE_URL_LIMIT = 24;
export declare function isHttpImageUrl(value: unknown): value is string;
export declare function parseImageUrlPipe(value: string | null | undefined): string[];
export declare function hasHttpImageUrls(value: unknown): boolean;
export declare function mergeImageUrls(existing: readonly unknown[] | null | undefined, additions: readonly unknown[], limit?: number): string[];
