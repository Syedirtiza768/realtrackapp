import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from './app.module.js';
import { EbayAuthService } from './channels/ebay/ebay-auth.service.js';
import { EbayInventoryApiService } from './channels/ebay/ebay-inventory-api.service.js';
import { resolveMarketplaceId } from './channels/ebay/ebay-marketplace-headers.util.js';
import { Store } from './channels/entities/store.entity.js';
import type { Repository } from 'typeorm';

const STORE_ID = 'd16199c4-55b5-429e-ad27-892bed94e00d';
const CORRECT_FULFILLMENT_POLICY_ID = '268965917019';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const auth = app.get(EbayAuthService);
  const inventoryApi = app.get(EbayInventoryApiService);
  const storeRepo = app.get<Repository<Store>>(getRepositoryToken(Store));

  const store = await storeRepo.findOneBy({ id: STORE_ID });
  if (!store) {
    console.error(`Store ${STORE_ID} not found`);
    await app.close();
    return;
  }

  console.log(
    `Store: ${store.storeName}, marketplace: ${resolveMarketplaceId(store)}`,
  );

  const token = await auth.getAccessToken(store.id);
  console.log(`Got access token (len=${token.length})`);

  const allOffers = [];
  let offset = 0;
  const limit = 200;
  let total = 0;

  do {
    const result = await inventoryApi.getOffers(store.id, { limit, offset });
    allOffers.push(...result.offers);
    total = result.total;
    offset += limit;
    if (allOffers.length % 1000 === 0 || allOffers.length >= total) {
      console.log(`Fetched ${allOffers.length}/${total} offers...`);
    }
  } while (offset < total && allOffers.length < total);

  console.log(`Total offers fetched: ${allOffers.length}`);

  const targetOffers = allOffers.filter(
    (o) =>
      o.sku?.endsWith('IGBC') &&
      o.listingPolicies?.fulfillmentPolicyId !== CORRECT_FULFILLMENT_POLICY_ID,
  );

  console.log(
    `Found ${targetOffers.length} offers with IGBC SKU and wrong fulfillment policy`,
  );

  if (targetOffers.length === 0) {
    console.log('No offers to update. Exiting.');
    await app.close();
    return;
  }

  for (const o of targetOffers.slice(0, 10)) {
    console.log(
      `  SKU=${o.sku}, offerId=${o.offerId}, ` +
        `currentFulfillment=${o.listingPolicies?.fulfillmentPolicyId ?? 'N/A'}`,
    );
  }

  let success = 0;
  let failed = 0;

  for (const offer of targetOffers) {
    try {
      const newPolicies = {
        ...offer.listingPolicies,
        fulfillmentPolicyId: CORRECT_FULFILLMENT_POLICY_ID,
      };

      await inventoryApi.updateOffer(store.id, offer.offerId, {
        ...offer,
        listingPolicies: newPolicies,
      });

      await inventoryApi.publishOffer(store.id, offer.offerId);

      console.log(`  OK ${offer.sku} (${offer.offerId})`);
      success++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${offer.sku} (${offer.offerId}): ${msg}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} updated, ${failed} failed`);
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
