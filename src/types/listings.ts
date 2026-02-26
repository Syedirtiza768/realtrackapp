/* ── Types matching the NestJS ListingRecord entity ──────── */

/** A listing record as returned by GET /api/listings */
export interface ListingRecord {
  id: string;
  customLabelSku: string | null;
  title: string | null;
  cBrand: string | null;
  cType: string | null;
  categoryId: string | null;
  categoryName: string | null;
  startPrice: string | null;
  quantity: string | null;
  conditionId: string | null;
  itemPhotoUrl: string | null;
  cManufacturerPartNumber: string | null;
  cOeOemPartNumber: string | null;
  location: string | null;
  format: string | null;
  sourceFileName: string | null;
  importedAt: string;
  description: string | null;
}

/** Full listing detail (all 76 columns) from GET /api/listings/:id */
export interface ListingRecordFull extends ListingRecord {
  action: string | null;
  relationship: string | null;
  relationshipDetails: string | null;
  scheduleTime: string | null;
  pUpc: string | null;
  pEpid: string | null;
  buyItNowPrice: string | null;
  bestOfferEnabled: string | null;
  bestOfferAutoAcceptPrice: string | null;
  minimumBestOfferPrice: string | null;
  immediatePayRequired: string | null;
  duration: string | null;
  shippingService1Option: string | null;
  shippingService1Cost: string | null;
  shippingService2Option: string | null;
  shippingService2Cost: string | null;
  maxDispatchTime: string | null;
  returnsAcceptedOption: string | null;
  refundOption: string | null;
  returnShippingCostPaidBy: string | null;
  shippingProfileName: string | null;
  returnProfileName: string | null;
  paymentProfileName: string | null;
  cFeatures: string | null;
  cItemHeight: string | null;
  cItemLength: string | null;
  cItemWidth: string | null;
  cItemDiameter: string | null;
  cOperatingMode: string | null;
  cFuelType: string | null;
  cDriveType: string | null;
  manufacturerName: string | null;
  sourceFilePath: string | null;
  sheetName: string | null;
  sourceRowNumber: number;
}

export interface ListingsResponse {
  total: number;
  limit: number;
  offset: number;
  items: ListingRecord[];
}

export interface ListingsSummary {
  totalRecords: number;
  uniqueSkus: number;
  files: number;
}

export interface FacetEntry {
  value: string;
  count: number;
}

export interface CategoryFacetEntry extends FacetEntry {
  id: string;
}

export interface ListingsFacets {
  brands: FacetEntry[];
  categories: CategoryFacetEntry[];
  conditions: FacetEntry[];
  sourceFiles: FacetEntry[];
}

export interface ListingsQuery {
  limit?: number;
  offset?: number;
  search?: string;
  sku?: string;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  cType?: string;
  conditionId?: string;
  sourceFile?: string;
  hasImage?: string;
}
