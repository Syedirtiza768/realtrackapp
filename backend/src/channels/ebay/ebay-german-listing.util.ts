import { EBAY_TITLE_MAX_LENGTH } from './ebay-listing-text.util.js';
import {
  alignGenerationAndYearRange,
  detectTitleGenerationMismatch,
  extractFitmentVariantTokens,
  validateGenerationYearAlignment,
} from '../../fitment/platform-generation.util.js';

/** Input for native German eBay Motors listing copy (no invented fields). */
export interface GermanListingInput {
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
  fitmentRows?: Array<{
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  }>;
  fitmentConfirmed?: boolean;
  sellerCountry?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
}

export interface GermanListingValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
}

export interface GermanListingValidationResult {
  valid: boolean;
  issues: GermanListingValidationIssue[];
}

const PART_NAME_DE: Record<string, string> = {
  armrest: 'Armlehne',
  'door armrest': 'Armlehne',
  'arm rest': 'Armlehne',
  'door trim': 'Türverkleidung',
  'door panel trim': 'Türverkleidung',
  'interior door panel': 'Innentürverkleidung',
  'door panel': 'Türverkleidung',
  'door handle': 'Türgriff',
  'window regulator': 'Fensterheber',
  mirror: 'Außenspiegel',
  'side mirror': 'Außenspiegel',
  headlight: 'Scheinwerfer',
  taillight: 'Rückleuchte',
  bumper: 'Stoßstange',
  fender: 'Kotflügel',
  hood: 'Motorhaube',
  seat: 'Sitz',
  dashboard: 'Armaturenbrett',
  'dash trim': 'Armaturenbrettblende',
  'dashboard trim': 'Armaturenbrettblende',
  'dash panel': 'Armaturenbrettblende',
  'dash bezel': 'Armaturenbrettblende',
  'instrument panel': 'Armaturenbrett',
  'center console': 'Mittelkonsole',
  'steering wheel': 'Lenkrad',
};

const PLACEMENT_TOKEN_DE: Record<string, string> = {
  front: 'vorne',
  rear: 'hinten',
  back: 'hinten',
  left: 'links',
  right: 'rechts',
  upper: 'oben',
  lower: 'unten',
  driver: 'Fahrerseite',
  passenger: 'Beifahrerseite',
  'driver side': 'Fahrerseite',
  'passenger side': 'Beifahrerseite',
};

const AWKWARD_GERMAN_PATTERNS = [
  /\bgebraucht\s+oe\b/i,
  /\boe\s+gebraucht\b/i,
  /\bused\s+oe\b/i,
  /\boem\s+used\b/i,
  /\bfor\s+\d{4}\b/i,
  /\bgenuine\s+oem\b/i,
];

/** Motors category keyword rows — interior before exterior; first match wins. */
export const CATEGORY_KEYWORD_ROWS: Array<{ kw: string[]; id: string; name: string }> =
  [
    {
      kw: [
        'dashboard',
        'dash panel',
        'instrument panel',
        'dash trim',
        'dash bezel',
        'armaturenbrett',
      ],
      id: '33717',
      name: 'Dashboards & Dashboard Parts',
    },
    {
      kw: [
        'armrest',
        'armlehne',
        'türverkleidung',
        'door armrest',
        'inner panel',
        'door finisher',
      ],
      id: '33695',
      name: 'Interior Door Panels & Parts',
    },
    {
      kw: [
        'interior door',
        'door moulding',
        'door molding',
        'door trim',
        'innen',
      ],
      id: '33695',
      name: 'Interior Door Panels & Parts',
    },
    {
      kw: ['exterior door panel', 'door skin', 'door shell', 'exterior door'],
      id: '33697',
      name: 'Exterior Door Panels & Frames',
    },
    {
      kw: [
        'complete door',
        'door assembly',
        'driver door',
        "driver's door",
        'door body-in-white',
      ],
      id: '174105',
      name: 'Doors & Door Parts',
    },
    {
      kw: ['door handle', 'handle strip'],
      id: '174106',
      name: 'Door Handles',
    },
    {
      kw: ['window regulator', 'window lifter', 'window motor'],
      id: '174085',
      name: 'Window Motors, Parts & Accessories',
    },
    {
      kw: ['mirror', 'side mirror', 'rearview'],
      id: '33726',
      name: 'Exterior Mirrors',
    },
    {
      kw: ['headlight', 'headlamp'],
      id: '33710',
      name: 'Headlights',
    },
    {
      kw: ['center console', 'armrest console'],
      id: '174090',
      name: 'Center Consoles',
    },
  ];

