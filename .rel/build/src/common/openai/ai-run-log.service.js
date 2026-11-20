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
var AiRunLogService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiRunLogService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ai_run_log_entity_js_1 = require("./entities/ai-run-log.entity.js");
let AiRunLogService = AiRunLogService_1 = class AiRunLogService {
    repo;
    logger = new common_1.Logger(AiRunLogService_1.name);
    constructor(repo) {
        this.repo = repo;
    }
    async logRun(input) {
        const row = this.repo.create({
            sku: input.sku ?? null,
            partNumber: input.partNumber ?? null,
            partType: input.partType ?? null,
            price: input.price ?? null,
            donorVehicle: input.donorVehicle ?? null,
            marketplace: input.marketplace ?? null,
            batchId: input.batchId ?? null,
            enhancementId: input.enhancementId ?? null,
            lane: input.lane,
            model: input.model,
            attempt: input.attempt ?? 1,
            promptVersion: input.promptVersion,
            routingPolicyVersion: input.routingPolicyVersion ?? null,
            inputTokens: input.inputTokens ?? null,
            outputTokens: input.outputTokens ?? null,
            costUsd: input.costUsd ?? null,
            latencyMs: input.latencyMs ?? null,
            validationScore: input.validationScore ?? null,
            hardFails: input.hardFails ?? [],
            softFails: input.softFails ?? [],
            escalated: input.escalated ?? false,
            passedGate: input.passedGate ?? false,
            fitmentRowCount: input.fitmentRowCount ?? null,
            fitmentSource: input.fitmentSource ?? null,
            fitmentRowsPre: input.fitmentRowsPre ?? null,
            fitmentRowsPost: input.fitmentRowsPost ?? null,
            tokensSavedEstimate: input.tokensSavedEstimate ?? null,
            guardFixes: input.guardFixes ?? null,
        });
        return this.repo.save(row);
    }
    async backfillApproval(enhancementId, approved, rejectionReason, fieldEdits) {
        await this.repo.update({ enhancementId }, {
            humanApproved: approved,
            humanRejected: !approved,
            rejectionReason: approved ? null : (rejectionReason ?? null),
            fieldEdits: fieldEdits ?? null,
        });
    }
    async recordComplianceOutcome(sku, complianceScore) {
        const latest = await this.repo.findOne({
            where: { sku },
            order: { createdAt: 'DESC' },
        });
        if (!latest) {
            this.logger.debug(`No ai_run_log for SKU ${sku} — skipping compliance outcome`);
            return;
        }
        latest.complianceScore = complianceScore;
        await this.repo.save(latest);
    }
    async recordPublishOutcome(sku, published, publishError, ebayCategoryId) {
        const latest = await this.repo.findOne({
            where: { sku },
            order: { createdAt: 'DESC' },
        });
        if (!latest) {
            this.logger.debug(`No ai_run_log for SKU ${sku} — skipping publish outcome`);
            return;
        }
        latest.published = published;
        latest.publishError = publishError ?? null;
        latest.ebayCategoryId = ebayCategoryId ?? null;
        await this.repo.save(latest);
    }
    async getBatchTotals(batchId) {
        const row = await this.repo
            .createQueryBuilder('l')
            .select('COALESCE(SUM(l.input_tokens), 0)', 'inputTokens')
            .addSelect('COALESCE(SUM(l.output_tokens), 0)', 'outputTokens')
            .addSelect('COALESCE(SUM(l.cost_usd), 0)', 'costUsd')
            .addSelect('COUNT(*)', 'runs')
            .where('l.batch_id = :batchId', { batchId })
            .getRawOne();
        return {
            inputTokens: Number(row?.inputTokens ?? 0),
            outputTokens: Number(row?.outputTokens ?? 0),
            costUsd: Number(row?.costUsd ?? 0),
            runs: Number(row?.runs ?? 0),
        };
    }
    async getSegmentStats(sinceDays = 30) {
        const since = new Date();
        since.setDate(since.getDate() - sinceDays);
        const rows = await this.repo
            .createQueryBuilder('l')
            .select('l.part_type', 'partType')
            .addSelect('l.model', 'model')
            .addSelect('l.lane', 'lane')
            .addSelect('COUNT(*)', 'attempts')
            .addSelect('AVG(CASE WHEN l.passed_gate AND NOT l.escalated THEN 1.0 ELSE 0.0 END)', 'firstPassRate')
            .addSelect('AVG(CASE WHEN l.escalated THEN 1.0 ELSE 0.0 END)', 'escalationRate')
            .addSelect('AVG(l.cost_usd)', 'avgCost')
            .addSelect('AVG(l.validation_score)', 'avgValidationScore')
            .addSelect('AVG(CASE WHEN l.human_approved THEN 1.0 WHEN l.human_approved IS NOT NULL THEN 0.0 ELSE NULL END)', 'humanApprovalRate')
            .addSelect('AVG(CASE WHEN l.published THEN 1.0 WHEN l.published IS NOT NULL THEN 0.0 ELSE NULL END)', 'publishSuccessRate')
            .addSelect('AVG(l.compliance_score)', 'avgComplianceScore')
            .addSelect('AVG(CASE WHEN jsonb_array_length(l.hard_fails) > 0 THEN 1.0 ELSE 0.0 END)', 'hardFailRate')
            .addSelect(`AVG(CASE WHEN l.publish_error IS NOT NULL AND l.publish_error <> '' THEN 1.0 WHEN l.published IS NOT NULL THEN 0.0 ELSE NULL END)`, 'publishErrorRate')
            .where('l.created_at >= :since', { since })
            .groupBy('l.part_type')
            .addGroupBy('l.model')
            .addGroupBy('l.lane')
            .getRawMany();
        return rows.map((r) => ({
            segmentKey: `${r.partType ?? 'general'}|${r.lane ?? 'default'}`,
            model: r.model,
            attempts: Number(r.attempts),
            firstPassRate: Number(r.firstPassRate ?? 0),
            escalationRate: Number(r.escalationRate ?? 0),
            avgCost: Number(r.avgCost ?? 0),
            avgValidationScore: Number(r.avgValidationScore ?? 0),
            humanApprovalRate: Number(r.humanApprovalRate ?? 0),
            publishSuccessRate: Number(r.publishSuccessRate ?? 0),
            avgComplianceScore: Number(r.avgComplianceScore ?? 0),
            hardFailRate: Number(r.hardFailRate ?? 0),
            publishErrorRate: Number(r.publishErrorRate ?? 0),
        }));
    }
};
exports.AiRunLogService = AiRunLogService;
exports.AiRunLogService = AiRunLogService = AiRunLogService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ai_run_log_entity_js_1.AiRunLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AiRunLogService);
//# sourceMappingURL=ai-run-log.service.js.map