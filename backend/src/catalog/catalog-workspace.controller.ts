import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { BusinessIndustrialService } from '../verticals/business-industrial.service.js';
import { CatalogWorkspaceService } from './catalog-workspace.service.js';
import {
  CatalogBulkIdsDto,
  CatalogBulkPoliciesDto,
  CatalogBulkTeamDto,
  CatalogExportDto,
  CatalogProductPatchDto,
  CatalogQueryDto,
  CatalogSuggestQueryDto,
} from './catalog-workspace.dto.js';

@Controller('fashion/catalog')
export class FashionCatalogWorkspaceController {
  constructor(private readonly catalog: CatalogWorkspaceService) {}

  @Get('search')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  search(@CurrentUser() user: User, @Query() dto: CatalogQueryDto) {
    return this.catalog.search(user, 'fashion', dto);
  }

  @Get('search/suggest')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  suggest(@CurrentUser() user: User, @Query() dto: CatalogSuggestQueryDto) {
    return this.catalog.suggest(
      user,
      'fashion',
      dto.q,
      dto.limit ?? 10,
      dto.organizationId,
    );
  }

  @Get('search/facets')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  facets(@CurrentUser() user: User, @Query() dto: CatalogQueryDto) {
    return this.catalog.facets(user, 'fashion', dto);
  }

  @Get('summary')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  summary(@CurrentUser() user: User, @Query() dto: CatalogQueryDto) {
    return this.catalog.summary(user, 'fashion', dto.organizationId);
  }

  @Get('products/:id')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  detail(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: CatalogQueryDto,
  ) {
    return this.catalog.detail(user, 'fashion', id, dto.organizationId);
  }

  @Patch('products/:id')
  @RequirePermissions('fashion.access', 'fashion.listings.update')
  patch(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CatalogProductPatchDto,
    @Query() query: CatalogQueryDto,
  ) {
    return this.catalog.patch(user, 'fashion', id, dto, query.organizationId);
  }

  @Post('bulk/team')
  @RequirePermissions('fashion.access', 'fashion.catalog.assign_team')
  team(@CurrentUser() user: User, @Body() dto: CatalogBulkTeamDto) {
    return this.catalog.bulkTeam(user, 'fashion', dto);
  }

  @Post('bulk/policies')
  @RequirePermissions('fashion.access', 'fashion.catalog.manage_policies')
  policies(@CurrentUser() user: User, @Body() dto: CatalogBulkPoliciesDto) {
    return this.catalog.bulkPolicies(user, 'fashion', dto);
  }

  @Post('bulk/delete')
  @RequirePermissions('fashion.access', 'fashion.catalog.delete')
  delete(@CurrentUser() user: User, @Body() dto: CatalogBulkIdsDto) {
    return this.catalog.bulkDelete(user, 'fashion', dto);
  }

  @Post('export')
  @RequirePermissions('fashion.access', 'fashion.catalog.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @CurrentUser() user: User,
    @Body() dto: CatalogExportDto,
    @Res() response: Response,
  ) {
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="fashion-catalog-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    response.send(await this.catalog.exportCsv(user, 'fashion', dto));
  }
}

@Controller('business-industrial/catalog')
export class BusinessIndustrialCatalogWorkspaceController {
  constructor(
    private readonly catalog: CatalogWorkspaceService,
    private readonly businessIndustrial: BusinessIndustrialService,
  ) {}

  @Get('search')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  search(@CurrentUser() user: User, @Query() dto: CatalogQueryDto) {
    return this.catalog.search(user, 'business_industrial', dto);
  }

  @Get('search/suggest')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  suggest(@CurrentUser() user: User, @Query() dto: CatalogSuggestQueryDto) {
    return this.catalog.suggest(
      user,
      'business_industrial',
      dto.q,
      dto.limit ?? 10,
      dto.organizationId,
    );
  }

  @Get('search/facets')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  facets(@CurrentUser() user: User, @Query() dto: CatalogQueryDto) {
    return this.catalog.facets(user, 'business_industrial', dto);
  }

  @Get('summary')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  summary(@CurrentUser() user: User, @Query() dto: CatalogQueryDto) {
    return this.catalog.summary(
      user,
      'business_industrial',
      dto.organizationId,
    );
  }

  @Get('products/:id')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  detail(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: CatalogQueryDto,
  ) {
    return this.catalog.detail(
      user,
      'business_industrial',
      id,
      dto.organizationId,
    );
  }

  @Patch('products/:id')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.update',
  )
  patch(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CatalogProductPatchDto,
    @Query() query: CatalogQueryDto,
  ) {
    return this.catalog.patch(
      user,
      'business_industrial',
      id,
      dto,
      query.organizationId,
    );
  }

  @Post('bulk/team')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.catalog.assign_team',
  )
  team(@CurrentUser() user: User, @Body() dto: CatalogBulkTeamDto) {
    return this.catalog.bulkTeam(user, 'business_industrial', dto);
  }

  @Post('bulk/policies')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.catalog.manage_policies',
  )
  policies(@CurrentUser() user: User, @Body() dto: CatalogBulkPoliciesDto) {
    return this.catalog.bulkPolicies(user, 'business_industrial', dto);
  }

  @Post('bulk/delete')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.catalog.delete',
  )
  delete(@CurrentUser() user: User, @Body() dto: CatalogBulkIdsDto) {
    return this.catalog.bulkDelete(user, 'business_industrial', dto);
  }

  @Post('export')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.catalog.export',
  )
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @CurrentUser() user: User,
    @Body() dto: CatalogExportDto,
    @Res() response: Response,
  ) {
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="business-industrial-catalog-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    response.send(
      await this.catalog.exportCsv(user, 'business_industrial', dto),
    );
  }

  @Get('categories')
  @RequirePermissions(
    'business_industrial.access',
    'business_industrial.listings.view',
  )
  categories() {
    return this.businessIndustrial.categoryFamilies();
  }
}
