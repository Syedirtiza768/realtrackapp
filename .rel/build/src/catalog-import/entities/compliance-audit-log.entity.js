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
exports.ComplianceAuditLog = void 0;
const typeorm_1 = require("typeorm");
let ComplianceAuditLog = class ComplianceAuditLog {
    id;
    productId;
    importId;
    action;
    field;
    originalValue;
    newValue;
    reason;
    severity;
    complianceScore;
    autoFixed;
    createdAt;
};
exports.ComplianceAuditLog = ComplianceAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ComplianceAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ComplianceAuditLog.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'import_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ComplianceAuditLog.prototype, "importId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], ComplianceAuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ComplianceAuditLog.prototype, "field", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'original_value', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ComplianceAuditLog.prototype, "originalValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'new_value', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ComplianceAuditLog.prototype, "newValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ComplianceAuditLog.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'info' }),
    __metadata("design:type", String)
], ComplianceAuditLog.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'compliance_score',
        type: 'numeric',
        precision: 5,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ComplianceAuditLog.prototype, "complianceScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'auto_fixed', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ComplianceAuditLog.prototype, "autoFixed", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ComplianceAuditLog.prototype, "createdAt", void 0);
exports.ComplianceAuditLog = ComplianceAuditLog = __decorate([
    (0, typeorm_1.Entity)('compliance_audit_logs'),
    (0, typeorm_1.Index)('idx_compliance_audit_product', ['productId']),
    (0, typeorm_1.Index)('idx_compliance_audit_import', ['importId']),
    (0, typeorm_1.Index)('idx_compliance_audit_action', ['action'])
], ComplianceAuditLog);
//# sourceMappingURL=compliance-audit-log.entity.js.map