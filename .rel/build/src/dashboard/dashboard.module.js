"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const audit_log_entity_js_1 = require("./entities/audit-log.entity.js");
const dashboard_cache_entity_js_1 = require("./entities/dashboard-cache.entity.js");
const sales_record_entity_js_1 = require("./entities/sales-record.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const dashboard_service_js_1 = require("./dashboard.service.js");
const dashboard_controller_js_1 = require("./dashboard.controller.js");
const aggregation_processor_js_1 = require("./processors/aggregation.processor.js");
let DashboardModule = class DashboardModule {
};
exports.DashboardModule = DashboardModule;
exports.DashboardModule = DashboardModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                audit_log_entity_js_1.AuditLog,
                dashboard_cache_entity_js_1.DashboardCache,
                sales_record_entity_js_1.SalesRecord,
                listing_record_entity_js_1.ListingRecord,
            ]),
            bullmq_1.BullModule.registerQueue({ name: 'dashboard' }),
        ],
        controllers: [dashboard_controller_js_1.DashboardController, dashboard_controller_js_1.AuditLogController],
        providers: [dashboard_service_js_1.DashboardService, aggregation_processor_js_1.AggregationProcessor],
        exports: [dashboard_service_js_1.DashboardService],
    })
], DashboardModule);
//# sourceMappingURL=dashboard.module.js.map