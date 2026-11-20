"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerpunditMarketplaceRegistry = void 0;
exports.inferMarketplaceFromAccountName = inferMarketplaceFromAccountName;
const common_1 = require("@nestjs/common");
const SITE_BY_MARKETPLACE = {
    EBAY_US: 'EBAY_US',
    EBAY_MOTORS_US: 'EBAY_MOTORS_US',
    EBAY_GB: 'EBAY_GB',
    EBAY_DE: 'EBAY_DE',
    EBAY_AU: 'EBAY_AU',
};
const DEFAULT_MARKETPLACES = [
    'EBAY_US',
    'EBAY_MOTORS_US',
    'EBAY_DE',
    'EBAY_GB',
    'EBAY_AU',
];
const SVG_REGION_TO_MARKETPLACE = {
    DE: 'EBAY_DE',
    UK: 'EBAY_GB',
    AU: 'EBAY_AU',
    US: 'EBAY_US',
};
function inferMarketplaceFromAccountName(accountName) {
    const trimmed = accountName.trim();
    if (!trimmed)
        return null;
    const svg = trimmed.match(/\(\s*SVG-([A-Z]{2})\s*\)/i);
    if (svg) {
        const mp = SVG_REGION_TO_MARKETPLACE[svg[1].toUpperCase()];
        if (mp)
            return mp;
    }
    if (/\bAutos?\s+De\b/i.test(trimmed))
        return 'EBAY_DE';
    if (/\bBlackline\s+Uk\b/i.test(trimmed) || /\bUk\b$/i.test(trimmed)) {
        return 'EBAY_GB';
    }
    if (/\bautos?\s*au\b/i.test(trimmed) || /\bAU\b/.test(trimmed)) {
        return 'EBAY_AU';
    }
    return null;
}
let SellerpunditMarketplaceRegistry = class SellerpunditMarketplaceRegistry {
    siteIdFor(marketplaceId) {
        return SITE_BY_MARKETPLACE[marketplaceId] ?? 'EBAY_US';
    }
    defaultMarketplacesForImport() {
        return [...DEFAULT_MARKETPLACES];
    }
    inferMarketplaceFromAccountName(accountName) {
        return inferMarketplaceFromAccountName(accountName);
    }
    resolveMarketplaceForAccount(accountName, fallbackMarketplaceId) {
        return (inferMarketplaceFromAccountName(accountName)?.trim() ||
            fallbackMarketplaceId.trim() ||
            'EBAY_MOTORS_US');
    }
    countryForSite(siteId) {
        if (siteId.includes('GB'))
            return 'GB';
        if (siteId.includes('DE'))
            return 'DE';
        if (siteId.includes('AU'))
            return 'AU';
        return 'US';
    }
    currencyForMarketplace(marketplaceId) {
        if (marketplaceId === 'EBAY_GB')
            return 'GBP';
        if (marketplaceId === 'EBAY_DE')
            return 'EUR';
        if (marketplaceId === 'EBAY_AU')
            return 'AUD';
        return 'USD';
    }
};
exports.SellerpunditMarketplaceRegistry = SellerpunditMarketplaceRegistry;
exports.SellerpunditMarketplaceRegistry = SellerpunditMarketplaceRegistry = __decorate([
    (0, common_1.Injectable)()
], SellerpunditMarketplaceRegistry);
//# sourceMappingURL=sellerpundit-marketplace.registry.js.map