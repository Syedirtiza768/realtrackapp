import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  CrossStoreSaleSyncService,
  type CrossStoreSyncResult,
} from './cross-store-sale-sync.service.js';

export class RunCrossStoreSaleSyncDto {
  /** Orders to (re)apply. Either this or `since`. */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  orderIds?: string[];

  /** Every eBay order placed at or after this time. */
  @IsOptional()
  @IsDateString()
  since?: string;

  /** Read eBay and return what would change, without changing anything. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class ListCrossStoreSaleSyncQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * Cross-store sale sync (a part sold on one eBay store is ended / lowered on
 * every other store). Runs automatically on each imported eBay order; these
 * endpoints show its record and re-run it for past orders.
 */
@ApiTags('Inventory sync')
@Controller('inventory-sync/ebay')
export class CrossStoreSaleSyncController {
  constructor(private readonly sync: CrossStoreSaleSyncService) {}

  @Get('sales')
  @RequirePermissions('orders.view')
  @ApiOperation({
    summary: 'Recent cross-store sale sync actions (newest first)',
  })
  list(@Query() q: ListCrossStoreSaleSyncQuery) {
    return this.sync.listRecent(q.limit ?? 200, q.status);
  }

  @Post('sales/run')
  @RequirePermissions('orders.import')
  @ApiOperation({
    summary:
      'Apply past eBay sales to the other stores (dryRun: only report what would change)',
  })
  async run(@Body() dto: RunCrossStoreSaleSyncDto) {
    const orderIds = dto.orderIds?.length
      ? dto.orderIds
      : dto.since
        ? await this.sync.ordersSince(new Date(dto.since))
        : null;
    if (!orderIds) throw new BadRequestException('Send orderIds or since');
    if (dto.dryRun) {
      if (orderIds.length > 100)
        throw new BadRequestException('A dry run covers at most 100 orders');
      const results: CrossStoreSyncResult[] = [];
      for (const id of orderIds)
        results.push(...(await this.sync.syncOrder(id, { dryRun: true })));
      return { dryRun: true, orders: orderIds.length, results };
    }
    if (!(await this.sync.enabled())) {
      throw new BadRequestException(
        'Feature flag ebay_cross_store_sale_sync is off',
      );
    }
    for (const id of orderIds) await this.sync.enqueue(id, 0);
    return { dryRun: false, queued: orderIds.length };
  }
}
