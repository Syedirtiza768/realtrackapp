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
exports.TemplateController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const template_service_js_1 = require("./template.service.js");
const template_dto_js_1 = require("./dto/template.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
let TemplateController = class TemplateController {
    templateService;
    constructor(templateService) {
        this.templateService = templateService;
    }
    findAll(query) {
        return this.templateService.findAll(query);
    }
    findOne(id) {
        return this.templateService.findOne(id);
    }
    create(dto) {
        return this.templateService.create(dto);
    }
    update(id, dto) {
        return this.templateService.update(id, dto);
    }
    remove(id) {
        return this.templateService.remove(id);
    }
    renderPreview(id, dto) {
        return this.templateService.renderPreview(id, dto);
    }
    generate(id, body) {
        return this.templateService.generateFromTemplate(id, body.productData, body.categoryName, body.condition);
    }
};
exports.TemplateController = TemplateController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all listing templates' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [template_dto_js_1.TemplateQueryDto]),
    __metadata("design:returntype", void 0)
], TemplateController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single template' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TemplateController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('templates.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a listing template' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [template_dto_js_1.CreateTemplateDto]),
    __metadata("design:returntype", void 0)
], TemplateController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('templates.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a listing template' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, template_dto_js_1.UpdateTemplateDto]),
    __metadata("design:returntype", void 0)
], TemplateController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('templates.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a listing template' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TemplateController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/preview'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('templates.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Render a template preview with variables' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, template_dto_js_1.RenderPreviewDto]),
    __metadata("design:returntype", void 0)
], TemplateController.prototype, "renderPreview", null);
__decorate([
    (0, common_1.Post)(':id/generate'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('templates.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Render template + run OpenAI listing generation pipeline',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TemplateController.prototype, "generate", null);
exports.TemplateController = TemplateController = __decorate([
    (0, swagger_1.ApiTags)('Templates'),
    (0, common_1.Controller)('templates'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('templates.view'),
    __metadata("design:paramtypes", [template_service_js_1.TemplateService])
], TemplateController);
//# sourceMappingURL=template.controller.js.map