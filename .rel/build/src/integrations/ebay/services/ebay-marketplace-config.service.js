"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayMarketplaceConfigService = void 0;
const common_1 = require("@nestjs/common");
let EbayMarketplaceConfigService = class EbayMarketplaceConfigService {
    configs = {
        EBAY_US: {
            marketplaceId: 'EBAY_US',
            currency: 'USD',
            locale: 'en_US',
            categoryTreeId: '0',
            defaultLanguage: 'en',
            supportsMotorsFitment: true,
            requiresLocalizedDescription: false,
        },
        EBAY_MOTORS_US: {
            marketplaceId: 'EBAY_MOTORS_US',
            currency: 'USD',
            locale: 'en_US',
            categoryTreeId: '0',
            defaultLanguage: 'en',
            supportsMotorsFitment: true,
            requiresLocalizedDescription: false,
        },
        EBAY_GB: {
            marketplaceId: 'EBAY_GB',
            currency: 'GBP',
            locale: 'en_GB',
            categoryTreeId: '3',
            defaultLanguage: 'en',
            supportsMotorsFitment: false,
            requiresLocalizedDescription: false,
        },
        EBAY_DE: {
            marketplaceId: 'EBAY_DE',
            currency: 'EUR',
            locale: 'de_DE',
            categoryTreeId: '77',
            defaultLanguage: 'de',
            supportsMotorsFitment: false,
            requiresLocalizedDescription: true,
        },
        EBAY_AU: {
            marketplaceId: 'EBAY_AU',
            currency: 'AUD',
            locale: 'en_AU',
            categoryTreeId: '15',
            defaultLanguage: 'en',
            supportsMotorsFitment: true,
            requiresLocalizedDescription: false,
        },
    };
    all() {
        return Object.values(this.configs);
    }
    get(marketplaceId) {
        return this.configs[marketplaceId] ?? null;
    }
    require(marketplaceId) {
        const c = this.get(marketplaceId);
        if (!c) {
            throw new Error(`Unsupported marketplace: ${marketplaceId}`);
        }
        return c;
    }
};
exports.EbayMarketplaceConfigService = EbayMarketplaceConfigService;
exports.EbayMarketplaceConfigService = EbayMarketplaceConfigService = __decorate([
    (0, common_1.Injectable)()
], EbayMarketplaceConfigService);
//# sourceMappingURL=ebay-marketplace-config.service.js.map