import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  ApplyBusinessIndustrialImageIntakeGroupDto,
  CreateBusinessIndustrialImageIntakeJobDto,
  CreateBusinessIndustrialDriveIntakeJobDto,
} from './business-industrial-image-intake.dto.js';
import { BusinessIndustrialImageIntakeService } from './business-industrial-image-intake.service.js';

@ApiTags('business-industrial-image-intake')
@ApiBearerAuth()
@Controller('business-industrial/image-intake')
@RequirePermissions('business_industrial.access')
export class BusinessIndustrialImageIntakeController {
  constructor(private readonly intake: BusinessIndustrialImageIntakeService) {}

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('business_industrial.import')
  @ApiOperation({
    summary: 'Create an organization-scoped B&I image intake run',
  })
  createJob(
    @CurrentUser() user: User,
    @Body() dto: CreateBusinessIndustrialImageIntakeJobDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.createJob(user, dto, organizationId);
  }

  @Post('jobs/from-drive')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('business_industrial.import')
  @ApiOperation({
    summary:
      'Create a server-side B&I intake run from a public Google Drive folder',
  })
  createFromDrive(
    @CurrentUser() user: User,
    @Body() dto: CreateBusinessIndustrialDriveIntakeJobDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.createDriveJob(user, dto, organizationId);
  }

  @Get('jobs')
  @RequirePermissions('business_industrial.import')
  listJobs(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.listJobs(user, organizationId);
  }

  @Get('jobs/:id')
  @RequirePermissions('business_industrial.import')
  getJob(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.getJob(user, id, organizationId);
  }

  @Post('jobs/:id/upload')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('business_industrial.import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 50))
  upload(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('filePaths') filePaths: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.uploadBatch(user, id, files, filePaths, organizationId);
  }

  @Post('jobs/:id/start')
  @RequirePermissions('business_industrial.import')
  start(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.startJob(user, id, organizationId);
  }

  @Get('jobs/:id/groups')
  @RequirePermissions('business_industrial.import')
  groups(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.listGroups(user, id, organizationId);
  }

  @Get('jobs/:id/export.xlsx')
  @RequirePermissions('business_industrial.import')
  async export(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
    @Query('organizationId') organizationId?: string,
  ) {
    const workbook = await this.intake.exportJob(user, id, organizationId);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="omni-core-bi-image-intake-${id}.xlsx"`,
    );
    response.send(workbook);
  }

  @Get('groups/:id')
  @RequirePermissions('business_industrial.import')
  group(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.getGroup(user, id, organizationId);
  }

  @Post('groups/:id/apply')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('business_industrial.listings.create')
  apply(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyBusinessIndustrialImageIntakeGroupDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.applyGroup(user, id, dto, organizationId);
  }
}
