/**
 * Fashion measurement chart templates.
 *
 * Single source of truth for garment-specific measurement points (A, B, C…),
 * the attribute keys they are stored under on `catalog_products.vertical_attributes`,
 * and the schematic diagram used both in the editor and in the generated size-chart
 * image. The frontend loads these through `GET /api/fashion/measurement-templates`.
 *
 * Measurements are always entered by a person with a tape or ruler. They are never
 * inferred from photos (see the vision prompt in fashion-image-analysis.service.ts).
 */
import type { FashionCategoryFamily } from './fashion.config.js';

export type FashionMeasurementUnit = 'cm' | 'in';

export type FashionMeasurementPoint = {
  letter: string;
  key: string;
  label: string;
  /** Diagram arrow in a 400x320 viewBox: x1, y1, x2, y2. */
  line: [number, number, number, number];
  /** Letter position in the same viewBox. */
  labelAt: [number, number];
};

export type FashionMeasurementTemplate = {
  id: string;
  label: string;
  chartTitle: string;
  family: FashionCategoryFamily;
  /** Item-type words used to pre-select this template after identification. */
  keywords: string[];
  diagram: FashionDiagramId;
  points: FashionMeasurementPoint[];
};

type FashionDiagramId =
  | 'top'
  | 'longsleeve'
  | 'dress'
  | 'pants'
  | 'shorts'
  | 'skirt'
  | 'bag'
  | 'cap'
  | 'shoe';

const DIAGRAM_SHAPES: Record<FashionDiagramId, string[]> = {
  top: [
    'M170,40 Q200,64 230,40 L262,50 L322,112 L296,140 L256,116 L256,292 L144,292 L144,116 L104,140 L78,112 L138,50 Z',
  ],
  longsleeve: [
    'M170,40 Q200,64 230,40 L262,50 L330,250 L304,258 L256,122 L256,292 L144,292 L144,122 L96,258 L70,250 L138,50 Z',
  ],
  dress: [
    'M176,30 Q200,48 224,30 L244,36 L250,118 L236,150 L302,300 L98,300 L164,150 L150,118 L156,36 Z',
  ],
  pants: ['M140,30 L260,30 L276,300 L214,300 L200,112 L186,300 L124,300 Z'],
  shorts: ['M140,40 L260,40 L276,190 L214,190 L200,122 L186,190 L124,190 Z'],
  skirt: ['M150,40 L250,40 L292,282 L108,282 Z'],
  bag: [
    'M110,120 L290,120 L290,282 L110,282 Z',
    'M290,120 L322,98 L322,258 L290,282 Z',
    'M150,120 Q200,18 250,120',
  ],
  cap: [
    'M110,200 Q110,70 215,70 Q320,70 320,200 Z',
    'M250,200 L372,214 Q310,236 250,214 Z',
  ],
  shoe: [
    'M60,238 L60,170 Q66,118 116,110 L176,110 L198,160 Q282,170 340,200 Q364,216 352,240 L100,240 L100,262 L60,262 Z',
  ],
};

