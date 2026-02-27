import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { ChannelsService } from './channels.service.js';
import {
  PublishListingDto,
  SyncInventoryDto,
  PublishMultiDto,
  BulkPublishDto,
} from './dto/channel.dto.js';

@ApiTags('channels')
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @ApiOperation({ summary: 'List all connected channels for the current user' })
  getConnections(@Query('userId') userId: string) {
    // TODO: Extract userId from JWT once auth guard is fully wired
    return this.channelsService.getConnections(userId);
  }

  @Get(':channel/auth-url')
  @ApiOperation({ summary: 'Get OAuth authorization URL for a channel' })
  getAuthUrl(
    @Param('channel') channel: string,
    @Query('state') state: string,
  ) {
    const url = this.channelsService.getAuthUrl(channel, state);
    return { url };
  }

  @Get(':channel/callback')
  @ApiOperation({ summary: 'Handle OAuth callback' })
  async handleCallback(
    @Param('channel') channel: string,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    // In production, decode userId from the state parameter
    const userId = state.split(':')[1] ?? 'system';
    return this.channelsService.handleOAuthCallback(channel, code, userId);
  }

  @Delete(':connectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect a channel' })
  disconnect(@Param('connectionId', ParseUUIDPipe) connectionId: string) {
    return this.channelsService.disconnectChannel(connectionId);
  }

  @Post(':connectionId/test')
  @ApiOperation({ summary: 'Test a channel connection' })
  testConnection(@Param('connectionId', ParseUUIDPipe) connectionId: string) {
    return this.channelsService.testConnection(connectionId);
  }

  @Post('publish')
  @ApiOperation({ summary: 'Publish a listing to a marketplace (async via queue)' })
  publish(@Body() dto: PublishListingDto) {
    return this.channelsService.enqueuePublish(dto.connectionId, dto.listingId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync inventory to a marketplace (async via queue)' })
  syncInventory(@Body() dto: SyncInventoryDto) {
    return this.channelsService.enqueueSync(dto.connectionId);
  }

  @Get(':connectionId/listings')
  @ApiOperation({ summary: 'Get all channel listings for a connection' })
  getChannelListings(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
  ) {
    return this.channelsService.getChannelListings(connectionId);
  }

  // ─── Per-SKU channel endpoints ───

  @Get('listings/:listingId/channels')
  @ApiOperation({ summary: 'Get channel statuses for a specific listing/SKU' })
  getListingChannels(@Param('listingId') listingId: string) {
    return this.channelsService.getListingChannelStatuses(listingId);
  }

  @Post('publish-multi')
  @ApiOperation({ summary: 'Publish a listing to multiple channels at once' })
  publishMulti(@Body() dto: PublishMultiDto) {
    return this.channelsService.publishMulti(dto.listingId, dto.channels, dto.overrides);
  }

  @Post('listings/:listingId/channel/:channel/update')
  @ApiOperation({ summary: 'Update a listing on a specific channel' })
  updateChannelListing(
    @Param('listingId') listingId: string,
    @Param('channel') channel: string,
  ) {
    return this.channelsService.updateChannelListing(listingId, channel);
  }

  @Post('listings/:listingId/channel/:channel/end')
  @ApiOperation({ summary: 'End/delist a listing on a specific channel' })
  endChannelListing(
    @Param('listingId') listingId: string,
    @Param('channel') channel: string,
  ) {
    return this.channelsService.endChannelListing(listingId, channel);
  }

  @Post('bulk-publish')
  @ApiOperation({ summary: 'Publish multiple listings to multiple channels' })
  bulkPublish(@Body() dto: BulkPublishDto) {
    return this.channelsService.bulkPublish(dto.listingIds, dto.channels);
  }

  // ─── Webhooks ───

  @Post('webhooks/ebay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'eBay webhook endpoint' })
  async ebayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-ebay-signature') signature: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.channelsService.logWebhook(
      'ebay',
      (body['metadata'] as any)?.topic ?? 'unknown',
      body,
      (body['notification'] as any)?.itemId,
    );
    return { status: 'received' };
  }

  @Post('webhooks/shopify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify webhook endpoint' })
  async shopifyWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') signature: string,
    @Headers('x-shopify-topic') topic: string,
    @Body() body: Record<string, unknown>,
  ) {
    await this.channelsService.logWebhook(
      'shopify',
      topic ?? 'unknown',
      body,
      body['id'] ? String(body['id']) : undefined,
    );
    return { status: 'received' };
  }
}
