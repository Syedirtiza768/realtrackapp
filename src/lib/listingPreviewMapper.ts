/**
 * Maps DB records (listing_records + catalog_products) to the EbayListing preview type.
 */
import type { EbayListing } from './ebayFileExchangeParser';
import type { ListingDetail } from '../types/search';
import { conditionLabel } from '../types/search';

export interface CatalogProductPreviewData {
  fitmentData?: Record<string, unknown>[] | null;
  brand?: string | null;
  partType?: string | null;
  placement?: string | null;
  material?: string | null;
  features?: string | null;
  countryOfOrigin?: string | null;
  oemPartNumber?: string | null;
  mpn?: string | null;
}

export function buildEbayPreview(
  listing: ListingDetail,
  catalogProduct?: CatalogProductPreviewData | null,
): EbayListing {
  const imageUrls = listing.itemPhotoUrl
    ? listing.itemPhotoUrl.split('|').filter(Boolean)
    : [];

  const compatibility = (catalogProduct?.fitmentData ?? [])
    .filter((r: Record<string, unknown>) => r.Make && r.Model && r.Year)
    .map((r: Record<string, unknown>) => ({
      make: String(r.Make ?? ''),
      model: String(r.Model ?? ''),
      year: String(r.Year ?? ''),
    }));

  const specifics: { label: string; value: string }[] = [];
  if (catalogProduct?.brand || listing.cBrand) specifics.push({ label: 'Brand', value: catalogProduct?.brand ?? listing.cBrand ?? '' });
  if (catalogProduct?.mpn || listing.cManufacturerPartNumber) specifics.push({ label: 'MPN', value: catalogProduct?.mpn ?? listing.cManufacturerPartNumber ?? '' });
  if (listing.cType || catalogProduct?.partType) specifics.push({ label: 'Type', value: listing.cType ?? catalogProduct?.partType ?? '' });
  if (listing.cOeOemPartNumber || catalogProduct?.oemPartNumber) specifics.push({ label: 'OE/OEM Part Number', value: listing.cOeOemPartNumber ?? catalogProduct?.oemPartNumber ?? '' });
  if (catalogProduct?.placement) specifics.push({ label: 'Placement', value: catalogProduct.placement });
  if (catalogProduct?.material) specifics.push({ label: 'Material', value: catalogProduct.material });
  if (listing.cFeatures || catalogProduct?.features) specifics.push({ label: 'Features', value: listing.cFeatures ?? catalogProduct?.features ?? '' });
  if (catalogProduct?.countryOfOrigin) specifics.push({ label: 'Country of Manufacture', value: catalogProduct.countryOfOrigin });

  return {
    action: listing.action ?? 'Add',
    customLabel: listing.customLabelSku ?? '',
    category: listing.categoryName ?? listing.categoryId ?? '',
    title: listing.title ?? '',
    price: listing.startPrice ?? '',
    quantity: listing.quantity ?? '',
    imageUrls,
    conditionId: listing.conditionId ?? '',
    conditionLabel: conditionLabel(listing.conditionId),
    description: listing.description ?? '',
    format: listing.format ?? '',
    duration: listing.duration ?? '',
    location: listing.location ?? '',
    brand: catalogProduct?.brand ?? listing.cBrand ?? '',
    type: listing.cType ?? catalogProduct?.partType ?? '',
    placement: catalogProduct?.placement ?? '',
    material: catalogProduct?.material ?? '',
    features: listing.cFeatures ?? catalogProduct?.features ?? '',
    countryOfManufacture: catalogProduct?.countryOfOrigin ?? '',
    mpn: catalogProduct?.mpn ?? listing.cManufacturerPartNumber ?? '',
    oemPartNumber: listing.cOeOemPartNumber ?? catalogProduct?.oemPartNumber ?? '',
    shippingProfile: listing.shippingProfileName ?? '',
    returnProfile: listing.returnProfileName ?? '',
    paymentProfile: listing.paymentProfileName ?? '',
    itemSpecifics: specifics,
    compatibility,
  };
}
