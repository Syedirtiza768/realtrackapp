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
exports.SidebarModuleConfig = void 0;
const typeorm_1 = require("typeorm");
let SidebarModuleConfig = class SidebarModuleConfig {
    id;
    roleSlug;
    moduleKey;
    visible;
    createdAt;
    updatedAt;
};
exports.SidebarModuleConfig = SidebarModuleConfig;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SidebarModuleConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80 }),
    (0, typeorm_1.Index)('idx_sidebar_config_role'),
    __metadata("design:type", String)
], SidebarModuleConfig.prototype, "roleSlug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    (0, typeorm_1.Index)('idx_sidebar_config_module'),
    __metadata("design:type", String)
], SidebarModuleConfig.prototype, "moduleKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], SidebarModuleConfig.prototype, "visible", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], SidebarModuleConfig.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], SidebarModuleConfig.prototype, "updatedAt", void 0);
exports.SidebarModuleConfig = SidebarModuleConfig = __decorate([
    (0, typeorm_1.Entity)({ name: 'sidebar_module_configs' })
], SidebarModuleConfig);
//# sourceMappingURL=sidebar-module-config.entity.js.map