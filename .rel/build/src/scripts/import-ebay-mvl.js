"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_js_1 = require("../app.module.js");
const ebay_mvl_import_service_js_1 = require("../fitment/ebay-mvl-import.service.js");
async function main() {
    const args = process.argv.slice(2);
    const directoryArg = args.find((arg) => !arg.startsWith('--'));
    const force = args.includes('--force');
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    try {
        const importer = app.get(ebay_mvl_import_service_js_1.EbayMvlImportService);
        const directory = directoryArg || undefined;
        const resolved = importer.resolveAllowedDirectory(directory);
        console.log(`Importing eBay MVL workbooks from: ${resolved}`);
        const summary = await importer.importDirectory(resolved, { force });
        for (const item of summary.imported) {
            console.log(`[${item.marketplace}] ${item.fileName} → ${item.entryCount} entries` +
                (item.skippedDuplicate ? ' (skipped duplicate)' : ''));
        }
        for (const err of summary.errors) {
            console.error(`[ERROR] ${err.file}: ${err.error}`);
        }
        if (summary.errors.length > 0) {
            process.exitCode = 1;
        }
    }
    finally {
        await app.close();
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=import-ebay-mvl.js.map