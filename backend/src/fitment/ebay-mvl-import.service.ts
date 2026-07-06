import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayMvlEntry } from './entities/ebay-mvl-entry.entity.js';
import { EbayMvlRelease } from './entities/ebay-mvl-release.entity.js';
import type { MvlMarketplace } from './ebay-mvl-marketplace.util.js';
import {
  detectMvlDataSheetName,
  detectMvlMarketplaceFromFileName,
  extractVersionLabel,
  parseMvlSheetRows,
  type ParsedMvlEntry,
} from './ebay-mvl-parse.util.js';
import { EbayMvlStoreService } from './ebay-mvl-store.service.js';
import { readMvlWorkbook, sheetToRows } from './ebay-mvl-workbook.util.js';

export interface EbayMvlImportResult {
  releaseId: string;
  marketplace: MvlMarketplace;
  versionLabel: string;
  fileName: string;
  fileSha256: string;
  sourceRowCount: number;
  entryCount: number;
  skippedDuplicate: boolean;
}

export interface EbayMvlDirectoryImportSummary {
  imported: EbayMvlImportResult[];
  errors: Array<{ file: string; error: string }>;
}

@Injectable()
export class EbayMvlImportService {
  private readonly logger = new Logger(EbayMvlImportService.name);
  private readonly insertBatchSize = 2000;

  constructor(
    @InjectRepository(EbayMvlRelease)
    private readonly releaseRepo: Repository<EbayMvlRelease>,
    @InjectRepository(EbayMvlEntry)
    private readonly entryRepo: Repository<EbayMvlEntry>,
    private readonly store: EbayMvlStoreService,
  ) {}

  resolveAllowedDirectory(requested?: string): string {
    const base =
      process.env.EBAY_MVL_DATA_DIR?.trim() ||
      path.resolve(process.cwd(), '..', 'drive-download-20260706T171856Z-3-001');

    if (!requested?.trim()) {
      return path.resolve(base);
    }

    const resolved = path.resolve(requested.trim());
    const allowedRoot = path.resolve(base);
    if (
      resolved !== allowedRoot &&
      !resolved.startsWith(`${allowedRoot}${path.sep}`)
    ) {
      throw new BadRequestException(
        `Directory must be under EBAY_MVL_DATA_DIR (${allowedRoot})`,
      );
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new BadRequestException(`Directory not found: ${resolved}`);
    }
    return resolved;
  }

  async importDirectory(
    directory?: string,
    options?: { force?: boolean },
  ): Promise<EbayMvlDirectoryImportSummary> {
    const dir = this.resolveAllowedDirectory(directory);
    const files = fs
      .readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith('.xlsx'))
      .map((name) => path.join(dir, name));

    const summary: EbayMvlDirectoryImportSummary = {
      imported: [],
      errors: [],
    };

    for (const filePath of files) {
      try {
        const result = await this.importFile(filePath, undefined, options);
        summary.imported.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push({ file: path.basename(filePath), error: message });
      }
    }

