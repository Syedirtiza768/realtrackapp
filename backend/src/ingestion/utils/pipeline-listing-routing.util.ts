/**
 * Product rule — simple delete + donor re-import:
 *
 * - Soft-delete hides that listing row (`deletedAt` set). It stays deleted.
 * - Pipeline matches ONLY active rows (`deletedAt IS NULL`).
 * - If a SKU has no active row (including when only soft-deleted rows exist),
 *   the pipeline INSERTs a NEW listing. It never recovers / undeletes the old row.
 * - Re-uploading the same donor file therefore recreates inventory for that SKU
 *   as a fresh row; historical soft-deleted rows remain soft-deleted.
 */

export interface PipelineListingRouteResult<T> {
  rowsToUpdate: Array<{ id: string; lr: T }>;
  rowsToInsert: T[];
  droppedDuplicates: number;
}

/**
 * @param listingRecords parsed pipeline listing rows for one marketplace
 * @param activeIdBySku map of customLabelSku → active listing id
 *        (only rows with deletedAt IS NULL; soft-deleted must NOT be included)
 */
export function routePipelineListingRecords<
  T extends { customLabelSku?: string | null },
>(
  listingRecords: T[],
  activeIdBySku: Map<string, string>,
): PipelineListingRouteResult<T> {
  const rowsToUpdate: Array<{ id: string; lr: T }> = [];
  const rowsToInsert: T[] = [];
  const seenSku = new Set<string>();
  let droppedDuplicates = 0;

  for (const lr of listingRecords) {
    const sku = lr.customLabelSku?.trim();
    if (!sku) {
      rowsToInsert.push(lr);
      continue;
    }
    if (seenSku.has(sku)) {
      droppedDuplicates++;
      continue;
    }
    seenSku.add(sku);

    const existingId = activeIdBySku.get(sku);
    if (existingId) {
      rowsToUpdate.push({ id: existingId, lr });
    } else {
      // No active row: insert new. Soft-deleted twins (if any) stay deleted.
      rowsToInsert.push(lr);
    }
  }

  return { rowsToUpdate, rowsToInsert, droppedDuplicates };
}

/** Build active-id map from DB rows that are already filtered to deletedAt IS NULL. */
export function buildActiveIdBySku(
  rows: Array<{ id: string; customLabelSku: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    const sku = r.customLabelSku?.trim();
    if (sku) map.set(sku, r.id);
  }
  return map;
}
