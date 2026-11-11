import sharp from 'sharp';
import {
  FASHION_MEASUREMENT_TEMPLATES,
  FASHION_MEASUREMENT_VALUE_KEYS,
  fashionDiagramSvg,
  fashionMeasurementRows,
  fashionMeasurementTemplate,
  normalizeFashionMeasurementUnit,
  parseFashionMeasurement,
  publicFashionMeasurementTemplates,
  suggestFashionMeasurementTemplate,
} from './fashion-measurements';
import {
  buildFashionListingContent,
  fashionAspectsFromAttributes,
  validateFashionAttributes,
} from './fashion.config';
import { buildSizeChartSvg } from './fashion-intake-images.service';

describe('Fashion measurement templates', () => {
  it('uses unique letters and keys within every template', () => {
    for (const template of FASHION_MEASUREMENT_TEMPLATES) {
      const letters = template.points.map((point) => point.letter);
      const keys = template.points.map((point) => point.key);
      expect(new Set(letters).size).toBe(letters.length);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((key) => key.endsWith('Measurement'))).toBe(true);
    }
    expect(FASHION_MEASUREMENT_VALUE_KEYS).toContain('shoulderMeasurement');
    expect(FASHION_MEASUREMENT_VALUE_KEYS).toContain('chestMeasurement');
  });

  it('covers the tops chart used by the competitor flow (A–E)', () => {
    const tshirt = fashionMeasurementTemplate('tshirt')!;
    expect(
      tshirt.points.map((point) => `${point.letter}:${point.key}`),
    ).toEqual([
      'A:shoulderMeasurement',
      'B:chestMeasurement',
      'C:sleeveMeasurement',
      'D:bodyLengthMeasurement',
      'E:sleeveWidthMeasurement',
    ]);
  });

  it('suggests the most specific template from an item type', () => {
    expect(
      suggestFashionMeasurementTemplate('Graphic T-Shirt', 'clothing')?.id,
    ).toBe('tshirt');
    expect(
      suggestFashionMeasurementTemplate('Button-up shirt', 'clothing')?.id,
    ).toBe('shirt');
    expect(
      suggestFashionMeasurementTemplate('Slim jeans', 'clothing')?.id,
    ).toBe('pants');
    expect(
      suggestFashionMeasurementTemplate('Leather tote bag', 'accessories')?.id,
    ).toBe('bag');
    expect(
      suggestFashionMeasurementTemplate('Running sneaker', 'footwear')?.id,
    ).toBe('shoes');
    expect(
      suggestFashionMeasurementTemplate('Mystery', 'clothing'),
    ).toBeUndefined();
    expect(
      suggestFashionMeasurementTemplate('tote bag', 'clothing'),
    ).toBeUndefined();
  });

  it('parses hand-entered values and rejects estimates or text', () => {
    expect(parseFashionMeasurement('19')).toBe(19);
    expect(parseFashionMeasurement('19,5')).toBe(19.5);
    expect(parseFashionMeasurement(' 38.25 ')).toBe(38.25);
    expect(parseFashionMeasurement('about 19')).toBeNull();
    expect(parseFashionMeasurement('0')).toBeNull();
    expect(parseFashionMeasurement('-3')).toBeNull();
    expect(normalizeFashionMeasurementUnit('Inches')).toBe('in');
    expect(normalizeFashionMeasurementUnit('cm')).toBe('cm');
    expect(normalizeFashionMeasurementUnit('ft')).toBeNull();
  });

  it('returns filled rows in chart order', () => {
    const rows = fashionMeasurementRows(fashionMeasurementTemplate('tshirt')!, {
      chestMeasurement: '38',
      shoulderMeasurement: '19',
    });
    expect(rows.map((row) => row.letter)).toEqual(['A', 'B']);
  });

  it('serves diagrams that contain only constant geometry', () => {
    const templates = publicFashionMeasurementTemplates();
    expect(templates).toHaveLength(FASHION_MEASUREMENT_TEMPLATES.length);
    for (const template of templates) {
      expect(template.diagramSvg.startsWith('<svg')).toBe(true);
      expect(template.diagramSvg).not.toMatch(/<script|on\w+=/i);
    }
  });
});

