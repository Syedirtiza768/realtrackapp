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
exports.ExportRule = void 0;
const typeorm_1 = require("typeorm");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
let ExportRule = class ExportRule {
    id;
    organizationId;
    name;
    description;
    storeId;
    store;
    filters;
    priceMultiplier;
    priceAddition;
    titlePrefix;
    titleSuffix;
    fulfillmentPolicyId;
    paymentPolicyId;
    returnPolicyId;
    scheduleCron;
    autoPublish;
    status;
    lastRunAt;
    lastRunCount;
    totalExported;
    createdAt;
    updatedAt;
};
exports.ExportRule = ExportRule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExportRule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ExportRule.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], ExportRule.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ExportRule.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], ExportRule.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => store_entity_js_1.Store, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'store_id' }),
    __metadata("design:type", store_entity_js_1.Store)
], ExportRule.prototype, "store", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], ExportRule.prototype, "filters", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'price_multiplier',
        type: 'numeric',
        precision: 5,
        scale: 4,
        default: 1,
    }),
    __metadata("design:type", Number)
], ExportRule.prototype, "priceMultiplier", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'price_addition',
        type: 'numeric',
        precision: 12,
        scale: 2,
        default: 0,
    }),
    __metadata("design:type", Number)
], ExportRule.prototype, "priceAddition", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'title_prefix', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], ExportRule.prototype, "titlePrefix", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'title_suffix', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], ExportRule.prototype, "titleSuffix", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'fulfillment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ExportRule.prototype, "fulfillmentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'payment_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ExportRule.prototype, "paymentPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'return_policy_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ExportRule.prototype, "returnPolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'schedule_cron',
        type: 'varchar',
        length: 50,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ExportRule.prototype, "scheduleCron", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'auto_publish', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ExportRule.prototype, "autoPublish", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'active' }),
    __metadata("design:type", String)
], ExportRule.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_run_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ExportRule.prototype, "lastRunAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_run_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ExportRule.prototype, "lastRunCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_exported', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ExportRule.prototype, "totalExported", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ExportRule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ExportRule.prototype, "updatedAt", void 0);
exports.ExportRule = ExportRule = __decorate([
    (0, typeorm_1.Entity)('export_rules'),
    (0, typeorm_1.Index)('idx_export_rule_store', ['storeId']),
    (0, typeorm_1.Index)('idx_export_rule_status', ['status']),
    (0, typeorm_1.Index)('idx_export_rule_org', ['organizationId'])
], ExportRule);
//# sourceMappingURL=export-rule.entity.js.map