import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoresService } from './stores.service.js';
import {
  CreateStoreDto,
  UpdateStoreDto,
  CreateInstanceDto,
  PublishInstanceDto,
  BulkPublishInstancesDto,
} from './dto/store.dto.js';

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // ─── Store CRUD ───

  @Get()
  @ApiOperation({ summary: 'List stores, optionally filtered by connectionId' })
  getStores(@Query('connectionId') connectionId?: string) {
    return this.storesService.getStores(connectionId);
  }

  @Get('by-channel/:channel')
  @ApiOperation({ summary: 'List stores for a specific channel' })
  getStoresByChannel(@Param('channel') channel: string) {
    return this.storesService.getStoresByChannel(channel);
  }

  @Get(':storeId')
  @ApiOperation({ summary: 'Get a store by ID' })
  getStore(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.storesService.getStore(storeId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new store within a channel connection' })
  createStore(@Body() dto: CreateStoreDto) {
    return this.storesService.createStore(dto);
  }

  @Put(':storeId')
  @ApiOperation({ summary: 'Update a store' })
  updateStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storesService.updateStore(storeId, dto);
  }

  @Delete(':storeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a store' })
  deleteStore(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.storesService.deleteStore(storeId);
  }

  // ─── Listing Channel Instances ───

  @Get('instances/list')
  @ApiOperation({ summary: 'List listing channel instances with filters' })
  getInstances(
    @Query('listingId') listingId?: string,
    @Query('storeId') storeId?: string,
    @Query('connectionId') connectionId?: string,
    @Query('channel') channel?: string,
    @Query('syncStatus') syncStatus?: string,
  ) {
    return this.storesService.getInstances({
      listingId,
      storeId,
      connectionId,
      channel,
      syncStatus,
    });
  }

  @Get('instances/:instanceId')
  @ApiOperation({ summary: 'Get a listing channel instance by ID' })
  getInstance(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.storesService.getInstance(instanceId);
  }

  @Post('instances')
  @ApiOperation({ summary: 'Create a listing channel instance (assign listing to store)' })
  createInstance(@Body() dto: CreateInstanceDto) {
    return this.storesService.createInstance(dto);
  }

  @Post('instances/publish')
  @ApiOperation({ summary: 'Publish a listing channel instance to marketplace' })
  publishInstance(@Body() dto: PublishInstanceDto) {
    return this.storesService.publishInstance(dto.instanceId);
  }

  @Post('instances/bulk-publish')
  @ApiOperation({ summary: 'Bulk publish multiple instances' })
  bulkPublishInstances(@Body() dto: BulkPublishInstancesDto) {
    return this.storesService.bulkPublishInstances(dto.instanceIds);
  }

  @Post('instances/:instanceId/end')
  @ApiOperation({ summary: 'End/delist an instance' })
  endInstance(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.storesService.endInstance(instanceId);
  }

  // ─── Multi-store publish ───

  @Post('publish-multi-store')
  @ApiOperation({ summary: 'Publish a listing to multiple stores at once' })
  publishToMultipleStores(
    @Body()
    dto: {
      listingId: string;
      storeIds: string[];
      overrides?: Record<string, { price?: number; quantity?: number; title?: string }>;
    },
  ) {
    return this.storesService.publishToMultipleStores(
      dto.listingId,
      dto.storeIds,
      dto.overrides,
    );
  }

  // ─── Per-listing overview ───

  @Get('listing/:listingId/overview')
  @ApiOperation({ summary: 'Get multi-store channel overview for a listing' })
  getListingChannelOverview(@Param('listingId') listingId: string) {
    return this.storesService.getListingChannelOverview(listingId);
  }

  // ─── Demo simulation ───

  @Get('demo/logs')
  @ApiOperation({ summary: 'Get demo simulation logs' })
  getDemoLogs(
    @Query('channel') channel?: string,
    @Query('operationType') operationType?: string,
    @Query('listingId') listingId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.storesService.getDemoLogs({
      channel,
      operationType,
      listingId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('demo/simulate-order/:instanceId')
  @ApiOperation({ summary: 'Simulate an incoming order (demo mode)' })
  simulateOrder(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.storesService.simulateIncomingOrder(instanceId);
  }
}
