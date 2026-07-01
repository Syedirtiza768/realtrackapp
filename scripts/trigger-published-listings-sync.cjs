/**
 * One-shot: sync all active eBay accounts (inventory + Trading API fallback).
 * Mounted at /app/scripts in Docker; run: docker compose exec backend node scripts/trigger-published-listings-sync.cjs
 */
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { PublishedListingsSyncService } = require('../dist/src/published-listings/services/published-listings-sync.service.js');
const { ConnectedEbayAccount } = require('../dist/src/integrations/ebay/entities/connected-ebay-account.entity.js');
const { DataSource } = require('typeorm');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const sync = app.get(PublishedListingsSyncService);
    const ds = app.get(DataSource);
    const accounts = await ds.getRepository(ConnectedEbayAccount).find({
      where: { connectionStatus: 'active' },
      order: { accountDisplayName: 'ASC' },
    });

    if (!accounts.length) {
      console.log('No active eBay accounts found.');
      return;
    }

    console.log(`Syncing ${accounts.length} active eBay account(s)...`);

    for (const account of accounts) {
      console.log(`\n--- ${account.accountDisplayName} (${account.id}) ---`);
      try {
        const { syncLogIds } = await sync.enqueueSync({
          organizationId: account.organizationId,
          ebayAccountId: account.id,
          trigger: 'manual',
        });
        const syncLogId = syncLogIds[0];
        if (!syncLogId) {
          console.warn('  No sync log created — skipped');
          continue;
        }
        const result = await sync.syncAccount({
          organizationId: account.organizationId,
          ebayAccountId: account.id,
          syncLogId,
          trigger: 'manual',
        });
        console.log(
          `  Sync: processed=${result.processed} created=${result.created} updated=${result.updated} failed=${result.failed}`,
        );
      } catch (err) {
        console.error(`  Sync failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const pricing = app.get(
      require('../dist/src/published-listings/services/published-listings-pricing.service.js')
        .PublishedListingsPricingService,
    );
    console.log('\nRefreshing competitor pricing (Browse API)...');
    for (const account of accounts) {
      try {
        const result = await pricing.refreshForAccount(
          account.organizationId,
          account.id,
          100,
        );
        console.log(
          `  ${account.accountDisplayName}: processed=${result.processed} updated=${result.updated} skipped=${result.skipped}`,
        );
      } catch (err) {
        console.error(
          `  Pricing failed for ${account.accountDisplayName}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    console.log('\nAll account syncs complete.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