export const FASHION_MEASUREMENT_TEMPLATES: FashionMeasurementTemplate[] = [
  {
    id: 'tshirt',
    label: 'T-shirt / top',
    chartTitle: 'Tops',
    family: 'clothing',
    keywords: [
      't-shirt',
      'tshirt',
      'tee',
      'top',
      'polo',
      'tank',
      'blouse',
      'camisole',
      'jersey',
    ],
    diagram: 'top',
    points: [
      {
        letter: 'A',
        key: 'shoulderMeasurement',
        label: 'Shoulder width',
        line: [138, 30, 262, 30],
        labelAt: [200, 22],
      },
      {
        letter: 'B',
        key: 'chestMeasurement',
        label: 'Chest / bust (pit to pit)',
        line: [146, 130, 254, 130],
        labelAt: [200, 124],
      },
      {
        letter: 'C',
        key: 'sleeveMeasurement',
        label: 'Sleeve length',
        line: [268, 40, 328, 102],
        labelAt: [310, 60],
      },
      {
        letter: 'D',
        key: 'bodyLengthMeasurement',
        label: 'Body length',
        line: [172, 48, 172, 290],
        labelAt: [186, 220],
      },
      {
        letter: 'E',
        key: 'sleeveWidthMeasurement',
        label: 'Sleeve width',
        line: [292, 136, 318, 110],
        labelAt: [322, 136],
      },
    ],
  },
  {
    id: 'shirt',
    label: 'Shirt / long sleeve / sweater',
    chartTitle: 'Shirts & Knitwear',
    family: 'clothing',
    keywords: [
      'shirt',
      'button',
      'long sleeve',
      'sweater',
      'jumper',
      'cardigan',
      'sweatshirt',
      'pullover',
    ],
    diagram: 'longsleeve',
    points: [
      {
        letter: 'A',
        key: 'shoulderMeasurement',
        label: 'Shoulder width',
        line: [138, 30, 262, 30],
        labelAt: [200, 22],
      },
      {
        letter: 'B',
        key: 'chestMeasurement',
        label: 'Chest / bust (pit to pit)',
        line: [146, 136, 254, 136],
        labelAt: [200, 130],
      },
      {
        letter: 'C',
        key: 'sleeveMeasurement',
        label: 'Sleeve length',
        line: [274, 44, 344, 242],
        labelAt: [322, 130],
      },
      {
        letter: 'D',
        key: 'bodyLengthMeasurement',
        label: 'Body length',
        line: [172, 48, 172, 290],
        labelAt: [186, 220],
      },
      {
        letter: 'E',
        key: 'sleeveWidthMeasurement',
        label: 'Cuff width',
        line: [302, 268, 330, 260],
        labelAt: [318, 286],
      },
    ],
  },
  {
    id: 'outerwear',
    label: 'Jacket / coat / hoodie',
    chartTitle: 'Outerwear',
    family: 'clothing',
    keywords: [
      'jacket',
      'coat',
      'hoodie',
      'parka',
      'blazer',
      'vest',
      'gilet',
      'windbreaker',
      'fleece',
    ],
    diagram: 'longsleeve',
    points: [
      {
        letter: 'A',
        key: 'shoulderMeasurement',
        label: 'Shoulder width',
        line: [138, 30, 262, 30],
        labelAt: [200, 22],
      },
      {
        letter: 'B',
        key: 'chestMeasurement',
        label: 'Chest (pit to pit)',
        line: [146, 136, 254, 136],
        labelAt: [200, 130],
      },
      {
        letter: 'C',
        key: 'sleeveMeasurement',
        label: 'Sleeve length',
        line: [274, 44, 344, 242],
        labelAt: [322, 130],
      },
      {
        letter: 'D',
        key: 'bodyLengthMeasurement',
        label: 'Body length',
        line: [172, 48, 172, 290],
        labelAt: [186, 220],
      },
      {
        letter: 'E',
        key: 'hemMeasurement',
        label: 'Hem width',
        line: [144, 306, 256, 306],
        labelAt: [200, 300],
      },
    ],
  },
  {
    id: 'dress',
    label: 'Dress / jumpsuit',
    chartTitle: 'Dresses',
    family: 'clothing',
    keywords: ['dress', 'gown', 'jumpsuit', 'romper', 'playsuit', 'kaftan'],
    diagram: 'dress',
    points: [
      {
        letter: 'A',
        key: 'shoulderMeasurement',
        label: 'Shoulder width',
        line: [156, 20, 244, 20],
        labelAt: [200, 14],
      },
      {
        letter: 'B',
        key: 'chestMeasurement',
        label: 'Bust (pit to pit)',
        line: [152, 96, 248, 96],
        labelAt: [200, 90],
      },
      {
        letter: 'C',
        key: 'waistMeasurement',
        label: 'Waist',
        line: [166, 150, 234, 150],
        labelAt: [200, 144],
      },
      {
        letter: 'D',
        key: 'hipMeasurement',
        label: 'Hip',
        line: [140, 210, 260, 210],
        labelAt: [200, 204],
      },
      {
        letter: 'E',
        key: 'lengthMeasurement',
        label: 'Total length',
        line: [330, 30, 330, 300],
        labelAt: [344, 170],
      },
    ],
  },
  {
    id: 'pants',
    label: 'Pants / jeans',
    chartTitle: 'Pants',
    family: 'clothing',
    keywords: [
      'pants',
      'trousers',
      'jeans',
      'chinos',
      'joggers',
      'leggings',
      'slacks',
      'cargo',
    ],
    diagram: 'pants',
    points: [
      {
        letter: 'A',
        key: 'waistMeasurement',
        label: 'Waist (flat)',
        line: [140, 20, 260, 20],
        labelAt: [200, 14],
      },
      {
        letter: 'B',
        key: 'hipMeasurement',
        label: 'Hip (flat)',
        line: [137, 80, 263, 80],
        labelAt: [166, 70],
      },
      {
        letter: 'C',
        key: 'riseMeasurement',
        label: 'Front rise',
        line: [200, 32, 200, 110],
        labelAt: [212, 100],
      },
      {
        letter: 'D',
        key: 'inseamMeasurement',
        label: 'Inseam',
        line: [202, 116, 216, 298],
        labelAt: [226, 220],
      },
      {
        letter: 'E',
        key: 'legOpeningMeasurement',
        label: 'Leg opening',
        line: [214, 310, 276, 310],
        labelAt: [245, 304],
      },
    ],
  },
  {
    id: 'shorts',
    label: 'Shorts',
    chartTitle: 'Shorts',
    family: 'clothing',
    keywords: ['shorts', 'bermuda', 'trunks', 'boardshorts'],
    diagram: 'shorts',
    points: [
      {
        letter: 'A',
        key: 'waistMeasurement',
        label: 'Waist (flat)',
        line: [140, 30, 260, 30],
        labelAt: [200, 24],
      },
      {
        letter: 'B',
        key: 'hipMeasurement',
        label: 'Hip (flat)',
        line: [136, 90, 264, 90],
        labelAt: [166, 80],
      },
      {
        letter: 'C',
        key: 'riseMeasurement',
        label: 'Front rise',
        line: [200, 42, 200, 120],
        labelAt: [212, 112],
      },
      {
        letter: 'D',
        key: 'inseamMeasurement',
        label: 'Inseam',
        line: [202, 126, 213, 188],
        labelAt: [226, 166],
      },
      {
        letter: 'E',
        key: 'legOpeningMeasurement',
        label: 'Leg opening',
        line: [214, 202, 276, 202],
        labelAt: [245, 216],
      },
    ],
  },
  {
    id: 'skirt',
    label: 'Skirt',
    chartTitle: 'Skirts',
    family: 'clothing',
    keywords: ['skirt', 'mini', 'midi', 'maxi skirt'],
    diagram: 'skirt',
    points: [
      {
        letter: 'A',
        key: 'waistMeasurement',
        label: 'Waist (flat)',
        line: [150, 30, 250, 30],
        labelAt: [200, 24],
      },
      {
        letter: 'B',
        key: 'hipMeasurement',
        label: 'Hip (flat)',
        line: [140, 110, 260, 110],
        labelAt: [200, 104],
      },
      {
        letter: 'C',
        key: 'lengthMeasurement',
        label: 'Length',
        line: [320, 40, 320, 282],
        labelAt: [334, 170],
      },
    ],
  },
  {
    id: 'bag',
    label: 'Bag',
    chartTitle: 'Bags',
    family: 'accessories',
    keywords: [
      'bag',
      'handbag',
      'tote',
      'backpack',
      'purse',
      'clutch',
      'satchel',
      'crossbody',
      'wallet',
    ],
    diagram: 'bag',
    points: [
      {
        letter: 'A',
        key: 'bagWidthMeasurement',
        label: 'Width',
        line: [110, 298, 290, 298],
        labelAt: [200, 314],
      },
      {
        letter: 'B',
        key: 'bagHeightMeasurement',
        label: 'Height',
        line: [92, 120, 92, 282],
        labelAt: [78, 204],
      },
      {
        letter: 'C',
        key: 'bagDepthMeasurement',
        label: 'Depth',
        line: [296, 296, 328, 274],
        labelAt: [330, 298],
      },
      {
        letter: 'D',
        key: 'strapDropMeasurement',
        label: 'Strap drop',
        line: [200, 70, 200, 118],
        labelAt: [214, 98],
      },
    ],
  },
  {
    id: 'cap',
    label: 'Cap / hat',
    chartTitle: 'Caps & Hats',
    family: 'accessories',
    keywords: ['cap', 'hat', 'beanie', 'snapback', 'bucket', 'visor', 'fedora'],
    diagram: 'cap',
    points: [
      {
        letter: 'A',
        key: 'headCircumferenceMeasurement',
        label: 'Head circumference',
        line: [110, 250, 320, 250],
        labelAt: [215, 266],
      },
      {
        letter: 'B',
        key: 'brimLengthMeasurement',
        label: 'Brim length',
        line: [252, 232, 372, 232],
        labelAt: [340, 248],
      },
      {
        letter: 'C',
        key: 'crownHeightMeasurement',
        label: 'Crown height',
        line: [92, 72, 92, 200],
        labelAt: [78, 138],
      },
    ],
  },
  {
    id: 'shoes',
    label: 'Shoes / boots',
    chartTitle: 'Footwear',
    family: 'footwear',
    keywords: [
      'shoe',
      'shoes',
      'sneaker',
      'trainer',
      'boot',
      'boots',
      'heel',
      'sandal',
      'loafer',
      'slipper',
    ],
    diagram: 'shoe',
    points: [
      {
        letter: 'A',
        key: 'insoleLengthMeasurement',
        label: 'Insole length',
        line: [60, 284, 352, 284],
        labelAt: [206, 300],
      },
      {
        letter: 'B',
        key: 'outsoleWidthMeasurement',
        label: 'Outsole width (widest point)',
        line: [300, 176, 330, 222],
        labelAt: [340, 190],
      },
      {
        letter: 'C',
        key: 'heelHeightMeasurement',
        label: 'Heel height',
        line: [44, 240, 44, 262],
        labelAt: [30, 254],
      },
      {
        letter: 'D',
        key: 'shaftHeightMeasurement',
        label: 'Shaft height',
        line: [44, 112, 44, 236],
        labelAt: [30, 176],
      },
    ],
  },
];

