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
exports.ReviewQueueController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const review_queue_service_1 = require("../services/review-queue.service");
const dto_1 = require("../dto");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
let ReviewQueueController = class ReviewQueueController {
    reviewService;
    constructor(reviewService) {
        this.reviewService = reviewService;
    }
    async listTasks(query) {
        return this.reviewService.listTasks(query);
    }
    async getTask(id) {
        return this.reviewService.getTask(id);
    }
    async assignTask(id, assignedTo) {
        return this.reviewService.assignTask(id, assignedTo);
    }
    async resolveTask(id, dto, user) {
        return this.reviewService.resolveTask(id, user.id, dto);
    }
    async getStats() {
        return this.reviewService.getStats();
    }
};
exports.ReviewQueueController = ReviewQueueController;
__decorate([
    (0, common_1.Get)('tasks'),
    (0, swagger_1.ApiOperation)({ summary: 'List review tasks with filters' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ReviewTaskQueryDto]),
    __metadata("design:returntype", Promise)
], ReviewQueueController.prototype, "listTasks", null);
__decorate([
    (0, common_1.Get)('tasks/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single review task' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewQueueController.prototype, "getTask", null);
__decorate([
    (0, common_1.Patch)('tasks/:id/assign'),
    (0, swagger_1.ApiOperation)({ summary: 'Assign a review task to a user' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('assignedTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ReviewQueueController.prototype, "assignTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/resolve'),
    (0, swagger_1.ApiOperation)({ summary: 'Resolve a review task (approve/reject/defer)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.ResolveReviewTaskDto,
        user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], ReviewQueueController.prototype, "resolveTask", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get review queue statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReviewQueueController.prototype, "getStats", null);
exports.ReviewQueueController = ReviewQueueController = __decorate([
    (0, swagger_1.ApiTags)('Motors Review Queue'),
    (0, common_1.Controller)('motors-intelligence/review'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('motors.review'),
    __metadata("design:paramtypes", [review_queue_service_1.ReviewQueueService])
], ReviewQueueController);
//# sourceMappingURL=review-queue.controller.js.map