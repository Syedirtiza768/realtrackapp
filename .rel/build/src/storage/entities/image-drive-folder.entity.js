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
exports.ImageDriveFolder = void 0;
const typeorm_1 = require("typeorm");
const image_drive_asset_entity_js_1 = require("./image-drive-asset.entity.js");
let ImageDriveFolder = class ImageDriveFolder {
    id;
    name;
    nameNormalized;
    s3Prefix;
    linkedPartNumber;
    linkedPartNumberNormalized;
    fileCount;
    totalSizeBytes;
    assets;
    createdAt;
    updatedAt;
};
exports.ImageDriveFolder = ImageDriveFolder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ImageDriveFolder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ImageDriveFolder.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'name_normalized', type: 'text' }),
    __metadata("design:type", String)
], ImageDriveFolder.prototype, "nameNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 's3_prefix', type: 'text' }),
    __metadata("design:type", String)
], ImageDriveFolder.prototype, "s3Prefix", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'linked_part_number',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ImageDriveFolder.prototype, "linkedPartNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'linked_part_number_normalized',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ImageDriveFolder.prototype, "linkedPartNumberNormalized", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ImageDriveFolder.prototype, "fileCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_size_bytes', type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], ImageDriveFolder.prototype, "totalSizeBytes", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => image_drive_asset_entity_js_1.ImageDriveAsset, (asset) => asset.folder),
    __metadata("design:type", Array)
], ImageDriveFolder.prototype, "assets", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ImageDriveFolder.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ImageDriveFolder.prototype, "updatedAt", void 0);
exports.ImageDriveFolder = ImageDriveFolder = __decorate([
    (0, typeorm_1.Entity)('image_drive_folders'),
    (0, typeorm_1.Index)('idx_image_drive_folders_name_normalized', ['nameNormalized'], {
        unique: true,
    })
], ImageDriveFolder);
//# sourceMappingURL=image-drive-folder.entity.js.map