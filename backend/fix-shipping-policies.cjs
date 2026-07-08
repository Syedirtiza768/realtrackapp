const { NestFactory } = require('@nestjs/core');
const { getDataSourceToken } = require('@nestjs/typeorm');
const { AppModule } = require('./dist/src/app.module.js');
const { EbayInventoryApiService } = require('./dist/src/channels/ebay/ebay-inventory-api.service.js');

const STORE_ID = 'd16199c4-55b5-429e-ad27-892bed94e00d';
const PIPELINE_JOB_ID = '8fe03707-e368-4657-b8b8-790974bfbd3c';
const SKU_SUFFIX = 'IGBC';
const CORRECT_FULFILLMENT_POLICY_ID = '268965917019';
const CORRECT_PAYMENT_POLICY_ID = '264471151019';
const CORRECT_RETURN_POLICY_ID = '264471195019';
const APPLY = process.argv.includes('--apply');
const SCAN_DELAY_MS = 200;
const UPDATE_DELAY_MS = 400;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const inventoryApi = app.get(EbayInventoryApiService);
    const dataSource = app.get(getDataSourceToken());

    // Step 1: Get all catalog product SKUs for this pipeline job
    const rows = await dataSource.query(
      'SELECT sku FROM catalog_products WHERE pipeline_job_id = $1 ORDER BY sku',
      [PIPELINE_JOB_ID],
    );
    const catalogSkus = rows.map((r) => r.sku);
    console.log('Catalog product SKUs for pipeline: ' + catalogSkus.length);
    console.log('Mode: ' + (APPLY ? 'APPLY (will update + republish)' : 'DRY-RUN (read-only)'));
    console.log('Target fulfillment policy: ' + CORRECT_FULFILLMENT_POLICY_ID);
    console.log('');

    // Step 2: Scan each SKU for a published offer with missing/wrong policies
    const targets = [];
    let notFound = 0;
    let alreadyCorrect = 0;

    for (let i = 0; i < catalogSkus.length; i++) {
      const ebaySku = catalogSkus[i] + SKU_SUFFIX;
      try {
        const result = await inventoryApi.getOffersBySku(STORE_ID, ebaySku, 25, 0);
        if (result.offers.length === 0) {
          notFound++;
        } else {
          for (const o of result.offers) {
            const fp = o.listingPolicies?.fulfillmentPolicyId;
            const pp = o.listingPolicies?.paymentPolicyId;
            const rp = o.listingPolicies?.returnPolicyId;
            const isPublished = o.status === 'PUBLISHED' || o.listing?.listingId;
            const needsFix =
              fp !== CORRECT_FULFILLMENT_POLICY_ID ||
              pp !== CORRECT_PAYMENT_POLICY_ID ||
              rp !== CORRECT_RETURN_POLICY_ID;
            if (needsFix) {
              targets.push({
                sku: o.sku,
                offerId: o.offerId,
                listingId: o.listing?.listingId || null,
                status: o.status,
                currentFulfillment: fp || null,
                currentPayment: pp || null,
                currentReturn: rp || null,
                published: isPublished,
                fullOffer: o,
              });
            } else {
              alreadyCorrect++;
            }
          }
        }
      } catch (err) {
        // 404 = no offer for this SKU
        if (err?.response?.status === 404) {
          notFound++;
        } else {
          console.error('  ERROR scanning ' + ebaySku + ': ' + (err.message || err));
        }
      }

      if ((i + 1) % 50 === 0 || i === catalogSkus.length - 1) {
        console.log('Scanned ' + (i + 1) + '/' + catalogSkus.length +
          ' — targets so far: ' + targets.length +
          ', not found: ' + notFound + ', already correct: ' + alreadyCorrect);
      }
      await sleep(SCAN_DELAY_MS);
    }

    console.log('');
    console.log('=== SCAN RESULTS ===');
    console.log('Total catalog SKUs scanned: ' + catalogSkus.length);
    console.log('Offers found needing policy fix: ' + targets.length);
    console.log('Offers already correct: ' + alreadyCorrect);
    console.log('SKUs with no offer: ' + notFound);

    if (targets.length === 0) {
      console.log('\nNo offers need fixing. Done.');
      return;
    }

    // Print all targets
    console.log('\nTargets:');
    for (const t of targets) {
      console.log('  ' + t.sku +
        ' | offerId=' + t.offerId +
        ' | listingId=' + (t.listingId || 'N/A') +
        ' | status=' + t.status +
        ' | fulfillment=' + (t.currentFulfillment || 'NONE') +
        ' | payment=' + (t.currentPayment || 'NONE') +
        ' | return=' + (t.currentReturn || 'NONE'));
    }

    if (!APPLY) {
      console.log('\nDRY RUN complete. ' + targets.length + ' offers need policy update + republish.');
      console.log('Re-run with --apply to execute.');
      return;
    }

    // Step 3: Update + republish each target
    let success = 0;
    let failed = 0;
    console.log('\n=== APPLYING FIXES ===');

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      try {
        const newPolicies = {
          ...t.fullOffer.listingPolicies,
          fulfillmentPolicyId: CORRECT_FULFILLMENT_POLICY_ID,
          paymentPolicyId: CORRECT_PAYMENT_POLICY_ID,
          returnPolicyId: CORRECT_RETURN_POLICY_ID,
        };

        await inventoryApi.updateOffer(STORE_ID, t.offerId, {
          ...t.fullOffer,
          listingPolicies: newPolicies,
        });

        await inventoryApi.publishOffer(STORE_ID, t.offerId);

        console.log('  [' + (i + 1) + '/' + targets.length + '] OK ' + t.sku +
          ' (offerId=' + t.offerId + ', listingId=' + (t.listingId || 'N/A') + ')');
        success++;
        await sleep(UPDATE_DELAY_MS);
      } catch (err) {
        const msg = err?.response?.data
          ? JSON.stringify(err.response.data)
          : (err.message || String(err));
        console.error('  [' + (i + 1) + '/' + targets.length + '] FAIL ' + t.sku +
          ' (offerId=' + t.offerId + '): ' + msg);
        failed++;
      }
    }

    console.log('\n=== DONE ===');
    console.log('Updated + republished: ' + success);
    console.log('Failed: ' + failed);
    console.log('Total targets: ' + targets.length);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  if (err && err.response && err.response.data) {
    console.error('eBay API error:', JSON.stringify(err.response.data, null, 2));
  } else {
    console.error('Fatal error:', err.message || err);
  }
  process.exit(1);
});
