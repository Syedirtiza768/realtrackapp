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
var MvlFitmentExpanderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MvlFitmentExpanderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const ebay_mvl_store_service_js_1 = require("./ebay-mvl-store.service.js");
const mvl_fitment_expander_util_js_1 = require("./mvl-fitment-expander.util.js");
const ebay_mvl_marketplace_util_js_1 = require("./ebay-mvl-marketplace.util.js");
const SHARED_PLATFORMS = {
    'Volkswagen|Golf': ['Audi|A3', 'Volkswagen|Jetta'],
    'Audi|A3': ['Volkswagen|Golf', 'Volkswagen|Jetta'],
    'Toyota|Camry': ['Lexus|ES'],
    'Lexus|ES': ['Toyota|Camry'],
    'Toyota|RAV4': ['Lexus|NX'],
    'Lexus|NX': ['Toyota|RAV4'],
    'Honda|Accord': ['Acura|TLX'],
    'Acura|TLX': ['Honda|Accord'],
    'Chevrolet|Silverado': ['GMC|Sierra'],
    'GMC|Sierra': ['Chevrolet|Silverado'],
};
let MvlFitmentExpanderService = MvlFitmentExpanderService_1 = class MvlFitmentExpanderService {
    config;
    mvlStore;
    logger = new common_1.Logger(MvlFitmentExpanderService_1.name);
    platformRanges = null;
    constructor(config, mvlStore) {
        this.config = config;
        this.mvlStore = mvlStore;
    }
    getExpansionMode() {
        return (0, mvl_fitment_expander_util_js_1.resolveFitmentExpansionMode)(this.config.get('FITMENT_EXPANSION_MODE'));
    }
    loadPlatformRanges() {
        if (this.platformRanges)
            return this.platformRanges;
        const candidates = [
            (0, node_path_1.join)(process.cwd(), 'shared/automotive-platform-ranges.json'),
            (0, node_path_1.join)(process.cwd(), '../shared/automotive-platform-ranges.json'),
        ];
        for (const candidate of candidates) {
            if ((0, node_fs_1.existsSync)(candidate)) {
                this.platformRanges = JSON.parse((0, node_fs_1.readFileSync)(candidate, 'utf8'));
                return this.platformRanges;
            }
        }
        this.platformRanges = {};
        return this.platformRanges;
    }
    resolveMarketplace(marketplace, treeId) {
        if (marketplace) {
            const upper = marketplace.toUpperCase();
            if (['US', 'AU', 'DE', 'GB'].includes(upper)) {
                return upper;
            }
        }
        return (0, ebay_mvl_marketplace_util_js_1.resolveMvlMarketplaceFromTreeId)(treeId ?? '0');
    }
    async expand(input) {
        const mode = this.getExpansionMode();
        const manualReviewReasons = [];
        if (mode === 'ai') {
            return {
                status: 'needs_review',
                fitmentSource: 'ai',
                ranges: [],
                expandedRows: [],
                coverage: {
                    platformYears: 0,
                    siblingModels: 0,
                    crossVin: 0,
                    sharedPlatform: 0,
                    mvlRejected: 0,
                },
                needsAiInterchange: true,
                manualReviewReasons: [
                    'FITMENT_EXPANSION_MODE=ai — legacy AI fitment path',
                ],
            };
        }
        const profile = input.profile ?? 'full';
        const siblingMode = (0, mvl_fitment_expander_util_js_1.getSiblingExpansionMode)(this.config.get('FITMENT_SIBLING_EXPANSION'));
        const minRows = (0, mvl_fitment_expander_util_js_1.getFitmentMinMvlRows)(this.config.get('FITMENT_MIN_MVL_ROWS'));
        const aiInterchange = (0, mvl_fitment_expander_util_js_1.resolveFitmentAiInterchange)(this.config.get('FITMENT_AI_INTERCHANGE'));
        const mkt = this.resolveMarketplace(input.marketplace, input.treeId);
        const result = (0, mvl_fitment_expander_util_js_1.expandFitmentDeterministic)({
            donor: input.donor,
            partType: input.partType,
            placement: input.placement,
            profile,
            siblingMode,
            platformRanges: this.loadPlatformRanges(),
            sharedPlatforms: SHARED_PLATFORMS,
            resolveEbayModel: (make, model, trim) => ({
                model,
                trim: trim ?? '',
            }),
        });
        const generation = result.generation;
        if (generation && input.donor.make && input.donor.model) {
            const mvlYears = await this.mvlStore.queryYearsInRange(mkt, input.donor.make, result.expandedRows[0]?.model ?? input.donor.model, generation.start, generation.end);
            if (mvlYears.length > 0) {
                const mvlYearSet = new Set(mvlYears);
                result.expandedRows = result.expandedRows.filter((row) => {
                    if (row.source !== 'platform_generation')
                        return true;
                    const y = parseInt(row.year, 10);
                    if (mvlYearSet.has(y))
                        return true;
                    result.coverage.mvlRejected++;
                    return false;
                });
            }
            if (siblingMode !== 'off') {
                const tier = result.tier;
                if (tier === 'body' ||
                    tier === 'general' ||
                    siblingMode === 'aggressive') {
                    const models = await this.mvlStore.queryModelsInYearRange(mkt, input.donor.make, generation.start, generation.end);
                    const seen = new Set(result.expandedRows.map((r) => fitmentRowKey(r)));
                    const donorLower = input.donor.model.toLowerCase();
                    for (const entry of models) {
                        if (entry.model.toLowerCase() === donorLower)
                            continue;
                        if (siblingMode === 'conservative' && tier === 'general')
                            continue;
                        const lo = Math.max(generation.start, entry.minYear);
                        const hi = Math.min(generation.end, entry.maxYear);
                        for (let y = lo; y <= hi; y++) {
                            const row = {
                                year: String(y),
                                make: input.donor.make,
                                model: entry.model,
                                trim: '',
                                engine: '',
                                submodel: '',
                                bodyType: '',
                                notes: `Sibling model from MVL (${entry.model})`,
                                source: 'mvl_sibling',
                            };
                            if (addUniqueRow(result.expandedRows, seen, row)) {
                                result.coverage.siblingModels++;
                            }
                        }
                    }
                }
            }
        }
        const hints = input.interchangeHints ?? [];
        if (hints.length > 0) {
            const seen = new Set(result.expandedRows.map((r) => fitmentRowKey(r)));
            for (const hint of hints) {
                const make = String(hint['make'] ?? '').trim();
                const model = String(hint['model'] ?? '').trim();
                const yStart = parseInt(String(hint['yearStart'] ?? hint['year'] ?? ''), 10) || 0;
                const yEnd = parseInt(String(hint['yearEnd'] ?? yStart), 10) || yStart;
                if (!make || !model || !yStart)
                    continue;
                for (let y = yStart; y <= yEnd; y++) {
                    addUniqueRow(result.expandedRows, seen, {
                        year: String(y),
                        make,
                        model,
                        trim: String(hint['trim'] ?? ''),
                        engine: String(hint['engine'] ?? ''),
                        submodel: String(hint['chassisCode'] ?? ''),
                        bodyType: '',
                        notes: String(hint['reason'] ?? 'AI interchange hint'),
                        source: 'ai_interchange_hint',
                    });
                }
            }
        }
        const dbActive = await this.mvlStore.hasActiveRelease(mkt);
        let fitmentSource = 'mvl';
        if (dbActive) {
            const filtered = await this.mvlStore.filterRowsAgainstMvl(mkt, result.expandedRows);
            if (filtered.usedDb) {
                result.expandedRows = filtered.accepted;
                result.coverage.mvlRejected += filtered.rejectedCount;
                fitmentSource = filtered.rejectedCount > 0 ? 'mvl+filtered' : 'mvl';
            }
        }
        else if (this.config.get('FITMENT_MVL_REQUIRED', 'true') !== 'false') {
            manualReviewReasons.push('Local MVL release not loaded — fitment is platform-expanded only');
            fitmentSource = 'mvl_pending_db';
        }
        const needsAiInterchange = (0, mvl_fitment_expander_util_js_1.evaluateNeedsAiInterchange)(result.expandedRows.length, minRows, result.tier, aiInterchange);
        if (needsAiInterchange) {
            manualReviewReasons.push(`Fitment rows (${result.expandedRows.length}) below minimum (${minRows}) — interchange review recommended`);
        }
        result.ranges = (0, mvl_fitment_expander_util_js_1.collapseYearRanges)(result.expandedRows);
        return {
            status: manualReviewReasons.length > 0 || needsAiInterchange
                ? 'needs_review'
                : 'completed',
            fitmentSource,
            ranges: result.ranges,
            expandedRows: result.expandedRows,
            coverage: result.coverage,
            needsAiInterchange,
            manualReviewReasons,
        };
    }
};
exports.MvlFitmentExpanderService = MvlFitmentExpanderService;
exports.MvlFitmentExpanderService = MvlFitmentExpanderService = MvlFitmentExpanderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ebay_mvl_store_service_js_1.EbayMvlStoreService])
], MvlFitmentExpanderService);
function fitmentRowKey(row) {
    return `${row.year}|${row.make}|${row.model}|${row.trim ?? ''}|${row.engine ?? ''}`.toLowerCase();
}
function addUniqueRow(rows, seen, entry) {
    const key = fitmentRowKey(entry);
    if (seen.has(key))
        return false;
    seen.add(key);
    rows.push(entry);
    return true;
}
//# sourceMappingURL=mvl-fitment-expander.service.js.map