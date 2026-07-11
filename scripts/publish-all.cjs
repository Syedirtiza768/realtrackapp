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
  const { DataSource } = require('typeorm');

  const publishService = app.get(EbayPublishService);
  const ds = app.get(DataSource);

  try {
    const allListings = await ds.query(
      `SELECT id, "customLabelSku", title, pipeline_job_id
       FROM listing_records
       WHERE pipeline_job_id = ANY($1)
       ORDER BY pipeline_job_id, "customLabelSku"`,
      [PIPELINE_JOBS],
    );
    console.log('Publishing ' + allListings.length + ' listings to K. Salvage Auto Parts (' + K_SALVAGE_STORE_ID + ')');

    let pubSuccess = 0, pubFailed = 0;
    const pubErrors = [];

    await mapWithConcurrency(allListings, async (listing, idx) => {
      for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
          const res = await publishService.publish({
            listingId: listing.id,
            storeIds: [K_SALVAGE_STORE_ID],
          });
          const storeResult = res[0];
          if (storeResult?.success) {
            pubSuccess++;
            if ((idx + 1) % 10 === 0 || idx === 0 || idx < 3) {
              console.log('  [' + (idx + 1) + '/' + allListings.length + '] OK ' + listing.customLabelSku);
            }
            return { success: true };
          } else {
            throw new Error(storeResult?.error || 'Unknown publish error');
          }
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || String(err);
          if (attempt < RETRY_ATTEMPTS && /throttl|rate.limit|timeout|429|500|ECONNRESET/i.test(msg)) {
            console.warn('  [' + (idx + 1) + '] Retry ' + (attempt + 1) + ' for ' + listing.customLabelSku + ': ' + msg);
            await sleep(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
          pubFailed++;
          pubErrors.push({ sku: listing.customLabelSku, error: msg });
          if (pubFailed <= 30) {
            console.error('  [' + (idx + 1) + '] FAIL ' + listing.customLabelSku + ': ' + msg);
          }
          return { success: false, error: msg };
        }
      }
    }, CONCURRENCY);

    console.log('\n=== PUBLISH RESULTS ===');
    console.log('Success: ' + pubSuccess + '/' + allListings.length);
    console.log('Failed: ' + pubFailed + '/' + allListings.length);
    if (pubErrors.length > 0) {
      console.log('\nErrors (' + pubErrors.length + '):');
      for (const e of pubErrors.slice(0, 30)) {
        console.log('  ' + e.sku + ': ' + e.error);
      }
      if (pubErrors.length > 30) console.log('  ... and ' + (pubErrors.length - 30) + ' more');
    }
  } catch (err) {
    console.error('FATAL:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
