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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_js_1 = require("../auth/decorators/public.decorator.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const terminus_1 = require("@nestjs/terminus");
const queue_health_service_js_1 = require("../common/queues/queue-health.service.js");
const runtime_health_service_js_1 = require("../common/observability/runtime-health.service.js");
let HealthController = class HealthController {
    health;
    db;
    memory;
    queueHealth;
    runtimeHealth;
    constructor(health, db, memory, queueHealth, runtimeHealth) {
        this.health = health;
        this.db = db;
        this.memory = memory;
        this.queueHealth = queueHealth;
        this.runtimeHealth = runtimeHealth;
    }
    check() {
        return this.health.check([
            () => this.db.pingCheck('database'),
            () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),
        ]);
    }
    async queueSnapshot() {
        const queues = await this.queueHealth.getSnapshot();
        const totals = Object.values(queues).reduce((acc, q) => ({
            waiting: acc.waiting + q.waiting,
            active: acc.active + q.active,
            delayed: acc.delayed + q.delayed,
            failed: acc.failed + q.failed,
        }), { waiting: 0, active: 0, delayed: 0, failed: 0 });
        return { queues, totals, generatedAt: new Date().toISOString() };
    }
    runtime() {
        return this.runtimeHealth.getSnapshot();
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, throttler_1.SkipThrottle)({ short: true, medium: true, long: true }),
    (0, common_1.Get)(),
    (0, terminus_1.HealthCheck)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('queues'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('users.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "queueSnapshot", null);
__decorate([
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Get)('runtime'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "runtime", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [terminus_1.HealthCheckService,
        terminus_1.TypeOrmHealthIndicator,
        terminus_1.MemoryHealthIndicator,
        queue_health_service_js_1.QueueHealthService,
        runtime_health_service_js_1.RuntimeHealthService])
], HealthController);
//# sourceMappingURL=health.controller.js.map