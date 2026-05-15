import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PipelineService } from './pipeline.service.js';
import type { ListingQualityProfile } from './enterprise-listing-intelligence.service.js';
import type { CombinedOptimizationResult } from './pipeline.service.js';
import type { EnterpriseOptimizationResult } from './pipeline.service.js';

const PROJECT_ROOT = process.env.PIPELINE_PROJECT_ROOT || path.resolve(process.cwd(), '..');
const UPLOAD_DIR = path.resolve(PROJECT_ROOT, 'uploads', 'pipeline');

/**
 * PipelineController — REST endpoints for the enrichment pipeline.
 *
 * This is ADDITIVE — registered alongside the existing IngestionController.
 * All routes are under /api/pipeline (separate from /api/ingestion).
 */
@ApiTags('Pipeline')
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('jobs/:id/enterprise-optimize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generate enterprise-grade AI listing optimization, compliance scoring, and upload payloads',
  })
  async generateEnterpriseOptimization(
    @Param('id') id: string,
    @Body()
    body?: {
      marketplace?: 'US' | 'DE' | 'AU';
      limit?: number;
      aiBudgetListings?: number;
      listingQualityProfile?: ListingQualityProfile;
    },
  ): Promise<EnterpriseOptimizationResult> {
    return this.pipelineService.generateEnterpriseOptimization(id, body);
  }

  @Get('jobs/:id/optimization')
  @ApiOperation({ summary: 'Get mandatory listing optimization status for a pipeline job' })
  async getOptimizationStatus(@Param('id') id: string) {
    return this.pipelineService.getOptimizationStatus(id);
  }

  @Get('jobs/:id/products/:productId/optimization')
  @ApiOperation({ summary: 'Get optimization details for a single catalog product' })
  async getProductOptimization(
    @Param('id') _jobId: string,
    @Param('productId') productId: string,
  ) {
    return this.pipelineService.getProductOptimization(productId);
  }

  @Post('jobs/:id/products/:productId/rerun-optimization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/debug: force re-run optimization for one product' })
  async rerunProductOptimization(
    @Param('productId') productId: string,
    @Body() body?: { marketplace?: 'US' | 'DE' | 'AU' },
  ) {
    const product = await this.pipelineService.rerunProductOptimization(
      productId,
      body?.marketplace ?? 'US',
    );
    return { product };
  }

  @Post('jobs/:id/products/:productId/manual-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send product to manual review queue' })
  async markManualReview(
    @Param('productId') productId: string,
    @Body() body?: { enabled?: boolean },
  ) {
    const product = await this.pipelineService.markProductManualReview(
      productId,
      body?.enabled !== false,
    );
    return { product };
  }

  @Post('jobs/:id/optimize-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-run mandatory listing optimization for entire job (admin/debug)',
  })
  async runCombinedOptimization(
    @Param('id') id: string,
    @Body()
    body?: {
      marketplace?: 'US' | 'DE' | 'AU';
      limit?: number;
      aiBudgetListings?: number;
      listingQualityProfile?: ListingQualityProfile;
    },
  ): Promise<CombinedOptimizationResult> {
    return this.pipelineService.runCombinedOptimization(id, body);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an Excel/CSV file and start enrichment pipeline' })
  async uploadAndStart(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Ensure upload directory exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    // Save file with unique name
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${timestamp}_${safeName}`;
    const storedPath = path.join(UPLOAD_DIR, storedName);
    fs.writeFileSync(storedPath, file.buffer);

    const job = await this.pipelineService.createJob({
      originalFilename: file.originalname,
      storedFilePath: storedPath,
      fileSizeBytes: file.size,
    });

    return { job };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List pipeline jobs' })
  async listJobs(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.pipelineService.listJobs(status, limit ?? 20, offset ?? 0);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get pipeline job details' })
  async getJob(@Param('id') id: string) {
    const job = await this.pipelineService.getJob(id);
    return { job };
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed pipeline job' })
  async retryJob(@Param('id') id: string) {
    const job = await this.pipelineService.retryJob(id);
    return { job };
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending/processing pipeline job' })
  async cancelJob(@Param('id') id: string) {
    const job = await this.pipelineService.cancelJob(id);
    return { job };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get pipeline aggregate stats' })
  async getStats() {
    return this.pipelineService.getStats();
  }

  @Get('jobs/:id/download/:template')
  @ApiOperation({ summary: 'Download pipeline output file (us, au, de, report)' })
  async downloadOutput(
    @Param('id') id: string,
    @Param('template') template: string,
    @Res() res: Response,
  ) {
    const job = await this.pipelineService.getJob(id);

    let filePath: string | null = null;
    let filename: string;

    switch (template) {
      case 'us':
        filePath = job.outputUsPath;
        filename = `US-Motors-Listings-${job.id.slice(0, 8)}.xlsx`;
        break;
      case 'au':
        filePath = job.outputAuPath;
        filename = `AU-Category-Listings-${job.id.slice(0, 8)}.xlsx`;
        break;
      case 'de':
        filePath = job.outputDePath;
        filename = `DE-Category-Listings-${job.id.slice(0, 8)}.xlsx`;
        break;
      case 'report':
        filePath = job.reportPath;
        filename = `Enrichment-Report-${job.id.slice(0, 8)}.json`;
        break;
      case 'input':
        filePath = job.storedFilePath;
        filename = job.originalFilename;
        break;
      default:
        throw new Error(`Unknown template: ${template}. Use: us, au, de, report, input`);
    }

    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ message: `Output file not yet available for template: ${template}` });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    let mimeType: string;
    if (ext === '.json') {
      mimeType = 'application/json';
    } else if (ext === '.csv') {
      mimeType = 'text/csv';
    } else if (ext === '.xls') {
      mimeType = 'application/vnd.ms-excel';
    } else {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  }
}
