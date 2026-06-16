import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { VinDecodeService, type VinDecodeResult } from './vin-decode.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { sanitizeJson } from '../common/openai/json-sanitizer.js';
import { getBrandContext } from './vin-decoders/brand-knowledge.js';

/* ── Types ── */

interface PartRow {
  partNumber: string;
  price: number | string;
  quantity: number;
  vehicleMake: string;
  description: string;
  imageUrls: string;
  sku: string;
  weightMajor: string;
  weightMinor: string;
  packageLength: string;
  packageWidth: string;
  packageDepth: string;
}

interface CategorySection {
  category: string;
  parts: PartRow[];
}

/**
 * VinExportService — Generate GridX Connect XLSX pipeline input files from a VIN.
 *
 * Flow:
 *   1. Decode VIN (NHTSA + Brand Decoder + AI)
 *   2. Use AI to generate comprehensive parts list with OEM part numbers
 *   3. Structure into GridX Connect format (category sections + part rows)
 *   4. Write XLSX file
 *
 * The output XLSX is directly uploadable to POST /api/pipeline/upload.
 */
@Injectable()
export class VinExportService {
  private readonly logger = new Logger(VinExportService.name);

  constructor(
    private readonly vinDecode: VinDecodeService,
    private readonly openai: OpenAiService,
  ) {}

