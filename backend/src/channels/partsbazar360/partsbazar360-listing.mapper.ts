import type { ListingRecord } from '../../listings/listing-record.entity.js';
import type { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import {
  fitmentDataToCompatibilityPayload,
  selectPublishFitmentSource,
} from '../../fitment/fitment-mvl.util.js';
import { buildListingAspects } from '../ebay/ebay-listing-aspects.util.js';
import { mapToEbayConditionEnum } from '../ebay/ebay-listing-condition.util.js';
import {
  parseImageUrlField,
  sanitizeEbayImageUrls,
} from '../ebay/ebay-listing-images.util.js';
import type {
  PartsBazarCompatibility,
  PartsBazarListingPayload,
  PartsBazarProvenanceHints,
  PartsBazarPushItem,
} from './partsbazar360.types.js';

export type PartsBazarListingSource = Pick<
  ListingRecord,
  | 'id'
  | 'title'
  | 'customLabelSku'
  | 'categoryName'
  | 'startPrice'
  | 'startPriceNum'
  | 'quantity'
  | 'quantityNum'
  | 'itemPhotoUrl'
  | 'conditionId'
  | 'conditionLabel'
  | 'description'
  | 'cBrand'
  | 'cType'
  | 'cManufacturerPartNumber'
  | 'cOeOemPartNumber'
  | 'cMaterial'
  | 'cPlacement'
  | 'countryOfOrigin'
  | 'manufacturerName'
  | 'pUpc'
  | 'status'
  | 'ebayListingId'
>;

export type PartsBazarCatalogSource = Pick<
  CatalogProduct,
  | 'sku'
  | 'title'
  | 'description'
  | 'optimizedTitle'
  | 'optimizedDescription'
  | 'brand'
  | 'mpn'
  | 'oemPartNumber'
  | 'partType'
  | 'placement'
  | 'material'
  | 'countryOfOrigin'
  | 'price'
  | 'quantity'
  | 'conditionId'
  | 'conditionLabel'
  | 'categoryName'
  | 'imageUrls'
  | 'fitmentData'
  | 'fitmentRows'
  | 'ebayItemId'
>;

export interface PartsBazarMapContext {
  marketplaceId: string;
  currency: string;
  overrides?: { price?: number; title?: string; quantity?: number };
  /**
   * Photos already resolved to publicly fetchable URLs. RealTrack's own images
   * live in a private bucket and are stored under names that may no longer
   * exist (originals are converted to .webp), so the service verifies each one
   * and rewrites it to the public serve URL. When omitted the mapper falls back
   * to the stored URLs as-is (temp uploads dropped).
   */
  imageUrls?: string[];
}

export type PartsBazarMapResult =
  | { ok: true; item: PartsBazarPushItem; warnings: string[] }
  | { ok: false; reason: string; warnings: string[] };

/**
 * The receiver's Express body limit is 100 kB. A long HTML description plus a
 * few hundred fitment rows can exceed it, so the payload is trimmed to fit
 * (description first, then fitment rows) instead of failing the publish.
 */
export const PARTSBAZAR_MAX_PAYLOAD_BYTES = 90_000;
const MAX_DESCRIPTION_CHARS = 40_000;
const TRIMMED_DESCRIPTION_CHARS = 8_000;

const text = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const firstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const found = text(value);
    if (found) return found;
  }
  return null;
};