export const FASHION_MEASUREMENT_UNITS: FashionMeasurementUnit[] = ['cm', 'in'];

/** Every attribute key any template can store a measured value under. */
export const FASHION_MEASUREMENT_VALUE_KEYS: string[] = [
  ...new Set(
    FASHION_MEASUREMENT_TEMPLATES.flatMap((template) =>
      template.points.map((point) => point.key),
    ),
  ),
];

export function fashionMeasurementTemplate(
  id: unknown,
): FashionMeasurementTemplate | undefined {
  return typeof id === 'string'
    ? FASHION_MEASUREMENT_TEMPLATES.find((template) => template.id === id)
    : undefined;
}

/** Families whose templates use a measurement key (drives attribute compatibility). */
export function fashionMeasurementKeyFamilies(
  key: string,
): FashionCategoryFamily[] {
  return [
    ...new Set(
      FASHION_MEASUREMENT_TEMPLATES.filter((template) =>
        template.points.some((point) => point.key === key),
      ).map((template) => template.family),
    ),
  ];
}

/** Best-effort template suggestion from an identified item type. Never required. */
export function suggestFashionMeasurementTemplate(
  itemType: string | null | undefined,
  family?: FashionCategoryFamily,
): FashionMeasurementTemplate | undefined {
  const text = (itemType ?? '').toLowerCase();
  const candidates = FASHION_MEASUREMENT_TEMPLATES.filter(
    (template) => !family || template.family === family,
  );
  if (text) {
    // Longest keyword wins so "long sleeve shirt" beats "shirt" and "t-shirt" beats "shirt".
    let best:
      | { template: FashionMeasurementTemplate; length: number }
      | undefined;
    for (const template of candidates) {
      for (const keyword of template.keywords) {
        if (text.includes(keyword) && (!best || keyword.length > best.length))
          best = { template, length: keyword.length };
      }
    }
    if (best) return best.template;
  }
  return undefined;
}

