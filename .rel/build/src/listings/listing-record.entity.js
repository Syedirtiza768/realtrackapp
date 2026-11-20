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
exports.ListingRecord = exports.ListingOrigin = void 0;
const typeorm_1 = require("typeorm");
var ListingOrigin;
(function (ListingOrigin) {
    ListingOrigin["ADD_PART"] = "add_part";
    ListingOrigin["PIPELINE_IMPORT"] = "pipeline_import";
})(ListingOrigin || (exports.ListingOrigin = ListingOrigin = {}));
let ListingRecord = class ListingRecord {
    id;
    organizationId;
    vertical;
    verticalAttributes;
    sourceFileName;
    sourceFilePath;
    sheetName;
    sourceRowNumber;
    origin;
    importedAt;
    action;
    customLabelSku;
    categoryId;
    categoryName;
    title;
    relationship;
    relationshipDetails;
    scheduleTime;
    pUpc;
    pEpid;
    startPrice;
    quantity;
    itemPhotoUrl;
    conditionId;
    description;
    format;
    duration;
    buyItNowPrice;
    bestOfferEnabled;
    bestOfferAutoAcceptPrice;
    minimumBestOfferPrice;
    immediatePayRequired;
    location;
    shippingService1Option;
    shippingService1Cost;
    shippingService1Priority;
    shippingService2Option;
    shippingService2Cost;
    shippingService2Priority;
    maxDispatchTime;
    returnsAcceptedOption;
    returnsWithinOption;
    refundOption;
    returnShippingCostPaidBy;
    shippingProfileName;
    returnProfileName;
    paymentProfileName;
    productCompliancePolicyId;
    regionalProductCompliancePolicies;
    cBrand;
    cType;
    cItemHeight;
    cItemLength;
    cItemWidth;
    cItemDiameter;
    cFeatures;
    cManufacturerPartNumber;
    cOeOemPartNumber;
    cMaterial;
    cPlacement;
    countryOfOrigin;
    conditionLabel;
    cOperatingMode;
    cFuelType;
    cDriveType;
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
    startPriceNum;
    quantityNum;
    buyItNowPriceNum;
    bestOfferAutoAcceptPriceNum;
    minimumBestOfferPriceNum;
    shippingService1CostNum;
    shippingService2CostNum;
    weight;
    pipelineJobId;
    teamId;
    marketplace;
    status;
    version;
    deletedAt;
    updatedAt;
    updatedBy;
    publishedAt;
    ebayListingId;
    shopifyProductId;
    enrichmentStage;
    enrichmentRetryCount;
    enrichmentLastFailureReason;
    enrichmentLastFailureAt;
    enrichmentNextRetryAt;
    enrichmentPermanentFail;
    extractedMake;
    extractedModel;
    searchVector;
};
exports.ListingRecord = ListingRecord;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ListingRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "vertical", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vertical_attributes', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "verticalAttributes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ListingRecord.prototype, "sourceFileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ListingRecord.prototype, "sourceFilePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: 'Listings' }),
    __metadata("design:type", String)
], ListingRecord.prototype, "sheetName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ListingRecord.prototype, "sourceRowNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], ListingRecord.prototype, "origin", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingRecord.prototype, "importedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "customLabelSku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "categoryName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "relationship", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "relationshipDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "scheduleTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "pUpc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "pEpid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "startPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "itemPhotoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "conditionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "format", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "buyItNowPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "bestOfferEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "bestOfferAutoAcceptPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "minimumBestOfferPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "immediatePayRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService1Option", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService1Cost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService1Priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService2Option", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService2Cost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService2Priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "maxDispatchTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "returnsAcceptedOption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "returnsWithinOption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "refundOption", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "returnShippingCostPaidBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingProfileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "returnProfileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "paymentProfileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "productCompliancePolicyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "regionalProductCompliancePolicies", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cBrand", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cItemHeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cItemLength", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cItemWidth", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cItemDiameter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cFeatures", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cManufacturerPartNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cOeOemPartNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cMaterial", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cPlacement", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_of_origin', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "countryOfOrigin", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'condition_label', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "conditionLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cOperatingMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cFuelType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "cDriveType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "productSafetyPictograms", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "productSafetyStatements", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "productSafetyComponent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "regulatoryDocumentIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerAddressLine1", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerAddressLine2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerCity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerCountry", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerPostalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerStateOrProvince", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "manufacturerContactUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1Type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1AddressLine1", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1AddressLine2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1City", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1Country", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1PostalCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1StateOrProvince", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1Phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1Email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "responsiblePerson1ContactUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "startPriceNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "quantityNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "buyItNowPriceNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "bestOfferAutoAcceptPriceNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "minimumBestOfferPriceNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService1CostNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shippingService2CostNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 3, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "weight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pipeline_job_id', type: 'uuid', nullable: true }),
    (0, typeorm_1.Index)('idx_listing_pipeline_job'),
    __metadata("design:type", Object)
], ListingRecord.prototype, "pipelineJobId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'team_id', type: 'uuid', nullable: true }),
    (0, typeorm_1.Index)('idx_listing_team'),
    __metadata("design:type", Object)
], ListingRecord.prototype, "teamId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, nullable: true }),
    (0, typeorm_1.Index)('idx_listing_marketplace'),
    __metadata("design:type", Object)
], ListingRecord.prototype, "marketplace", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], ListingRecord.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], ListingRecord.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ListingRecord.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "publishedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "ebayListingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "shopifyProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    (0, typeorm_1.Index)('idx_listing_enrichment_stage'),
    __metadata("design:type", Object)
], ListingRecord.prototype, "enrichmentStage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ListingRecord.prototype, "enrichmentRetryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "enrichmentLastFailureReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "enrichmentLastFailureAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    (0, typeorm_1.Index)('idx_listing_enrichment_next_retry', { synchronize: false }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "enrichmentNextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ListingRecord.prototype, "enrichmentPermanentFail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, typeorm_1.Index)('idx_listing_extracted_make'),
    __metadata("design:type", Object)
], ListingRecord.prototype, "extractedMake", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    (0, typeorm_1.Index)('idx_listing_extracted_model'),
    __metadata("design:type", Object)
], ListingRecord.prototype, "extractedModel", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'tsvector',
        nullable: true,
        select: false,
    }),
    __metadata("design:type", Object)
], ListingRecord.prototype, "searchVector", void 0);
exports.ListingRecord = ListingRecord = __decorate([
    (0, typeorm_1.Entity)({ name: 'listing_records' }),
    (0, typeorm_1.Unique)('uq_listing_source_row', [
        'sourceFileName',
        'sheetName',
        'sourceRowNumber',
    ]),
    (0, typeorm_1.Index)('idx_listing_sku', ['customLabelSku']),
    (0, typeorm_1.Index)('idx_listing_category_id', ['categoryId']),
    (0, typeorm_1.Index)('idx_listing_title', ['title']),
    (0, typeorm_1.Index)('idx_listing_brand', ['cBrand']),
    (0, typeorm_1.Index)('idx_listing_condition', ['conditionId']),
    (0, typeorm_1.Index)('idx_listing_c_type', ['cType']),
    (0, typeorm_1.Index)('idx_listing_source_file', ['sourceFileName']),
    (0, typeorm_1.Index)('idx_listing_records_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_listing_origin', ['origin'])
], ListingRecord);
//# sourceMappingURL=listing-record.entity.js.map