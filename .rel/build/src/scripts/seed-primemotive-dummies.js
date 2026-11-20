"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const data_source_js_1 = __importDefault(require("../data-source.js"));
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_published_listing_entity_js_1 = require("../published-listings/entities/ebay-published-listing.entity.js");
async function main() {
    const organizationId = process.argv[2]?.trim() ||
        process.env.PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID?.trim();
    if (!organizationId) {
        throw new Error('Pass an organization UUID or set PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID');
    }
    await data_source_js_1.default.initialize();
    try {
        const accounts = await data_source_js_1.default.getRepository(connected_ebay_account_entity_js_1.ConnectedEbayAccount).find({
            where: { organizationId },
            relations: ['primaryStore'],
        });
        const matchingAccounts = accounts.filter((account) => account.primaryStore?.channel === 'ebay' &&
            account.primaryStore.storeName.trim().toLowerCase() === 'primemotive');
        const storeIds = new Set(matchingAccounts.map((account) => account.primaryStoreId));
        if (storeIds.size !== 1) {
            throw new Error(`Expected one Primemotive eBay store for organization ${organizationId}; found ${storeIds.size}`);
        }
        const storeId = [...storeIds][0];
        const account = matchingAccounts.find((item) => item.primaryStoreId === storeId);
        if (!account) {
            throw new Error(`No connected eBay account owns Primemotive store ${storeId}`);
        }
        const store = account.primaryStore;
        const listingRepo = data_source_js_1.default.getRepository(ebay_published_listing_entity_js_1.EbayPublishedListing);
        const now = new Date();
        const listings = [];
        for (let index = 1; index <= 10; index += 1) {
            const serial = String(index).padStart(2, '0');
            const ebayItemId = `SIM-PRIME-${serial}`;
            const existing = await listingRepo.findOne({
                where: {
                    ebayAccountId: account.id,
                    marketplaceId: store.ebayMarketplaceId ?? 'EBAY_MOTORS_US',
                    ebayItemId,
                },
            });
            if (existing && !existing.isTestListing) {
                throw new Error(`Refusing to overwrite non-test listing ${ebayItemId} (${existing.id})`);
            }
            const listing = Object.assign(existing ?? new ebay_published_listing_entity_js_1.EbayPublishedListing(), {
                organizationId,
                ebayAccountId: account.id,
                storeId,
                marketplaceId: store.ebayMarketplaceId ?? 'EBAY_MOTORS_US',
                ebayItemId,
                offerId: null,
                sku: `PM-SIM-${serial}`,
                title: `TEST LISTING: Mercedes-Benz integration sample ${serial}`,
                description: 'Synthetic listing for Primemotive API integration testing.',
                categoryId: null,
                categoryName: 'Integration test sample',
                price: (40 + index * 7.5).toFixed(2),
                currency: 'USD',
                quantityAvailable: 5,
                quantitySold: 0,
                listingStatus: 'active',
                listingFormat: 'fixed_price',
                condition: 'Used',
                listingUrl: null,
                imageUrls: [],
                itemSpecifics: {
                    Brand: ['Mercedes-Benz'],
                    'Test Listing': ['Synthetic integration record'],
                },
                shippingDetails: null,
                listingPolicies: null,
                compatibility: null,
                performanceMetrics: {},
                healthFlags: [],
                location: null,
                rawEbayResponse: null,
                accountDisplayName: account.accountDisplayName,
                ebayStartTime: now,
                ebayEndTime: null,
                ebayLastModifiedAt: now,
                lastSyncedAt: now,
                catalogProductId: null,
                ebayListingChannelId: null,
                isTestListing: true,
            });
            listings.push(listing);
        }
        await listingRepo.save(listings);
        console.log(`Ensured ${listings.length} synthetic Primemotive listing rows for organization ${organizationId} and store ${store.storeName}. No eBay API calls were made.`);
    }
    finally {
        await data_source_js_1.default.destroy();
    }
}
main().catch((error) => {
    console.error('Failed to seed Primemotive test listings:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=seed-primemotive-dummies.js.map