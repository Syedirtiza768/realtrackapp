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
exports.EbayPublishedListingChange = void 0;
const typeorm_1 = require("typeorm");
let EbayPublishedListingChange = class EbayPublishedListingChange {
    id;
    sequence;
    organizationId;
    storeId;
    listingId;
    eventType;
    listingSnapshot;
    occurredAt;
    deliveryAttempts;
    nextAttemptAt;
    deliveredAt;
    lastDeliveryError;
    createdAt;
};
exports.EbayPublishedListingChange = EbayPublishedListingChange;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayPublishedListingChange.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingChange.prototype, "sequence", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingChange.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingChange.prototype, "storeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingChange.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_type', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], EbayPublishedListingChange.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_snapshot', type: 'jsonb' }),
    __metadata("design:type", Object)
], EbayPublishedListingChange.prototype, "listingSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'occurred_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListingChange.prototype, "occurredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_attempts', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], EbayPublishedListingChange.prototype, "deliveryAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_attempt_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListingChange.prototype, "nextAttemptAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivered_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingChange.prototype, "deliveredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_delivery_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingChange.prototype, "lastDeliveryError", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListingChange.prototype, "createdAt", void 0);
exports.EbayPublishedListingChange = EbayPublishedListingChange = __decorate([
    (0, typeorm_1.Entity)('ebay_published_listing_changes'),
    (0, typeorm_1.Index)('idx_epl_changes_org_store_time', [
        'organizationId',
        'storeId',
        'occurredAt',
    ]),
    (0, typeorm_1.Index)('idx_epl_changes_delivery', ['nextAttemptAt', 'occurredAt'], {
        where: '"delivered_at" IS NULL',
    })
], EbayPublishedListingChange);
//# sourceMappingURL=ebay-published-listing-change.entity.js.map