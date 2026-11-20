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
var EbayMvlService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayMvlService = void 0;
const common_1 = require("@nestjs/common");
const ebay_taxonomy_api_service_js_1 = require("../channels/ebay/ebay-taxonomy-api.service.js");
const fitment_mvl_util_js_1 = require("./fitment-mvl.util.js");
const ebay_mvl_marketplace_util_js_1 = require("./ebay-mvl-marketplace.util.js");
const ebay_mvl_store_service_js_1 = require("./ebay-mvl-store.service.js");
class MvlValueCache {
    makes = new Map();
    models = new Map();
    years = new Map();
    makeKey(categoryId) {
        return categoryId;
    }
    modelKey(categoryId, make) {
        return `${categoryId}|${make.toLowerCase()}`;
    }
    yearKey(categoryId, make, model) {
        return `${categoryId}|${make.toLowerCase()}|${model.toLowerCase()}`;
    }
    hasMakeList(categoryId) {
        return this.makes.has(this.makeKey(categoryId));
    }
    hasModelList(categoryId, make) {
        return this.models.has(this.modelKey(categoryId, make));
    }
    hasYearList(categoryId, make, model) {
        return this.years.has(this.yearKey(categoryId, make, model));
    }
    setMakes(categoryId, values) {
        this.makes.set(this.makeKey(categoryId), new Set(values.map((v) => v.toLowerCase())));
    }
    setModels(categoryId, make, values) {
        this.models.set(this.modelKey(categoryId, make), new Set(values.map((v) => v.toLowerCase())));
    }
    setYears(categoryId, make, model, values) {
        this.years.set(this.yearKey(categoryId, make, model), new Set(values));
    }
    hasMake(categoryId, make) {
        return (this.makes.get(this.makeKey(categoryId))?.has(make.toLowerCase()) ?? false);
    }
    hasModel(categoryId, make, model) {
        return (this.models
            .get(this.modelKey(categoryId, make))
            ?.has(model.toLowerCase()) ?? false);
    }
    hasYear(categoryId, make, model, year) {
        return (this.years.get(this.yearKey(categoryId, make, model))?.has(year) ?? false);
    }
}
let EbayMvlService = class EbayMvlService {
    static { EbayMvlService_1 = this; }
    taxonomyApi;
    store;
    logger = new common_1.Logger(EbayMvlService_1.name);
    static DEFAULT_TREE_ID = '0';
    static MOTORS_PARTS_CATEGORY = '6000';
    constructor(taxonomyApi, store) {
        this.taxonomyApi = taxonomyApi;
        this.store = store;
    }
    async fetchCompatibilityTree(categoryId, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        this.logger.debug(`Fetching compatibility tree for category ${categoryId}`);
        const rawProps = await this.taxonomyApi.getCompatibilityProperties(treeId, categoryId);
        const properties = rawProps.map((p) => ({
            propertyName: p.propertyName,
            localizedPropertyName: p.localizedPropertyName ?? p.propertyName,
        }));
        return {
            categoryId,
            categoryTreeId: treeId,
            properties,
        };
    }
    async getPropertyValues(categoryId, propertyName, filters = {}, query, limit = 100, offset = 0, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        this.logger.debug(`Fetching ${propertyName} values for category ${categoryId} with filters: ${JSON.stringify(filters)}`);
        const marketplace = (0, ebay_mvl_marketplace_util_js_1.resolveMvlMarketplaceFromTreeId)(treeId);
        if (await this.store.hasActiveRelease(marketplace)) {
            return this.store.getPropertyValues(marketplace, propertyName, filters, query, limit, offset);
        }
        return this.getPropertyValuesFromApi(categoryId, propertyName, filters, query, limit, offset, treeId);
    }
    async getPropertyValuesFromApi(categoryId, propertyName, filters = {}, query, limit = 100, offset = 0, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        const rawValues = await this.taxonomyApi.getCompatibilityPropertyValues(treeId, categoryId, propertyName, Object.keys(filters).length > 0 ? filters : undefined);
        let options = rawValues.map((v) => ({
            label: v.value,
            value: v.value,
        }));
        if (query) {
            const q = query.toLowerCase();
            options = options.filter((o) => o.label.toLowerCase().includes(q));
        }
        options.sort((a, b) => {
            const aNum = Number(a.value);
            const bNum = Number(b.value);
            if (!isNaN(aNum) && !isNaN(bNum))
                return bNum - aNum;
            return a.label.localeCompare(b.label);
        });
        const paginated = options.slice(offset, offset + limit);
        return {
            options: paginated,
            hasMore: offset + limit < options.length,
        };
    }
    buildCompatibilityArray(selections) {
        return selections.map((s) => {
            const properties = [
                { name: 'Make', value: s.make },
                { name: 'Model', value: s.model },
                { name: 'Year', value: s.year },
            ];
            if (s.trim) {
                properties.push({ name: 'Trim', value: s.trim });
            }
            if (s.engine) {
                properties.push({ name: 'Engine', value: s.engine });
            }
            return {
                compatibilityProperties: properties,
                ...(s.notes ? { notes: s.notes } : {}),
            };
        });
    }
    async getMakes(categoryId, query, limit = 50, offset = 0, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        return this.getPropertyValues(categoryId, 'Make', {}, query, limit, offset, treeId);
    }
    async getModels(categoryId, make, query, limit = 50, offset = 0, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        return this.getPropertyValues(categoryId, 'Model', { Make: make }, query, limit, offset, treeId);
    }
    async getYears(categoryId, make, model, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        return this.getPropertyValues(categoryId, 'Year', {
            Make: make,
            Model: model,
        }, undefined, 100, 0, treeId);
    }
    async resolveCanonicalMakeModel(categoryId, make, model, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        const makeQuery = make.trim();
        if (!makeQuery)
            return { mvlMatched: false };
        const marketplace = (0, ebay_mvl_marketplace_util_js_1.resolveMvlMarketplaceFromTreeId)(treeId);
        try {
            if (await this.store.hasActiveRelease(marketplace)) {
                return this.store.resolveCanonicalMakeModel(marketplace, makeQuery, model);
            }
            const makes = await this.getMakes(categoryId, makeQuery, 100, 0, treeId);
            const canonicalMake = this.pickCanonical(makes.options, makeQuery);
            if (!canonicalMake)
                return { mvlMatched: false };
            if (!model?.trim()) {
                return { make: canonicalMake, mvlMatched: true };
            }
            const models = await this.getModels(categoryId, canonicalMake, model.trim(), 100, 0, treeId);
            const canonicalModel = this.pickCanonical(models.options, model.trim());
            return {
                make: canonicalMake,
                model: canonicalModel ?? model.trim(),
                mvlMatched: Boolean(canonicalModel),
            };
        }
        catch (err) {
            this.logger.debug(`MVL canonicalization skipped: ${err instanceof Error ? err.message : err}`);
            return { make: makeQuery, model: model?.trim(), mvlMatched: false };
        }
    }
    async validateFitmentData(fitmentData, categoryId, options) {
        const empty = {
            accepted: [],
            rejectedCount: 0,
            needsReviewCount: 0,
            validCount: 0,
            apiUnavailable: false,
        };
        if (!Array.isArray(fitmentData) || fitmentData.length === 0)
            return empty;
        const parsedRows = [];
        let parseRejected = 0;
        for (const raw of fitmentData) {
            const parsed = (0, fitment_mvl_util_js_1.parseFitmentEntry)(raw);
            if (parsed)
                parsedRows.push(parsed);
            else
                parseRejected++;
        }
        const keepNeedsReview = options?.keepNeedsReview !== false;
        const treeId = options?.treeId ?? EbayMvlService_1.DEFAULT_TREE_ID;
        const validated = await this.validateParsedRows(parsedRows, categoryId, treeId);
        const accepted = [];
        let rejectedCount = parseRejected;
        let needsReviewCount = 0;
        let validCount = 0;
        const apiUnavailable = validated.some((v) => v.rejectedReason === 'eBay MVL API unavailable');
        for (const result of validated) {
            if (result.status === 'rejected') {
                rejectedCount++;
                continue;
            }
            if (result.status === 'needs_review') {
                needsReviewCount++;
                if (!keepNeedsReview)
                    continue;
            }
            else {
                validCount++;
            }
            accepted.push(result.serialized);
        }
        return {
            accepted,
            rejectedCount,
            needsReviewCount,
            validCount,
            apiUnavailable,
        };
    }
    async validateParsedRows(rows, categoryId, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        if (rows.length === 0)
            return [];
        const marketplace = (0, ebay_mvl_marketplace_util_js_1.resolveMvlMarketplaceFromTreeId)(treeId);
        if (await this.store.hasActiveRelease(marketplace)) {
            return this.validateParsedRowsFromStore(rows, marketplace);
        }
        const cache = new MvlValueCache();
        const results = [];
        let consecutiveApiFailures = 0;
        const MAX_CONSECUTIVE_FAILURES = 5;
        let apiDisabled = false;
        for (const parsed of rows) {
            if (apiDisabled) {
                results.push({
                    row: parsed,
                    status: 'needs_review',
                    rejectedReason: 'eBay MVL API unavailable',
                    serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(parsed, 'needs_review', {
                        MvlRejectedReason: 'eBay MVL API unavailable',
                    }),
                });
                continue;
            }
            try {
                results.push(await this.validateSingleRowFromApi(parsed, categoryId, cache, treeId));
                consecutiveApiFailures = 0;
            }
            catch (err) {
                consecutiveApiFailures++;
                this.logger.warn(`MVL validation unavailable for ${parsed.make} ${parsed.model}: ${err instanceof Error ? err.message : err}`);
                if (consecutiveApiFailures >= MAX_CONSECUTIVE_FAILURES) {
                    apiDisabled = true;
                    this.logger.warn(`MVL circuit breaker triggered after ${consecutiveApiFailures} consecutive failures — skipping remaining rows`);
                }
                results.push({
                    row: parsed,
                    status: 'needs_review',
                    rejectedReason: 'eBay MVL API unavailable',
                    serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(parsed, 'needs_review', {
                        MvlRejectedReason: 'eBay MVL API unavailable',
                    }),
                });
            }
        }
        return results;
    }
    async validateSingleRowFromStore(parsed, marketplace) {
        let row = parsed;
        if (!(await this.store.hasMake(marketplace, row.make))) {
            const canonical = await this.store.resolveCanonicalMakeModel(marketplace, row.make);
            if (canonical.make)
                row = { ...row, make: canonical.make };
        }
        if (!(await this.store.hasMake(marketplace, row.make))) {
            return {
                row,
                status: 'rejected',
                rejectedReason: `Make "${row.make}" not found in eBay MVL`,
                serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'rejected', {
                    MvlRejectedReason: `Make "${row.make}" not found in eBay MVL`,
                    MvlSource: 'database',
                }),
            };
        }
        if (!(await this.store.hasModel(marketplace, row.make, row.model))) {
            const resolved = await this.store.resolveCanonicalMakeModel(marketplace, row.make, row.model);
            if (resolved.model)
                row = { ...row, model: resolved.model };
        }
        if (!(await this.store.hasModel(marketplace, row.make, row.model))) {
            return {
                row,
                status: 'rejected',
                rejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
                serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'rejected', {
                    MvlRejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
                    MvlSource: 'database',
                }),
            };
        }
        if (!(await this.store.hasYear(marketplace, row.make, row.model, row.year))) {
            return {
                row,
                status: 'needs_review',
                rejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
                serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'needs_review', {
                    MvlRejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
                    MvlSource: 'database',
                }),
            };
        }
        return {
            row,
            status: 'valid',
            serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'valid', {
                MvlSource: 'database',
            }),
        };
    }
    async validateParsedRowsFromStore(rows, marketplace) {
        const concurrency = Math.max(1, Number(process.env.MVL_VALIDATION_CONCURRENCY ?? '6') || 6);
        const makes = rows.map((r) => r.make);
        const models = rows.map((r) => r.model);
        const years = rows.map((r) => r.year);
        const statuses = new Array(rows.length).fill('valid');
        const reasons = new Array(rows.length).fill('');
        const uniqueMakes = [
            ...new Set(makes.map((m) => m.trim()).filter((m) => m.length > 0)),
        ];
        const existingMakes = await this.store.batchExistingMakes(marketplace, uniqueMakes);
        const makesNeedingCanonical = new Set();
        for (let i = 0; i < rows.length; i++) {
            const mkLower = makes[i].trim().toLowerCase();
            if (mkLower && !existingMakes.has(mkLower)) {
                makesNeedingCanonical.add(makes[i].trim());
            }
        }
        if (makesNeedingCanonical.size > 0) {
            const canonicalResults = await this.mapWithConcurrency([...makesNeedingCanonical], concurrency, async (make) => {
                const result = await this.store.resolveCanonicalMakeModel(marketplace, make);
                return { original: make, canonical: result.make };
            });
            for (const { original, canonical } of canonicalResults) {
                if (!canonical)
                    continue;
                for (let i = 0; i < rows.length; i++) {
                    if (makes[i].trim().toLowerCase() === original.toLowerCase()) {
                        makes[i] = canonical;
                    }
                }
            }
            const recheckMakes = [
                ...new Set(makes
                    .map((m) => m.trim())
                    .filter((m) => m.length > 0 && !existingMakes.has(m.toLowerCase()))),
            ];
            if (recheckMakes.length > 0) {
                const additional = await this.store.batchExistingMakes(marketplace, recheckMakes);
                for (const m of additional)
                    existingMakes.add(m);
            }
        }
        for (let i = 0; i < rows.length; i++) {
            const mkLower = makes[i].trim().toLowerCase();
            if (!mkLower || !existingMakes.has(mkLower)) {
                statuses[i] = 'rejected';
                reasons[i] = `Make "${makes[i]}" not found in eBay MVL`;
            }
        }
        const modelCheckIdx = rows
            .map((_, i) => i)
            .filter((i) => statuses[i] === 'valid');
        const uniquePairs = [];
        const seenPairs = new Set();
        for (const i of modelCheckIdx) {
            const make = makes[i].trim();
            const model = models[i].trim();
            if (!make || !model)
                continue;
            const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
            if (!seenPairs.has(key)) {
                seenPairs.add(key);
                uniquePairs.push({ make, model });
            }
        }
        const existingModels = await this.store.batchExistingModels(marketplace, uniquePairs);
        const modelsNeedingCanonical = new Set();
        for (const i of modelCheckIdx) {
            const make = makes[i].trim();
            const model = models[i].trim();
            if (!make || !model)
                continue;
            const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
            if (!existingModels.has(key)) {
                modelsNeedingCanonical.add(`${make}|${model}`);
            }
        }
        if (modelsNeedingCanonical.size > 0) {
            const canonicalResults = await this.mapWithConcurrency([...modelsNeedingCanonical], concurrency, async (pair) => {
                const [make, model] = pair.split('|');
                const result = await this.store.resolveCanonicalMakeModel(marketplace, make, model);
                return {
                    pair,
                    canonicalModel: result.model,
                    canonicalMake: result.make,
                };
            });
            for (const { pair, canonicalModel, canonicalMake } of canonicalResults) {
                if (!canonicalModel)
                    continue;
                const [origMake, origModel] = pair.split('|');
                for (const i of modelCheckIdx) {
                    if (makes[i].trim().toLowerCase() === origMake.toLowerCase() &&
                        models[i].trim().toLowerCase() === origModel.toLowerCase()) {
                        models[i] = canonicalModel;
                        if (canonicalMake)
                            makes[i] = canonicalMake;
                    }
                }
            }
            const recheckPairs = [];
            const recheckSeen = new Set();
            for (const i of modelCheckIdx) {
                const make = makes[i].trim();
                const model = models[i].trim();
                if (!make || !model)
                    continue;
                const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
                if (!existingModels.has(key) && !recheckSeen.has(key)) {
                    recheckSeen.add(key);
                    recheckPairs.push({ make, model });
                }
            }
            if (recheckPairs.length > 0) {
                const additional = await this.store.batchExistingModels(marketplace, recheckPairs);
                for (const m of additional)
                    existingModels.add(m);
            }
        }
        for (const i of modelCheckIdx) {
            const make = makes[i].trim();
            const model = models[i].trim();
            const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
            if (!make || !model || !existingModels.has(key)) {
                statuses[i] = 'rejected';
                reasons[i] =
                    `Model "${models[i]}" not valid for Make "${makes[i]}" on eBay MVL`;
            }
        }
        const yearCheckIdx = modelCheckIdx.filter((i) => statuses[i] === 'valid');
        const uniqueTriples = [];
        const seenTriples = new Set();
        for (const i of yearCheckIdx) {
            const make = makes[i].trim();
            const model = models[i].trim();
            const year = years[i];
            const key = `${make.toLowerCase()}|${model.toLowerCase()}|${year}`;
            if (!seenTriples.has(key)) {
                seenTriples.add(key);
                uniqueTriples.push({ make, model, year });
            }
        }
        const existingYears = await this.store.batchExistingYears(marketplace, uniqueTriples);
        for (const i of yearCheckIdx) {
            const make = makes[i].trim();
            const model = models[i].trim();
            const key = `${make.toLowerCase()}|${model.toLowerCase()}|${years[i]}`;
            if (!existingYears.has(key)) {
                statuses[i] = 'needs_review';
                reasons[i] =
                    `Year ${years[i]} not listed for ${makes[i]} ${models[i]} on eBay MVL`;
            }
        }
        return rows.map((original, i) => {
            const row = {
                ...original,
                make: makes[i],
                model: models[i],
            };
            const extra = { MvlSource: 'database' };
            if (reasons[i])
                extra.MvlRejectedReason = reasons[i];
            return {
                row,
                status: statuses[i],
                rejectedReason: reasons[i] || undefined,
                serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, statuses[i], extra),
            };
        });
    }
    async mapWithConcurrency(items, concurrency, fn) {
        const results = new Array(items.length);
        let nextIndex = 0;
        const worker = async () => {
            while (true) {
                const i = nextIndex++;
                if (i >= items.length)
                    return;
                results[i] = await fn(items[i]);
            }
        };
        await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
        return results;
    }
    async validateSingleRowFromApi(parsed, categoryId, cache, treeId = EbayMvlService_1.DEFAULT_TREE_ID) {
        if (!cache.hasMakeList(categoryId)) {
            const makes = await this.getMakes(categoryId, undefined, 5000, 0, treeId);
            cache.setMakes(categoryId, makes.options.map((o) => o.value));
        }
        let row = parsed;
        if (!cache.hasMake(categoryId, row.make)) {
            const canonical = await this.resolveCanonicalMakeModel(categoryId, row.make, undefined, treeId);
            if (canonical.make)
                row = { ...row, make: canonical.make };
        }
        if (!cache.hasMake(categoryId, row.make)) {
            return {
                row,
                status: 'rejected',
                rejectedReason: `Make "${row.make}" not found in eBay MVL`,
                serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'rejected', {
                    MvlRejectedReason: `Make "${row.make}" not found in eBay MVL`,
                }),
            };
        }
        if (!cache.hasModelList(categoryId, row.make)) {
            const models = await this.getModels(categoryId, row.make, undefined, 5000, 0, treeId);
            cache.setModels(categoryId, row.make, models.options.map((o) => o.value));
        }
        if (!cache.hasModel(categoryId, row.make, row.model)) {
            const resolved = await this.resolveCanonicalMakeModel(categoryId, row.make, row.model, treeId);
            if (resolved.model)
                row = { ...row, model: resolved.model };
        }
        if (!cache.hasModel(categoryId, row.make, row.model)) {
            return {
                row,
                status: 'rejected',
                rejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
                serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'rejected', {
                    MvlRejectedReason: `Model "${row.model}" not valid for Make "${row.make}" on eBay MVL`,
                }),
            };
        }
        if (!cache.hasYearList(categoryId, row.make, row.model)) {
            const years = await this.getYears(categoryId, row.make, row.model, treeId);
            cache.setYears(categoryId, row.make, row.model, years.options.map((o) => o.value));
        }
        if (!cache.hasYear(categoryId, row.make, row.model, row.year)) {
            return {
                row,
                status: 'needs_review',
                rejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
                serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'needs_review', {
                    MvlRejectedReason: `Year ${row.year} not listed for ${row.make} ${row.model} on eBay MVL`,
                }),
            };
        }
        return {
            row,
            status: 'valid',
            serialized: (0, fitment_mvl_util_js_1.serializeValidatedFitmentRow)(row, 'valid'),
        };
    }
    pickCanonical(options, query) {
        return (0, fitment_mvl_util_js_1.pickCanonicalPropertyValue)(options, query);
    }
};
exports.EbayMvlService = EbayMvlService;
exports.EbayMvlService = EbayMvlService = EbayMvlService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_taxonomy_api_service_js_1.EbayTaxonomyApiService,
        ebay_mvl_store_service_js_1.EbayMvlStoreService])
], EbayMvlService);
//# sourceMappingURL=ebay-mvl.service.js.map