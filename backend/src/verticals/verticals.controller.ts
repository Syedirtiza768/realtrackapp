import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { VerticalsService } from './verticals.service.js';
import {
  CreateFamilyDto,
  CreateVariantDto,
  CreateVariantMappingDto,
  PublishVariantFamilyDto,
  UpdateStoreVerticalConfigDto,
} from './verticals.dto.js';
import { EbayVariantPublishingService } from './ebay-variant-publishing.service.js';

@Controller('verticals')
export class VerticalsController {
  constructor(
    private readonly verticals: VerticalsService,
    private readonly userOrganizations: UserOrganizationService,
    private readonly variantPublishing: EbayVariantPublishingService,
  ) {}

  @Get('profiles')
  @RequirePermissions('catalog.view')
  getProfiles() {
    return this.verticals.getProfiles();
  }

  @Get('stores')
  @RequirePermissions('settings.view')
  async getStores(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.verticals.listStoresForOrganization(org.organizationId);
  }

  @Get('stores/:storeId/config')
  @RequirePermissions('settings.view')
  async getStoreConfig(
    @CurrentUser() user: User,
    @Param('storeId') storeId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.verticals.getStoreConfigForOrganization(
      storeId,
      org.organizationId,
    );
  }

  @Patch('stores/:storeId/config')
  @RequirePermissions('settings.manage')
  async updateStoreConfig(
    @CurrentUser() user: User,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreVerticalConfigDto,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.verticals.updateStoreConfig(storeId, org.organizationId, dto);
  }

  @Get('catalog/:productId/category-metadata')
  @RequirePermissions('catalog.view')
  async getCategoryMetadata(
    @Param('productId') productId: string,
    @Query('storeId') storeId: string,
    @Query('marketplaceId') marketplaceId: string,
    @Query('categoryId') categoryId: string,
  ) {
    return this.verticals.getCategoryMetadata(
      storeId,
      marketplaceId,
      categoryId,
    );
  }

  @Post('families')
  @RequirePermissions('catalog.update')
  async createFamily(
    @CurrentUser() user: User,
    @Body() dto: CreateFamilyDto,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.verticals.createFamily({
      ...dto,
      organizationId: org.organizationId,
    });
  }

  @Get('families/:familyId/variants')
  @RequirePermissions('catalog.view')
  async listVariants(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.verticals.listVariants(familyId, org.organizationId);
  }

  @Post('families/:familyId/variants')
  @RequirePermissions('catalog.update')
  async createVariant(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() dto: CreateVariantDto,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.verticals.createVariant({
      ...dto,
      familyId,
      organizationId: org.organizationId,
    });
  }

  @Post('variant-mappings')
  @RequirePermissions('ebay.publish')
  async createVariantMapping(
    @CurrentUser() user: User,
    @Body() dto: CreateVariantMappingDto,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.verticals.createVariantMapping({
      ...dto,
      organizationId: org.organizationId,
    });
  }

  @Post('families/:familyId/publish')
  @RequirePermissions('ebay.publish')
  async publishFamily(
    @CurrentUser() user: User,
    @Param('familyId') familyId: string,
    @Body() dto: PublishVariantFamilyDto,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return this.variantPublishing.publishFamily({
      ...dto,
      familyId,
      organizationId: org.organizationId,
    });
  }
}
