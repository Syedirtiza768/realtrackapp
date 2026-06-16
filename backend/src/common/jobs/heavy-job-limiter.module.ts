import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogImport } from '../../catalog-import/entities/catalog-import.entity.js';
import { PipelineJob } from '../../ingestion/entities/pipeline-job.entity.js';
import { HeavyJobLimiterService } from './heavy-job-limiter.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PipelineJob, CatalogImport])],
  providers: [HeavyJobLimiterService],
  exports: [HeavyJobLimiterService],
})
export class HeavyJobLimiterModule {}
