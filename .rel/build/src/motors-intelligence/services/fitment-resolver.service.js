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
var FitmentResolverService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FitmentResolverService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../entities");
const part_fitment_entity_1 = require("../../fitment/entities/part-fitment.entity");
const fitment_make_entity_1 = require("../../fitment/entities/fitment-make.entity");
const fitment_model_entity_1 = require("../../fitment/entities/fitment-model.entity");
const fitment_service_1 = require("../../fitment/fitment.service");
let FitmentResolverService = FitmentResolverService_1 = class FitmentResolverService {
    motorsProductRepo;
    categoryMappingRepo;
    partFitmentRepo;
    fitmentMakeRepo;
    fitmentModelRepo;
    fitmentService;
    logger = new common_1.Logger(FitmentResolverService_1.name);
    constructor(motorsProductRepo, categoryMappingRepo, partFitmentRepo, fitmentMakeRepo, fitmentModelRepo, fitmentService) {
        this.motorsProductRepo = motorsProductRepo;
        this.categoryMappingRepo = categoryMappingRepo;
        this.partFitmentRepo = partFitmentRepo;
        this.fitmentMakeRepo = fitmentMakeRepo;
        this.fitmentModelRepo = fitmentModelRepo;
        this.fitmentService = fitmentService;
    }
    async resolveFitment(motorsProductId) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: motorsProductId },
        });
        const errors = [];
        const warnings = [];
        let supportsCompatibility = false;
        if (product.ebayCategoryId) {
            const mapping = await this.categoryMappingRepo.findOne({
                where: { ebayCategoryId: product.ebayCategoryId },
            });
            supportsCompatibility = mapping?.supportsCompatibility || false;
        }
        let fitmentRows = [];
        if (product.listingId) {
            const existing = await this.partFitmentRepo.find({
                where: { listingId: product.listingId },
                relations: ['make', 'model'],
            });
            if (existing.length > 0) {
                fitmentRows = existing.map((pf) => ({
                    yearStart: pf.yearStart,
                    yearEnd: pf.yearEnd,
                    make: pf.make?.name || '',
                    model: pf.model?.name || '',
                    notes: pf.notes ? [pf.notes] : [],
                }));
            }
        }
        if (fitmentRows.length === 0 && product.fitmentRows?.length) {
            fitmentRows = this.normalizeFitmentRows(product.fitmentRows);
        }
        const validatedRows = [];
        for (const row of fitmentRows) {
            const validation = await this.validateFitmentRow(row);
            if (validation.valid) {
                validatedRows.push(validation.normalizedRow);
            }
            else {
                warnings.push(...validation.warnings);
                errors.push(...validation.errors);
            }
        }
        const deduped = this.deduplicateRows(validatedRows);
        const summary = this.generateCompatibilitySummary(deduped);
        const confidence = this.calculateFitmentConfidence(deduped, errors, warnings, supportsCompatibility);
        product.fitmentRows = deduped;
        product.compatibleVehicleSummary = summary;
        product.fitmentConfidence = confidence;
        product.compatibilityRequired = supportsCompatibility;
        await this.motorsProductRepo.save(product);
        return {
            resolved: deduped.length > 0 || !supportsCompatibility,
            fitmentRows: deduped,
            fitmentConfidence: confidence,
            compatibleVehicleSummary: summary,
            errors,
            warnings,
        };
    }
    normalizeFitmentRows(rawRows) {
        return rawRows
            .map((row) => {
            const normalized = {
                make: this.normalizeString(row.make || row.Make || ''),
                model: this.normalizeString(row.model || row.Model || ''),
            };
            if (row.year) {
                const yearStr = String(row.year);
                if (yearStr.includes('-')) {
                    const parts = yearStr.split('-');
                    normalized.yearStart = parseInt(parts[0], 10);
                    normalized.yearEnd = parseInt(parts[1], 10);
                }
                else {
                    normalized.yearStart = parseInt(yearStr, 10);
                    normalized.yearEnd = parseInt(yearStr, 10);
                }
            }
            else if (row.year_range) {
                const yearStr = String(row.year_range);
                if (yearStr.includes('-')) {
                    const parts = yearStr.split('-');
                    normalized.yearStart = parseInt(parts[0], 10);
                    normalized.yearEnd = parseInt(parts[1], 10);
                }
                else {
                    normalized.yearStart = parseInt(yearStr, 10);
                    normalized.yearEnd = parseInt(yearStr, 10);
                }
            }
            else {
                if (row.yearStart)
                    normalized.yearStart = parseInt(String(row.yearStart), 10);
                if (row.yearEnd)
                    normalized.yearEnd = parseInt(String(row.yearEnd), 10);
            }
            if (row.submodel || row.Submodel || row.trim) {
                normalized.submodel = this.normalizeString(row.submodel || row.Submodel || row.trim);
            }
            if (row.engine || row.Engine) {
                normalized.engine = row.engine || row.Engine;
            }
            if (row.notes) {
                normalized.notes = Array.isArray(row.notes) ? row.notes : [row.notes];
            }
            return normalized;
        })
            .filter((row) => row.make || row.model);
    }
    async validateFitmentRow(row) {
        const warnings = [];
        const errors = [];
        const normalizedRow = { ...row };
        if (normalizedRow.yearStart) {
            const currentYear = new Date().getFullYear();
            if (normalizedRow.yearStart < 1900 ||
                normalizedRow.yearStart > currentYear + 2) {
                errors.push(`Invalid year ${normalizedRow.yearStart}`);
                return { valid: false, normalizedRow, warnings, errors };
            }
        }
        if (normalizedRow.yearEnd && normalizedRow.yearStart) {
            if (normalizedRow.yearEnd < normalizedRow.yearStart) {
                errors.push(`Year end (${normalizedRow.yearEnd}) before year start (${normalizedRow.yearStart})`);
                return { valid: false, normalizedRow, warnings, errors };
            }
            if (normalizedRow.yearEnd - normalizedRow.yearStart > 50) {
                warnings.push(`Large year range: ${normalizedRow.yearStart}-${normalizedRow.yearEnd}`);
            }
        }
        if (normalizedRow.make) {
            const make = await this.fitmentMakeRepo.findOne({
                where: { name: ILike_safe(normalizedRow.make) },
            });
            if (make) {
                normalizedRow.make = make.name;
            }
            else {
                normalizedRow.make = this.capitalizeWords(normalizedRow.make);
                warnings.push(`Make "${normalizedRow.make}" not found in reference data`);
            }
        }
        if (normalizedRow.model) {
            normalizedRow.model = this.capitalizeWords(normalizedRow.model);
        }
        if (normalizedRow.submodel) {
            normalizedRow.submodel = normalizedRow.submodel.trim();
        }
        return { valid: true, normalizedRow, warnings, errors };
    }
    deduplicateRows(rows) {
        const seen = new Set();
        return rows.filter((row) => {
            const key = `${row.yearStart}-${row.yearEnd}-${row.make}-${row.model}-${row.submodel || ''}-${row.engine || ''}`.toLowerCase();
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    generateCompatibilitySummary(rows) {
        if (rows.length === 0)
            return '';
        const groups = {};
        for (const row of rows) {
            const key = `${row.make} ${row.model}`;
            if (!groups[key]) {
                groups[key] = { years: [], submodels: [] };
            }
            if (row.yearStart) {
                if (row.yearEnd && row.yearEnd !== row.yearStart) {
                    for (let y = row.yearStart; y <= row.yearEnd; y++) {
                        groups[key].years.push(y);
                    }
                }
                else {
                    groups[key].years.push(row.yearStart);
                }
            }
            if (row.submodel && !groups[key].submodels.includes(row.submodel)) {
                groups[key].submodels.push(row.submodel);
            }
        }
        const summaries = [];
        for (const [vehicle, data] of Object.entries(groups)) {
            const uniqueYears = [...new Set(data.years)].sort();
            if (uniqueYears.length > 0) {
                const yearRange = this.compactYearRange(uniqueYears);
                summaries.push(`${yearRange} ${vehicle}`);
            }
            else {
                summaries.push(vehicle);
            }
        }
        return summaries.join(', ');
    }
    compactYearRange(years) {
        if (years.length === 0)
            return '';
        if (years.length === 1)
            return String(years[0]);
        const min = Math.min(...years);
        const max = Math.max(...years);
        if (max - min + 1 === years.length) {
            return `${min}-${max}`;
        }
        return `${min}-${max}`;
    }
    calculateFitmentConfidence(rows, errors, warnings, required) {
        if (!required && rows.length === 0)
            return 1.0;
        if (required && rows.length === 0)
            return 0.0;
        let confidence = 0.5;
        if (rows.length > 5)
            confidence += 0.2;
        else if (rows.length > 0)
            confidence += 0.1;
        const validMakeModel = rows.filter((r) => r.make && r.model).length;
        confidence += (validMakeModel / rows.length) * 0.2;
        const hasYears = rows.filter((r) => r.yearStart).length;
        confidence += (hasYears / rows.length) * 0.1;
        confidence -= errors.length * 0.1;
        confidence -= warnings.length * 0.02;
        return Math.max(0, Math.min(1, confidence));
    }
    normalizeString(str) {
        return str.trim().replace(/\s+/g, ' ');
    }
    capitalizeWords(str) {
        return str
            .toLowerCase()
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
};
exports.FitmentResolverService = FitmentResolverService;
exports.FitmentResolverService = FitmentResolverService = FitmentResolverService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.MotorsProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.EbayCategoryMapping)),
    __param(2, (0, typeorm_1.InjectRepository)(part_fitment_entity_1.PartFitment)),
    __param(3, (0, typeorm_1.InjectRepository)(fitment_make_entity_1.FitmentMake)),
    __param(4, (0, typeorm_1.InjectRepository)(fitment_model_entity_1.FitmentModel)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        fitment_service_1.FitmentService])
], FitmentResolverService);
function ILike_safe(value) {
    return value;
}
//# sourceMappingURL=fitment-resolver.service.js.map