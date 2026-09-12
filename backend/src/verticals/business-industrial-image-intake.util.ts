export interface ParsedInstanceFolderName {
  rawFolderName: string;
  baseFolderName: string;
  instanceSuffix: string | null;
}

/** A final numeric dot suffix identifies a second physical instance, not a decimal quantity. */
export function parseInstanceFolderName(
  rawFolderName: string,
): ParsedInstanceFolderName {
  const raw = rawFolderName.trim();
  const match = /^(.*)\.(\d+)$/.exec(raw);
  return {
    rawFolderName: raw,
    baseFolderName: (match?.[1] ?? raw).trim(),
    instanceSuffix: match?.[2] ?? null,
  };
}

export function normalizeImageIntakePartName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s\-_./\\]+/g, '');
}

/** Returns the first part folder below the selected root. */
export function partFolderFromRelativePath(
  relativePath: string,
  rootFolderName?: string,
): string {
  const parts = relativePath
    .split(/[\\/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (
    rootFolderName &&
    parts[0]?.toLocaleLowerCase() === rootFolderName.trim().toLocaleLowerCase()
  )
    parts.shift();
  return parts.length > 1
    ? parts[0]
    : rootFolderName?.trim() || parts[0] || 'Unassigned';
}

export function isSupportedBusinessIndustrialImage(
  filename: string,
  mimeType?: string,
): boolean {
  if (mimeType?.toLocaleLowerCase().startsWith('image/')) return true;
  return /\.(avif|bmp|gif|heic|jpeg|jpg|png|tif|tiff|webp)$/i.test(filename);
}

export function safeIntakePath(value: string): string {
  const path = value.replace(/\\/g, '/').trim();
  if (
    !path ||
    path.includes('\0') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path)
  )
    throw new Error('Invalid image path');
  const segments = path.split('/');
  if (
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  )
    throw new Error('Invalid image path');
  return segments.join('/');
}
