/**
 * Script to end/withdraw an eBay offer.
 * Run inside Docker: docker exec realtrackapp-backend-1 node /app/scripts/end-ebay-offer.cjs
 */
const { NestFactory } = require('@nestjs/core');

const STORE_ID = '0637e7b7-816f-4a3a-a065-b11933a1fc33'; // Blackline Autos
const OFFER_ID = '188698282011';

async function main() {
  const { AppModule } = await import('/app/dist/app.module.js');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const { EbayPublishService } = await import('/app/dist/channels/ebay/ebay-publish.service.js');
  const publishService = app.get(EbayPublishService);

  try {
    console.log(`Withdrawing offer ${OFFER_ID} from store Blackline Autos (${STORE_ID})...`);
    await publishService.endListing(STORE_ID, OFFER_ID);
    console.log(`Successfully ended listing with offer ${OFFER_ID}`);
  } catch (err) {
    console.error('Failed to end listing:', err?.response?.data || err?.message || err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
