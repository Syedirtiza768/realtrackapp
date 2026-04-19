import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as archiver from 'archiver';
import { CatalogProduct } from './entities/catalog-product.entity.js';

type TemplateFormat = 'us' | 'au' | 'de';

// Default values matching the pipeline script CONFIG
const DEFAULTS = {
  conditionId: '3000',
  quantity: 1,
  format: 'FixedPrice',
  duration: 'GTC',
  location: 'Dubai, AE',
};

// Currency conversion rates
const FX = {
  auMultiplier: 1.55,
  deMultiplier: 0.92,
  deVat: 19,
};

@Injectable()
export class TemplateGeneratorService {
  private readonly logger = new Logger(TemplateGeneratorService.name);

  /**
   * Generate all requested template XLSX files and return as a zip buffer.
   */
  async generateTemplatesZip(
    products: CatalogProduct[],
    formats: TemplateFormat[],
  ): Promise<Buffer> {
    const dateStr = new Date().toISOString().slice(0, 10);
    const buffers: { name: string; data: Buffer }[] = [];

    for (const fmt of formats) {
      const wb = this.generateWorkbook(products, fmt);
      const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const prefix = fmt === 'us' ? 'US-Motors' : fmt === 'au' ? 'AU-Category' : 'DE-Category';
      buffers.push({ name: `${prefix}-Listings-${dateStr}.xlsx`, data: xlsxBuf });
    }

    return this.zipBuffers(buffers);
  }

