"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeHealthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
let RuntimeHealthService = class RuntimeHealthService {
    dataSource;
    config;
    constructor(dataSource, config) {
        this.dataSource = dataSource;
        this.config = config;
    }
    getSnapshot() {
        const mem = process.memoryUsage();
        const toMb = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;
        const pool = this.dataSource.driver?.master;
        const flag = (key, fallback = false) => {
            const value = this.config.get(key);
            if (value === undefined || value === '')
                return fallback;
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
                maxConcurrentPipelineJobs: Number(this.config.get('MAX_CONCURRENT_PIPELINE_JOBS', '2')),
                maxConcurrentCatalogImports: Number(this.config.get('MAX_CONCURRENT_CATALOG_IMPORTS', '2')),
                dbPoolMax: Number(this.config.get('DB_POOL_MAX', '20')),
            },
        };
    }
};
exports.RuntimeHealthService = RuntimeHealthService;
exports.RuntimeHealthService = RuntimeHealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        config_1.ConfigService])
], RuntimeHealthService);
//# sourceMappingURL=runtime-health.service.js.map