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
exports.CrossStoreSaleSyncController = exports.ListCrossStoreSaleSyncQuery = exports.RunCrossStoreSaleSyncDto = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const cross_store_sale_sync_service_js_1 = require("./cross-store-sale-sync.service.js");
class RunCrossStoreSaleSyncDto {
    orderIds;
    since;
    dryRun;
}
exports.RunCrossStoreSaleSyncDto = RunCrossStoreSaleSyncDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], RunCrossStoreSaleSyncDto.prototype, "orderIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RunCrossStoreSaleSyncDto.prototype, "since", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], RunCrossStoreSaleSyncDto.prototype, "dryRun", void 0);
class ListCrossStoreSaleSyncQuery {
    limit;
    status;
}
exports.ListCrossStoreSaleSyncQuery = ListCrossStoreSaleSyncQuery;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], ListCrossStoreSaleSyncQuery.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCrossStoreSaleSyncQuery.prototype, "status", void 0);
let CrossStoreSaleSyncController = class CrossStoreSaleSyncController {
    sync;
    constructor(sync) {
        this.sync = sync;
    }
    list(q) {
        return this.sync.listRecent(q.limit ?? 200, q.status);
    }
    async run(dto) {
        const orderIds = dto.orderIds?.length
            ? dto.orderIds
            : dto.since
                ? await this.sync.ordersSince(new Date(dto.since))
                : null;
        if (!orderIds)
            throw new common_1.BadRequestException('Send orderIds or since');
        if (dto.dryRun) {
            if (orderIds.length > 100)
                throw new common_1.BadRequestException('A dry run covers at most 100 orders');
            const results = [];
            for (const id of orderIds)
                results.push(...(await this.sync.syncOrder(id, { dryRun: true })));
            return { dryRun: true, orders: orderIds.length, results };
        }
        if (!(await this.sync.enabled())) {
            throw new common_1.BadRequestException('Feature flag ebay_cross_store_sale_sync is off');
        }
        for (const id of orderIds)
            await this.sync.enqueue(id, 0);
        return { dryRun: false, queued: orderIds.length };
    }
};
exports.CrossStoreSaleSyncController = CrossStoreSaleSyncController;
__decorate([
    (0, common_1.Get)('sales'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Recent cross-store sale sync actions (newest first)',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListCrossStoreSaleSyncQuery]),
    __metadata("design:returntype", void 0)
], CrossStoreSaleSyncController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('sales/run'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('orders.import'),
    (0, swagger_1.ApiOperation)({
        summary: 'Apply past eBay sales to the other stores (dryRun: only report what would change)',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RunCrossStoreSaleSyncDto]),
    __metadata("design:returntype", Promise)
], CrossStoreSaleSyncController.prototype, "run", null);
exports.CrossStoreSaleSyncController = CrossStoreSaleSyncController = __decorate([
    (0, swagger_1.ApiTags)('Inventory sync'),
    (0, common_1.Controller)('inventory-sync/ebay'),
    __metadata("design:paramtypes", [cross_store_sale_sync_service_js_1.CrossStoreSaleSyncService])
], CrossStoreSaleSyncController);
//# sourceMappingURL=cross-store-sale-sync.controller.js.map