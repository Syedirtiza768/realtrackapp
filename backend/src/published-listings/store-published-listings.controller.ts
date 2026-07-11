import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { EbayIntegrationPermissionsService } from '../integrations/ebay/services/ebay-integration-permissions.service.js';
import { PublishedListingsService } from './services/published-listings.service.js';
import { PublishedListingsQueryDto } from './dto/published-listings.dto.js';

/**
 * Store-scoped view onto EbayPublishedListing, the local mirror of what's
 * actually live on eBay for a connected store (kept current by
 * PublishedListingsSyncService). Complements PublishedListingsController's
 * org-wide list/detail routes with a `/stores/:storeId/...` shape.
 */
@ApiTags('published-listings')
@ApiBearerAuth()
@Controller('stores')
@RequirePermissions('published_listings.view')
export class StorePublishedListingsController {
  constructor(
    private readonly listings: PublishedListingsService,
    private readonly storeAccess: StoreAccessService,
    private readonly permissions: EbayIntegrationPermissionsService,
  ) {}

  @Get(':storeId/listings/published')
  @ApiOperation({
    summary:
      'Complete published listing data for everything live on this store',
  })
  async listForStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: PublishedListingsQueryDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId } = await this.permissions.resolveOrganization(
      user.id,
      query.organizationId,
    );
    await this.storeAccess.assertStoreAccess(user, storeId, 'view');
    return this.listings.list(organizationId, user, { ...query, storeId });
  }

  @Get(':storeId/listings/published/:id')
  @ApiOperation({
    summary: 'Complete published listing data for one item on this store',
  })
  async getForStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } =
      await this.permissions.resolveOrganization(user.id, organizationId);
    await this.storeAccess.assertStoreAccess(user, storeId, 'view');
    const listing = await this.listings.getById(id, orgId, user);
    if (listing.storeId !== storeId) {
      throw new NotFoundException('Published listing not found on this store');
    }
    return listing;
  }
}
