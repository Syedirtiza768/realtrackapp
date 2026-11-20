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
exports.AuthAuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_js_1 = require("../dashboard/entities/audit-log.entity.js");
let AuthAuditService = class AuthAuditService {
    auditRepo;
    constructor(auditRepo) {
        this.auditRepo = auditRepo;
    }
    async log(action, opts) {
        const ip = opts.req?.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            opts.req?.ip ??
            null;
        const userAgent = opts.req?.headers['user-agent'] ?? null;
        await this.auditRepo.save(this.auditRepo.create({
            action,
            entityType: opts.entityType ?? 'auth',
            entityId: opts.entityId ??
                opts.actorId ??
                '00000000-0000-0000-0000-000000000000',
            actorId: opts.actorId ?? null,
            actorType: opts.actorId ? 'user' : 'system',
            metadata: {
                ...(opts.metadata ?? {}),
                ...(userAgent ? { userAgent } : {}),
            },
            ipAddress: ip,
        }));
    }
};
exports.AuthAuditService = AuthAuditService;
exports.AuthAuditService = AuthAuditService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_js_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuthAuditService);
//# sourceMappingURL=auth-audit.service.js.map