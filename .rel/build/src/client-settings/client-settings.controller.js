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
exports.ClientSettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_js_1 = require("../auth/decorators/public.decorator.js");
const current_user_decorator_js_1 = require("../auth/decorators/current-user.decorator.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const client_settings_service_js_1 = require("./client-settings.service.js");
const client_settings_dto_js_1 = require("./dto/client-settings.dto.js");
let ClientSettingsController = class ClientSettingsController {
    clientSettings;
    constructor(clientSettings) {
        this.clientSettings = clientSettings;
    }
    getPublicBranding() {
        return this.clientSettings.getPublicBranding();
    }
    getSettings() {
        return this.clientSettings.getEffective(null);
    }
    updateSettings(user, dto) {
        return this.clientSettings.update(dto, user.id, null);
    }
};
exports.ClientSettingsController = ClientSettingsController;
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Get)('branding'),
    (0, swagger_1.ApiOperation)({ summary: 'Public branding/theme for login and shell' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClientSettingsController.prototype, "getPublicBranding", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiBearerAuth)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('client_settings.view'),
    (0, swagger_1.ApiOperation)({ summary: 'View client settings (Super Admin)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClientSettingsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Patch)(),
    (0, swagger_1.ApiBearerAuth)(),
    (0, require_permissions_decorator_js_1.RequirePermissions)('client_settings.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update client settings (Super Admin)' }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_js_1.User,
        client_settings_dto_js_1.UpdateClientSettingsDto]),
    __metadata("design:returntype", void 0)
], ClientSettingsController.prototype, "updateSettings", null);
exports.ClientSettingsController = ClientSettingsController = __decorate([
    (0, swagger_1.ApiTags)('client-settings'),
    (0, common_1.Controller)('client-settings'),
    __metadata("design:paramtypes", [client_settings_service_js_1.ClientSettingsService])
], ClientSettingsController);
//# sourceMappingURL=client-settings.controller.js.map