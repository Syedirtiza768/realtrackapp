import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * Query DTOs are validated with forbidNonWhitelisted, so the active-workspace param that
 * every stock route also reads via @Query('organizationId') must be declared here too.
 */
class OrgQueryDto {
  @IsOptional() @IsUUID() organizationId?: string;
}

/* ── Warehouses & bins ──────────────────────────────────────────── */

export class WarehouseDto {
  @IsString() @MaxLength(40) @Matches(CODE) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsIn(['owned', '3pl', 'virtual']) type?: 'owned' | '3pl' | 'virtual';
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @IsOptional() @IsObject() address?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(36) ebayMerchantLocationKey?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isSellable?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateWarehouseDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsIn(['owned', '3pl', 'virtual']) type?: 'owned' | '3pl' | 'virtual';
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;
  @IsOptional() @IsString() @MaxLength(60) timezone?: string;
  @IsOptional() @IsObject() address?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(36) ebayMerchantLocationKey?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isSellable?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

const LOCATION_TYPES = ['storage', 'receiving', 'staging', 'returns', 'quarantine'] as const;

export class LocationDto {
  @IsString() @MaxLength(60) @Matches(CODE) code!: string;
  @IsOptional() @IsString() @MaxLength(40) zone?: string;
  @IsOptional() @IsString() @MaxLength(20) aisle?: string;
  @IsOptional() @IsString() @MaxLength(20) rack?: string;
  @IsOptional() @IsString() @MaxLength(20) shelf?: string;
  @IsOptional() @IsString() @MaxLength(20) bin?: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsOptional() @IsIn(LOCATION_TYPES) type?: (typeof LOCATION_TYPES)[number];
  @IsOptional() @IsBoolean() isPickable?: boolean;
  @IsOptional() @IsInt() @Min(0) capacityUnits?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateLocationDto {
  @IsOptional() @IsString() @MaxLength(40) zone?: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsOptional() @IsIn(LOCATION_TYPES) type?: (typeof LOCATION_TYPES)[number];
  @IsOptional() @IsBoolean() isPickable?: boolean;
  @IsOptional() @IsInt() @Min(0) capacityUnits?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** Generates bins as {prefix}{aisle}-{rack}-{shelf}, e.g. A-01-1 … C-05-4. */
export class GenerateLocationsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(26) @IsString({ each: true }) aisles!: string[];
  @Type(() => Number) @IsInt() @Min(1) @Max(99) racks!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) shelves!: number;
  @IsOptional() @IsString() @MaxLength(10) prefix?: string;
  @IsOptional() @IsString() @MaxLength(40) zone?: string;
}

export class StoreLinkDto {
  @IsUUID() warehouseId!: string;
  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SetStoreLinksDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => StoreLinkDto)
  links!: StoreLinkDto[];
}

export class StorePolicyDto {
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) bufferQty?: number;
  @IsOptional() @IsInt() @Min(0) maxQty?: number | null;
  @IsOptional() @IsBoolean() includeSourceable?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1000) maxSourceableQty?: number;
}

export class WarehouseAssignmentsDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) warehouseIds!: string[];
}

/* ── Suppliers & sources ────────────────────────────────────────── */

const SUPPLIER_TYPES = ['distributor', 'manufacturer', 'marketplace', 'salvage_yard', 'individual', 'other'] as const;

