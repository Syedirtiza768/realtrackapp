import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AutomationService } from './automation.service.js';
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  AutomationRuleQueryDto,
} from './dto/automation-rule.dto.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

@ApiTags('Automation Rules')
@Controller('automation-rules')
@RequirePermissions('automation.view')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @ApiOperation({ summary: 'List all automation rules' })
  findAll(@Query() query: AutomationRuleQueryDto) {
    return this.automationService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single automation rule' })
  findOne(@Param('id') id: string) {
    return this.automationService.findOne(id);
  }

  @Post()
  @RequirePermissions('automation.manage')
  @ApiOperation({ summary: 'Create an automation rule' })
  create(@Body() dto: CreateAutomationRuleDto) {
    return this.automationService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('automation.manage')
  @ApiOperation({ summary: 'Update an automation rule' })
  update(@Param('id') id: string, @Body() dto: UpdateAutomationRuleDto) {
    return this.automationService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('automation.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an automation rule' })
  remove(@Param('id') id: string) {
    return this.automationService.remove(id);
  }

  @Patch(':id/toggle')
  @RequirePermissions('automation.manage')
  @ApiOperation({ summary: 'Toggle an automation rule enabled/disabled' })
  toggle(@Param('id') id: string) {
    return this.automationService.toggle(id);
  }

  @Post(':id/execute')
  @RequirePermissions('automation.manage')
  @ApiOperation({ summary: 'Manually execute an automation rule' })
  execute(@Param('id') id: string) {
    return this.automationService.execute(id);
  }
}
