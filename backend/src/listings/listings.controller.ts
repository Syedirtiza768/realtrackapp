import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
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
