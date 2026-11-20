import type Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import type { User } from '../auth/entities/user.entity.js';
import { PartsSearchOptionsDto, PartsSearchRequestDto, PartsSearchSelectDto } from './dto/parts-search-options.dto.js';
import { PartsSearchEvent } from './entities/parts-search-event.entity.js';
import { PartsSearchClient } from './parts-search.client.js';
export interface OmniStockRow {
    inventoryItemId: string;
    sku: string;
    title: string | null;
    imageUrl: string | null;
    sourcingMode: string;
    mpn: string | null;
    oemPartNumber: string | null;
    brand: string | null;
    numbers: string[];
    warehouses: Array<{
        name: string;
        available: number;
    }>;
    available: number;
}
export interface OmniStockSummary {
    available: number;
    canSource: boolean;
    items: OmniStockRow[];
}
type OptionItem = {
    partId: string;
    numbers: string[];
    availability: {
        status: string;
    };
    fitment: {
        verdict: string | null;
    };
    omniStock?: OmniStockSummary;
    [key: string]: unknown;
};
type OptionGroup = {
    key: string;
    label: string;
    total: number;
    hiddenUnavailable: number;
    collapsedByDefault: boolean;
    items: OptionItem[];
};
export type OptionsResponse = {
    requestId: string;
    mode: string;
    query: {
        original: string;
        numbers: string[];
        [key: string]: unknown;
    };
    vehicle: {
        label: string;
        make: string;
        model: string;
        year: number;
        engineLitres?: number;
    } | null;
    summary: Record<string, number | string> & {
        totalOptions: number;
        inStock: number;
        inStockFits: number;
        sentence: string;
    };
    groups: OptionGroup[];
    omniStock?: {
        inStockItems: number;
        items: number;
    };
    meta: Record<string, unknown>;
    [key: string]: unknown;
};
export declare class PartsSearchOptionsService {
    private readonly client;
    private readonly dataSource;
    private readonly userOrgs;
    private readonly events;
    private readonly redis;
    private readonly logger;
    constructor(client: PartsSearchClient, dataSource: DataSource, userOrgs: UserOrganizationService, events: Repository<PartsSearchEvent>, redis: Redis);
    options(dto: PartsSearchOptionsDto, user?: User): Promise<OptionsResponse>;
    private omniStock;
    private mergeOmniStock;
    private applyVisibility;
    private logQuery;
    select(dto: PartsSearchSelectDto, user?: User): Promise<{
        ok: true;
    }>;
    request(dto: PartsSearchRequestDto, user?: User): Promise<PartsSearchEvent>;
    updateRequest(id: string, status: 'open' | 'done' | 'dismissed', user?: User): Promise<PartsSearchEvent>;
    demand(days?: number): Promise<{
        days: number;
        since: string;
        totals: {
            searches: any;
            unmet: any;
            requests: any;
            openRequests: any;
        };
        topNumbers: any;
        topQueries: any;
        topVehicles: any;
        requests: PartsSearchEvent[];
    }>;
    vehicles(path: string): Promise<unknown>;
    decodeVin(vinRaw: string): Promise<any>;
}
export {};
