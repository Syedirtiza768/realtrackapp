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
exports.ListingTemplate = void 0;
const typeorm_1 = require("typeorm");
let ListingTemplate = class ListingTemplate {
    id;
    name;
    description;
    channel;
    category;
    templateType;
    content;
    css;
    previewImage;
    variables;
    isDefault;
    active;
    createdAt;
    updatedAt;
};
exports.ListingTemplate = ListingTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ListingTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 200 }),
    __metadata("design:type", String)
], ListingTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], ListingTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 30, nullable: true }),
    __metadata("design:type", Object)
], ListingTemplate.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 100, nullable: true }),
    __metadata("design:type", Object)
], ListingTemplate.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 30, default: 'description' }),
    __metadata("design:type", String)
], ListingTemplate.prototype, "templateType", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], ListingTemplate.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], ListingTemplate.prototype, "css", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], ListingTemplate.prototype, "previewImage", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: [] }),
    __metadata("design:type", Array)
], ListingTemplate.prototype, "variables", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: false }),
    __metadata("design:type", Boolean)
], ListingTemplate.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: true }),
    __metadata("design:type", Boolean)
], ListingTemplate.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingTemplate.prototype, "updatedAt", void 0);
exports.ListingTemplate = ListingTemplate = __decorate([
    (0, typeorm_1.Entity)({ name: 'listing_templates' })
], ListingTemplate);
//# sourceMappingURL=listing-template.entity.js.map