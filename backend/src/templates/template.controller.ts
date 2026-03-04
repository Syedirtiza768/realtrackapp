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
import { TemplateService } from './template.service.js';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateQueryDto,
  RenderPreviewDto,
} from './dto/template.dto.js';

@ApiTags('Templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List all listing templates' })
  findAll(@Query() query: TemplateQueryDto) {
    return this.templateService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single template' })
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a listing template' })
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a listing template' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a listing template' })
  remove(@Param('id') id: string) {
    return this.templateService.remove(id);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Render a template preview with variables' })
  renderPreview(@Param('id') id: string, @Body() dto: RenderPreviewDto) {
    return this.templateService.renderPreview(id, dto);
  }
}
