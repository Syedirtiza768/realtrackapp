import type { SortMode } from '../../types/search';
import type { SortDirection } from '../ui/SortHeader';

/** Sortable catalog table columns (the serial `#` and checkbox columns are not). */
export type SortColumn =
  | 'sku'
  | 'image'
  | 'title'
  | 'team'
  | 'condition'
  | 'stock'
  | 'price'
  | 'date'
  | 'status'
  | 'ebay';

const SORT_MODES: Record<SortColumn, Record<SortDirection, SortMode>> = {
  sku: { asc: 'sku_asc', desc: 'sku_desc' },
  image: { asc: 'image_asc', desc: 'image_desc' },
  title: { asc: 'title_asc', desc: 'title_desc' },
  team: { asc: 'team_asc', desc: 'team_desc' },
  condition: { asc: 'condition_asc', desc: 'condition_desc' },
  stock: { asc: 'stock_asc', desc: 'stock_desc' },
  price: { asc: 'price_asc', desc: 'price_desc' },
  // Date Added: "ascending" = oldest first.
  date: { asc: 'oldest', desc: 'newest' },
  status: { asc: 'status_asc', desc: 'status_desc' },
  ebay: { asc: 'ebay_asc', desc: 'ebay_desc' },
};

/** Columns whose first click should show the biggest / newest values first. */
const DESC_FIRST = new Set<SortColumn>(['stock', 'price', 'date', 'image', 'status', 'ebay']);

export function sortDirectionFor(mode: SortMode, column: SortColumn): SortDirection | null {
  if (SORT_MODES[column].asc === mode) return 'asc';
  if (SORT_MODES[column].desc === mode) return 'desc';
  return null;
}

/** Click behaviour: unsorted → default direction, then flip on every further click. */
export function nextSortMode(mode: SortMode, column: SortColumn): SortMode {
  const current = sortDirectionFor(mode, column);
  const next: SortDirection = current
    ? current === 'asc' ? 'desc' : 'asc'
    : DESC_FIRST.has(column) ? 'desc' : 'asc';
  return SORT_MODES[column][next];
}
