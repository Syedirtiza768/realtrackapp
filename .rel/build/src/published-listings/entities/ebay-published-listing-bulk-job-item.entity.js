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
exports.EbayPublishedListingBulkJobItem = void 0;
const typeorm_1 = require("typeorm");
const ebay_published_listing_entity_js_1 = require("./ebay-published-listing.entity.js");
const ebay_published_listing_bulk_job_entity_js_1 = require("./ebay-published-listing-bulk-job.entity.js");
let EbayPublishedListingBulkJobItem = class EbayPublishedListingBulkJobItem {
    id;
    bulkJobId;
    bulkJob;
    publishedListingId;
    publishedListing;
    status;
    beforeSnapshot;
    afterSnapshot;
    errorMessage;
    createdAt;
    processedAt;
};
exports.EbayPublishedListingBulkJobItem = EbayPublishedListingBulkJobItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayPublishedListingBulkJobItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bulk_job_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingBulkJobItem.prototype, "bulkJobId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_published_listing_bulk_job_entity_js_1.EbayPublishedListingBulkJob, (j) => j.items, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'bulk_job_id' }),
    __metadata("design:type", ebay_published_listing_bulk_job_entity_js_1.EbayPublishedListingBulkJob)
], EbayPublishedListingBulkJobItem.prototype, "bulkJob", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'published_listing_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayPublishedListingBulkJobItem.prototype, "publishedListingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_published_listing_entity_js_1.EbayPublishedListing, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'published_listing_id' }),
    __metadata("design:type", ebay_published_listing_entity_js_1.EbayPublishedListing)
], EbayPublishedListingBulkJobItem.prototype, "publishedListing", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending' }),
    __metadata("design:type", String)
], EbayPublishedListingBulkJobItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'before_snapshot', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingBulkJobItem.prototype, "beforeSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'after_snapshot', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingBulkJobItem.prototype, "afterSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingBulkJobItem.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayPublishedListingBulkJobItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayPublishedListingBulkJobItem.prototype, "processedAt", void 0);
exports.EbayPublishedListingBulkJobItem = EbayPublishedListingBulkJobItem = __decorate([
    (0, typeorm_1.Entity)('ebay_published_listing_bulk_job_items'),
    (0, typeorm_1.Index)('idx_epl_bulk_item_job', ['bulkJobId']),
    (0, typeorm_1.Index)('idx_epl_bulk_item_listing', ['publishedListingId'])
], EbayPublishedListingBulkJobItem);
//# sourceMappingURL=ebay-published-listing-bulk-job-item.entity.js.map