import { CrossStoreSaleSyncService, type CrossStoreSyncResult } from './cross-store-sale-sync.service.js';
export declare class RunCrossStoreSaleSyncDto {
    orderIds?: string[];
    since?: string;
    dryRun?: boolean;
}
export declare class ListCrossStoreSaleSyncQuery {
    limit?: number;
    status?: string;
}
export declare class CrossStoreSaleSyncController {
    private readonly sync;
    constructor(sync: CrossStoreSaleSyncService);
    list(q: ListCrossStoreSaleSyncQuery): Promise<unknown[]>;
    run(dto: RunCrossStoreSaleSyncDto): Promise<{
        dryRun: boolean;
        orders: number;
        results: CrossStoreSyncResult[];
        queued?: undefined;
    } | {
        dryRun: boolean;
        queued: number;
        orders?: undefined;
        results?: undefined;
    }>;
}
