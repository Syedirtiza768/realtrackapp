import { EBAY_TITLE_MAX_LENGTH } from './ebay-listing-text.util.js';
import {
  alignGenerationAndYearRange,
  buildPlatformSeoTitle,
  detectTitleGenerationMismatch,
  formatYearRange,
  resolvePlatformGeneration,
} from '../../fitment/platform-generation.util.js';
import { resolveMotorsCategoryFromPart } from './ebay-german-listing.util.js';

export type EnglishMarketplace = 'US' | 'AU';

/** Input for native English eBay Motors listing copy (US / AU). */
export interface EnglishListingInput {
  brand?: string | null;
  model?: string | null;
  generation?: string | null;
  yearRange?: string | null;
  partType?: string | null;
  placement?: string | null;
  mpn?: string | null;
  oemPartNumber?: string | null;
  condition?: string | null;
  material?: string | null;
  color?: string | null;
  donorVehicle?: string | null;
  wearNotes?: string | null;
  fitmentRows?: Array<{ year?: string; make?: string; model?: string; trim?: string }>;
  fitmentConfirmed?: boolean;
  sellerCountry?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
}

export interface EnglishListingValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
}

export interface EnglishListingValidationResult {
  valid: boolean;
  issues: EnglishListingValidationIssue[];
}

function truncateEnglishTitle(title: string, max = EBAY_TITLE_MAX_LENGTH): string {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.65) return cut.slice(0, lastSpace).trim();
  return cut.trim();
}

