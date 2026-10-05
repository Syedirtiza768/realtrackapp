/** Maximum number of image URLs accepted by the listing image fields. */
export const PIPELINE_IMAGE_URL_LIMIT = 24;

/** Treat only real HTTP(S) URLs as images; warehouse/bin labels are metadata. */
export function isHttpImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}

/** Parse the pipe-delimited listing image field and discard non-URLs. */
export function parseImageUrlPipe(value: string | null | undefined): string[] {
  return (value ?? '')
    .split('|')
    .map((candidate) => candidate.trim())
    .filter(isHttpImageUrl);
}

/** Return whether a listing or catalog image field contains a usable URL. */
export function hasHttpImageUrls(value: unknown): boolean {
  if (typeof value === 'string') return parseImageUrlPipe(value).length > 0;
  return Array.isArray(value) && value.some(isHttpImageUrl);
}

/**
 * Put matched Image Drive URLs first, then retain existing valid URLs.
 */
export function mergeImageUrls(
  existing: readonly unknown[] | null | undefined,
  additions: readonly unknown[],
  limit = PIPELINE_IMAGE_URL_LIMIT,
): string[] {
  const merged = new Set<string>();
  for (const candidate of additions) {
    if (isHttpImageUrl(candidate)) merged.add(candidate.trim());
  }
  for (const candidate of existing ?? []) {
    if (isHttpImageUrl(candidate)) merged.add(candidate.trim());
  }
  return [...merged].slice(0, limit);
}
