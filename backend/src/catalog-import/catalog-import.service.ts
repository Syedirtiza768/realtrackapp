import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { CatalogImport } from './entities/catalog-import.entity.js';
import { CatalogImportRow } from './entities/catalog-import-row.entity.js';
import { CatalogProduct } from './entities/catalog-product.entity.js';
import type { CsvImportJobData } from './processors/csv-import.processor.js';

/** Well-known CSV headers → catalog product field mapping */
const DEFAULT_COLUMN_MAP: Record<string, string> = {
  // eBay File Exchange format
  'customlabel': 'sku',
  'custom label (sku)': 'sku',
  '*customlabel': 'sku',
  'customlabelsku': 'sku',
  '*title': 'title',
  'title': 'title',
  '*startprice': 'price',
  'startprice': 'price',
  '*quantity': 'quantity',
  'quantity': 'quantity',
  'picurl': 'imageUrls',
  '*conditionid': 'conditionId',
  'conditionid': 'conditionId',
  '*description': 'description',
  'description': 'description',
  '*format': 'format',
  'format': 'format',
  '*duration': 'duration',
  'duration': 'duration',
  '*location': 'location',
  'location': 'location',
  'buyitnowprice': 'buyItNowPrice',
  '*category': 'categoryId',
  'category': 'categoryId',
  'categoryname': 'categoryName',
  'shippingprofilename': 'shippingProfile',
  'returnprofilename': 'returnProfile',
  'paymentprofilename': 'paymentProfile',
  // C: prefixed custom fields (eBay specifics)
  '*c:brand': 'brand',
  'c:brand': 'brand',
  'c:type': 'partType',
  'c:placement on vehicle': 'placement',
  'c:material': 'material',
  'c:features': 'features',
  'c:country of origin': 'countryOfOrigin',
  'c:manufacturer part number': 'mpn',
  'c:oe/oem part number': 'oemPartNumber',
  'c:operatingmode': 'operatingMode',
  'c:fueltype': 'fuelType',
  'c:drivetype': 'driveType',
  // Direct field names
  'sku': 'sku',
  'mpn': 'mpn',
  'manufacturer part number': 'mpn',
  'upc': 'upc',
  'ean': 'ean',
  'epid': 'epid',
  'p:upc': 'upc',
  'p:epid': 'epid',
  'brand': 'brand',
  'price': 'price',
  'ebayitemid': 'ebayItemId',
  'ebay item id': 'ebayItemId',
  'item id': 'ebayItemId',
  'part type': 'partType',
  'oem part number': 'oemPartNumber',
  'image url': 'imageUrls',
  'images': 'imageUrls',
};

