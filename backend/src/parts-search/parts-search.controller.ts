import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  PartsSearchQueryDto,
  PartsSearchSuggestDto,
} from './dto/parts-search-query.dto.js';
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
  constructor(private readonly partsSearch: PartsSearchService) {}

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
}
