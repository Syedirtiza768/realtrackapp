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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var VinDecodeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VinDecodeService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const vin_cache_entity_js_1 = require("./entities/vin-cache.entity.js");
const openai_service_js_1 = require("../common/openai/openai.service.js");
const brand_decoder_registry_js_1 = require("./vin-decoders/brand-decoder.registry.js");
const brand_knowledge_js_1 = require("./vin-decoders/brand-knowledge.js");
const json_sanitizer_js_1 = require("../common/openai/json-sanitizer.js");
let VinDecodeService = class VinDecodeService {
    static { VinDecodeService_1 = this; }
    cacheRepo;
    openai;
    brandRegistry;
    logger = new common_1.Logger(VinDecodeService_1.name);
    static NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
    static NHTSA_RECALL_BASE = 'https://api.nhtsa.gov/recalls';
    static VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;
    constructor(cacheRepo, openai, brandRegistry) {
        this.cacheRepo = cacheRepo;
        this.openai = openai;
        this.brandRegistry = brandRegistry;
    }
    async decode(vin) {
        const normalizedVin = vin.trim().toUpperCase();
        if (!VinDecodeService_1.VIN_REGEX.test(normalizedVin)) {
            throw new common_1.BadRequestException(`Invalid VIN format: "${vin}". Must be 17 alphanumeric characters.`);
        }
        const cached = await this.cacheRepo.findOne({
            where: { vin: normalizedVin },
        });
        if (cached && !this.isExpired(cached.fetchedAt)) {
            this.logger.debug(`VIN cache hit: ${normalizedVin}`);
            return cached.decodedData;
        }
        this.logger.log(`[Tier 1] Decoding VIN via NHTSA: ${normalizedVin}`);
        const url = `${VinDecodeService_1.NHTSA_BASE}/DecodeVin/${normalizedVin}?format=json`;
        const { data } = await axios_1.default.get(url, { timeout: 15_000 });
        const results = data?.Results ?? [];
        const raw = this.buildRawMap(results);
        let decoded = this.normalize(normalizedVin, raw);
        const brandDecoder = this.brandRegistry.getDecoder(decoded.make || normalizedVin);
        if (brandDecoder) {
            this.logger.log(`[Tier 2] Applying ${brandDecoder.brand} VIN decoder for ${normalizedVin}`);
            try {
                const vds = brandDecoder.decodeVds(normalizedVin);
                const plantCode = normalizedVin.charAt(10);
                const plant = brandDecoder.decodePlant(plantCode);
                decoded = {
                    ...decoded,
                    model: decoded.model || vds.model || '',
                    trim: decoded.trim || vds.trim || '',
                    bodyClass: decoded.bodyClass || vds.bodyStyle || '',
                    driveType: decoded.driveType || vds.drivetrain || '',
                    engineCylinders: decoded.engineCylinders || '',
                    engineDisplacementL: decoded.engineDisplacementL || '',
                };
                if (vds.engineCode) {
                    decoded._brandEngineCode = vds.engineCode;
                }
                if (plant) {
                    decoded.plantCountry = decoded.plantCountry || plant.country;
                    decoded._plantName = plant.plantName;
                    decoded._plantCity = plant.city;
                }
            }
            catch (err) {
                this.logger.warn(`Brand decoder failed for ${normalizedVin}: ${err.message}`);
            }
        }
        const isIncomplete = !decoded.model || !decoded.trim || !decoded.engineCylinders;
        if (isIncomplete) {
            try {
                this.logger.log(`[Tier 3] NHTSA+Brand decode incomplete for ${normalizedVin}, enriching via AI...`);
                decoded = await this.enrichWithAI(decoded, brandDecoder?.brand);
            }
            catch (err) {
                this.logger.warn(`AI enrichment failed for ${normalizedVin}: ${err.message}`);
            }
        }
        await this.cacheRepo.upsert({
            vin: normalizedVin,
            decodedData: decoded,
            fetchedAt: new Date(),
        }, ['vin']);
        return decoded;
    }
    async toEbayCompatibilityFilter(vin) {
        const decoded = await this.decode(vin);
        const filter = {};
        if (decoded.make)
            filter['Make'] = decoded.make;
        if (decoded.model)
            filter['Model'] = decoded.model;
        if (decoded.year)
            filter['Year'] = decoded.year;
        if (decoded.trim)
            filter['Trim'] = decoded.trim;
        return filter;
    }
    async getRecalls(make, model, year) {
        try {
            const url = `${VinDecodeService_1.NHTSA_RECALL_BASE}/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
            const { data } = await axios_1.default.get(url, { timeout: 10_000 });
            return (data?.results || []).map((r) => ({
                campaignNumber: r.NHTSACampaignNumber || '',
                component: r.Component || '',
                summary: r.Summary || '',
                consequence: r.Consequence || '',
                remedy: r.Remedy || '',
            }));
        }
        catch (err) {
            this.logger.warn(`Failed to fetch recalls for ${year} ${make} ${model}: ${err.message}`);
            return [];
        }
    }
    async enrichWithAI(decoded, brand) {
        const nhtsaSummary = [
            decoded.year && `Year: ${decoded.year}`,
            decoded.make && `Make: ${decoded.make}`,
            decoded.model && `Model: ${decoded.model}`,
            decoded.trim && `Trim: ${decoded.trim}`,
            decoded.bodyClass && `Body: ${decoded.bodyClass}`,
            decoded.driveType && `Drive: ${decoded.driveType}`,
            decoded.engineCylinders && `Cylinders: ${decoded.engineCylinders}`,
            decoded.engineDisplacementL &&
                `Displacement: ${decoded.engineDisplacementL}L`,
            decoded.fuelType && `Fuel: ${decoded.fuelType}`,
            decoded.vehicleType && `Type: ${decoded.vehicleType}`,
            decoded._brandEngineCode &&
                `Brand Engine Code: ${decoded._brandEngineCode}`,
            decoded._plantName && `Plant: ${decoded._plantName}`,
        ]
            .filter(Boolean)
            .join(', ');
        const brandContext = brand ? (0, brand_knowledge_js_1.getBrandContext)(brand) : '';
        const systemPrompt = `You are an automotive VIN decoder expert. Given a VIN and any partial NHTSA decode data, return a JSON object with comprehensive vehicle information.
${brand ? `\nBRAND-SPECIFIC KNOWLEDGE:\n${brandContext}\n` : ''}
Return ONLY valid JSON with this exact structure (no trailing commas):
{
  "make": "string",
  "model": "string",
  "trim": "string",
  "year": "string",
  "bodyClass": "string (e.g. SUV, Sedan, Pickup, Coupe, Hatchback, Crossover)",
  "driveType": "string (e.g. AWD, FWD, RWD, 4WD)",
  "engineCylinders": "string (e.g. 4, 6, 8)",
  "engineDisplacementL": "string (e.g. 2.0, 3.5)",
  "engineDescription": "string (e.g. 2.0L Turbo I-4 DOHC 16V Valvematic)",
  "engineCode": "string (e.g. 3ZR-FAE, N20, B48)",
  "fuelType": "string (e.g. Gasoline, Diesel, Hybrid, Electric)",
  "transmission": "string (e.g. 8-speed Automatic, CVT, 6-speed Manual)",
  "mpg": "string (e.g. 24 city / 30 highway)",
  "horsepower": "string (e.g. 235 hp)",
  "torque": "string (e.g. 258 lb-ft)",
  "seatingCapacity": "string",
  "wheelbase": "string (e.g. 105.1 in)",
  "curbWeight": "string (e.g. 3,940 lbs)",
  "plantCountry": "string",
  "vehicleType": "string",
  "commonParts": ["5-10 common aftermarket parts for this exact vehicle"],
  "knownFitment": ["compatible vehicles sharing parts (include year ranges)"],
  "description": "brief 1-2 sentence description"
}

Rules:
- Be precise. Use real specifications.
- If unsure about a field, use empty string.
- Do NOT hallucinate. If you cannot determine the model from this VIN, say so.
- commonParts should list actual part types (e.g. "Front Brake Pads", "Oil Filter"), not part numbers.
- knownFitment should list vehicles that share the same OEM parts (e.g. "2019-2022 Toyota Corolla — shares brake pads").`;
        const userPrompt = `Decode this VIN comprehensively:
VIN: ${decoded.vin}
Partial NHTSA data: ${nhtsaSummary || 'No data available'}
${decoded._brandEngineCode ? `Brand decoder suggests engine code: ${decoded._brandEngineCode}` : ''}

Provide the full vehicle specification. Return ONLY valid JSON — no trailing commas, no markdown fences.`;
        const response = await this.openai.chat({
            systemPrompt,
            userPrompt,
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 1500,
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
            this.logger.warn('Failed to parse AI VIN enrichment response');
            return decoded;
        }
        if (!aiData || typeof aiData !== 'object') {
            return decoded;
        }
        const enriched = {
            ...decoded,
            year: decoded.year || aiData.year || '',
            make: decoded.make || aiData.make || '',
            model: decoded.model || aiData.model || '',
            trim: decoded.trim || aiData.trim || '',
            bodyClass: decoded.bodyClass || aiData.bodyClass || '',
            driveType: decoded.driveType || aiData.driveType || '',
            engineCylinders: decoded.engineCylinders || aiData.engineCylinders || '',
            engineDisplacementL: decoded.engineDisplacementL || aiData.engineDisplacementL || '',
            fuelType: decoded.fuelType || aiData.fuelType || '',
            plantCountry: decoded.plantCountry || aiData.plantCountry || '',
            vehicleType: decoded.vehicleType || aiData.vehicleType || '',
            aiEnriched: true,
            aiData: {
                engineDescription: aiData.engineDescription || '',
                transmission: aiData.transmission || '',
                mpg: aiData.mpg || '',
                horsepower: aiData.horsepower || '',
                torque: aiData.torque || '',
                seatingCapacity: aiData.seatingCapacity || '',
                wheelbase: aiData.wheelbase || '',
                curbWeight: aiData.curbWeight || '',
                commonParts: aiData.commonParts || [],
                knownFitment: aiData.knownFitment || [],
                description: aiData.description || '',
            },
        };
        this.logger.log(`AI enriched VIN ${decoded.vin}: ${enriched.make} ${enriched.model} ${enriched.trim} ${enriched.year}`);
        return enriched;
    }
    buildRawMap(results) {
        const map = {};
        for (const r of results) {
            if (r.Value && r.Value.trim() !== '') {
                map[r.Variable] = r.Value.trim();
            }
        }
        return map;
    }
    normalize(vin, raw) {
        return {
            vin,
            year: raw['Model Year'] ?? '',
            make: raw['Make'] ?? '',
            model: raw['Model'] ?? '',
            trim: raw['Trim'] ?? '',
            bodyClass: raw['Body Class'] ?? '',
            driveType: raw['Drive Type'] ?? '',
            engineCylinders: raw['Engine Number of Cylinders'] ?? '',
            engineDisplacementL: raw['Displacement (L)'] ?? '',
            fuelType: raw['Fuel Type - Primary'] ?? '',
            plantCountry: raw['Plant Country'] ?? '',
            vehicleType: raw['Vehicle Type'] ?? '',
            raw,
        };
    }
    isExpired(fetchedAt) {
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        return Date.now() - fetchedAt.getTime() > thirtyDays;
    }
};
exports.VinDecodeService = VinDecodeService;
exports.VinDecodeService = VinDecodeService = VinDecodeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vin_cache_entity_js_1.VinCache)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        openai_service_js_1.OpenAiService,
        brand_decoder_registry_js_1.BrandVinDecoderRegistry])
], VinDecodeService);
//# sourceMappingURL=vin-decode.service.js.map