@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger(CatalogImportService.name);
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(CatalogImport)
    private readonly importRepo: Repository<CatalogImport>,
    @InjectRepository(CatalogImportRow)
    private readonly rowRepo: Repository<CatalogImportRow>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectQueue('catalog-import')
    private readonly importQueue: Queue<CsvImportJobData>,
  ) {
    this.uploadDir = process.env.CATALOG_UPLOAD_DIR || path.resolve('uploads', 'catalog');
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Handle uploaded CSV file — save to disk, detect headers, create import record.
   */
  async handleUpload(
    file: Express.Multer.File,
    columnMapping?: Record<string, string>,
    userId?: string,
  ): Promise<CatalogImport> {
    // Validate file
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are supported');
    }

    // Save file to upload directory
    const safeFileName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(this.uploadDir, safeFileName);
    fs.writeFileSync(filePath, file.buffer);

    // Detect headers from first line
    const detectedHeaders = this.detectHeaders(file.buffer);

    // Auto-generate column mapping if not provided
    const resolvedMapping = columnMapping || this.autoMapColumns(detectedHeaders);

    // Count total rows (subtract header row(s) — eBay files have 2 header rows)
    const totalRows = this.countDataRows(file.buffer);

    // Create import record
    const catalogImport = this.importRepo.create({
      fileName: file.originalname,
      filePath,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      detectedHeaders,
      columnMapping: resolvedMapping,
      totalRows,
      status: 'pending',
      createdBy: userId ?? null,
    });

    const saved = await this.importRepo.save(catalogImport);
    this.logger.log(
      `Uploaded CSV "${file.originalname}" → import ${saved.id} (${totalRows} data rows, ${detectedHeaders.length} columns)`,
    );

    return saved;
  }

  /**
   * Start processing an import — enqueue for background processing.
   */
  async startImport(
    importId: string,
    columnMapping?: Record<string, string>,
  ): Promise<CatalogImport> {
    const importRecord = await this.importRepo.findOneBy({ id: importId });
    if (!importRecord) {
      throw new NotFoundException(`Import ${importId} not found`);
    }

    if (importRecord.status !== 'pending' && importRecord.status !== 'paused') {
      throw new BadRequestException(
        `Import ${importId} is in "${importRecord.status}" state and cannot be started`,
      );
    }

    // Update column mapping if provided
    if (columnMapping) {
      importRecord.columnMapping = columnMapping;
    }

    importRecord.status = 'validating';
    importRecord.startedAt = new Date();
    await this.importRepo.save(importRecord);

    // Enqueue for processing
    await this.importQueue.add(
      'process-csv',
      {
        importId: importRecord.id,
        filePath: importRecord.filePath!,
        columnMapping: importRecord.columnMapping!,
        resumeFromRow: importRecord.lastProcessedRow,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log(`Enqueued import ${importRecord.id} for processing`);
    return importRecord;
  }

  /**
   * List imports with optional status filter.
   */
  async listImports(
    status?: string,
    limit = 20,
    offset = 0,
  ): Promise<{ imports: CatalogImport[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;

    const [imports, total] = await this.importRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { imports, total };
  }

  /**
   * Get a single import with summary stats.
   */
  async getImport(id: string): Promise<CatalogImport> {
    const record = await this.importRepo.findOneBy({ id });
    if (!record) throw new NotFoundException(`Import ${id} not found`);
    return record;
  }

  /**
   * Get rows for a specific import.
   */
  async getImportRows(
    importId: string,
    status?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ rows: CatalogImportRow[]; total: number }> {
    const where: Record<string, unknown> = { importId };
    if (status) where['status'] = status;

    const [rows, total] = await this.rowRepo.findAndCount({
      where,
      order: { rowNumber: 'ASC' },
      take: limit,
      skip: offset,
    });

    return { rows, total };
  }

  /**
   * Cancel a pending or processing import.
   */
  async cancelImport(id: string): Promise<CatalogImport> {
    const record = await this.importRepo.findOneBy({ id });
    if (!record) throw new NotFoundException(`Import ${id} not found`);

    if (record.status === 'completed' || record.status === 'cancelled') {
      throw new BadRequestException(
        `Import ${id} is already "${record.status}"`,
      );
    }

    record.status = 'cancelled';
    record.completedAt = new Date();
    return this.importRepo.save(record);
  }

  /**
   * Retry a failed import (resume from last processed row).
   */
  async retryImport(id: string): Promise<CatalogImport> {
    const record = await this.importRepo.findOneBy({ id });
    if (!record) throw new NotFoundException(`Import ${id} not found`);

    if (record.status !== 'failed') {
      throw new BadRequestException(
        `Import ${id} is not in failed state (current: ${record.status})`,
      );
    }

    record.status = 'pending';
    record.errorMessage = null;
    await this.importRepo.save(record);

    return this.startImport(record.id);
  }

  /**
   * Get aggregate import statistics for the dashboard.
   */
  async getImportStats(): Promise<{
    totalImports: number;
    totalProductsInserted: number;
    totalDuplicatesSkipped: number;
    totalInvalidRows: number;
    totalCatalogProducts: number;
    recentImports: CatalogImport[];
  }> {
    const [totalImports, totalCatalogProducts] = await Promise.all([
      this.importRepo.count(),
      this.productRepo.count(),
    ]);

    const aggResult = await this.importRepo
      .createQueryBuilder('i')
      .select('SUM(i.inserted_rows)', 'totalInserted')
      .addSelect('SUM(i.skipped_duplicates)', 'totalDuplicates')
      .addSelect('SUM(i.invalid_rows)', 'totalInvalid')
      .getRawOne();

    const recentImports = await this.importRepo.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      totalImports,
      totalProductsInserted: Number(aggResult?.totalInserted ?? 0),
      totalDuplicatesSkipped: Number(aggResult?.totalDuplicates ?? 0),
      totalInvalidRows: Number(aggResult?.totalInvalid ?? 0),
      totalCatalogProducts,
      recentImports,
    };
  }

  /* ── Header detection & column mapping ─────────────────── */

  /**
   * Detect headers from CSV buffer — handles eBay File Exchange format
   * which has a metadata row before the actual header row.
   */
  private detectHeaders(buffer: Buffer): string[] {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const cells = this.parseCsvLine(line);
      // eBay files have a header row that starts with *Action or Action
      const hasAction = cells.some(
        (c) =>
          c.toLowerCase().includes('action') ||
          c.toLowerCase().includes('*action'),
      );
      const hasTitle = cells.some(
        (c) =>
          c.toLowerCase().includes('title') ||
          c.toLowerCase().includes('*title'),
      );

      if (hasAction || hasTitle) {
        return cells.map((c) => c.trim());
      }
    }

    // Fallback: use first non-empty row
    if (lines.length > 0) {
      return this.parseCsvLine(lines[0]).map((c) => c.trim());
    }

    return [];
  }

  /**
   * Auto-map detected CSV columns to catalog fields.
   */
  autoMapColumns(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    for (const header of headers) {
      const key = header.toLowerCase().replace(/\*/g, '').trim();
      if (DEFAULT_COLUMN_MAP[key]) {
        mapping[header] = DEFAULT_COLUMN_MAP[key];
      } else if (DEFAULT_COLUMN_MAP[header.toLowerCase().trim()]) {
        mapping[header] = DEFAULT_COLUMN_MAP[header.toLowerCase().trim()];
      }
    }

    return mapping;
  }

  /**
   * Count data rows in the CSV (excluding header/metadata rows).
   */
  private countDataRows(buffer: Buffer): number {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    // Find header row index
    let headerIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const cells = this.parseCsvLine(lines[i]);
      const hasAction = cells.some(
        (c) =>
          c.toLowerCase().includes('action') ||
          c.toLowerCase().includes('*action'),
      );
      if (hasAction) {
        headerIdx = i;
        break;
      }
    }

    return Math.max(0, lines.length - headerIdx - 1);
  }

  /**
   * Simple CSV line parser (handles quoted fields with commas).
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Get list of available catalog fields for column mapping UI.
   */
  getCatalogFields(): Array<{ field: string; label: string; required: boolean }> {
    return [
      { field: 'sku', label: 'SKU / Custom Label', required: false },
      { field: 'title', label: 'Product Title', required: true },
      { field: 'description', label: 'Description', required: false },
      { field: 'brand', label: 'Brand', required: false },
      { field: 'mpn', label: 'Manufacturer Part Number', required: false },
      { field: 'oemPartNumber', label: 'OE/OEM Part Number', required: false },
      { field: 'upc', label: 'UPC', required: false },
      { field: 'ean', label: 'EAN', required: false },
      { field: 'epid', label: 'ePID', required: false },
      { field: 'ebayItemId', label: 'eBay Item ID', required: false },
      { field: 'price', label: 'Price', required: false },
      { field: 'quantity', label: 'Quantity', required: false },
      { field: 'conditionId', label: 'Condition ID', required: false },
      { field: 'categoryId', label: 'Category ID', required: false },
      { field: 'categoryName', label: 'Category Name', required: false },
      { field: 'partType', label: 'Part Type', required: false },
      { field: 'placement', label: 'Placement on Vehicle', required: false },
      { field: 'material', label: 'Material', required: false },
      { field: 'features', label: 'Features', required: false },
      { field: 'countryOfOrigin', label: 'Country of Origin', required: false },
      { field: 'imageUrls', label: 'Image URLs', required: false },
      { field: 'location', label: 'Location', required: false },
      { field: 'format', label: 'Listing Format', required: false },
      { field: 'duration', label: 'Duration', required: false },
      { field: 'shippingProfile', label: 'Shipping Profile', required: false },
      { field: 'returnProfile', label: 'Return Profile', required: false },
      { field: 'paymentProfile', label: 'Payment Profile', required: false },
    ];
  }
}
