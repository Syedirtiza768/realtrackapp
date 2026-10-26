import { Module } from '@nestjs/common';
import { PartsSearchClient } from './parts-search.client.js';
import { PartsSearchController } from './parts-search.controller.js';
import { PartsSearchService } from './parts-search.service.js';

/**
 * Parts Search portal: read-only proxy over PartsBazar360 universal search.
 * Redis (APP_REDIS) and config come from global modules.
 */
@Module({
  controllers: [PartsSearchController],
  providers: [PartsSearchClient, PartsSearchService],
})
export class PartsSearchModule {}
