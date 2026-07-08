'use strict';

const { NestFactory } = require('@nestjs/core');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { IsNull } = require('typeorm');

const { AppModule } = require('./dist/src/app.module.js');
const { EbayInventoryApiService } = require('./dist/src/channels/ebay/ebay-inventory-api.service.js');
const { EbayPublishService } = require('./dist/src/channels/ebay/ebay-publish.service.js');
const { PublishedListingsSyncService } = require('./dist/src/published-listings/services/published-listings-sync.service.js');
const { EbayPublishedListing } = require('./dist/src/published-listings/entities/ebay-published-listing.entity.js');
const { ListingRecord } = require('./dist/src/listings/listing-record.entity.js');
const { Store } = require('./dist/src/channels/entities/store.entity.js');

const SKU_SUFFIX = 'IGBC';
const APPLY = process.argv.includes('--apply');
const rawOrgArg = process.argv.find((a) => a.startsWith('--org='));
const ORGANIZATION_ID = rawOrgArg ? rawOrgArg.split('=')[1] : undefined;
const rawStoreArg = process.argv.find((a) => a.startsWith('--store='));
const STORE_ID = rawStoreArg ? rawStoreArg.split('=')[1] : undefined;

const MARKETPLACE_DOMAIN = {
  EBAY_US: 'www.ebay.com',
  EBAY_MOTORS_US: 'www.ebay.com',
  EBAY_CA: 'www.ebay.ca',
  EBAY_GB: 'www.ebay.co.uk',
  EBAY_DE: 'www.ebay.de',
  EBAY_AU: 'www.ebay.com.au',
  EBAY_FR: 'www.ebay.fr',
  EBAY_ES: 'www.ebay.es',
  EBAY_IT: 'www.ebay.it',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildListingUrl(marketplaceId, ebayItemId) {
  const domain = MARKETPLACE_DOMAIN[marketplaceId] || 'www.ebay.com';
  return `https://${domain}/itm/${ebayItemId}`;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const publishService = app.get(EbayPublishService);
  const inventoryApi = app.get(EbayInventoryApiService);
  const syncService = app.get(PublishedListingsSyncService);
  const publishedRepo = app.get(getRepositoryToken(EbayPublishedListing));
  const listingRepo = app.get(getRepositoryToken(ListingRecord));
  const storeRepo = app.get(getRepositoryToken(Store));

  try {
    const qb = publishedRepo
      .createQueryBuilder('p')
      .where('p.sku LIKE :suffix', { suffix: `%${SKU_SUFFIX}` });

    if (ORGANIZATION_ID) {
      qb.andWhere('p.organization_id = :orgId', { orgId: ORGANIZATION_ID });
    }
    if (STORE_ID) {
      qb.andWhere('p.store_id = :storeId', { storeId: STORE_ID });
    }

    const targets = await qb.getMany();

    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
    console.log(`Targets found: ${targets.length}`);

    if (targets.length === 0) {
      console.log('No IGBC-suffixed published listings to process.');
      await app.close();
      return;
    }

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const oldSku = target.sku;
      const cleanSku = oldSku.slice(0, -SKU_SUFFIX.length);

      const prefix = `[${i + 1}/${targets.length}] ${oldSku} -> ${cleanSku}`;

      const listingRecord = await listingRepo.findOne({
        where: {
          customLabelSku: cleanSku,
          organizationId: target.organizationId,
          deletedAt: IsNull(),
        },
      });

      if (!listingRecord) {
        console.log(`${prefix}: SKIP - no listing_record for clean SKU`);
        skipped++;
        continue;
      }

      const store = await storeRepo.findOneBy({ id: target.storeId });
      if (!store) {
        console.log(`${prefix}: SKIP - store ${target.storeId} not found`);
        skipped++;
        continue;
      }

      if (!APPLY) {
        console.log(`${prefix}: Would republish with clean SKU and end old listing`);
        continue;
      }

      try {
        // 1. Republish using the clean SKU.
        const results = await publishService.publishByListingIds(
          [listingRecord.id],
          [target.storeId],
        );
        const result = results[0] && results[0].results[0];

        if (!result || !result.success) {
          throw new Error((result && result.error) || 'publishByListingIds failed');
        }

        const newOfferId = result.offerId;
        const newListingId = result.listingId;

        console.log(
          `${prefix}: Republished offerId=${newOfferId} listingId=${newListingId}`,
        );

        // 2. Withdraw, delete the old offer, then delete the old inventory item.
        try {
          if (target.offerId) {
            await inventoryApi.withdrawOffer(target.storeId, target.offerId);
            await inventoryApi.deleteOffer(target.storeId, target.offerId);
          }
          await inventoryApi.deleteItem(target.storeId, oldSku);
          console.log(
            `${prefix}: Old offer ${target.offerId || 'N/A'} + inventory item removed`,
          );
        } catch (cleanupErr) {
          const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
          console.warn(`${prefix}: Old listing cleanup warning (non-fatal): ${msg}`);
        }

        // 3. Update local row to the clean SKU and new eBay IDs.
        target.sku = cleanSku;
        target.offerId = newOfferId;
        target.ebayItemId = newListingId;
        target.listingUrl = buildListingUrl(target.marketplaceId, newListingId);
        target.lastSyncedAt = new Date();
        await publishedRepo.save(target);

        // 4. Refresh the row from eBay to keep cached fields current.
        try {
          await syncService.syncListingById(target.id, target.organizationId);
        } catch (syncErr) {
          const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
          console.warn(`${prefix}: Post-publish sync warning (non-fatal): ${msg}`);
        }

        success++;
        await sleep(500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${prefix}: FAIL - ${msg}`);
        failed++;
        await sleep(500);
      }
    }

    console.log('\nDone.');
    console.log(`Rebuilt with clean SKU: ${success}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
