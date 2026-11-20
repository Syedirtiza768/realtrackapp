"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsHealthService = void 0;
const common_1 = require("@nestjs/common");
const LOW_STOCK_THRESHOLD = 3;
let PublishedListingsHealthService = class PublishedListingsHealthService {
    computeHealthFlags(input) {
        const flags = [];
        if (!input.imageUrls.length) {
            flags.push({
                code: 'missing_images',
                severity: 'critical',
                message: 'No listing images',
            });
        }
        else if (input.imageUrls.length < 3) {
            flags.push({
                code: 'weak_images',
                severity: 'warning',
                message: 'Fewer than 3 images — add more for better conversion',
            });
        }
        const aspectCount = Object.keys(input.itemSpecifics ?? {}).length;
        if (aspectCount === 0) {
            flags.push({
                code: 'missing_item_specifics',
                severity: 'warning',
                message: 'No item specifics defined',
            });
        }
        if (!input.description?.trim()) {
            flags.push({
                code: 'missing_description',
                severity: 'warning',
                message: 'Listing description is empty',
            });
        }
        const title = (input.title ?? '').trim();
        if (title.length < 20) {
            flags.push({
                code: 'short_title',
                severity: 'warning',
                message: 'Title is very short — consider adding keywords',
            });
        }
        if (title.length > 80) {
            flags.push({
                code: 'long_title',
                severity: 'info',
                message: 'Title exceeds 80 characters — may be truncated in search',
            });
        }
        const compatProducts = input.compatibility?.compatibleProducts ?? [];
        const isMotors = (input.categoryId ?? '').startsWith('33') ||
            (input.categoryId ?? '').startsWith('67');
        if (isMotors && compatProducts.length === 0) {
            flags.push({
                code: 'missing_compatibility',
                severity: 'warning',
                message: 'Motors listing has no vehicle compatibility data',
            });
        }
        if (input.quantityAvailable <= 0) {
            flags.push({
                code: 'out_of_stock',
                severity: 'critical',
                message: 'Out of stock',
            });
        }
        else if (input.quantityAvailable <= LOW_STOCK_THRESHOLD) {
            flags.push({
                code: 'low_stock',
                severity: 'warning',
                message: `Low stock (${input.quantityAvailable} remaining)`,
            });
        }
        const views = Number(input.performanceMetrics?.viewCount ?? 0);
        if (views === 0 && input.quantitySold === 0) {
            flags.push({
                code: 'no_engagement',
                severity: 'info',
                message: 'No views or sales recorded',
            });
        }
        else if (views > 0 && input.quantitySold === 0) {
            flags.push({
                code: 'no_sales',
                severity: 'info',
                message: 'Has views but no sales yet',
            });
        }
        const staleAfterMs = input.syncStaleAfterMs ?? 24 * 60 * 60 * 1000;
        if (input.lastSyncedAt) {
            const syncedAt = new Date(input.lastSyncedAt).getTime();
            if (Number.isFinite(syncedAt) && Date.now() - syncedAt > staleAfterMs) {
                flags.push({
                    code: 'sync_stale',
                    severity: 'warning',
                    message: 'Listing sync is older than the freshness threshold',
                });
            }
        }
        const cp = input.competitorPricing;
        const myPrice = input.price != null ? Number(input.price) : null;
        if (cp?.medianPrice != null && myPrice != null && myPrice > 0) {
            const median = Number(cp.medianPrice);
            if (median > 0) {
                const ratio = myPrice / median;
                if (ratio > 1.15) {
                    flags.push({
                        code: 'price_above_market',
                        severity: 'warning',
                        message: `Price $${myPrice.toFixed(2)} is above market median $${median.toFixed(2)}`,
                    });
                }
                else if (ratio < 0.85) {
                    flags.push({
                        code: 'price_below_market',
                        severity: 'info',
                        message: `Price $${myPrice.toFixed(2)} is below market median $${median.toFixed(2)} — room to increase`,
                    });
                }
            }
        }
        return flags;
    }
    mapOfferStatus(offer) {
        const status = (offer.status ?? '').toUpperCase();
        if (status === 'PUBLISHED' || offer.listingId) {
            if ((offer.availableQuantity ?? 0) <= 0)
                return 'out_of_stock';
            return 'active';
        }
        if (status === 'ENDED' || status === 'WITHDRAWN')
            return 'ended';
        return 'unknown';
    }
    mapOfferFormat(format) {
        const f = (format ?? '').toUpperCase();
        if (f === 'AUCTION')
            return 'auction';
        if (f === 'FIXED_PRICE')
            return 'fixed_price';
        return 'unknown';
    }
    buildListingUrl(listingId, marketplaceId, environment) {
        if (!listingId)
            return null;
        const host = environment === 'production' ? 'www.ebay.com' : 'sandbox.ebay.com';
        const path = marketplaceId.includes('MOTORS') ? 'itm' : 'itm';
        return `https://${host}/${path}/${listingId}`;
    }
    extractFromInventoryItem(item) {
        return {
            title: item.product?.title ?? 'Untitled',
            description: item.product?.description ?? null,
            imageUrls: item.product?.imageUrls ?? [],
            itemSpecifics: item.product?.aspects ?? {},
            condition: item.condition ?? null,
            quantityAvailable: item.availability?.shipToLocationAvailability?.quantity ?? 0,
        };
    }
};
exports.PublishedListingsHealthService = PublishedListingsHealthService;
exports.PublishedListingsHealthService = PublishedListingsHealthService = __decorate([
    (0, common_1.Injectable)()
], PublishedListingsHealthService);
//# sourceMappingURL=published-listings-health.service.js.map