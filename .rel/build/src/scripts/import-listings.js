"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const listings_service_1 = require("../listings/listings.service");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    try {
        const listingsService = app.get(listings_service_1.ListingsService);
        const folder = process.env.LISTINGS_FOLDER_PATH ??
            '../files/_same_structure_as_B20_eBay_Verified_2-Oct';
        const result = await listingsService.importFromFolder(folder);
        console.log('Import completed:', result);
    }
    finally {
        await app.close();
    }
}
void run();
//# sourceMappingURL=import-listings.js.map