import 'dotenv/config';
import dataSource from '../data-source.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from '../published-listings/entities/ebay-published-listing.entity.js';

async function main(): Promise<void> {
  const organizationId =
    process.argv[2]?.trim() ||
    process.env.PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID?.trim();
  if (!organizationId) {
    throw new Error(
      'Pass an organization UUID or set PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID',
    );
  }

  await dataSource.initialize();
  try {
    const accounts = await dataSource.getRepository(ConnectedEbayAccount).find({
      where: { organizationId },
      relations: ['primaryStore'],
    });
    const matchingAccounts = accounts.filter(
      (account) =>
        account.primaryStore?.channel === 'ebay' &&
        account.primaryStore.storeName.trim().toLowerCase() === 'primemotive',
    );
    const storeIds = new Set(
      matchingAccounts.map((account) => account.primaryStoreId),
    );
    if (storeIds.size !== 1) {
      throw new Error(
        `Expected one Primemotive eBay store for organization ${organizationId}; found ${storeIds.size}`,
      );
    }
    const storeId = [...storeIds][0];
    const account = matchingAccounts.find(
      (item) => item.primaryStoreId === storeId,
    );
    if (!account) {
      throw new Error(
        `No connected eBay account owns Primemotive store ${storeId}`,
      );
    }
    const store = account.primaryStore;
    const listingRepo = dataSource.getRepository(EbayPublishedListing);
    const now = new Date();
    const listings: EbayPublishedListing[] = [];

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
        throw new Error(
          `Refusing to overwrite non-test listing ${ebayItemId} (${existing.id})`,
        );
      }

      const listing = Object.assign(existing ?? new EbayPublishedListing(), {
        organizationId,
        ebayAccountId: account.id,
        storeId,
        marketplaceId: store.ebayMarketplaceId ?? 'EBAY_MOTORS_US',
        ebayItemId,
        offerId: null,
        sku: `PM-SIM-${serial}`,
        title: `TEST LISTING: Mercedes-Benz integration sample ${serial}`,
        description:
          'Synthetic listing for Primemotive API integration testing.',
        categoryId: null,
        categoryName: 'Integration test sample',
        price: (40 + index * 7.5).toFixed(2),
        currency: 'USD',
        quantityAvailable: 5,
        quantitySold: 0,
        listingStatus: 'active' as const,
        listingFormat: 'fixed_price' as const,
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
    console.log(
      `Ensured ${listings.length} synthetic Primemotive listing rows for organization ${organizationId} and store ${store.storeName}. No eBay API calls were made.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Failed to seed Primemotive test listings:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
