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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const dashboard_service_js_1 = require("./dashboard.service.js");
const dashboard_dto_js_1 = require("./dto/dashboard.dto.js");
let DashboardController = class DashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    getSummary(storeId) {
        return this.dashboardService.getSummary(storeId);
    }
    getSales(dto) {
        return this.dashboardService.getSales(dto);
    }
    getActivity(dto) {
        return this.dashboardService.getActivity(dto);
    }
    getChannelHealth() {
        return this.dashboardService.getChannelHealth();
    }
    getKpis() {
        return this.dashboardService.getKpis();
    }
    getInventoryAlerts() {
        return this.dashboardService.getInventoryAlerts();
    }
    getMultiStoreMetrics() {
        return this.dashboardService.getMultiStoreMetrics();
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Get dashboard summary (cached)' }),
    __param(0, (0, common_1.Query)('storeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('sales'),
    (0, swagger_1.ApiOperation)({ summary: 'Get sales data (by day, by channel, top items)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dashboard_dto_js_1.SalesQueryDto]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getSales", null);
__decorate([
    (0, common_1.Get)('activity'),
    (0, swagger_1.ApiOperation)({ summary: 'Get recent activity from audit logs' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dashboard_dto_js_1.AuditLogQueryDto]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getActivity", null);
__decorate([
    (0, common_1.Get)('channel-health'),
    (0, swagger_1.ApiOperation)({ summary: 'Get channel sync health status' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getChannelHealth", null);
__decorate([
    (0, common_1.Get)('kpis'),
    (0, swagger_1.ApiOperation)({ summary: 'Get key performance indicators' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getKpis", null);
__decorate([
    (0, common_1.Get)('inventory-alerts'),
    (0, swagger_1.ApiOperation)({ summary: 'Get low stock and out of stock alerts' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getInventoryAlerts", null);
__decorate([
    (0, common_1.Get)('multi-store'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get multi-store, AI enhancement, and demo simulation metrics',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getMultiStoreMetrics", null);
exports.DashboardController = DashboardController = __decorate([
    (0, swagger_1.ApiTags)('Dashboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('dashboard'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('dashboard.view'),
    __metadata("design:paramtypes", [dashboard_service_js_1.DashboardService])
], DashboardController);
let AuditLogController = class AuditLogController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    getAuditLogs(dto) {
        return this.dashboardService.getActivity(dto);
    }
};
exports.AuditLogController = AuditLogController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Query audit logs' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dashboard_dto_js_1.AuditLogQueryDto]),
    __metadata("design:returntype", void 0)
], AuditLogController.prototype, "getAuditLogs", null);
exports.AuditLogController = AuditLogController = __decorate([
    (0, swagger_1.ApiTags)('Audit Logs'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('audit-logs'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('audit.view'),
    __metadata("design:paramtypes", [dashboard_service_js_1.DashboardService])
], AuditLogController);
//# sourceMappingURL=dashboard.controller.js.map