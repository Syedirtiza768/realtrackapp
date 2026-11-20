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
var OemFitmentLookupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OemFitmentLookupService = void 0;
const common_1 = require("@nestjs/common");
const openai_service_js_1 = require("../common/openai/openai.service.js");
const mvl_donor_scope_util_js_1 = require("../fitment/mvl-donor-scope.util.js");
const OEM_FITMENT_MODEL = 'openai/gpt-6-luna';
const NON_CATALOG_HOSTS = [
    /(^|\.)ebay\./i,
    /(^|\.)amazon\./i,
    /(^|\.)facebook\./i,
    /(^|\.)craigslist\./i,
    /(^|\.)mercari\./i,
    /(^|\.)offerup\./i,
    /(^|\.)reddit\./i,
    /(^|\.)youtube\./i,
    /(^|\.)wikipedia\./i,
    /(^|\.)instagram\./i,
    /(^|\.)tiktok\./i,
];
let OemFitmentLookupService = OemFitmentLookupService_1 = class OemFitmentLookupService {
    openAi;
    logger = new common_1.Logger(OemFitmentLookupService_1.name);
    activeLookups = 0;
    maxConcurrentLookups = 4;
    lookupWaiters = [];
    inFlightLookups = new Map();
    lookupCache = new Map();
    constructor(openAi) {
        this.openAi = openAi;
    }
    lookup(input) {
        const key = [
            input.marketplace,
            input.partBrand,
            input.mpn,
            input.vehicleMake,
            input.vehicleModel,
        ]
            .map((value) => this.normalizeIdentifier(value))
            .join('|');
        const cached = this.lookupCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return Promise.resolve(cached.result);
        }
        if (cached)
            this.lookupCache.delete(key);
        const inFlight = this.inFlightLookups.get(key);
        if (inFlight)
            return inFlight;
        const pending = this.lookupExactPart(input);
        this.inFlightLookups.set(key, pending);
        void pending.then((result) => {
            if (this.inFlightLookups.get(key) === pending) {
                this.inFlightLookups.delete(key);
            }
            this.lookupCache.set(key, {
                result,
                expiresAt: Date.now() + (result ? 24 * 60 * 60_000 : 15 * 60_000),
            });
        }, () => {
            if (this.inFlightLookups.get(key) === pending) {
                this.inFlightLookups.delete(key);
            }
        });
        return pending;
    }
    async lookupExactPart(input, alternateAttempt = false) {
        const retryAlternateSearch = () => !alternateAttempt
            ? this.lookupExactPart(input, true)
            : Promise.resolve(null);
        const response = await this.withLookupSlot(() => this.openAi.chat({
            model: OEM_FITMENT_MODEL,
            temperature: 0,
            maxTokens: alternateAttempt ? 2600 : 2200,
            jsonMode: true,
            webSearch: true,
            webSearchOptions: {
                engine: 'exa',
                maxResults: 5,
                maxUses: alternateAttempt ? 1 : 2,
                maxTotalResults: alternateAttempt ? 5 : 10,
                searchContextSize: 'medium',
            },
            reasoningEffort: 'minimal',
            costLane: 'oem-fitment-lookup',
            systemPrompt: [
                'Verify fitment for this exact complete OEM MPN using live web search. In the first attempt make two distinct searches: first the quoted complete MPN on its own with OEM/genuine catalog terms, then the exact MPN with the requested make/model/trim, part name, and fitment/application terms. Prefer manufacturer/authorized dealer catalogs; use a reputable catalog mirror only if its cited page shows the exact MPN and application.',
                /prowler/i.test(`${input.vehicleMake} ${input.vehicleModel}`)
                    ? 'For Plymouth/Chrysler Prowler parts, search the exact MPN in the year-specific Mopar factory diagrams at site:prowlercar.com/wp-content/uploads/2016/08/ and in exact-MPN product fitment pages. Search the available Prowler-Service-Catalog years 1997, 1999, 2000, and 2001; for 2002 use an exact-part catalog page with explicit fitment. Each cited factory page must show the exact MPN adjacent to the requested component. The Prowler model-year sequence is 1997, 1999, 2000, 2001, 2002 (there is no 1998 model year); cite exact-part evidence covering every year in that sequence between the proposed endpoints. A vehicle-generation heading alone is not a part application.'
                    : '',
                'The donor vehicle is only a search hint. Never infer years from a donor, model generation, seller title, MPN prefix, or an undocumented supersession.',
                'The same cited catalog page must support the exact MPN, requested model/trim, and its application years. An explicit interval is usable as shown. Multiple year-specific factory catalog pages may be combined only when each page identifies the requested model year and shows the exact MPN next to the requested component; require evidence for every actual model year in the resulting interval. Do not treat an MPN mentioned only as a replaced, superseded, or interchangeable number as the exact requested part unless the page explicitly ties that exact number to the application. Cap at a documented replacement part-number break.',
                'Catalog model labels can abbreviate a specific vehicle variant. In particular, a Volkswagen Golf GTI may be labeled Volkswagen GTI in a US fitment table; accept that alias only when the same exact-MPN page explicitly lists GTI and the requested GTI trim, and never extend it to generic Golf rows.',
                'Return only compact JSON: verified, partNumber, make, model, trim, startYear, endYear, sourceUrl, evidence, reason. Quote brief exact source text in evidence; use null years if the complete application is not explicit.',
                alternateAttempt
                    ? 'The two initial queries did not yield complete verified year coverage. Make one different exact-MPN search targeted at year-specific factory catalog PDFs and the OEM/dealer application page. For Prowler, query site:prowlercar.com/wp-content/uploads/2016/08/ with the exact MPN and requested component, then cite each year-specific service catalog that contains that part. Return compact JSON immediately. Do not repeat either initial query or broaden to a vehicle generation.'
                    : '',
            ].join('\n'),
            userPrompt: [
                `MPN (quote and search this exact complete identifier): "${input.mpn}" | Part brand: ${input.partBrand}`,
                `Verify vehicle: ${input.vehicleMake} ${input.vehicleModel} | Market: ${input.marketplace}`,
                input.partName ? `Part: ${input.partName}; catalog terms: ${this.catalogSearchTerms(input.partName)}` : '',
                alternateAttempt
                    ? 'Search the exact MPN with this requested vehicle and part name. Return full supported year endpoints, exact brief source excerpts, and a URL citation. Do not return one donor year or a broader generation range.'
                    : /prowler/i.test(`${input.vehicleMake} ${input.vehicleModel}`)
                        ? 'Use two different queries: first the exact quoted MPN and part name on site:prowlercar.com/wp-content/uploads/2016/08/ to find year-specific factory diagrams; second the exact MPN with Plymouth/Chrysler Prowler fitment and full year endpoints. Cite every service-catalog model year where the same part row appears, plus exact OEM/dealer evidence for the endpoint years. Do not stop at a later-model product page if earlier factory catalogs show the same exact part.'
                        : 'Use two different queries: first this quoted exact MPN with OEM/catalog terms; second the same exact MPN with the requested vehicle, part name, and fitment/application. Read the complete requested-model/trim application from the cited exact-part page, then return full supported year endpoints, exact brief source excerpts, and a URL citation. Do not return one donor year or a broader generation range.',
            ]
                .filter(Boolean)
                .join('\n'),
        }));
        const citations = response.citations ?? [];
        const citedRange = this.rangeFromCitedCatalogPages(input, citations);
        if (citedRange)
            return citedRange;
        if (!alternateAttempt)
            return retryAlternateSearch();
        this.logger.warn(`OEM lookup produced no complete exact-MPN year coverage in cited catalog text for ${input.mpn} (${citations.length} citations, finish=${response.finishReason}, searches=${response.webSearchRequests ?? 0})`);
        return null;
    }
    rangeFromCitedCatalogPages(input, citations) {
        const mpnKey = this.normalizeIdentifier(input.mpn);
        if (!mpnKey)
            return null;
        const pages = citations.flatMap((citation) => {
            if (!citation.url || !citation.content?.trim())
                return [];
            let hostname = '';
            try {
                hostname = new URL(citation.url).hostname;
            }
            catch {
                return [];
            }
            if (NON_CATALOG_HOSTS.some((pattern) => pattern.test(hostname))) {
                return [];
            }
            const text = `${citation.title ?? ''}\n${citation.url}\n${citation.content}`;
            const exactMpnInPageIdentity = this.hasExactMpnToken(`${citation.title ?? ''} ${citation.url}`, input);
            const exactMpnInPageBody = this.hasExactMpnToken(citation.content, input, true);
            if ((!exactMpnInPageBody && !exactMpnInPageIdentity) ||
                !/(catalog|genuine|\boem\b|dealer|manufacturer part number|part code|parts.?diagram|exploded)/i.test(text)) {
                return [];
            }
            return [{ citation, hostname, text, exactMpnInPageBody }];
        });
        if (pages.length === 0)
            return null;
        const rangeCandidates = pages.flatMap(({ citation, hostname, text }) => {
            const partNameTokens = this.partNameTokens(input.partName ?? '');
            const pageIdentity = `${citation.title ?? ''} ${citation.url}`;
            return this.extractTargetYearRanges(text, input)
                .filter(({ context }) => {
                if (this.hasExactMpnToken(context, input, true)) {
                    return true;
                }
                const matchingPartTokens = partNameTokens.filter((token) => context.toLowerCase().includes(token));
                return (partNameTokens.length > 0 &&
                    matchingPartTokens.length >= Math.min(2, partNameTokens.length) &&
                    this.hasExactMpnToken(pageIdentity, input));
            })
                .map((range) => ({ ...range, citation, hostname }));
        });
        const partNameTokens = this.partNameTokens(input.partName ?? '');
        const catalogYearCandidates = pages.flatMap(({ citation, exactMpnInPageBody }) => {
            if (!exactMpnInPageBody || !citation.content)
                return [];
            const year = this.yearSpecificCatalogYear(citation, input);
            if (year == null ||
                !this.hasExactPartNameContext(citation.content, input, partNameTokens)) {
                return [];
            }
            return [{ year, citation }];
        });
        if (rangeCandidates.length === 0 && catalogYearCandidates.length === 0) {
            return null;
        }
        const supportedYearMap = new Map();
        for (const range of rangeCandidates) {
            for (let year = range.startYear; year <= range.endYear; year++) {
                const urls = supportedYearMap.get(year) ?? [];
                urls.push(range.citation.url);
                supportedYearMap.set(year, urls);
            }
        }
        for (const candidate of catalogYearCandidates) {
            const urls = supportedYearMap.get(candidate.year) ?? [];
            urls.push(candidate.citation.url);
            supportedYearMap.set(candidate.year, urls);
        }
        const initiallySupportedYears = [...supportedYearMap.keys()].sort((a, b) => a - b);
        if (initiallySupportedYears.length === 0)
            return null;
        let startYear = initiallySupportedYears[0];
        let endYear = initiallySupportedYears[initiallySupportedYears.length - 1];
        const boundaryEvidence = [];
        const relevantHosts = new Set(pages.map((page) => page.hostname));
        for (const page of citations) {
            let hostname = '';
            try {
                hostname = new URL(page.url).hostname;
            }
            catch {
                continue;
            }
            if (!relevantHosts.has(hostname) ||
                !page.content?.trim() ||
                !this.hasExactMpnToken(page.content, input, true)) {
                continue;
            }
            const bounds = this.exactPartDateBounds(page.content, input.mpn);
            if (bounds.endYear != null)
                endYear = Math.min(endYear, bounds.endYear);
            if (bounds.evidence)
                boundaryEvidence.push(bounds.evidence);
        }
        if (startYear < 1950 ||
            endYear < startYear ||
            endYear > new Date().getFullYear() + 2 ||
            endYear - startYear > mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN) {
            return null;
        }
        for (const year of initiallySupportedYears) {
            if (year > endYear)
                supportedYearMap.delete(year);
        }
        const supportedYears = [...supportedYearMap.keys()].sort((a, b) => a - b);
        if (supportedYears.length === 0)
            return null;
        startYear = supportedYears[0];
        endYear = supportedYears[supportedYears.length - 1];
        const expectedModelYears = this.modelYearsInInterval(input, startYear, endYear);
        if (expectedModelYears.some((year) => !supportedYearMap.has(year))) {
            return null;
        }
        const selected = rangeCandidates[0];
        const selectedYearCitation = catalogYearCandidates[0]?.citation;
        const evidenceSource = selected?.citation ?? selectedYearCitation;
        if (!evidenceSource)
            return null;
        const make = this.isProwler(input)
            ? input.vehicleMake
            : this.makeInSource(input, selected?.context ?? '');
        const exactApplication = `${make} ${input.vehicleModel}`.trim();
        const boundaryNote = [...new Set(boundaryEvidence)].slice(0, 3).join('\n');
        const yearEvidence = supportedYears
            .map((year) => {
            const urls = [...new Set(supportedYearMap.get(year) ?? [])];
            return `${year}: ${urls.slice(0, 2).join(', ')}`;
        })
            .join('\n');
        const knownModelYearNote = this.isProwler(input)
            ? 'Plymouth/Chrysler Prowler model years are 1997, 1999-2002; no 1998 model was produced (NHTSA CarGroup2011).'
            : '';
        return {
            make,
            model: input.vehicleModel,
            startYear,
            endYear,
            supportedYears,
            sourceUrl: evidenceSource.url,
            sourceTitle: evidenceSource.title?.trim() || new URL(evidenceSource.url).hostname,
            evidence: [
                `- ${startYear}-${endYear} ${exactApplication}`,
                `Exact-MPN catalog model years:\n${yearEvidence}`,
                knownModelYearNote,
                selected?.context
                    ? `Exact-MPN catalog application: ${selected.context.replace(/\s+/g, ' ').trim().slice(0, 360)}`
                    : '',
                boundaryNote ? `Exact-MPN production break: ${boundaryNote}` : '',
            ]
                .filter(Boolean)
                .join('\n'),
        };
    }
    hasExactMpnToken(source, input, rejectReplacementReferences = false) {
        if (this.hasExactIdentifierToken(source, input.mpn, rejectReplacementReferences)) {
            return true;
        }
        const normalized = this.normalizeIdentifier(input.mpn);
        return (this.isProwler(input) &&
            /^0lp[0-9a-z]+$/i.test(normalized) &&
            this.hasExactIdentifierToken(source, normalized.slice(1), rejectReplacementReferences));
    }
    yearSpecificCatalogYear(citation, input) {
        const identity = `${citation.title ?? ''} ${citation.url}`;
        if (!/\b(?:service|parts?|oem)?[-_ ]?catalog(?:ue)?\b/i.test(identity) ||
            !this.sourceMentionsModel(input.vehicleModel, input.vehicleModel, undefined, identity, input.vehicleMake)) {
            return null;
        }
        const yearAfterCatalog = identity.match(/\bcatalog(?:ue)?[-_ ]*((?:19|20)\d{2})\b/i);
        const yearBeforeCatalog = identity.match(/\b((?:19|20)\d{2})\b[^\n]{0,32}\b(?:service|parts?|oem)?[-_ ]?catalog(?:ue)?\b/i);
        const year = Number(yearAfterCatalog?.[1] ?? yearBeforeCatalog?.[1]);
        return Number.isInteger(year) && year >= 1950 ? year : null;
    }
    hasExactPartNameContext(content, input, tokens) {
        if (tokens.length === 0)
            return false;
        const lines = content.split(/\r?\n/);
        const minMatches = Math.min(2, tokens.length);
        return lines.some((line, index) => {
            if (!this.hasExactMpnToken(line, input, true))
                return false;
            const rowContext = lines
                .slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
                .join(' ')
                .toLowerCase();
            return tokens.filter((token) => rowContext.includes(token)).length >= minMatches;
        });
    }
    modelYearsInInterval(input, startYear, endYear) {
        if (this.isProwler(input)) {
            return [1997, 1999, 2000, 2001, 2002].filter((year) => year >= startYear && year <= endYear);
        }
        return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
    }
    isProwler(input) {
        return this.modelTokens(input.vehicleModel).includes('prowler');
    }
    hasExactIdentifierToken(source, identifier, rejectReplacementReferences = false) {
        const expected = this.normalizeIdentifier(identifier);
        if (!expected)
            return false;
        const identifierPattern = [...expected]
            .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('[\\s._/-]*');
        const matcher = new RegExp(`(^|[^a-z0-9])${identifierPattern}(?![a-z0-9]|[-._/]\\s*[a-z]{1,2}(?=$|[^a-z0-9]))`, 'ig');
        let match;
        while ((match = matcher.exec(source)) !== null) {
            if (rejectReplacementReferences) {
                const identifierStart = match.index + match[1].length;
                const linePrefix = source
                    .slice(Math.max(0, identifierStart - 120), identifierStart)
                    .split(/\r?\n/)
                    .at(-1) ?? '';
                if (/\b(?:replace(?:s|d)?(?:\s+by)?|replacement(?:\s+for)?|supersed(?:e|es|ed)?|interchange(?:able)?|cross[- ]?reference)\b/i.test(linePrefix)) {
                    continue;
                }
            }
            return true;
        }
        return false;
    }
    extractTargetYearRanges(text, input) {
        const expression = /\b((?:19|20)\d{2})\s*(?:[-–]|\bto\b)\s*((?:19|20)\d{2})\b/gi;
        const matches = [...text.matchAll(expression)];
        const result = [];
        matches.forEach((match, index) => {
            const offset = match.index ?? 0;
            const nextOffset = matches[index + 1]?.index ?? text.length;
            const context = text
                .slice(Math.max(0, offset - 24), Math.min(nextOffset, offset + 240))
                .trim();
            const startYear = Number(match[1]);
            const endYear = Number(match[2]);
            if (startYear < 1950 ||
                endYear < startYear ||
                endYear - startYear > mvl_donor_scope_util_js_1.MAX_FITMENT_YEAR_SPAN ||
                !this.sourceMentionsMake(input.vehicleMake, context, input.vehicleModel) ||
                !this.sourceMentionsModel(input.vehicleModel, input.vehicleModel, undefined, context, input.vehicleMake)) {
                return;
            }
            result.push({ startYear, endYear, context });
        });
        return result;
    }
    exactPartDateBounds(content, mpn) {
        const mpnKey = this.normalizeIdentifier(mpn);
        const lines = content.split(/\r?\n/);
        let endYear;
        const evidence = [];
        for (let index = 0; index < lines.length; index++) {
            const row = lines[index].replace(/\s+/g, ' ').trim();
            if (!this.hasExactIdentifierToken(row, mpn, true))
                continue;
            const endMatch = row.match(/\bD\s*>>\s*[-–]?\s*(?:\d{1,2}\.\d{1,2}\.)?((?:19|20)\d{2})\b/i);
            if (!endMatch)
                continue;
            const prCode = this.prCodeKey(row);
            if (!prCode)
                continue;
            const replacement = lines
                .slice(index + 1, index + 4)
                .map((line) => line.replace(/\s+/g, ' ').trim())
                .find((line) => {
                const replacementDate = line.match(/\bD\s*[-–]\s*\d{1,2}\.\d{1,2}\.((?:19|20)\d{2})\s*>>/i);
                return (!!replacementDate &&
                    this.prCodeKey(line) === prCode &&
                    this.partNumberTokens(line).some((partNumber) => this.normalizeIdentifier(partNumber) !== mpnKey));
            });
            if (!replacement)
                continue;
            endYear = Math.min(endYear ?? Number(endMatch[1]), Number(endMatch[1]));
            evidence.push(`${row.slice(0, 220)} → ${replacement.slice(0, 220)}`);
        }
        return {
            ...(endYear != null ? { endYear } : {}),
            ...(evidence.length ? { evidence: [...new Set(evidence)].join('\n') } : {}),
        };
    }
    prCodeKey(row) {
        const match = row.match(/\bPR\s*:\s*([^|]+)/i);
        return match ? this.normalizeIdentifier(match[1]) : '';
    }
    partNumberTokens(row) {
        return [...row.matchAll(/\b([0-9A-Z][0-9A-Z.-]{5,})\b/gi)]
            .map((match) => match[1])
            .filter((value) => /[A-Z]/i.test(value) && /\d/.test(value));
    }
    makeInSource(input, context) {
        const sourceKey = this.normalizeIdentifier(context);
        const alias = this.makeAliasesForVehicle(input.vehicleMake, input.vehicleModel).find((candidate) => sourceKey.includes(candidate));
        if (!alias)
            return input.vehicleMake;
        const canonical = {
            vw: 'Volkswagen',
            volkswagen: 'Volkswagen',
            plymouth: 'Plymouth',
            chrysler: 'Chrysler',
            chevy: 'Chevrolet',
            chevrolet: 'Chevrolet',
        };
        return canonical[alias] ?? input.vehicleMake;
    }
    matchesMake(expected, actual, vehicleModel) {
        const expectedAliases = this.makeAliasesForVehicle(expected, vehicleModel);
        const actualKey = this.normalizeIdentifier(actual);
        return expectedAliases.some((alias) => actualKey === alias || actualKey.includes(alias));
    }
    sourceMentionsMake(expected, source, vehicleModel) {
        const sourceKey = this.normalizeIdentifier(source);
        return this.makeAliasesForVehicle(expected, vehicleModel).some((alias) => sourceKey.includes(alias));
    }
    makeAliasesForVehicle(make, vehicleModel) {
        const aliases = this.makeAliases(make);
        const makeKey = this.normalizeIdentifier(make);
        const isProwler = this.modelTokens(vehicleModel).includes('prowler');
        if (isProwler &&
            (makeKey.includes('plymouth') || makeKey.includes('chrysler'))) {
            aliases.push('plymouth', 'chrysler');
        }
        return [...new Set(aliases)];
    }
    makeAliases(make) {
        const normalized = this.normalizeIdentifier(make);
        if (normalized === 'vw' || normalized.includes('volkswagen')) {
            return ['volkswagen', 'vw'];
        }
        if (normalized === 'chevy' || normalized.includes('chevrolet')) {
            return ['chevrolet', 'chevy'];
        }
        if (normalized.includes('mercedes')) {
            return ['mercedesbenz', 'mercedes'];
        }
        return [normalized].filter(Boolean);
    }
    matchesModel(expected, actualModel, actualTrim, vehicleMake) {
        const expectedTokens = this.modelTokens(expected);
        const actualTokens = new Set([
            ...this.modelTokens(actualModel),
            ...this.modelTokens(actualTrim ?? ''),
        ]);
        return (expectedTokens.length > 0 &&
            (expectedTokens.every((token) => actualTokens.has(token)) ||
                this.isVolkswagenGolfGtiAlias(expected, actualModel, vehicleMake)));
    }
    sourceMentionsModel(expected, model, trim, source, vehicleMake) {
        const expectedTokens = this.modelTokens(expected);
        const sourceTokens = new Set(this.modelTokens(source));
        const sourceHasExpectedModel = expectedTokens.every((token) => sourceTokens.has(token));
        const sourceHasVolkswagenGolfGtiAlias = this.isVolkswagenGolfGtiAlias(expected, model, vehicleMake) &&
            sourceTokens.has('gti');
        return (expectedTokens.length > 0 &&
            this.matchesModel(expected, model, trim, vehicleMake) &&
            (sourceHasExpectedModel || sourceHasVolkswagenGolfGtiAlias));
    }
    isVolkswagenGolfGtiAlias(expected, actualModel, vehicleMake) {
        const makeKey = this.normalizeIdentifier(vehicleMake ?? '');
        const expectedTokens = this.modelTokens(expected);
        const actualTokens = this.modelTokens(actualModel);
        return (['volkswagen', 'vw'].includes(makeKey) &&
            expectedTokens.length === 2 &&
            expectedTokens.includes('golf') &&
            expectedTokens.includes('gti') &&
            ((actualTokens.length === 1 && actualTokens[0] === 'gti') ||
                (actualTokens.length === 2 &&
                    actualTokens.includes('golf') &&
                    actualTokens.includes('gti'))));
    }
    modelTokens(value) {
        return value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .map((token) => this.normalizeIdentifier(token))
            .filter((token) => token.length > 0 &&
            !/^\d{4}$/.test(token) &&
            !/^mk\d+$/.test(token));
    }
    partNameTokens(value) {
        const ignored = new Set([
            'assembly',
            'genuine',
            'used',
            'oem',
            'front',
            'rear',
            'left',
            'right',
            'driver',
            'passenger',
            'plymouth',
            'chrysler',
            'prowler',
            'volkswagen',
            'golf',
            'gti',
        ]);
        return [
            ...new Set(value
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((token) => token.length > 2 && !ignored.has(token))),
        ];
    }
    normalizeIdentifier(value) {
        return value.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    normalizeUrl(value) {
        try {
            const url = new URL(value);
            return `${url.origin}${url.pathname}`.replace(/\/$/, '').toLowerCase();
        }
        catch {
            return '';
        }
    }
    stringValue(value) {
        return typeof value === 'string' || typeof value === 'number'
            ? String(value).trim()
            : '';
    }
    catalogSearchTerms(partName) {
        const normalized = partName.toLowerCase();
        if (/bumper|impact bar|reinforcement|cross.?member/.test(normalized)) {
            return `${partName}; bumper beam; front impact bar; side reinforcement; bumper carrier`;
        }
        if (/head.?light|head.?lamp/.test(normalized)) {
            return `${partName}; headlamp assembly; lighting unit`;
        }
        if (/fog.?light/.test(normalized)) {
            return `${partName}; fog lamp; fog-light assembly`;
        }
        if (/window.*motor|motor.*window/.test(normalized)) {
            return `${partName}; window regulator motor; door-window motor`;
        }
        if (/door.*speaker|speaker.*door/.test(normalized)) {
            return `${partName}; door loudspeaker; front/rear door speaker`;
        }
        return `${partName}; manufacturer diagram name; OEM catalog component name`;
    }
    async withLookupSlot(work) {
        if (this.activeLookups >= this.maxConcurrentLookups) {
            await new Promise((resolve) => this.lookupWaiters.push(resolve));
        }
        else {
            this.activeLookups++;
        }
        try {
            return await work();
        }
        finally {
            const next = this.lookupWaiters.shift();
            if (next)
                next();
            else
                this.activeLookups--;
        }
    }
};
exports.OemFitmentLookupService = OemFitmentLookupService;
exports.OemFitmentLookupService = OemFitmentLookupService = OemFitmentLookupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService])
], OemFitmentLookupService);
//# sourceMappingURL=oem-fitment-lookup.service.js.map