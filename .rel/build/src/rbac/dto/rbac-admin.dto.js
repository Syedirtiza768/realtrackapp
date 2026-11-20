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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetSidebarConfigDto = exports.SidebarModuleConfigItemDto = exports.SetRolePermissionsDto = exports.UpdateRoleDto = exports.CreateRoleDto = exports.ResetPasswordDto = exports.AssignRoleDto = exports.CreateRbacUserDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const permission_registry_js_1 = require("../permission-registry.js");
const ROLE_SLUG_VALUES = Object.values(permission_registry_js_1.ROLE_SLUGS);
class CreateRbacUserDto {
    email;
    password;
    name;
    roleSlug;
}
exports.CreateRbacUserDto = CreateRbacUserDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateRbacUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], CreateRbacUserDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRbacUserDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(ROLE_SLUG_VALUES),
    __metadata("design:type", String)
], CreateRbacUserDto.prototype, "roleSlug", void 0);
class AssignRoleDto {
    roleSlug;
}
exports.AssignRoleDto = AssignRoleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(ROLE_SLUG_VALUES),
    __metadata("design:type", String)
], AssignRoleDto.prototype, "roleSlug", void 0);
class ResetPasswordDto {
    newPassword;
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "newPassword", void 0);
class CreateRoleDto {
    slug;
    name;
    description;
}
exports.CreateRoleDto = CreateRoleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(80),
    (0, class_validator_1.Matches)(/^[a-z0-9_]+$/, {
        message: 'slug must be lowercase alphanumeric with underscores',
    }),
    __metadata("design:type", String)
], CreateRoleDto.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateRoleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRoleDto.prototype, "description", void 0);
class UpdateRoleDto {
    name;
    description;
}
exports.UpdateRoleDto = UpdateRoleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateRoleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRoleDto.prototype, "description", void 0);
class SetRolePermissionsDto {
    permissionKeys;
}
exports.SetRolePermissionsDto = SetRolePermissionsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], SetRolePermissionsDto.prototype, "permissionKeys", void 0);
class SidebarModuleConfigItemDto {
    roleSlug;
    moduleKey;
    visible;
}
exports.SidebarModuleConfigItemDto = SidebarModuleConfigItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SidebarModuleConfigItemDto.prototype, "roleSlug", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SidebarModuleConfigItemDto.prototype, "moduleKey", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SidebarModuleConfigItemDto.prototype, "visible", void 0);
class SetSidebarConfigDto {
    configs;
}
exports.SetSidebarConfigDto = SetSidebarConfigDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => SidebarModuleConfigItemDto),
    __metadata("design:type", Array)
], SetSidebarConfigDto.prototype, "configs", void 0);
//# sourceMappingURL=rbac-admin.dto.js.map