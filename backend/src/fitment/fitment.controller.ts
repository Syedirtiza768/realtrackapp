import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FitmentService } from './fitment.service.js';
import { FitmentMatcherService } from './fitment-matcher.service.js';
import { FitmentImportService, type AcesVehicleRow } from './fitment-import.service.js';
import { CreateFitmentDto, VerifyFitmentDto, FitmentDetectionDto } from './dto/create-fitment.dto.js';
import { SearchFitmentDto } from './dto/search-fitment.dto.js';

@ApiTags('fitment')
@Controller('fitment')
export class FitmentController {
  constructor(
    private readonly fitmentService: FitmentService,
    private readonly matcherService: FitmentMatcherService,
    private readonly importService: FitmentImportService,
  ) {}

  // ─── Reference data ───

  @Get('makes')
  @ApiOperation({ summary: 'List all makes (optional fuzzy search)' })
  @ApiQuery({ name: 'q', required: false })
  getMakes(@Query('q') q?: string) {
    return this.fitmentService.getMakes(q);
  }

  @Get('makes/:makeId/models')
  @ApiOperation({ summary: 'List models for a make' })
  @ApiParam({ name: 'makeId', type: Number })
  getModels(@Param('makeId', ParseIntPipe) makeId: number) {
    return this.fitmentService.getModels(makeId);
  }

  @Get('models/:modelId/submodels')
  @ApiOperation({ summary: 'List submodels for a model' })
  @ApiParam({ name: 'modelId', type: Number })
  getSubmodels(@Param('modelId', ParseIntPipe) modelId: number) {
    return this.fitmentService.getSubmodels(modelId);
  }

  @Get('engines')
  @ApiOperation({ summary: 'List engines (optional fuzzy search)' })
  @ApiQuery({ name: 'q', required: false })
  getEngines(@Query('q') q?: string) {
    return this.fitmentService.getEngines(q);
  }

  // ─── Search by vehicle ───

  @Get('search')
  @ApiOperation({ summary: 'Search parts by vehicle fitment' })
  searchByVehicle(@Query() dto: SearchFitmentDto) {
    return this.fitmentService.searchByVehicle(dto);
  }

  // ─── Listing fitment CRUD ───

  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get all fitments for a listing' })
  getListingFitments(
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.fitmentService.getListingFitments(listingId);
  }

  @Post('listing/:listingId')
  @ApiOperation({ summary: 'Add fitment to a listing' })
  createFitment(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateFitmentDto,
  ) {
    return this.fitmentService.createFitment(listingId, dto);
  }

  @Delete(':fitmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a fitment record' })
  deleteFitment(@Param('fitmentId', ParseUUIDPipe) fitmentId: string) {
    return this.fitmentService.deleteFitment(fitmentId);
  }

  @Patch(':fitmentId/verify')
  @ApiOperation({ summary: 'Verify or unverify a fitment record' })
  verifyFitment(
    @Param('fitmentId', ParseUUIDPipe) fitmentId: string,
    @Body() dto: VerifyFitmentDto,
  ) {
    return this.fitmentService.verifyFitment(fitmentId, dto.verified);
  }

  // ─── AI detection ───

  @Post('detect')
  @ApiOperation({ summary: 'Detect fitment from raw text via AI/regex' })
  detectFitment(@Body() dto: FitmentDetectionDto) {
    return this.matcherService.detectFromText(dto.text ?? '');
  }

  // ─── Bulk import ───

  @Post('bulk-import')
  @ApiOperation({ summary: 'Enqueue ACES XML/CSV bulk import' })
  bulkImport(@Body() body: { rows: AcesVehicleRow[] }) {
    return this.importService.enqueueBulkImport(body.rows);
  }
}