/** Platform-aligned English Motors title for US/AU search. */
export function buildEnglishListingTitle(input: EnglishListingInput): string {
  const anchorYear =
    input.fitmentRows?.[0]?.year ??
    input.yearRange?.slice(0, 4) ??
    input.donorVehicle?.match(/\b(19|20)\d{2}\b/)?.[0];

  const aligned = alignGenerationAndYearRange({
    generation: input.generation,
    yearRange: input.yearRange,
    make: input.brand,
    model: input.model,
    anchorYear,
    fitmentYears: input.fitmentRows?.map((r) => r.year),
  });

  return buildPlatformSeoTitle({
    make: input.brand,
    model: input.model,
    year: anchorYear,
    partType: input.partType,
    mpn: input.oemPartNumber ?? input.mpn,
    placement: input.placement,
    fitmentRows: input.fitmentRows?.map((r) => ({
      year: r.year,
      trim: r.trim,
      model: r.model,
    })),
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildFitmentSection(input: EnglishListingInput): string {
  const rows = input.fitmentRows ?? [];
  if (!rows.length) {
    return `<p><strong>Compatibility:</strong> Vehicle application is for reference only. Please verify the part number and compare photos before purchase.</p>`;
  }

  const list = rows
    .slice(0, 8)
    .map(
      (r) =>
        `<li>${escapeHtml([r.year, r.make, r.model, r.trim].filter(Boolean).join(' '))}</li>`,
    )
    .join('');

  const confirmed = input.fitmentConfirmed
    ? 'Validated eBay compatibility entries are included where available.'
    : 'Fitment is based on donor vehicle / manufacturer data — verify part number before ordering.';

  return `<h3>Vehicle Compatibility</h3>
<p>${confirmed}</p>
<ul>${list}</ul>
<p>Please verify part number compatibility and compare photos with your existing part before purchase.</p>`;
}

function buildShippingSection(
  sellerCountry: string | null | undefined,
  marketplace: EnglishMarketplace,
): string {
  const country = (sellerCountry ?? 'US').trim().toUpperCase();
  if (marketplace === 'AU') {
    return `<h3>Shipping &amp; Returns</h3>
<ul>
  <li><strong>Item location:</strong> ${country === 'AU' ? 'Australia' : 'United States'} — international shipping to Australia may apply.</li>
  <li>Delivery times vary; import duties and GST may apply for international orders.</li>
  <li>Returns per eBay policy and the return profile on this listing.</li>
</ul>`;
  }
  if (country !== 'US') {
    return `<h3>Shipping &amp; Returns</h3>
<ul>
  <li><strong>Item location:</strong> ${country} — shipping times may vary.</li>
  <li>Returns per eBay policy and the return profile on this listing.</li>
</ul>`;
  }
  return `<h3>Shipping &amp; Returns</h3>
<ul>
  <li>Ships from the United States unless otherwise stated.</li>
  <li>Returns per eBay Motors policy and the return profile on this listing.</li>
</ul>`;
}

/** Structured English HTML description for eBay US / AU Motors. */
export function buildEnglishListingDescription(
  input: EnglishListingInput,
  marketplace: EnglishMarketplace = 'US',
): string {
  const pn = (input.oemPartNumber ?? input.mpn ?? '').trim();
  const partType = input.partType?.trim() || 'Automotive Part';
  const placement = input.placement?.trim();
  const donor = input.donorVehicle?.trim();

  const overview = [
    `<strong>${escapeHtml(partType)}</strong>`,
    placement ? `Placement: ${escapeHtml(placement)}` : null,
    pn ? `Part Number: ${escapeHtml(pn)}` : null,
    `Condition: Used OEM with normal wear — see photos`,
  ].filter(Boolean);

  const wear = input.wearNotes?.trim()
    ? `<p><strong>Condition notes:</strong> ${escapeHtml(input.wearNotes)}</p>`
    : `<p>Genuine used OEM part with normal wear. Photos show the actual item where applicable.</p>`;

  const donorBlock = donor
    ? `<p><strong>Donor vehicle:</strong> ${escapeHtml(donor)} (reference only).</p>`
    : '';

  const html = `<h3>Product Overview</h3>
<p>${overview.join(' · ')}</p>
${donorBlock}
${wear}
${buildFitmentSection(input)}
<p><strong>Important:</strong> Please compare the part number and photos before purchase. Contact us with compatibility questions before ordering.</p>
${buildShippingSection(input.sellerCountry, marketplace)}`;

  return marketplace === 'AU' ? applyAustralianSpelling(html) : html;
}

/** English eBay Motors item specifics (omit unknown fields). */
export function buildEnglishItemSpecifics(input: EnglishListingInput): Record<string, string> {
  const specifics: Record<string, string> = {};
  const set = (key: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (v) specifics[key] = v;
  };

  const anchorYear =
    input.fitmentRows?.[0]?.year ??
    input.yearRange?.slice(0, 4) ??
    input.donorVehicle?.match(/\b(19|20)\d{2}\b/)?.[0];
  const platform = anchorYear
    ? resolvePlatformGeneration(input.brand, input.model, anchorYear)
    : null;
  const aligned = platform
    ? { generation: platform.code, yearRange: formatYearRange(platform.start, platform.end) }
    : alignGenerationAndYearRange({
        generation: input.generation,
        yearRange: input.yearRange,
        make: input.brand,
        model: input.model,
        anchorYear,
        fitmentYears: input.fitmentRows?.map((r) => r.year),
      });

  set('Brand', input.brand);
  set('Manufacturer Part Number', input.mpn);
  set('OE/OEM Part Number', input.oemPartNumber ?? input.mpn);
  set('Type', input.partType);
  set('Placement on Vehicle', input.placement);
  set('Material', input.material);
  set('Color', input.color);
  set('Condition', 'Used');
  set('Universal Fitment', 'No');
  if (aligned.yearRange) set('Year Range', aligned.yearRange);
  if (aligned.generation) set('Platform/Generation', aligned.generation);

  return specifics;
}

/** Light AU localisation for descriptions and short copy. */
export function applyAustralianSpelling(text: string): string {
  return text
    .replace(/\bColor\b/g, 'Colour')
    .replace(/\bcolor\b/g, 'colour')
    .replace(/\bCenter\b/g, 'Centre')
    .replace(/\bcenter\b/g, 'centre')
    .replace(/\bTire\b/g, 'Tyre')
    .replace(/\btire\b/g, 'tyre')
    .replace(/\bMold\b/g, 'Mould')
    .replace(/\bmold\b/g, 'mould');
}

export function shouldRebuildEnglishTitle(
  title: string,
  input: Pick<EnglishListingInput, 'brand' | 'model' | 'donorVehicle' | 'fitmentRows'>,
): boolean {
  const anchorYear =
    input.fitmentRows?.[0]?.year ??
    input.donorVehicle?.match(/\b(19|20)\d{2}\b/)?.[0];
  return Boolean(
    detectTitleGenerationMismatch(title, input.brand, input.model, anchorYear),
  );
}

export function validateEnglishListing(params: {
  title: string;
  description: string;
  itemSpecifics: Record<string, string>;
  categoryId?: string | null;
  categoryName?: string | null;
  partType?: string | null;
  placement?: string | null;
  mpn?: string | null;
  oemPartNumber?: string | null;
}): EnglishListingValidationResult {
  const issues: EnglishListingValidationIssue[] = [];
  const title = params.title?.trim() ?? '';
  const description = params.description?.trim() ?? '';

  if (!title) {
    issues.push({ code: 'EN_TITLE_MISSING', severity: 'error', field: 'title', message: 'English title is missing' });
  } else if (title.length > EBAY_TITLE_MAX_LENGTH) {
    issues.push({ code: 'EN_TITLE_TOO_LONG', severity: 'error', field: 'title', message: 'Title exceeds 80 characters' });
  }

  if (!description || description.replace(/<[^>]+>/g, '').trim().length < 120) {
    issues.push({ code: 'EN_DESCRIPTION_THIN', severity: 'error', field: 'description', message: 'English description is empty or too short' });
  }

  const titleMismatch = detectTitleGenerationMismatch(
    title,
    params.itemSpecifics['Brand'],
    params.itemSpecifics['Model'],
    params.itemSpecifics['Year Range']?.slice(0, 4),
  );
  if (titleMismatch) {
    issues.push({
      code: 'EN_TITLE_GENERATION_MISMATCH',
      severity: 'error',
      field: 'title',
      message: titleMismatch,
    });
  }

  const hint = resolveMotorsCategoryFromPart(params.partType, params.placement);
  if (hint && params.categoryId && params.categoryId !== hint.categoryId) {
    const interiorIds = new Set(['33695', '33717', '174090']);
    const exteriorIds = new Set(['33697', '174105']);
    if (interiorIds.has(hint.categoryId) && exteriorIds.has(params.categoryId)) {
      issues.push({
        code: 'EN_CATEGORY_MISMATCH',
        severity: 'error',
        field: 'categoryId',
        message: `Interior trim part mapped to exterior category (${params.categoryName ?? params.categoryId})`,
      });
    }
  }

  const pn = params.oemPartNumber ?? params.mpn;
  if (pn?.trim() && !params.itemSpecifics['Manufacturer Part Number'] && !params.itemSpecifics['OE/OEM Part Number']) {
    issues.push({ code: 'EN_OEM_SPECIFIC_MISSING', severity: 'warning', field: 'itemSpecifics', message: 'OEM/MPN not reflected in item specifics' });
  }

  return { valid: !issues.some((i) => i.severity === 'error'), issues };
}

export { resolveMotorsCategoryFromPart };