export function translatePartNameToGerman(
  partType: string | null | undefined,
): string {
  const raw = (partType ?? '').trim();
  if (!raw) return 'Autoteil';
  const lower = raw.toLowerCase();
  for (const [en, de] of Object.entries(PART_NAME_DE)) {
    if (lower === en || lower.includes(en)) return de;
  }
  return raw;
}

export function formatGermanPlacement(
  placement: string | null | undefined,
): string {
  if (!placement?.trim()) return '';
  const lower = placement.toLowerCase();
  const hasFront = /\b(front|vorne)\b/.test(lower);
  const hasRear = /\b(rear|back|hinten)\b/.test(lower);
  const hasLeft = /\b(left|links|lh|driver)\b/.test(lower);
  const hasRight = /\b(right|rechts|rh|passenger)\b/.test(lower);
  const hasUpper = /\b(upper|top|oben)\b/.test(lower);
  const hasLower = /\b(lower|bottom|unten)\b/.test(lower);

  const parts: string[] = [];
  if (hasFront) parts.push('vorne');
  else if (hasRear) parts.push('hinten');
  if (hasLeft) parts.push('links');
  else if (hasRight) parts.push('rechts');
  if (hasUpper) parts.push('oben');
  else if (hasLower) parts.push('unten');

  if (parts.length) return parts.join(' ');

  let out = placement;
  for (const [en, de] of Object.entries(PLACEMENT_TOKEN_DE)) {
    out = out.replace(
      new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      de,
    );
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function formatGermanCondition(
  condition: string | null | undefined,
): string {
  const c = (condition ?? '').trim().toLowerCase();
  if (!c || c.includes('used') || c.includes('gebraucht')) return 'gebraucht';
  if (c.includes('new') || c.includes('neu')) return 'neu';
  return 'gebraucht';
}

export function isLikelyGermanText(text: string): boolean {
  return (
    /[äöüßÄÖÜ]/.test(text) ||
    /\b(OEM|Original|gebraucht|hinten|vorne|Teilenummer|Armlehne|Tür|Einbauposition|Hersteller)\b/i.test(
      text,
    )
  );
}

export function hasAwkwardGermanPhrasing(text: string): boolean {
  return AWKWARD_GERMAN_PATTERNS.some((re) => re.test(text));
}

export function resolveMotorsCategoryFromPart(
  partType?: string | null,
  note?: string | null,
): { categoryId: string; categoryName: string } | null {
  const text = `${partType ?? ''} ${note ?? ''}`.toLowerCase();
  if (!text.trim()) return null;

  const interiorHint =
    /\b(interior|innen|armrest|armlehne|trim|verkleidung|finisher)\b/i.test(
      text,
    );
  if (
    interiorHint &&
    /\bdoor panel\b/i.test(text) &&
    !/\bexterior\b/i.test(text)
  ) {
    return {
      categoryId: '33695',
      categoryName: 'Interior Door Panels & Parts',
    };
  }

  for (const row of CATEGORY_KEYWORD_ROWS) {
    if (row.kw.some((kw) => text.includes(kw))) {
      return { categoryId: row.id, categoryName: row.name };
    }
  }
  return null;
}

function truncateGermanTitle(
  title: string,
  max = EBAY_TITLE_MAX_LENGTH,
): string {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  const cut = normalized.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.65) return cut.slice(0, lastSpace).trim();
  return cut.trim();
}

/** Native German Motors title: Marke Modell Generation Teil Position OEM-Nr Original gebraucht */
export function buildGermanListingTitle(input: GermanListingInput): string {
  const brand = input.brand?.trim() ?? '';
  const model = input.model?.trim() ?? '';
  const anchorYear =
    input.fitmentRows?.[0]?.year ??
    input.yearRange?.slice(0, 4) ??
    input.donorVehicle?.match(/\b(19|20)\d{2}\b/)?.[0];

  const aligned = alignGenerationAndYearRange({
    generation: input.generation,
    yearRange: input.yearRange,
    make: brand,
    model,
    anchorYear,
    fitmentYears: input.fitmentRows?.map((r) => r.year),
  });

  const generation = aligned.generation;
  const yearRange = aligned.yearRange;
  const variantTokens = extractFitmentVariantTokens(
    (input.fitmentRows ?? []).map((r) => ({ trim: r.trim, model: r.model })),
    2,
  );

  const partDe = translatePartNameToGerman(input.partType);
  const placementDe = formatGermanPlacement(input.placement);
  const pn = (input.oemPartNumber ?? input.mpn ?? '').trim();
  const conditionDe = formatGermanCondition(input.condition);
  const segments: string[] = [];

  if (brand) segments.push(brand);
  if (model) segments.push(model);
  if (generation) segments.push(generation);
  else if (yearRange) segments.push(yearRange);
  for (const token of variantTokens) {
    if (!segments.some((s) => s.toUpperCase().includes(token))) {
      segments.push(token);
    }
  }
  if (partDe) segments.push(partDe);
  if (placementDe) segments.push(placementDe);

  let title = segments.join(' ');

  if (pn && title.length + pn.length + 5 <= EBAY_TITLE_MAX_LENGTH) {
    title += ` OEM ${pn}`;
  } else if (pn) {
    title += ` ${pn}`;
  }

  const material = input.material?.trim();
  const color = input.color?.trim();
  if (color && title.length + color.length + 1 <= EBAY_TITLE_MAX_LENGTH - 12) {
    title += ` ${color}`;
  } else if (
    material &&
    title.length + material.length + 1 <= EBAY_TITLE_MAX_LENGTH - 12
  ) {
    title += ` ${material}`;
  }

  if (title.length + 18 <= EBAY_TITLE_MAX_LENGTH) {
    title += ' Original gebraucht';
  } else if (title.length + 10 <= EBAY_TITLE_MAX_LENGTH) {
    title += ' gebraucht';
  }

  if (
    !title.toLowerCase().includes('gebraucht') &&
    !title.toLowerCase().includes('neu')
  ) {
    title += conditionDe === 'neu' ? ' neu' : ' gebraucht';
  }

  return truncateGermanTitle(title.replace(/\s+/g, ' ').trim());
}

export function buildGermanListingSubtitle(
  input: GermanListingInput,
): string | null {
  const pn = (input.oemPartNumber ?? input.mpn ?? '').trim();
  if (!pn) return null;
  const sub = `Teilenummer ${pn} — bitte vor Kauf vergleichen`;
  return sub.length <= 55 ? sub : sub.slice(0, 52) + '...';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildFitmentSection(input: GermanListingInput): string {
  const rows = input.fitmentRows ?? [];
  if (!rows.length) {
    return `<p><strong>Kompatibilität:</strong> Die Fahrzeugverwendung dient nur als Orientierung. Bitte prüfen Sie vor dem Kauf die Teilenummer und vergleichen Sie die Bilder mit Ihrem Altteil.</p>`;
  }

  const list = rows
    .slice(0, 8)
    .map(
      (r) =>
        `<li>${escapeHtml([r.year, r.make, r.model, r.trim].filter(Boolean).join(' '))}</li>`,
    )
    .join('');

  const confirmed = input.fitmentConfirmed
    ? 'Bestätigte eBay-Kompatibilitätseinträge liegen vor.'
    : 'Passgenauigkeit basiert auf Spenderfahrzeug / Herstellerangaben — bitte Teilenummer verifizieren.';

  return `<h3>Passgenauigkeit</h3>
<p>${confirmed}</p>
<ul>${list}</ul>
<p>Bitte prüfen Sie vor dem Kauf die Teilenummer und vergleichen Sie die Bilder mit Ihrem Altteil. Die Fahrzeugverwendung dient nur als Orientierung.</p>`;
}

function buildShippingSection(
  sellerCountry: string | null | undefined,
): string {
  const country = (sellerCountry ?? 'US').trim().toUpperCase();
  if (country === 'DE') {
    return `<h3>Versand &amp; Rückgabe</h3>
<ul>
  <li>Versand innerhalb Deutschlands — Lieferzeit je nach Zone.</li>
  <li>Rückgabe gemäß eBay-Richtlinien und hinterlegter Rückgaberichtlinie.</li>
</ul>`;
  }
  return `<h3>Versand &amp; Rückgabe</h3>
<ul>
  <li><strong>Artikelstandort:</strong> Vereinigte Staaten (USA) — internationaler Versand nach Deutschland.</li>
  <li>Die Lieferzeit kann variieren; Zoll, Einfuhrumsatzsteuer und Gebühren können anfallen (Käuferpflicht).</li>
  <li>Rückgabe gemäß eBay-Richtlinien und hinterlegter Rückgaberichtlinie.</li>
</ul>`;
}

/** Structured German HTML description for eBay.de */
export function buildGermanListingDescription(
  input: GermanListingInput,
): string {
  const partDe = translatePartNameToGerman(input.partType);
  const placementDe = formatGermanPlacement(input.placement);
  const pn = (input.oemPartNumber ?? input.mpn ?? '').trim();
  const conditionDe = formatGermanCondition(input.condition);
  const donor = input.donorVehicle?.trim();

  const overviewParts = [
    `<strong>${escapeHtml(partDe)}</strong>`,
    placementDe ? `Einbauposition: ${escapeHtml(placementDe)}` : null,
    pn ? `Teilenummer: ${escapeHtml(pn)}` : null,
    `Zustand: Gebrauchter Originalartikel (${conditionDe}) mit normalen Gebrauchsspuren`,
  ].filter(Boolean);

  const wear = input.wearNotes?.trim()
    ? `<p><strong>Zustandshinweise:</strong> ${escapeHtml(input.wearNotes)}</p>`
    : `<p>Gebrauchter Originalartikel mit normalen Gebrauchsspuren. Die Bilder zeigen den tatsächlichen Artikel, sofern zutreffend.</p>`;

  const donorBlock = donor
    ? `<p><strong>Spenderfahrzeug:</strong> ${escapeHtml(donor)} (nur zur Orientierung).</p>`
    : '';

  return `<h3>Artikelbeschreibung</h3>
<p>${overviewParts.join(' · ')}</p>
${donorBlock}
${wear}
${buildFitmentSection(input)}
<p><strong>Wichtiger Hinweis:</strong> Bitte vergleichen Sie die Teilenummer vor dem Kauf. Bei Fragen zur Kompatibilität bitte vor dem Kauf kontaktieren.</p>
${buildShippingSection(input.sellerCountry)}`;
}

/** German eBay Motors item specifics (omit unknown fields). */
export function buildGermanItemSpecifics(
  input: GermanListingInput,
): Record<string, string> {
  const specifics: Record<string, string> = {};
  const set = (key: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (v) specifics[key] = v;
  };

  set('Hersteller', input.brand);
  set('Herstellernummer', input.mpn);
  set('OE/OEM Referenznummer(n)', input.oemPartNumber ?? input.mpn);
  set('Produktart', translatePartNameToGerman(input.partType));
  set('Einbauposition', formatGermanPlacement(input.placement));
  set('Material', input.material);
  set('Farbe', input.color);
  set('Zustand', 'Gebraucht');
  set('Universelle Kompatibilität', 'Nein');
  set('Oldtimer-Teil', 'Nein');
  set('Fahrzeugmarke', input.brand);
  set('Modell', input.model);
  if (input.yearRange) set('Baujahrbereich', input.yearRange);
  if (input.generation) set('Plattform/Generation', input.generation);

  return specifics;
}

export function validateGermanListing(params: {
  title: string;
  description: string;
  itemSpecifics: Record<string, string>;
  categoryId?: string | null;
  categoryName?: string | null;
  partType?: string | null;
  placement?: string | null;
  mpn?: string | null;
  oemPartNumber?: string | null;
}): GermanListingValidationResult {
  const issues: GermanListingValidationIssue[] = [];
  const title = params.title?.trim() ?? '';
  const description = params.description?.trim() ?? '';

  if (!title) {
    issues.push({
      code: 'DE_TITLE_MISSING',
      severity: 'error',
      field: 'title',
      message: 'German title is missing',
    });
  } else if (title.length > EBAY_TITLE_MAX_LENGTH) {
    issues.push({
      code: 'DE_TITLE_TOO_LONG',
      severity: 'error',
      field: 'title',
      message: 'Title exceeds 80 characters',
    });
  }
  if (title && !isLikelyGermanText(title)) {
    issues.push({
      code: 'DE_TITLE_NOT_GERMAN',
      severity: 'warning',
      field: 'title',
      message: 'Title does not appear to be native German',
    });
  }
  if (title && hasAwkwardGermanPhrasing(title)) {
    issues.push({
      code: 'DE_TITLE_AWKWARD',
      severity: 'warning',
      field: 'title',
      message: 'Title contains awkward translated phrasing',
    });
  }

  const anchorYear = params.itemSpecifics['Baujahrbereich']?.slice(0, 4);
  const generationCheck = validateGenerationYearAlignment({
    generation: params.itemSpecifics['Plattform/Generation'],
    yearRange: params.itemSpecifics['Baujahrbereich'],
    make:
      params.itemSpecifics['Fahrzeugmarke'] ??
      params.itemSpecifics['Hersteller'],
    model: params.itemSpecifics['Modell'],
    anchorYear,
  });
  if (!generationCheck.valid) {
    issues.push({
      code: 'DE_GENERATION_YEAR_MISMATCH',
      severity: 'error',
      field: 'title',
      message: generationCheck.message ?? 'Generation and year range conflict',
    });
  }

  const titleMismatch = detectTitleGenerationMismatch(
    title,
    params.itemSpecifics['Fahrzeugmarke'] ?? params.itemSpecifics['Hersteller'],
    params.itemSpecifics['Modell'],
    anchorYear,
  );
  if (titleMismatch) {
    issues.push({
      code: 'DE_TITLE_GENERATION_MISMATCH',
      severity: 'error',
      field: 'title',
      message: titleMismatch,
    });
  }

  if (!description || description.replace(/<[^>]+>/g, '').trim().length < 120) {
    issues.push({
      code: 'DE_DESCRIPTION_THIN',
      severity: 'error',
      field: 'description',
      message: 'German description is empty or too short',
    });
  } else if (!isLikelyGermanText(description)) {
    issues.push({
      code: 'DE_DESCRIPTION_NOT_GERMAN',
      severity: 'warning',
      field: 'description',
      message: 'Description may not be in German',
    });
  }

  const pn = params.oemPartNumber ?? params.mpn;
  if (
    pn?.trim() &&
    !params.itemSpecifics['Herstellernummer'] &&
    !params.itemSpecifics['OE/OEM Referenznummer(n)']
  ) {
    issues.push({
      code: 'DE_OEM_SPECIFIC_MISSING',
      severity: 'warning',
      field: 'itemSpecifics',
      message: 'OEM/MPN not reflected in German item specifics',
    });
  }

  const placementDe = formatGermanPlacement(params.placement);
  const titlePlacement =
    placementDe && title.toLowerCase().includes(placementDe.toLowerCase());
  const specPlacement = params.itemSpecifics['Einbauposition'];
  if (
    placementDe &&
    specPlacement &&
    !titlePlacement &&
    !specPlacement.toLowerCase().includes(placementDe.split(' ')[0])
  ) {
    issues.push({
      code: 'DE_PLACEMENT_INCONSISTENT',
      severity: 'warning',
      field: 'placement',
      message: 'Placement differs between title and item specifics',
    });
  }

  const hint = resolveMotorsCategoryFromPart(params.partType, params.placement);
  if (hint && params.categoryId && params.categoryId !== hint.categoryId) {
    const interiorPart = hint.categoryId === '33695';
    const exteriorCats = new Set(['33697', '174105']);
    if (interiorPart && exteriorCats.has(params.categoryId)) {
      issues.push({
        code: 'DE_CATEGORY_MISMATCH',
        severity: 'error',
        field: 'categoryId',
        message: `Interior trim part mapped to exterior category (${params.categoryName ?? params.categoryId})`,
      });
    }
  }

  return { valid: !issues.some((i) => i.severity === 'error'), issues };
}
