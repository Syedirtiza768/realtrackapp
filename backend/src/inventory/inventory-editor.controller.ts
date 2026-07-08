import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InventoryEditorService } from './inventory-editor.service.js';
import { InventoryPublishService } from './inventory-publish.service.js';
import {
  SaveEditorDto,
  PublishListingDto,
} from './dto/inventory-editor.dto.js';
import type { EditorResponse } from './dto/inventory-editor.dto.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryEditorController {
  constructor(
    private readonly editor: InventoryEditorService,
    private readonly publisher: InventoryPublishService,
  ) {}

  @Get(':id/editor')
  @RequirePermissions('inventory.view')
  @ApiOperation({
    summary:
      'Load all data for the listing editor: listing info, marketplace versions, accessible stores with policies',
  })
  async getEditor(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<EditorResponse> {
    return this.editor.getEditorData(id, user);
  }

  @Put(':id/editor')
  @RequirePermissions('listings.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save marketplace version edits to the catalog product',
  })
  async saveEditor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveEditorDto,
  ): Promise<{ ok: boolean }> {
    return this.editor.saveEditorData(id, dto);
  }

  @Post(':id/publish')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @RequirePermissions('ebay.publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Publish listing to selected eBay stores. Creates catalog product if needed.',
  })
  async publishListing(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() body: PublishListingDto,
  ) {
    return this.publisher.publish(id, user.id, body.targets);
  }
}
