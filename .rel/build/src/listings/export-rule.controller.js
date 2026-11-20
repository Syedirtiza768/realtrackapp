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
exports.ExportRuleController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const export_rule_service_js_1 = require("./export-rule.service.js");
const export_rule_dto_js_1 = require("./dto/export-rule.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let ExportRuleController = class ExportRuleController {
    service;
    constructor(service) {
        this.service = service;
    }
    async create(dto) {
        return this.service.create(dto);
    }
    async findAll() {
        return this.service.findAll();
    }
    async findOne(id) {
        return this.service.findOne(id);
    }
    async update(id, dto) {
        return this.service.update(id, dto);
    }
    async remove(id) {
        return this.service.remove(id);
    }
    async execute(id) {
        const count = await this.service.executeRule(id);
        return { offersCreated: count };
    }
    async preview(id) {
        const products = await this.service.findMatchingProducts(id);
        return {
            matchingProductCount: products.length,
            products: products.slice(0, 50).map((p) => ({
                id: p.id,
                sku: p.sku,
                title: p.title,
                brand: p.brand,
                retailPrice: p.retailPrice,
                condition: p.condition,
            })),
        };
    }
};
exports.ExportRuleController = ExportRuleController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new export rule' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Rule created' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [export_rule_dto_js_1.CreateExportRuleDto]),
    __metadata("design:returntype", Promise)
], ExportRuleController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all export rules' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ExportRuleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get an export rule by ID' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExportRuleController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update an export rule' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, export_rule_dto_js_1.UpdateExportRuleDto]),
    __metadata("design:returntype", Promise)
], ExportRuleController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete an export rule' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExportRuleController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/execute'),
    (0, swagger_1.ApiOperation)({
        summary: 'Execute a rule: find matching products and create offers',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns count of offers created' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExportRuleController.prototype, "execute", null);
__decorate([
    (0, common_1.Get)(':id/preview'),
    (0, swagger_1.ApiOperation)({ summary: 'Preview matching products for a rule (dry run)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExportRuleController.prototype, "preview", null);
exports.ExportRuleController = ExportRuleController = __decorate([
    (0, swagger_1.ApiTags)('export-rules'),
    (0, common_1.Controller)('api/export-rules'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.export'),
    __metadata("design:paramtypes", [export_rule_service_js_1.ExportRuleService])
], ExportRuleController);
//# sourceMappingURL=export-rule.controller.js.map