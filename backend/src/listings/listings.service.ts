import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingRecord } from './listing-record.entity';
import { ListingRevision } from './listing-revision.entity';

/**
 * Maps each Excel header text (normalized to lowercase) to the
 * corresponding entity property name.  The first column header varies
 * between files (contains Action(SiteID=…)), so we match it with a
 * startsWith check separately.
 */
const HEADER_TO_PROPERTY: Record<string, keyof ListingRecord> = {
  'custom label (sku)': 'customLabelSku',
  'category id': 'categoryId',
  'category name': 'categoryName',
  'title': 'title',
  'relationship': 'relationship',
  'relationship details': 'relationshipDetails',
  'schedule time': 'scheduleTime',
  'p:upc': 'pUpc',
  'p:epid': 'pEpid',
  'start price': 'startPrice',
  'quantity': 'quantity',
  'item photo url': 'itemPhotoUrl',
  'condition id': 'conditionId',
  'description': 'description',
  'format': 'format',
  'duration': 'duration',
  'buy it now price': 'buyItNowPrice',
  'best offer enabled': 'bestOfferEnabled',
  'best offer auto accept price': 'bestOfferAutoAcceptPrice',
  'minimum best offer price': 'minimumBestOfferPrice',
  'immediate pay required': 'immediatePayRequired',
  'location': 'location',
  'shipping service 1 option': 'shippingService1Option',
  'shipping service 1 cost': 'shippingService1Cost',
  'shipping service 1 priority': 'shippingService1Priority',
  'shipping service 2 option': 'shippingService2Option',
  'shipping service 2 cost': 'shippingService2Cost',
  'shipping service 2 priority': 'shippingService2Priority',
  'max dispatch time': 'maxDispatchTime',
  'returns accepted option': 'returnsAcceptedOption',
  'returns within option': 'returnsWithinOption',
  'refund option': 'refundOption',
  'return shipping cost paid by': 'returnShippingCostPaidBy',
  'shipping profile name': 'shippingProfileName',
  'return profile name': 'returnProfileName',
  'payment profile name': 'paymentProfileName',
  'productcompliancepolicyid': 'productCompliancePolicyId',
  'regional productcompliancepolicies': 'regionalProductCompliancePolicies',
  'c:brand': 'cBrand',
  'c:type': 'cType',
  'c:item height': 'cItemHeight',
  'c:item length': 'cItemLength',
  'c:item width': 'cItemWidth',
  'c:item diameter': 'cItemDiameter',
  'c:features': 'cFeatures',
  'c:manufacturer part number': 'cManufacturerPartNumber',
  'c:oe/oem part number': 'cOeOemPartNumber',
  'c:operating mode': 'cOperatingMode',
  'c:fuel type': 'cFuelType',
  'c:drive type': 'cDriveType',
  'product safety pictograms': 'productSafetyPictograms',
  'product safety statements': 'productSafetyStatements',
  'product safety component': 'productSafetyComponent',
  'regulatory document ids': 'regulatoryDocumentIds',
  'manufacturer name': 'manufacturerName',
  'manufacturer addressline1': 'manufacturerAddressLine1',
  'manufacturer addressline2': 'manufacturerAddressLine2',
  'manufacturer city': 'manufacturerCity',
  'manufacturer country': 'manufacturerCountry',
  'manufacturer postalcode': 'manufacturerPostalCode',
  'manufacturer stateorprovince': 'manufacturerStateOrProvince',
  'manufacturer phone': 'manufacturerPhone',
  'manufacturer email': 'manufacturerEmail',
  'manufacturer contacturl': 'manufacturerContactUrl',
  'responsible person 1': 'responsiblePerson1',
  'responsible person 1 type': 'responsiblePerson1Type',
  'responsible person 1 addressline1': 'responsiblePerson1AddressLine1',
  'responsible person 1 addressline2': 'responsiblePerson1AddressLine2',
  'responsible person 1 city': 'responsiblePerson1City',
  'responsible person 1 country': 'responsiblePerson1Country',
  'responsible person 1 postalcode': 'responsiblePerson1PostalCode',
  'responsible person 1 stateorprovince': 'responsiblePerson1StateOrProvince',
  'responsible person 1 phone': 'responsiblePerson1Phone',
  'responsible person 1 email': 'responsiblePerson1Email',
  'responsible person 1 contacturl': 'responsiblePerson1ContactUrl',
};

