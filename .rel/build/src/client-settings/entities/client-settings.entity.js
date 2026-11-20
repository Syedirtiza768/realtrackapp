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
exports.ClientSettings = void 0;
const typeorm_1 = require("typeorm");
let ClientSettings = class ClientSettings {
    id;
    organizationId;
    appName;
    clientName;
    shortName;
    logoUrl;
    faviconUrl;
    loginLogoUrl;
    primaryColor;
    secondaryColor;
    accentColor;
    themeMode;
    sidebarTheme;
    navbarTheme;
    footerText;
    supportEmail;
    supportPhone;
    whiteLabelEnabled;
    poweredByVisible;
    updatedBy;
    createdAt;
    updatedAt;
};
exports.ClientSettings = ClientSettings;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ClientSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    (0, typeorm_1.Index)('idx_client_settings_org', { unique: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, default: 'Omni Core' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "appName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, default: 'Omni Core' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "clientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "shortName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "faviconUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "loginLogoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: '#2563eb' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "primaryColor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: '#1e293b' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "secondaryColor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: '#0ea5e9' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "accentColor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'light' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "themeMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, default: 'slate' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "sidebarTheme", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, default: 'slate' }),
    __metadata("design:type", String)
], ClientSettings.prototype, "navbarTheme", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "footerText", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "supportEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "supportPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ClientSettings.prototype, "whiteLabelEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ClientSettings.prototype, "poweredByVisible", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ClientSettings.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ClientSettings.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ClientSettings.prototype, "updatedAt", void 0);
exports.ClientSettings = ClientSettings = __decorate([
    (0, typeorm_1.Entity)({ name: 'client_settings' })
], ClientSettings);
//# sourceMappingURL=client-settings.entity.js.map