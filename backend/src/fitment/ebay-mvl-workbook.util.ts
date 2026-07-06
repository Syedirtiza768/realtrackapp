import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';

function resolveDecryptScript(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'scripts', 'ebay-mvl', 'decrypt_xlsx.py'),
    path.resolve(process.cwd(), '..', 'scripts', 'ebay-mvl', 'decrypt_xlsx.py'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function isPasswordProtectedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.toLowerCase().includes('password-protected');
}

/** Read an eBay MVL workbook, decrypting with Python when required. */
export function readMvlWorkbook(
  filePath: string,
  password?: string,
): XLSX.WorkBook {
  const buffer = fs.readFileSync(filePath);
  try {
    return XLSX.read(buffer, { type: 'buffer' });
  } catch (err) {
    if (!isPasswordProtectedError(err)) throw err;
  }

  const scriptPath = resolveDecryptScript();
  if (!scriptPath) {
    throw new Error(
      'Workbook is password-protected but scripts/ebay-mvl/decrypt_xlsx.py was not found. ' +
        'Install Python + msoffcrypto-tool or decrypt the file manually.',
    );
  }

  const pw =
    password ??
    process.env.EBAY_MVL_WORKBOOK_PASSWORD ??
    'VehicleList';

  const result = spawnSync('python', [scriptPath, filePath], {
    env: {
      ...process.env,
      MVL_PASSWORD: pw,
      EBAY_MVL_WORKBOOK_PASSWORD: pw,
    },
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(
      `Failed to run Python decrypt helper: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    const detail = (result.stderr?.toString() || result.stdout?.toString() || '').trim();
    throw new Error(
      `MVL workbook decrypt failed (exit ${result.status})${detail ? `: ${detail}` : ''}`,
    );
  }
  if (!result.stdout?.length) {
    throw new Error('MVL workbook decrypt produced empty output');
  }

  return XLSX.read(result.stdout, { type: 'buffer' });
}

export function sheetToRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
): { headers: string[]; rows: unknown[][] } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in workbook`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const nonEmpty = matrix.filter((row) =>
    Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()),
  );
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = (nonEmpty[0] as unknown[]).map((cell) => String(cell ?? '').trim());
  const rows = nonEmpty.slice(1) as unknown[][];
  return { headers, rows };
}