export class SupplierDto {
  @IsString() @MaxLength(40) @Matches(CODE) code!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsIn(SUPPLIER_TYPES) type?: (typeof SUPPLIER_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) website?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) defaultLeadTimeDays?: number;
  @IsOptional() @IsBoolean() supportsDropship?: boolean;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(SUPPLIER_TYPES) type?: (typeof SUPPLIER_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) website?: string;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) defaultLeadTimeDays?: number;
  @IsOptional() @IsBoolean() supportsDropship?: boolean;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ItemSourceDto {
  @IsUUID() supplierId!: string;
  @IsOptional() @IsString() @MaxLength(160) supplierSku?: string;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsInt() @Min(0) availableQty?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(365) leadTimeDays?: number;
  @IsOptional() @IsInt() @Min(0) priority?: number;
  @IsOptional() @IsIn(['ship_to_warehouse', 'dropship']) fulfillmentMode?: 'ship_to_warehouse' | 'dropship';
  @IsOptional() @IsString() @MaxLength(1000) url?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/* ── Items ──────────────────────────────────────────────────────── */

export class ItemsQueryDto extends OrgQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsIn(['in_stock', 'out_of_stock', 'low_stock', 'reserved', 'inbound', 'sourceable', 'unlinked'])
  filter?: string;
  @IsOptional() @IsIn(['stocked', 'on_demand', 'hybrid']) sourcingMode?: string;
  @IsOptional() @IsIn(['active', 'discontinued', 'archived']) status?: string;
  @IsOptional() @IsString() vertical?: string;
  @IsOptional() @IsIn(['sku', 'title', 'on_hand', 'available', 'updated']) sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) dir?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class CreateItemDto {
  @IsString() @MaxLength(160) sku!: string;
  @IsOptional() @IsString() @MaxLength(500) title?: string;
  @IsOptional() @IsString() vertical?: string;
  @IsOptional() @IsUUID() catalogProductId?: string;
  @IsOptional() @IsUUID() listingRecordId?: string;
  @IsOptional() @IsUUID() productVariantId?: string;
  @IsOptional() @IsIn(['quantity', 'serial', 'one_off']) trackingMode?: 'quantity' | 'serial' | 'one_off';
  @IsOptional() @IsIn(['stocked', 'on_demand', 'hybrid']) sourcingMode?: 'stocked' | 'on_demand' | 'hybrid';
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsInt() @Min(0) reorderPoint?: number;
  @IsOptional() @IsInt() @Min(0) reorderQty?: number;
}

export class UpdateItemDto {
  @IsOptional() @IsString() @MaxLength(500) title?: string;
  @IsOptional() @IsUUID() catalogProductId?: string | null;
  @IsOptional() @IsUUID() listingRecordId?: string | null;
  @IsOptional() @IsUUID() productVariantId?: string | null;
  @IsOptional() @IsIn(['quantity', 'serial', 'one_off']) trackingMode?: 'quantity' | 'serial' | 'one_off';
  @IsOptional() @IsIn(['stocked', 'on_demand', 'hybrid']) sourcingMode?: 'stocked' | 'on_demand' | 'hybrid';
  @IsOptional() @IsNumber() @Min(0) unitCost?: number | null;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string | null;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsInt() @Min(0) reorderPoint?: number;
  @IsOptional() @IsInt() @Min(0) reorderQty?: number;
  @IsOptional() @IsIn(['active', 'discontinued', 'archived']) status?: 'active' | 'discontinued' | 'archived';
}

/* ── Quick stock operations ─────────────────────────────────────── */

export class ReceiveDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsOptional() @IsUUID() locationId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) serials?: string[];
  @IsOptional() @IsString() @MaxLength(80) lotCode?: string;
  @IsOptional() @IsString() @MaxLength(40) conditionId?: string;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsString() @MaxLength(120) idempotencyKey?: string;
}

export const ADJUSTMENT_REASONS = [
  'found',
  'lost',
  'damaged',
  'theft',
  'correction',
  'write_off',
  'return_to_supplier',
  'sample',
  'other',
] as const;

export class AdjustDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsOptional() @IsUUID() locationId?: string;
  /** Signed on-hand change. */
  @Type(() => Number) @IsInt() @Min(-100000) @Max(100000) quantity!: number;
  @IsIn(ADJUSTMENT_REASONS) reasonCode!: (typeof ADJUSTMENT_REASONS)[number];
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsString() @MaxLength(120) idempotencyKey?: string;
}

export class MoveDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsOptional() @IsUUID() fromLocationId?: string | null;
  @IsOptional() @IsUUID() toLocationId?: string | null;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() @MaxLength(120) idempotencyKey?: string;
}

