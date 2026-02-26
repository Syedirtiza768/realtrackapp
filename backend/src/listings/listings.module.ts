import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingRecord } from './listing-record.entity';
import { ListingRevision } from './listing-revision.entity';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([ListingRecord, ListingRevision])],
  controllers: [ListingsController],
  providers: [ListingsService, SearchService],
  exports: [ListingsService, SearchService],
})
export class ListingsModule {}
