import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
export interface RuntimeHealthSnapshot {
    generatedAt: string;
    uptimeSeconds: number;
    nodeVersion: string;
    pid: number;
    memory: {
        heapUsedMb: number;
        heapTotalMb: number;
        rssMb: number;
        externalMb: number;
    };
    database?: {
        poolSize: number | null;
        idleConnections: number | null;
        waitingClients: number | null;
    };
    config: {
        schedulerLeaderEnabled: boolean;
        redisSocketAdapter: boolean;
        maxConcurrentPipelineJobs: number;
        maxConcurrentCatalogImports: number;
        dbPoolMax: number;
    };
}
export declare class RuntimeHealthService {
    private readonly dataSource;
    private readonly config;
    constructor(dataSource: DataSource, config: ConfigService);
    getSnapshot(): RuntimeHealthSnapshot;
}
