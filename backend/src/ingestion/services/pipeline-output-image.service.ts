import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import { StorageService } from '../../storage/storage.service.js';
import {
  mergeImageUrls,
  parseImageUrlPipe,
} from '../utils/pipeline-image-matching.util.js';

const S3_PATH_COLUMN = 'S3 Image Path';
const IMAGE_MIRROR_CONCURRENCY = 6;

/** PicURL + AdditionalPicURL* column names used in eBay File Exchange exports. */
const IMAGE_COLUMN_PATTERNS: RegExp[] = [
  /^picurl$/i,
  /^item\s*photo\s*url$/i,
  /^artikelfoto-?url$/i,
  /^picture\s*url$/i,
  /^photo\s*url$/i,
  /^image\s*url$/i,
  /^additionalpicurl\d*$/i,
];

@Injectable()
export class PipelineOutputImageService {
  private readonly logger = new Logger(PipelineOutputImageService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {}

  shouldMirror(): boolean {
    const flag = this.config.get<string>('PIPELINE_MIRROR_IMAGES', 'true');
    return !/^(0|false|no|off)$/i.test(String(flag).trim());
  }

  /**
   * Mirror listing images in pipeline output XLSX files to S3 and rewrite PicURL columns.
   * Adds pipe-separated S3 keys in {@link S3_PATH_COLUMN}.
   */
  async mirrorImagesInOutputDir(
    jobId: string,
    outputDir: string,
  ): Promise<void> {
    if (!this.shouldMirror()) {
      this.logger.log(
        `Job ${jobId}: PIPELINE_MIRROR_IMAGES disabled — skipping S3 image mirror`,
      );
      return;
    }

    if (!fs.existsSync(outputDir)) {
      return;
    }

    const files = fs
      .readdirSync(outputDir)
      .filter((f) => /\.(?:xlsx|csv)$/i.test(f) && !f.startsWith('~$'));

    if (files.length === 0) {
      this.logger.warn(`Job ${jobId}: No output XLSX files to mirror images`);
      return;
    }

    const skuConcurrency = Math.max(
      1,
      Number(this.config.get<string>('PIPELINE_IMAGE_SKU_CONCURRENCY', '4')) ||
        4,
    );

    let totalMirrored = 0;
    let totalRows = 0;

    for (const file of files) {
      const fullPath = path.join(outputDir, file);
      const { mirrored, rows } = await this.mirrorImagesInWorkbook(
        jobId,
        fullPath,
        skuConcurrency,
      );
      totalMirrored += mirrored;
      totalRows += rows;
    }

    this.logger.log(
      `Job ${jobId}: Mirrored images for ${totalMirrored}/${totalRows} listing rows across ${files.length} output file(s)`,
    );
  }

  /** Mirror approved direct image URLs for a trusted pre-enriched import. */
  async mirrorApprovedImageUrls(
    jobId: string,
    sku: string,
    urls: string[],
  ): Promise<{ urls: string[]; s3Keys: string[] }> {
    const remoteUrls = urls.filter((url) => /^https?:\/\//i.test(url));
    if (!this.shouldMirror() || remoteUrls.length === 0) {
      return { urls, s3Keys: [] };
    }
    const skuPart = sku.replace(/[^a-zA-Z0-9_-]/g, '_');
    const results = await this.storageService.mirrorRemoteImages(
      remoteUrls,
      `pipeline-images/${jobId.slice(0, 8)}/${skuPart}`,
      IMAGE_MIRROR_CONCURRENCY,
    );
    return {
      urls: results.map((result) => result.url),
      s3Keys: results
        .map((result) => result.s3Key)
        .filter((key): key is string => Boolean(key)),
    };
  }

  /**
   * Add images resolved during catalog import and Image Drive finalization to
   * the downloadable listing files. Pipeline exports are CSV in fast mode, so
   * this runs after persistence and mirrors the same SKU-scoped data the app
   * displays.
   */
  async applyResolvedImagesToOutputDir(
    jobId: string,
    outputDir: string,
    imagesBySku: ReadonlyMap<string, readonly string[]>,
  ): Promise<{ filesUpdated: number; rowsUpdated: number }> {
    if (!fs.existsSync(outputDir) || imagesBySku.size === 0) {
      return { filesUpdated: 0, rowsUpdated: 0 };
    }

    const files = fs
      .readdirSync(outputDir)
      .filter((file) => /\.(?:xlsx|csv)$/i.test(file) && !file.startsWith('~$'));
    let filesUpdated = 0;
    let rowsUpdated = 0;

    for (const file of files) {
      const fullPath = path.join(outputDir, file);
      const wb = XLSX.readFile(fullPath);
      const sheetName = wb.SheetNames.includes('Listings')
        ? 'Listings'
        : wb.SheetNames[0];
      const ws = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!sheetName || !ws) continue;

      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
      }) as string[][];
      const headerIdx = this.findHeaderRow(rows);
      if (headerIdx < 0) continue;

      const headers = rows[headerIdx].map((header) => String(header ?? '').trim());
      const skuIdx = this.colIdx(headers, 'customlabel');
      const titleIdx = this.colIdx(headers, 'title');
      const relationshipIdx = headers.findIndex((header) =>
        /^relationship$/i.test(header),
      );
      const imageColIdxs = headers
        .map((header, index) => (this.isImageColumn(header) ? index : -1))
        .filter((index) => index >= 0);
      if (skuIdx < 0 || titleIdx < 0 || imageColIdxs.length === 0) continue;

      let fileRowsUpdated = 0;
      for (let rowIdx = headerIdx + 1; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row?.length || !String(row[titleIdx] ?? '').trim()) continue;
        if (
          relationshipIdx >= 0 &&
          String(row[relationshipIdx] ?? '').trim() === 'Compatibility'
        ) {
          continue;
        }

        const sku = String(row[skuIdx] ?? '').trim().toLowerCase();
        const resolvedUrls = imagesBySku.get(sku);
        if (!sku || !resolvedUrls?.length) continue;

        const existingUrls = imageColIdxs.flatMap((columnIndex) =>
          parseImageUrlPipe(String(row[columnIndex] ?? '')),
        );
        const mergedUrls = mergeImageUrls(resolvedUrls, existingUrls);
        if (mergedUrls.join('|') === existingUrls.join('|')) continue;

        while (row.length < headers.length) row.push('');
        this.writeImageColumns(row, imageColIdxs, mergedUrls);
        fileRowsUpdated++;
      }

