import { ListingsService } from './listings.service.js';
import { ListingsQueryDto } from './dto/listings-query.dto.js';
import { SearchService } from './search.service.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
export declare class ListingsV2Controller {
    private readonly listingsService;
    private readonly searchService;
    constructor(listingsService: ListingsService, searchService: SearchService);
    findAll(query: ListingsQueryDto): Promise<{
        items: any[];
        total: number;
        limit: number;
        offset: number;
    }>;
    search(query: SearchQueryDto): Promise<{
        results: any;
        total: number;
        limit: number;
        offset: number;
        nextCursor: string | null;
        queryTimeMs: number;
        items: import("./search.service.js").SearchItem[];
    }>;
    getSummary(): Promise<{
        totalRecords: number;
        uniqueSkus: number;
        files: number;
    }>;
    getFacets(): Promise<{
        brands: {
            value: string;
            count: number;
        }[];
        categories: {
            value: string;
            id: string;
            count: number;
        }[];
        conditions: {
            value: string;
            count: number;
        }[];
        sourceFiles: {
            value: string;
            count: number;
        }[];
    }>;
    findOne(id: string): Promise<any>;
    getRevisions(id: string, limit?: string, offset?: string): Promise<{
        total: number;
        revisions: import("./listing-revision.entity.js").ListingRevision[];
    }>;
}
