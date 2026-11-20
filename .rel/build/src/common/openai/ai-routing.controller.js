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
exports.AiRoutingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const require_permissions_decorator_js_1 = require("../../rbac/decorators/require-permissions.decorator.js");
const ai_run_log_service_js_1 = require("./ai-run-log.service.js");
const ai_optimizer_service_js_1 = require("./ai-optimizer.service.js");
const model_router_js_1 = require("./model-router.js");
const openai_service_js_1 = require("./openai.service.js");
let AiRoutingController = class AiRoutingController {
    runLogService;
    optimizer;
    modelRouter;
    openai;
    constructor(runLogService, optimizer, modelRouter, openai) {
        this.runLogService = runLogService;
        this.optimizer = optimizer;
        this.modelRouter = modelRouter;
        this.openai = openai;
    }
    async getStats() {
        const segments = await this.runLogService.getSegmentStats(30);
        return {
            generatedAt: new Date().toISOString(),
            policyVersion: this.modelRouter.getPolicy()?.version ?? null,
            segments,
            costByLane: this.openai.getSessionCostByLane(),
            sessionCostUsd: this.openai.getSessionCost(),
        };
    }
    getRecommendations() {
        return this.optimizer.generateRecommendations();
    }
    getPolicy() {
        return (this.modelRouter.getPolicy() ?? {
            version: null,
            source: 'env-fallback',
            thresholds: this.modelRouter.getThresholds(),
            blocklist: this.modelRouter.getBlocklist(),
        });
    }
    optimize() {
        return this.optimizer.optimize();
    }
};
exports.AiRoutingController = AiRoutingController;
__decorate([
    (0, common_1.Get)('stats'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ai.routing.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Segment × model performance from ai_run_logs' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AiRoutingController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ai.routing.view'),
    (0, swagger_1.ApiOperation)({
        summary: 'Advisor-mode routing recommendations (no policy write)',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AiRoutingController.prototype, "getRecommendations", null);
__decorate([
    (0, common_1.Get)('policy'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ai.routing.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Active routing policy JSON' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AiRoutingController.prototype, "getPolicy", null);
__decorate([
    (0, common_1.Post)('optimize'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('ai.routing.manage'),
    (0, swagger_1.ApiOperation)({
        summary: 'Run optimizer and write new routing policy version',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AiRoutingController.prototype, "optimize", null);
exports.AiRoutingController = AiRoutingController = __decorate([
    (0, swagger_1.ApiTags)('ai-routing'),
    (0, common_1.Controller)('ai/routing'),
    __metadata("design:paramtypes", [ai_run_log_service_js_1.AiRunLogService,
        ai_optimizer_service_js_1.AiOptimizerService,
        model_router_js_1.ModelRouter,
        openai_service_js_1.OpenAiService])
], AiRoutingController);
//# sourceMappingURL=ai-routing.controller.js.map