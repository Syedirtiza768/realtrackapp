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
exports.ClientSettingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_settings_entity_js_1 = require("./entities/client-settings.entity.js");
const DEFAULTS = {
    appName: 'Omni Core',
    clientName: 'Omni Core',
    shortName: 'OC',
    primaryColor: '#2563eb',
    secondaryColor: '#1e293b',
    accentColor: '#0ea5e9',
    themeMode: 'light',
    sidebarTheme: 'slate',
    navbarTheme: 'slate',
    footerText: '© Omni Core',
    whiteLabelEnabled: true,
    poweredByVisible: false,
};
let ClientSettingsService = class ClientSettingsService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async getEffective(organizationId) {
        let row = await this.repo.findOne({
            where: organizationId ? { organizationId } : { organizationId: (0, typeorm_2.IsNull)() },
        });
        if (!row && organizationId) {
            row = await this.repo.findOne({ where: { organizationId: (0, typeorm_2.IsNull)() } });
        }
        if (!row) {
            row = await this.seedDefaults(organizationId ?? null);
        }
        return row;
    }
    async update(dto, userId, organizationId) {
        const row = await this.getEffective(organizationId);
        Object.assign(row, dto, { updatedBy: userId });
        return this.repo.save(row);
    }
    async seedDefaults(organizationId = null) {
        const existing = await this.repo.findOne({
            where: organizationId ? { organizationId } : { organizationId: (0, typeorm_2.IsNull)() },
        });
        if (existing)
            return existing;
        return this.repo.save(this.repo.create({
            organizationId,
            ...DEFAULTS,
        }));
    }
    async getPublicBranding() {
        const row = await this.getEffective(null);
        return {
            appName: row.appName,
            clientName: row.clientName,
            shortName: row.shortName,
            logoUrl: row.logoUrl,
            faviconUrl: row.faviconUrl,
            loginLogoUrl: row.loginLogoUrl,
            primaryColor: row.primaryColor,
            secondaryColor: row.secondaryColor,
            accentColor: row.accentColor,
            themeMode: row.themeMode,
            footerText: row.footerText,
            poweredByVisible: row.poweredByVisible,
        };
    }
};
exports.ClientSettingsService = ClientSettingsService;
exports.ClientSettingsService = ClientSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(client_settings_entity_js_1.ClientSettings)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ClientSettingsService);
//# sourceMappingURL=client-settings.service.js.map