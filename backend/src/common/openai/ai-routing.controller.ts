import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';
import { AiRunLogService } from './ai-run-log.service.js';
import { AiOptimizerService } from './ai-optimizer.service.js';
import { ModelRouter } from './model-router.js';
import { OpenAiService } from './openai.service.js';

@ApiTags('ai-routing')
@Controller('ai/routing')
export class AiRoutingController {
  constructor(
    private readonly runLogService: AiRunLogService,
    private readonly optimizer: AiOptimizerService,
    private readonly modelRouter: ModelRouter,
    private readonly openai: OpenAiService,
  ) {}

  @Get('stats')
  @RequirePermissions('ai.routing.view')
  @ApiOperation({ summary: 'Segment × model performance from ai_run_logs' })
  async getStats() {
    const segments = await this.runLogService.getSegmentStats(30);
    return {
      generatedAt: new Date().toISOString(),
      policyVersion: this.modelRouter.getPolicy()?.version ?? null,
      segments,
      costByLane: this.openai.getSessionCostByLane(),
      sessionCostUsd: this.openai.getSessionCost(),
    };
  }

  @Get('recommendations')
  @RequirePermissions('ai.routing.view')
  @ApiOperation({
    summary: 'Advisor-mode routing recommendations (no policy write)',
  })
  getRecommendations() {
    return this.optimizer.generateRecommendations();
  }

  @Get('policy')
  @RequirePermissions('ai.routing.view')
  @ApiOperation({ summary: 'Active routing policy JSON' })
  getPolicy() {
    return (
      this.modelRouter.getPolicy() ?? {
        version: null,
        source: 'env-fallback',
        thresholds: this.modelRouter.getThresholds(),
        blocklist: this.modelRouter.getBlocklist(),
      }
    );
  }

  @Post('optimize')
  @RequirePermissions('ai.routing.manage')
  @ApiOperation({
    summary: 'Run optimizer and write new routing policy version',
  })
  optimize() {
    return this.optimizer.optimize();
  }
}
