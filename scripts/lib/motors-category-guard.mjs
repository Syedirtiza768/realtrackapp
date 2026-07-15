/**
 * eBay Motors category keyword map for the pipeline.
 * Mirrors the safe keyword-driven categories used in the backend so the
 * enrichment pipeline never emits non-Motors categories.
 */

export const MOTORS_CATEGORY_KEYWORDS = [
  { kw: ['door body', 'door shell', 'complete door', 'door assembly'], id: '179850', name: 'Doors & Door Skins' },
  { kw: ['center console', 'armrest console', 'console lid'], id: '262189', name: 'Center & Overhead Console Parts' },
  { kw: ['door armrest', 'door finisher', 'inner panel', 'interior door', 'door panel', 'door trim'], id: '33696', name: 'Door Panels' },
  { kw: ['radiator', 'support radiator'], id: '33602', name: 'Radiators' },
  { kw: ['fastener', 'hardware', 'bolt', 'screw', 'nut', 'clip', 'rivet'], id: '174907', name: 'Nuts, Bolts & Fasteners' },
  { kw: ['seat belt', 'safety belt', 'belt buckle'], id: '33725', name: 'Seat Belts & Parts' },
  { kw: ['seat', 'seat frame', 'seat cover', 'seat padding', 'backrest', 'headrest', 'lumbar'], id: '33701', name: 'Seats' },
  { kw: ['door handle'], id: '179851', name: 'Door Handles' },
  { kw: ['window regulator', 'window motor'], id: '33706', name: 'Window Motors & Regulators' },
  { kw: ['window seal', 'window slot', 'window aperture', 'weatherstrip'], id: '33705', name: 'Trim' },
  { kw: ['mirror', 'side mirror', 'door mirror'], id: '262161', name: 'Mirror Assemblies' },
  { kw: ['trim', 'pillar trim', 'a-pillar', 'b-pillar', 'c-pillar', 'd-pillar', 'roof trim'], id: '33704', name: 'Interior Trim' },
  { kw: ['dashboard', 'dash panel', 'instrument cluster', 'gauge'], id: '33637', name: 'Gauges' },
  { kw: ['switch', 'button', 'knob', 'control unit', 'control module', 'bcm', 'ecu', 'relay'], id: '33716', name: 'Switches & Controls' },
  { kw: ['light', 'tail light', 'headlight', 'fog light', 'turn signal', 'side marker'], id: '33712', name: 'Lighting & Lamps' },
  { kw: ['bumper', 'bumper trim', 'emblem', 'grille'], id: '33637', name: 'Body & Exterior' },
  { kw: ['fender', 'quarter panel', 'side panel', 'door body', 'hood', 'trunk', 'deck lid'], id: '33637', name: 'Body & Exterior' },
  { kw: ['sunroof', 'moonroof', 'glass roof'], id: '40054', name: 'Sunroofs, Hard Tops & Soft Tops' },
  { kw: ['floor mat', 'floor covering', 'carpet'], id: '40053', name: 'Floor Mats & Carpets' },
  { kw: ['luggage', 'cargo cover', 'trunk liner', 'cargo net'], id: '33704', name: 'Interior Trim' },
  { kw: ['roof rack', 'cross bar', 'cargo carrier'], id: '40055', name: 'Roof Racks & Carriers' },
  { kw: ['wheel', 'rim', 'tire', 'hubcap'], id: '33714', name: 'Wheels, Tires & Parts' },
  { kw: ['brake', 'brake pad', 'brake rotor', 'brake caliper'], id: '33595', name: 'Brake Pads & Shoes' },
  { kw: ['suspension', 'strut', 'shock', 'control arm', 'ball joint'], id: '33593', name: 'Suspension & Steering' },
  { kw: ['engine', 'motor', 'piston', 'cylinder', 'head gasket'], id: '33600', name: 'Engines & Components' },
  { kw: ['transmission', 'gearbox', 'clutch'], id: '33597', name: 'Transmission & Drivetrain' },
  { kw: ['exhaust', 'muffler', 'catalytic converter'], id: '33638', name: 'Exhaust' },
  { kw: ['air bag', 'airbag', 'srs'], id: '40059', name: 'Air Bags' },
  { kw: ['radio', 'stereo', 'amplifier', 'speaker', 'navigation', 'gps', 'antenna'], id: '40052', name: 'Audio & Video' },
  { kw: ['sun visor', 'visor'], id: '33704', name: 'Interior Trim' },
  { kw: ['ashtray', 'cigarette lighter'], id: '33704', name: 'Interior Trim' },
  { kw: ['handle', 'grab handle', 'operating lever'], id: '33704', name: 'Interior Trim' },
  { kw: ['insulation', 'sound absorber', 'deadener'], id: '33704', name: 'Interior Trim' },
  { kw: ['cover plate', 'cover', 'cap', 'plug'], id: '33704', name: 'Interior Trim' },
  { kw: ['reinforcement', 'bracket', 'mount', 'support', 'web plate'], id: '33704', name: 'Interior Trim' },
  { kw: ['warning triangle', 'first aid', 'emergency'], id: '40062', name: 'Emergency & Safety' },
  { kw: [' refrigerant', 'receiver drier', 'ac', 'a/c', 'air conditioning'], id: '33710', name: 'A/C & Heater' },
  { kw: ['usb', 'aux', 'microphone', 'sd card', 'memory card'], id: '40052', name: 'Audio & Video' },
];

