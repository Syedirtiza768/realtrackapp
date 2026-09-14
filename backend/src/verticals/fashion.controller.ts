import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { Store } from '../channels/entities/store.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { FashionReview } from './entities/fashion-review.entity.js';
import {
  AnalyzeFashionImagesDto,
  CreateFashionDraftDto,
  FashionReviewDto,
  FashionRoleDto,
  FashionStoreConfigDto,
  FashionStoreAccessDto,
  FashionUserCreateDto,
  GenerateFashionListingDto,
  UpdateFashionDraftDto,
} from './fashion.dto.js';
import { VerticalsService } from './verticals.service.js';
import { FashionListingsService } from './fashion-listings.service.js';
import { FashionUsersService } from './fashion-users.service.js';
import { FashionImageAnalysisService } from './fashion-image-analysis.service.js';

@Controller('fashion')
@RequirePermissions('fashion.access')
export class FashionController {
  constructor(
    private readonly verticals: VerticalsService,
    private readonly userOrganizations: UserOrganizationService,
    private readonly storeAccess: StoreAccessService,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(FashionReview)
    private readonly reviewRepo: Repository<FashionReview>,
    private readonly fashionListings: FashionListingsService,
    private readonly fashionUsers: FashionUsersService,
    private readonly fashionImages: FashionImageAnalysisService,
  ) {}

  @Get('workspace')
  @RequirePermissions('fashion.access', 'fashion.dashboard.view')
  async workspace(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const stores = await this.authorizedFashionStores(user, org.organizationId);
    const [listingCount, reviewCount] = await Promise.all([
      this.productRepo.count({
        where: { organizationId: org.organizationId, vertical: 'fashion' },
      }),
      this.reviewRepo.count({
        where: { organizationId: org.organizationId, status: 'pending' },
      }),
    ]);
    return {
      organizationId: org.organizationId,
      organizationRole: org.member.role,
      stores: stores.map((store) => this.storeSummary(store)),
      metrics: { listingCount, pendingReviewCount: reviewCount },
    };
  }

  @Get('users')
  @RequirePermissions('fashion.access', 'fashion.users.manage')
  users(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionUsers.list(user, organizationId);
  }

  @Post('users')
  @RequirePermissions('fashion.access', 'fashion.users.manage')
  createUser(
    @CurrentUser() user: User,
    @Body() dto: FashionUserCreateDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionUsers.create(user, dto, organizationId);
  }

  @Patch('users/:userId/role')
  @RequirePermissions('fashion.access', 'fashion.roles.manage')
  updateUserRole(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) id: string,
    @Body() dto: FashionRoleDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionUsers.updateRole(user, id, dto, organizationId);
  }

  @Patch('users/:userId/deactivate')
  @RequirePermissions('fashion.access', 'fashion.users.manage')
  deactivateUser(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionUsers.deactivate(user, id, organizationId);
  }

  @Patch('users/:userId/stores')
  @RequirePermissions('fashion.access', 'fashion.users.manage')
  setUserStores(
    @CurrentUser() user: User,
    @Param('userId', ParseUUIDPipe) id: string,
    @Body() dto: FashionStoreAccessDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionUsers.setStores(user, id, dto, organizationId);
  }

  @Get('stores')
  @RequirePermissions('fashion.access', 'fashion.stores.view')
  async stores(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    return (await this.authorizedFashionStores(user, org.organizationId)).map(
      (store) => this.storeSummary(store),
    );
  }

  @Patch('stores/:storeId/config')
  @RequirePermissions('fashion.access', 'fashion.settings.manage')
  async updateStore(
    @CurrentUser() user: User,
    @Param('storeId', ParseUUIDPipe) id: string,
    @Body() dto: FashionStoreConfigDto,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    await this.storeAccess.assertStoreAccess(user, id, 'admin');
    const store = (
      await this.authorizedFashionStores(user, org.organizationId)
    ).find((entry) => entry.id === id);
    if (!store) throw new NotFoundException('Fashion store not found');
    if (!dto.enabled)
      throw new ConflictException(
        'Dedicated Fashion stores cannot be converted to another vertical',
      );
    return this.verticals.getStoreConfig(store);
  }

  @Get('listings')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  async listings(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
    @Query('limit') limit = '50',
  ) {
    const org = await this.userOrganizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const products = await this.productRepo.find({
      where: { organizationId: org.organizationId, vertical: 'fashion' },
      order: { updatedAt: 'DESC' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });
    return products.map((product) =>
      this.fashionListings.publicProduct(product),
    );
  }

  @Get('listings/:id')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  listing(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionListings.detail(user, id, organizationId);
  }

  @Post('listings/photos')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 24))
  uploadPhotos(
    @CurrentUser() user: User,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionImages.uploadPhotos(user, files, organizationId);
  }

  @Post('listings/analyze-images')
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  analyzeImages(
    @CurrentUser() user: User,
    @Body() dto: AnalyzeFashionImagesDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionImages.analyze(user, dto, organizationId);
  }

  @Post('listings/generate-content')
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  generateContent(@Body() dto: GenerateFashionListingDto) {
    return this.fashionImages.generateListing(dto);
  }

  @Post('listings')
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  createListing(
    @CurrentUser() user: User,
    @Body() dto: CreateFashionDraftDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionListings.create(user, dto, organizationId);
  }

  @Patch('listings/:id')
  @RequirePermissions('fashion.access', 'fashion.listings.update')
  updateListing(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFashionDraftDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionListings.update(user, id, dto, organizationId);
  }

  @Post('listings/:id/review')
  @RequirePermissions(
    'fashion.access',
    'fashion.review',
    'fashion.authenticity.review',
  )
  reviewListing(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FashionReviewDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionListings.review(user, id, dto, organizationId);
  }

  @Get('listings/:id/review')
  @RequirePermissions('fashion.access', 'fashion.authenticity.review')
  getReview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionListings.getReview(user, id, organizationId);
  }

  @Get('incidents')
  @RequirePermissions('fashion.access', 'fashion.incidents.manage')
  incidents(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionListings.incidents(user, organizationId);
  }

  @Post('listings/:id/quarantine')
  @RequirePermissions('fashion.access', 'fashion.incidents.manage')
  quarantine(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.fashionListings.quarantine(user, id, organizationId);
  }

  private async authorizedFashionStores(user: User, organizationId: string) {
    const accessible = await this.storeAccess.getAccessibleStoreIds(user);
    const stores =
      await this.verticals.listStoresForOrganization(organizationId);
    return stores.filter(
      (store) =>
        accessible.has(store.id) &&
        store.verticalConfig.enabledVerticals.length === 1 &&
        store.verticalConfig.enabledVerticals[0] === 'fashion',
    );
  }

  private storeSummary(store: Store) {
    return {
      id: store.id,
      storeName: store.storeName,
      channel: store.channel,
      status: store.status,
      marketplaceId: store.ebayMarketplaceId,
      fashionEnabled: true,
      verticalConfig: this.verticals.getStoreConfig(store),
    };
  }
}
