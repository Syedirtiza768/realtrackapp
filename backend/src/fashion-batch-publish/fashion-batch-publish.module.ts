import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { User } from '../auth/entities/user.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ChannelsModule } from '../channels/channels.module.js';
import { OpenAiModule } from '../common/openai/openai.module.js';
import { EbayIntegrationsModule } from '../integrations/ebay/ebay-integrations.module.js';
import { EbayHostedImage } from '../integrations/ebay/entities/ebay-hosted-image.entity.js';
import { EbayListingJobTarget } from '../integrations/ebay/entities/ebay-listing-job-target.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { VerticalsModule } from '../verticals/verticals.module.js';
import {
  FashionComplianceConfigRow,
  FashionListingPipeline,
  FashionPublishBatch,
  FashionPublishBatchItem,
} from './entities/fashion-publish.entities.js';
import { FashionBatchPublishController } from './fashion-batch-publish.controller.js';
import { FashionBatchPublishProcessor } from './fashion-batch-publish.processor.js';
import {
  FASHION_BATCH_QUEUE,
  FashionBatchPublishService,
} from './fashion-batch-publish.service.js';
import { FashionImagePipelineService } from './fashion-image-pipeline.service.js';
import { FashionVisionCheckService } from './fashion-vision-check.service.js';

@Module({
  imports: [
    AuthModule,
    ChannelsModule,
    EbayIntegrationsModule,
    OpenAiModule,
    RbacModule,
    StorageModule,
    VerticalsModule,
    BullModule.registerQueue({
      name: FASHION_BATCH_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    }),
    TypeOrmModule.forFeature([
      FashionListingPipeline,
      FashionPublishBatch,
      FashionPublishBatchItem,
      FashionComplianceConfigRow,
      CatalogProduct,
      ListingActionLog,
      EbayListingJobTarget,
      EbayHostedImage,
      User,
    ]),
  ],
  controllers: [FashionBatchPublishController],
  providers: [
    FashionBatchPublishService,
    FashionBatchPublishProcessor,
    FashionImagePipelineService,
    FashionVisionCheckService,
  ],
})
export class FashionBatchPublishModule {}
