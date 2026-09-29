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
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { User } from '../../auth/entities/user.entity.js';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';
import { ConnectPartsBazar360Dto } from './partsbazar360.dto.js';
import { PartsBazar360Service } from './partsbazar360.service.js';

@ApiTags('channels')
@Controller('channels/partsbazar360')
@RequirePermissions('channels.view')
export class PartsBazar360Controller {
  constructor(private readonly partsbazar: PartsBazar360Service) {}

  @Get('status')
  @ApiOperation({
    summary: 'Whether PartsBazar360 publishing is configured, and its sellers',
  })
  status() {
    return this.partsbazar.getStatus();
  }

  @Post('connect')
  @RequirePermissions('channels.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Link a PartsBazar360 seller as a publish destination (verified live)',
  })
  connect(@Body() dto: ConnectPartsBazar360Dto, @CurrentUser() user: User) {
    return this.partsbazar.connect(user.id, dto);
  }

  @Post('listings/:listingId/refresh')
  @RequirePermissions('channels.publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Re-check a listing's import state on PartsBazar360",
  })
  refresh(@Param('listingId') listingId: string) {
    return this.partsbazar.refresh(listingId);
  }
}