  /**
   * Generate a GridX Connect XLSX file for a VIN.
   * Returns the file buffer and metadata.
   */
  async generatePipelineInput(vin: string): Promise<{
    buffer: Buffer;
    filename: string;
    vehicleInfo: VinDecodeResult;
    partCount: number;
    categoryCount: number;
  }> {
    // ── Step 1: Decode VIN ──
    this.logger.log(`Generating pipeline input for VIN: ${vin}`);
    const vehicle = await this.vinDecode.decode(vin);

    if (!vehicle.make || !vehicle.model) {
      throw new BadRequestException(
        `Could not decode VIN ${vin} — missing make/model. NHTSA may not have data for this VIN.`,
      );
    }

    // ── Step 2: AI-generate comprehensive parts list ──
    const brand = vehicle.make;
    const brandContext = getBrandContext(brand);
    const year = vehicle.year;
    const model = vehicle.model;
    const trim = vehicle.trim || '';
    const engine = vehicle.aiData?.engineDescription || `${vehicle.engineDisplacementL}L ${vehicle.engineCylinders}cyl`;

    const systemPrompt = `You are an expert ${brand} OEM parts catalog specialist. Generate a comprehensive list of ALL parts that would be available from a dismantled ${year} ${brand} ${model} ${trim}.

VEHICLE CONTEXT:
- Year: ${year}
- Make: ${brand}
- Model: ${model}
- Trim: ${trim}
- Engine: ${engine}
- VIN: ${vin}

BRAND KNOWLEDGE:
${brandContext}

Generate parts organized by category. Include EVERY part that a salvage yard would typically inventory.

RULES:
1. Use REAL ${brand} OEM part numbers. Format: ${brand === 'Toyota' ? 'XXXXX-XXXXX' : 'brand-specific format'}
2. Include realistic used-part prices in USD
3. Every part description MUST include: "${year} ${brand} ${model}" + part name + "Used OEM"
4. Generate a SKU for each part using pattern: ${brand.substring(0, 3).toUpperCase()}-${model.substring(0, 3).toUpperCase()}-${vin.substring(vin.length - 4)}-XX-A (where XX is category code, A/B/C for multiple parts)
5. Include at least 3-5 parts per major category, 2-3 per minor category
6. Cover ALL these categories: Engine, Front Windshield, Front Bumper, Rear Bumper, Radiator Grille, Hood, Fenders, Doors, Headlights, Tail Lights, Interior, Suspension, Brakes, Wheels, Electrical, Cooling, Exhaust, Transmission, Steering
7. Mark uncertain part numbers with [VERIFY] in the description (not in the part number field)
8. Return ONLY valid JSON — no trailing commas, no markdown

Return JSON:
{
  "categories": [
    {
      "category": "Engine",
      "parts": [
        {
          "partNumber": "19000-25170",
          "price": 3245,
          "description": "Complete Engine Assembly 2.0L Used OEM"
        }
      ]
    }
  ]
}`;

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt: `Generate the complete parts catalog for this dismantled vehicle:
${year} ${brand} ${model} ${trim}
VIN: ${vin}
Engine: ${engine}
Transmission: ${vehicle.aiData?.transmission || 'Automatic'}
Drivetrain: ${vehicle.driveType || 'FWD'}

Return ALL parts organized by category. Include every major component a salvage yard would strip from this vehicle.`,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 8000,
      costLane: 'vin-enrichment',
    });

    let aiData: any;
    try {
      aiData = typeof response.content === 'string'
        ? sanitizeJson(response.content)
        : response.content;
    } catch {
      throw new BadRequestException('Failed to generate parts data from AI. Please try again.');
    }

    if (!aiData?.categories || !Array.isArray(aiData.categories)) {
      throw new BadRequestException('AI returned invalid parts structure. Please try again.');
    }

    // ── Step 3: Build GridX Connect rows ──
    const sections: CategorySection[] = [];
    let partIndex = 0;
    const skuPrefix = `${brand.substring(0, 3).toUpperCase()}-${model.substring(0, 3).toUpperCase()}-${vin.substring(vin.length - 4)}`;

    for (const cat of aiData.categories) {
      const categoryName: string = cat.category || 'Other';
      const parts: PartRow[] = [];

      const categoryCode = this.getCategoryCode(categoryName);

      for (const part of (cat.parts || [])) {
        partIndex++;
        const suffix = String.fromCharCode(65 + (parts.length % 26)); // A, B, C...
        const sku = `${skuPrefix}-${categoryCode}-${suffix}`;

        // Clean part number — remove [VERIFY] markers from the field
        let partNumber = String(part.partNumber || part.part_number || '').trim();
        partNumber = partNumber.replace(/\[VERIFY\]/gi, '').trim();

        // Build description with vehicle context
        let description = String(part.description || part.partName || part.part_name || '');
        if (!description.includes(year)) {
          description = `${year} ${brand} ${model} ${description} Used OEM`;
        }

        parts.push({
          partNumber,
          price: part.price || '',
          quantity: 1,
          vehicleMake: brand,
          description: description.trim(),
          imageUrls: '',
          sku,
          weightMajor: '',
          weightMinor: '',
          packageLength: '',
          packageWidth: '',
          packageDepth: '',
        });
      }

      if (parts.length > 0) {
        sections.push({ category: categoryName, parts });
      }
    }

    // ── Step 4: Write XLSX ──
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Build the data array matching GridX Connect format
    const sheetData: any[][] = [];

    // Row 0: Info header (pipeline detects "GridX" to identify format)
    sheetData.push(['#INFO', 'GridX Connect Advanced Template v4.0 - Add your items starting from row 3. Please keep column names unchanged.', '', '', '', '', '', '', '', '', '', '']);

    // Row 1: Column headers
    sheetData.push(['Part Number', 'Price', 'Quantity', 'Vehicle Make', 'Description', 'Image URLs', 'SKU', 'Weight Major', 'Weight Minor', 'Package Length', 'Package Width', 'Package Depth']);

    // Row 2+: Part rows (flat — no category header rows; the pipeline skips
    // rows with <= 1 non-empty cell, but omitting them keeps the file clean)
    for (const section of sections) {
      for (const part of section.parts) {
        sheetData.push([
          part.partNumber,
          part.price,
          part.quantity,
          part.vehicleMake,
          part.description,
          part.imageUrls,
          part.sku,
          part.weightMajor,
          part.weightMinor,
          part.packageLength,
          part.packageWidth,
          part.packageDepth,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths for readability
    ws['!cols'] = [
      { wch: 18 },  // Part Number
      { wch: 10 },  // Price
      { wch: 10 },  // Quantity
      { wch: 15 },  // Vehicle Make
      { wch: 80 },  // Description
      { wch: 30 },  // Image URLs
      { wch: 25 },  // SKU
      { wch: 12 },  // Weight Major
      { wch: 12 },  // Weight Minor
      { wch: 14 },  // Package Length
      { wch: 13 },  // Package Width
      { wch: 13 },  // Package Depth
    ];

    // Use the VIN as the sheet name — the pipeline derives VIN from sheet name
    // when no VIN is detected in the row data, and uses it for NHTSA decode.
    // "Sheet1" caused decode failures since it's only 6 chars (< 11 minimum).
    XLSX.utils.book_append_sheet(wb, ws, vin);

    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const safeModelName = model.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${year}_${brand}_${safeModelName}_VIN_${vin.substring(vin.length - 6)}.xlsx`;

    const totalParts = sections.reduce((sum, s) => sum + s.parts.length, 0);

    this.logger.log(
      `Generated pipeline input for ${vin}: ${year} ${brand} ${model} — ${totalParts} parts across ${sections.length} categories`,
    );

    return {
      buffer,
      filename,
      vehicleInfo: vehicle,
      partCount: totalParts,
      categoryCount: sections.length,
    };
  }

  /**
   * Map category name to a 2-character code for SKU generation.
   */
  private getCategoryCode(category: string): string {
    const codes: Record<string, string> = {
      Engine: 'EN',
      'Front Windshield': 'WS1',
      'Front Bumper': 'BP1',
      'Rear Bumper': 'BP2',
      'Radiator Grille': 'GR',
      Hood: 'BN',
      Fenders: 'FD',
      Doors: 'DR',
      Headlights: 'HL',
      'Tail Lights': 'TL',
      Interior: 'IN',
      Suspension: 'SU',
      Brakes: 'BR',
      Wheels: 'WH',
      Electrical: 'EL',
      Cooling: 'CL',
      Exhaust: 'EX',
      Transmission: 'TR',
      Steering: 'ST',
      'HVAC': 'AC',
      'Fuel System': 'FL',
      'Body Panels': 'BD',
      'Safety': 'SF',
      'Sensors': 'SN',
      'Exterior Trim': 'ET',
      'Lighting': 'LT',
      'Wheels & Tires': 'WT',
    };

    // Try exact match first
    if (codes[category]) return codes[category];

    // Try partial match
    const lower = category.toLowerCase();
    for (const [key, code] of Object.entries(codes)) {
      if (lower.includes(key.toLowerCase())) return code;
    }

    // Fallback: first 2 chars uppercase
    return category.substring(0, 2).toUpperCase();
  }
}
