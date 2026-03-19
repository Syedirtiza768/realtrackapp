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
import { EbayMvlService, type FitmentSelection } from './ebay-mvl.service.js';
import { VinDecodeService } from './vin-decode.service.js';
import { CreateFitmentDto, VerifyFitmentDto, FitmentDetectionDto } from './dto/create-fitment.dto.js';
import { SearchFitmentDto } from './dto/search-fitment.dto.js';

@ApiTags('fitment')
@Controller('fitment')
export class FitmentController {
  constructor(
    private readonly fitmentService: FitmentService,
    private readonly matcherService: FitmentMatcherService,
    private readonly importService: FitmentImportService,
    private readonly mvlService: EbayMvlService,
    private readonly vinService: VinDecodeService,
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

  // ─── eBay MVL (Compatibility) ───

  @Get('compatibility-properties/:categoryId')
  @ApiOperation({ summary: 'Get compatibility property names for an eBay category' })
  @ApiParam({ name: 'categoryId', type: String, example: '6000' })
  @ApiQuery({ name: 'treeId', required: false, description: 'eBay category tree ID (default: 0 for US)' })
  getCompatibilityProperties(
    @Param('categoryId') categoryId: string,
    @Query('treeId') treeId?: string,
  ) {
    return this.mvlService.fetchCompatibilityTree(categoryId, treeId);
  }

  @Get('property-values/:categoryId/:propertyName')
  @ApiOperation({ summary: 'Get cascading property values (e.g. Models for a Make)' })
  @ApiParam({ name: 'categoryId', type: String, example: '6000' })
  @ApiParam({ name: 'propertyName', type: String, example: 'Model' })
  @ApiQuery({ name: 'q', required: false, description: 'Text search filter' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getPropertyValues(
    @Param('categoryId') categoryId: string,
    @Param('propertyName') propertyName: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query() allQuery?: Record<string, string>,
  ) {
    // Extract parent filters from query params (e.g. ?Make=Toyota&Model=Camry)
    const reserved = new Set(['q', 'limit', 'offset', 'treeId']);
    const filters: Record<string, string> = {};
    if (allQuery) {
      for (const [key, val] of Object.entries(allQuery)) {
        if (!reserved.has(key) && typeof val === 'string' && val) {
          filters[key] = val;
        }
      }
    }

    return this.mvlService.getPropertyValues(
      categoryId,
      propertyName,
      filters,
      q,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
      allQuery?.['treeId'],
    );
  }

  @Post('build-compatibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert fitment selections to eBay compatibility JSON' })
  buildCompatibility(@Body() body: { selections: FitmentSelection[] }) {
    return this.mvlService.buildCompatibilityArray(body.selections);
  }

  @Get('ebay-makes')
  @ApiOperation({ summary: 'Paginated eBay Make search (shorthand)' })
  @ApiQuery({ name: 'categoryId', required: false, example: '6000' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getEbayMakes(
    @Query('categoryId') categoryId = '6000',
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.mvlService.getMakes(
      categoryId,
      q,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get('ebay-models')
  @ApiOperation({ summary: 'Paginated eBay Model search filtered by Make' })
  @ApiQuery({ name: 'categoryId', required: false, example: '6000' })
  @ApiQuery({ name: 'make', required: true })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getEbayModels(
    @Query('make') make: string,
    @Query('categoryId') categoryId = '6000',
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.mvlService.getModels(
      categoryId,
      make,
      q,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  // ─── VIN Decode ───

  @Get('vin/:vin')
  @ApiOperation({ summary: 'Decode a VIN via NHTSA and map to eBay compatibility filter' })
  @ApiParam({ name: 'vin', type: String, example: '1HGCV1F34LA000001' })
  decodeVin(@Param('vin') vin: string) {
    return this.vinService.decode(vin);
  }

  @Get('vin/:vin/ebay-filter')
  @ApiOperation({ summary: 'Decode VIN and return eBay compatibility filter object' })
  @ApiParam({ name: 'vin', type: String })
  vinToEbayFilter(@Param('vin') vin: string) {
    return this.vinService.toEbayCompatibilityFilter(vin);
  }
}