export class DamageDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  @IsOptional() @IsUUID() locationId?: string;
  /** Positive marks units damaged; negative restores them to sellable. */
  @Type(() => Number) @IsInt() @Min(-100000) @Max(100000) quantity!: number;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class DocumentLineDto {
  @IsUUID() itemId!: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsUUID() destLocationId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @Type(() => Number) @IsInt() @Min(-100000) @Max(100000) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) serials?: string[];
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CreateTransferDto {
  @IsUUID() warehouseId!: string;
  @IsUUID() destWarehouseId!: string;
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsDateString() expectedAt?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];
}

export class ReceiveLineDto {
  @IsUUID() lineId!: string;
  @Type(() => Number) @IsInt() @Min(0) quantity!: number;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) serials?: string[];
}

export class ReceiveDocumentDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}

export class CreateAdjustmentDocDto {
  @IsUUID() warehouseId!: string;
  @IsIn(ADJUSTMENT_REASONS) reasonCode!: (typeof ADJUSTMENT_REASONS)[number];
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];
}

export class CreateCountDto {
  @IsUUID() warehouseId!: string;
  /** Count specific bins; omitted = every bin with stock in the warehouse. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) locationIds?: string[];
  /** Count specific items; omitted = every item with stock in scope. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) itemIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class CountLineDto {
  @IsOptional() @IsUUID() lineId?: string;
  /** For unplanned finds during a count. */
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsUUID() locationId?: string;
  @Type(() => Number) @IsInt() @Min(0) countedQty!: number;
}

export class RecordCountDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CountLineDto)
  lines!: CountLineDto[];
}

export class DocumentsQueryDto extends OrgQueryDto {
  @IsOptional() @IsIn(['receipt', 'transfer', 'adjustment', 'count', 'purchase_order']) type?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class MovementsQueryDto extends OrgQueryDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsUUID() orderId?: string;
  @IsOptional() @IsUUID() documentId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

/* ── Procurement ────────────────────────────────────────────────── */

export class ProcurementQueryDto extends OrgQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

export class CreateProcurementRequestDto {
  @IsUUID() itemId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsIn(['ship_to_warehouse', 'dropship']) fulfillmentMode?: 'ship_to_warehouse' | 'dropship';
  @IsOptional() @IsDateString() neededBy?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class UpdateProcurementRequestDto {
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsIn(['ship_to_warehouse', 'dropship']) fulfillmentMode?: 'ship_to_warehouse' | 'dropship';
  @IsOptional() @IsNumber() @Min(0) estimatedUnitCost?: number;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID() supplierId!: string;
  @IsUUID() warehouseId!: string;
  /** Procurement requests to fulfil; their quantities become PO lines. */
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) requestIds?: string[];
  /** Extra stock lines not tied to a request. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DocumentLineDto)
  lines?: DocumentLineDto[];
  @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsDateString() expectedAt?: string;
}

export class FromRequestsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('all', { each: true }) requestIds!: string[];
  @IsOptional() @IsUUID() warehouseId?: string;
}

export class DropshipDto {
  @IsOptional() @IsString() @MaxLength(120) supplierTracking?: string;
  @IsOptional() @IsString() @MaxLength(60) carrier?: string;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class ReorderSuggestDto {
  @IsOptional() @IsBoolean() createRequests?: boolean;
}

/* ── Setup / backfill ───────────────────────────────────────────── */

export class BootstrapDto {
  @IsOptional() @IsBoolean() dryRun?: boolean;
  /** Seed opening balances from current product quantities (default true). */
  @IsOptional() @IsBoolean() openingBalances?: boolean;
  /** Also adopt Auto Parts rows that have no organization yet (default false). */
  @IsOptional() @IsBoolean() claimUnscopedAutomotive?: boolean;
  @IsOptional() @IsString() @MaxLength(40) @Matches(CODE) defaultWarehouseCode?: string;
  @IsOptional() @IsString() @MaxLength(120) defaultWarehouseName?: string;
}

export class ScanDto {
  @IsString() @MaxLength(200) code!: string;
}
