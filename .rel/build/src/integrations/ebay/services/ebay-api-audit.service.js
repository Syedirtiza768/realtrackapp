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
exports.EbayApiAuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_api_audit_log_entity_js_1 = require("../entities/ebay-api-audit-log.entity.js");
let EbayApiAuditService = class EbayApiAuditService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async record(input) {
        const meta = { ...(input.requestMetadata ?? {}) };
        for (const key of Object.keys(meta)) {
            const lower = key.toLowerCase();
            if (lower.includes('token') ||
                lower.includes('secret') ||
                lower.includes('authorization') ||
                lower.includes('password')) {
                delete meta[key];
            }
        }
        await this.repo.save(this.repo.create({
            organizationId: input.organizationId,
            ebayAccountId: input.ebayAccountId ?? null,
            userId: input.userId ?? null,
            httpMethod: input.httpMethod,
            apiFamily: input.apiFamily,
            endpointPath: input.endpointPath.slice(0, 500),
            marketplaceId: input.marketplaceId ?? null,
            responseStatus: input.responseStatus ?? null,
            ebayErrorId: input.ebayErrorId ?? null,
            ebayErrorMessage: input.ebayErrorMessage?.slice(0, 2000) ?? null,
            correlationId: input.correlationId ?? null,
            durationMs: input.durationMs ?? null,
            requestMetadata: meta,
        }));
    }
    async listForAccount(ebayAccountId, organizationId, limit = 50) {
        return this.repo.find({
            where: { ebayAccountId, organizationId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
};
exports.EbayApiAuditService = EbayApiAuditService;
exports.EbayApiAuditService = EbayApiAuditService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_api_audit_log_entity_js_1.EbayApiAuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], EbayApiAuditService);
//# sourceMappingURL=ebay-api-audit.service.js.map