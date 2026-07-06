import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { EbayMvlImportService } from '../fitment/ebay-mvl-import.service.js';

async function main() {
  const args = process.argv.slice(2);
  const directoryArg = args.find((arg) => !arg.startsWith('--'));
  const force = args.includes('--force');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const importer = app.get(EbayMvlImportService);
    const directory = directoryArg || undefined;
    const resolved = importer.resolveAllowedDirectory(directory);
    console.log(`Importing eBay MVL workbooks from: ${resolved}`);

    const summary = await importer.importDirectory(resolved, { force });
    for (const item of summary.imported) {
      console.log(
        `[${item.marketplace}] ${item.fileName} → ${item.entryCount} entries` +
          (item.skippedDuplicate ? ' (skipped duplicate)' : ''),
      );
    }
    for (const err of summary.errors) {
      console.error(`[ERROR] ${err.file}: ${err.error}`);
    }

    if (summary.errors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
