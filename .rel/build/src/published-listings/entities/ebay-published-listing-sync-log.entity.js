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
exports.EbayPublishedListingSyncLog = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
let EbayPublishedListingSyncLog = class EbayPublishedListingSyncLog {
    id;
    organizationId;
    organization;
    ebayAccountId;
    ebayAccount;
    marketplaceId;
    trigger;
    status;
    triggeredByUserId;
    triggeredByUser;
    startedAt;
    completedAt;
    itemsProcessed;
    itemsCreated;
    itemsUpdated;
    itemsFailed;
    errors;
    warnings;
};
exports.EbayPublishedListingSyncLog = EbayPublishedListingSyncLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayPublishedListingSyncLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingSyncLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayPublishedListingSyncLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingSyncLog.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayPublishedListingSyncLog.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'marketplace_id',
        type: 'varchar',
        length: 30,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayPublishedListingSyncLog.prototype, "marketplaceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'manual' }),
    __metadata("design:type", String)
], EbayPublishedListingSyncLog.prototype, "trigger", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], EbayPublishedListingSyncLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'triggered_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingSyncLog.prototype, "triggeredByUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'triggered_by_user_id' }),
    __metadata("design:type", Object)
], EbayPublishedListingSyncLog.prototype, "triggeredByUser", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'started_at',
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    }),
    __metadata("design:type", Date)
], EbayPublishedListingSyncLog.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingSyncLog.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'items_processed', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingSyncLog.prototype, "itemsProcessed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'items_created', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingSyncLog.prototype, "itemsCreated", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'items_updated', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingSyncLog.prototype, "itemsUpdated", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'items_failed', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingSyncLog.prototype, "itemsFailed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], EbayPublishedListingSyncLog.prototype, "errors", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => "'[]'" }),
    __metadata("design:type", Array)
], EbayPublishedListingSyncLog.prototype, "warnings", void 0);
exports.EbayPublishedListingSyncLog = EbayPublishedListingSyncLog = __decorate([
    (0, typeorm_1.Entity)('ebay_published_listing_sync_logs'),
    (0, typeorm_1.Index)('idx_epl_sync_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_epl_sync_account', ['ebayAccountId']),
    (0, typeorm_1.Index)('idx_epl_sync_started', ['startedAt'])
], EbayPublishedListingSyncLog);
//# sourceMappingURL=ebay-published-listing-sync-log.entity.js.map