  /**
   * Generate a single template XLSX file and return as buffer.
   */
  generateSingleTemplate(products: CatalogProduct[], format: TemplateFormat): Buffer {
    const wb = this.generateWorkbook(products, format);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private generateWorkbook(products: CatalogProduct[], format: TemplateFormat): XLSX.WorkBook {
    switch (format) {
      case 'us': return this.buildUSWorkbook(products);
      case 'au': return this.buildAUWorkbook(products);
      case 'de': return this.buildDEWorkbook(products);
    }
  }

  // ────────── US Motors Template ──────────

  private buildUSWorkbook(products: CatalogProduct[]): XLSX.WorkBook {
    const headers = [
      '*Action(SiteID=eBayMotors|Country=US|Currency=USD|Version=1193)',
      'Custom label (SKU)', 'Category ID', 'Category Name', 'Title',
      'Relationship', 'Relationship details',
      'P:UPC', 'Start price', 'Quantity', 'Condition ID', 'Description',
      'Format', 'Duration', 'Best Offer Enabled', 'Immediate pay required',
      'Location', 'Max dispatch time',
      'Returns accepted option', 'Returns within option', 'Refund option', 'Return shipping cost paid by',
      'Shipping profile name', 'Return profile name', 'Payment profile name',
      'C:Brand', 'C:Type', 'C:Manufacturer Part Number',
      'C:OE/OEM Part Number', 'C:Placement on Vehicle',
      'C:Fitment Type', 'C:Warranty', 'C:Material', 'C:Color', 'C:Surface Finish',
      'C:Interchange Part Number', 'C:Bundle Description',
      'C:Country/Region of Manufacture',
      'Item photo URL',
      'AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2',
      'AdditionalPicURL3', 'AdditionalPicURL4', 'AdditionalPicURL5',
      'AdditionalPicURL6', 'AdditionalPicURL7',
    ];

    const rows: (string | number | null)[][] = [
      ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
      ['#INFO', 'Version=1.0', null, 'Template=fx_multi_category_template_EBAY_MOTOR'],
      ['#INFO'],
      headers,
    ];

    for (const p of products) {
      rows.push(this.buildUSRow(headers, p));
      for (const fitRow of this.buildCompatibilityRows(headers, p.fitmentData)) {
        rows.push(fitRow);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Listings');
    return wb;
  }

  private buildUSRow(headers: string[], p: CatalogProduct): (string | number | null)[] {
    const row = new Array(headers.length).fill(null);
    const set = (col: string, val: string | number | null | undefined) => {
      const idx = headers.indexOf(col);
      if (idx >= 0 && val != null && val !== '') row[idx] = val;
    };

    set('*Action(SiteID=eBayMotors|Country=US|Currency=USD|Version=1193)', 'Add');
    set('Custom label (SKU)', p.sku);
    set('Category ID', p.categoryId);
    set('Category Name', p.categoryName);
    set('Title', p.title);
    set('P:UPC', 'Does not apply');
    set('Start price', p.price);
    set('Quantity', p.quantity ?? DEFAULTS.quantity);
    set('Condition ID', p.conditionId ?? DEFAULTS.conditionId);
    set('Description', p.description);
    set('Format', p.format ?? DEFAULTS.format);
    set('Duration', p.duration ?? DEFAULTS.duration);
    set('Best Offer Enabled', 1);
    set('Immediate pay required', 1);
    set('Location', p.location ?? DEFAULTS.location);
    set('Max dispatch time', 3);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', p.shippingProfile);
    set('Return profile name', p.returnProfile);
    set('Payment profile name', p.paymentProfile);
    set('C:Brand', p.brand);
    set('C:Type', p.partType);
    set('C:Manufacturer Part Number', p.mpn);
    set('C:OE/OEM Part Number', p.oemPartNumber);
    set('C:Placement on Vehicle', p.placement);
    set('C:Fitment Type', 'Direct Replacement');
    set('C:Warranty', 'No Warranty');
    set('C:Material', p.material);
    set('C:Country/Region of Manufacture', p.countryOfOrigin);

    this.setImages(headers, row, p, set);
    return row;
  }

  // ────────── AU Template ──────────

  private buildAUWorkbook(products: CatalogProduct[]): XLSX.WorkBook {
    const headers = [
      '*Action(SiteID=Australia|Country=AU|Currency=AUD|Version=1193)',
      'Custom label (SKU)', 'Category ID', 'Category name', 'Title',
      'Relationship', 'Relationship details',
      'P:UPC', 'Start price', 'Quantity', 'Condition ID', 'Description',
      'Format', 'Duration', 'Best Offer Enabled', 'Immediate pay required',
      'Location', 'Max dispatch time',
      'Returns accepted option', 'Returns within option', 'Refund option', 'Return shipping cost paid by',
      'Shipping profile name', 'Return profile name', 'Payment profile name',
      'C:Brand', 'C:Type', 'C:Manufacturer Part Number',
      'C:Reference OE/OEM Number', 'C:Country/Region of Manufacture',
      'C:Placement on Vehicle', 'C:Fitment Type', 'C:Warranty',
      'C:Material', 'C:Color', 'C:Surface Finish', 'C:Interchange Part Number',
      'Item photo URL',
      'AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2',
      'AdditionalPicURL3', 'AdditionalPicURL4', 'AdditionalPicURL5',
      'AdditionalPicURL6', 'AdditionalPicURL7',
    ];

    const rows: (string | number | null)[][] = [
      ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
      ['#INFO', 'Version=1.0', null, 'Template=fx_category_template_EBAY_AU'],
      ['#INFO'],
      headers,
    ];

    for (const p of products) {
      rows.push(this.buildAURow(headers, p));
      for (const fitRow of this.buildCompatibilityRows(headers, p.fitmentData)) {
        rows.push(fitRow);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Listings');
    return wb;
  }

  private buildAURow(headers: string[], p: CatalogProduct): (string | number | null)[] {
    const row = new Array(headers.length).fill(null);
    const set = (col: string, val: string | number | null | undefined) => {
      const idx = headers.indexOf(col);
      if (idx >= 0 && val != null && val !== '') row[idx] = val;
    };

    const auPrice = p.price != null ? Math.round(p.price * FX.auMultiplier * 100) / 100 : null;

    set('*Action(SiteID=Australia|Country=AU|Currency=AUD|Version=1193)', 'Add');
    set('Custom label (SKU)', p.sku);
    set('Category ID', p.categoryId);
    set('Category name', p.categoryName);
    set('Title', p.title);
    set('P:UPC', 'Does not apply');
    set('Start price', auPrice);
    set('Quantity', p.quantity ?? DEFAULTS.quantity);
    set('Condition ID', p.conditionId ?? DEFAULTS.conditionId);
    set('Description', p.description);
    set('Format', p.format ?? DEFAULTS.format);
    set('Duration', p.duration ?? DEFAULTS.duration);
    set('Best Offer Enabled', 1);
    set('Immediate pay required', 1);
    set('Location', p.location ?? DEFAULTS.location);
    set('Max dispatch time', 5);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', p.shippingProfile);
    set('Return profile name', p.returnProfile);
    set('Payment profile name', p.paymentProfile);
    set('C:Brand', p.brand);
    set('C:Type', p.partType);
    set('C:Manufacturer Part Number', p.mpn);
    set('C:Reference OE/OEM Number', p.oemPartNumber);
    set('C:Country/Region of Manufacture', p.countryOfOrigin);
    set('C:Placement on Vehicle', p.placement);
    set('C:Fitment Type', 'Direct Replacement');
    set('C:Warranty', 'No Warranty');
    set('C:Material', p.material);

    this.setImages(headers, row, p, set);
    return row;
  }

  // ────────── DE Template ──────────

  private buildDEWorkbook(products: CatalogProduct[]): XLSX.WorkBook {
    const headers = [
      '*Action(SiteID=Germany|Country=DE|Currency=EUR|Version=1193)',
      'Custom label (SKU)', 'Category ID', 'Category name', 'Title',
      'Relationship', 'Relationship details',
      'P:EAN', 'Start price', 'Quantity', 'Condition ID', 'Description',
      'Format', 'Duration', 'Best Offer Enabled', 'VAT%', 'Immediate pay required',
      'Location', 'Max dispatch time',
      'Returns accepted option', 'Returns within option', 'Refund option', 'Return shipping cost paid by',
      'Shipping profile name', 'Return profile name', 'Payment profile name',
      'C:Hersteller', 'C:Produktart', 'C:Herstellernummer',
      'C:OE/OEM Referenznummer(n)', 'C:Einbauposition',
      'C:Herstellungsland und -region',
      'C:Material', 'C:Farbe',
      'Item photo URL',
      'AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2',
      'AdditionalPicURL3', 'AdditionalPicURL4', 'AdditionalPicURL5',
      'AdditionalPicURL6', 'AdditionalPicURL7',
    ];

    const rows: (string | number | null)[][] = [
      ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Kennzeichnet fehlende Felder, die erforderlich sind'],
      ['#INFO', 'Version=1.0', null, 'Template=fx_category_template_EBAY_DE'],
      ['#INFO'],
      headers,
    ];

    for (const p of products) {
      rows.push(this.buildDERow(headers, p));
      for (const fitRow of this.buildCompatibilityRows(headers, p.fitmentData)) {
        rows.push(fitRow);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Listings');
    return wb;
  }

  private buildDERow(headers: string[], p: CatalogProduct): (string | number | null)[] {
    const row = new Array(headers.length).fill(null);
    const set = (col: string, val: string | number | null | undefined) => {
      const idx = headers.indexOf(col);
      if (idx >= 0 && val != null && val !== '') row[idx] = val;
    };

    const eurPrice = p.price != null ? Math.round(p.price * FX.deMultiplier * 100) / 100 : null;

    set('*Action(SiteID=Germany|Country=DE|Currency=EUR|Version=1193)', 'Add');
    set('Custom label (SKU)', p.sku);
    set('Category ID', p.categoryId);
    set('Category name', p.categoryName);
    set('Title', p.title);
    set('P:EAN', 'Nicht zutreffend');
    set('Start price', eurPrice);
    set('Quantity', p.quantity ?? DEFAULTS.quantity);
    set('Condition ID', p.conditionId ?? DEFAULTS.conditionId);
    set('Description', p.description);
    set('Format', p.format ?? DEFAULTS.format);
    set('Duration', p.duration ?? DEFAULTS.duration);
    set('Best Offer Enabled', 1);
    set('VAT%', FX.deVat);
    set('Immediate pay required', 1);
    set('Location', p.location ?? DEFAULTS.location);
    set('Max dispatch time', 5);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', p.shippingProfile);
    set('Return profile name', p.returnProfile);
    set('Payment profile name', p.paymentProfile);
    set('C:Hersteller', p.brand);
    set('C:Produktart', p.partType);
    set('C:Herstellernummer', p.mpn);
    set('C:OE/OEM Referenznummer(n)', p.oemPartNumber);
    set('C:Einbauposition', p.placement);
    set('C:Herstellungsland und -region', p.countryOfOrigin);
    set('C:Material', p.material);

    this.setImages(headers, row, p, set);
    return row;
  }

  // ────────── Shared helpers ──────────

  private setImages(
    headers: string[],
    row: (string | number | null)[],
    p: CatalogProduct,
    set: (col: string, val: string | number | null | undefined) => void,
  ): void {
    if (!p.imageUrls?.length) return;
    const imgs = p.imageUrls.slice(0, 9);
    set('Item photo URL', imgs[0]);
    if (imgs.length > 1) set('AdditionalPicURL', imgs[1]);
    for (let i = 2; i < imgs.length; i++) {
      set(`AdditionalPicURL${i - 1}`, imgs[i]);
    }
  }

  private buildCompatibilityRows(
    headers: string[],
    fitmentData: Record<string, unknown>[] | null | undefined,
  ): (string | number | null)[][] {
    if (!fitmentData?.length) return [];

    const relIdx = headers.findIndex(h => /^Relationship$/i.test(h));
    const relDetailIdx = headers.findIndex(h => /^Relationship\s*details$/i.test(h));
    const rIdx = relIdx >= 0 ? relIdx : 5;
    const rdIdx = relDetailIdx >= 0 ? relDetailIdx : 6;

    return fitmentData
      .filter((f: Record<string, unknown>) => f.year && f.make && f.model)
      .map((f: Record<string, unknown>) => {
        const row = new Array(headers.length).fill(null);
        row[rIdx] = 'Compatibility';
        const parts: string[] = [];
        if (f.year) parts.push(`Year=${f.year}`);
        if (f.make) parts.push(`Make=${f.make}`);
        if (f.model) parts.push(`Model=${f.model}`);
        if (f.submodel) parts.push(`Submodel=${f.submodel}`);
        if (f.trim) parts.push(`Trim=${f.trim}`);
        if (f.engine) parts.push(`Engine=${f.engine}`);
        row[rdIdx] = parts.join('|');
        return row;
      });
  }

  private async zipBuffers(files: { name: string; data: Buffer }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      for (const file of files) {
        archive.append(file.data, { name: file.name });
      }

      archive.finalize();
    });
  }
}
