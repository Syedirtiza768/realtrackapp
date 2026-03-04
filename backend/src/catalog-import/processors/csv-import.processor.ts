import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import { CatalogImport } from '../entities/catalog-import.entity.js';
import { CatalogImportRow } from '../entities/catalog-import-row.entity.js';
import { CatalogProduct } from '../entities/catalog-product.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import {
  DuplicateDetectionService,
} from '../services/duplicate-detection.service.js';

export interface CsvImportJobData {
  importId: string;
  filePath: string;
  columnMapping: Record<string, string>;
  resumeFromRow: number;
}

/** Batch size for streaming row processing */
const BATCH_SIZE = 100;
/** Progress update frequency (every N rows) */
const PROGRESS_UPDATE_INTERVAL = 50;

/**
 * BullMQ processor for CSV catalog imports.
 *
 * Steps:
 * 1. Read CSV file using streaming
 * 2. Parse rows and apply column mapping
 * 3. Normalize product data
 * 4. Run duplicate detection (batch)
 * 5. Insert new products / flag duplicates
 * 6. Update import record with progress
 * 7. Generate import report on completion
 */
@Processor('catalog-import', { concurrency: 2 })
export class CsvImportProcessor extends WorkerHost {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    @InjectRepository(CatalogImport)
    private readonly importRepo: Repository<CatalogImport>,
    @InjectRepository(CatalogImportRow)
    private readonly rowRepo: Repository<CatalogImportRow>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    private readonly duplicateService: DuplicateDetectionService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<CsvImportJobData>): Promise<void> {
    const { importId, filePath, columnMapping, resumeFromRow } = job.data;
    this.logger.log(
      `Processing CSV import ${importId} from row ${resumeFromRow}`,
    );

    // Check if cancelled before starting
    const importRecord = await this.importRepo.findOneBy({ id: importId });
    if (!importRecord || importRecord.status === 'cancelled') {
      this.logger.warn(`Import ${importId} was cancelled — aborting`);
      return;
    }

    // Mark as processing
    await this.importRepo.update(importId, { status: 'processing' });

    try {
      // Read and parse the CSV
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const sanitizedContent = this.sanitizeCsvForLineSplit(fileContent);
      const lines = sanitizedContent
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0);

      // Find the header row
      const { headers, dataStartIdx } = this.findHeaders(lines);
      if (headers.length === 0) {
        throw new Error('Could not detect CSV headers');
      }

      const dataLines = lines.slice(dataStartIdx);
      const totalRows = dataLines.length;
      const listingSheetName = `Catalog Import ${importId}`;

      // Update total rows if not set
      if (importRecord.totalRows !== totalRows) {
        await this.importRepo.update(importId, { totalRows });
      }

      let insertedRows = importRecord.insertedRows || 0;
      let skippedDuplicates = importRecord.skippedDuplicates || 0;
      let flaggedForReview = importRecord.flaggedForReview || 0;
      let invalidRows = importRecord.invalidRows || 0;
      const warnings: string[] = importRecord.warnings || [];

      // Track unique identifiers seen during this import run (across all batches)
      // to avoid DB unique key violations on intra-file duplicates.
      const seenSku = new Set<string>();
      const seenUpc = new Set<string>();
      const seenEbayItemId = new Set<string>();
      const seenInsertedRows = new Set<number>();

      // Seed with already-inserted rows for resumable imports.
      const alreadyInserted = await this.productRepo.find({
        where: { importId },
        select: ['sku', 'upc', 'ebayItemId'],
      });
      for (const p of alreadyInserted) {
        if (p.sku) seenSku.add(this.normalizeIdentifier(p.sku));
        if (p.upc) seenUpc.add(this.normalizeIdentifier(p.upc));
        if (p.ebayItemId) {
          seenEbayItemId.add(this.normalizeIdentifier(p.ebayItemId));
        }
      }

      const alreadyInsertedRows = await this.rowRepo.find({
        where: { importId, status: 'inserted' },
        select: ['rowNumber'],
      });
      for (const row of alreadyInsertedRows) {
        seenInsertedRows.add(row.rowNumber);
      }

      // Process in batches
      for (let batchStart = resumeFromRow; batchStart < totalRows; batchStart += BATCH_SIZE) {
        // Check for cancellation between batches
        const currentStatus = await this.importRepo.findOne({
          where: { id: importId },
          select: ['status'],
        });
        if (currentStatus?.status === 'cancelled') {
          this.logger.warn(`Import ${importId} cancelled at row ${batchStart}`);
          return;
        }

        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRows);
        const batchLines = dataLines.slice(batchStart, batchEnd);

        // Parse rows in this batch
        const parsedRows = batchLines.map((line, idx) => ({
          rowNumber: batchStart + idx + 1,
          data: this.parseRow(line, headers, columnMapping),
          rawLine: line,
        }));

        // Filter out invalid rows
        const validRows: typeof parsedRows = [];
        const importRowEntries: Partial<CatalogImportRow>[] = [];

        for (const row of parsedRows) {
          if (seenInsertedRows.has(row.rowNumber)) {
            continue;
          }

          const validation = this.validateRow(row.data);
          if (!validation.valid) {
            invalidRows++;
            importRowEntries.push({
              importId,
              rowNumber: row.rowNumber,
              status: 'invalid',
              message: validation.error,
              rawData: row.data,
            });
          } else {
            validRows.push(row);
          }
        }

        // Intra-import duplicate detection (same file / same import)
        const uniqueRows: typeof validRows = [];
        for (const row of validRows) {
          const skuKey = row.data['sku']
            ? this.normalizeIdentifier(row.data['sku'])
            : null;
          const upcKey = row.data['upc']
            ? this.normalizeIdentifier(row.data['upc'])
            : null;
          const ebayItemIdKey = row.data['ebayItemId']
            ? this.normalizeIdentifier(row.data['ebayItemId'])
            : null;

          if (skuKey && seenSku.has(skuKey)) {
            skippedDuplicates++;
            importRowEntries.push({
              importId,
              rowNumber: row.rowNumber,
              status: 'duplicate_skipped',
              matchStrategy: 'in_file_sku',
              message: 'Duplicate SKU found in current import file',
              rawData: row.data,
            });
            continue;
          }

          if (upcKey && seenUpc.has(upcKey)) {
            skippedDuplicates++;
            importRowEntries.push({
              importId,
              rowNumber: row.rowNumber,
              status: 'duplicate_skipped',
              matchStrategy: 'in_file_upc',
              message: 'Duplicate UPC found in current import file',
              rawData: row.data,
            });
            continue;
          }

          if (ebayItemIdKey && seenEbayItemId.has(ebayItemIdKey)) {
            skippedDuplicates++;
            importRowEntries.push({
              importId,
              rowNumber: row.rowNumber,
              status: 'duplicate_skipped',
              matchStrategy: 'in_file_ebay_item_id',
              message: 'Duplicate eBay Item ID found in current import file',
              rawData: row.data,
            });
            continue;
          }

          // Reserve keys immediately so later rows in same run are treated as duplicates.
          if (skuKey) seenSku.add(skuKey);
          if (upcKey) seenUpc.add(upcKey);
          if (ebayItemIdKey) seenEbayItemId.add(ebayItemIdKey);
          uniqueRows.push(row);
        }

        // Batch duplicate detection against existing catalog
        const dupCheckInputs = uniqueRows.map((row, idx) => ({
          index: idx,
          sku: row.data['sku'] || null,
          mpn: row.data['mpn'] || null,
          upc: row.data['upc'] || null,
          title: row.data['title'] || null,
          brand: row.data['brand'] || null,
        }));

        const dupResults = await this.duplicateService.checkDuplicateBatch(dupCheckInputs);

        // Process each valid row
        const productsToInsert: Partial<CatalogProduct>[] = [];
        const listingsToInsert: Partial<ListingRecord>[] = [];

        for (let i = 0; i < uniqueRows.length; i++) {
          const row = uniqueRows[i];
          const dupResult = dupResults.get(i);

          if (dupResult?.isDuplicate) {
            // Exact duplicate — skip
            skippedDuplicates++;
            importRowEntries.push({
              importId,
              rowNumber: row.rowNumber,
              status: 'duplicate_skipped',
              matchStrategy: dupResult.matchStrategy,
              matchedProductId: dupResult.matchedProductId,
              message: `Exact duplicate detected via ${dupResult.matchStrategy}`,
              rawData: row.data,
            });
          } else if (dupResult?.isPartialMatch) {
            // Partial match — flag for review
            flaggedForReview++;
            importRowEntries.push({
              importId,
              rowNumber: row.rowNumber,
              status: 'duplicate_flagged',
              matchStrategy: dupResult.matchStrategy,
              matchedProductId: dupResult.matchedProductId,
              message: `Partial match via ${dupResult.matchStrategy} (confidence: ${dupResult.confidence})`,
              rawData: row.data,
            });
          } else {
            // New product — prepare for insert
            const product = this.mapToProduct(row.data, importId, row.rowNumber);
            productsToInsert.push(product);
            seenInsertedRows.add(row.rowNumber);
            listingsToInsert.push(
              this.mapToListingRecord(
                row.data,
                row.rowNumber,
                importRecord.fileName,
                filePath,
                listingSheetName,
              ),
            );
            importRowEntries.push({
              importId,
              rowNumber: row.rowNumber,
              status: 'inserted',
              rawData: row.data,
            });
          }
        }

        // Transactional batch insert
        if (productsToInsert.length > 0 || importRowEntries.length > 0) {
          await this.dataSource.transaction(async (manager) => {
            if (productsToInsert.length > 0) {
              const savedProducts = await manager
                .getRepository(CatalogProduct)
                .save(productsToInsert as CatalogProduct[]);

              await manager
                .getRepository(ListingRecord)
                .save(listingsToInsert as ListingRecord[]);

              // Link created product IDs to row entries
              let insertIdx = 0;
              for (const entry of importRowEntries) {
                if (entry.status === 'inserted' && insertIdx < savedProducts.length) {
                  entry.createdProductId = savedProducts[insertIdx].id;
                  insertIdx++;
                }
              }
            }

            // Save row log entries
            if (importRowEntries.length > 0) {
              await manager
                .getRepository(CatalogImportRow)
                .save(importRowEntries as CatalogImportRow[]);
            }
          });

          insertedRows += productsToInsert.length;
        }

        // Update progress
        if (batchEnd % PROGRESS_UPDATE_INTERVAL === 0 || batchEnd === totalRows) {
          await this.importRepo.update(importId, {
            processedRows: batchEnd,
            insertedRows,
            skippedDuplicates,
            flaggedForReview,
            invalidRows,
            lastProcessedRow: batchEnd,
            warnings: warnings.length > 0 ? warnings : null,
          });

          // Emit progress event for real-time UI updates
          this.eventEmitter.emit('catalog-import.progress', {
            importId,
            processedRows: batchEnd,
            totalRows,
            insertedRows,
            skippedDuplicates,
            flaggedForReview,
            invalidRows,
          });
        }

        // Update BullMQ job progress
        await job.updateProgress(Math.round((batchEnd / totalRows) * 100));
      }

      // Mark as completed
      await this.importRepo.update(importId, {
        status: 'completed',
        processedRows: totalRows,
        insertedRows,
        skippedDuplicates,
        flaggedForReview,
        invalidRows,
        lastProcessedRow: totalRows,
        completedAt: new Date(),
        warnings: warnings.length > 0 ? warnings : null,
      });

      this.logger.log(
        `Import ${importId} completed: ${insertedRows} inserted, ${skippedDuplicates} duplicates, ${flaggedForReview} flagged, ${invalidRows} invalid`,
      );

      this.eventEmitter.emit('catalog-import.completed', {
        importId,
        insertedRows,
        skippedDuplicates,
        flaggedForReview,
        invalidRows,
        totalRows,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import ${importId} failed: ${message}`);

      await this.importRepo.update(importId, {
        status: 'failed',
        errorMessage: message.substring(0, 2000),
      });

      this.eventEmitter.emit('catalog-import.failed', {
        importId,
        error: message,
      });

      throw err; // Let BullMQ handle retry
    }
  }

  /* ── Row parsing & mapping ─────────────────────────────── */

  private findHeaders(lines: string[]): { headers: string[]; dataStartIdx: number } {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const cells = this.parseCsvLine(lines[i]);
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
        return { headers: cells.map((c) => c.trim()), dataStartIdx: i + 1 };
      }
    }
    // Fallback: first row is headers
    return {
      headers: this.parseCsvLine(lines[0]).map((c) => c.trim()),
      dataStartIdx: 1,
    };
  }

  private parseRow(
    line: string,
    headers: string[],
    columnMapping: Record<string, string>,
  ): Record<string, string> {
    const cells = this.parseCsvLine(line);
    const mapped: Record<string, string> = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const catalogField = columnMapping[header];
      if (catalogField && i < cells.length) {
        const value = cells[i]?.trim();
        if (value) {
          mapped[catalogField] = value;
        }
      }
    }

    return mapped;
  }

  private validateRow(data: Record<string, string>): { valid: boolean; error?: string } {
    // At minimum, we need a title or both brand + mpn
    if (!data['title'] && !(data['brand'] && data['mpn'])) {
      return { valid: false, error: 'Missing required field: title or brand+mpn' };
    }
    return { valid: true };
  }

  private mapToProduct(
    data: Record<string, string>,
    importId: string,
    rowNumber: number,
  ): Partial<CatalogProduct> {
    const brand = data['brand'] || null;
    const mpn = data['mpn'] || null;
    const title = data['title'] || '';

    // Parse image URLs (pipe-delimited in eBay format)
    let imageUrls: string[] = [];
    if (data['imageUrls']) {
      imageUrls = data['imageUrls']
        .split('|')
        .map((u) => u.trim())
        .filter(Boolean);
    }

    // Parse price
    let price: number | null = null;
    if (data['price']) {
      const parsed = parseFloat(data['price']);
      if (!isNaN(parsed)) price = parsed;
    }

    // Parse quantity
    let quantity: number | null = null;
    if (data['quantity']) {
      const parsed = parseInt(data['quantity'], 10);
      if (!isNaN(parsed)) quantity = parsed;
    }

    // Parse condition into label
    const conditionId = data['conditionId'] || null;
    let conditionLabel: string | null = null;
    if (conditionId) {
      const conditionMap: Record<string, string> = {
        '1000': 'New',
        '1500': 'New other',
        '2000': 'Certified refurbished',
        '2500': 'Seller refurbished',
        '3000': 'Used',
        '3000-Used': 'Used',
        '4000': 'Very Good',
        '5000': 'Good',
        '6000': 'Acceptable',
        '7000': 'For parts or not working',
      };
      conditionLabel = conditionMap[conditionId] || conditionId;
    }

    return {
      sku: data['sku'] || null,
      mpn: mpn,
      mpnNormalized: mpn ? this.normalizeMpn(mpn) : null,
      upc: data['upc'] || null,
      ean: data['ean'] || null,
      ebayItemId: data['ebayItemId'] || null,
      epid: data['epid'] || null,
      title: title,
      titleNormalized: title ? this.normalizeTitle(title) : null,
      description: data['description'] || null,
      brand: brand,
      brandNormalized: brand ? this.normalizeBrand(brand) : null,
      partType: data['partType'] || null,
      placement: data['placement'] || null,
      material: data['material'] || null,
      features: data['features'] || null,
      countryOfOrigin: data['countryOfOrigin'] || null,
      oemPartNumber: data['oemPartNumber'] || null,
      price,
      quantity,
      conditionId: conditionId?.replace(/-.*/, '') || null,
      conditionLabel,
      categoryId: data['categoryId'] || null,
      categoryName: data['categoryName'] || null,
      imageUrls,
      location: data['location'] || null,
      format: data['format'] || null,
      duration: data['duration'] || null,
      shippingProfile: data['shippingProfile'] || null,
      returnProfile: data['returnProfile'] || null,
      paymentProfile: data['paymentProfile'] || null,
      sourceFile: data['_sourceFile'] || null,
      sourceRow: rowNumber,
      importId,
    };
  }

  private mapToListingRecord(
    data: Record<string, string>,
    rowNumber: number,
    sourceFileName: string,
    sourceFilePath: string,
    sheetName: string,
  ): Partial<ListingRecord> {
    const startPriceText = this.normalizeNumericText(data['price']);
    const quantityText = this.normalizeIntegerText(data['quantity']);
    const buyItNowPriceText = this.normalizeNumericText(data['buyItNowPrice']);

    const startPriceNum = this.parseNumber(startPriceText ?? undefined);
    const quantityNum = this.parseInteger(quantityText ?? undefined);
    const buyItNowPriceNum = this.parseNumber(buyItNowPriceText ?? undefined);

    return {
      organizationId: null,
      sourceFileName,
      sourceFilePath,
      sheetName,
      sourceRowNumber: rowNumber,
      action: data['action'] || 'Add',
      customLabelSku: data['sku'] || null,
      categoryId: data['categoryId'] || null,
      categoryName: data['categoryName'] || null,
      title: data['title'] || null,
      pUpc: data['upc'] || null,
      pEpid: data['epid'] || null,
      startPrice: startPriceText,
      quantity: quantityText,
      itemPhotoUrl: data['imageUrls'] || null,
      conditionId: data['conditionId'] || null,
      description: data['description'] || null,
      format: data['format'] || null,
      duration: data['duration'] || null,
      buyItNowPrice: buyItNowPriceText,
      location: data['location'] || null,
      shippingProfileName: data['shippingProfile'] || null,
      returnProfileName: data['returnProfile'] || null,
      paymentProfileName: data['paymentProfile'] || null,
      cBrand: data['brand'] || null,
      cType: data['partType'] || null,
      cFeatures: data['features'] || null,
      cManufacturerPartNumber: data['mpn'] || null,
      cOeOemPartNumber: data['oemPartNumber'] || null,
      cOperatingMode: data['operatingMode'] || null,
      cFuelType: data['fuelType'] || null,
      cDriveType: data['driveType'] || null,
      startPriceNum,
      quantityNum,
      buyItNowPriceNum,
    };
  }

  /* ── Normalization helpers ─────────────────────────────── */

  private parseNumber(value?: string): number | null {
    if (!value) return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseInteger(value?: string): number | null {
    if (!value) return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeNumericText(value?: string): string | null {
    if (!value) return null;
    const cleaned = value.replace(/[$,\s]/g, '');
    if (!cleaned) return null;
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    return cleaned;
  }

  private normalizeIntegerText(value?: string): string | null {
    if (!value) return null;
    const cleaned = value.replace(/[\s,]/g, '');
    if (!cleaned) return null;
    if (!/^-?\d+$/.test(cleaned)) return null;
    return cleaned;
  }

  private sanitizeCsvForLineSplit(content: string): string {
    let result = '';
    let insideQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const next = i + 1 < content.length ? content[i + 1] : '';

      if (char === '"') {
        if (insideQuotes && next === '"') {
          result += '""';
          i++;
        } else {
          insideQuotes = !insideQuotes;
          result += char;
        }
        continue;
      }

      if (insideQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') {
          i++;
        }
        result += ' ';
        continue;
      }

      result += char;
    }

    return result;
  }

  private normalizeMpn(mpn: string): string {
    return mpn.toUpperCase().replace(/[\s\-_.\/\\]+/g, '').trim();
  }

  private normalizeBrand(brand: string): string {
    return brand.toUpperCase().replace(/[\s\-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  private normalizeIdentifier(value: string): string {
    return value.trim();
  }

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
}
