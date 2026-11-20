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
exports.BusinessIndustrialIncident = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_js_1 = require("../../auth/entities/organization.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
let BusinessIndustrialIncident = class BusinessIndustrialIncident {
    id;
    organizationId;
    organization;
    catalogProductId;
    catalogProduct;
    externalEventId;
    incidentType;
    status;
    verified;
    eventOccurredAt;
    detectedAt;
    firstTakedownAttemptAt;
    takedownCompletedAt;
    eventPayload;
    takedownAttempts;
    createdByUserId;
    notes;
    createdAt;
    updatedAt;
};
exports.BusinessIndustrialIncident = BusinessIndustrialIncident;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BusinessIndustrialIncident.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], BusinessIndustrialIncident.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_js_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_js_1.Organization)
], BusinessIndustrialIncident.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'catalog_product_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "catalogProductId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => catalog_product_entity_js_1.CatalogProduct, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'catalog_product_id' }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "catalogProduct", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_event_id', type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], BusinessIndustrialIncident.prototype, "externalEventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'incident_type', type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], BusinessIndustrialIncident.prototype, "incidentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'received' }),
    __metadata("design:type", String)
], BusinessIndustrialIncident.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BusinessIndustrialIncident.prototype, "verified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_occurred_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "eventOccurredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'detected_at',
        type: 'timestamptz',
        default: () => 'CURRENT_TIMESTAMP',
    }),
    __metadata("design:type", Date)
], BusinessIndustrialIncident.prototype, "detectedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'first_takedown_attempt_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "firstTakedownAttemptAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'takedown_completed_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "takedownCompletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_payload', type: 'jsonb', default: '{}' }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "eventPayload", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'takedown_attempts', type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], BusinessIndustrialIncident.prototype, "takedownAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by_user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "createdByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], BusinessIndustrialIncident.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialIncident.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], BusinessIndustrialIncident.prototype, "updatedAt", void 0);
exports.BusinessIndustrialIncident = BusinessIndustrialIncident = __decorate([
    (0, typeorm_1.Entity)('business_industrial_incidents'),
    (0, typeorm_1.Unique)('uq_bi_incident_event', ['organizationId', 'externalEventId']),
    (0, typeorm_1.Index)('idx_bi_incident_org_status', ['organizationId', 'status']),
    (0, typeorm_1.Index)('idx_bi_incident_product', ['catalogProductId'])
], BusinessIndustrialIncident);
//# sourceMappingURL=business-industrial-incident.entity.js.map