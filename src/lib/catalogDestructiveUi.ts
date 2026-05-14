/**
 * When true, shows: Catalog Import “Clear catalog”, and Catalog browse delete (per-item + bulk).
 * Default hidden. Enable with `VITE_SHOW_CATALOG_DESTRUCTIVE_UI=true` in `.env` for admin/dev.
 */
export const showCatalogDestructiveUi =
  import.meta.env.VITE_SHOW_CATALOG_DESTRUCTIVE_UI === 'true';
