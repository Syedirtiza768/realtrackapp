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
exports.BusinessIndustrialImageIntakeController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const business_industrial_image_intake_dto_js_1 = require("./business-industrial-image-intake.dto.js");
const business_industrial_image_intake_service_js_1 = require("./business-industrial-image-intake.service.js");
const upload_limits_js_1 = require("../storage/upload-limits.js");
let BusinessIndustrialImageIntakeController = class BusinessIndustrialImageIntakeController {
    intake;
    constructor(intake) {
        this.intake = intake;
    }
    createJob(user, dto, organizationId) {
        return this.intake.createJob(user, dto, organizationId);
    }
    createFromDrive(user, dto, organizationId) {
        return this.intake.createDriveJob(user, dto, organizationId);
    }
    listJobs(user, organizationId) {
        return this.intake.listJobs(user, organizationId);
    }
    getJob(user, id, organizationId) {
        return this.intake.getJob(user, id, organizationId);
    }
    upload(user, id, files, filePaths, organizationId) {
        return this.intake.uploadBatch(user, id, files, filePaths, organizationId);
    }
    start(user, id, organizationId) {
        return this.intake.startJob(user, id, organizationId);
    }
    groups(user, id, organizationId) {
        return this.intake.listGroups(user, id, organizationId);
    }
    async export(user, id, response, organizationId) {
        const workbook = await this.intake.exportJob(user, id, organizationId);
        response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        response.setHeader('Content-Disposition', `attachment; filename="omni-core-bi-image-intake-${id}.xlsx"`);
        response.send(workbook);
    }
    group(user, id, organizationId) {
        return this.intake.getGroup(user, id, organizationId);
    }
    apply(user, id, dto, organizationId) {
        return this.intake.applyGroup(user, id, dto, organizationId);
    }
};
exports.BusinessIndustrialImageIntakeController = BusinessIndustrialImageIntakeController;
__decorate([
    (0, common_1.Post)('jobs'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    (0, swagger_1.ApiOperation)({
        summary: 'Create an organization-scoped B&I image intake run',
    }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        business_industrial_image_intake_dto_js_1.CreateBusinessIndustrialImageIntakeJobDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "createJob", null);
__decorate([
    (0, common_1.Post)('jobs/from-drive'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a server-side B&I intake run from a public Google Drive folder',
    }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        business_industrial_image_intake_dto_js_1.CreateBusinessIndustrialDriveIntakeJobDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "createFromDrive", null);
__decorate([
    (0, common_1.Get)('jobs'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "listJobs", null);
__decorate([
    (0, common_1.Get)('jobs/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "getJob", null);
__decorate([
    (0, common_1.Post)('jobs/:id/upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 50, upload_limits_js_1.IMAGE_UPLOAD_MULTER_OPTIONS)),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.UploadedFiles)()),
    __param(3, (0, common_1.Body)('filePaths')),
    __param(4, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, Array, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('jobs/:id/start'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "start", null);
__decorate([
    (0, common_1.Get)('jobs/:id/groups'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "groups", null);
__decorate([
    (0, common_1.Get)('jobs/:id/export.xlsx'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Res)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, Object, String]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialImageIntakeController.prototype, "export", null);
__decorate([
    (0, common_1.Get)('groups/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.import'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "group", null);
__decorate([
    (0, common_1.Post)('groups/:id/apply'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.listings.create'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User, String, business_industrial_image_intake_dto_js_1.ApplyBusinessIndustrialImageIntakeGroupDto, String]),
    __metadata("design:returntype", void 0)
], BusinessIndustrialImageIntakeController.prototype, "apply", null);
exports.BusinessIndustrialImageIntakeController = BusinessIndustrialImageIntakeController = __decorate([
    (0, swagger_1.ApiTags)('business-industrial-image-intake'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('business-industrial/image-intake'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('business_industrial.access'),
    __metadata("design:paramtypes", [business_industrial_image_intake_service_js_1.BusinessIndustrialImageIntakeService])
], BusinessIndustrialImageIntakeController);
//# sourceMappingURL=business-industrial-image-intake.controller.js.map