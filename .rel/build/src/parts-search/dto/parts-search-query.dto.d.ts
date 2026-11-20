export declare const PARTS_SEARCH_SORTS: readonly ["relevance", "price_asc", "price_desc", "newest", "best_condition"];
export declare const PARTS_SEARCH_PAGE_SIZES: readonly [24, 48, 72];
export declare const PARTS_SEARCH_MAX_QUERY_LENGTH = 200;
export declare const PARTS_SEARCH_MAX_PAGE = 400;
export declare class PartsSearchQueryDto {
    q?: string;
    category?: string[];
    brand?: string[];
    make?: string[];
    model?: string[];
    partType?: string[];
    condition?: string[];
    seller?: string[];
    sourceTag?: string[];
    year?: number;
    priceMin?: number;
    priceMax?: number;
    hasImage?: boolean;
    inStock?: boolean;
    includeInterchange?: boolean;
    sort?: (typeof PARTS_SEARCH_SORTS)[number];
    page?: number;
    pageSize?: number;
}
export declare class PartsSearchSuggestDto {
    q?: string;
}
export declare function toUpstreamParams(dto: PartsSearchQueryDto, audience: 'internal' | 'public'): Array<[string, string]>;
