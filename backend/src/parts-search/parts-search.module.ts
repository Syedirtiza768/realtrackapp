import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { PartsSearchEvent } from './entities/parts-search-event.entity.js';
import { PartsSearchClient } from './parts-search.client.js';
import { PartsSearchController } from './parts-search.controller.js';
import { PartsSearchImagesService } from './parts-search-images.service.js';
import { PartsSearchOptionsService } from './parts-search-options.service.js';
import { PartsSearchService } from './parts-search.service.js';

/**
 * Parts Search portal: proxy over PartsBazar360 universal search plus the
 * staff "every sellable option" search (internal key), Omni Core warehouse
 * stock merge, and the parts_search_events audit/demand log.
 * Redis (APP_REDIS) and config come from global modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PartsSearchEvent]), AuthModule, StorageModule],
  controllers: [PartsSearchController],
  providers: [PartsSearchClient, PartsSearchService, PartsSearchOptionsService, PartsSearchImagesService],
})
export class PartsSearchModule {}
