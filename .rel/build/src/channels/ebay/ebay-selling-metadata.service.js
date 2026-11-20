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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbaySellingMetadataService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
let EbaySellingMetadataService = class EbaySellingMetadataService {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async getCategoryPolicies(storeId, marketplaceId, categoryId) {
        const token = await this.auth.getAccessToken(storeId);
        const baseUrl = await this.auth.getApiBaseUrlForStore(storeId);
        const http = axios_1.default.create({
            baseURL: `${baseUrl}/sell/metadata/v1`,
            timeout: 20_000,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        });
        const [conditions, structures] = await Promise.all([
            http.get(`/marketplace/${encodeURIComponent(marketplaceId)}/get_item_condition_policies`, {
                params: { category_ids: categoryId },
            }),
            http.get(`/marketplace/${encodeURIComponent(marketplaceId)}/get_listing_structure_policies`, {
                params: { category_ids: categoryId },
            }),
        ]);
        const conditionPolicies = Array.isArray(conditions.data?.itemConditionPolicies)
            ? conditions.data.itemConditionPolicies
            : [];
        const categoryPolicy = conditionPolicies.find((policy) => String(policy.categoryId ?? '') === categoryId) ?? conditionPolicies[0];
        const supportedConditions = Array.isArray(categoryPolicy?.conditionIdValues)
            ? categoryPolicy.conditionIdValues
                .map((value) => String(value.conditionId ?? value.id ?? ''))
                .filter(Boolean)
            : [];
        const structurePolicies = Array.isArray(structures.data?.listingStructurePolicies)
            ? structures.data.listingStructurePolicies
            : [];
        const structure = structurePolicies.find((policy) => String(policy.categoryId ?? '') === categoryId) ?? structurePolicies[0];
        const supportsVariations = typeof structure?.variationsSupported === 'boolean'
            ? structure.variationsSupported
            : typeof structure?.listingStructure === 'string'
                ? /variation/i.test(structure.listingStructure)
                : null;
        return { supportedConditions, supportsVariations };
    }
};
exports.EbaySellingMetadataService = EbaySellingMetadataService;
exports.EbaySellingMetadataService = EbaySellingMetadataService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService])
], EbaySellingMetadataService);
//# sourceMappingURL=ebay-selling-metadata.service.js.map