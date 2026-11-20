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
exports.AutomationRule = void 0;
const typeorm_1 = require("typeorm");
let AutomationRule = class AutomationRule {
    id;
    name;
    description;
    triggerType;
    triggerConfig;
    actionType;
    actionConfig;
    conditions;
    storeId;
    channel;
    enabled;
    priority;
    lastExecutedAt;
    executionCount;
    createdAt;
    updatedAt;
};
exports.AutomationRule = AutomationRule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AutomationRule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 200 }),
    __metadata("design:type", String)
], AutomationRule.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], AutomationRule.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 50 }),
    __metadata("design:type", String)
], AutomationRule.prototype, "triggerType", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: {} }),
    __metadata("design:type", Object)
], AutomationRule.prototype, "triggerConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 50 }),
    __metadata("design:type", String)
], AutomationRule.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: {} }),
    __metadata("design:type", Object)
], AutomationRule.prototype, "actionConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: [] }),
    __metadata("design:type", Array)
], AutomationRule.prototype, "conditions", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { name: 'store_id', nullable: true }),
    __metadata("design:type", Object)
], AutomationRule.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 30, nullable: true }),
    __metadata("design:type", Object)
], AutomationRule.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: false }),
    __metadata("design:type", Boolean)
], AutomationRule.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 0 }),
    __metadata("design:type", Number)
], AutomationRule.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamptz', { nullable: true }),
    __metadata("design:type", Object)
], AutomationRule.prototype, "lastExecutedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('integer', { default: 0 }),
    __metadata("design:type", Number)
], AutomationRule.prototype, "executionCount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], AutomationRule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], AutomationRule.prototype, "updatedAt", void 0);
exports.AutomationRule = AutomationRule = __decorate([
    (0, typeorm_1.Entity)({ name: 'automation_rules' })
], AutomationRule);
//# sourceMappingURL=automation-rule.entity.js.map