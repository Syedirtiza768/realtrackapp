const GENERIC_FOLDER_NAMES = new Set([
  'asset',
  'assets',
  'image',
  'images',
  'photo',
  'photos',
  'picture',
  'pictures',
  'pic',
  'pics',
  'media',
  'files',
  'parts',
  'products',
  'uploads',
]);

export interface FolderUploadPath {
  relativePath: string;
  topLevelFolderName: string;
  partNumber: string | null;
  assetPath: string;
}

/**
 * Normalize a browser-provided relative path before using it as an S3 key.
 * Empty, absolute, and parent-traversal paths are rejected rather than
 * silently producing surprising Image Drive locations.
 */
export function normalizeFolderUploadPath(raw: string): string | null {
  const value = String(raw ?? '')
    .replace(/\\/g, '/')
    .trim();
  if (!value || value.startsWith('/') || /^[a-zA-Z]:\//.test(value)) {
    return null;
  }

  const rawSegments = value.split('/');
  if (rawSegments.some((segment) => segment.trim() === '..')) return null;

  const segments = rawSegments
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((segment) =>
      segment
        .replace(/[^a-zA-Z0-9 _().-]/g, '_')
        .replace(/\s+/g, ' ')
        .slice(0, 180),
    )
    .filter(Boolean);

  return segments.length > 0 ? segments.join('/') : null;
}

/**
 * Part-number directories normally contain at least one digit. This keeps
 * container directories such as `photos`, `front`, and `assets` from becoming
 * false part-number folders while still accepting common OEM/MPN formats such
 * as `6L2Z-17K707-AA` and `12345`.
 */
export function isLikelyPartNumberFolderName(raw: string): boolean {
  const name = String(raw ?? '').trim();
  const normalized = name
    .toLowerCase()
    .replace(/[\s\-_./\\]+/g, '')
    .replace(/[^a-z0-9]/g, '');

  return (
    normalized.length >= 2 &&
    !GENERIC_FOLDER_NAMES.has(normalized) &&
    /\d/.test(normalized)
  );
}

/**
 * Convert one uploaded file path into the Image Drive folder and key path it
 * belongs to. The deepest part-number directory wins, which supports nested
 * collections without attaching a child part's images to its parent.
 */
export function resolveFolderUploadPath(
  rawPath: string,
  fallbackTopLevelFolderName = 'Folder Upload',
): FolderUploadPath | null {
  const relativePath = normalizeFolderUploadPath(rawPath);
  if (!relativePath) return null;

  const segments = relativePath.split('/');
  const fileName = segments[segments.length - 1];
  if (!fileName || !fileName.includes('.')) return null;

  let partIndex = -1;
  for (let i = segments.length - 2; i >= 0; i -= 1) {
    if (isLikelyPartNumberFolderName(segments[i])) {
      partIndex = i;
      break;
    }
  }

  const topLevelFolderName =
    fallbackTopLevelFolderName.trim() || segments[0] || 'Folder Upload';
  const partNumber = partIndex >= 0 ? segments[partIndex] : null;
  const assetSegments =
    partIndex >= 0 ? segments.slice(partIndex + 1) : segments.slice(1);

  return {
    relativePath,
    topLevelFolderName: topLevelFolderName.slice(0, 180),
    partNumber,
    assetPath: (assetSegments.length > 0 ? assetSegments : [fileName]).join(
      '/',
    ),
  };
}

export function isSupportedImageUpload(
  filename: string,
  mimeType?: string | null,
): boolean {
  if (mimeType?.toLowerCase().startsWith('image/')) return true;
  return /\.(avif|bmp|gif|heic|jpeg|jpg|png|tif|tiff|webp)$/i.test(filename);
}
