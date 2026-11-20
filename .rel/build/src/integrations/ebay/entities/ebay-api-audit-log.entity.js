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
exports.EbayApiAuditLog = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let EbayApiAuditLog = class EbayApiAuditLog {
    id;
    organizationId;
    organization;
    ebayAccountId;
    ebayAccount;
    userId;
    user;
    httpMethod;
    apiFamily;
    endpointPath;
    marketplaceId;
    responseStatus;
    ebayErrorId;
    ebayErrorMessage;
    correlationId;
    durationMs;
    requestMetadata;
    createdAt;
};
exports.EbayApiAuditLog = EbayApiAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayApiAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayApiAuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayApiAuditLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, {
        onDelete: 'SET NULL',
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'http_method', type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], EbayApiAuditLog.prototype, "httpMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'api_family', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], EbayApiAuditLog.prototype, "apiFamily", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'endpoint_path', type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], EbayApiAuditLog.prototype, "endpointPath", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'marketplace_id',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'response_status', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "responseStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_error_id',
        type: 'varchar',
        length: 80,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "ebayErrorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "ebayErrorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'correlation_id',
        type: 'varchar',
        length: 120,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "correlationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'duration_ms', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "durationMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'request_metadata', type: 'jsonb', default: () => `'{}'` }),
    __metadata("design:type", Object)
], EbayApiAuditLog.prototype, "requestMetadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayApiAuditLog.prototype, "createdAt", void 0);
exports.EbayApiAuditLog = EbayApiAuditLog = __decorate([
    (0, typeorm_1.Entity)('ebay_api_audit_logs'),
    (0, typeorm_1.Index)('idx_ebay_audit_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_ebay_audit_account', ['ebayAccountId']),
    (0, typeorm_1.Index)('idx_ebay_audit_created', ['createdAt'])
], EbayApiAuditLog);
//# sourceMappingURL=ebay-api-audit-log.entity.js.map