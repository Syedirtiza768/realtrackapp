import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ListingsService } from '../listings/listings.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const listingsService = app.get(ListingsService);
    const folder =
      process.env.LISTINGS_FOLDER_PATH ??
      '../files/_same_structure_as_B20_eBay_Verified_2-Oct';

    const result = await listingsService.importFromFolder(folder);
    // eslint-disable-next-line no-console
    console.log('Import completed:', result);
  } finally {
    await app.close();
  }
}

void run();