    return summary;
  }

  async importFile(
    filePath: string,
    marketplaceOverride?: MvlMarketplace,
    options?: { force?: boolean; password?: string },
  ): Promise<EbayMvlImportResult> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileSha256 = createHash('sha256').update(fileBuffer).digest('hex');

    const workbook = readMvlWorkbook(filePath, options?.password);
    const detected = detectMvlDataSheetName(workbook.SheetNames, fileName);
    if (!detected) {
      throw new BadRequestException(
        `Could not detect MVL data sheet in ${fileName}`,
      );
    }

    const marketplace =
      marketplaceOverride ??
      detected.marketplace ??
      detectMvlMarketplaceFromFileName(fileName);
    if (!marketplace) {
      throw new BadRequestException(
        `Could not detect marketplace for ${fileName}`,
      );
    }

    const existing = await this.releaseRepo.findOne({
      where: { marketplace, fileSha256, status: 'active' },
    });
    if (existing && !options?.force) {
      this.logger.log(
        `Skipping ${fileName} — identical file already active for ${marketplace}`,
      );
      return {
        releaseId: existing.id,
        marketplace,
        versionLabel: existing.versionLabel,
        fileName: existing.fileName,
        fileSha256: existing.fileSha256,
        sourceRowCount: existing.sourceRowCount,
        entryCount: existing.entryCount,
        skippedDuplicate: true,
      };
    }

    const { headers, rows } = sheetToRows(workbook, detected.sheetName);
    if (!headers.length) {
      throw new BadRequestException(`No headers found in ${fileName}`);
    }

    const versionLabel = extractVersionLabel(fileName, detected.sheetName);
    const release = await this.releaseRepo.save(
      this.releaseRepo.create({
        marketplace,
        versionLabel,
        fileName,
        fileSha256,
        sourceRowCount: rows.length,
        entryCount: 0,
        status: 'importing',
      }),
    );

    try {
      const entryCount = await this.parseAndInsertInChunks(
        release.id,
        marketplace,
        headers,
        rows,
      );

      const previousActive = await this.releaseRepo.findOne({
        where: { marketplace, status: 'active' },
      });

      await this.store.supersedeActiveRelease(marketplace, release.id);
      if (previousActive && previousActive.id !== release.id) {
        await this.store.deleteEntriesForRelease(previousActive.id);
      }

      await this.releaseRepo.update(release.id, {
        status: 'active',
        entryCount,
        importedAt: new Date(),
        errorMessage: null,
      });
      this.store.clearCache(marketplace);

      this.logger.log(
        `Imported ${entryCount} MVL entries for ${marketplace} from ${fileName}`,
      );

      return {
        releaseId: release.id,
        marketplace,
        versionLabel,
        fileName,
        fileSha256,
        sourceRowCount: rows.length,
        entryCount,
        skippedDuplicate: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.releaseRepo.update(release.id, {
        status: 'failed',
        errorMessage: message,
      });
      await this.store.deleteEntriesForRelease(release.id);
      this.store.clearCache(marketplace);
      throw err;
    }
  }

  private async parseAndInsertInChunks(
    releaseId: string,
    marketplace: MvlMarketplace,
    headers: string[],
    rows: unknown[][],
  ): Promise<number> {
    const chunkSize = Math.max(
      500,
      parseInt(process.env.EBAY_MVL_PARSE_CHUNK_SIZE ?? '5000', 10) || 5000,
    );
    let totalInserted = 0;

    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const chunk = rows.slice(offset, offset + chunkSize);
      const parsed = parseMvlSheetRows(marketplace, headers, chunk);
      if (parsed.length === 0) continue;

      totalInserted += await this.bulkInsertEntries(
        releaseId,
        marketplace,
        parsed,
        { logProgress: false },
      );

      const rowsDone = Math.min(offset + chunkSize, rows.length);
      if (rowsDone % 20_000 === 0 || rowsDone === rows.length) {
        this.logger.log(
          `MVL insert progress (${marketplace}): ${rowsDone}/${rows.length} source rows, ${totalInserted} entries`,
        );
      }
    }

    if (totalInserted === 0) {
      throw new BadRequestException('No MVL entries parsed from workbook');
    }
    return totalInserted;
  }

  private async bulkInsertEntries(
    releaseId: string,
    marketplace: MvlMarketplace,
    parsed: ParsedMvlEntry[],
    options?: { logProgress?: boolean },
  ): Promise<number> {
    const logProgress = options?.logProgress ?? true;
    let inserted = 0;
    for (let i = 0; i < parsed.length; i += this.insertBatchSize) {
      const batch = parsed.slice(i, i + this.insertBatchSize).map((entry) => ({
        releaseId,
        marketplace,
        epid: entry.epid ?? null,
        make: entry.make,
        model: entry.model,
        year: entry.year,
        trim: entry.trim ?? null,
        engine: entry.engine ?? null,
        submodel: entry.submodel ?? null,
        variant: entry.variant ?? null,
        platform: entry.platform ?? null,
        body: entry.body ?? null,
        ktype: entry.ktype ?? null,
        displayName: entry.displayName ?? null,
        extras: entry.extras ?? null,
      }));

      await this.entryRepo
        .createQueryBuilder()
        .insert()
        .into(EbayMvlEntry)
        .values(batch as never)
        .execute();

      inserted += batch.length;
      if (
        logProgress &&
        (inserted % 20_000 === 0 || inserted === parsed.length)
      ) {
        this.logger.log(
          `MVL insert progress (${marketplace}): ${inserted}/${parsed.length}`,
        );
      }
    }
    return inserted;
  }
}
