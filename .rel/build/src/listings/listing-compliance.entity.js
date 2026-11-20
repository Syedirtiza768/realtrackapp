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
exports.ListingCompliance = void 0;
const typeorm_1 = require("typeorm");
const listing_record_entity_js_1 = require("./listing-record.entity.js");
let ListingCompliance = class ListingCompliance {
    id;
    listingId;
    listing;
    productCompliancePolicyId;
    regionalProductCompliancePolicies;
    productSafetyPictograms;
    productSafetyStatements;
    productSafetyComponent;
    regulatoryDocumentIds;
    manufacturerName;
    manufacturerAddressLine1;
    manufacturerAddressLine2;
    manufacturerCity;
    manufacturerCountry;
    manufacturerPostalCode;
    manufacturerStateOrProvince;
    manufacturerPhone;
    manufacturerEmail;
    manufacturerContactUrl;
    responsiblePerson1;
    responsiblePerson1Type;
    responsiblePerson1AddressLine1;
    responsiblePerson1AddressLine2;
    responsiblePerson1City;
    responsiblePerson1Country;
    responsiblePerson1PostalCode;
    responsiblePerson1StateOrProvince;
    responsiblePerson1Phone;
    responsiblePerson1Email;
    responsiblePerson1ContactUrl;
    createdAt;
    updatedAt;
};
exports.ListingCompliance = ListingCompliance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ListingCompliance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'listing_id', type: 'uuid', unique: true }),
    __metadata("design:type", String)
], ListingCompliance.prototype, "listingId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => listing_record_entity_js_1.ListingRecord, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'listing_id' }),
    __metadata("design:type", listing_record_entity_js_1.ListingRecord)
], ListingCompliance.prototype, "listing", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'product_compliance_policy_id',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "productCompliancePolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'regional_product_compliance_policies',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "regionalProductCompliancePolicies", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_safety_pictograms', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "productSafetyPictograms", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_safety_statements', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "productSafetyStatements", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_safety_component', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "productSafetyComponent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'regulatory_document_ids', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "regulatoryDocumentIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_name', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_address_line1', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerAddressLine1", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_address_line2', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerAddressLine2", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_city', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerCity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_country', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerCountry", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_postal_code', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerPostalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'manufacturer_state_or_province',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerStateOrProvince", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_phone', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_email', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'manufacturer_contact_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "manufacturerContactUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_person1', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_person1_type', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1Type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'responsible_person1_address_line1',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1AddressLine1", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'responsible_person1_address_line2',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1AddressLine2", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_person1_city', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1City", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_person1_country', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1Country", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'responsible_person1_postal_code',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1PostalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'responsible_person1_state_or_province',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1StateOrProvince", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_person1_phone', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1Phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_person1_email', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1Email", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'responsible_person1_contact_url',
        type: 'text',
        nullable: true,
    }),
    __metadata("design:type", Object)
], ListingCompliance.prototype, "responsiblePerson1ContactUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingCompliance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingCompliance.prototype, "updatedAt", void 0);
exports.ListingCompliance = ListingCompliance = __decorate([
    (0, typeorm_1.Entity)({ name: 'listing_compliance' }),
    (0, typeorm_1.Index)('idx_compliance_listing', ['listingId'])
], ListingCompliance);
//# sourceMappingURL=listing-compliance.entity.js.map