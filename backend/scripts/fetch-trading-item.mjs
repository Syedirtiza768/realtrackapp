import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "/app/dist/src/app.module.js";
import { EbayTradingApiService } from "/app/dist/src/channels/ebay/ebay-trading-api.service.js";
import { Store } from "/app/dist/src/channels/entities/store.entity.js";
import { getRepositoryToken } from "@nestjs/typeorm";
import fs from "fs";

const ITEM_ID = "306948051287";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const storeRepo = app.get(getRepositoryToken(Store));
  const stores = await storeRepo.find({
    where: { channel: "ebay", status: "active" },
  });
  console.log(`Found ${stores.length} active eBay stores`);

  const tradingService = app.get(EbayTradingApiService);

  let lastErr;
  for (const store of stores) {
    try {
      console.log(`\nTrying store: ${store.storeName} (${store.id})...`);
      const details = await tradingService.getItemDetails(store.id, ITEM_ID);
      console.log("\n=== TRADING API GetItem Result ===\n");
      console.log(JSON.stringify(details, null, 2));

      fs.writeFileSync(
        "/tmp/trading-api-result.json",
        JSON.stringify(details, null, 2)
      );
      console.log("\nSaved to /tmp/trading-api-result.json");
      break;
    } catch (err) {
      lastErr = err;
      console.error(`  Failed: ${err.message}`);
    }
  }

  if (lastErr && !fs.existsSync("/tmp/trading-api-result.json")) {
    console.error("\nAll stores failed. Last error:", lastErr?.message);
  }

  await app.close();
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
