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
exports.EbayMvlRelease = void 0;
const typeorm_1 = require("typeorm");
let EbayMvlRelease = class EbayMvlRelease {
    id;
    marketplace;
    versionLabel;
    fileName;
    fileSha256;
    sourceRowCount;
    entryCount;
    status;
    errorMessage;
    importedAt;
    createdAt;
};
exports.EbayMvlRelease = EbayMvlRelease;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayMvlRelease.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 4 }),
    __metadata("design:type", String)
], EbayMvlRelease.prototype, "marketplace", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'version_label', type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], EbayMvlRelease.prototype, "versionLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], EbayMvlRelease.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_sha256', type: 'char', length: 64 }),
    __metadata("design:type", String)
], EbayMvlRelease.prototype, "fileSha256", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_row_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], EbayMvlRelease.prototype, "sourceRowCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'entry_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], EbayMvlRelease.prototype, "entryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'importing' }),
    __metadata("design:type", String)
], EbayMvlRelease.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EbayMvlRelease.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'imported_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayMvlRelease.prototype, "importedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayMvlRelease.prototype, "createdAt", void 0);
exports.EbayMvlRelease = EbayMvlRelease = __decorate([
    (0, typeorm_1.Entity)('ebay_mvl_releases'),
    (0, typeorm_1.Index)('idx_ebay_mvl_releases_marketplace_status', ['marketplace', 'status'])
], EbayMvlRelease);
//# sourceMappingURL=ebay-mvl-release.entity.js.map