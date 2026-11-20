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
exports.DashboardCache = void 0;
const typeorm_1 = require("typeorm");
let DashboardCache = class DashboardCache {
    metricKey;
    metricValue;
    computedAt;
};
exports.DashboardCache = DashboardCache;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], DashboardCache.prototype, "metricKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], DashboardCache.prototype, "metricValue", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], DashboardCache.prototype, "computedAt", void 0);
exports.DashboardCache = DashboardCache = __decorate([
    (0, typeorm_1.Entity)({ name: 'dashboard_metrics_cache' })
], DashboardCache);
//# sourceMappingURL=dashboard-cache.entity.js.map