describe('Fashion measurement attributes', () => {
  const attributes = {
    categoryFamily: 'clothing',
    itemType: 'T-Shirt',
    color: 'Blue',
    sizeChartTemplate: 'tshirt',
    measurementsUnit: 'in',
    shoulderMeasurement: '19',
    chestMeasurement: '38',
    sleeveMeasurement: '6',
    bodyLengthMeasurement: '39',
    sleeveWidthMeasurement: '7',
  };

  it('keeps template measurements as valid clothing attributes', () => {
    const result = validateFashionAttributes(attributes);
    expect(result.errors).toEqual([]);
    expect(result.attributes.shoulderMeasurement).toBe('19');
    expect(result.attributes.sizeChartTemplate).toBe('tshirt');
    expect(result.warnings).toEqual([]);
  });

  it('warns on non-numeric values and templates from another family', () => {
    const result = validateFashionAttributes({
      ...attributes,
      chestMeasurement: 'roughly 38',
      sizeChartTemplate: 'bag',
    });
    expect(
      result.warnings.some((warning) => warning.includes('chestMeasurement')),
    ).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('Bag'))).toBe(
      true,
    );
  });

  it('drops measurements that do not apply to the family', () => {
    const result = validateFashionAttributes({
      categoryFamily: 'footwear',
      shoulderMeasurement: '19',
      insoleLengthMeasurement: '27',
      measurementsUnit: 'cm',
    });
    expect(result.attributes.shoulderMeasurement).toBeUndefined();
    expect(result.attributes.insoleLengthMeasurement).toBe('27');
  });

  it('publishes measurements in the description, not as item specifics', () => {
    const aspects = fashionAspectsFromAttributes(attributes, 'Gildan');
    expect(aspects.shoulderMeasurement).toBeUndefined();
    expect(aspects.sizeChartTemplate).toBeUndefined();
    expect(aspects.measurementsUnit).toBeUndefined();
    expect(aspects.categoryFamily).toBeUndefined();
    expect(aspects.Color).toEqual(['Blue']);

    const content = buildFashionListingContent({ brand: 'Gildan', attributes });
    expect(content.description).toContain('Measurements (taken flat, inches):');
    expect(content.description).toContain('A. Shoulder width: 19 in');
    expect(content.description).toContain('E. Sleeve width: 7 in');

    const sourceNotes = buildFashionListingContent({
      attributes: {
        measurements: 'A. Shoulder Width: 20.6',
        measurementsUnit: 'cm',
      },
    });
    expect(sourceNotes.description).toContain('Measurement unit: centimetres');
  });
});

describe('Fashion size chart image', () => {
  it('renders a branded chart with escaped header text', async () => {
    const svg = buildSizeChartSvg({
      template: 'tshirt',
      unit: 'in',
      values: {
        shoulderMeasurement: '19',
        chestMeasurement: '38',
        sleeveMeasurement: '6',
        bodyLengthMeasurement: '39',
        sleeveWidthMeasurement: '7',
      },
      brandName: 'Artistic <Haul>',
      sku: 'AVP-10001-M',
    });
    expect(svg).toContain('ARTISTIC &lt;HAUL&gt;');
    expect(svg).toContain('SIZE GUIDE — TOPS');
    expect(svg).toContain('Value (inch)');
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBeGreaterThan(1000);
    if (process.env.FASHION_CHART_PREVIEW)
      await sharp(png).toFile(process.env.FASHION_CHART_PREVIEW);
  });

  it('rejects empty, invalid, or foreign measurement values', () => {
    expect(() =>
      buildSizeChartSvg({ template: 'tshirt', unit: 'cm', values: {} }),
    ).toThrow(/at least one measurement/);
    expect(() =>
      buildSizeChartSvg({
        template: 'tshirt',
        unit: 'cm',
        values: { chestMeasurement: 'wide' },
      }),
    ).toThrow(/positive numbers/);
    expect(() =>
      buildSizeChartSvg({
        template: 'tshirt',
        unit: 'cm',
        values: { inseamMeasurement: '80' },
      }),
    ).toThrow(/do not belong/);
    expect(() =>
      buildSizeChartSvg({ template: 'nope', unit: 'cm', values: {} }),
    ).toThrow();
  });

  it('draws every template diagram without errors', async () => {
    const tiles: Buffer[] = [];
    for (const template of FASHION_MEASUREMENT_TEMPLATES) {
      const png = await sharp(Buffer.from(fashionDiagramSvg(template)))
        .png()
        .toBuffer();
      expect(png.length).toBeGreaterThan(500);
      tiles.push(png);
    }
    if (process.env.FASHION_CHART_PREVIEW) {
      const columns = 5;
      const sheet = sharp({
        create: {
          width: 400 * columns,
          height: 320 * Math.ceil(tiles.length / columns),
          channels: 4,
          background: '#ffffff',
        },
      }).composite(
        tiles.map((input, index) => ({
          input,
          left: (index % columns) * 400,
          top: Math.floor(index / columns) * 320,
        })),
      );
      await sheet
        .png()
        .toFile(
          process.env.FASHION_CHART_PREVIEW.replace(/\.png$/, '-diagrams.png'),
        );
    }
  });
});
