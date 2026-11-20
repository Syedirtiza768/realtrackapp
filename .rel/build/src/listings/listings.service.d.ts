import { DataSource, Repository } from 'typeorm';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { BulkProfilesDto } from './dto/bulk-profiles.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingRecord } from './listing-record.entity';
import { ListingRevision } from './listing-revision.entity';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { User } from '../auth/entities/user.entity.js';
import { TeamsService } from '../teams/teams.service.js';
import { AutomotiveAccessScopeService } from '../auth/automotive-access-scope.service.js';
type ImportSummary = {
    scannedFiles: number;
    importedRows: number;
    skippedRows: number;
    uniqueSkus: number;
    filesWithHeader: number;
};
export declare class ListingsService {
    private readonly listingRepo;
    private readonly revisionRepo;
    private readonly catalogProductRepo;
    private readonly actionLogRepo;
    private readonly dataSource;
    private readonly rbac;
    private readonly storeAccess;
    private readonly teamsService;
    private readonly automotiveScope;
    private readonly logger;
    constructor(listingRepo: Repository<ListingRecord>, revisionRepo: Repository<ListingRevision>, catalogProductRepo: Repository<CatalogProduct>, actionLogRepo: Repository<ListingActionLog>, dataSource: DataSource, rbac: RbacService, storeAccess: StoreAccessService, teamsService: TeamsService, automotiveScope: AutomotiveAccessScopeService);
    findAll(query: ListingsQueryDto, user?: User): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: ListingRecord[];
    }>;
    findOne(id: string, user?: User): Promise<{
        listing: ListingRecord;
        catalogProduct: CatalogProduct | null;
    }>;
    create(dto: CreateListingDto, user: User): Promise<{
        listing: ListingRecord;
        revision: ListingRevision;
        updated: boolean;
    } | {
        listing: ListingRecord;
        revision: ListingRevision;
        updated?: undefined;
    }>;
    createForOrganization(dto: CreateListingDto, organizationId?: string | null, changedBy?: string | null): Promise<{
        listing: ListingRecord;
        revision: ListingRevision;
        updated: boolean;
    } | {
        listing: ListingRecord;
        revision: ListingRevision;
        updated?: undefined;
    }>;
    private createScoped;
    private isSkuUniqueViolation;
    private createInTransaction;
    update(id: string, dto: UpdateListingDto, user?: User): Promise<{
        listing: ListingRecord;
        revision: ListingRevision;
    }>;
    patchStatus(id: string, dto: PatchStatusDto, user?: User): Promise<{
        listing: ListingRecord;
        revision: ListingRevision;
    }>;
    softDelete(id: string, user: User): Promise<{
        success: boolean;
    }>;
    restore(id: string, user: User): Promise<{
        listing: ListingRecord;
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
    bulkSoftDelete(ids: string[], user: User): Promise<{
        deleted: number;
    }>;
    exportCsv(query: SearchQueryDto, user?: User): Promise<string>;
    getRevisions(listingId: string, limit: number, offset: number, user?: User): Promise<{
        total: number;
        revisions: ListingRevision[];
    }>;
    getSummary(user?: User, vertical?: string): Promise<{
        totalRecords: number;
        uniqueSkus: number;
        files: number;
    }>;
    getFacets(user?: User): Promise<{
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
    importFromFolder(folderPath: string): Promise<ImportSummary>;
    private buildStoreFilter;
    private findAccessibleListing;
    private findAccessibleListings;
    private upsertBatch;
    private findHeaderRow;
    private buildColumnMap;
    private normalize;
    private cleanValue;
    private parseMoney;
    private parseQty;
    private applyDerivedNumericFields;
    private assertSkuRenameAllowed;
    private syncSkuRenameToCatalogAndSiblings;
    private syncSharedPriceQuantityToCatalogAndSiblings;
    private computeDiff;
}
export {};
