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
exports.AiEnhancementController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ai_enhancement_service_js_1 = require("./ai-enhancement.service.js");
const ai_enhancement_dto_js_1 = require("./dto/ai-enhancement.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let AiEnhancementController = class AiEnhancementController {
    aiService;
    constructor(aiService) {
        this.aiService = aiService;
    }
    getEnhancements(dto) {
        return this.aiService.getEnhancements(dto);
    }
    getStats() {
        return this.aiService.getStats();
    }
    getEnhancement(id) {
        return this.aiService.getEnhancement(id);
    }
    getListingEnhancements(listingId) {
        return this.aiService.getListingEnhancements(listingId);
    }
    requestEnhancement(dto) {
        return this.aiService.requestEnhancement({
            listingId: dto.listingId,
            enhancementType: dto.enhancementType,
            inputData: dto.inputData,
        });
    }
    bulkRequest(dto) {
        return this.aiService.bulkRequestEnhancements(dto.listingIds, dto.enhancementType);
    }
    approve(id, dto) {
        return this.aiService.approveEnhancement(id, dto.approvedBy);
    }
    apply(id) {
        return this.aiService.applyEnhancement(id);
    }
    reject(id, dto) {
        return this.aiService.rejectEnhancement(id, dto.reason);
    }
};
exports.AiEnhancementController = AiEnhancementController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Query AI enhancements with filters' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ai_enhancement_dto_js_1.EnhancementQueryDto]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "getEnhancements", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get AI enhancement statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific AI enhancement' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "getEnhancement", null);
__decorate([
    (0, common_1.Get)('listing/:listingId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all AI enhancements for a listing' }),
    __param(0, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "getListingEnhancements", null);
__decorate([
    (0, common_1.Post)('request'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Request an AI enhancement for a listing' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ai_enhancement_dto_js_1.RequestEnhancementDto]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "requestEnhancement", null);
__decorate([
    (0, common_1.Post)('bulk-request'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Request AI enhancements for multiple listings' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ai_enhancement_dto_js_1.BulkRequestEnhancementDto]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "bulkRequest", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a generated AI enhancement' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ai_enhancement_dto_js_1.ApproveEnhancementDto]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/apply'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Apply an approved enhancement to the listing' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "apply", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.update'),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a generated AI enhancement' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ai_enhancement_dto_js_1.RejectEnhancementDto]),
    __metadata("design:returntype", void 0)
], AiEnhancementController.prototype, "reject", null);
exports.AiEnhancementController = AiEnhancementController = __decorate([
    (0, swagger_1.ApiTags)('ai-enhancements'),
    (0, common_1.Controller)('ai-enhancements'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('listings.view'),
    __metadata("design:paramtypes", [ai_enhancement_service_js_1.AiEnhancementService])
], AiEnhancementController);
//# sourceMappingURL=ai-enhancement.controller.js.map