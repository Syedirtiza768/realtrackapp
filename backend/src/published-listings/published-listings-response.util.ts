import type { EbayPublishedListing } from './entities/ebay-published-listing.entity.js';
import {
  preferLargeEbayImageUrl,
  sanitizeEbayImageUrls,
} from '../channels/ebay/ebay-listing-images.util.js';

export { preferLargeEbayImageUrl };

export interface PublishedListingImageMeta {
  url: string;
  source: 'ebay' | 'gridx' | 'other';
  sortOrder: number;
  isPrimary: boolean;
}

export interface SalvageDetails {
  donorYear?: string | null;
  donorMake?: string | null;
  donorModel?: string | null;
  donorTrim?: string | null;
  mileage?: string | null;
  mileageUnit?: string | null;
  stockNumber?: string | null;
  yard?: string | null;
  bin?: string | null;
  vin?: string | null;
  conditionGrade?: string | null;
  testedStatus?: string | null;
}

export interface PublishedListingApiResponse
  extends Omit<EbayPublishedListing, 'description'> {
  description: string | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  storeSlug: string | null;
  images: PublishedListingImageMeta[];
  brand: string | null;
  mpn: string | null;
  oeNumbers: string[];
  salvageDetails: SalvageDetails | null;
}

const SPECIFIC_KEYS = {
  brand: ['brand', 'manufacturer', 'marque'],
  mpn: [
    'manufacturer part number',
    'mpn',
    'mfr part number',
    'manufacturer part no',
  ],
  oe: [
    'oe/oem number',
    'oem number',
    'oe number',
    'oe/oem part number',
    'interchange part number',
    'other part number',
  ],
  // Prefer explicit salvage/donor labels — do not treat generic Motors YMM
  // item specifics as salvage provenance.
  donorYear: ['donor year', 'donor vehicle year'],
  donorMake: ['donor make', 'donor vehicle make'],
  donorModel: ['donor model', 'donor vehicle model'],
  donorTrim: ['donor trim', 'donor vehicle trim'],
  mileage: ['mileage', 'odometer', 'miles', 'donor mileage'],
  stockNumber: ['stock number', 'stock #', 'stock no', 'inventory id'],
  yard: ['yard', 'yard name'],
  bin: ['bin', 'bin location', 'shelf'],
  vin: ['vin', 'vehicle identification number'],
  conditionGrade: ['condition grade', 'grade'],
  testedStatus: ['tested', 'tested status', 'functionality'],
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyImageSource(url: string): 'ebay' | 'gridx' | 'other' {
  const lower = url.toLowerCase();
  if (lower.includes('ebayimg.com') || lower.includes('ebaystatic.com')) {
    return 'ebay';
  }
  if (lower.includes('gridx') || lower.includes('grid-x')) return 'gridx';
  return 'other';
}

export function orderImageUrlsForConsumer(urls: string[]): string[] {
  const upgraded = sanitizeEbayImageUrls(
    urls.map(preferLargeEbayImageUrl),
  ).imageUrls;
  const ebay: string[] = [];
  const other: string[] = [];
  for (const url of upgraded) {
    if (classifyImageSource(url) === 'ebay') ebay.push(url);
    else other.push(url);
  }
  return [...ebay, ...other];
}

function asStringValues(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string');
  }
  if (typeof raw === 'string' && raw.trim()) return [raw];
  return [];
}

function firstSpecific(
  specifics: Record<string, string[]>,
  keys: string[],
): string | null {
  const entries = Object.entries(specifics ?? {});
  for (const want of keys) {
    const hit = entries.find(([k]) => k.trim().toLowerCase() === want);
    const value = asStringValues(hit?.[1]).find((v) => v?.trim());
    if (value?.trim()) return value.trim();
  }
  return null;
}

function allSpecifics(
  specifics: Record<string, string[]>,
  keys: string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const entries = Object.entries(specifics ?? {});
  for (const want of keys) {
    const hit = entries.find(([k]) => k.trim().toLowerCase() === want);
    for (const value of asStringValues(hit?.[1])) {
      const trimmed = value?.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

function parseMileage(raw: string | null): {
  mileage: string | null;
  mileageUnit: string | null;
} {
  if (!raw) return { mileage: null, mileageUnit: null };
  const match = raw.match(/([\d,.]+)\s*(km|mi|miles|kilometers)?/i);
  if (!match) return { mileage: raw, mileageUnit: null };
  const unitRaw = (match[2] ?? '').toLowerCase();
  const mileageUnit =
    unitRaw.startsWith('km') || unitRaw.startsWith('kilometer')
      ? 'km'
      : unitRaw
        ? 'mi'
        : null;
  return { mileage: match[1].replace(/,/g, ''), mileageUnit };
}

export function extractSalvageDetails(
  specifics: Record<string, string[]>,
): SalvageDetails | null {
  const mileageRaw = firstSpecific(specifics, SPECIFIC_KEYS.mileage);
  const { mileage, mileageUnit } = parseMileage(mileageRaw);
  const details: SalvageDetails = {
    donorYear: firstSpecific(specifics, SPECIFIC_KEYS.donorYear),
    donorMake: firstSpecific(specifics, SPECIFIC_KEYS.donorMake),
    donorModel: firstSpecific(specifics, SPECIFIC_KEYS.donorModel),
    donorTrim: firstSpecific(specifics, SPECIFIC_KEYS.donorTrim),
    mileage,
    mileageUnit,
    stockNumber: firstSpecific(specifics, SPECIFIC_KEYS.stockNumber),
    yard: firstSpecific(specifics, SPECIFIC_KEYS.yard),
    bin: firstSpecific(specifics, SPECIFIC_KEYS.bin),
    vin: firstSpecific(specifics, SPECIFIC_KEYS.vin),
    conditionGrade: firstSpecific(specifics, SPECIFIC_KEYS.conditionGrade),
    testedStatus: firstSpecific(specifics, SPECIFIC_KEYS.testedStatus),
  };
  const hasAny = Object.values(details).some(
    (v) => v != null && String(v).trim() !== '',
  );
  return hasAny ? details : null;
}

export function toPublishedListingApiResponse(
  listing: EbayPublishedListing,
  options?: { storeSlug?: string | null },
): PublishedListingApiResponse {
  const descriptionHtml = listing.description?.trim()
    ? listing.description
    : null;
  const descriptionText = descriptionHtml ? stripHtml(descriptionHtml) : null;
  const imageUrls = orderImageUrlsForConsumer(listing.imageUrls ?? []);
  const images: PublishedListingImageMeta[] = imageUrls.map((url, index) => ({
    url,
    source: classifyImageSource(url),
    sortOrder: index,
    isPrimary: index === 0,
  }));
  const specifics = listing.itemSpecifics ?? {};

  return {
    ...listing,
    description: listing.description,
    descriptionHtml,
    descriptionText,
    storeSlug: options?.storeSlug ?? null,
    imageUrls,
    images,
    brand: firstSpecific(specifics, SPECIFIC_KEYS.brand),
    mpn: firstSpecific(specifics, SPECIFIC_KEYS.mpn),
    oeNumbers: allSpecifics(specifics, SPECIFIC_KEYS.oe),
    salvageDetails: extractSalvageDetails(specifics),
  };
}
