import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { BulkProfilesDto } from './dto/bulk-profiles.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly searchService: SearchService,
  ) {}

  /* ── Advanced search (FTS + fuzzy + filters + scoring) ── */

  @Get('search')
  @RequirePermissions('listings.view')
  search(@Query() query: SearchQueryDto, @CurrentUser() user: User) {
    return this.searchService.search(query, user);
  }

  @Get('search/suggest')
  @RequirePermissions('listings.view')
  suggest(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: User,
  ) {
    return this.searchService.suggest(q ?? '', Number(limit) || 10, user);
  }

  @Get('search/facets')
  @RequirePermissions('listings.view')
  dynamicFacets(@Query() query: SearchQueryDto, @CurrentUser() user: User) {
    return this.searchService.dynamicFacets(query, user);
  }

  /* ── CRUD endpoints (Module 1) ── */

  @Post()
  @RequirePermissions('listings.create')
  create(@Body() dto: CreateListingDto) {
    return this.listingsService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('listings.update')
  update(@Param('id') id: string, @Body() dto: UpdateListingDto, @CurrentUser() user: User) {
    return this.listingsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('listings.update')
  patchStatus(@Param('id') id: string, @Body() dto: PatchStatusDto, @CurrentUser() user: User) {
    return this.listingsService.patchStatus(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('listings.delete')
  softDelete(@Param('id') id: string) {
    return this.listingsService.softDelete(id);
  }

  @Post(':id/restore')
  @RequirePermissions('listings.update')
  restore(@Param('id') id: string) {
    return this.listingsService.restore(id);
  }

  @Post('bulk')
  @RequirePermissions('listings.update')
  bulkUpdate(@Body() dto: BulkUpdateDto) {
    return this.listingsService.bulkUpdate(dto);
  }

  @Post('bulk-profiles')
  @RequirePermissions('listings.update')
  bulkApplyProfiles(@Body() dto: BulkProfilesDto, @CurrentUser() user: User) {
    return this.listingsService.bulkApplyProfiles(dto, user);
  }

  @Post('bulk-delete')
  @RequirePermissions('listings.delete')
  bulkDelete(@Body() body: { ids: string[] }) {
    return this.listingsService.bulkSoftDelete(body.ids);
  }

  @Get('export')
  @RequirePermissions('listings.export')
  async exportCsv(@Query() query: SearchQueryDto, @Res() res: Response, @CurrentUser() user: User) {
    const csv = await this.listingsService.exportCsv(query, user);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="listings-export-${dateStr}.csv"`,
    });
    res.send(csv);
  }

  @Get(':id/revisions')
  @RequirePermissions('listings.view')
  getRevisions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.listingsService.getRevisions(
      id,
      Number(limit) || 20,
      Number(offset) || 0,
    );
  }

  /* ── Legacy endpoints (kept for backward compatibility) ─ */

  @Get()
  @RequirePermissions('listings.view')
  findAll(@Query() query: ListingsQueryDto, @CurrentUser() user: User) {
    return this.listingsService.findAll(query, user);
  }

  @Get('summary')
  @RequirePermissions('listings.view')
  getSummary(@CurrentUser() user: User) {
    return this.listingsService.getSummary(user);
  }

  @Get('facets')
  @RequirePermissions('listings.view')
  getFacets(@CurrentUser() user: User) {
    return this.listingsService.getFacets(user);
  }

  @Get(':id')
  @RequirePermissions('listings.view')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.listingsService.findOne(id, user);
  }

  @Post('import')
  @RequirePermissions('listings.import')
  importListings() {
    const folder =
      process.env.LISTINGS_FOLDER_PATH ??
      '../files/_same_structure_as_B20_eBay_Verified_2-Oct';

    return this.listingsService.importFromFolder(folder);
  }
}
