import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FitmentService } from './fitment.service.js';
import {
  VinDecodeService,
  type VinDecodeResult,
} from './vin-decode.service.js';
import { parseImageUrlField } from '../channels/ebay/ebay-listing-images.util.js';

interface ExportRow {
  sku: string;
  title: string;
  brand: string;
  type: string;
  category: string;
  price: string;
  quantity: string;
  condition: string;
  mpn: string;
  oemPart: string;
  imageUrls: string;
  description: string;
  location: string;
  format: string;
}

/**
 * VinDbExportService — Export VIN-matched database listings as an XLSX file.
 * Unlike VinExportService which AI-generates a theoretical parts catalog,
 * this exports actual listing_records from the database.
 */
@Injectable()
export class VinDbExportService {
  private readonly logger = new Logger(VinDbExportService.name);

  constructor(
    private readonly fitmentService: FitmentService,
    private readonly vinDecode: VinDecodeService,
  ) {}

  async exportListingsByVin(vin: string): Promise<{
    buffer: Buffer;
    filename: string;
    vehicleInfo: VinDecodeResult;
    listingCount: number;
    matchStrategy: string;
  }> {
    this.logger.log(`Exporting DB listings for VIN: ${vin}`);

    const result = await this.fitmentService.findListingsByVin(vin);

    if (result.totalListings === 0) {
      throw new BadRequestException(
        `No listings found for VIN ${vin} (${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}). Try searching eBay first via GET /fitment/vin/${vin}/listings.`,
      );
    }

    const vehicle = result.vehicle;
    const rows: ExportRow[] = result.listings.map(
      (listing: any, idx: number) => {
        const images = parseImageUrlField(listing.itemPhotoUrl);
        return {
          sku: listing.customLabelSku || `ROW-${idx + 1}`,
          title: listing.title || '',
          brand: listing.cBrand || vehicle.make || '',
          type: listing.cType || '',
          category: listing.categoryName || '',
          price: listing.startPrice || listing.startPriceNum?.toString() || '',
          quantity: listing.quantity || listing.quantityNum?.toString() || '1',
          condition: listing.conditionId || '',
          mpn: listing.cManufacturerPartNumber || '',
          oemPart: listing.cOeOemPartNumber || '',
          imageUrls: images.join(' | '),
          description: listing.description || '',
          location: listing.location || '',
          format: listing.format || 'FIXED_PRICE',
        };
      },
    );

    const buffer = this.buildXlsx(vehicle, rows, vin);

    const safeModel = (vehicle.model || 'unknown').replace(
      /[^a-zA-Z0-9]/g,
      '_',
    );
    const filename = `${vehicle.year}_${vehicle.make}_${safeModel}_VIN_${vin.slice(-6)}_listings.xlsx`;

    this.logger.log(
      `Exported ${rows.length} listings for ${vehicle.year} ${vehicle.make} ${vehicle.model} (strategy: ${result.matchStrategy})`,
    );

    return {
      buffer,
      filename,
      vehicleInfo: vehicle,
      listingCount: rows.length,
      matchStrategy: result.matchStrategy,
    };
  }

  private buildXlsx(
    vehicle: VinDecodeResult,
    rows: ExportRow[],
    vin: string,
  ): Buffer {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();

    // GridX Connect format — the pipeline detects this via "GridX" in row 0,
    // uses row 1 as headers, and row 2+ as data.
    const sheetData: any[][] = [];

    // Row 0: Info header (must contain "GridX" for pipeline detection)
    sheetData.push([
      '#INFO',
      `GridX Connect — DB listings for ${vehicle.year} ${vehicle.make} ${vehicle.model} (VIN: ${vin})`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    // Row 1: GridX column headers (pipeline's buildGridxColumnMap matches these)
    sheetData.push([
      'Part Number',
      'Price',
      'Quantity',
      'Vehicle Make',
      'Description',
      'Image URLs',
      'SKU',
      'Weight Major',
      'Weight Minor',
      'Package Length',
      'Package Width',
      'Package Depth',
    ]);

    // Row 2+: Data rows — map DB listing fields to GridX columns
    for (const row of rows) {
      sheetData.push([
        row.mpn || row.oemPart || '', // Part Number
        row.price, // Price
        row.quantity, // Quantity
        row.brand, // Vehicle Make
        row.title || row.description, // Description
        row.imageUrls, // Image URLs
        row.sku, // SKU
        '', // Weight Major
        '', // Weight Minor
        '', // Package Length
        '', // Package Width
        '', // Package Depth
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 18 }, // Part Number
      { wch: 10 }, // Price
      { wch: 10 }, // Quantity
      { wch: 15 }, // Vehicle Make
      { wch: 80 }, // Description
      { wch: 50 }, // Image URLs
      { wch: 25 }, // SKU
      { wch: 12 }, // Weight Major
      { wch: 12 }, // Weight Minor
      { wch: 14 }, // Package Length
      { wch: 13 }, // Package Width
      { wch: 13 }, // Package Depth
    ];

    // Sheet name = VIN — pipeline uses this as fallback VIN for NHTSA decode
    XLSX.utils.book_append_sheet(wb, ws, vin);

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
