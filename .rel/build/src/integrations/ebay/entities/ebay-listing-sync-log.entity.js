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
exports.EbayListingSyncLog = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../../auth/entities/user.entity.js");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let EbayListingSyncLog = class EbayListingSyncLog {
    id;
    organizationId;
    organization;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    syncType;
    status;
    itemsProcessed;
    itemsUpdated;
    itemsFailed;
    warnings;
    errors;
    rawSummary;
    startedAt;
    finishedAt;
    triggeredByUserId;
    triggeredByUser;
};
exports.EbayListingSyncLog = EbayListingSyncLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayListingSyncLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayListingSyncLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayListingSyncLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayListingSyncLog.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayListingSyncLog.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'marketplace_id',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayListingSyncLog.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sync_type', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], EbayListingSyncLog.prototype, "syncType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], EbayListingSyncLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'items_processed', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayListingSyncLog.prototype, "itemsProcessed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'items_updated', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayListingSyncLog.prototype, "itemsUpdated", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'items_failed', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayListingSyncLog.prototype, "itemsFailed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => `'[]'` }),
    __metadata("design:type", Array)
], EbayListingSyncLog.prototype, "warnings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => `'[]'` }),
    __metadata("design:type", Array)
], EbayListingSyncLog.prototype, "errors", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'raw_summary', type: 'jsonb', default: () => `'{}'` }),
    __metadata("design:type", Object)
], EbayListingSyncLog.prototype, "rawSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'started_at',
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    }),
    __metadata("design:type", Date)
], EbayListingSyncLog.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'finished_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayListingSyncLog.prototype, "finishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'triggered_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayListingSyncLog.prototype, "triggeredByUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'triggered_by_user_id' }),
    __metadata("design:type", Object)
], EbayListingSyncLog.prototype, "triggeredByUser", void 0);
exports.EbayListingSyncLog = EbayListingSyncLog = __decorate([
    (0, typeorm_1.Entity)('ebay_listing_sync_logs'),
    (0, typeorm_1.Index)('idx_ebay_sync_log_account', ['ebayAccountId']),
    (0, typeorm_1.Index)('idx_ebay_sync_log_started', ['startedAt'])
], EbayListingSyncLog);
//# sourceMappingURL=ebay-listing-sync-log.entity.js.map