import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service.js';
import {
  AdjustInventoryDto,
  ReserveInventoryDto,
  ReleaseInventoryDto,
  ReconcileDto,
  LowStockQueryDto,
  InventoryEventsQueryDto,
} from './dto/inventory.dto.js';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':listingId')
  @ApiOperation({ summary: 'Get inventory ledger and recent events for a listing' })
  getLedger(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.inventoryService.getLedger(listingId);
  }

  @Post(':listingId/adjust')
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
  @ApiOperation({ summary: 'Reserve inventory for a pending order' })
  reserve(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: ReserveInventoryDto,
  ) {
    return this.inventoryService.reserveQuantity(listingId, dto.quantity, dto.orderId);
  }

  @Post(':listingId/release')
  @ApiOperation({ summary: 'Release a reservation (e.g. order cancelled)' })
  release(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: ReleaseInventoryDto,
  ) {
    return this.inventoryService.releaseReservation(listingId, dto.quantity, dto.orderId);
  }

  @Get('alerts/low-stock')
  @ApiOperation({ summary: 'Get items below low-stock threshold' })
  lowStock(@Query() dto: LowStockQueryDto) {
    return this.inventoryService.getLowStock(dto.threshold, dto.limit);
  }

  @Post('reconcile')
  @ApiOperation({ summary: 'Reconcile inventory for specified listings' })
  reconcile(@Body() dto: ReconcileDto) {
    return this.inventoryService.reconcile(dto.listingIds);
  }

  @Get('events/log')
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
  @ApiOperation({ summary: 'Find duplicate listings by SKU/MPN/title similarity' })
  duplicates(@Query('confidence') confidence?: string) {
    return this.inventoryService.findDuplicates(
      confidence ? parseFloat(confidence) : undefined,
    );
  }
}
