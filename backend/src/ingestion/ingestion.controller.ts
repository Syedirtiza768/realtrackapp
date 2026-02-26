import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestionService } from './ingestion.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';

@ApiTags('Ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('jobs')
  @ApiOperation({ summary: 'Create a new AI ingestion job' })
  async createJob(@Body() dto: CreateJobDto) {
    // TODO: extract user ID from JWT when auth guards are wired
    const job = await this.ingestionService.createJob(dto);
    return { job };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List ingestion jobs with optional status filter' })
  async listJobs(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.ingestionService.listJobs(status, limit ?? 20, offset ?? 0);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get ingestion job details with AI result and images' })
  async getJob(@Param('id') id: string) {
    return this.ingestionService.getJob(id);
  }

  @Post('jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed ingestion job' })
  async retryJob(@Param('id') id: string) {
    const job = await this.ingestionService.retryJob(id);
    return { job };
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending/processing job' })
  async cancelJob(@Param('id') id: string) {
    const job = await this.ingestionService.cancelJob(id);
    return { job };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get ingestion pipeline aggregate stats' })
  async getStats() {
    const stats = await this.ingestionService.getStats();
    return { stats };
  }
}
