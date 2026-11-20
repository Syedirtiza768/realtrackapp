import { Repository } from 'typeorm';
import { SearchQueryDto } from './dto/search-query.dto';
import { ListingRecord } from './listing-record.entity';
import { StoreAccessService } from '../channels/store-access.service.js';
import { User } from '../auth/entities/user.entity.js';
import { TeamsService } from '../teams/teams.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { AutomotiveAccessScopeService } from '../auth/automotive-access-scope.service.js';
export interface SearchResult {
    total: number;
    limit: number;
    offset: number;
    nextCursor: string | null;
    queryTimeMs: number;
    items: SearchItem[];
}
export interface SearchItem {
    id: string;
    customLabelSku: string | null;
    title: string | null;
    cBrand: string | null;
    cType: string | null;
    categoryId: string | null;
    categoryName: string | null;
    startPrice: string | null;
    quantity: string | null;
    conditionId: string | null;
    itemPhotoUrl: string | null;
    cManufacturerPartNumber: string | null;
    cOeOemPartNumber: string | null;
    location: string | null;
    format: string | null;
    sourceFileName: string | null;
    importedAt: string;
    description: string | null;
    cFeatures: string | null;
    pEpid: string | null;
    pUpc: string | null;
    marketplace: string | null;
    marketplaces: string[] | null;
    pipelineJobId: string | null;
    teamId: string | null;
    teamName: string | null;
    teamColor: string | null;
    catalogStatus: CatalogListingStatus;
    publishBlocked: boolean;
    shippingProfileName: string | null;
    relevanceScore: number | null;
    titleHighlight: string | null;
}
export type CatalogListingStatus = 'published' | 'ready_to_publish' | 'need_images' | 'needs_review';
export interface SuggestionResult {
    suggestions: Suggestion[];
    queryTimeMs: number;
}
export interface Suggestion {
    type: 'sku' | 'title' | 'brand' | 'category' | 'mpn';
    value: string;
    label: string;
    count?: number;
    score: number;
}
export interface DynamicFacets {
    brands: FacetBucket[];
    categories: CategoryFacetBucket[];
    conditions: FacetBucket[];
    types: FacetBucket[];
    sourceFiles: FacetBucket[];
    formats: FacetBucket[];
    locations: FacetBucket[];
    mpns: FacetBucket[];
    makes: FacetBucket[];
    models: FacetBucket[];
    pipelineJobs: FacetBucket[];
    marketplaces: FacetBucket[];
    teams: TeamFacetBucket[];
    shippingProfiles: FacetBucket[];
    priceRange: {
        min: number | null;
        max: number | null;
    };
    totalFiltered: number;
    queryTimeMs: number;
}
export interface TeamFacetBucket extends FacetBucket {
    label: string;
    color?: string;
}
export interface FacetBucket {
    value: string;
    count: number;
}
export interface CategoryFacetBucket extends FacetBucket {
    id: string;
}
export declare class SearchService {
    private readonly repo;
    private readonly storeAccess;
    private readonly teamsService;
    private readonly rbac;
    private readonly automotiveScope;
    private readonly logger;
    private readonly facetCache;
    private readonly searchCache;
    constructor(repo: Repository<ListingRecord>, storeAccess: StoreAccessService, teamsService: TeamsService, rbac: RbacService, automotiveScope: AutomotiveAccessScopeService);
    search(dto: SearchQueryDto, user?: User): Promise<SearchResult>;
    suggest(q: string, limitNum?: number, user?: User): Promise<SuggestionResult>;
    dynamicFacets(dto: SearchQueryDto, user?: User): Promise<DynamicFacets>;
    private buildStoreFilterSql;
    private applyMultiFilters;
    private applyExtendedFilters;
    private buildDedupOrderSql;
    private resolveTeamScopeIds;
    private applyTeamScope;
}
