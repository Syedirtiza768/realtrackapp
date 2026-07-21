/**
 * GridX Connect input format for /pipeline bulk upload.
 * Keep in sync with src/lib/pipelineGridxFormat.ts
 * and public/pipeline-gridx-sample.xlsx.
 */

import type { WorkSheet } from 'xlsx';

export const PIPELINE_GRIDX_REQUIRED_HEADERS = [
  'Part Number',
  'Price',
  'Quantity',
  'Vehicle Make',
  'Description',
  'Image URLs',
  'SKU',
] as const;

export type PipelineGridxValidationResult =
  | { ok: true; headers: string[] }
  | { ok: false; missing: string[]; headers: string[]; message: string };

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i];
    if (!row) continue;
    if (row.some((c) => /part\s*number/i.test(String(c ?? '')))) return i;
  }
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i];
    if (!row) continue;
    if (row.some((c) => /^part$/i.test(String(c ?? '').trim()))) return i;
  }
  return -1;
}

/**
 * Validate that a parsed sheet follows the GridX sample header contract.
 * Rejects missing columns and corrupted rows where every cell is the same label.
 */
export function validatePipelineGridxHeaders(
  rows: unknown[][],
): PipelineGridxValidationResult {
  if (!rows.length) {
    return {
      ok: false,
      missing: [...PIPELINE_GRIDX_REQUIRED_HEADERS],
      headers: [],
      message:
        'File is empty. Download the GridX sample template and keep the header row unchanged.',
    };
  }

  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) {
    return {
      ok: false,
      missing: [...PIPELINE_GRIDX_REQUIRED_HEADERS],
      headers: [],
      message:
        'Could not find a header row with "Part Number". Download the GridX sample template from Pipeline.',
    };
  }

  const headers = (rows[headerIdx] ?? []).map((h) => String(h ?? '').trim());
  const unique = new Set(headers.map(norm).filter(Boolean));
  if (headers.filter(Boolean).length >= 4 && unique.size <= 2) {
    return {
      ok: false,
      missing: [...PIPELINE_GRIDX_REQUIRED_HEADERS],
      headers,
      message:
        'Header row looks corrupted (duplicate column names). Keep the sample headers exactly: Part Number, Price, Quantity, Vehicle Make, Description, Image URLs, SKU.',
    };
  }

  const missing = PIPELINE_GRIDX_REQUIRED_HEADERS.filter((required) => {
    const want = norm(required);
    return !headers.some((h) => {
      const got = norm(h);
      return got === want || got.includes(want);
    });
  });

  if (missing.length) {
    return {
      ok: false,
      missing: [...missing],
      headers,
      message: `Missing required columns: ${missing.join(', ')}. Download the GridX sample template and do not rename those headers.`,
    };
  }

  return { ok: true, headers };
}

/**
 * Convert a worksheet to an array-of-arrays, dropping Excel-hidden rows.
 *
 * Soft-deleted / Hide Rows in Excel keep cell values in the file with
 * `hidden: true` on `sheet['!rows'][i]`. SheetJS still returns those rows via
 * `sheet_to_json`, which previously caused pipeline jobs to re-import
 * cross-vehicle junk the operator thought they had deleted.
 */
export function sheetToVisibleAoa(ws: WorkSheet): unknown[][] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
  }) as unknown[][];
  const rowMeta = ws['!rows'] ?? [];
  if (!rowMeta.length) return rows;
  return rows.filter((_, index) => !rowMeta[index]?.hidden);
}

/** Count how many data-bearing rows were skipped because they are Excel-hidden. */
export function countHiddenDataRows(ws: WorkSheet): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
  }) as unknown[][];
  const rowMeta = ws['!rows'] ?? [];
  if (!rowMeta.length) return 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    if (!rowMeta[i]?.hidden) continue;
    const row = rows[i];
    if (!row) continue;
    const hasData = row.some((c) => String(c ?? '').trim() !== '');
    if (hasData) skipped++;
  }
  return skipped;
}

/** Parse an uploaded CSV/XLSX buffer into visible row arrays for header validation. */
export function parsePipelineUploadRows(fileBuffer: Buffer): unknown[][] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  // cellStyles helps preserve row hidden flags from xlsx row XML.
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellStyles: true });
  const sheetName =
    wb.SheetNames.find((n) => !/instruction/i.test(n)) || wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return sheetToVisibleAoa(ws);
}

/** Inspect an upload buffer for Excel-hidden data rows (pre-enqueue warning). */
export function countHiddenDataRowsInUpload(fileBuffer: Buffer): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellStyles: true });
  const sheetName =
    wb.SheetNames.find((n) => !/instruction/i.test(n)) || wb.SheetNames[0];
  if (!sheetName) return 0;
  const ws = wb.Sheets[sheetName];
  if (!ws) return 0;
  return countHiddenDataRows(ws);
}
