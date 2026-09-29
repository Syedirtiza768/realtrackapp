import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { applyBusinessIndustrialFulfillmentDefaults } from '../verticals/business-industrial-image-intake.util.js';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function conditionId(label: string | null): string {
  const normalized = label?.toUpperCase() ?? '';
  if (normalized.includes('NEW')) return '1000';
  if (normalized.includes('REFURB')) return '2500';
  if (normalized.includes('PART')) return '7000';
  return '3000';
}

function median(values: number[]): number | null {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return Math.round(
    (sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2) * 100,
  ) / 100;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const products = app.get<Repository<CatalogProduct>>(
      getRepositoryToken(CatalogProduct),
    );
    const listings = app.get<Repository<ListingRecord>>(
      getRepositoryToken(ListingRecord),
    );
    const rows = await products.find({
      where: { vertical: 'business_industrial' },
      order: { createdAt: 'ASC' },
    });
    let updatedProducts = 0;
    let updatedListings = 0;
    const priced = rows.filter(
      (product) => product.price != null && Number(product.price) > 0,
    );
    const globalMedian = median(priced.map((product) => Number(product.price)));
    const categoryMedians = new Map<string, number>();
    for (const categoryId of new Set(
      priced.map((product) => product.categoryId).filter(Boolean) as string[],
    )) {
      const value = median(
        priced
          .filter((product) => product.categoryId === categoryId)
          .map((product) => Number(product.price)),
      );
      if (value != null) categoryMedians.set(categoryId, value);
    }

    for (const product of rows) {
      const optimization = record(product.optimizationPayload);
      const itemSpecifics = record(optimization.itemSpecifics);
      const original = {
        ...record(product.verticalAttributes),
        ...itemSpecifics,
      };
      const mpn =
        text(product.mpn) ||
        text(original.mpn) ||
        text(original.MPN) ||
        text(original.model) ||
        text(original.Model) ||
        'Does Not Apply';
      const attributes = applyBusinessIndustrialFulfillmentDefaults(
        {
          ...original,
          mpn,
          ...(text(product.partType) && !text(original.partType)
            ? { partType: text(product.partType) }
            : {}),
        },
        {
          dispatchLocation:
            process.env.BUSINESS_INDUSTRIAL_DEFAULT_DISPATCH_LOCATION ||
            'United States',
          shippingCoverage:
            process.env.BUSINESS_INDUSTRIAL_DEFAULT_SHIPPING_COVERAGE ||
            'United States',
        },
      );

      product.mpn = mpn;
      product.partType =
        text(product.partType) ||
        text(attributes.partType) ||
        text(attributes.Type);
      product.conditionId =
        text(product.conditionId) || conditionId(text(product.conditionLabel));
      product.conditionLabel =
        text(product.conditionLabel) ||
        (product.conditionId === '1000'
          ? 'NEW'
          : product.conditionId === '7000'
            ? 'FOR_PARTS'
            : product.conditionId === '2500'
              ? 'REFURBISHED'
              : 'USED');
      if (product.price == null || Number(product.price) <= 0) {
        const fallback =
          (product.categoryId
            ? categoryMedians.get(product.categoryId)
            : undefined) ?? globalMedian;
        if (fallback != null) {
          product.price = fallback;
          product.optimizationPayload = {
            ...record(product.optimizationPayload),
            pricing: {
              source: product.categoryId && categoryMedians.has(product.categoryId)
                ? 'category_catalog_median'
                : 'business_industrial_catalog_median',
              price: fallback,
              reason:
                'No usable live market or image estimate was available; used the median of existing positive B&I catalog prices.',
            },
          };
        }
      }
      product.verticalAttributes =
        attributes as CatalogProduct['verticalAttributes'];
      product.ebayValidationStatus = null;
      await products.save(product);
      updatedProducts += 1;

      if (!product.organizationId || !product.sku) continue;
      const projections = await listings.find({
        where: {
          organizationId: product.organizationId,
          vertical: 'business_industrial',
          customLabelSku: product.sku,
        },
      });
      for (const listing of projections) {
        listing.verticalAttributes = attributes;
        listing.cManufacturerPartNumber = mpn;
        listing.cType = product.partType;
        listing.conditionId = product.conditionId;
        listing.conditionLabel = product.conditionLabel;
        listing.startPrice =
          product.price == null ? null : String(product.price);
        listing.startPriceNum = product.price;
        await listings.save(listing);
        updatedListings += 1;
      }
    }

    console.log(
      JSON.stringify({
        productsFound: rows.length,
        updatedProducts,
        updatedListings,
        published: false,
      }),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
