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
var ListingGuardAuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingGuardAuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const compliance_audit_log_entity_js_1 = require("../../catalog-import/entities/compliance-audit-log.entity.js");
const FIX_FIELD_MAP = {
    TITLE_TRIMMED: 'title',
    BRAND_NORMALIZED: 'brand',
    MPN_NORMALIZED: 'mpn',
    MPN_SET_FROM_INPUT: 'mpn',
    DISCLAIMER_INJECTED: 'description',
    FITMENT_DEDUPED: 'compatibility',
};
let ListingGuardAuditService = ListingGuardAuditService_1 = class ListingGuardAuditService {
    auditRepo;
    logger = new common_1.Logger(ListingGuardAuditService_1.name);
    constructor(auditRepo) {
        this.auditRepo = auditRepo;
    }
    async logGuardFixes(fixes, context) {
        if (!fixes.length)
            return;
        if (!context.productId && !context.importId)
            return;
        const entries = fixes.map((fix) => {
            const field = FIX_FIELD_MAP[fix] ?? 'ai_guard';
            const beforeVal = context.before?.[field];
            const afterVal = context.after?.[field];
            return this.auditRepo.create({
                productId: context.productId ?? null,
                importId: context.importId ?? null,
                action: 'auto_correction',
                field,
                originalValue: beforeVal != null
                    ? String(beforeVal).slice(0, 2000)
                    : (context.sku ?? null),
                newValue: afterVal != null ? String(afterVal).slice(0, 2000) : fix,
                reason: `AI listing guard: ${fix}`,
                severity: 'info',
                autoFixed: true,
            });
        });
        try {
            await this.auditRepo.save(entries);
        }
        catch (err) {
            this.logger.warn(`Failed to log guard fixes to compliance_audit: ${err}`);
        }
    }
};
exports.ListingGuardAuditService = ListingGuardAuditService;
exports.ListingGuardAuditService = ListingGuardAuditService = ListingGuardAuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(compliance_audit_log_entity_js_1.ComplianceAuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ListingGuardAuditService);
//# sourceMappingURL=listing-guard-audit.service.js.map