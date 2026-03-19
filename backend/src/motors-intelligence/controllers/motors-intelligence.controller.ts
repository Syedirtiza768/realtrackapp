import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  Sse,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, Subject, interval, map, takeWhile, finalize, startWith, switchMap, from, of, concat, timer } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MotorsIntelligenceService } from '../services/motors-intelligence.service';
import { EbayEnrichmentService } from '../services/ebay-enrichment.service';
import { StorageService } from '../../storage/storage.service';
import {
  CreateMotorsProductDto,
  BatchCreateMotorsProductDto,
  MotorsProductQueryDto,
  UpdateMotorsProductDto,
  ImageUploadRequestDto,
  ImageUploadResponseDto,
  ConfirmUploadDto,
  ConfirmUploadResponseDto,
  PipelineProgressDto,
  PipelineStageDto,
} from '../dto';
import { MotorsProductStatus, MotorsSourceType } from '../entities';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@ApiTags('Motors Intelligence')
@Controller('motors-intelligence')
export class MotorsIntelligenceController {
  constructor(
    private readonly motorsService: MotorsIntelligenceService,
    private readonly ebayEnrichmentService: EbayEnrichmentService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('motors-pipeline') private readonly pipelineQueue: Queue,
  ) {}

  /* ─── Image Upload Flow ──────────────────────────────────── */

  @Post('products/upload-images')
  @ApiOperation({ summary: 'Start image-based product creation with presigned S3 URLs' })
  async uploadImages(@Body() dto: ImageUploadRequestDto): Promise<ImageUploadResponseDto> {
    // Create the product first so we have an ID for S3 paths
    const product = await this.motorsService.createProduct({
      sourceType: MotorsSourceType.IMAGE_UPLOAD,
      brand: dto.brand || null,
      mpn: dto.mpn || null,
      productType: dto.productType || null,
      condition: dto.condition || 'New',
      price: dto.price || null,
      quantity: dto.quantity || null,
      sourcePayload: { files: dto.files, autoRunPipeline: dto.autoRunPipeline ?? true },
    });

    // Generate presigned upload URLs
    const uploadUrls = await Promise.all(
      dto.files.map(async (file) => {
        const result = await this.storageService.generateUploadUrl(
          `motors-${product.id}-${file.fileName}`,
          file.mimeType,
        );
        return { fileName: file.fileName, uploadUrl: result.uploadUrl, key: result.s3Key };
      }),
    );

    return {
      motorsProductId: product.id,
      uploadUrls,
      status: 'awaiting_upload',
    };
  }

