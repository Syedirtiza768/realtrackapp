"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AiOptimizerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiOptimizerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const typeorm_2 = require("typeorm");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ai_run_log_service_js_1 = require("./ai-run-log.service.js");
const model_router_js_1 = require("./model-router.js");
const ai_routing_policy_history_entity_js_1 = require("./entities/ai-routing-policy-history.entity.js");
const PRIOR_REWARDS = {
    'openai/gpt-4.1-mini': 0.98,
    'google/gemini-2.5-flash': 1.0,
    'deepseek/deepseek-chat-v3-0324': 0.94,
    'openai/gpt-4o-mini': 0.8,
};
const ALLOWED_MODELS = [
    'openai/gpt-4.1-mini',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-chat-v3-0324',
    'openai/gpt-4o-mini',
];
let AiOptimizerService = AiOptimizerService_1 = class AiOptimizerService {
    config;
    runLogService;
    modelRouter;
    policyHistoryRepo;
    logger = new common_1.Logger(AiOptimizerService_1.name);
    constructor(config, runLogService, modelRouter, policyHistoryRepo) {
        this.config = config;
        this.runLogService = runLogService;
        this.modelRouter = modelRouter;
        this.policyHistoryRepo = policyHistoryRepo;
    }
    async runNightlyIfEnabled() {
        if (this.config.get('AI_OPTIMIZER_ENABLED', 'false') !== 'true')
            return;
        await this.optimize();
    }
    computeReward(stats) {
        const normalizedCost = Math.min(stats.avgCost / 0.01, 1);
        const hardFailRate = stats.hardFailRate ?? 0;
        const publishErrorRate = stats.publishErrorRate ?? 0;
        const compliance = stats.avgComplianceScore ?? 0.85;
        return (0.3 * stats.humanApprovalRate +
            0.25 * stats.firstPassRate +
            0.15 * stats.publishSuccessRate +
            0.15 * compliance +
            0.05 * (1 - normalizedCost) -
            0.5 * stats.escalationRate -
            1.0 * hardFailRate -
            0.3 * publishErrorRate);
    }
    async optimize() {
        const minSamples = Number(this.config.get('AI_LEARNING_MIN_SAMPLES', '20'));
        const stats = await this.runLogService.getSegmentStats(30);
        const current = this.modelRouter.getPolicy();
        const blocklist = this.modelRouter.getBlocklist();
        const next = {
            version: (current?.version ?? 0) + 1,
            generatedAt: new Date().toISOString(),
            canaryPercent: Number(this.config.get('AI_OPTIMIZER_CANARY_PERCENT', '10')),
            source: 'optimizer',
            segments: { ...(current?.segments ?? {}) },
            thresholds: { ...this.modelRouter.getThresholds() },
            escalationChain: current?.escalationChain ?? [
                'openai/gpt-4.1-mini',
                'google/gemini-2.5-flash',
            ],
            blocklist,
            pins: current?.pins ?? {},
        };
        for (const seg of stats) {
            if (seg.attempts < minSamples)
                continue;
            const reward = this.computeReward({
                humanApprovalRate: seg.humanApprovalRate || PRIOR_REWARDS[seg.model] || 0.85,
                firstPassRate: seg.firstPassRate,
                publishSuccessRate: seg.publishSuccessRate,
                avgCost: seg.avgCost,
                escalationRate: seg.escalationRate,
                avgComplianceScore: seg.avgComplianceScore,
                hardFailRate: seg.hardFailRate,
                publishErrorRate: seg.publishErrorRate,
            });
            if (!ALLOWED_MODELS.includes(seg.model) ||
                blocklist.includes(seg.model)) {
                this.logger.error(`Optimizer attempted blocklisted model ${seg.model} — skipping`);
                continue;
            }
            if (reward < 0.5)
                continue;
            next.segments[seg.segmentKey] = {
                lane: seg.model === 'deepseek/deepseek-chat-v3-0324'
                    ? 'bulk'
                    : seg.model === 'google/gemini-2.5-flash'
                        ? 'flagship'
                        : 'default',
                model: seg.model,
            };
        }
        const policyPath = this.resolveOutputPath();
        fs.mkdirSync(path.dirname(policyPath), { recursive: true });
        fs.writeFileSync(policyPath, JSON.stringify(next, null, 2));
        await this.policyHistoryRepo.save(this.policyHistoryRepo.create({
            version: next.version,
            policy: next,
            source: next.source ?? 'optimizer',
        }));
        this.modelRouter.reloadPolicy();
        this.logger.log(`Wrote routing policy v${next.version} to ${policyPath}`);
        return next;
    }
    async generateRecommendations() {
        const stats = await this.runLogService.getSegmentStats(30);
        const recommendations = stats.map((seg) => ({
            segment: seg.segmentKey,
            model: seg.model,
            attempts: seg.attempts,
            reward: this.computeReward({
                humanApprovalRate: seg.humanApprovalRate,
                firstPassRate: seg.firstPassRate,
                publishSuccessRate: seg.publishSuccessRate,
                avgCost: seg.avgCost,
                escalationRate: seg.escalationRate,
                avgComplianceScore: seg.avgComplianceScore,
                hardFailRate: seg.hardFailRate,
                publishErrorRate: seg.publishErrorRate,
            }),
            prior: PRIOR_REWARDS[seg.model] ?? null,
        }));
        return {
            generatedAt: new Date().toISOString(),
            recommendations: recommendations.sort((a, b) => b.reward - a.reward),
        };
    }
    resolveOutputPath() {
        const configured = this.config.get('AI_ROUTING_POLICY_PATH');
        if (configured) {
            return path.isAbsolute(configured)
                ? configured
                : path.resolve(process.cwd(), '..', configured);
        }
        return path.resolve(process.cwd(), '../config/ai-routing-policy.json');
    }
};
exports.AiOptimizerService = AiOptimizerService;
__decorate([
    (0, schedule_1.Cron)('0 2 * * *', { name: 'ai-routing-optimizer' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AiOptimizerService.prototype, "runNightlyIfEnabled", null);
exports.AiOptimizerService = AiOptimizerService = AiOptimizerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(ai_routing_policy_history_entity_js_1.AiRoutingPolicyHistory)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ai_run_log_service_js_1.AiRunLogService,
        model_router_js_1.ModelRouter,
        typeorm_2.Repository])
], AiOptimizerService);
//# sourceMappingURL=ai-optimizer.service.js.map