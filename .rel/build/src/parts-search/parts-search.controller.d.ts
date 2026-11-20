import type { Response } from 'express';
import { User } from '../auth/entities/user.entity.js';
import { PartsSearchQueryDto, PartsSearchSuggestDto } from './dto/parts-search-query.dto.js';
import { PartsSearchDemandQueryDto, PartsSearchOptionsDto, PartsSearchRequestDto, PartsSearchRequestStatusDto, PartsSearchSelectDto } from './dto/parts-search-options.dto.js';
import { PartsSearchImagesService } from './parts-search-images.service.js';
import { PartsSearchOptionsService } from './parts-search-options.service.js';
import { PartsSearchService } from './parts-search.service.js';
export declare class PartsSearchController {
    private readonly partsSearch;
    private readonly options;
    private readonly images;
    constructor(partsSearch: PartsSearchService, options: PartsSearchOptionsService, images: PartsSearchImagesService);
    status(): Promise<import("./parts-search.types.js").PartsSearchStatus>;
    query(dto: PartsSearchQueryDto, user?: User): Promise<import("./parts-search.types.js").PartsSearchResponse>;
    suggest(dto: PartsSearchSuggestDto): Promise<import("./parts-search.types.js").PartsSearchSuggestResponse>;
    part(id: string): Promise<Record<string, unknown>>;
    searchOptions(dto: PartsSearchOptionsDto, user?: User): Promise<import("./parts-search-options.service.js").OptionsResponse>;
    select(dto: PartsSearchSelectDto, user?: User): Promise<{
        ok: true;
    }>;
    createRequest(dto: PartsSearchRequestDto, user?: User): Promise<import("./entities/parts-search-event.entity.js").PartsSearchEvent>;
    updateRequest(id: string, dto: PartsSearchRequestStatusDto, user?: User): Promise<import("./entities/parts-search-event.entity.js").PartsSearchEvent>;
    demand(dto: PartsSearchDemandQueryDto): Promise<{
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
        requests: import("./entities/parts-search-event.entity.js").PartsSearchEvent[];
    }>;
    makes(): Promise<unknown>;
    models(makeId: string): Promise<unknown>;
    generations(modelId: string): Promise<unknown>;
    configurations(generationId: string): Promise<unknown>;
    vin(vin: string): Promise<any>;
    partImages(id: string): Promise<{
        partId: string;
        label: string;
        images: import("./parts-search-images.service.js").PartImage[];
    }>;
    partImagesZip(id: string, res: Response): Promise<void>;
    partImageDownload(id: string, index: number, res: Response): Promise<void>;
    omniImageDownload(itemId: string, user: User, res: Response): Promise<void>;
}