  @Post('products/:id/confirm-upload')
  @ApiOperation({ summary: 'Confirm images uploaded to S3, optionally start pipeline' })
  async confirmUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmUploadDto,
  ): Promise<ConfirmUploadResponseDto> {
    // Build CDN URLs from the uploaded keys
    const imageUrls = dto.uploadedKeys.map(key => this.storageService.getCdnUrl(key));

    // Update product with resolved image URLs
    await this.motorsService.updateProduct(id, {
      imageUrls,
    } as any);

    let pipelineStarted = false;
    if (dto.autoRunPipeline !== false) {
      // Queue the full pipeline job
      await this.pipelineQueue.add('process', {
        motorsProductId: id,
        stage: 'full',
      }, {
        priority: 1,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      });
      pipelineStarted = true;
    }

    return {
      motorsProductId: id,
      imageUrls,
      pipelineStarted,
      status: pipelineStarted ? 'pipeline_queued' : 'images_confirmed',
    };
  }

  /* ─── SSE Pipeline Progress ──────────────────────────────── */

  @Get('products/:id/progress')
  @ApiOperation({ summary: 'Stream pipeline progress via Server-Sent Events' })
  async streamProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const TERMINAL_STATUSES = new Set([
      MotorsProductStatus.APPROVED,
      MotorsProductStatus.PUBLISHED,
      MotorsProductStatus.FAILED,
      MotorsProductStatus.REJECTED,
      MotorsProductStatus.REVIEW_REQUIRED,
    ]);

    const STAGE_MAP: Record<string, { stage: string; label: string; order: number }> = {
      [MotorsProductStatus.PENDING]: { stage: 'upload', label: 'Upload Complete', order: 0 },
      [MotorsProductStatus.EXTRACTING]: { stage: 'extraction', label: 'AI Vision Analysis', order: 1 },
      [MotorsProductStatus.IDENTIFYING]: { stage: 'identity', label: 'Product Identification', order: 2 },
      [MotorsProductStatus.RESOLVING_FITMENT]: { stage: 'fitment', label: 'Fitment Resolution', order: 3 },
      [MotorsProductStatus.GENERATING_LISTING]: { stage: 'listing', label: 'Listing Generation', order: 4 },
      [MotorsProductStatus.VALIDATING]: { stage: 'compliance', label: 'Compliance Check', order: 5 },
      [MotorsProductStatus.APPROVED]: { stage: 'complete', label: 'Ready to Publish', order: 6 },
      [MotorsProductStatus.REVIEW_REQUIRED]: { stage: 'review', label: 'Review Required', order: 6 },
      [MotorsProductStatus.PUBLISHED]: { stage: 'published', label: 'Published', order: 7 },
      [MotorsProductStatus.FAILED]: { stage: 'failed', label: 'Failed', order: -1 },
    };

    const ALL_STAGES = ['upload', 'extraction', 'identity', 'fitment', 'listing', 'compliance', 'complete'];

    const buildProgress = (product: any): PipelineProgressDto => {
      const statusInfo = STAGE_MAP[product.status] || { stage: 'unknown', label: product.status, order: -1 };
      const currentOrder = statusInfo.order;

      const stages: PipelineStageDto[] = ALL_STAGES.map((stage, idx) => {
        let status: PipelineStageDto['status'] = 'pending';
        if (idx < currentOrder) status = 'completed';
        else if (idx === currentOrder && !TERMINAL_STATUSES.has(product.status)) status = 'running';
        else if (idx === currentOrder && product.status === MotorsProductStatus.APPROVED) status = 'completed';
        else if (product.status === MotorsProductStatus.FAILED && idx === currentOrder) status = 'failed';

        const stageLabels: Record<string, string> = {
          upload: 'Upload Complete',
          extraction: 'AI Vision Analysis',
          identity: 'Product Identification',
          fitment: 'Fitment Resolution',
          listing: 'Listing Generation',
          compliance: 'Compliance Check',
          complete: 'Ready to Publish',
        };

        return {
          stage,
          label: stageLabels[stage] || stage,
          status,
        };
      });

      return {
        motorsProductId: product.id,
        overallStatus: product.status,
        currentStage: statusInfo.stage,
        stages,
        confidence: {
          identity: product.identityConfidence ? Number(product.identityConfidence) : null,
          fitment: product.fitmentConfidence ? Number(product.fitmentConfidence) : null,
          compliance: product.complianceConfidence ? Number(product.complianceConfidence) : null,
          content: product.contentQualityScore ? Number(product.contentQualityScore) : null,
        },
        completedAt: TERMINAL_STATUSES.has(product.status) ? new Date().toISOString() : undefined,
      };
    };

    // Poll product status and push updates
    let lastStatus = '';
    let consecutiveErrors = 0;
    const maxErrors = 5;
    const pollInterval = setInterval(async () => {
      try {
        const product = await this.motorsService.getProduct(id);
        consecutiveErrors = 0;

        if (product.status !== lastStatus) {
          lastStatus = product.status;
          const progress = buildProgress(product);
          res.write(`data: ${JSON.stringify(progress)}\n\n`);
        }

        if (TERMINAL_STATUSES.has(product.status as MotorsProductStatus)) {
          // Send one final update then close
          clearInterval(pollInterval);
          res.write(`data: ${JSON.stringify({ ...buildProgress(product), done: true })}\n\n`);
          res.end();
        }
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= maxErrors) {
          clearInterval(pollInterval);
          res.write(`data: ${JSON.stringify({ error: 'Product not found or polling failed' })}\n\n`);
          res.end();
        }
      }
    }, 1000);

    // Clean up on client disconnect
    res.on('close', () => {
      clearInterval(pollInterval);
    });
  }

  /* ─── eBay Enrichment ────────────────────────────────────── */

  @Post('products/:id/enrich')
  @ApiOperation({ summary: 'Run eBay enrichment (category + aspects) for a product' })
  async enrichProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.ebayEnrichmentService.enrichProduct(id);
  }

  /* ─── Products CRUD ──────────────────────────────────────── */

  @Post('products')
  @ApiOperation({ summary: 'Create a new Motors product and start pipeline' })
  async createProduct(@Body() dto: CreateMotorsProductDto) {
    return this.motorsService.createProduct(dto);
  }

  @Post('products/batch')
  @ApiOperation({ summary: 'Batch create Motors products' })
  async batchCreate(@Body() dto: BatchCreateMotorsProductDto) {
    return this.motorsService.batchCreateProducts(dto.products);
  }

  @Get('products')
  @ApiOperation({ summary: 'List Motors products with filters' })
  async listProducts(@Query() query: MotorsProductQueryDto) {
    return this.motorsService.listProducts(query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a single Motors product by ID' })
  async getProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.motorsService.getProduct(id);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update a Motors product' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMotorsProductDto,
  ) {
    return this.motorsService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a Motors product' })
  async deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.motorsService.deleteProduct(id);
  }

  /* ─── Pipeline ───────────────────────────────────────────── */

  @Post('products/:id/run-pipeline')
  @ApiOperation({ summary: 'Re-run the full pipeline for a product' })
  async runPipeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.motorsService.runPipeline(id);
  }

  @Post('products/:id/publish')
  @ApiOperation({ summary: 'Publish a Motors product to eBay' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('connectionId') connectionId: string,
  ) {
    return this.motorsService.publish(id, connectionId);
  }

  /* ─── Analytics ──────────────────────────────────────────── */

  @Get('stats')
  @ApiOperation({ summary: 'Get Motors Intelligence pipeline statistics' })
  async getStats() {
    return this.motorsService.getStats();
  }
}
