const { NestFactory } = require('@nestjs/core');

const JOB = '572e96dd-d1e5-4a8f-bdd4-1ee25e809677';
const STORE_ID = 'd16199c4-55b5-429e-ad27-892bed94e00d';
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
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const { EbayPublishService } = await import('/app/dist/src/channels/ebay/ebay-publish.service.js');
  const { DataSource } = require('typeorm');

  const publishService = app.get(EbayPublishService);
  const ds = app.get(DataSource);

  try {
    // Find listings that have NOT been published yet (no eBay listing ID)
    const listings = await ds.query(
      `SELECT id, "customLabelSku", title, "categoryId", "conditionId"
       FROM listing_records
       WHERE pipeline_job_id = $1
         AND ("ebayListingId" IS NULL OR "ebayListingId" = '')
       ORDER BY "customLabelSku"`,
      [JOB],
    );
    console.log(`Found ${listings.length} unpublished listings for job ${JOB}`);

    if (listings.length === 0) {
      console.log('Nothing to publish — all listings already have eBay IDs.');
      await app.close();
      return;
    }

    let pubSuccess = 0, pubFailed = 0;
    const pubErrors = [];

    await mapWithConcurrency(listings, async (listing, idx) => {
      for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
          const res = await publishService.publish({
            listingId: listing.id,
            storeIds: [STORE_ID],
          });
          const storeResult = res[0];
          if (storeResult?.success) {
            pubSuccess++;
            if ((idx + 1) % 25 === 0 || idx === 0 || idx < 3) {
              console.log(`[${idx + 1}/${listings.length}] OK ${listing.customLabelSku}`);
            }
            return { success: true };
          }
          throw new Error(storeResult?.error || 'Unknown publish error');
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || String(err);
          if (attempt < RETRY_ATTEMPTS && /throttl|rate.limit|timeout|429|500|ECONNRESET/i.test(msg)) {
            console.warn(`[${idx + 1}] Retry ${attempt + 1} for ${listing.customLabelSku}: ${msg}`);
            await sleep(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
          pubFailed++;
          pubErrors.push({ sku: listing.customLabelSku, error: msg });
          if (pubFailed <= 30) {
            console.error(`[${idx + 1}] FAIL ${listing.customLabelSku}: ${msg}`);
          }
          return { success: false, error: msg };
        }
      }
    }, CONCURRENCY);

    console.log(`\n=== PUBLISH RESULTS ===`);
    console.log(`Success: ${pubSuccess}/${listings.length}`);
    console.log(`Failed: ${pubFailed}/${listings.length}`);
    if (pubErrors.length > 0) {
      console.log(`\nErrors (${pubErrors.length}):`);
      const errorGroups = {};
      for (const e of pubErrors) {
        const key = e.error.slice(0, 120);
        errorGroups[key] = (errorGroups[key] || 0) + 1;
      }
      for (const [err, count] of Object.entries(errorGroups).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
        console.log(`  (${count}x) ${err}`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