export function normalizeFashionMeasurementUnit(
  value: unknown,
): FashionMeasurementUnit | null {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (text === 'cm' || text === 'centimeters' || text === 'centimetres')
    return 'cm';
  if (text === 'in' || text === 'inch' || text === 'inches' || text === '"')
    return 'in';
  return null;
}

/** Parses a measured value. Accepts "19", "19.5", "19,5". Returns null when invalid. */
export function parseFashionMeasurement(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) return null;
  const parsed = Number(text);
  return parsed > 0 && parsed < 1000 ? parsed : null;
}

export type FashionMeasurementRow = {
  letter: string;
  key: string;
  label: string;
  value: string;
};

/** Filled rows of a template in point order, for descriptions and chart images. */
export function fashionMeasurementRows(
  template: FashionMeasurementTemplate,
  attributes: Record<string, unknown>,
): FashionMeasurementRow[] {
  return template.points
    .map((point) => {
      const raw = attributes[point.key];
      const value =
        typeof raw === 'number'
          ? String(raw)
          : typeof raw === 'string'
            ? raw.trim()
            : '';
      return {
        letter: point.letter,
        key: point.key,
        label: point.label,
        value,
      };
    })
    .filter((row) => row.value);
}

export function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Schematic diagram for a template. Contains only constant geometry and
 * template letters, never user input, so it is safe to render as an <img>.
 */
