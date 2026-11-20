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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const settings_service_js_1 = require("./settings.service.js");
const settings_dto_js_1 = require("./dto/settings.dto.js");
let SettingsController = class SettingsController {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    getAll() {
        return this.settingsService.getAll();
    }
    getByCategory(category) {
        return this.settingsService.getByCategory(category);
    }
    update(category, key, dto) {
        return this.settingsService.updateSetting(category, key, dto.value);
    }
    getShippingProfiles() {
        return this.settingsService.getShippingProfiles();
    }
    createShippingProfile(dto) {
        return this.settingsService.createShippingProfile(dto);
    }
    updateShippingProfile(id, dto) {
        return this.settingsService.updateShippingProfile(id, dto);
    }
    deleteShippingProfile(id) {
        return this.settingsService.deleteShippingProfile(id);
    }
    getPricingRules() {
        return this.settingsService.getPricingRules();
    }
    createPricingRule(dto) {
        return this.settingsService.createPricingRule(dto);
    }
    updatePricingRule(id, dto) {
        return this.settingsService.updatePricingRule(id, dto);
    }
    deletePricingRule(id) {
        return this.settingsService.deletePricingRule(id);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all settings grouped by category' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getAll", null);
__decorate([
    (0, common_1.Get)(':category'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get settings for a category' }),
    __param(0, (0, common_1.Param)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getByCategory", null);
__decorate([
    (0, common_1.Put)(':category/:key'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a setting value' }),
    __param(0, (0, common_1.Param)('category')),
    __param(1, (0, common_1.Param)('key')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, settings_dto_js_1.UpdateSettingDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('shipping-profiles/list'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List shipping profiles' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getShippingProfiles", null);
__decorate([
    (0, common_1.Post)('shipping-profiles'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create shipping profile' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_dto_js_1.CreateShippingProfileDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "createShippingProfile", null);
__decorate([
    (0, common_1.Put)('shipping-profiles/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update shipping profile' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, settings_dto_js_1.UpdateShippingProfileDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateShippingProfile", null);
__decorate([
    (0, common_1.Delete)('shipping-profiles/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete shipping profile' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "deleteShippingProfile", null);
__decorate([
    (0, common_1.Get)('pricing-rules/list'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List pricing rules' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getPricingRules", null);
__decorate([
    (0, common_1.Post)('pricing-rules'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Create pricing rule' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [settings_dto_js_1.CreatePricingRuleDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "createPricingRule", null);
__decorate([
    (0, common_1.Put)('pricing-rules/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update pricing rule' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, settings_dto_js_1.UpdatePricingRuleDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updatePricingRule", null);
__decorate([
    (0, common_1.Delete)('pricing-rules/:id'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('settings.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete pricing rule' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "deletePricingRule", null);
exports.SettingsController = SettingsController = __decorate([
    (0, swagger_1.ApiTags)('Settings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings'),
    __metadata("design:paramtypes", [settings_service_js_1.SettingsService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map