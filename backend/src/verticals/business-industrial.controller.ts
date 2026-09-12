import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  BusinessIndustrialIncidentDto,
  BusinessIndustrialQuarantineDto,
  BusinessIndustrialReviewDto,
  BusinessIndustrialRoleDto,
  BusinessIndustrialStoreAssignmentsDto,
  BusinessIndustrialUserCreateDto,
  CreateBusinessIndustrialDraftDto,
  UpdateBusinessIndustrialDraftDto,
} from './business-industrial.dto.js';
import { BusinessIndustrialReleaseIncidentDto } from './business-industrial-release.dto.js';
import { BusinessIndustrialService } from './business-industrial.service.js';
import { BusinessIndustrialUsersService } from './business-industrial-users.service.js';
import {
  BusinessIndustrialUnitAllocationDto,
  BusinessIndustrialUnitSoldDto,
} from './business-industrial-units.dto.js';

@Controller('business-industrial')
@RequirePermissions('business_industrial.access')
export class BusinessIndustrialController {
  constructor(
    private readonly businessIndustrial: BusinessIndustrialService,
    private readonly businessIndustrialUsers: BusinessIndustrialUsersService,
  ) {}

  @Public()
  @Post('webhooks/ebay-enforcement')
  @HttpCode(200)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-ebay-signature') signature?: string,
  ) {
    return this.businessIndustrial.processEnforcementWebhook(
      request.rawBody ?? Buffer.alloc(0),
      signature,
    );
  }

  @Get('workspace')
  @RequirePermissions('business_industrial.dashboard.view')
  workspace(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.workspace(user, organizationId);
  }

  @Get('categories')
  @RequirePermissions('business_industrial.listings.view')
  categories() {
    return this.businessIndustrial.categoryFamilies();
  }

  @Get('listings')
  @RequirePermissions('business_industrial.listings.view')
  listings(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
    @Query('limit') limit = '50',
  ) {
    return this.businessIndustrial.listListings(
      user,
      organizationId,
      Number(limit),
    );
  }

  @Post('listings')
  @RequirePermissions('business_industrial.listings.create')
  createListing(
    @CurrentUser() user: User,
    @Body() dto: CreateBusinessIndustrialDraftDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.createListing(user, dto, organizationId);
  }

  @Patch('listings/:id')
  @RequirePermissions('business_industrial.listings.update')
  updateListing(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessIndustrialDraftDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.updateListing(user, id, dto, organizationId);
  }

  @Get('review')
  @RequirePermissions('business_industrial.review')
  reviewQueue(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.listReviews(user, organizationId);
  }

  @Get('listings/:id/review')
  @RequirePermissions('business_industrial.review.private')
  privateReview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.getPrivateReview(user, id, organizationId);
  }

  @Post('listings/:id/review')
  @RequirePermissions('business_industrial.review')
  reviewListing(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BusinessIndustrialReviewDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.reviewListing(user, id, dto, organizationId);
  }

  @Post('listings/:id/quarantine')
  @RequirePermissions('business_industrial.incidents.manage')
  quarantine(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: BusinessIndustrialQuarantineDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.quarantine(
      user,
      id,
      organizationId,
      body?.notes,
    );
  }

  @Post('units/:unitId/allocate')
  @RequirePermissions('business_industrial.listings.update')
  allocateUnit(
    @CurrentUser() user: User,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: BusinessIndustrialUnitAllocationDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.allocateUnit(
      user,
      unitId,
      dto,
      organizationId,
    );
  }

  @Post('units/:unitId/sold')
  @RequirePermissions('business_industrial.listings.update')
  markUnitSold(
    @CurrentUser() user: User,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: BusinessIndustrialUnitSoldDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.markUnitSold(
      user,
      unitId,
      dto,
      organizationId,
    );
  }

  @Get('incidents')
  @RequirePermissions('business_industrial.incidents.view')
  incidents(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.listIncidents(user, organizationId);
  }

  @Post('incidents')
  @RequirePermissions('business_industrial.incidents.manage')
  createIncident(
    @CurrentUser() user: User,
    @Body() dto: BusinessIndustrialIncidentDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.createIncident(user, dto, organizationId);
  }

  @Post('incidents/:id/release')
  @RequirePermissions('business_industrial.incidents.release')
  releaseIncident(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BusinessIndustrialReleaseIncidentDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.releaseIncident(
      user,
      id,
      dto.notes,
      organizationId,
    );
  }

  @Post('incidents/:id/takedown')
  @RequirePermissions('business_industrial.incidents.manage')
  retryIncidentTakedown(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrial.retryIncidentTakedown(
      user,
      id,
      organizationId,
    );
  }

  @Get('stores')
  @RequirePermissions('business_industrial.stores.view')
  async stores(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.businessIndustrial.resolveOrganization(
      user,
      organizationId,
    );
    return (
      await this.businessIndustrial.authorizedStores(user, org.organizationId)
    ).map((store) => ({
      id: store.id,
      storeName: store.storeName,
      status: store.status,
      marketplaceId: store.ebayMarketplaceId,
      vertical: 'business_industrial',
    }));
  }

  @Get('users')
  @RequirePermissions('business_industrial.users.manage')
  users(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrialUsers.list(user, organizationId);
  }

  @Post('users')
  @RequirePermissions('business_industrial.users.manage')
  createUser(
    @CurrentUser() user: User,
    @Body() dto: BusinessIndustrialUserCreateDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrialUsers.create(user, dto, organizationId);
  }

  @Patch('users/:userId/role')
  @RequirePermissions('business_industrial.roles.manage')
  updateUserRole(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BusinessIndustrialRoleDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrialUsers.updateRole(
      user,
      userId,
      dto,
      organizationId,
    );
  }

  @Patch('users/:userId/deactivate')
  @RequirePermissions('business_industrial.users.manage')
  deactivateUser(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrialUsers.deactivate(
      user,
      userId,
      organizationId,
    );
  }

  @Patch('users/:userId/stores')
  @RequirePermissions('business_industrial.users.manage')
  setStoreAccess(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BusinessIndustrialStoreAssignmentsDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.businessIndustrialUsers.setStores(
      user,
      userId,
      dto,
      organizationId,
    );
  }
}
