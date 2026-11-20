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
var OrderImportProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderImportProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const orders_service_js_1 = require("../orders.service.js");
const order_entity_js_1 = require("../entities/order.entity.js");
const order_import_ebay_service_js_1 = require("../order-import-ebay.service.js");
let OrderImportProcessor = OrderImportProcessor_1 = class OrderImportProcessor extends bullmq_1.WorkerHost {
    ordersService;
    ebayImport;
    orderRepo;
    logger = new common_1.Logger(OrderImportProcessor_1.name);
    constructor(ordersService, ebayImport, orderRepo) {
        super();
        this.ordersService = ordersService;
        this.ebayImport = ebayImport;
        this.orderRepo = orderRepo;
    }
    async process(job) {
        switch (job.name) {
            case 'import-from-channels':
                await this.importFromAllChannels();
                break;
            case 'auto-complete':
                await this.autoComplete();
                break;
            default:
                this.logger.warn(`Unknown job type: ${job.name}`);
        }
    }
    async importFromAllChannels() {
        try {
            const results = await this.ebayImport.importFromAllStores();
            const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
            const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
            this.logger.log(`Order import complete: ${totalImported} new orders from ${results.length} stores, ${totalErrors} errors`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Order import failed: ${msg}`);
        }
    }
    async autoComplete() {
        const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const delivered = await this.orderRepo.find({
            where: { status: 'delivered' },
        });
        let completed = 0;
        for (const order of delivered) {
            if (order.deliveredAt && order.deliveredAt < cutoff) {
                try {
                    await this.ordersService.transitionStatus(order.id, 'completed', 'Auto-completed: 14 days since delivery');
                    completed++;
                }
                catch {
                }
            }
        }
        if (completed > 0) {
            this.logger.log(`Auto-completed ${completed} orders delivered > 14 days ago`);
        }
    }
};
exports.OrderImportProcessor = OrderImportProcessor;
exports.OrderImportProcessor = OrderImportProcessor = OrderImportProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('orders', { concurrency: 1 }),
    __param(2, (0, typeorm_1.InjectRepository)(order_entity_js_1.Order)),
    __metadata("design:paramtypes", [orders_service_js_1.OrdersService,
        order_import_ebay_service_js_1.EbayOrderImportService,
        typeorm_2.Repository])
], OrderImportProcessor);
//# sourceMappingURL=order-import.processor.js.map