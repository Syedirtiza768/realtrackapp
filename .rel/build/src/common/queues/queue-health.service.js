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
exports.QueueHealthService = exports.MONITORED_QUEUE_NAMES = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
exports.MONITORED_QUEUE_NAMES = [
    'ingestion',
    'pipeline',
    'catalog-import',
    'openai',
    'channels',
    'inventory',
    'orders',
    'dashboard',
    'storage-cleanup',
    'storage-thumbnails',
    'fitment',
    'motors-pipeline',
    'listing-optimization',
    'ebay-listing-publish',
    'ebay-order-sync',
    'ebay-inventory-sync',
];
let QueueHealthService = class QueueHealthService {
    config;
    queues = [];
    constructor(config) {
        this.config = config;
        const connection = {
            host: this.config.get('REDIS_HOST', 'localhost'),
            port: Number(this.config.get('REDIS_PORT', '6379')),
            password: this.config.get('REDIS_PASSWORD', '') || undefined,
        };
        for (const name of exports.MONITORED_QUEUE_NAMES) {
            this.queues.push(new bullmq_1.Queue(name, { connection }));
        }
    }
    async getSnapshot() {
        const snapshot = {};
        await Promise.all(this.queues.map(async (queue) => {
            const [waiting, active, delayed, failed, completed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getDelayedCount(),
                queue.getFailedCount(),
                queue.getCompletedCount(),
            ]);
            snapshot[queue.name] = { waiting, active, delayed, failed, completed };
        }));
        return snapshot;
    }
    async onModuleDestroy() {
        await Promise.all(this.queues.map((q) => q.close()));
    }
};
exports.QueueHealthService = QueueHealthService;
exports.QueueHealthService = QueueHealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], QueueHealthService);
//# sourceMappingURL=queue-health.service.js.map