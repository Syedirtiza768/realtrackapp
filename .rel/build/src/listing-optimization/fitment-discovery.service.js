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
var FitmentDiscoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FitmentDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const ebay_mvl_service_js_1 = require("../fitment/ebay-mvl.service.js");
const mvl_fitment_expander_service_js_1 = require("../fitment/mvl-fitment-expander.service.js");
const mvl_donor_scope_util_js_1 = require("../fitment/mvl-donor-scope.util.js");
const vin_decode_service_js_1 = require("../fitment/vin-decode.service.js");
const ebay_marketplace_tree_util_js_1 = require("../channels/ebay/ebay-marketplace-tree.util.js");
const ebay_browse_api_service_js_1 = require("../channels/ebay/ebay-browse-api.service.js");
const extract_make_model_from_title_js_1 = require("../listings/utils/extract-make-model-from-title.js");
const oem_fitment_lookup_service_js_1 = require("./oem-fitment-lookup.service.js");
const exact_oem_year_range_util_js_1 = require("./exact-oem-year-range.util.js");
const VIN_REGEX = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
let FitmentDiscoveryService = FitmentDiscoveryService_1 = class FitmentDiscoveryService {
    vinDecode;
    mvl;
    mvlExpander;
    browseApi;
    oemFitmentLookup;
    logger = new common_1.Logger(FitmentDiscoveryService_1.name);
    constructor(vinDecode, mvl, mvlExpander, browseApi, oemFitmentLookup) {
        this.vinDecode = vinDecode;
        this.mvl = mvl;
        this.mvlExpander = mvlExpander;
        this.browseApi = browseApi;
        this.oemFitmentLookup = oemFitmentLookup;
    }
    async discover(product, options) {
        const manualReviewReasons = [];
        const donorVin = this.extractDonorVin(product);
        let donorVinDecoded = null;
        const treeId = (0, ebay_marketplace_tree_util_js_1.resolveCategoryTreeId)(options?.marketplace ?? null);
        const categoryId = options?.categoryId ??
            product.categoryId ??
            ebay_mvl_service_js_1.EbayMvlService.MOTORS_PARTS_CATEGORY;
        const categorySupportsCompatibility = true;
        const candidates = [];
        if (product.donorYear?.trim() &&
            product.donorMake?.trim() &&
            product.donorModel?.trim()) {
            candidates.push({
                year: product.donorYear.trim(),
                make: product.donorMake.trim(),
                model: product.donorModel.trim(),
                confidence: 0.95,
                source: 'user_donor_vehicle',
                validationStatus: 'needs_review',
                notes: 'User-entered donor vehicle',
            });
        }
        if (Array.isArray(product.fitmentData)) {
            const rawRows = product.fitmentData;
            if ((0, mvl_donor_scope_util_js_1.isOverExpandedFitment)(rawRows)) {
                manualReviewReasons.push(`Existing catalog fitment looks over-expanded (span > ${mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN}yr or huge row count) — ignoring and rediscovering`);
                this.logger.warn(`Discarding over-expanded catalog fitment for ${product.sku ?? product.id}: ${rawRows.length} rows`);
            }
            else {
                for (const raw of rawRows) {
                    const row = this.rowFromRaw(raw, 'catalog_fitment');
                    if (row)
                        candidates.push(row);
                }
            }
        }
        if (Array.isArray(product.fitmentRows)) {
            for (const raw of product.fitmentRows) {
                const source = this.rawString(raw['source']);
                const isExactMpnHint = source === 'ebay_mpn_lookup';
                const isPersistedMvLCheckedReview = this.rawString(raw['validationStatus']).toLowerCase() ===
                    'needs_review' &&
                    this.rawString(raw['mvlStatus'] ?? raw['MvlStatus']).toLowerCase() ===
                        'valid' &&
                    source !== 'donor_vin_nhtsa' &&
                    source !== 'user_donor_vehicle';
                const isPersistedExactOemTitleEvidence = source === 'oem_catalog_lookup' &&
                    this.hasExactOemRangeNote(this.rawString(raw['notes'] ?? raw['Notes']), product.mpn?.trim() || product.oemPartNumber);
                if (!isExactMpnHint &&
                    !isPersistedMvLCheckedReview &&
                    !isPersistedExactOemTitleEvidence)
                    continue;
                const row = this.rowFromRaw(raw, source || 'persisted_fitment_review');
                if (row)
                    candidates.push(row);
            }
        }
        if (candidates.length === 0) {
            candidates.push(...this.candidatesFromTitle(product));
        }
        const titleVehicle = this.candidatesFromTitle(product)[0];
        const brandVehicle = this.vehicleFromCombinedBrand(product.brand);
        const targetVehicleMake = product.donorMake?.trim() ||
            titleVehicle?.make ||
            brandVehicle?.make ||
            product.brand?.trim() ||
            '';
        const targetVehicleModel = product.donorModel?.trim() ||
            titleVehicle?.model ||
            brandVehicle?.model ||
            '';
        if (!this.hasPartSpecificYearRange(candidates, targetVehicleMake, targetVehicleModel, product.mpn?.trim() || product.oemPartNumber) &&
            product.brand?.trim() &&
            (product.mpn?.trim() || product.oemPartNumber?.trim())) {
            const mpn = (product.mpn ?? product.oemPartNumber ?? '').trim();
            let exactMpnRows = candidates.filter((row) => row.source === 'ebay_mpn_lookup');
            try {
                if (exactMpnRows.length === 0) {
                    const fitmentLookupMake = product.donorMake?.trim() || targetVehicleMake || product.brand.trim();
                    const lookup = await this.browseApi.searchByMpn(fitmentLookupMake, mpn, {
                        categoryIds: categoryId,
                        marketplaceId: this.browseMarketplaceId(options?.marketplace),
                    });
                    exactMpnRows = this.rowsFromExactMpnLookup(lookup.items, fitmentLookupMake, mpn, targetVehicleMake, targetVehicleModel);
                    if (exactMpnRows.length > 0) {
                        for (let i = candidates.length - 1; i >= 0; i--) {
                            if (candidates[i].source === 'title_parse') {
                                candidates.splice(i, 1);
                            }
                        }
                        candidates.push(...exactMpnRows);
                        manualReviewReasons.push('Exact Brand+MPN eBay listing fitment hints can guide the title but remain review-only; confirm the OEM application before publishing compatibility.');
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Exact Brand+MPN eBay lookup failed for ${product.sku ?? product.id}: ${err instanceof Error ? err.message : err}`);
                manualReviewReasons.push('Exact Brand+MPN eBay lookup was unavailable; trying an OEM catalog source.');
            }
            if (this.oemFitmentLookup) {
                try {
                    const vehicleMake = targetVehicleMake;
                    const vehicleModel = targetVehicleModel;
                    if (vehicleMake && vehicleModel) {
                        const oemResult = await this.oemFitmentLookup.lookup({
                            partBrand: product.brand.trim(),
                            mpn,
                            vehicleMake,
                            vehicleModel,
                            marketplace: options?.marketplace ?? 'US',
                            partName: product.partType?.trim() || product.title?.trim(),
                        });
                        if (oemResult) {
                            const normalizedOemResult = await this.normalizeOemCatalogModelToMvl(oemResult, vehicleModel, categoryId, treeId);
                            const titleEvidenceResult = normalizedOemResult ?? oemResult;
                            if (titleEvidenceResult) {
                                for (let i = candidates.length - 1; i >= 0; i--) {
                                    if (candidates[i].source === 'title_parse' ||
                                        candidates[i].source === 'ebay_mpn_lookup') {
                                        candidates.splice(i, 1);
                                    }
                                }
                                candidates.push(...this.rowsFromOemCatalogLookup(titleEvidenceResult, mpn));
                                manualReviewReasons.push(normalizedOemResult
                                    ? 'Exact-MPN OEM catalog evidence supports the title range. The rows remain review-only and do not approve compatibility.'
                                    : 'Exact-MPN OEM catalog evidence supports the title range, but the vehicle is not represented in the target marketplace MVL; compatibility remains rejected for review.');
                            }
                            else {
                                manualReviewReasons.push('The cited exact-part application could not be mapped to the target marketplace model and trim; no year range was inferred.');
                            }
                        }
                        else {
                            manualReviewReasons.push('Exact MPN OEM catalog lookup did not return a cited, source-verified application for this vehicle; no year range was inferred.');
                        }
                    }
                    else {
                        manualReviewReasons.push('Exact MPN OEM catalog lookup skipped because the target vehicle model could not be identified.');
                    }
                }
                catch (err) {
                    this.logger.warn(`OEM MPN fitment lookup failed for ${product.sku ?? product.id}: ${err instanceof Error ? err.message : err}`);
                    manualReviewReasons.push('Exact MPN OEM catalog lookup was unavailable; no year range was inferred.');
                }
            }
            if (exactMpnRows.length === 0 &&
                !candidates.some((row) => row.source === 'oem_catalog_lookup') &&
                !this.hasPartSpecificYearRange(candidates, targetVehicleMake, targetVehicleModel, product.mpn?.trim() || product.oemPartNumber)) {
                manualReviewReasons.push('No exact-part source returned a complete year range; verify the application from an authoritative catalog before adding one.');
            }
        }
        if (candidates.length > 0 &&
            !candidates.some((row) => ['ebay_mpn_lookup', 'oem_catalog_lookup'].includes(row.source)) &&
            this.mvlExpander.getExpansionMode() !== 'ai') {
            const first = candidates[0];
            const donorYear = (0, mvl_donor_scope_util_js_1.pickDonorYear)([
                first.year,
                ...candidates.slice(0, 5).map((c) => c.year),
            ]);
            if (first.make && first.model && donorYear) {
                try {
                    const mvlResult = await this.mvlExpander.expand({
                        donor: {
                            year: String(donorYear),
                            make: first.make,
                            model: first.model,
                        },
                        partType: product.partType ?? undefined,
                        placement: product.placement ?? undefined,
                        mpn: product.mpn ?? product.oemPartNumber ?? undefined,
                        profile: 'full',
                        marketplace: options?.marketplace,
                        treeId,
                    });
                    for (const row of mvlResult.expandedRows) {
                        candidates.push({
                            year: row.year,
                            make: row.make,
                            model: row.model,
                            trim: row.trim,
                            engine: row.engine,
                            confidence: row.source === 'platform_generation' ? 0.88 : 0.75,
                            source: `mvl_${row.source}`,
                            validationStatus: 'needs_review',
                            notes: row.notes,
                        });
                    }
                    manualReviewReasons.push(...mvlResult.manualReviewReasons);
                }
                catch (err) {
                    this.logger.warn(`MVL expansion failed for ${first.make}/${first.model}: ${err instanceof Error ? err.message : err}`);
                }
            }
            else if (first.make && first.model && !donorYear) {
                manualReviewReasons.push('Make/model known but donor year missing — skipped full-model MVL expansion');
            }
        }
        if (donorVin && candidates.length === 0) {
            try {
                const decoded = await this.vinDecode.decode(donorVin);
                donorVinDecoded = decoded;
                if (decoded.year && decoded.make && decoded.model) {
                    candidates.push({
                        year: decoded.year,
                        make: decoded.make,
                        model: decoded.model,
                        trim: decoded.trim || undefined,
                        engine: this.formatEngine(decoded),
                        drivetrain: decoded.driveType || undefined,
                        bodyType: decoded.bodyClass || undefined,
                        confidence: 0.55,
                        source: 'donor_vin_nhtsa',
                        validationStatus: 'needs_review',
                        notes: 'Donor vehicle from VIN decode — verify part fits this vehicle',
                    });
                    manualReviewReasons.push('Fitment includes donor vehicle only from VIN decode');
                    if (candidates.length <= 1 &&
                        this.mvlExpander.getExpansionMode() !== 'ai') {
                        const mvlResult = await this.mvlExpander.expand({
                            donor: {
                                year: decoded.year,
                                make: decoded.make,
                                model: decoded.model,
                                trim: decoded.trim,
                                engine: this.formatEngine(decoded),
                                bodyClass: decoded.bodyClass,
                            },
                            partType: product.partType ?? undefined,
                            placement: product.placement ?? undefined,
                            mpn: product.mpn ?? product.oemPartNumber ?? undefined,
                            profile: 'full',
                            marketplace: options?.marketplace,
                            treeId,
                        });
                        for (const row of mvlResult.expandedRows) {
                            candidates.push({
                                year: row.year,
                                make: row.make,
                                model: row.model,
                                trim: row.trim,
                                engine: row.engine,
                                confidence: row.source === 'platform_generation' ? 0.88 : 0.75,
                                source: `mvl_${row.source}`,
                                validationStatus: 'needs_review',
                                notes: row.notes,
                            });
                        }
                        manualReviewReasons.push(...mvlResult.manualReviewReasons);
                        if (mvlResult.needsAiInterchange) {
                            manualReviewReasons.push('MVL expansion thin — AI interchange micro-lane recommended');
                        }
                    }
                }
            }
            catch (err) {
                this.logger.warn(`Donor VIN decode failed for ${donorVin}: ${String(err)}`);
                manualReviewReasons.push('Donor VIN could not be decoded');
            }
        }
        if (!product.oemPartNumber && !product.mpn) {
            manualReviewReasons.push('OEM/MPN missing — cannot verify interchange fitment');
        }
        const validated = await this.validateAgainstEbay(candidates, categoryId, treeId);
        const deduped = this.deduplicateFitments(validated);
        const validCount = deduped.filter((r) => r.validationStatus === 'valid').length;
        const onlyDonor = deduped.length > 0 &&
            deduped.every((r) => r.source === 'donor_vin_nhtsa' || r.source === 'user_donor_vehicle');
        if (deduped.length === 0) {
            return {
                status: 'needs_review',
                confidence: 0,
                rows: [],
                donorVinDecoded,
                donorVin,
                categorySupportsCompatibility,
                manualReviewReasons: [
                    ...manualReviewReasons,
                    'No verified compatibility rows — manual fitment review required',
                ],
                ebayCatalogCategoryId: null,
                ebayCatalogCategoryName: null,
            };
        }
        if (onlyDonor) {
            manualReviewReasons.push('Only donor vehicle known — do not assume broad interchange');
        }
        const avgConfidence = deduped.reduce((sum, r) => sum + r.confidence, 0) / deduped.length;
        const status = manualReviewReasons.length > 0 || onlyDonor
            ? 'needs_review'
            : validCount === 0
                ? 'needs_review'
                : 'completed';
        return {
            status,
            confidence: Math.round(avgConfidence * 100) / 100,
            rows: deduped,
            donorVinDecoded,
            donorVin,
            categorySupportsCompatibility,
            manualReviewReasons,
            ebayCatalogCategoryId: null,
            ebayCatalogCategoryName: null,
        };
    }
    candidatesFromTitle(product) {
        const sourceTitle = product.title?.trim() || '';
        const optimizedTitle = product.optimizedTitle?.trim() || '';
        let rows = this.candidatesFromTitleText(sourceTitle);
        if (rows.length === 0 && optimizedTitle && optimizedTitle !== sourceTitle) {
            rows = this.candidatesFromTitleText(optimizedTitle);
        }
        return rows;
    }
    candidatesFromTitleText(title) {
        if (!title)
            return [];
        const extracted = (0, extract_make_model_from_title_js_1.extractMakeModelFromTitle)(title);
        if (!extracted.make || !extracted.model)
            return [];
        const make = extracted.make;
        const model = extracted.model;
        const yearPrefix = title.match(/^(\d{4})(?:\s*-\s*(\d{4}))?\s+/);
        const rows = [];
        if (yearPrefix) {
            const start = parseInt(yearPrefix[1], 10);
            const end = yearPrefix[2] ? parseInt(yearPrefix[2], 10) : start;
            if (Number.isFinite(start) &&
                Number.isFinite(end) &&
                end >= start &&
                end - start <= mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN) {
                for (let y = start; y <= end; y++) {
                    rows.push({
                        year: String(y),
                        make,
                        model,
                        confidence: 0.5,
                        source: 'title_parse',
                        validationStatus: 'needs_review',
                        notes: 'Derived from listing title year range — verify compatibility',
                    });
                }
                return rows;
            }
            if (Number.isFinite(start) && end - start > mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN) {
                rows.push({
                    year: String(start),
                    make,
                    model,
                    confidence: 0.35,
                    source: 'title_parse',
                    validationStatus: 'needs_review',
                    notes: 'Title year range was over-wide (likely unscoped MVL dump) — using start year only',
                });
                return rows;
            }
        }
        const singleYear = title.match(/\b(19|20)\d{2}\b/);
        if (singleYear) {
            rows.push({
                year: singleYear[0],
                make,
                model,
                confidence: 0.48,
                source: 'title_parse',
                validationStatus: 'needs_review',
                notes: 'Derived from listing title — verify compatibility',
            });
        }
        return rows;
    }
    extractDonorVin(product) {
        if (product.donorVin?.trim()) {
            return product.donorVin.trim().toUpperCase();
        }
        const haystack = [product.title, product.description, product.sku]
            .filter(Boolean)
            .join(' ');
        const match = haystack.match(VIN_REGEX);
        return match?.[0]?.toUpperCase() ?? null;
    }
    hasCompleteYearRange(rows) {
        const yearsByVehicle = new Map();
        for (const row of rows) {
            if (row.validationStatus === 'rejected')
                continue;
            const year = Number(row.year);
            if (!Number.isInteger(year) ||
                year < 1900 ||
                year > new Date().getFullYear() + 2) {
                continue;
            }
            const key = `${row.make.trim().toLowerCase()}|${row.model.trim().toLowerCase()}|${row.trim?.trim().toLowerCase() ?? ''}`;
            const years = yearsByVehicle.get(key) ?? new Set();
            years.add(year);
            yearsByVehicle.set(key, years);
        }
        return [...yearsByVehicle.values()].some((years) => {
            const ordered = [...years].sort((a, b) => a - b);
            return (ordered.length >= 2 &&
                ordered.length <= mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN + 1 &&
                ordered[ordered.length - 1] - ordered[0] <= mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN &&
                ordered.every((year, index) => index === 0 || year === ordered[index - 1] + 1));
        });
    }
    hasPartSpecificYearRange(rows, targetMake, targetModel, expectedMpn) {
        const matchingRows = rows.filter((row) => {
            const exactOemTitleEvidence = row.source === 'oem_catalog_lookup' &&
                this.hasExactOemRangeNote(row.notes ?? '', expectedMpn);
            if (!['ebay_mpn_lookup', 'oem_catalog_lookup'].includes(row.source)) {
                return false;
            }
            if (row.mvlStatus !== 'valid' && !exactOemTitleEvidence)
                return false;
            if (targetMake &&
                !this.vehicleMakeMatches(targetMake, row.make, targetModel ?? '')) {
                return false;
            }
            if (targetModel &&
                !this.vehicleModelMatches(targetModel, row.model, row.trim)) {
                return false;
            }
            return true;
        });
        if (this.hasCompleteYearRange(matchingRows))
            return true;
        if (!expectedMpn || !targetMake || !targetModel)
            return false;
        return matchingRows.some((row) => row.source === 'oem_catalog_lookup' &&
            !!(0, exact_oem_year_range_util_js_1.findCitedExactOemYearRange)(rows, expectedMpn, { make: row.make, model: row.model, trim: row.trim }, mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN, new Date().getFullYear() + 2));
    }
    vehicleModelMatches(expected, model, trim) {
        const expectedTokens = this.modelTokens(expected);
        const actualTokens = new Set([
            ...this.modelTokens(model),
            ...this.modelTokens(trim ?? ''),
        ]);
        return (expectedTokens.length > 0 &&
            expectedTokens.every((token) => actualTokens.has(token)));
    }
    vehicleMakeMatches(expected, actual, vehicleModel) {
        const expectedKey = this.normalizeIdentifier(expected);
        const actualKey = this.normalizeIdentifier(actual);
        if (expectedKey === actualKey)
            return true;
        const isProwler = this.modelTokens(vehicleModel).includes('prowler');
        return (isProwler &&
            ['plymouth', 'chrysler'].includes(expectedKey) &&
            ['plymouth', 'chrysler'].includes(actualKey));
    }
    vehicleFromCombinedBrand(brand) {
        const match = brand?.trim().match(/^(Plymouth|Chrysler)\s+Prowler$/i);
        if (!match)
            return null;
        return {
            make: match[1].toLowerCase() === 'plymouth' ? 'Plymouth' : 'Chrysler',
            model: 'Prowler',
        };
    }
    hasExactOemRangeNote(notes, expectedMpn) {
        const expectedMpnKey = this.normalizeIdentifier(expectedMpn ?? '');
        const match = notes.match(/^\s*Exact MPN\s+([^\s]+)\s+matched\b/i);
        if (!expectedMpnKey ||
            !match ||
            this.normalizeIdentifier(match[1]) !== expectedMpnKey) {
            return false;
        }
        return notes.split(/\r?\n/).some((line) => /^\s*[-*•]\s*((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2})\s+\S+/i.test(line));
    }
    modelTokens(value) {
        return value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((token) => token.length > 0 &&
            !/^\d{4}$/.test(token) &&
            !/^mk\d+$/.test(token));
    }
    rowsFromOemCatalogLookup(result, mpn) {
        const sourceNote = [
            `Exact MPN ${mpn} matched to ${result.sourceTitle}`,
            result.sourceUrl,
            result.evidence,
        ]
            .filter(Boolean)
            .join('\n');
        const rows = [];
        const supportedYears = result.supportedYears?.length
            ? result.supportedYears
            : Array.from({ length: result.endYear - result.startYear + 1 }, (_, index) => result.startYear + index);
        for (const year of supportedYears) {
            rows.push({
                year: String(year),
                make: result.make,
                model: result.model,
                ...(result.trim ? { trim: result.trim } : {}),
                confidence: 0.85,
                source: 'oem_catalog_lookup',
                validationStatus: 'needs_review',
                reviewOnly: true,
                notes: `${sourceNote}. OEM evidence guides the title only; verify VIN/options before approving compatibility.`,
            });
        }
        return rows;
    }
    async normalizeOemCatalogModelToMvl(result, targetModel, categoryId, treeId) {
        const targetTokens = this.modelTokens(targetModel);
        const citedVehicleTokens = new Set([
            ...this.modelTokens(result.model),
            ...this.modelTokens(result.trim ?? ''),
        ]);
        if (targetTokens.length === 0 ||
            !targetTokens.every((token) => citedVehicleTokens.has(token))) {
            return null;
        }
        const direct = await this.mvl.resolveCanonicalMakeModel(categoryId, result.make, result.model, treeId);
        if (direct.mvlMatched &&
            direct.make &&
            direct.model &&
            this.vehicleModelMatches(targetModel, direct.model, result.trim)) {
            return {
                ...result,
                make: direct.make,
                model: direct.model,
            };
        }
        const make = direct.make ?? result.make;
        const modelOptions = await this.mvl.getModels(categoryId, make, undefined, 5000, 0, treeId);
        const targetModelTokens = this.modelTokens(targetModel);
        const canonicalModel = modelOptions.options
            .map((option) => ({ value: option.value, tokens: this.modelTokens(option.value) }))
            .filter((option) => option.tokens.length > 0 &&
            option.tokens.length <= targetModelTokens.length &&
            option.tokens.every((token, index) => targetModelTokens[index] === token))
            .sort((left, right) => right.tokens.length - left.tokens.length)[0];
        if (!canonicalModel)
            return null;
        const canonicalTokens = new Set(canonicalModel.tokens);
        const targetWords = this.modelWords(targetModel);
        const sourceWords = [
            ...this.modelWords(result.model),
            ...this.modelWords(result.trim ?? ''),
        ];
        const trimWords = [];
        const trimTokens = new Set();
        for (const word of [...targetWords.slice(canonicalModel.tokens.length), ...sourceWords]) {
            const token = this.normalizeIdentifier(word);
            if (token.length <= 1 ||
                canonicalTokens.has(token) ||
                trimTokens.has(token)) {
                continue;
            }
            trimTokens.add(token);
            trimWords.push(word);
        }
        const trim = trimWords.join(' ') || undefined;
        if (!this.vehicleModelMatches(targetModel, canonicalModel.value, trim)) {
            return null;
        }
        return {
            ...result,
            make,
            model: canonicalModel.value,
            ...(trim ? { trim } : {}),
        };
    }
    modelWords(value) {
        return value
            .split(/[^a-z0-9]+/i)
            .map((word) => word.trim())
            .filter((word) => word.length > 0 &&
            !/^\d{4}$/.test(word) &&
            !/^mk\d+$/i.test(word));
    }
    rowsFromExactMpnLookup(items, expectedBrand, expectedMpn, targetMake, targetModel) {
        const expectedBrandKey = this.normalizeIdentifier(expectedBrand);
        const expectedMpnKey = this.normalizeIdentifier(expectedMpn);
        const rows = [];
        for (const item of items) {
            const actualBrand = item.brand ??
                this.findAspectValue(item.aspects, ['Brand', 'Manufacturer']);
            const actualMpn = item.mpn ??
                this.findAspectValue(item.aspects, [
                    'Manufacturer Part Number',
                    'MPN',
                    'Part Number',
                    'OE/OEM Part Number',
                ]);
            if (!actualBrand ||
                !actualMpn ||
                this.normalizeIdentifier(actualBrand) !== expectedBrandKey ||
                this.normalizeIdentifier(actualMpn) !== expectedMpnKey) {
                continue;
            }
            for (const hint of item.fitmentHints) {
                const make = hint.make?.trim();
                const model = hint.model?.trim();
                if (!make ||
                    !model ||
                    this.normalizeIdentifier(make) !== this.normalizeIdentifier(targetMake) ||
                    !this.vehicleModelMatches(targetModel, model)) {
                    continue;
                }
                for (const year of this.expandHintYears(hint.year)) {
                    rows.push({
                        year,
                        make,
                        model,
                        confidence: 0.6,
                        source: 'ebay_mpn_lookup',
                        validationStatus: 'needs_review',
                        notes: `Seller-reported fitment hint from ${item.itemWebUrl || `eBay item ${item.itemId}`}; exact Brand+MPN matched, but part-specific application still requires review.`,
                    });
                }
            }
        }
        return rows;
    }
    expandHintYears(value) {
        if (!value)
            return [];
        const match = value.trim().match(/^(\d{4})(?:\s*[-–—]\s*(\d{4}))?$/);
        if (!match)
            return [];
        const start = Number(match[1]);
        const end = Number(match[2] ?? match[1]);
        const maxYear = new Date().getFullYear() + 2;
        if (start < 1900 ||
            end < start ||
            end > maxYear ||
            end - start > mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN) {
            return [];
        }
        return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
    }
    normalizeIdentifier(value) {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }
    findAspectValue(aspects, names) {
        const wanted = new Set(names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')));
        for (const [name, values] of Object.entries(aspects)) {
            if (!wanted.has(name.toLowerCase().replace(/[^a-z0-9]/g, '')))
                continue;
            const value = values.find((candidate) => candidate.trim());
            if (value)
                return value.trim();
        }
        return null;
    }
    browseMarketplaceId(marketplace) {
        switch (marketplace?.toUpperCase()) {
            case 'AU':
                return 'EBAY_AU';
            case 'DE':
                return 'EBAY_DE';
            default:
                return 'EBAY_US';
        }
    }
    rowFromRaw(raw, source) {
        const make = this.rawString(raw['Make'] ?? raw['make']);
        const model = this.rawString(raw['Model'] ?? raw['model']);
        const year = this.rawString(raw['Year'] ?? raw['year']);
        if (!make || !model || !year)
            return null;
        const storedSource = this.rawString(raw['source']) || source;
        const storedStatus = this.rawString(raw['validationStatus']).toLowerCase();
        const storedMvlStatus = this.rawString(raw['mvlStatus'] ?? raw['MvlStatus']).toLowerCase();
        const storedStatuses = [storedStatus, storedMvlStatus];
        const validationStatus = storedStatuses.includes('rejected')
            ? 'rejected'
            : storedStatuses.includes('needs_review')
                ? 'needs_review'
                : storedStatuses.includes('valid')
                    ? 'valid'
                    : 'needs_review';
        const reviewOnly = raw['reviewOnly'] === true ||
            (storedStatus === 'needs_review' && storedMvlStatus === 'valid');
        return {
            year,
            make,
            model,
            trim: this.rawString(raw['Trim'] ?? raw['trim']) || undefined,
            engine: this.rawString(raw['Engine'] ?? raw['engine']) || undefined,
            drivetrain: this.rawString(raw['Drivetrain'] ?? raw['drivetrain']) || undefined,
            bodyType: this.rawString(raw['Body Style'] ?? raw['bodyStyle']) || undefined,
            position: this.rawString(raw['Position'] ?? raw['position']) || undefined,
            notes: this.rawString(raw['Notes'] ?? raw['notes']) || undefined,
            confidence: Number(raw['confidence'] ?? raw['Confidence'] ?? 0.82),
            source: storedSource,
            validationStatus,
            ...(reviewOnly ? { reviewOnly: true } : {}),
            ...(raw['rejectedReason']
                ? { rejectedReason: this.rawString(raw['rejectedReason']) }
                : {}),
            ...(storedMvlStatus === 'valid'
                ? { mvlStatus: 'valid' }
                : storedMvlStatus === 'rejected'
                    ? { mvlStatus: 'rejected' }
                    : storedMvlStatus === 'needs_review'
                        ? { mvlStatus: 'needs_review' }
                        : {}),
        };
    }
    rawString(value) {
        if (typeof value === 'string' || typeof value === 'number') {
            return String(value).trim();
        }
        return '';
    }
    formatEngine(decoded) {
        const parts = [decoded.engineDisplacementL, decoded.engineCylinders]
            .filter(Boolean)
            .join(' ');
        return parts || undefined;
    }
    async validateAgainstEbay(rows, categoryId, treeId = '0') {
        if (rows.length === 0)
            return [];
        const indicesToValidate = [];
        const parsed = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.validationStatus === 'rejected')
                continue;
            indicesToValidate.push(i);
            parsed.push({
                year: row.year,
                make: row.make,
                model: row.model,
                trim: row.trim,
                engine: row.engine,
                notes: row.notes,
            });
        }
        const validated = await this.mvl.validateParsedRows(parsed, categoryId, treeId);
        const validationByIndex = new Map();
        indicesToValidate.forEach((rowIndex, vi) => {
            validationByIndex.set(rowIndex, validated[vi]);
        });
        return rows.map((row, i) => {
            if (row.validationStatus === 'rejected')
                return row;
            const result = validationByIndex.get(i);
            if (!result) {
                return {
                    ...row,
                    validationStatus: 'rejected',
                    mvlStatus: 'rejected',
                    rejectedReason: 'Could not parse fitment row',
                    confidence: 0,
                };
            }
            if (result.status === 'rejected') {
                return {
                    ...row,
                    make: result.row.make,
                    model: result.row.model,
                    validationStatus: 'rejected',
                    mvlStatus: 'rejected',
                    rejectedReason: result.rejectedReason,
                    confidence: 0,
                };
            }
            if (result.status === 'needs_review') {
                return {
                    ...row,
                    make: result.row.make,
                    model: result.row.model,
                    year: result.row.year,
                    validationStatus: 'needs_review',
                    mvlStatus: 'needs_review',
                    rejectedReason: result.rejectedReason,
                    confidence: Math.min(row.confidence, 0.5),
                };
            }
            const reviewOnly = row.reviewOnly ||
                row.source === 'donor_vin_nhtsa' ||
                row.source === 'ebay_mpn_lookup' ||
                row.source === 'user_donor_vehicle';
            return {
                ...row,
                make: result.row.make,
                model: result.row.model,
                year: result.row.year,
                validationStatus: reviewOnly ? 'needs_review' : 'valid',
                mvlStatus: 'valid',
                confidence: reviewOnly ? row.confidence : 0.9,
            };
        });
    }
    deduplicateFitments(rows) {
        const seen = new Set();
        const out = [];
        for (const row of rows) {
            const key = `${row.year}|${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push(row);
        }
        return out;
    }
    toFitmentDataJson(rows) {
        return rows
            .filter((r) => r.validationStatus === 'valid')
            .map((r) => ({
            Year: r.year,
            Make: r.make,
            Model: r.model,
            ...(r.trim ? { Trim: r.trim } : {}),
            ...(r.engine ? { Engine: r.engine } : {}),
            ...(r.notes ? { Notes: r.notes } : {}),
            Source: r.source,
            Confidence: r.confidence,
            MvlStatus: 'valid',
            validationStatus: 'valid',
        }));
    }
};
exports.FitmentDiscoveryService = FitmentDiscoveryService;
exports.FitmentDiscoveryService = FitmentDiscoveryService = FitmentDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [vin_decode_service_js_1.VinDecodeService,
        ebay_mvl_service_js_1.EbayMvlService,
        mvl_fitment_expander_service_js_1.MvlFitmentExpanderService,
        ebay_browse_api_service_js_1.EbayBrowseApiService,
        oem_fitment_lookup_service_js_1.OemFitmentLookupService])
], FitmentDiscoveryService);
//# sourceMappingURL=fitment-discovery.service.js.map