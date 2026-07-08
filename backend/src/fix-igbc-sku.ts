import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AppModule } from './app.module.js';
import { EbayInventoryApiService } from './channels/ebay/ebay-inventory-api.service.js';
import { EbayPublishService } from './channels/ebay/ebay-publish.service.js';
import { PublishedListingsSyncService } from './published-listings/services/published-listings-sync.service.js';
import { EbayPublishedListing } from './published-listings/entities/ebay-published-listing.entity.js';
import { ListingRecord } from './listings/listing-record.entity.js';
import { Store } from './channels/entities/store.entity.js';

const SKU_SUFFIX = 'IGBC';
const APPLY = process.argv.includes('--apply');
const ORGANIZATION_ID = process.argv
  .find((a) => a.startsWith('--org='))
  ?.split('=')[1];
const STORE_ID = process.argv.find((a) => a.startsWith('--store='))?.split('=')[1];

const MARKETPLACE_DOMAIN: Record<string, string> = {
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

function buildListingUrl(marketplaceId: string, ebayItemId: string): string {
  const domain = MARKETPLACE_DOMAIN[marketplaceId] || 'www.ebay.com';
  return `https://${domain}/itm/${ebayItemId}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const publishService = app.get(EbayPublishService);
  const inventoryApi = app.get(EbayInventoryApiService);
  const syncService = app.get(PublishedListingsSyncService);
  const publishedRepo = app.get<Repository<EbayPublishedListing>>(
    getRepositoryToken(EbayPublishedListing),
  );
  const listingRepo = app.get<Repository<ListingRecord>>(
    getRepositoryToken(ListingRecord),
  );
  const storeRepo = app.get<Repository<Store>>(getRepositoryToken(Store));

  try {
    const qb = publishedRepo
      .createQueryBuilder('p')
      .where('p.sku LIKE :suffix', { suffix: `%${SKU_SUFFIX}` });

    if (ORGANIZATION_ID) {
      qb.andWhere('p.organization_id = :orgId', {
        orgId: ORGANIZATION_ID,
      });
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
      const oldSku = target.sku!;
      const cleanSku = oldSku.slice(0, -SKU_SUFFIX.length);

      const prefix = `[${i + 1}/${targets.length}] ${oldSku} → ${cleanSku}`;

      const listingRecord = await listingRepo.findOne({
        where: {
          customLabelSku: cleanSku,
          organizationId: target.organizationId,
          deletedAt: IsNull(),
        },
      });

      if (!listingRecord) {
        console.log(`${prefix}: SKIP — no listing_record for clean SKU`);
        skipped++;
        continue;
      }

      const store = await storeRepo.findOneBy({ id: target.storeId });
      if (!store) {
        console.log(`${prefix}: SKIP — store ${target.storeId} not found`);
        skipped++;
        continue;
      }

      if (!APPLY) {
        console.log(`${prefix}: Would republish with clean SKU and end old listing`);
        continue;
      }

      try {
        // 1. Publish the listing again using the clean SKU.
        const results = await publishService.publishByListingIds(
          [listingRecord.id],
          [target.storeId],
        );
        const result = results[0]?.results[0];

        if (!result || !result.success) {
          throw new Error(result?.error ?? 'publishByListingIds failed');
        }

        const newOfferId = result.offerId!;
        const newListingId = result.listingId!;

        console.log(
          `${prefix}: Republished offerId=${newOfferId} listingId=${newListingId}`,
        );

        // 2. End and clean up the old IGBC offer/inventory item.
        try {
          if (target.offerId) {
            await inventoryApi.withdrawOffer(target.storeId, target.offerId);
            await inventoryApi.deleteOffer(target.storeId, target.offerId);
          }
          await inventoryApi.deleteItem(target.storeId, oldSku);
          console.log(`${prefix}: Old offer ${target.offerId ?? 'N/A'} + inventory item removed`);
        } catch (cleanupErr) {
          const msg =
            cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
          console.warn(`${prefix}: Old listing cleanup warning (non-fatal): ${msg}`);
        }

        // 3. Update the local published-listing row to point at the clean SKU.
        target.sku = cleanSku;
        target.offerId = newOfferId;
        target.ebayItemId = newListingId;
        target.listingUrl = buildListingUrl(target.marketplaceId, newListingId);
        target.lastSyncedAt = new Date();
        await publishedRepo.save(target);

        // 4. Refresh the row from eBay to ensure all cached fields are current.
        try {
          await syncService.syncListingById(target.id, target.organizationId);
        } catch (syncErr) {
          const msg =
            syncErr instanceof Error ? syncErr.message : String(syncErr);
          console.warn(`${prefix}: Post-publish sync warning (non-fatal): ${msg}`);
        }

        success++;
        await sleep(500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${prefix}: FAIL — ${msg}`);
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

bootstrap().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
