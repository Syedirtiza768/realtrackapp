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
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';

@ApiTags('Ingestion')
@Controller('ingestion')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly rbac: RbacService,
  ) {}

  @Post('jobs')
  @RequirePermissions('ingestion.create')
  @ApiOperation({ summary: 'Create a new AI ingestion job' })
  async createJob(@Body() dto: CreateJobDto, @CurrentUser() user: User) {
    const job = await this.ingestionService.createJob(dto, user.id);
    return { job };
  }

  @Get('jobs')
  @RequirePermissions('ingestion.view')
  @ApiOperation({ summary: 'List ingestion jobs with optional status filter' })
  async listJobs(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    return this.ingestionService.listJobs(
      status,
      limit ?? 20,
      offset ?? 0,
      user.id,
      viewAll,
    );
  }

  @Get('jobs/:id')
  @RequirePermissions('ingestion.view')
  @ApiOperation({ summary: 'Get ingestion job details with AI result and images' })
  async getJob(@Param('id') id: string, @CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    return this.ingestionService.getJob(id, user.id, viewAll);
  }

  @Post('jobs/:id/retry')
  @RequirePermissions('ingestion.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed ingestion job' })
  async retryJob(@Param('id') id: string, @CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    const job = await this.ingestionService.retryJob(id, user.id, viewAll);
    return { job };
  }

  @Post('jobs/:id/cancel')
  @RequirePermissions('ingestion.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending/processing job' })
  async cancelJob(@Param('id') id: string, @CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    const job = await this.ingestionService.cancelJob(id, user.id, viewAll);
    return { job };
  }

  @Get('stats')
  @RequirePermissions('ingestion.view')
  @ApiOperation({ summary: 'Get ingestion pipeline aggregate stats' })
  async getStats() {
    const stats = await this.ingestionService.getStats();
    return { stats };
  }
}
