import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingRecord } from './listing-record.entity';
import { ListingRevision } from './listing-revision.entity';
import { ListingCompliance } from './listing-compliance.entity';
import { ListingsController } from './listings.controller';
import { ListingsV2Controller } from './listings-v2.controller';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([ListingRecord, ListingRevision, ListingCompliance])],
  controllers: [ListingsController, ListingsV2Controller],
  providers: [ListingsService, SearchService],
  exports: [ListingsService, SearchService],
})
export class ListingsModule {}
