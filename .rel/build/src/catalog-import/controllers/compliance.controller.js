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
exports.ComplianceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ebay_compliance_service_js_1 = require("../services/ebay-compliance.service.js");
const compliance_audit_service_js_1 = require("../services/compliance-audit.service.js");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
let ComplianceController = class ComplianceController {
    complianceService;
    auditService;
    constructor(complianceService, auditService) {
        this.complianceService = complianceService;
        this.auditService = auditService;
    }
    async validateBatch(body) {
        const { productIds, autoFix = true } = body;
        if (!productIds?.length) {
            return { error: 'productIds array is required' };
        }
        return this.complianceService.validateBatch(productIds, autoFix);
    }
    async validateProduct(productId, autoFix) {
        const shouldAutoFix = autoFix !== 'false';
        return this.complianceService.validateProduct(productId, shouldAutoFix);
    }
    async validateImport(importId, autoFix, limit) {
        const shouldAutoFix = autoFix !== 'false';
        const maxRecords = Math.min(limit || 500, 500);
        return this.complianceService.validateImportProducts(importId, shouldAutoFix, maxRecords);
    }
    async getImportAuditLogs(importId, limit) {
        const logs = await this.auditService.getByImport(importId, limit ?? 500);
        const summary = await this.auditService.getImportAuditSummary(importId);
        return { logs, summary };
    }
    async getProductAuditLogs(productId, limit) {
        return this.auditService.getByProduct(productId, limit ?? 100);
    }
};
exports.ComplianceController = ComplianceController;
__decorate([
    (0, common_1.Post)('validate-batch'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Validate a batch of products for eBay compliance' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "validateBatch", null);
__decorate([
    (0, common_1.Post)('validate/:productId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Validate a single product for eBay compliance' }),
    __param(0, (0, common_1.Param)('productId')),
    __param(1, (0, common_1.Query)('autoFix')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "validateProduct", null);
__decorate([
    (0, common_1.Post)('validate-import/:importId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate all products from a specific import for eBay compliance',
    }),
    __param(0, (0, common_1.Param)('importId')),
    __param(1, (0, common_1.Query)('autoFix')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "validateImport", null);
__decorate([
    (0, common_1.Get)('audit/:importId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get compliance audit logs for an import' }),
    __param(0, (0, common_1.Param)('importId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "getImportAuditLogs", null);
__decorate([
    (0, common_1.Get)('audit/product/:productId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get compliance audit logs for a specific product' }),
    __param(0, (0, common_1.Param)('productId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], ComplianceController.prototype, "getProductAuditLogs", null);
exports.ComplianceController = ComplianceController = __decorate([
    (0, swagger_1.ApiTags)('Catalog Import / Compliance'),
    (0, common_1.Controller)('catalog-import/compliance'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('catalog.compliance'),
    __metadata("design:paramtypes", [ebay_compliance_service_js_1.EbayComplianceService,
        compliance_audit_service_js_1.ComplianceAuditService])
], ComplianceController);
//# sourceMappingURL=compliance.controller.js.map