/** All entity columns that can be upserted (excludes PK + metadata) */
const UPSERT_COLUMNS: (keyof ListingRecord)[] = [
  'action',
  'customLabelSku',
  'categoryId',
  'categoryName',
  'title',
  'relationship',
  'relationshipDetails',
  'scheduleTime',
  'pUpc',
  'pEpid',
  'startPrice',
  'quantity',
  'itemPhotoUrl',
  'conditionId',
  'description',
  'format',
  'duration',
  'buyItNowPrice',
  'bestOfferEnabled',
  'bestOfferAutoAcceptPrice',
  'minimumBestOfferPrice',
  'immediatePayRequired',
  'location',
  'shippingService1Option',
  'shippingService1Cost',
  'shippingService1Priority',
  'shippingService2Option',
  'shippingService2Cost',
  'shippingService2Priority',
  'maxDispatchTime',
  'returnsAcceptedOption',
  'returnsWithinOption',
  'refundOption',
  'returnShippingCostPaidBy',
  'shippingProfileName',
  'returnProfileName',
  'paymentProfileName',
  'productCompliancePolicyId',
  'regionalProductCompliancePolicies',
  'cBrand',
  'cType',
  'cItemHeight',
  'cItemLength',
  'cItemWidth',
  'cItemDiameter',
  'cFeatures',
  'cManufacturerPartNumber',
  'cOeOemPartNumber',
  'cOperatingMode',
  'cFuelType',
  'cDriveType',
  'productSafetyPictograms',
  'productSafetyStatements',
  'productSafetyComponent',
  'regulatoryDocumentIds',
  'manufacturerName',
  'manufacturerAddressLine1',
  'manufacturerAddressLine2',
  'manufacturerCity',
  'manufacturerCountry',
  'manufacturerPostalCode',
  'manufacturerStateOrProvince',
  'manufacturerPhone',
  'manufacturerEmail',
  'manufacturerContactUrl',
  'responsiblePerson1',
  'responsiblePerson1Type',
  'responsiblePerson1AddressLine1',
  'responsiblePerson1AddressLine2',
  'responsiblePerson1City',
  'responsiblePerson1Country',
  'responsiblePerson1PostalCode',
  'responsiblePerson1StateOrProvince',
  'responsiblePerson1Phone',
  'responsiblePerson1Email',
  'responsiblePerson1ContactUrl',
  'sourceFilePath',
];

