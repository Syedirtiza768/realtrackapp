/**
 * Native German eBay Motors listing helpers (pipeline script).
 * Keep in sync with backend/src/channels/ebay/ebay-german-listing.util.ts
 */

const PART_NAME_DE = {
  armrest: 'Armlehne',
  'door armrest': 'Armlehne',
  'arm rest': 'Armlehne',
  'door trim': 'Türverkleidung',
  'interior door panel': 'Innentürverkleidung',
  'door panel': 'Türverkleidung',
};

const PLACEMENT_TOKEN_DE = {
  front: 'vorne',
  rear: 'hinten',
  back: 'hinten',
  left: 'links',
  right: 'rechts',
  upper: 'oben',
  lower: 'unten',
  driver: 'Fahrerseite',
  passenger: 'Beifahrerseite',
};

export function translatePartNameToGerman(partType) {
  const raw = String(partType || '').trim();
  if (!raw) return 'Autoteil';
  const lower = raw.toLowerCase();
  for (const [en, de] of Object.entries(PART_NAME_DE)) {
    if (lower === en || lower.includes(en)) return de;
  }
  return raw;
}

export function formatGermanPlacement(placement) {
  if (!placement?.trim()) return '';
  const lower = String(placement).toLowerCase();
  const hasFront = /\b(front|vorne)\b/.test(lower);
  const hasRear = /\b(rear|back|hinten)\b/.test(lower);
  const hasLeft = /\b(left|links|lh|driver)\b/.test(lower);
  const hasRight = /\b(right|rechts|rh|passenger)\b/.test(lower);
  const parts = [];
  if (hasFront) parts.push('vorne');
  else if (hasRear) parts.push('hinten');
  if (hasLeft) parts.push('links');
  else if (hasRight) parts.push('rechts');
  if (parts.length) return parts.join(' ');
  let out = String(placement);
  for (const [en, de] of Object.entries(PLACEMENT_TOKEN_DE)) {
    out = out.replace(new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), de);
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function buildGermanSeoTitle({ vehicle, part, partNumber, placement, condition = 'Used' }) {
  const brand = vehicle?.make || part?.brand || '';
  const model = vehicle?.model || '';
  const partDe = translatePartNameToGerman(part?._shortPartName || part?.partName);
  const placementDe = formatGermanPlacement(placement || part?.note || '');
  const pn = String(partNumber || part?.partNumber || '').trim();
  const segments = [brand, model, partDe, placementDe].filter(Boolean);
  let title = segments.join(' ');
  if (pn && title.length + pn.length + 5 <= 75) title += ` OEM ${pn}`;
  else if (pn) title += ` ${pn}`;
  if (title.length + 18 <= 80) title += ' Original gebraucht';
  else if (!/gebraucht/i.test(title)) title += ' gebraucht';
  return title.replace(/\s+/g, ' ').slice(0, 80).trim();
}

export function buildGermanBasicDescription({ part, vehicle, partNumber, placement, wearNotes }) {
  const partDe = translatePartNameToGerman(part?._shortPartName || part?.partName);
  const placementDe = formatGermanPlacement(placement || part?.note || '');
  const pn = String(partNumber || part?.partNumber || '').trim();
  const donor = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
  const wear = wearNotes
    ? `Zustandshinweise: ${wearNotes}.`
    : 'Gebrauchter Originalartikel mit normalen Gebrauchsspuren. Die Bilder zeigen den tatsächlichen Artikel, sofern zutreffend.';

  return [
    `${partDe}${placementDe ? ` (${placementDe})` : ''}${pn ? ` — Teilenummer ${pn}` : ''}.`,
    donor ? `Spenderfahrzeug: ${donor} (nur zur Orientierung).` : '',
    wear,
    'Bitte prüfen Sie vor dem Kauf die Teilenummer und vergleichen Sie die Bilder mit Ihrem Altteil. Die Fahrzeugverwendung dient nur als Orientierung.',
    'Artikelstandort: Vereinigte Staaten (USA). Internationaler Versand nach Deutschland. Lieferzeit kann variieren; Zoll und Einfuhrsteuern können anfallen.',
    'Bei Fragen zur Kompatibilität bitte vor dem Kauf kontaktieren.',
  ].filter(Boolean).join(' ');
}

export function buildGermanItemSpecifics({ part, vehicle, partNumber, placement }) {
  const pn = String(partNumber || part?.partNumber || '').trim();
  const out = {};
  const set = (k, v) => { if (v?.trim()) out[k] = String(v).trim(); };
  set('Hersteller', vehicle?.make || part?.brand);
  set('Herstellernummer', pn);
  set('OE/OEM Referenznummer(n)', pn);
  set('Produktart', translatePartNameToGerman(part?._shortPartName || part?.partName));
  set('Einbauposition', formatGermanPlacement(placement || part?.note || ''));
  set('Zustand', 'Gebraucht');
  set('Universelle Kompatibilität', 'Nein');
  set('Oldtimer-Teil', 'Nein');
  set('Fahrzeugmarke', vehicle?.make || part?.brand);
  set('Modell', vehicle?.model);
  return out;
}

export function resolveMotorsCategoryFromPart(partName, note) {
  const text = `${partName || ''} ${note || ''}`.toLowerCase();
  if (/\b(interior|innen|armrest|armlehne|trim|verkleidung|finisher)\b/i.test(text) && /\bdoor panel\b/i.test(text) && !/\bexterior\b/i.test(text)) {
    return { categoryId: '33695', categoryName: 'Interior Door Panels & Parts' };
  }
  const rows = [
    { kw: ['armrest', 'armlehne', 'türverkleidung', 'door armrest', 'inner panel'], id: '33695', name: 'Interior Door Panels & Parts' },
    { kw: ['interior door', 'door moulding', 'door trim'], id: '33695', name: 'Interior Door Panels & Parts' },
    { kw: ['exterior door panel', 'door skin', 'door shell'], id: '33697', name: 'Exterior Door Panels & Frames' },
    { kw: ['complete door', 'door assembly'], id: '174105', name: 'Doors & Door Parts' },
  ];
  for (const row of rows) {
    if (row.kw.some((kw) => text.includes(kw))) return { categoryId: row.id, categoryName: row.name };
  }
  return null;
}

export function isLikelyGermanText(text) {
  return /[äöüßÄÖÜ]/.test(text) || /\b(OEM|Original|gebraucht|hinten|vorne|Teilenummer|Armlehne)\b/i.test(text);
}
