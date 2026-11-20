"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var VinExportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VinExportService = void 0;
const common_1 = require("@nestjs/common");
const vin_decode_service_js_1 = require("./vin-decode.service.js");
const openai_service_js_1 = require("../common/openai/openai.service.js");
const json_sanitizer_js_1 = require("../common/openai/json-sanitizer.js");
const brand_knowledge_js_1 = require("./vin-decoders/brand-knowledge.js");
let VinExportService = VinExportService_1 = class VinExportService {
    vinDecode;
    openai;
    logger = new common_1.Logger(VinExportService_1.name);
    constructor(vinDecode, openai) {
        this.vinDecode = vinDecode;
        this.openai = openai;
    }
    async generatePipelineInput(vin) {
        this.logger.log(`Generating pipeline input for VIN: ${vin}`);
        const vehicle = await this.vinDecode.decode(vin);
        if (!vehicle.make || !vehicle.model) {
            throw new common_1.BadRequestException(`Could not decode VIN ${vin} — missing make/model. NHTSA may not have data for this VIN.`);
        }
        const brand = vehicle.make;
        const brandContext = (0, brand_knowledge_js_1.getBrandContext)(brand);
        const year = vehicle.year;
        const model = vehicle.model;
        const trim = vehicle.trim || '';
        const engine = vehicle.aiData?.engineDescription ||
            `${vehicle.engineDisplacementL}L ${vehicle.engineCylinders}cyl`;
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
        let aiData;
        try {
            aiData =
                typeof response.content === 'string'
                    ? (0, json_sanitizer_js_1.sanitizeJson)(response.content)
                    : response.content;
        }
        catch {
            throw new common_1.BadRequestException('Failed to generate parts data from AI. Please try again.');
        }
        if (!aiData?.categories || !Array.isArray(aiData.categories)) {
            throw new common_1.BadRequestException('AI returned invalid parts structure. Please try again.');
        }
        const sections = [];
        let partIndex = 0;
        const skuPrefix = `${brand.substring(0, 3).toUpperCase()}-${model.substring(0, 3).toUpperCase()}-${vin.substring(vin.length - 4)}`;
        for (const cat of aiData.categories) {
            const categoryName = cat.category || 'Other';
            const parts = [];
            const categoryCode = this.getCategoryCode(categoryName);
            for (const part of cat.parts || []) {
                partIndex++;
                const suffix = String.fromCharCode(65 + (parts.length % 26));
                const sku = `${skuPrefix}-${categoryCode}-${suffix}`;
                let partNumber = String(part.partNumber || part.part_number || '').trim();
                partNumber = partNumber.replace(/\[VERIFY\]/gi, '').trim();
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
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const sheetData = [];
        sheetData.push([
            '#INFO',
            'GridX Connect Advanced Template v4.0 - Add your items starting from row 3. Please keep column names unchanged.',
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
        ws['!cols'] = [
            { wch: 18 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 },
            { wch: 80 },
            { wch: 30 },
            { wch: 25 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
            { wch: 13 },
            { wch: 13 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, vin);
        const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
        const safeModelName = model.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${year}_${brand}_${safeModelName}_VIN_${vin.substring(vin.length - 6)}.xlsx`;
        const totalParts = sections.reduce((sum, s) => sum + s.parts.length, 0);
        this.logger.log(`Generated pipeline input for ${vin}: ${year} ${brand} ${model} — ${totalParts} parts across ${sections.length} categories`);
        return {
            buffer,
            filename,
            vehicleInfo: vehicle,
            partCount: totalParts,
            categoryCount: sections.length,
        };
    }
    getCategoryCode(category) {
        const codes = {
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
            HVAC: 'AC',
            'Fuel System': 'FL',
            'Body Panels': 'BD',
            Safety: 'SF',
            Sensors: 'SN',
            'Exterior Trim': 'ET',
            Lighting: 'LT',
            'Wheels & Tires': 'WT',
        };
        if (codes[category])
            return codes[category];
        const lower = category.toLowerCase();
        for (const [key, code] of Object.entries(codes)) {
            if (lower.includes(key.toLowerCase()))
                return code;
        }
        return category.substring(0, 2).toUpperCase();
    }
};
exports.VinExportService = VinExportService;
exports.VinExportService = VinExportService = VinExportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [vin_decode_service_js_1.VinDecodeService,
        openai_service_js_1.OpenAiService])
], VinExportService);
//# sourceMappingURL=vin-export.service.js.map