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
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly searchService: SearchService,
  ) {}

  /* ── Advanced search (FTS + fuzzy + filters + scoring) ── */

  @Get('search')
  @RequirePermissions('listings.view')
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('search/suggest')
  @RequirePermissions('listings.view')
  suggest(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.suggest(q ?? '', Number(limit) || 10);
  }

  @Get('search/facets')
  @RequirePermissions('listings.view')
  dynamicFacets(@Query() query: SearchQueryDto) {
    return this.searchService.dynamicFacets(query);
  }

  /* ── CRUD endpoints (Module 1) ── */

  @Post()
  @RequirePermissions('listings.create')
  create(@Body() dto: CreateListingDto) {
    return this.listingsService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('listings.update')
  update(@Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('listings.update')
  patchStatus(@Param('id') id: string, @Body() dto: PatchStatusDto) {
    return this.listingsService.patchStatus(id, dto);
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

  @Post('bulk-delete')
  @RequirePermissions('listings.delete')
  bulkDelete(@Body() body: { ids: string[] }) {
    return this.listingsService.bulkSoftDelete(body.ids);
  }

  @Get('export')
  @RequirePermissions('listings.export')
  async exportCsv(@Query() query: SearchQueryDto, @Res() res: Response) {
    const csv = await this.listingsService.exportCsv(query);
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
  findAll(@Query() query: ListingsQueryDto) {
    return this.listingsService.findAll(query);
  }

  @Get('summary')
  @RequirePermissions('listings.view')
  getSummary() {
    return this.listingsService.getSummary();
  }

  @Get('facets')
  @RequirePermissions('listings.view')
  getFacets() {
    return this.listingsService.getFacets();
  }

  @Get(':id')
  @RequirePermissions('listings.view')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
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
