import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FeatureFlagService } from './feature-flag.service.js';

@ApiTags('feature-flags')
@Controller('api/feature-flags')
export class FeatureFlagController {
  constructor(private readonly flagService: FeatureFlagService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags' })
  async list() {
    return this.flagService.getAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a single feature flag by key' })
  async get(@Param('key') key: string) {
    return this.flagService.getByKey(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a feature flag' })
  async update(
    @Param('key') key: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.flagService.setEnabled(key, body.enabled);
  }

  @Patch(':key/toggle')
  @ApiOperation({ summary: 'Toggle a feature flag' })
  async toggle(@Param('key') key: string) {
    return this.flagService.toggle(key);
  }
}
