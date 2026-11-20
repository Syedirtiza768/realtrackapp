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
var ComplianceAuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceAuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const compliance_audit_log_entity_js_1 = require("../entities/compliance-audit-log.entity.js");
let ComplianceAuditService = ComplianceAuditService_1 = class ComplianceAuditService {
    auditRepo;
    logger = new common_1.Logger(ComplianceAuditService_1.name);
    constructor(auditRepo) {
        this.auditRepo = auditRepo;
    }
    async log(entry) {
        try {
            await this.auditRepo.save(this.auditRepo.create({
                productId: entry.productId ?? null,
                importId: entry.importId ?? null,
                action: entry.action,
                field: entry.field,
                originalValue: entry.originalValue ?? null,
                newValue: entry.newValue ?? null,
                reason: entry.reason ?? null,
                severity: entry.severity ?? 'info',
                complianceScore: entry.complianceScore ?? null,
                autoFixed: entry.autoFixed ?? false,
            }));
        }
        catch (err) {
            this.logger.warn(`Failed to log compliance audit: ${err}`);
        }
    }
    async logBatch(entries) {
        if (entries.length === 0)
            return;
        try {
            const records = entries.map((e) => this.auditRepo.create({
                productId: e.productId ?? null,
                importId: e.importId ?? null,
                action: e.action,
                field: e.field,
                originalValue: e.originalValue ?? null,
                newValue: e.newValue ?? null,
                reason: e.reason ?? null,
                severity: e.severity ?? 'info',
                complianceScore: e.complianceScore ?? null,
                autoFixed: e.autoFixed ?? false,
            }));
            await this.auditRepo.save(records);
        }
        catch (err) {
            this.logger.warn(`Failed to batch log compliance audits: ${err}`);
        }
    }
    async getByProduct(productId, limit = 100) {
        return this.auditRepo.find({
            where: { productId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
    async getByImport(importId, limit = 500) {
        return this.auditRepo.find({
            where: { importId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
    async getImportAuditSummary(importId) {
        const logs = await this.auditRepo.find({ where: { importId } });
        const byAction = {};
        const bySeverity = {};
        let autoFixedCount = 0;
        for (const log of logs) {
            byAction[log.action] = (byAction[log.action] ?? 0) + 1;
            bySeverity[log.severity] = (bySeverity[log.severity] ?? 0) + 1;
            if (log.autoFixed)
                autoFixedCount++;
        }
        return {
            totalActions: logs.length,
            byAction,
            bySeverity,
            autoFixedCount,
        };
    }
};
exports.ComplianceAuditService = ComplianceAuditService;
exports.ComplianceAuditService = ComplianceAuditService = ComplianceAuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(compliance_audit_log_entity_js_1.ComplianceAuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ComplianceAuditService);
//# sourceMappingURL=compliance-audit.service.js.map