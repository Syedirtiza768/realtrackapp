import { DataSource } from 'typeorm';
import { StockAccessService, StockScope } from './stock-access.service.js';
export declare class StockReportsService {
    private readonly db;
    private readonly access;
    constructor(db: DataSource, access: StockAccessService);
    summary(scope: StockScope, canSeeCost: boolean): Promise<{
        [x: string]: unknown;
    }>;
    valuation(scope: StockScope): Promise<any>;
    aging(scope: StockScope): Promise<{
        buckets: any;
        oldest: any;
    }>;
}