type ImportSummary = {
  scannedFiles: number;
  importedRows: number;
  skippedRows: number;
  uniqueSkus: number;
  filesWithHeader: number;
};

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(ListingRevision)
    private readonly revisionRepo: Repository<ListingRevision>,
    private readonly dataSource: DataSource,
  ) {}

  /* ── Query methods ──────────────────────────────────────── */

  async findAll(query: ListingsQueryDto) {
    const limit = Math.min(Number(query.limit ?? 60), 200);
    const offset = Number(query.offset ?? 0);

    const qb = this.listingRepo
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.customLabelSku',
        'r.title',
        'r.cBrand',
        'r.cType',
        'r.categoryId',
        'r.categoryName',
        'r.startPrice',
        'r.quantity',
        'r.conditionId',
        'r.itemPhotoUrl',
        'r.cManufacturerPartNumber',
        'r.cOeOemPartNumber',
        'r.location',
        'r.format',
        'r.sourceFileName',
        'r.importedAt',
        'r.description',
      ])
      .orderBy('r.importedAt', 'DESC')
      .addOrderBy('r.id', 'ASC')
      .offset(offset)
      .limit(limit);

    if (query.search?.trim()) {
      qb.andWhere(
        '(r.customLabelSku ILIKE :q OR r.title ILIKE :q OR r.cBrand ILIKE :q OR r.cManufacturerPartNumber ILIKE :q OR r.cOeOemPartNumber ILIKE :q)',
        { q: `%${query.search.trim()}%` },
      );
    }

    if (query.sku?.trim()) {
      qb.andWhere('r.customLabelSku ILIKE :sku', {
        sku: `%${query.sku.trim()}%`,
      });
    }

    if (query.categoryId?.trim()) {
      qb.andWhere('r.categoryId = :catId', { catId: query.categoryId.trim() });
    }

    if (query.categoryName?.trim()) {
      qb.andWhere('r.categoryName ILIKE :catName', {
        catName: `%${query.categoryName.trim()}%`,
      });
    }

    if (query.brand?.trim()) {
      qb.andWhere('r.cBrand ILIKE :brand', {
        brand: `%${query.brand.trim()}%`,
      });
    }

    if (query.cType?.trim()) {
      qb.andWhere('r.cType ILIKE :cType', {
        cType: `%${query.cType.trim()}%`,
      });
    }

    if (query.conditionId?.trim()) {
      qb.andWhere('r.conditionId = :cond', {
        cond: query.conditionId.trim(),
      });
    }

    if (query.sourceFile?.trim()) {
      qb.andWhere('r.sourceFileName = :srcFile', {
        srcFile: query.sourceFile.trim(),
      });
    }

    if (query.hasImage === '1') {
      qb.andWhere(
        "r.itemPhotoUrl IS NOT NULL AND r.itemPhotoUrl != ''",
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { total, limit, offset, items };
  }

  async findOne(id: string) {
    const record = await this.listingRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Listing ${id} not found`);
    }
    return record;
  }

  /* ── CRUD operations (Module 1) ─────────────────────────── */

  async create(dto: CreateListingDto) {
    return this.dataSource.transaction(async (em) => {
      const listing = em.create(ListingRecord, {
        ...dto,
        status: dto.status ?? 'draft',
        sourceFileName: 'manual',
        sourceFilePath: 'manual',
        sheetName: 'manual',
        sourceRowNumber: 0,
      } as Partial<ListingRecord>);
      const saved = await em.save(ListingRecord, listing);

      const revision = em.create(ListingRevision, {
        listingId: saved.id,
        version: saved.version,
        statusBefore: null,
        statusAfter: saved.status,
        snapshot: { ...saved } as unknown as Record<string, unknown>,
        changeReason: 'create',
        changedBy: null,
      });
      await em.save(ListingRevision, revision);

      return { listing: saved, revision };
    });
  }

  async update(id: string, dto: UpdateListingDto) {
    return this.dataSource.transaction(async (em) => {
      const listing = await em.findOne(ListingRecord, { where: { id } });
      if (!listing) throw new NotFoundException(`Listing ${id} not found`);

      if (listing.version !== dto.version) {
        throw new ConflictException({
          message: 'This listing was modified since you loaded it.',
          currentVersion: listing.version,
          yourVersion: dto.version,
        });
      }

      const oldStatus = listing.status;
      const { version: _v, ...changes } = dto;
      Object.assign(listing, changes);

      const saved = await em.save(ListingRecord, listing);

      const revision = em.create(ListingRevision, {
        listingId: id,
        version: saved.version,
        statusBefore: oldStatus,
        statusAfter: saved.status,
        snapshot: { ...saved } as unknown as Record<string, unknown>,
        changeReason: 'manual_edit',
        changedBy: null,
      });
      await em.save(ListingRevision, revision);

      return { listing: saved, revision };
    });
  }

  async patchStatus(id: string, dto: PatchStatusDto) {
    return this.dataSource.transaction(async (em) => {
      const listing = await em.findOne(ListingRecord, { where: { id } });
      if (!listing) throw new NotFoundException(`Listing ${id} not found`);

      const oldStatus = listing.status;
      listing.status = dto.status;
      if (dto.status === 'published' && !listing.publishedAt) {
        listing.publishedAt = new Date();
      }

      const saved = await em.save(ListingRecord, listing);

      const revision = em.create(ListingRevision, {
        listingId: id,
        version: saved.version,
        statusBefore: oldStatus,
        statusAfter: dto.status,
        snapshot: { ...saved } as unknown as Record<string, unknown>,
        changeReason: dto.reason ?? 'status_change',
        changedBy: null,
      });
      await em.save(ListingRevision, revision);

      return { listing: saved, revision };
    });
  }

  async softDelete(id: string) {
    const listing = await this.listingRepo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    await this.listingRepo.softRemove(listing);
    return { success: true };
  }

  async restore(id: string) {
    const listing = await this.listingRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!listing) throw new NotFoundException(`Listing ${id} not found`);
    await this.listingRepo.recover(listing);
    return { listing };
  }

  async bulkUpdate(dto: BulkUpdateDto) {
    const BATCH_SIZE = 50;
    const updated: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (let i = 0; i < dto.ids.length; i += BATCH_SIZE) {
      const batch = dto.ids.slice(i, i + BATCH_SIZE);
      for (const id of batch) {
        try {
          await this.listingRepo.update(id, dto.changes as Partial<ListingRecord>);
          updated.push(id);
        } catch (err) {
          failed.push({
            id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }
    return { updated: updated.length, failed };
  }

  async getRevisions(listingId: string, limit: number, offset: number) {
    const [revisions, total] = await this.revisionRepo.findAndCount({
      where: { listingId },
      order: { version: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { total, revisions };
  }

  async getSummary() {
    const totalRecords = await this.listingRepo.count();

    const uniqueRow = await this.listingRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.customLabelSku)', 'uniqueSkus')
      .getRawOne<{ uniqueSkus: string }>();

    const fileRow = await this.listingRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.sourceFileName)', 'files')
      .getRawOne<{ files: string }>();

    return {
      totalRecords,
      uniqueSkus: Number(uniqueRow?.uniqueSkus ?? 0),
      files: Number(fileRow?.files ?? 0),
    };
  }

  /** Returns distinct values for filter dropdowns. */
  async getFacets() {
    const brandsRaw = await this.listingRepo
      .createQueryBuilder('r')
      .select('r.cBrand', 'value')
      .addSelect('COUNT(*)', 'count')
      .where("r.cBrand IS NOT NULL AND r.cBrand != ''")
      .groupBy('r.cBrand')
      .orderBy('count', 'DESC')
      .limit(100)
      .getRawMany<{ value: string; count: string }>();

    const categoriesRaw = await this.listingRepo
      .createQueryBuilder('r')
      .select('r.categoryName', 'value')
      .addSelect('r.categoryId', 'id')
      .addSelect('COUNT(*)', 'count')
      .where("r.categoryName IS NOT NULL AND r.categoryName != ''")
      .groupBy('r.categoryName')
      .addGroupBy('r.categoryId')
      .orderBy('count', 'DESC')
      .limit(100)
      .getRawMany<{ value: string; id: string; count: string }>();

    const conditionsRaw = await this.listingRepo
      .createQueryBuilder('r')
      .select('r.conditionId', 'value')
      .addSelect('COUNT(*)', 'count')
      .where("r.conditionId IS NOT NULL AND r.conditionId != ''")
      .groupBy('r.conditionId')
      .orderBy('count', 'DESC')
      .getRawMany<{ value: string; count: string }>();

    const sourceFilesRaw = await this.listingRepo
      .createQueryBuilder('r')
      .select('r.sourceFileName', 'value')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.sourceFileName')
      .orderBy('count', 'DESC')
      .getRawMany<{ value: string; count: string }>();

    return {
      brands: brandsRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      categories: categoriesRaw.map((r) => ({
        value: r.value,
        id: r.id,
        count: Number(r.count),
      })),
      conditions: conditionsRaw.map((r) => ({
        value: r.value,
        count: Number(r.count),
      })),
      sourceFiles: sourceFilesRaw.map((r) => ({
        value: r.value,
        count: Number(r.count),
      })),
    };
  }

  /* ── Import pipeline ────────────────────────────────────── */

  async importFromFolder(folderPath: string): Promise<ImportSummary> {
    const absoluteFolder = path.resolve(folderPath);
    const files = fs
      .readdirSync(absoluteFolder)
      .filter(
        (name) =>
          name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~$'),
      )
      .map((name) => path.join(absoluteFolder, name))
      .sort();

    let importedRows = 0;
    let skippedRows = 0;
    let filesWithHeader = 0;

    for (const filePath of files) {
      const sourceFileName = path.basename(filePath);
      this.logger.log(`Reading ${sourceFileName} …`);

      const workbook = XLSX.readFile(filePath, { cellDates: false });
      const sheetName = 'Listings';
      const ws = workbook.Sheets[sheetName];

      if (!ws) {
        this.logger.warn(`  ⚠ No "Listings" sheet – skipping`);
        continue;
      }

      const allRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
        header: 1,
        raw: false,
        defval: null,
      });

      const headerRowIndex = this.findHeaderRow(allRows);
      if (headerRowIndex === null) {
        this.logger.warn(`  ⚠ Header row not found – skipping`);
        continue;
      }

      filesWithHeader += 1;
      const headerRow = allRows[headerRowIndex] ?? [];

      // Build column-index → entity-property mapping for this file
      const colMap = this.buildColumnMap(headerRow);

      // Batch inserts in chunks of 500
      const BATCH_SIZE = 500;
      const batch: Partial<ListingRecord>[] = [];

      for (
        let rowIdx = headerRowIndex + 1;
        rowIdx < allRows.length;
        rowIdx += 1
      ) {
        const row = allRows[rowIdx] ?? [];

        // Build entity values from column map
        const record: Partial<ListingRecord> = {
          sourceFileName,
          sourceFilePath: filePath,
          sheetName,
          sourceRowNumber: rowIdx + 1, // 1-based
        };

        let hasAnyData = false;

        for (const [colIdx, propName] of colMap.entries()) {
          const raw = row[colIdx];
          const val = this.cleanValue(raw);
          (record as Record<string, unknown>)[propName] = val;
          if (val !== null) {
            hasAnyData = true;
          }
        }

        if (!hasAnyData) {
          skippedRows += 1;
          continue;
        }

        batch.push(record);

        if (batch.length >= BATCH_SIZE) {
          await this.upsertBatch(batch);
          importedRows += batch.length;
          batch.length = 0;
        }
      }

      // Flush remaining
      if (batch.length > 0) {
        await this.upsertBatch(batch);
        importedRows += batch.length;
        batch.length = 0;
      }

      this.logger.log(`  ✔ ${sourceFileName} done`);
    }

    const uniqueRow = await this.listingRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.customLabelSku)', 'uniqueSkus')
      .getRawOne<{ uniqueSkus: string }>();

    this.logger.log(
      `Import complete: ${importedRows} rows from ${filesWithHeader} files`,
    );

    return {
      scannedFiles: files.length,
      importedRows,
      skippedRows,
      filesWithHeader,
      uniqueSkus: Number(uniqueRow?.uniqueSkus ?? 0),
    };
  }

  /* ── Private helpers ────────────────────────────────────── */

  /** Upsert a batch of partial records using ON CONFLICT */
  private async upsertBatch(batch: Partial<ListingRecord>[]) {
    await this.listingRepo
      .createQueryBuilder()
      .insert()
      .into(ListingRecord)
      .values(batch as object[])
      .orUpdate(
        UPSERT_COLUMNS as string[],
        ['sourceFileName', 'sheetName', 'sourceRowNumber'],
      )
      .execute();
  }

  /**
   * Find the header row index by locating the cell
   * containing "Custom label (SKU)".
   */
  private findHeaderRow(
    rows: (string | number | null)[][],
  ): number | null {
    for (let r = 0; r < Math.min(rows.length, 20); r += 1) {
      const row = rows[r] ?? [];
      for (let c = 0; c < row.length; c += 1) {
        const norm = this.normalize(row[c]);
        if (norm === 'customlabelsku') {
          return r;
        }
      }
    }
    return null;
  }

  /**
   * Map column indices → entity property names based on header text.
   * The first column (Action) is matched by prefix since the
   * parenthetical parameters vary between files.
   */
  private buildColumnMap(
    headerRow: (string | number | null)[],
  ): Map<number, keyof ListingRecord> {
    const map = new Map<number, keyof ListingRecord>();

    for (let c = 0; c < headerRow.length; c += 1) {
      const raw = String(headerRow[c] ?? '').trim();
      if (!raw) continue;

      // Check for Action column (starts with *Action or Action)
      const stripped = raw.startsWith('*') ? raw.slice(1) : raw;
      if (/^action\s*\(/i.test(stripped)) {
        map.set(c, 'action');
        continue;
      }

      const key = raw.toLowerCase();
      const prop = HEADER_TO_PROPERTY[key];
      if (prop) {
        map.set(c, prop);
      }
    }

    return map;
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private cleanValue(value: unknown): string | null {
    const str = String(value ?? '').trim();
    if (!str || /^nan$/i.test(str) || /^none$/i.test(str)) {
      return null;
    }
    return str;
  }
}
