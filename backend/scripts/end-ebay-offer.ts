/**
 * Script to end/withdraw an eBay offer.
 * Run from backend dir: node --import tsx scripts/end-ebay-offer.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { EbayPublishService } from '../src/channels/ebay/ebay-publish.service.js';

const STORE_ID = '55be0485-4c29-4a3f-b6d1-213b1ab524d7'; // Blackline Autos
const OFFER_ID = '188698282011';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const publishService = app.get(EbayPublishService);

  try {
    console.log(`Withdrawing offer ${OFFER_ID} from store Blackline Autos (${STORE_ID})...`);
    await publishService.endListing(STORE_ID, OFFER_ID);
    console.log(`Successfully ended listing with offer ${OFFER_ID}`);
  } catch (err: any) {
    console.error('Failed to end listing:', err?.response?.data || err?.message || err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