export function fashionDiagramSvg(
  template: FashionMeasurementTemplate,
): string {
  const shapes = DIAGRAM_SHAPES[template.diagram]
    .map((d, index) =>
      d.endsWith('Z')
        ? `<path d="${d}" fill="#e5e7eb" stroke="#6b7280" stroke-width="2" stroke-linejoin="round"/>`
        : `<path d="${d}" fill="none" stroke="#6b7280" stroke-width="${index ? 6 : 2}" stroke-linecap="round"/>`,
    )
    .join('');
  const arrows = template.points
    .map(
      (point) =>
        `<line x1="${point.line[0]}" y1="${point.line[1]}" x2="${point.line[2]}" y2="${point.line[3]}" stroke="#c2410c" stroke-width="2.5" marker-start="url(#fm-arrow)" marker-end="url(#fm-arrow)"/>` +
        `<text x="${point.labelAt[0]}" y="${point.labelAt[1]}" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" font-weight="700" fill="#c2410c" text-anchor="middle" dominant-baseline="middle" stroke="#ffffff" stroke-width="4" paint-order="stroke">${point.letter}</text>`,
    )
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">` +
    `<defs><marker id="fm-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c2410c"/></marker></defs>` +
    shapes +
    arrows +
    `</svg>`
  );
}

/** Public template shape returned to the editor. */
export function publicFashionMeasurementTemplates() {
  return FASHION_MEASUREMENT_TEMPLATES.map((template) => ({
    id: template.id,
    label: template.label,
    chartTitle: template.chartTitle,
    family: template.family,
    keywords: template.keywords,
    points: template.points.map(({ letter, key, label }) => ({
      letter,
      key,
      label,
    })),
    diagramSvg: fashionDiagramSvg(template),
  }));
}
