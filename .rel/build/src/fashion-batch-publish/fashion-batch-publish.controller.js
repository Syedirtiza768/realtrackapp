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
exports.FashionBatchPublishController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const fashion_batch_publish_dto_js_1 = require("./fashion-batch-publish.dto.js");
const fashion_batch_publish_service_js_1 = require("./fashion-batch-publish.service.js");
let FashionBatchPublishController = class FashionBatchPublishController {
    batches;
    constructor(batches) {
        this.batches = batches;
    }
    create(dto, user) {
        return this.batches.createBatch(user, dto);
    }
    list(user, organizationId) {
        return this.batches.listBatches(user, organizationId);
    }
    get(id, user, organizationId) {
        return this.batches.getBatch(user, id, organizationId);
    }
    report(id, user, organizationId) {
        return this.batches.reportCsv(user, id, organizationId);
    }
    retry(itemId, user, organizationId) {
        return this.batches.retryItem(user, itemId, organizationId);
    }
    queue(user, q) {
        return this.batches.reviewQueue(user, q.state ?? 'NEEDS_REVIEW', q.organizationId);
    }
    item(id, user, organizationId) {
        return this.batches.reviewItem(user, id, organizationId);
    }
    audit(id, user, organizationId) {
        return this.batches.auditLog(user, id, organizationId);
    }
    applySuggestion(id, dto, user, organizationId) {
        return this.batches.applySuggestion(user, id, dto, organizationId);
    }
    rejectSuggestion(id, user, organizationId) {
        return this.batches.rejectSuggestion(user, id, organizationId);
    }
    recheck(id, user, organizationId) {
        return this.batches.recheck(user, id, organizationId);
    }
    approve(id, dto, user, organizationId) {
        return this.batches.approve(user, id, dto, organizationId);
    }
    reject(id, dto, user, organizationId) {
        return this.batches.reject(user, id, dto, organizationId);
    }
    getConfig(user, organizationId) {
        return this.batches.getConfig(user, organizationId);
    }
    putConfig(dto, user, organizationId) {
        return this.batches.putConfig(user, dto.config, organizationId);
    }
};
exports.FashionBatchPublishController = FashionBatchPublishController;
__decorate([
    (0, common_1.Post)('batches'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.publish'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fashion_batch_publish_dto_js_1.CreateFashionBatchDto, user_entity_js_1.User]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('batches'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('batches/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('batches/:id/report.csv'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    (0, common_1.Header)('Content-Type', 'text/csv; charset=utf-8'),
    (0, common_1.Header)('Content-Disposition', 'attachment; filename="fashion-batch-report.csv"'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "report", null);
__decorate([
    (0, common_1.Post)('items/:itemId/retry'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.publish'),
    __param(0, (0, common_1.Param)('itemId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "retry", null);
__decorate([
    (0, common_1.Get)('review-queue'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.authenticity.review'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, fashion_batch_publish_dto_js_1.ReviewQueueQueryDto]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "queue", null);
__decorate([
    (0, common_1.Get)('listings/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "item", null);
__decorate([
    (0, common_1.Get)('listings/:id/audit'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "audit", null);
__decorate([
    (0, common_1.Post)('listings/:id/apply-suggestion'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.update', 'fashion.review'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, fashion_batch_publish_dto_js_1.ApplySuggestionDto,
        user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "applySuggestion", null);
__decorate([
    (0, common_1.Post)('listings/:id/reject-suggestion'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.review'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "rejectSuggestion", null);
__decorate([
    (0, common_1.Post)('listings/:id/recheck'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.review'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "recheck", null);
__decorate([
    (0, common_1.Post)('listings/:id/approve'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.review', 'fashion.authenticity.review'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, fashion_batch_publish_dto_js_1.ApproveListingDto,
        user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('listings/:id/reject'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.review', 'fashion.authenticity.review'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, fashion_batch_publish_dto_js_1.RejectListingDto,
        user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "reject", null);
__decorate([
    (0, common_1.Get)('compliance-config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.listings.view'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Put)('compliance-config'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access', 'fashion.settings.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fashion_batch_publish_dto_js_1.ComplianceConfigDto,
        user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], FashionBatchPublishController.prototype, "putConfig", null);
exports.FashionBatchPublishController = FashionBatchPublishController = __decorate([
    (0, common_1.Controller)('fashion/batch-publish'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('fashion.access'),
    __metadata("design:paramtypes", [fashion_batch_publish_service_js_1.FashionBatchPublishService])
], FashionBatchPublishController);
//# sourceMappingURL=fashion-batch-publish.controller.js.map