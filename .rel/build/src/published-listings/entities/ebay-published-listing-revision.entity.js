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
exports.EbayPublishedListingRevision = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const user_entity_js_1 = require("../../auth/entities/user.entity.js");
const connected_ebay_account_entity_js_1 = require("../../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_published_listing_entity_js_1 = require("./ebay-published-listing.entity.js");
let EbayPublishedListingRevision = class EbayPublishedListingRevision {
    id;
    organizationId;
    organization;
    publishedListingId;
    publishedListing;
    ebayAccountId;
    ebayAccount;
    userId;
    user;
    actionType;
    ebayItemId;
    beforeValue;
    afterValue;
    apiResult;
    apiError;
    createdAt;
};
exports.EbayPublishedListingRevision = EbayPublishedListingRevision;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayPublishedListingRevision.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingRevision.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], EbayPublishedListingRevision.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingRevision.prototype, "publishedListingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_published_listing_entity_js_1.EbayPublishedListing, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'published_listing_id' }),
    __metadata("design:type", ebay_published_listing_entity_js_1.EbayPublishedListing)
], EbayPublishedListingRevision.prototype, "publishedListing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingRevision.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayPublishedListingRevision.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingRevision.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_js_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", Object)
], EbayPublishedListingRevision.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'action_type', type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], EbayPublishedListingRevision.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'ebay_item_id',
        type: 'varchar',
        length: 100,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayPublishedListingRevision.prototype, "ebayItemId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'before_value', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingRevision.prototype, "beforeValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'after_value', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingRevision.prototype, "afterValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'api_result', type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], EbayPublishedListingRevision.prototype, "apiResult", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'api_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingRevision.prototype, "apiError", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListingRevision.prototype, "createdAt", void 0);
exports.EbayPublishedListingRevision = EbayPublishedListingRevision = __decorate([
    (0, typeorm_1.Entity)('ebay_published_listing_revisions'),
    (0, typeorm_1.Index)('idx_epl_rev_listing', ['publishedListingId']),
    (0, typeorm_1.Index)('idx_epl_rev_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_epl_rev_created', ['createdAt'])
], EbayPublishedListingRevision);
//# sourceMappingURL=ebay-published-listing-revision.entity.js.map