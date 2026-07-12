import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ImageEnrichmentService } from './image-enrichment.service.js';

import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';

@ApiTags('Pipeline / Image Enrichment')
@Controller('pipeline/images')
@RequirePermissions('pipeline.run')
export class ImageEnrichmentController {
  constructor(
    private readonly imageEnrichmentService: ImageEnrichmentService,
  ) {}

  @Post('enrich')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enrich a batch of parts with images' })
  async enrichBatch(
    @Body()
    body: {
      parts: Array<{
        partNumber: string;
        title: string;
        brand?: string;
        mpn?: string;
        fitment?: string;
        existingImages?: string[];
      }>;
      jobId?: string;
      /** Set true to download & optimize images locally (slower). Default: false */
      downloadImages?: boolean;
    },
  ) {
    const { parts, jobId, downloadImages = false } = body;
    if (!parts?.length) {
      return { results: [], progress: null };
    }

    const { results, progress } = await this.imageEnrichmentService.enrichBatch(
      parts,
      jobId,
      { downloadImages },
    );

    return { results, progress };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Validate a batch of image URLs (accessibility, resolution, compliance)',
  })
  async validateUrls(@Body() body: { urls: string[] }) {
    const urls = body.urls?.slice(0, 200) ?? [];
    if (!urls.length)
      return { results: [], summary: { total: 0, accessible: 0, issues: 0 } };

    const results = await this.imageEnrichmentService.validateImageUrls(urls);
    const accessible = results.filter((r) => r.accessible).length;
    const withIssues = results.filter((r) => r.issues.length > 0).length;

    return {
      results,
      summary: { total: urls.length, accessible, issues: withIssues },
    };
  }

  @Get(':jobId/status')
  @Throttle({ short: { limit: 30, ttl: 1000 } })
  @ApiOperation({ summary: 'Get image enrichment status for a pipeline job' })
  async getStatus(@Param('jobId') jobId: string) {
    const progress =
      await this.imageEnrichmentService.getEnrichmentStatus(jobId);
    return { jobId, progress };
  }
}
