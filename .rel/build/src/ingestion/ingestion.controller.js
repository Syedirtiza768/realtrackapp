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
exports.IngestionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ingestion_service_js_1 = require("./ingestion.service.js");
const create_job_dto_js_1 = require("./dto/create-job.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
let IngestionController = class IngestionController {
    ingestionService;
    rbac;
    constructor(ingestionService, rbac) {
        this.ingestionService = ingestionService;
        this.rbac = rbac;
    }
    async createJob(dto, user) {
        const job = await this.ingestionService.createJob(dto, user.id);
        return { job };
    }
    async listJobs(user, status, limit, offset) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        return this.ingestionService.listJobs(status, limit ?? 20, offset ?? 0, user.id, viewAll);
    }
    async getJob(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        return this.ingestionService.getJob(id, user.id, viewAll);
    }
    async retryJob(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        const job = await this.ingestionService.retryJob(id, user.id, viewAll);
        return { job };
    }
    async cancelJob(id, user) {
        const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
        const job = await this.ingestionService.cancelJob(id, user.id, viewAll);
        return { job };
    }
    async getStats() {
        const stats = await this.ingestionService.getStats();
        return { stats };
    }
};
exports.IngestionController = IngestionController;
__decorate([
    (0, common_1.Post)('jobs'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ingestion.create'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new AI ingestion job' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_job_dto_js_1.CreateJobDto, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "createJob", null);
__decorate([
    (0, common_1.Get)('jobs'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ingestion.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List ingestion jobs with optional status filter' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, Number, Number]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "listJobs", null);
__decorate([
    (0, common_1.Get)('jobs/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ingestion.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get ingestion job details with AI result and images',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "getJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/retry'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ingestion.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Retry a failed ingestion job' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "retryJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/cancel'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ingestion.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a pending/processing job' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, user_entity_js_1.User]),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "cancelJob", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ingestion.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get ingestion pipeline aggregate stats' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], IngestionController.prototype, "getStats", null);
exports.IngestionController = IngestionController = __decorate([
    (0, swagger_1.ApiTags)('Ingestion'),
    (0, common_1.Controller)('ingestion'),
    __metadata("design:paramtypes", [ingestion_service_js_1.IngestionService,
        rbac_service_js_1.RbacService])
], IngestionController);
//# sourceMappingURL=ingestion.controller.js.map