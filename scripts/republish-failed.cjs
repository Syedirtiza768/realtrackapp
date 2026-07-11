const { NestFactory } = require('@nestjs/core');

const K_SALVAGE_STORE_ID = 'eed3dbd6-9967-43ac-ad4e-6d5081cfb9b0';
const FAILED_SKUS = [
  'LEX-IS-1277-SU-BBB','LEX-IS-1277-SU-DDD','LEX-IS-1277-SU-EEE','LEX-IS-1277-SU-FFF',
  'LEX-IS-1277-SU-GGG','LEX-IS-1277-SU-HHH','LEX-IS-1277-SU-III','LEX-IS-1277-SU-RR',
  'LEX-IS-1277-SU-SS','LEX-IS-1277-SU-TT','LEX-IS-1277-SU-UU','LEX-IS-1277-SU-VV',
  'LEX-IS-1277-SU-XX','LEX-IS-1277-SU-ZZ',
  'BMW-35i-2687-AI-J',
  'LEX-IS-1277-SHEET1-CONSOLE',
];

async function main() {
  const { AppModule } = await import('/app/dist/src/app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const { EbayPublishService } = await import('/app/dist/src/channels/ebay/ebay-publish.service.js');
  const { EbayInventoryApiService } = await import('/app/dist/src/channels/ebay/ebay-inventory-api.service.js');
  const { DataSource } = require('typeorm');
  const publishService = app.get(EbayPublishService);
  const inventoryApi = app.get(EbayInventoryApiService);
  const ds = app.get(DataSource);

  try {
    // Phase 1: Purge stale offers for all failed SKUs
    console.log('=== PURGING STALE OFFERS ===');
    for (const sku of FAILED_SKUS) {
      try {
        const { offers } = await inventoryApi.getOffersBySku(K_SALVAGE_STORE_ID, sku);
        for (const offer of offers) {
          if (!offer.offerId) continue;
          try {
            if (offer.status === 'PUBLISHED') await inventoryApi.withdrawOffer(K_SALVAGE_STORE_ID, offer.offerId);
            await inventoryApi.deleteOffer(K_SALVAGE_STORE_ID, offer.offerId);
            console.log('  Purged offer ' + offer.offerId + ' for ' + sku);
          } catch {}
        }
        try { await inventoryApi.deleteItem(K_SALVAGE_STORE_ID, sku); } catch {}
      } catch {}
    }

    // Phase 2: Republish
    console.log('\n=== REPUBLISHING 16 FAILED LISTINGS ===');
    let ok = 0, fail = 0;
    for (const sku of FAILED_SKUS) {
      const rows = await ds.query(
        `SELECT id FROM listing_records WHERE "customLabelSku" = $1 AND pipeline_job_id IN ($2,$3)`,
        [sku, '68ec8a5b-ac0a-4a68-969d-ea14067f90af', 'c30b5ee5-e04a-4ab8-8fe4-c568feea281e'],
      );
      if (!rows.length) { console.log('  SKIP ' + sku + ' (not found)'); continue; }
      try {
        const res = await publishService.publish({ listingId: rows[0].id, storeIds: [K_SALVAGE_STORE_ID] });
        if (res[0]?.success) { ok++; console.log('  OK ' + sku); }
        else { fail++; console.log('  FAIL ' + sku + ': ' + (res[0]?.error || 'unknown')); }
      } catch (err) {
        fail++;
        console.log('  FAIL ' + sku + ': ' + (err?.message || err));
      }
    }
    console.log('\n=== RESULTS: ' + ok + ' OK, ' + fail + ' FAILED ===');
  } finally { await app.close(); }
}
main();
