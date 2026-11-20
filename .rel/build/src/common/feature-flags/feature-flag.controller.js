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
exports.FeatureFlagController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const feature_flag_service_js_1 = require("./feature-flag.service.js");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
let FeatureFlagController = class FeatureFlagController {
    flagService;
    constructor(flagService) {
        this.flagService = flagService;
    }
    async list() {
        return this.flagService.getAll();
    }
    async get(key) {
        return this.flagService.getByKey(key);
    }
    async update(key, body) {
        return this.flagService.setEnabled(key, body.enabled);
    }
    async toggle(key) {
        return this.flagService.toggle(key);
    }
};
exports.FeatureFlagController = FeatureFlagController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all feature flags' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FeatureFlagController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':key'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single feature flag by key' }),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FeatureFlagController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':key'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('feature_flags.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a feature flag' }),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FeatureFlagController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':key/toggle'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('feature_flags.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle a feature flag' }),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FeatureFlagController.prototype, "toggle", null);
exports.FeatureFlagController = FeatureFlagController = __decorate([
    (0, swagger_1.ApiTags)('feature-flags'),
    (0, common_1.Controller)('api/feature-flags'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('feature_flags.view'),
    __metadata("design:paramtypes", [feature_flag_service_js_1.FeatureFlagService])
], FeatureFlagController);
//# sourceMappingURL=feature-flag.controller.js.map