"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_js_1 = require("../src/app.module.js");
const ebay_publish_service_js_1 = require("../src/channels/ebay/ebay-publish.service.js");
const STORE_ID = '55be0485-4c29-4a3f-b6d1-213b1ab524d7';
const OFFER_ID = '188698282011';
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    const publishService = app.get(ebay_publish_service_js_1.EbayPublishService);
    try {
        console.log(`Withdrawing offer ${OFFER_ID} from store Blackline Autos (${STORE_ID})...`);
        await publishService.endListing(STORE_ID, OFFER_ID);
        console.log(`Successfully ended listing with offer ${OFFER_ID}`);
    }
    catch (err) {
        console.error('Failed to end listing:', err?.response?.data || err?.message || err);
        process.exitCode = 1;
    }
    finally {
        await app.close();
    }
}
main();
//# sourceMappingURL=end-ebay-offer.js.map