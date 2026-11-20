export declare const OPTIONS_DROPPABLE: readonly ["number", "make", "model", "year", "side", "position"];
export declare class PartsSearchOptionsDto {
    q?: string;
    vehicleConfigId?: string;
    makeId?: string;
    modelId?: string;
    make?: string;
    model?: string;
    year?: number;
    engineLitres?: number;
    drop?: string[];
    includeUnavailable?: boolean;
    page?: number;
    pageSize?: number;
}
export declare class PartsSearchSelectDto {
    query: string;
    partId: string;
    requestRef?: string;
    action?: string;
}
export declare class PartsSearchRequestDto {
    query: string;
    numbers?: string[];
    vehicle?: Record<string, unknown>;
    partId?: string;
    note?: string;
}
export declare class PartsSearchRequestStatusDto {
    status: 'open' | 'done' | 'dismissed';
}
export declare class PartsSearchDemandQueryDto {
    days?: number;
}
export declare function toOptionsParams(dto: PartsSearchOptionsDto): Array<[string, string]>;
