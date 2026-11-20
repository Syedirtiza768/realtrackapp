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
exports.ImageDriveAsset = void 0;
const typeorm_1 = require("typeorm");
const image_drive_folder_entity_js_1 = require("./image-drive-folder.entity.js");
let ImageDriveAsset = class ImageDriveAsset {
    id;
    folderId;
    folder;
    filename;
    s3Key;
    cdnUrl;
    s3KeyThumb;
    s3KeyMedium;
    mimeType;
    fileSizeBytes;
    width;
    height;
    blurhash;
    createdAt;
    deletedAt;
};
exports.ImageDriveAsset = ImageDriveAsset;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ImageDriveAsset.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'folder_id', type: 'uuid' }),
    __metadata("design:type", String)
], ImageDriveAsset.prototype, "folderId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => image_drive_folder_entity_js_1.ImageDriveFolder, (folder) => folder.assets, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'folder_id' }),
    __metadata("design:type", image_drive_folder_entity_js_1.ImageDriveFolder)
], ImageDriveAsset.prototype, "folder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ImageDriveAsset.prototype, "filename", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_key', type: 'text' }),
    __metadata("design:type", String)
], ImageDriveAsset.prototype, "s3Key", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cdn_url', type: 'text' }),
    __metadata("design:type", String)
], ImageDriveAsset.prototype, "cdnUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_key_thumb', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ImageDriveAsset.prototype, "s3KeyThumb", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_key_medium', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ImageDriveAsset.prototype, "s3KeyMedium", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], ImageDriveAsset.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_size_bytes', type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], ImageDriveAsset.prototype, "fileSizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ImageDriveAsset.prototype, "width", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ImageDriveAsset.prototype, "height", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ImageDriveAsset.prototype, "blurhash", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ImageDriveAsset.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ImageDriveAsset.prototype, "deletedAt", void 0);
exports.ImageDriveAsset = ImageDriveAsset = __decorate([
    (0, typeorm_1.Entity)('image_drive_assets'),
    (0, typeorm_1.Index)('idx_image_drive_assets_folder', ['folderId']),
    (0, typeorm_1.Index)('idx_image_drive_assets_folder_s3key', ['folderId', 's3Key'], {
        unique: true,
        where: '"deleted_at" IS NULL',
    })
], ImageDriveAsset);
//# sourceMappingURL=image-drive-asset.entity.js.map