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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AggregationProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AggregationProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const dashboard_service_js_1 = require("../dashboard.service.js");
const sales_record_entity_js_1 = require("../entities/sales-record.entity.js");
const dashboard_cache_entity_js_1 = require("../entities/dashboard-cache.entity.js");
let AggregationProcessor = AggregationProcessor_1 = class AggregationProcessor extends bullmq_1.WorkerHost {
    dashboardService;
    salesRepo;
    cacheRepo;
    logger = new common_1.Logger(AggregationProcessor_1.name);
    constructor(dashboardService, salesRepo, cacheRepo) {
        super();
        this.dashboardService = dashboardService;
        this.salesRepo = salesRepo;
        this.cacheRepo = cacheRepo;
    }
    async process(job) {
        switch (job.name) {
            case 'recompute-summary':
                this.logger.log('Recomputing dashboard summary...');
                await this.dashboardService.getSummary();
                await this.dashboardService.getKpis();
                this.logger.log('Dashboard summary recomputed.');
                break;
            case 'daily-sales-rollup':
                await this.handleDailySalesRollup();
                break;
            default:
                this.logger.warn(`Unknown job: ${job.name}`);
        }
    }
    async handleDailySalesRollup() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);
        const dateKey = yesterday.toISOString().slice(0, 10);
        this.logger.log(`Running daily sales rollup for ${dateKey}`);
        const rawStats = await this.salesRepo
            .createQueryBuilder('s')
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
            .addSelect('COALESCE(AVG(s.salePrice), 0)', 'avgPrice')
            .where('s.soldAt BETWEEN :start AND :end', {
            start: yesterday,
            end: endOfYesterday,
        })
            .getRawOne();
        const byChannel = await this.salesRepo
            .createQueryBuilder('s')
            .select('s.channel', 'channel')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(s.salePrice), 0)', 'revenue')
            .where('s.soldAt BETWEEN :start AND :end', {
            start: yesterday,
            end: endOfYesterday,
        })
            .groupBy('s.channel')
            .getRawMany();
        const rollup = {
            date: dateKey,
            totalSales: Number(rawStats?.count ?? 0),
            revenue: Number(rawStats?.revenue ?? 0),
            avgPrice: Number(rawStats?.avgPrice ?? 0),
            byChannel,
            computedAt: new Date().toISOString(),
        };
        const cacheKey = `daily-rollup:${dateKey}`;
        const existing = await this.cacheRepo.findOne({
            where: { metricKey: cacheKey },
        });
        if (existing) {
            existing.metricValue = rollup;
            await this.cacheRepo.save(existing);
        }
        else {
            await this.cacheRepo.save(this.cacheRepo.create({ metricKey: cacheKey, metricValue: rollup }));
        }
        this.logger.log(`Daily sales rollup for ${dateKey}: ${rollup.totalSales} sales, $${rollup.revenue.toFixed(2)} revenue`);
    }
};
exports.AggregationProcessor = AggregationProcessor;
exports.AggregationProcessor = AggregationProcessor = AggregationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('dashboard', { concurrency: 1 }),
    __param(1, (0, typeorm_1.InjectRepository)(sales_record_entity_js_1.SalesRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(dashboard_cache_entity_js_1.DashboardCache)),
    __metadata("design:paramtypes", [dashboard_service_js_1.DashboardService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AggregationProcessor);
//# sourceMappingURL=aggregation.processor.js.map