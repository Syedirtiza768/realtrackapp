import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { VerticalsService } from '../verticals/verticals.service.js';

async function main(): Promise<void> {
  const accountId = process.argv[2]?.trim();
  const marketplaceId = process.argv[3]?.trim() || 'EBAY_US';
  if (!accountId)
    throw new Error(
      'Usage: audit-business-industrial-publish-readiness <ebay-account-id> [marketplace-id]',
    );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const accounts = app.get<Repository<ConnectedEbayAccount>>(
      getRepositoryToken(ConnectedEbayAccount),
    );
    const products = app.get<Repository<CatalogProduct>>(
      getRepositoryToken(CatalogProduct),
    );
    const listings = app.get<Repository<ListingRecord>>(
      getRepositoryToken(ListingRecord),
    );
    const verticals = app.get(VerticalsService);
    const account = await accounts.findOne({ where: { id: accountId } });
    if (!account?.primaryStoreId || !account.organizationId)
      throw new Error('B&I eBay account/store is unavailable');

    const rows = await products.find({
      where: {
        organizationId: account.organizationId,
        vertical: 'business_industrial',
      },
      order: { createdAt: 'ASC' },
    });
    const failures: Array<{
      sku: string;
      title: string;
      categoryId: string | null;
      errors: string[];
    }> = [];
    let warnings = 0;

    for (const product of rows) {
      const listing = product.sku
        ? await listings.findOne({
            where: {
              organizationId: account.organizationId,
              vertical: 'business_industrial',
              customLabelSku: product.sku,
            },
          })
        : null;
      const projection = await verticals.buildPublishProjection({
        vertical: 'business_industrial',
        product,
        listing,
        storeId: account.primaryStoreId,
        marketplaceId,
      });
      if (!projection) continue;
      warnings += projection.warnings.length;
      if (projection.blockingErrors.length)
        failures.push({
          sku: product.sku ?? product.id,
          title: product.title,
          categoryId: product.categoryId,
          errors: projection.blockingErrors,
        });
    }

    console.log(
      JSON.stringify({
        total: rows.length,
        ready: rows.length - failures.length,
        blocked: failures.length,
        warningCount: warnings,
        failures,
        published: false,
      }),
    );
    if (failures.length) process.exitCode = 2;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
