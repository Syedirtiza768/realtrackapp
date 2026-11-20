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
exports.ReviewController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const review_service_js_1 = require("./review.service.js");
const review_decision_dto_js_1 = require("../dto/review-decision.dto.js");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
let ReviewController = class ReviewController {
    reviewService;
    constructor(reviewService) {
        this.reviewService = reviewService;
    }
    async listForReview(limit) {
        const jobs = await this.reviewService.listForReview(limit ?? 20);
        return { jobs };
    }
    async approve(id, dto, user) {
        const result = await this.reviewService.approve(id, dto, user.id);
        return result;
    }
    async reject(id, dto, user) {
        const job = await this.reviewService.reject(id, dto, user.id);
        return { job };
    }
};
exports.ReviewController = ReviewController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List jobs needing human review' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "listForReview", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve an ingestion job and create listing' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, review_decision_dto_js_1.ReviewDecisionDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, swagger_1.ApiOperation)({ summary: 'Reject an ingestion job' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, review_decision_dto_js_1.ReviewDecisionDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], ReviewController.prototype, "reject", null);
exports.ReviewController = ReviewController = __decorate([
    (0, swagger_1.ApiTags)('Ingestion Review'),
    (0, common_1.Controller)('ingestion/review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('pipeline.review'),
    __metadata("design:paramtypes", [review_service_js_1.ReviewService])
], ReviewController);
//# sourceMappingURL=review.controller.js.map