function priceOf(
  listing: PartsBazarListingSource,
  catalog: PartsBazarCatalogSource | null,
  override?: number,
): number | null {
  const candidates: Array<number | string | null | undefined> = [
    override,
    listing.startPriceNum,
    listing.startPrice,
    catalog?.price,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '')
      continue;
    const n =
      typeof candidate === 'number'
        ? candidate
        : Number(String(candidate).replace(/[$,\s]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function quantityOf(
  listing: PartsBazarListingSource,
  catalog: PartsBazarCatalogSource | null,
  override?: number,
): { quantity: number; defaulted: boolean } {
  const candidates: Array<number | string | null | undefined> = [
    override,
    listing.quantityNum,
    listing.quantity,
    catalog?.quantity,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '')
      continue;
    const n =
      typeof candidate === 'number'
        ? candidate
        : parseInt(String(candidate), 10);
    if (Number.isInteger(n) && n >= 0) return { quantity: n, defaulted: false };
  }
  // Same fallback the eBay publish path uses when a row carries no quantity.
  return { quantity: 1, defaulted: true };
}

/** Stored photo URLs in publish order: the catalog product's, else the listing's. */
export function storedImageUrls(
  listing: PartsBazarListingSource,
  catalog: PartsBazarCatalogSource | null,
): string[] {
  const fromCatalog = catalog?.imageUrls ?? [];
  return fromCatalog.length > 0
    ? fromCatalog
    : parseImageUrlField(listing.itemPhotoUrl);
}

function imagesOf(
  listing: PartsBazarListingSource,
  catalog: PartsBazarCatalogSource | null,
  resolved?: string[],
): string[] {
  if (resolved) return sanitizeEbayImageUrls(resolved).imageUrls;
  // Temp-path S3 objects are cleaned up, and PartsBazar360 stores remote URLs
  // only — never a copy — so a temp URL would dead-link the storefront later.
  const notTemp = (urls: string[]) => urls.filter((u) => !/\/temp\//.test(u));
  const fromCatalog = notTemp(catalog?.imageUrls ?? []);
  const fromListing = notTemp(parseImageUrlField(listing.itemPhotoUrl));
  const source = fromCatalog.length > 0 ? fromCatalog : fromListing;
  return sanitizeEbayImageUrls(source).imageUrls;
}

function oeNumbersOf(
  listing: PartsBazarListingSource,
  catalog: PartsBazarCatalogSource | null,
): string[] {
  const seen = new Map<string, string>();
  for (const raw of [listing.cOeOemPartNumber, catalog?.oemPartNumber]) {
    for (const part of (raw ?? '').split(/[,;|\n]+/)) {
      const value = part.trim();
      if (value && !seen.has(value.toLowerCase()))
        seen.set(value.toLowerCase(), value);
    }
  }
  return [...seen.values()];
}

function qualityTierOf(
  conditionEnum: string,
): NonNullable<PartsBazarProvenanceHints['qualityTier']> {
  if (conditionEnum.startsWith('NEW')) return 'NEW';
  if (conditionEnum === 'FOR_PARTS_OR_NOT_WORKING') return 'FOR_PARTS';
  if (conditionEnum.includes('REFURBISHED')) return 'REFURBISHED';
  return 'USED';
}

const humanize = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

function specificsOf(
  listing: PartsBazarListingSource,
  catalog: PartsBazarCatalogSource | null,
  brand: string | null,
  mpn: string | null,
  oeNumbers: string[],
): Record<string, string | string[]> {
  const aspects = buildListingAspects({
    brand,
    mpn,
    partType: firstText(listing.cType, catalog?.partType),
    existing: {
      ...(firstText(listing.cPlacement, catalog?.placement)
        ? {
            'Placement on Vehicle': [
              firstText(listing.cPlacement, catalog?.placement)!,
            ],
          }
        : {}),
      ...(firstText(listing.cMaterial, catalog?.material)
        ? { Material: [firstText(listing.cMaterial, catalog?.material)!] }
        : {}),
      ...(firstText(listing.countryOfOrigin, catalog?.countryOfOrigin)
        ? {
            'Country/Region of Manufacture': [
              firstText(listing.countryOfOrigin, catalog?.countryOfOrigin)!,
            ],
          }
        : {}),
    },
  });

  const out: Record<string, string | string[]> = {};
  for (const [name, values] of Object.entries(aspects)) {
    // buildListingAspects injects this eBay placeholder when there is no UPC;
    // it is meaningless outside eBay and would pollute the catalog.
    if (name === 'UPC' && values.every((v) => /^does not apply$/i.test(v)))
      continue;
    if (!values.length) continue;
    out[name] = values.length === 1 ? values[0] : values;
  }
  // Kept as separate values: one comma-joined string would be stored by the
  // receiver as a single bogus OE number alongside the real ones.
  if (oeNumbers.length > 0) {
    out['OE/OEM Part Number'] =
      oeNumbers.length === 1 ? oeNumbers[0] : oeNumbers;
  }
  return out;
}

function compatibilityOf(
  catalog: PartsBazarCatalogSource | null,
): PartsBazarCompatibility | null {
  if (!catalog) return null;
  // Same source rule as the eBay publish path: only rows validated against
  // the vehicle master list are published as fitment.
  const source = selectPublishFitmentSource(
    catalog.fitmentData,
    catalog.fitmentRows,
  );
  return (fitmentDataToCompatibilityPayload(source) ??
    null) as PartsBazarCompatibility | null;
}

function fitToBudget(
  listing: PartsBazarListingPayload,
  warnings: string[],
): PartsBazarListingPayload {
  const size = (l: PartsBazarListingPayload) =>
    Buffer.byteLength(JSON.stringify(l), 'utf8');
  let current = listing;
  if (size(current) <= PARTSBAZAR_MAX_PAYLOAD_BYTES) return current;

  if (
    current.description &&
    current.description.length > TRIMMED_DESCRIPTION_CHARS
  ) {
    current = {
      ...current,
      description: current.description.slice(0, TRIMMED_DESCRIPTION_CHARS),
    };
    warnings.push('Description was shortened to fit the publish size limit');
  }

  while (
    size(current) > PARTSBAZAR_MAX_PAYLOAD_BYTES &&
    current.compatibility &&
    current.compatibility.compatibleProducts.length > 1
  ) {
    const rows = current.compatibility.compatibleProducts;
    current = {
      ...current,
      compatibility: {
        compatibleProducts: rows.slice(0, Math.ceil(rows.length / 2)),
      },
    };
    warnings.push('Fitment rows were reduced to fit the publish size limit');
  }
  return current;
}

/**
 * Build the PartsBazar360 push item for one RealTrack listing.
 *
 * Pure: no I/O. Returns `ok: false` with a reason a user can act on when the
 * listing is not publishable (no title, no price, no usable image) rather than
 * pushing something the storefront would have to reject or hide.
 */
export function buildPartsBazarPushItem(
  listing: PartsBazarListingSource,
  catalog: PartsBazarCatalogSource | null,
  context: PartsBazarMapContext,
): PartsBazarMapResult {
  const warnings: string[] = [];

  const title = firstText(
    context.overrides?.title,
    listing.title,
    catalog?.optimizedTitle,
    catalog?.title,
  );
  if (!title) return { ok: false, reason: 'Listing has no title', warnings };

  const price = priceOf(listing, catalog, context.overrides?.price);
  if (price === null || price <= 0) {
    return {
      ok: false,
      reason: 'Listing has no price greater than zero',
      warnings,
    };
  }

  const imageUrls = imagesOf(listing, catalog, context.imageUrls);
  if (imageUrls.length === 0) {
    return { ok: false, reason: 'Listing has no valid image URL', warnings };
  }

  const qty = quantityOf(listing, catalog, context.overrides?.quantity);
  if (qty.defaulted) {
    warnings.push('Listing has no quantity; published with quantity 1');
  }

  const conditionSource = firstText(
    listing.conditionId,
    catalog?.conditionId,
    listing.conditionLabel,
    catalog?.conditionLabel,
  );
  if (!conditionSource) {
    warnings.push('Listing has no condition; published as Used');
  }
  const conditionEnum = mapToEbayConditionEnum(conditionSource ?? undefined);
  const qualityTier = qualityTierOf(conditionEnum);

  const brand = firstText(
    listing.cBrand,
    listing.manufacturerName,
    catalog?.brand,
  );
  const mpn = firstText(listing.cManufacturerPartNumber, catalog?.mpn);
  const oeNumbers = oeNumbersOf(listing, catalog);
  const ebayItemId = firstText(listing.ebayListingId, catalog?.ebayItemId);

  const description = firstText(
    listing.description,
    catalog?.optimizedDescription,
    catalog?.description,
  );

  const hints: PartsBazarProvenanceHints = { qualityTier };
  if (qualityTier === 'NEW') {
    hints.partSource = oeNumbers.length > 0 ? 'OEM' : 'AFTERMARKET';
    hints.partType =
      hints.partSource === 'AFTERMARKET' ? 'AFTERMARKET' : 'UNCLASSIFIED';
  }

  const payload: PartsBazarListingPayload = {
    title,
    sku: firstText(listing.customLabelSku, catalog?.sku),
    price: price.toFixed(2),
    currency: context.currency,
    quantityAvailable: qty.quantity,
    listingStatus: ['sold', 'delisted', 'archived'].includes(listing.status)
      ? 'ended'
      : 'active',
    marketplaceId: context.marketplaceId,
    condition: humanize(conditionEnum),
    categoryName: firstText(catalog?.categoryName, listing.categoryName),
    brand,
    mpn,
    oeNumbers,
    description: description
      ? description.slice(0, MAX_DESCRIPTION_CHARS)
      : null,
    imageUrls,
    itemSpecifics: specificsOf(listing, catalog, brand, mpn, oeNumbers),
    compatibility: compatibilityOf(catalog),
    ebayItemId,
    listingUrl: ebayItemId ? `https://www.ebay.com/itm/${ebayItemId}` : null,
  };

  return {
    ok: true,
    warnings,
    item: {
      sourceListingId: listing.id,
      listing: fitToBudget(payload, warnings),
      hints,
    },
  };
}
