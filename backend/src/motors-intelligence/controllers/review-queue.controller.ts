import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewQueueService } from '../services/review-queue.service';
import { ReviewTaskQueryDto, ResolveReviewTaskDto } from '../dto';

@ApiTags('Motors Review Queue')
@Controller('motors-intelligence/review')
export class ReviewQueueController {
  constructor(
    private readonly reviewService: ReviewQueueService,
  ) {}

  @Get('tasks')
  @ApiOperation({ summary: 'List review tasks with filters' })
  async listTasks(@Query() query: ReviewTaskQueryDto) {
    return this.reviewService.listTasks(query);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get a single review task' })
  async getTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewService.getTask(id);
  }

  @Patch('tasks/:id/assign')
  @ApiOperation({ summary: 'Assign a review task to a user' })
  async assignTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assignedTo') assignedTo: string,
  ) {
    return this.reviewService.assignTask(id, assignedTo);
  }

  @Post('tasks/:id/resolve')
  @ApiOperation({ summary: 'Resolve a review task (approve/reject/defer)' })
  async resolveTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReviewTaskDto,
  ) {
    // TODO: Extract userId from JWT when auth guard is applied
    return this.reviewService.resolveTask(id, 'system', dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get review queue statistics' })
  async getStats() {
    return this.reviewService.getStats();
  }
}
