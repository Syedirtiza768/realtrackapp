import type { Response } from 'express';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { BulkProfilesDto } from './dto/bulk-profiles.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';
import { User } from '../auth/entities/user.entity.js';
export declare class ListingsController {
    private readonly listingsService;
    private readonly searchService;
    constructor(listingsService: ListingsService, searchService: SearchService);
    search(query: SearchQueryDto, user: User): Promise<import("./search.service").SearchResult>;
    suggest(q: string, limit?: string, user?: User): Promise<import("./search.service").SuggestionResult>;
    dynamicFacets(query: SearchQueryDto, user: User): Promise<import("./search.service").DynamicFacets>;
    create(dto: CreateListingDto, user: User): Promise<{
        listing: import("./listing-record.entity").ListingRecord;
        revision: import("./listing-revision.entity").ListingRevision;
        updated: boolean;
    } | {
        listing: import("./listing-record.entity").ListingRecord;
        revision: import("./listing-revision.entity").ListingRevision;
        updated?: undefined;
    }>;
    update(id: string, dto: UpdateListingDto, user: User): Promise<{
        listing: import("./listing-record.entity").ListingRecord;
        revision: import("./listing-revision.entity").ListingRevision;
    }>;
    patchStatus(id: string, dto: PatchStatusDto, user: User): Promise<{
        listing: import("./listing-record.entity").ListingRecord;
        revision: import("./listing-revision.entity").ListingRevision;
    }>;
    softDelete(id: string, user: User): Promise<{
        success: boolean;
    }>;
    restore(id: string, user: User): Promise<{
        listing: import("./listing-record.entity").ListingRecord;
    }>;
    bulkUpdate(dto: BulkUpdateDto, user: User): Promise<{
        updated: number;
        failed: {
            id: string;
            error: string;
            conflict?: boolean;
        }[];
    }>;
    bulkApplyProfiles(dto: BulkProfilesDto, user: User): Promise<{
        updated: number;
    }>;
    bulkDelete(body: {
        ids: string[];
    }, user: User): Promise<{
        deleted: number;
    }>;
    exportCsv(query: SearchQueryDto, res: Response, user: User): Promise<void>;
    getRevisions(id: string, limit?: string, offset?: string, user?: User): Promise<{
        total: number;
        revisions: import("./listing-revision.entity").ListingRevision[];
    }>;
    findAll(query: ListingsQueryDto, user: User): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: import("./listing-record.entity").ListingRecord[];
    }>;
    getSummary(user: User, vertical?: string): Promise<{
        totalRecords: number;
        uniqueSkus: number;
        files: number;
    }>;
    getFacets(user: User): Promise<{
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
    findOne(id: string, user: User): Promise<{
        listing: import("./listing-record.entity").ListingRecord;
        catalogProduct: import("../catalog-import/entities/catalog-product.entity").CatalogProduct | null;
    }>;
    importListings(): Promise<{
        scannedFiles: number;
        importedRows: number;
        skippedRows: number;
        uniqueSkus: number;
        filesWithHeader: number;
    }>;
}