      if (fileRowsUpdated === 0) continue;
      this.writeRowsToFile(wb, sheetName, rows, fullPath);
      filesUpdated++;
      rowsUpdated += fileRowsUpdated;
    }

    this.logger.log(
      'Job ' +
        jobId +
        ': Wrote resolved images to ' +
        rowsUpdated +
        ' output row(s) across ' +
        filesUpdated +
        ' file(s)',
    );
    return { filesUpdated, rowsUpdated };
  }

  private async mirrorImagesInWorkbook(
    jobId: string,
    filePath: string,
    skuConcurrency: number,
  ): Promise<{ mirrored: number; rows: number }> {
    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames.includes('Listings')
      ? 'Listings'
      : wb.SheetNames[0];
    if (!sheetName) return { mirrored: 0, rows: 0 };

    const ws = wb.Sheets[sheetName];
    if (!ws) return { mirrored: 0, rows: 0 };

    const rows: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
    });
    const headerIdx = this.findHeaderRow(rows);
    if (headerIdx < 0) {
      this.logger.warn(
        `Job ${jobId}: No header row in ${path.basename(filePath)}`,
      );
      return { mirrored: 0, rows: 0 };
    }

    const headers = rows[headerIdx].map((h) => String(h ?? '').trim());
    let s3ColIdx = headers.indexOf(S3_PATH_COLUMN);
    if (s3ColIdx < 0) {
      s3ColIdx = headers.length;
      headers.push(S3_PATH_COLUMN);
      rows[headerIdx] = headers;
    }

    const imageColIdxs = headers
      .map((h, i) => (this.isImageColumn(h) ? i : -1))
      .filter((i) => i >= 0);

    const iRelationship = headers.findIndex((h) => /^relationship$/i.test(h));
    const iSku = this.colIdx(headers, 'customlabel');
    const iTitle = this.colIdx(headers, 'title');

    const listingRowIndices: number[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row?.length) continue;
      const rel =
        iRelationship >= 0 ? String(row[iRelationship] ?? '').trim() : '';
      if (rel === 'Compatibility') continue;
      const title = iTitle >= 0 ? String(row[iTitle] ?? '').trim() : '';
      if (!title) continue;
      listingRowIndices.push(i);
    }

    let mirrored = 0;

    const mirrorRow = async (rowIdx: number): Promise<void> => {
      const row = rows[rowIdx];
      while (row.length < headers.length) row.push('');

      const urls: string[] = [];
      for (const col of imageColIdxs) {
        const v = String(row[col] ?? '').trim();
        if (!v) continue;
        if (col === imageColIdxs[0] && v.includes('|')) {
          urls.push(
            ...v
              .split('|')
              .map((u) => u.trim())
              .filter(Boolean),
          );
        } else {
          urls.push(v);
        }
      }

      const remoteUrls = urls.filter((u) => /^https?:\/\//i.test(u));
      if (remoteUrls.length === 0) return;

      const sku = iSku >= 0 ? String(row[iSku] ?? '').trim() : '';
      const skuPart = (sku || `row-${rowIdx}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const ns = `pipeline-images/${jobId.slice(0, 8)}/${skuPart}`;

      try {
        const results = await this.storageService.mirrorRemoteImages(
          urls,
          ns,
          IMAGE_MIRROR_CONCURRENCY,
        );

        const hadNewMirror = results.some((r) => r.s3Key != null);
        if (!hadNewMirror) return;

        this.writeImageColumns(
          row,
          imageColIdxs,
          results.map((r) => r.url),
        );
        row[s3ColIdx] = results
          .map((r) => r.s3Key ?? '')
          .filter(Boolean)
          .join('|');
        mirrored++;
      } catch (err) {
        this.logger.warn(
          `Job ${jobId}: Image mirror failed row ${rowIdx} in ${path.basename(filePath)}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    };

    for (
      let batch = 0;
      batch < listingRowIndices.length;
      batch += skuConcurrency
    ) {
      const slice = listingRowIndices.slice(batch, batch + skuConcurrency);
      await Promise.all(slice.map((idx) => mirrorRow(idx)));
    }

    this.writeRowsToFile(wb, sheetName, rows, filePath);

    return { mirrored, rows: listingRowIndices.length };
  }

  private writeRowsToFile(
    wb: XLSX.WorkBook,
    sheetName: string,
    rows: string[][],
    filePath: string,
  ): void {
    const outWs = XLSX.utils.aoa_to_sheet(rows);
    wb.Sheets[sheetName] = outWs;
    if (/\.csv$/i.test(filePath)) {
      fs.writeFileSync(filePath, XLSX.utils.sheet_to_csv(outWs), 'utf8');
      return;
    }
    XLSX.writeFile(wb, filePath);
  }

  private findHeaderRow(rows: string[][]): number {
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const row = rows[i];
      if (
        row?.some(
          (h) => h && /title/i.test(String(h)) && !/info/i.test(String(h)),
        )
      ) {
        return i;
      }
    }
    return -1;
  }

  private colIdx(headers: string[], name: string): number {
    const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return headers.findIndex((h) =>
      h
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .includes(norm),
    );
  }

  private isImageColumn(header: string): boolean {
    const h = String(header ?? '').trim();
    if (!h) return false;
    return IMAGE_COLUMN_PATTERNS.some((p) => p.test(h));
  }

  /** PicURL = first URL; AdditionalPicURL* = rest (max 24 images). */
  private writeImageColumns(
    row: string[],
    imageColIdxs: number[],
    urls: string[],
  ): void {
    const trimmed = urls
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 24);
    for (let i = 0; i < imageColIdxs.length; i++) {
      row[imageColIdxs[i]] = trimmed[i] ?? '';
    }
  }
}
