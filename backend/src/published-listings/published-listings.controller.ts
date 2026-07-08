import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { EbayIntegrationPermissionsService } from '../integrations/ebay/services/ebay-integration-permissions.service.js';
import {
  BulkPublishedListingsDto,
  PublishedListingsQueryDto,
  RevisePublishedListingDto,
  SyncPublishedListingsDto,
  UpdatePoliciesDto,
} from './dto/published-listings.dto.js';
import { PublishedListingsService } from './services/published-listings.service.js';
import { PublishedListingsSyncService } from './services/published-listings-sync.service.js';
import { PublishedListingsActionService } from './services/published-listings-action.service.js';
import { PublishedListingsBulkService } from './services/published-listings-bulk.service.js';
import { PublishedListingsAuditService } from './services/published-listings-audit.service.js';
import { PublishedListingsPricingService } from './services/published-listings-pricing.service.js';

@ApiTags('published-listings')
@ApiBearerAuth()
@Controller('published-listings')
@RequirePermissions('published_listings.view')
export class PublishedListingsController {
  constructor(
    private readonly listings: PublishedListingsService,
    private readonly sync: PublishedListingsSyncService,
    private readonly actions: PublishedListingsActionService,
    private readonly bulk: PublishedListingsBulkService,
    private readonly audit: PublishedListingsAuditService,
    private readonly pricing: PublishedListingsPricingService,
    private readonly permissions: EbayIntegrationPermissionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List published eBay listings across connected stores',
  })
  async list(
    @Query() query: PublishedListingsQueryDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId } = await this.permissions.resolveOrganization(
      user.id,
      query.organizationId,
    );
    return this.listings.list(organizationId, user, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard summary counts for published listings' })
  async summary(
    @Query('organizationId') organizationId: string | undefined,
    @Query('ebayAccountId') ebayAccountId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.listings.getSummary(orgId, user, ebayAccountId);
  }

  @Get('sync-logs')
  @ApiOperation({ summary: 'Recent published listing sync logs' })
  async syncLogs(
    @Query('organizationId') organizationId: string | undefined,
    @Query('ebayAccountId') ebayAccountId: string | undefined,
    @Query('limit') limit = '20',
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    const items = await this.sync.getSyncLogs(
      orgId,
      ebayAccountId,
      Number(limit) || 20,
    );
    return { items };
  }

  @Post('sync')
  @RequirePermissions('published_listings.sync')
  @ApiOperation({ summary: 'Enqueue sync of published listings from eBay' })
  async syncListings(
    @Body() dto: SyncPublishedListingsDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId } = await this.permissions.resolveOrganization(
      user.id,
      dto.organizationId,
    );
    return this.sync.enqueueSync({
      organizationId,
      ebayAccountId: dto.ebayAccountId,
      marketplaceId: dto.marketplaceId,
      userId: user.id,
    });
  }

  @Post('competitor-pricing/refresh')
  @RequirePermissions('published_listings.sync')
  @ApiOperation({ summary: 'Refresh competitor pricing via Browse API' })
  async refreshCompetitorPricing(
    @Body() dto: SyncPublishedListingsDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId } = await this.permissions.resolveOrganization(
      user.id,
      dto.organizationId,
    );
    if (dto.ebayAccountId) {
      return this.pricing.refreshForAccount(organizationId, dto.ebayAccountId);
    }
    return this.pricing.refreshForOrganization(organizationId);
  }

  @Post('bulk')
  @RequirePermissions('published_listings.bulk')
  @ApiOperation({ summary: 'Enqueue bulk action on selected listings' })
  async bulkAction(
    @Body() dto: BulkPublishedListingsDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId } = await this.permissions.resolveOrganization(
      user.id,
      dto.organizationId,
    );
    const job = await this.bulk.createBulkJob(organizationId, user, dto);
    return { jobId: job.id, status: job.status, totalItems: job.totalItems };
  }

  @Get('bulk/:jobId')
  @ApiOperation({ summary: 'Get bulk job status and per-listing results' })
  async bulkStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.bulk.getJob(jobId, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get published listing detail' })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.listings.getById(id, orgId, user);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Listing revision / audit history' })
  async revisions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    await this.listings.getById(id, orgId, user);
    const items = await this.audit.listRevisions(id, orgId);
    return { items };
  }

  @Patch(':id')
  @RequirePermissions('published_listings.manage')
  @ApiOperation({ summary: 'Revise a published listing on eBay' })
  async revise(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisePublishedListingDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.actions.revise(id, orgId, user, dto);
  }

  @Patch(':id/policies')
  @RequirePermissions('published_listings.manage')
  @ApiOperation({
    summary:
      'Update business policies (shipping/return/payment) on a published eBay listing',
  })
  async updatePolicies(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePoliciesDto,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.actions.updatePolicies(id, orgId, user, dto);
  }

  @Post(':id/competitor-pricing')
  @RequirePermissions('published_listings.sync')
  @ApiOperation({ summary: 'Refresh competitor pricing for one listing' })
  async refreshListingCompetitorPricing(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.pricing.refreshCompetitorPricing(id, orgId);
  }

  @Post(':id/end')
  @RequirePermissions('published_listings.manage')
  @ApiOperation({ summary: 'End a published listing on eBay' })
  async end(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.actions.endListing(id, orgId, user);
  }

  @Post(':id/relist')
  @RequirePermissions('published_listings.manage')
  @ApiOperation({ summary: 'Relist an ended listing on eBay' })
  async relist(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.actions.relist(id, orgId, user);
  }

  @Post(':id/refresh')
  @RequirePermissions('published_listings.sync')
  @ApiOperation({ summary: 'Refresh a single listing from eBay' })
  async refresh(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    return this.actions.refreshListing(id, orgId, user);
  }
}
