import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  PartsSearchQueryDto,
  PartsSearchSuggestDto,
} from './dto/parts-search-query.dto.js';
import {
  PartsSearchDemandQueryDto,
  PartsSearchOptionsDto,
  PartsSearchRequestDto,
  PartsSearchRequestStatusDto,
  PartsSearchSelectDto,
} from './dto/parts-search-options.dto.js';
import { PartsSearchImagesService } from './parts-search-images.service.js';
import { PartsSearchOptionsService } from './parts-search-options.service.js';
import { PartsSearchService } from './parts-search.service.js';

/** PartsBazar360 ids are UUIDs or seeded slug-like tokens. */
const PART_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Parts Search portal (`/parts-search` in the SPA).
 * Prefix: /api/parts-search — the global `api` prefix supplies `/api`.
 *
 * Gated on `dashboard.view`, the same permission as the Auto Parts workspace,
 * so "can use Auto Parts" and "can use the portal" stay identical (including
 * for customized roles, which the registry sync never updates). See
 * docs/decisions.md (2026-10-26).
 */
@ApiTags('parts-search')
@Controller('parts-search')
@RequirePermissions('dashboard.view')
export class PartsSearchController {
  constructor(
    private readonly partsSearch: PartsSearchService,
    private readonly options: PartsSearchOptionsService,
    private readonly images: PartsSearchImagesService,
  ) {}

  @Get('status')
  status() {
    return this.partsSearch.status();
  }

  @Get('query')
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 120, ttl: 60_000 } })
  query(@Query() dto: PartsSearchQueryDto, @CurrentUser() user?: User) {
    return this.partsSearch.search(dto, user?.id);
  }

  /** Called on every (debounced) keystroke, so it gets a looser limit. */
  @Get('suggest')
  @Throttle({ short: { limit: 20, ttl: 1000 }, medium: { limit: 400, ttl: 60_000 } })
  suggest(@Query() dto: PartsSearchSuggestDto) {
    return this.partsSearch.suggest(dto.q);
  }

  @Get('parts/:id')
  @Throttle({ short: { limit: 10, ttl: 1000 } })
  part(@Param('id') id: string) {
    if (!PART_ID_RE.test(id)) throw new BadRequestException('Invalid part id');
    return this.partsSearch.part(id);
  }

  /**
   * Every sellable option for a query: number expansion with trails, live
   * availability (PartsBazar360 + Omni Core warehouses), fitment verdicts.
   * Needs the internal key; 503 `INTERNAL_SEARCH_UNAVAILABLE` otherwise.
   */
  @Get('options')
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 120, ttl: 60_000 } })
  searchOptions(@Query() dto: PartsSearchOptionsDto, @CurrentUser() user?: User) {
    return this.options.options(dto, user);
  }

  @Post('events/select')
  @Throttle({ short: { limit: 10, ttl: 1000 } })
  select(@Body() dto: PartsSearchSelectDto, @CurrentUser() user?: User) {
    return this.options.select(dto, user);
  }

  /** "Notify me / source this part": goes to the demand log for procurement. */
  @Post('requests')
  @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 60, ttl: 60_000 } })
  createRequest(@Body() dto: PartsSearchRequestDto, @CurrentUser() user?: User) {
    return this.options.request(dto, user);
  }

  @Patch('requests/:id')
  updateRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PartsSearchRequestStatusDto,
    @CurrentUser() user?: User,
  ) {
    return this.options.updateRequest(id, dto.status, user);
  }

  /** Searched-but-unavailable report: top numbers, queries, vehicles; requests. */
  @Get('demand')
  demand(@Query() dto: PartsSearchDemandQueryDto) {
    return this.options.demand(dto.days ?? 7);
  }

  @Get('vehicles/makes')
  makes() {
    return this.options.vehicles('/makes');
  }

  @Get('vehicles/makes/:makeId/models')
  models(@Param('makeId') makeId: string) {
    if (!PART_ID_RE.test(makeId)) throw new BadRequestException('Invalid make id');
    return this.options.vehicles(`/makes/${makeId}/models`);
  }

  @Get('vehicles/models/:modelId/generations')
  generations(@Param('modelId') modelId: string) {
    if (!PART_ID_RE.test(modelId)) throw new BadRequestException('Invalid model id');
    return this.options.vehicles(`/models/${modelId}/generations`);
  }

  @Get('vehicles/generations/:generationId/configurations')
  configurations(@Param('generationId') generationId: string) {
    if (!PART_ID_RE.test(generationId)) throw new BadRequestException('Invalid generation id');
    return this.options.vehicles(`/generations/${generationId}/configurations`);
  }

  @Get('vin/:vin')
  @Throttle({ short: { limit: 2, ttl: 1000 }, medium: { limit: 30, ttl: 60_000 } })
  vin(@Param('vin') vin: string) {
    return this.options.decodeVin(vin);
  }

  /** A part's images as high-quality previews (originals / eBay 1600 px). */
  @Get('parts/:id/images')
  @Throttle({ short: { limit: 10, ttl: 1000 } })
  partImages(@Param('id') id: string) {
    if (!PART_ID_RE.test(id)) throw new BadRequestException('Invalid part id');
    return this.images.listPartImages(id);
  }

  /** All images of a part as one zip (originals, up to 30). */
  @Get('parts/:id/images/zip')
  @Throttle({ short: { limit: 1, ttl: 1000 }, medium: { limit: 20, ttl: 60_000 } })
  async partImagesZip(@Param('id') id: string, @Res() res: Response) {
    if (!PART_ID_RE.test(id)) throw new BadRequestException('Invalid part id');
    await this.images.downloadPartZip(id, res);
  }

  /** Download one image in the best quality available, as an attachment. */
  @Get('parts/:id/images/:index/download')
  @Throttle({ short: { limit: 5, ttl: 1000 }, medium: { limit: 120, ttl: 60_000 } })
  async partImageDownload(
    @Param('id') id: string,
    @Param('index', new ParseIntPipe()) index: number,
    @Res() res: Response,
  ) {
    if (!PART_ID_RE.test(id)) throw new BadRequestException('Invalid part id');
    if (index < 0 || index > 200) throw new BadRequestException('Invalid image index');
    await this.images.downloadPartImage(id, index, res);
  }

  /** Image of an Omni Core warehouse item from the "In our warehouse" group. */
  @Get('omni/:itemId/image/download')
  @Throttle({ short: { limit: 5, ttl: 1000 } })
  async omniImageDownload(
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    await this.images.downloadOmniImage(itemId, user, res);
  }
}
