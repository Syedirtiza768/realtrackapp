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
} from '@nestjs/common';
import { BulkUpdateDto } from './dto/bulk-update.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { PatchStatusDto } from './dto/patch-status.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';

@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly searchService: SearchService,
  ) {}

  /* ── Advanced search (FTS + fuzzy + filters + scoring) ── */

  @Get('search')
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('search/suggest')
  suggest(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.suggest(q ?? '', Number(limit) || 10);
  }

  @Get('search/facets')
  dynamicFacets(@Query() query: SearchQueryDto) {
    return this.searchService.dynamicFacets(query);
  }

  /* ── CRUD endpoints (Module 1) ── */

  @Post()
  create(@Body() dto: CreateListingDto) {
    return this.listingsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(id, dto);
  }

  @Patch(':id/status')
  patchStatus(@Param('id') id: string, @Body() dto: PatchStatusDto) {
    return this.listingsService.patchStatus(id, dto);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.listingsService.softDelete(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.listingsService.restore(id);
  }

  @Post('bulk')
  bulkUpdate(@Body() dto: BulkUpdateDto) {
    return this.listingsService.bulkUpdate(dto);
  }

  @Get(':id/revisions')
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
  findAll(@Query() query: ListingsQueryDto) {
    return this.listingsService.findAll(query);
  }

  @Get('summary')
  getSummary() {
    return this.listingsService.getSummary();
  }

  @Get('facets')
  getFacets() {
    return this.listingsService.getFacets();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(id);
  }

  @Post('import')
  importListings() {
    const folder =
      process.env.LISTINGS_FOLDER_PATH ??
      '../files/_same_structure_as_B20_eBay_Verified_2-Oct';

    return this.listingsService.importFromFolder(folder);
  }
}
