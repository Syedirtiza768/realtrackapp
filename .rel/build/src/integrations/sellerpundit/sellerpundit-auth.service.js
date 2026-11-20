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
var SellerpunditAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerpunditAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const token_encryption_service_js_1 = require("../../channels/token-encryption.service.js");
const organization_sellerpundit_config_entity_js_1 = require("./entities/organization-sellerpundit-config.entity.js");
const sellerpundit_http_client_js_1 = require("./sellerpundit-http.client.js");
let SellerpunditAuthService = SellerpunditAuthService_1 = class SellerpunditAuthService {
    config;
    http;
    encryption;
    configRepo;
    logger = new common_1.Logger(SellerpunditAuthService_1.name);
    jwtByOrg = new Map();
    constructor(config, http, encryption, configRepo) {
        this.config = config;
        this.http = http;
        this.encryption = encryption;
        this.configRepo = configRepo;
    }
    async getJwt(organizationId) {
        const cached = this.jwtByOrg.get(organizationId);
        if (cached && cached.expiresAt > Date.now() + 60_000) {
            return cached.token;
        }
        const creds = await this.resolveCredentials(organizationId);
        const token = await this.http.login(creds.email, creds.password);
        const expiresAt = this.decodeJwtExpiry(token) ?? Date.now() + 23 * 60 * 60 * 1000;
        this.jwtByOrg.set(organizationId, { token, expiresAt });
        await this.upsertConfig(organizationId, {
            lastJwtRefreshAt: new Date(),
            lastError: null,
        });
        return token;
    }
    invalidateJwt(organizationId) {
        this.jwtByOrg.delete(organizationId);
    }
    async resolveCredentials(organizationId) {
        const row = await this.configRepo.findOne({ where: { organizationId } });
        if (row?.credentialsEncrypted) {
            try {
                const parsed = JSON.parse(this.encryption.decrypt(row.credentialsEncrypted));
                if (parsed.email && parsed.password)
                    return parsed;
            }
            catch (e) {
                this.logger.warn(`Org ${organizationId} SellerPundit credentials decrypt failed`, e);
            }
        }
        const email = this.config.get('SELLERPUNDIT_EMAIL', '').trim();
        const password = this.config
            .get('SELLERPUNDIT_PASSWORD', '')
            .trim();
        if (!email || !password) {
            throw new common_1.BadRequestException('SellerPundit credentials not configured. Set SELLERPUNDIT_EMAIL and SELLERPUNDIT_PASSWORD in the project root .env (for Docker) or save org credentials in Settings.');
        }
        return { email, password };
    }
    async upsertConfig(organizationId, patch) {
        let row = await this.configRepo.findOne({ where: { organizationId } });
        if (!row) {
            row = this.configRepo.create({ organizationId, enabled: true });
        }
        Object.assign(row, patch);
        return this.configRepo.save(row);
    }
    async getConfigView(organizationId) {
        const row = await this.configRepo.findOne({ where: { organizationId } });
        const envConfigured = !!this.config.get('SELLERPUNDIT_EMAIL', '').trim() &&
            !!this.config.get('SELLERPUNDIT_PASSWORD', '').trim();
        return {
            enabled: row?.enabled ?? true,
            configured: envConfigured || !!row?.credentialsEncrypted,
            hasOrgCredentials: !!row?.credentialsEncrypted,
            lastJwtRefreshAt: row?.lastJwtRefreshAt ?? null,
            lastSyncAt: row?.lastSyncAt ?? null,
            lastError: row?.lastError ?? null,
        };
    }
    async saveOrgCredentials(organizationId, email, password) {
        const credentialsEncrypted = this.encryption.encrypt(JSON.stringify({ email, password }));
        await this.upsertConfig(organizationId, {
            credentialsEncrypted,
            enabled: true,
        });
        this.invalidateJwt(organizationId);
    }
    decodeJwtExpiry(token) {
        try {
            const part = token.split('.')[1];
            if (!part)
                return null;
            const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
            if (payload.exp)
                return payload.exp * 1000;
        }
        catch {
        }
        return null;
    }
};
exports.SellerpunditAuthService = SellerpunditAuthService;
exports.SellerpunditAuthService = SellerpunditAuthService = SellerpunditAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(organization_sellerpundit_config_entity_js_1.OrganizationSellerpunditConfig)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        sellerpundit_http_client_js_1.SellerpunditHttpClient,
        token_encryption_service_js_1.TokenEncryptionService,
        typeorm_2.Repository])
], SellerpunditAuthService);
//# sourceMappingURL=sellerpundit-auth.service.js.map