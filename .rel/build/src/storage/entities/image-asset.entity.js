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
exports.ImageAsset = void 0;
const typeorm_1 = require("typeorm");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
let ImageAsset = class ImageAsset {
    id;
    listingId;
    listing;
    jobId;
    s3Bucket;
    s3Key;
    s3KeyThumb;
    s3KeyMedium;
    cdnUrl;
    originalFilename;
    mimeType;
    fileSizeBytes;
    width;
    height;
    blurhash;
    sortOrder;
    isPrimary;
    uploadedAt;
    deletedAt;
};
exports.ImageAsset = ImageAsset;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ImageAsset.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => listing_record_entity_js_1.ListingRecord, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], ImageAsset.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'job_id', type: 'uuid', nullable: true }),
    (0, typeorm_1.Index)('idx_image_job'),
    __metadata("design:type", Object)
], ImageAsset.prototype, "jobId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_bucket', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ImageAsset.prototype, "s3Bucket", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_key', type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], ImageAsset.prototype, "s3Key", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 's3_key_thumb',
        type: 'varchar',
        length: 500,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "s3KeyThumb", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 's3_key_medium',
        type: 'varchar',
        length: 500,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "s3KeyMedium", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cdn_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "cdnUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'original_filename', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "originalFilename", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], ImageAsset.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_size_bytes', type: 'bigint' }),
    __metadata("design:type", Number)
], ImageAsset.prototype, "fileSizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "width", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "height", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "blurhash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sort_order', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ImageAsset.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_primary', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ImageAsset.prototype, "isPrimary", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'uploaded_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ImageAsset.prototype, "uploadedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ImageAsset.prototype, "deletedAt", void 0);
exports.ImageAsset = ImageAsset = __decorate([
    (0, typeorm_1.Entity)('image_assets'),
    (0, typeorm_1.Index)('idx_image_listing', ['listingId'], { where: '"deleted_at" IS NULL' }),
    (0, typeorm_1.Index)('idx_image_s3', ['s3Bucket', 's3Key'], { unique: true })
], ImageAsset);
//# sourceMappingURL=image-asset.entity.js.map