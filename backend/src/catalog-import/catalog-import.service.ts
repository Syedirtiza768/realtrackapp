import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { StringDecoder } from 'node:string_decoder';
import * as XLSX from 'xlsx';
import { CatalogImport } from './entities/catalog-import.entity.js';
import { CatalogImportRow } from './entities/catalog-import-row.entity.js';
import { CatalogProduct } from './entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import type { CsvImportJobData } from './processors/csv-import.processor.js';
import {
  applyCreatedByVisibility,
  assertCanAccessJob,
  canViewJob,
  withCreatedByBackfill,
} from '../common/utils/job-visibility.js';
import { HeavyJobLimiterService } from '../common/jobs/heavy-job-limiter.service.js';

export interface ImportVerificationSummary {
  importId: string;
  expectedInsertedRows: number;
  catalogProductsByImport: number;
  listingRecordsByImport: number;
  sampleSkus: string[];
  db: {
    database: string;
    schema: string;
  } | null;
}

export interface BackfillListingsResult {
  scannedImports: number;
  insertedListingRecords: number;
  imports: Array<{
    importId: string;
    fileName: string;
    catalogProducts: number;
    insertedListingRecords: number;
  }>;
}

/** Well-known CSV headers → catalog product field mapping */
const DEFAULT_COLUMN_MAP: Record<string, string> = {
  // eBay File Exchange format
  customlabel: 'sku',
  'custom label (sku)': 'sku',
  '*customlabel': 'sku',
  customlabelsku: 'sku',
  '*title': 'title',
  title: 'title',
  '*startprice': 'price',
  startprice: 'price',
  '*quantity': 'quantity',
  quantity: 'quantity',
  picurl: 'imageUrls',
  '*conditionid': 'conditionId',
  conditionid: 'conditionId',
  '*description': 'description',
  description: 'description',
  '*format': 'format',
  format: 'format',
  '*duration': 'duration',
  duration: 'duration',
  '*location': 'location',
  location: 'location',
  buyitnowprice: 'buyItNowPrice',
  '*category': 'categoryId',
  category: 'categoryId',
  categoryname: 'categoryName',
  shippingprofilename: 'shippingProfile',
  returnprofilename: 'returnProfile',
  paymentprofilename: 'paymentProfile',
  // C: prefixed custom fields (eBay specifics)
  '*c:brand': 'brand',
  'c:brand': 'brand',
  'c:type': 'partType',
  'c:placement on vehicle': 'placement',
  'c:material': 'material',
  'c:features': 'features',
  'c:country of origin': 'countryOfOrigin',
  'c:country/region of manufacture': 'countryOfOrigin',
  'c:manufacturer part number': 'mpn',
  'c:oe/oem part number': 'oemPartNumber',
  'c:operatingmode': 'operatingMode',
  'c:fueltype': 'fuelType',
  'c:drivetype': 'driveType',
  // Direct field names
  sku: 'sku',
  mpn: 'mpn',
  'manufacturer part number': 'mpn',
  upc: 'upc',
  ean: 'ean',
  epid: 'epid',
  'p:upc': 'upc',
  'p:epid': 'epid',
  brand: 'brand',
  price: 'price',
  ebayitemid: 'ebayItemId',
  'ebay item id': 'ebayItemId',
  'item id': 'ebayItemId',
  'part type': 'partType',
  'oem part number': 'oemPartNumber',
  'image url': 'imageUrls',
  imageurl: 'imageUrls',
  imageurls: 'imageUrls',
  images: 'imageUrls',
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
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectQueue('catalog-import')
    private readonly importQueue: Queue<CsvImportJobData>,
    private readonly dataSource: DataSource,
    private readonly heavyJobLimiter: HeavyJobLimiterService,
  ) {
    this.uploadDir =
      process.env.CATALOG_UPLOAD_DIR || path.resolve('uploads', 'catalog');
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Wipe CSV catalog import tables, compliance audit logs, and **all** listing_records
   * (what the /catalog browse page shows). Irreversible.
   * Requires confirm phrase to prevent accidental calls.
   */
  async clearAllCatalog(confirm: string): Promise<{
    motorsProductsUnlinked: number;
    listingRecordsDeleted: number;
    catalogProductsDeleted: number;
    catalogImportsDeleted: number;
    catalogImportRowsDeleted: number;
    complianceAuditLogsDeleted: number;
  }> {
    const phrase = typeof confirm === 'string' ? confirm.trim() : '';
    if (phrase !== 'DELETE_ALL_CATALOG') {
      throw new BadRequestException(
        'Body must be { "confirm": "DELETE_ALL_CATALOG" } to delete all catalog data.',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      // Pool may use a low statement_timeout; large deletes need longer than the default window.
      await manager.query(`SET LOCAL statement_timeout = '5min'`);

      const motorsBefore = await manager.query(
        `SELECT COUNT(*)::int AS c FROM "motors_products" WHERE "catalogProductId" IS NOT NULL`,
      );
      const motorsUnlinked = Number(motorsBefore[0]?.c ?? 0);

      await manager.query(
        `UPDATE "motors_products" SET "catalogProductId" = NULL WHERE "catalogProductId" IS NOT NULL`,
      );

      await manager.query(
        `UPDATE "motors_products" SET "listingId" = NULL WHERE "listingId" IS NOT NULL`,
      );

      await manager.query(
        `UPDATE "master_products" SET "listing_record_id" = NULL WHERE "listing_record_id" IS NOT NULL`,
      );

      const listingCountRows = await manager.query(
        `SELECT COUNT(*)::int AS c FROM "listing_records"`,
      );
      const listingsBefore = Number(listingCountRows[0]?.c ?? 0);

      await manager.query(`DELETE FROM "listing_revisions"`);

      const auditCountRows = await manager.query(
        `SELECT COUNT(*)::int AS c FROM "compliance_audit_logs"`,
      );
      const auditBefore = Number(auditCountRows[0]?.c ?? 0);
      await manager.query(`DELETE FROM "compliance_audit_logs"`);

      const cir = await manager
        .createQueryBuilder()
        .delete()
        .from(CatalogImportRow)
        .execute();

      const ci = await manager
        .createQueryBuilder()
        .delete()
        .from(CatalogImport)
        .execute();

      const cp = await manager
        .createQueryBuilder()
        .delete()
        .from(CatalogProduct)
        .execute();

      await manager.query(`DELETE FROM "listing_records"`);

      const listingsDeleted = listingsBefore;

      this.logger.warn(
        `clearAllCatalog: motors catalog unlinked=${motorsUnlinked}, listing_rows_deleted=${listingsDeleted}, products=${cp.affected ?? 0}`,
      );

      return {
        motorsProductsUnlinked: motorsUnlinked,
        listingRecordsDeleted: listingsDeleted,
        catalogProductsDeleted: cp.affected ?? 0,
        catalogImportsDeleted: ci.affected ?? 0,
        catalogImportRowsDeleted: cir.affected ?? 0,
        complianceAuditLogsDeleted: auditBefore,
      };
    });
  }

  /**
   * Handle uploaded file — detect headers, create import record.
   * For Excel files (.xlsx/.xls), converts to CSV first so the existing
   * streaming CSV pipeline works unchanged.
   */
  async handleUpload(
    file: Express.Multer.File,
    columnMapping?: Record<string, string>,
    userId?: string,
  ): Promise<CatalogImport> {
    const ext = path.extname(file.originalname).toLowerCase();
    const isCsv = ext === '.csv';
    const isExcel = ext === '.xlsx' || ext === '.xls';

    if (!isCsv && !isExcel) {
      throw new BadRequestException(
        'Only CSV and Excel (.xlsx, .xls) files are supported',
      );
    }

    let filePath = file.path;
    const fileName = file.originalname;
    const mimeType = file.mimetype;

    // Convert Excel to CSV on disk so the streaming CSV pipeline works unchanged
    if (isExcel) {
      const csvPath = filePath.replace(/\.[^.]*$/, '') + '.csv';
      this.convertExcelToCsv(filePath, csvPath);
      filePath = csvPath;
      // Keep the original mimeType / extension in metadata so the UI knows it was Excel
    }

    // Stream the file for header detection / row counting so large files do not OOM the process (nginx 502).
    const { detectedHeaders, totalRows } =
      await this.scanUploadedCsvForMetadata(filePath);

    // Auto-generate column mapping if not provided
    const resolvedMapping =
      columnMapping || this.autoMapColumns(detectedHeaders);

    // Create import record
    const catalogImport = this.importRepo.create({
      fileName,
      filePath,
      fileSizeBytes: file.size,
      mimeType,
      detectedHeaders,
      columnMapping: resolvedMapping,
      totalRows,
      status: 'pending',
      createdBy: userId ?? null,
    });

    const saved = await this.importRepo.save(catalogImport);
    this.logger.log(
      `Uploaded ${fileName} → import ${saved.id} (${totalRows} data rows, ${detectedHeaders.length} columns)`,
    );

    return saved;
  }

  /**
   * Convert an Excel file (.xlsx / .xls) to CSV using the xlsx library.
   * Uses the first worksheet only.
   */
  private convertExcelToCsv(xlsxPath: string, csvPath: string): void {
    const workbook = XLSX.readFile(xlsxPath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Excel file has no worksheets');
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new BadRequestException(`Worksheet "${sheetName}" not found`);
    }
    const csvContent = XLSX.utils.sheet_to_csv(sheet, {
      forceQuotes: false,
      blankrows: false,
    });
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    this.logger.log(
      `Converted Excel → CSV: ${path.basename(xlsxPath)} → ${path.basename(csvPath)} (${(csvContent.length / 1024).toFixed(0)} KB)`,
    );
  }

  /**
   * Start processing an import — enqueue for background processing.
   */
  async startImport(
    importId: string,
    columnMapping?: Record<string, string>,
    actorId?: string,
    viewAll = true,
  ): Promise<CatalogImport> {
    await this.heavyJobLimiter.assertCatalogImportSlotAvailable();

    const importRecord = await this.importRepo.findOneBy({ id: importId });
    if (!importRecord) {
      throw new NotFoundException(`Import ${importId} not found`);
    }
    if (actorId) {
      assertCanAccessJob(importRecord.createdBy, actorId, viewAll);
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

    importRecord.createdBy = withCreatedByBackfill(
      importRecord.createdBy,
      actorId,
    );
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
    viewerId?: string,
    viewAll = true,
  ): Promise<{ imports: CatalogImport[]; total: number }> {
    const qb = this.importRepo
      .createQueryBuilder('i')
      .orderBy('i.createdAt', 'DESC');
    if (status) qb.andWhere('i.status = :status', { status });
    if (viewerId) {
      applyCreatedByVisibility(qb, 'i', viewerId, viewAll);
    }
    qb.take(limit).skip(offset);
    const [imports, total] = await qb.getManyAndCount();
    return { imports, total };
  }

  /**
   * Get a single import with summary stats.
   */
  async getImport(
    id: string,
    viewerId?: string,
    viewAll = true,
  ): Promise<{
    import: CatalogImport;
    verification: ImportVerificationSummary | null;
  }> {
    const record = await this.importRepo.findOneBy({ id });
    if (!record) throw new NotFoundException(`Import ${id} not found`);
    if (viewerId && !canViewJob(record.createdBy, viewerId, viewAll)) {
      throw new ForbiddenException(
        'You do not have access to this catalog import',
      );
    }

    let verification: ImportVerificationSummary | null = null;
    if (
      record.status === 'completed' ||
      record.status === 'processing' ||
      record.status === 'failed'
    ) {
      verification = await this.buildVerificationSummary(record);
    }

    return {
      import: record,
      verification,
    };
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
  async cancelImport(
    id: string,
    actorId?: string,
    viewAll = true,
  ): Promise<CatalogImport> {
    const record = await this.importRepo.findOneBy({ id });
    if (!record) throw new NotFoundException(`Import ${id} not found`);
    if (actorId) {
      assertCanAccessJob(record.createdBy, actorId, viewAll);
    }

    if (record.status === 'completed' || record.status === 'cancelled') {
      throw new BadRequestException(
        `Import ${id} is already "${record.status}"`,
      );
    }

    record.status = 'cancelled';
    record.completedAt = new Date();
    record.createdBy = withCreatedByBackfill(record.createdBy, actorId);
    return this.importRepo.save(record);
  }

  /**
   * Retry a failed import (resume from last processed row).
   */
  async retryImport(
    id: string,
    actorId?: string,
    viewAll = true,
  ): Promise<CatalogImport> {
    const record = await this.importRepo.findOneBy({ id });
    if (!record) throw new NotFoundException(`Import ${id} not found`);
    if (actorId) {
      assertCanAccessJob(record.createdBy, actorId, viewAll);
    }

    if (record.status !== 'failed') {
      throw new BadRequestException(
        `Import ${id} is not in failed state (current: ${record.status})`,
      );
    }

    record.status = 'pending';
    record.errorMessage = null;
    record.createdBy = withCreatedByBackfill(record.createdBy, actorId);
    await this.importRepo.save(record);

    return this.startImport(record.id, undefined, actorId, viewAll);
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

  /**
   * Backfill listing_records from already imported catalog_products.
   * Safe to run multiple times: duplicates are ignored by unique source row key.
   */
  async backfillListings(importId?: string): Promise<BackfillListingsResult> {
    const qb = this.importRepo
      .createQueryBuilder('i')
      .where('i.insertedRows > 0')
      .andWhere('i.status IN (:...statuses)', {
        statuses: ['completed', 'failed', 'cancelled'],
      })
      .orderBy('i.createdAt', 'ASC');

    if (importId) {
      qb.andWhere('i.id = :importId', { importId });
    }

    const imports = await qb.getMany();

    const summary: BackfillListingsResult = {
      scannedImports: imports.length,
      insertedListingRecords: 0,
      imports: [],
    };

    for (const importRecord of imports) {
      const listingSheetName = `Catalog Import ${importRecord.id}`;
      const existingBefore = await this.listingRepo.count({
        where: {
          sourceFileName: importRecord.fileName,
          sheetName: listingSheetName,
        },
      });

      const products = await this.productRepo
        .createQueryBuilder('p')
        .where('p.importId = :importId', { importId: importRecord.id })
        .orderBy('p.sourceRow', 'ASC', 'NULLS LAST')
        .addOrderBy('p.createdAt', 'ASC')
        .addOrderBy('p.id', 'ASC')
        .getMany();

      if (products.length === 0) {
        summary.imports.push({
          importId: importRecord.id,
          fileName: importRecord.fileName,
          catalogProducts: 0,
          insertedListingRecords: 0,
        });
        continue;
      }

      let importInserted = 0;
      const values = products.map((product, idx) =>
        this.mapCatalogProductToListingRecord(
          product,
          importRecord.fileName,
          importRecord.filePath,
          listingSheetName,
          idx,
        ),
      );

      const CHUNK_SIZE = 500;
      for (let i = 0; i < values.length; i += CHUNK_SIZE) {
        const chunk = values.slice(i, i + CHUNK_SIZE);
        await this.listingRepo
          .createQueryBuilder()
          .insert()
          .into(ListingRecord)
          .values(chunk)
          .orIgnore()
          .execute();
      }

      const existingAfter = await this.listingRepo.count({
        where: {
          sourceFileName: importRecord.fileName,
          sheetName: listingSheetName,
        },
      });
      importInserted = Math.max(0, existingAfter - existingBefore);

      summary.insertedListingRecords += importInserted;
      summary.imports.push({
        importId: importRecord.id,
        fileName: importRecord.fileName,
        catalogProducts: products.length,
        insertedListingRecords: importInserted,
      });
    }

    this.logger.log(
      `Backfill completed: ${summary.insertedListingRecords} listing records inserted across ${summary.scannedImports} imports`,
    );

    return summary;
  }

  /* ── Header detection & column mapping ─────────────────── */

  /**
   * Yields logical CSV rows (same boundaries as sanitizeCsvForLineSplit + split on newlines)
   * without loading the entire file into memory.
   */
  private async *logicalLineIterator(filePath: string): AsyncGenerator<string> {
    const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
    const decoder = new StringDecoder('utf8');
    let insideQuotes = false;
    let lineOut = '';

    const flushLine = (): string => {
      const line = lineOut;
      lineOut = '';
      return line;
    };

    const processTextChunk = function* (text: string): Generator<string> {
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = i + 1 < text.length ? text[i + 1] : '';

        if (char === '"') {
          if (insideQuotes && next === '"') {
            lineOut += '""';
            i++;
          } else {
            insideQuotes = !insideQuotes;
            lineOut += char;
          }
          continue;
        }

        if (insideQuotes && (char === '\n' || char === '\r')) {
          if (char === '\r' && next === '\n') {
            i++;
          }
          lineOut += ' ';
          continue;
        }

        if (char === '\r' && next === '\n') {
          yield flushLine();
          i++;
          continue;
        }
        if (char === '\n') {
          if (lineOut.endsWith('\r')) {
            lineOut = lineOut.slice(0, -1);
          }
          yield flushLine();
          continue;
        }

        lineOut += char;
      }
    };

    for await (const chunk of stream) {
      yield* processTextChunk(decoder.write(chunk as Buffer));
    }
    yield* processTextChunk(decoder.end());
    if (lineOut.length > 0) {
      yield lineOut;
      lineOut = '';
    }
  }

  /**
   * Header row + data row count for an uploaded CSV on disk.
   * Matches legacy detectHeaders + countDataRows semantics (header for mapping may appear after row 5;
   * row count uses header index only within the first five non-empty lines).
   */
  private async scanUploadedCsvForMetadata(
    filePath: string,
  ): Promise<{ detectedHeaders: string[]; totalRows: number }> {
    let nonEmptyIdx = 0;
    let detectedHeaders: string[] | null = null;
    let firstNonEmptyLine: string | null = null;
    let headerIdxForCount = 0;
    let foundHeaderInFirst5 = false;

    for await (const rawLine of this.logicalLineIterator(filePath)) {
      const line = rawLine.trim();
      if (!line.length) continue;

      if (firstNonEmptyLine === null) {
        firstNonEmptyLine = line;
      }

      const cells = this.parseCsvLine(line);
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

      if (!detectedHeaders && (hasAction || hasTitle)) {
        detectedHeaders = cells.map((c) => c.trim());
      }

      if (nonEmptyIdx < 5 && !foundHeaderInFirst5 && (hasAction || hasTitle)) {
        headerIdxForCount = nonEmptyIdx;
        foundHeaderInFirst5 = true;
      }

      nonEmptyIdx++;
    }

    if (!detectedHeaders) {
      detectedHeaders = firstNonEmptyLine
        ? this.parseCsvLine(firstNonEmptyLine).map((c) => c.trim())
        : [];
    }
    if (!foundHeaderInFirst5) {
      headerIdxForCount = 0;
    }

    const totalRows = Math.max(0, nonEmptyIdx - headerIdxForCount - 1);
    return { detectedHeaders, totalRows };
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
  getCatalogFields(): Array<{
    field: string;
    label: string;
    required: boolean;
  }> {
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

  private async buildVerificationSummary(
    record: CatalogImport,
  ): Promise<ImportVerificationSummary> {
    const listingSheetName = `Catalog Import ${record.id}`;

    const [catalogProductsByImport, listingRecordsByImport, insertedRows] =
      await Promise.all([
        this.productRepo.count({ where: { importId: record.id } }),
        this.listingRepo.count({
          where: {
            sourceFileName: record.fileName,
            sheetName: listingSheetName,
          },
        }),
        this.rowRepo.find({
          where: { importId: record.id, status: 'inserted' },
          order: { rowNumber: 'ASC' },
          take: 10,
        }),
      ]);

    const sampleSkus = insertedRows
      .map((row) => row.rawData?.['sku']?.trim())
      .filter((sku): sku is string => Boolean(sku));

    const dbInfoRaw = await this.importRepo.query(
      'SELECT current_database() AS database, current_schema() AS schema',
    );
    const dbInfo =
      Array.isArray(dbInfoRaw) && dbInfoRaw.length > 0
        ? {
            database: String(dbInfoRaw[0].database ?? ''),
            schema: String(dbInfoRaw[0].schema ?? ''),
          }
        : null;

    return {
      importId: record.id,
      expectedInsertedRows: record.insertedRows,
      catalogProductsByImport,
      listingRecordsByImport,
      sampleSkus,
      db: dbInfo,
    };
  }

  private mapCatalogProductToListingRecord(
    product: CatalogProduct,
    sourceFileName: string,
    sourceFilePath: string | null,
    sheetName: string,
    fallbackIndex: number,
  ): Partial<ListingRecord> {
    const rowNumber = product.sourceRow ?? 1_000_000 + fallbackIndex + 1;

    return {
      organizationId: null,
      sourceFileName,
      sourceFilePath: sourceFilePath ?? '',
      sheetName,
      sourceRowNumber: rowNumber,
      action: 'Add',
      customLabelSku: product.sku,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      title: product.title,
      pUpc: product.upc,
      pEpid: product.epid,
      startPrice: product.price != null ? String(product.price) : null,
      quantity: product.quantity != null ? String(product.quantity) : null,
      itemPhotoUrl: product.imageUrls?.length
        ? product.imageUrls.join('|')
        : null,
      conditionId: product.conditionId,
      description: product.description,
      format: product.format,
      duration: product.duration,
      location: product.location,
      shippingProfileName: product.shippingProfile,
      returnProfileName: product.returnProfile,
      paymentProfileName: product.paymentProfile,
      cBrand: product.brand,
      cType: product.partType,
      cFeatures: product.features,
      cManufacturerPartNumber: product.mpn,
      cOeOemPartNumber: product.oemPartNumber,
      startPriceNum: product.price,
      quantityNum: product.quantity,
    };
  }
}
