/**
 * End all published eBay listings for two pipeline jobs, then re-publish
 * all listings to K. Salvage Auto Parts.
 *
 * Run inside Docker:
 *   docker exec realtrackapp-backend-1 node /app/scripts/end-and-republish.cjs
 */
const { NestFactory } = require('@nestjs/core');

const K_SALVAGE_STORE_ID = 'eed3dbd6-9967-43ac-ad4e-6d5081cfb9b0';
const PIPELINE_JOBS = [
  '68ec8a5b-ac0a-4a68-969d-ea14067f90af',
  'c30b5ee5-e04a-4ab8-8fe4-c568feea281e',
];
const CONCURRENCY = 3;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function mapWithConcurrency(items, fn, concurrency) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const { AppModule } = await import('/app/dist/src/app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const { EbayPublishService } = await import('/app/dist/src/channels/ebay/ebay-publish.service.js');
  const { EbayInventoryApiService } = await import('/app/dist/src/channels/ebay/ebay-inventory-api.service.js');
  const { DataSource } = require('typeorm');

  const publishService = app.get(EbayPublishService);
  const inventoryApi = app.get(EbayInventoryApiService);
  const ds = app.get(DataSource);

  try {
    // ═══════════════════════════════════════════════════
    // PHASE 1: End all published eBay listings
    // ═══════════════════════════════════════════════════
    console.log('\n=== PHASE 1: Ending published eBay listings ===');

    const liveRows = await ds.query(
      `SELECT id, "customLabelSku", "ebayListingId", pipeline_job_id
       FROM listing_records
       WHERE pipeline_job_id = ANY($1)
         AND "ebayListingId" IS NOT NULL AND "ebayListingId" <> ''`,
      [PIPELINE_JOBS],
    );
    console.log(`Found ${liveRows.length} listings with live eBay IDs`);

    let ended = 0, endFailed = 0;
    for (const row of liveRows) {
      const sku = row.customLabelSku;
      try {
        // Find all offers for this SKU on K. Salvage
        const { offers } = await inventoryApi.getOffersBySku(K_SALVAGE_STORE_ID, sku);
        for (const offer of offers) {
          if (!offer.offerId) continue;
          try {
            if (offer.status === 'PUBLISHED') {
              await inventoryApi.withdrawOffer(K_SALVAGE_STORE_ID, offer.offerId);
              console.log(`  Withdrew offer ${offer.offerId} for ${sku}`);
            }
            await inventoryApi.deleteOffer(K_SALVAGE_STORE_ID, offer.offerId);
            console.log(`  Deleted offer ${offer.offerId} for ${sku}`);
          } catch (offerErr) {
            console.warn(`  Could not end offer ${offer.offerId} for ${sku}: ${offerErr?.message || offerErr}`);
          }
        }
        // Delete inventory item
        try {
          await inventoryApi.deleteItem(K_SALVAGE_STORE_ID, sku);
        } catch { /* may not exist */ }

        // Clear eBay state on listing record
        await ds.query(
          `UPDATE listing_records
           SET "ebayListingId" = NULL, status = 'draft', "publishedAt" = NULL, "updatedAt" = NOW()
           WHERE id = $1`,
          [row.id],
        );
        ended++;
        console.log(`  ✓ Ended ${sku} (was ${row.ebayListingId})`);
      } catch (err) {
        endFailed++;
        console.error(`  ✗ Failed to end ${sku}: ${err?.message || err}`);
      }
    }

    // Also clear catalog_products
    await ds.query(
      `UPDATE catalog_products
       SET status = 'draft', "publishedAt" = NULL, "updatedAt" = NOW()
       WHERE pipeline_job_id = ANY($1)`,
      [PIPELINE_JOBS],
    );

    console.log(`\nPhase 1 complete: ${ended} ended, ${endFailed} failed`);

    // ═══════════════════════════════════════════════════
    // PHASE 2: Publish all listings to K. Salvage Auto Parts
    // ═══════════════════════════════════════════════════
    console.log('\n=== PHASE 2: Publishing all listings to K. Salvage Auto Parts ===');

    const allListings = await ds.query(
      `SELECT id, "customLabelSku", title, pipeline_job_id
       FROM listing_records
       WHERE pipeline_job_id = ANY($1)
       ORDER BY pipeline_job_id, "customLabelSku"`,
      [PIPELINE_JOBS],
    );
    console.log(`Found ${allListings.length} listings to publish`);

    let pubSuccess = 0, pubFailed = 0, pubErrors = [];
    const results = await mapWithConcurrency(allListings, async (listing, idx) => {
      for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
          const res = await publishService.publish({
            listingId: listing.id,
            storeIds: [K_SALVAGE_STORE_ID],
          });
          const storeResult = res[0];
          if (storeResult?.success) {
            pubSuccess++;
            if ((idx + 1) % 10 === 0 || idx === 0) {
              console.log(`  [${idx + 1}/${allListings.length}] ✓ ${listing.customLabelSku}`);
            }
            return { success: true };
          } else {
            throw new Error(storeResult?.error || 'Unknown publish error');
          }
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || String(err);
          if (attempt < RETRY_ATTEMPTS && /throttl|rate.limit|timeout|429|500|ECONNRESET/i.test(msg)) {
            console.warn(`  [${idx + 1}] Retry ${attempt + 1} for ${listing.customLabelSku}: ${msg}`);
            await sleep(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
          pubFailed++;
          pubErrors.push({ sku: listing.customLabelSku, error: msg });
          if (pubFailed <= 20) {
            console.error(`  [${idx + 1}] ✗ ${listing.customLabelSku}: ${msg}`);
          }
          return { success: false, error: msg };
        }
      }
    }, CONCURRENCY);

    console.log(`\n=== RESULTS ===`);
    console.log(`Phase 1: ${ended} ended, ${endFailed} failed`);
    console.log(`Phase 2: ${pubSuccess} published, ${pubFailed} failed`);
    if (pubErrors.length > 0) {
      console.log(`\nFirst 20 publish errors:`);
      for (const e of pubErrors.slice(0, 20)) {
        console.log(`  ${e.sku}: ${e.error}`);
      }
    }
  } catch (err) {
    console.error('FATAL:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
