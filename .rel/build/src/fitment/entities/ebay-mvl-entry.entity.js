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
exports.EbayMvlEntry = void 0;
const typeorm_1 = require("typeorm");
const ebay_mvl_release_entity_js_1 = require("./ebay-mvl-release.entity.js");
let EbayMvlEntry = class EbayMvlEntry {
    id;
    releaseId;
    release;
    marketplace;
    epid;
    make;
    model;
    year;
    trim;
    engine;
    submodel;
    variant;
    platform;
    body;
    ktype;
    displayName;
    extras;
};
exports.EbayMvlEntry = EbayMvlEntry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: 'bigint' }),
    __metadata("design:type", String)
], EbayMvlEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'release_id', type: 'uuid' }),
    __metadata("design:type", String)
], EbayMvlEntry.prototype, "releaseId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ebay_mvl_release_entity_js_1.EbayMvlRelease, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'release_id' }),
    __metadata("design:type", ebay_mvl_release_entity_js_1.EbayMvlRelease)
], EbayMvlEntry.prototype, "release", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 4 }),
    __metadata("design:type", String)
], EbayMvlEntry.prototype, "marketplace", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "epid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], EbayMvlEntry.prototype, "make", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], EbayMvlEntry.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint' }),
    __metadata("design:type", Number)
], EbayMvlEntry.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "trim", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "engine", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "submodel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "variant", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "platform", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "ktype", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'display_name',
        type: 'varchar',
        length: 255,
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], EbayMvlEntry.prototype, "extras", void 0);
exports.EbayMvlEntry = EbayMvlEntry = __decorate([
    (0, typeorm_1.Entity)('ebay_mvl_entries'),
    (0, typeorm_1.Index)('idx_ebay_mvl_entries_lookup', ['marketplace', 'make', 'model', 'year']),
    (0, typeorm_1.Index)('idx_ebay_mvl_entries_make', ['marketplace', 'make']),
    (0, typeorm_1.Index)('idx_ebay_mvl_entries_release', ['releaseId'])
], EbayMvlEntry);
//# sourceMappingURL=ebay-mvl-entry.entity.js.map