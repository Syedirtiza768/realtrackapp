import { Injectable } from '@nestjs/common';
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

@Injectable()
export class RuntimeHealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  getSnapshot(): RuntimeHealthSnapshot {
    const mem = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100;

    const pool = (this.dataSource.driver as { master?: { totalCount?: number; idleCount?: number; waitingCount?: number } })
      ?.master;

    const flag = (key: string, fallback = false): boolean => {
      const value = this.config.get<string>(key);
      if (value === undefined || value === '') return fallback;
      return value === 'true' || value === '1';
    };

    return {
      generatedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      pid: process.pid,
      memory: {
        heapUsedMb: toMb(mem.heapUsed),
        heapTotalMb: toMb(mem.heapTotal),
        rssMb: toMb(mem.rss),
        externalMb: toMb(mem.external),
      },
      database: pool
        ? {
            poolSize: pool.totalCount ?? null,
            idleConnections: pool.idleCount ?? null,
            waitingClients: pool.waitingCount ?? null,
          }
        : undefined,
      config: {
        schedulerLeaderEnabled: flag('SCHEDULER_LEADER_ENABLED', true),
        redisSocketAdapter: flag('REDIS_SOCKET_ADAPTER', false),
        maxConcurrentPipelineJobs: Number(
          this.config.get<string>('MAX_CONCURRENT_PIPELINE_JOBS', '2'),
        ),
        maxConcurrentCatalogImports: Number(
          this.config.get<string>('MAX_CONCURRENT_CATALOG_IMPORTS', '2'),
        ),
        dbPoolMax: Number(this.config.get<string>('DB_POOL_MAX', '20')),
      },
    };
  }
}