export const FALLBACK_MOTORS_CATEGORY = {
  id: '9886',
  name: 'Other Car & Truck Parts & Accessories',
};

const TRUSTED_KEYWORD_CATEGORY_IDS = new Set([
  '179850',
  '262189',
  '33696',
  '33602',
  '174907',
  '33725',
  '33701',
  '179851',
  '33706',
  '33705',
  '262161',
]);

const BAD_CATEGORY_NAMES = /\b(automotive|books|magazines|merchandise|vintage|antique|collectibles|toys|hobbies|coins|slot\s*machines|models?|motorcycles|atv|utv|scooter|boat|marine|aircraft|plane|industrial|business|computer|electronics|commercial\s+truck|clothing|shoes|jewelry|cell\s*phone|camera|pet|baby|health|beauty|dialysis|medical|home|garden|craft|art|sporting|tickets|travel|gift|collectible|entertainment|musical|instrument|dvd|movie|music|game|video|toy|doll|bear|stamps|coins|pottery|glass|art)\b/i;

const BAD_CATEGORY_IDS = new Set(['6000', '262124', '262320']);

const UNTRUSTED_GENERIC_PART_IDENTITIES = new Set([
  'automotive',
  'misc',
  'miscellaneous',
  'not specified',
  'oem part',
  'other',
  'part',
  'parts',
  'unknown',
]);

export function isBadCategoryName(name) {
  if (!name) return true;
  return BAD_CATEGORY_NAMES.test(String(name));
}

export function isUntrustedGenericPartIdentity(partName) {
  const normalized = String(partName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return UNTRUSTED_GENERIC_PART_IDENTITIES.has(normalized);
}

export function resolveMotorsCategoryFromKeywords(partName, note = '') {
  const text = `${partName || ''} ${note || ''}`.toLowerCase();
  if (!text.trim()) return null;
  let best = null;
  for (const row of MOTORS_CATEGORY_KEYWORDS) {
    const matchedKeyword = row.kw.find((kw) => text.includes(kw.toLowerCase()));
    if (!matchedKeyword) continue;
    if (!best || matchedKeyword.length > best.keywordLength) {
      best = {
        categoryId: row.id,
        categoryName: row.name,
        keywordLength: matchedKeyword.length,
      };
    }
  }
  return best
    ? { categoryId: best.categoryId, categoryName: best.categoryName }
    : null;
}

export function getSafeMotorsCategory(category, partName, note = '') {
  const keywordMatch = resolveMotorsCategoryFromKeywords(partName, note);
  if (
    keywordMatch &&
    TRUSTED_KEYWORD_CATEGORY_IDS.has(keywordMatch.categoryId)
  ) {
    return { ...keywordMatch, source: 'keyword-guard' };
  }
  if (isUntrustedGenericPartIdentity(partName)) {
    return { ...FALLBACK_MOTORS_CATEGORY, source: 'generic-identity-guard' };
  }
  if (
    category &&
    !BAD_CATEGORY_IDS.has(String(category.categoryId)) &&
    !isBadCategoryName(category.categoryName) &&
    category.categoryId
  ) {
    return category;
  }
  return { ...FALLBACK_MOTORS_CATEGORY, source: 'fallback' };
}

export default {
  MOTORS_CATEGORY_KEYWORDS,
  FALLBACK_MOTORS_CATEGORY,
  isBadCategoryName,
  isUntrustedGenericPartIdentity,
  resolveMotorsCategoryFromKeywords,
  getSafeMotorsCategory,
};
