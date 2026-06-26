import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InventoryService } from './inventory.service.js';
import { InventoryWorkbenchService } from './inventory-workbench.service.js';
import {
  AdjustInventoryDto,
  ReserveInventoryDto,
  ReleaseInventoryDto,
  ReconcileDto,
  LowStockQueryDto,
  InventoryEventsQueryDto,
} from './dto/inventory.dto.js';
import {
  InventoryListingsQueryDto,
  InventoryPartLookupDto,
  InventoryBulkPartLookupDto,
  InventoryEnrichDto,
} from './dto/inventory-workbench.dto.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly workbench: InventoryWorkbenchService,
  ) {}

  /* ── Workbench (must be registered before :listingId routes) ── */

  @Get('listings')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'List catalog listings for inventory workbench' })
  listWorkbenchListings(@Query() query: InventoryListingsQueryDto) {
    return this.workbench.listListings(query);
  }

  @Get('listings/:listingId/detail')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Full part detail for inventory workbench modal' })
  getListingDetail(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.workbench.getListingDetail(listingId);
  }

  @Post('part-lookup')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @RequirePermissions('inventory.enrich')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vision-first fetch details for one inventory part (OEM + brand + photos → title, category, SEO notes)',
  })
  lookupPart(@Body() dto: InventoryPartLookupDto) {
    return this.workbench.lookupPartForListing(dto.listingId);
  }

  @Post('part-lookup/bulk')
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @RequirePermissions('inventory.enrich')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vision-first fetch details for multiple inventory parts',
  })
  bulkLookupParts(@Body() dto: InventoryBulkPartLookupDto) {
    return this.workbench.bulkLookupParts(dto.listingIds);
  }

  @Post('send-to-pipeline')
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @RequirePermissions('inventory.enrich')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send selected inventory parts to enrichment pipeline (one batch job, vision on photos)' })
  sendToPipeline(@Body() dto: InventoryEnrichDto, @CurrentUser() user: User) {
    return this.workbench.sendToPipeline(dto.listingIds, user.id);
  }

  @Post('enrich')
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @RequirePermissions('inventory.enrich')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Alias for send-to-pipeline (deprecated)' })
  enrichListings(@Body() dto: InventoryEnrichDto, @CurrentUser() user: User) {
    return this.workbench.sendToPipeline(dto.listingIds, user.id);
  }

  @Get(':listingId')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get inventory ledger and recent events for a listing' })
  getLedger(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.inventoryService.getLedger(listingId);
  }

  @Post(':listingId/adjust')
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Adjust inventory quantity (idempotent)' })
  adjust(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.inventoryService.adjustQuantity(
      listingId,
      dto.change,
      dto.reason,
      dto.idempotencyKey,
      dto.sourceChannel,
    );
  }

  @Post(':listingId/reserve')
  @RequirePermissions('inventory.allocate')
  @ApiOperation({ summary: 'Reserve inventory for a pending order' })
  reserve(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: ReserveInventoryDto,
  ) {
    return this.inventoryService.reserveQuantity(listingId, dto.quantity, dto.orderId);
  }

  @Post(':listingId/release')
  @RequirePermissions('inventory.allocate')
  @ApiOperation({ summary: 'Release a reservation (e.g. order cancelled)' })
  release(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: ReleaseInventoryDto,
  ) {
    return this.inventoryService.releaseReservation(listingId, dto.quantity, dto.orderId);
  }

  @Get('alerts/low-stock')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get items below low-stock threshold' })
  lowStock(@Query() dto: LowStockQueryDto) {
    return this.inventoryService.getLowStock(dto.threshold, dto.limit);
  }

  @Post('reconcile')
  @RequirePermissions('inventory.reconcile')
  @ApiOperation({ summary: 'Reconcile inventory for specified listings' })
  reconcile(@Body() dto: ReconcileDto) {
    return this.inventoryService.reconcile(dto.listingIds);
  }

  @Get('events/log')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Query inventory events' })
  events(@Query() dto: InventoryEventsQueryDto) {
    return this.inventoryService.getEvents(
      dto.listingId,
      dto.type,
      dto.since,
      dto.limit,
      dto.offset,
    );
  }

  @Get('duplicates/scan')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Find duplicate listings by SKU/MPN/title similarity' })
  duplicates(@Query('confidence') confidence?: string) {
    return this.inventoryService.findDuplicates(
      confidence ? parseFloat(confidence) : undefined,
    );
  }

  // ─── Per-Store Allocation (gated by per_store_inventory flag) ───

  @Get(':listingId/allocations')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Get per-store allocations for a listing' })
  getAllocations(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.inventoryService.getAllocations(listingId, storeId);
  }

  @Post(':listingId/allocations')
  @RequirePermissions('inventory.allocate')
  @ApiOperation({ summary: 'Allocate inventory to a specific store' })
  allocateToStore(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() body: { storeId: string; quantity: number },
  ) {
    return this.inventoryService.allocateToStore(listingId, body.storeId, body.quantity);
  }

  @Post(':listingId/allocations/reserve')
  @RequirePermissions('inventory.allocate')
  @ApiOperation({ summary: 'Reserve from store allocation (order placed on store)' })
  reserveFromStore(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() body: { storeId: string; quantity: number; orderId: string },
  ) {
    return this.inventoryService.reserveFromStore(listingId, body.storeId, body.quantity, body.orderId);
  }
}
