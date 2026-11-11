import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from '../common/openai/openai.service.js';
import { MAX_FITMENT_YEAR_SPAN } from '../fitment/mvl-donor-scope.util.js';

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

export interface OemFitmentLookupInput {
  partBrand: string;
  mpn: string;
  vehicleMake: string;
  vehicleModel: string;
  marketplace: string;
  partName?: string;
}

export interface OemFitmentLookupResult {
  make: string;
  /** Canonical marketplace model, kept separate from its trim. */
  model: string;
  trim?: string;
  startYear: number;
  endYear: number;
  /** Exact-part years supported by cited intervals or year-specific catalogs. */
  supportedYears?: number[];
  sourceUrl: string;
  sourceTitle: string;
  evidence: string;
}

/**
 * Researches an exact OEM part number against cited parts catalogs. Results
 * are title evidence only; FitmentDiscoveryService still validates every
 * year against the destination marketplace MVL and marks rows review-only.
 */
@Injectable()
export class OemFitmentLookupService {
  private readonly logger = new Logger(OemFitmentLookupService.name);
  private activeLookups = 0;
  private readonly maxConcurrentLookups = 4;
  private readonly lookupWaiters: Array<() => void> = [];
  private readonly inFlightLookups = new Map<
    string,
    Promise<OemFitmentLookupResult | null>
  >();
  private readonly lookupCache = new Map<
    string,
    { result: OemFitmentLookupResult | null; expiresAt: number }
  >();

  constructor(private readonly openAi: OpenAiService) {}

  lookup(input: OemFitmentLookupInput): Promise<OemFitmentLookupResult | null> {
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
    if (cached) this.lookupCache.delete(key);

    const inFlight = this.inFlightLookups.get(key);
    if (inFlight) return inFlight;

    const pending = this.lookupExactPart(input);
    this.inFlightLookups.set(key, pending);
    void pending.then(
      (result) => {
        if (this.inFlightLookups.get(key) === pending) {
          this.inFlightLookups.delete(key);
        }
        this.lookupCache.set(key, {
          result,
          // Reuse successful evidence for a day and avoid repeating a
          // confirmed miss for the rest of this short optimization window.
          expiresAt: Date.now() + (result ? 24 * 60 * 60_000 : 15 * 60_000),
        });
      },
      () => {
        if (this.inFlightLookups.get(key) === pending) {
          this.inFlightLookups.delete(key);
        }
      },
    );
    return pending;
  }

  private async lookupExactPart(
    input: OemFitmentLookupInput,
    alternateAttempt = false,
  ): Promise<OemFitmentLookupResult | null> {
    const retryAlternateSearch = () =>
      !alternateAttempt
        ? this.lookupExactPart(input, true)
        : Promise.resolve(null);
    const response = await this.withLookupSlot(() => this.openAi.chat({
      model: OEM_FITMENT_MODEL,
      temperature: 0,
      // Luna's search reasoning consumes some completion budget before it
      // returns the compact, evidence-bearing JSON object. Leave enough room
      // for that final answer and use one higher-budget alternate search when
      // the first response is truncated or fails source validation.
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
    if (citedRange) return citedRange;

    // Model-written JSON and evidence are not source text. A range is accepted
    // only when the citation parser extracts it from the cited catalog page.
    if (!alternateAttempt) return retryAlternateSearch();
    this.logger.warn(
      `OEM lookup produced no complete exact-MPN year coverage in cited catalog text for ${input.mpn} (${citations.length} citations, finish=${response.finishReason}, searches=${response.webSearchRequests ?? 0})`,
    );
    return null;
  }
  /**
   * OpenRouter can return valid Exa citations while Luna exhausts its response
   * budget before producing JSON. Extract explicit intervals and year-specific
   * factory catalog applications from the citations themselves; never use the
   * model's own summary as source text.
   */
  private rangeFromCitedCatalogPages(
    input: OemFitmentLookupInput,
    citations: Array<{ url: string; title?: string; content?: string }>,
  ): OemFitmentLookupResult | null {
    const mpnKey = this.normalizeIdentifier(input.mpn);
    if (!mpnKey) return null;

    const pages = citations.flatMap((citation) => {
      if (!citation.url || !citation.content?.trim()) return [];
      let hostname = '';
      try {
        hostname = new URL(citation.url).hostname;
      } catch {
        return [];
      }
      if (NON_CATALOG_HOSTS.some((pattern) => pattern.test(hostname))) {
        return [];
      }
      const text = `${citation.title ?? ''}\n${citation.url}\n${citation.content}`;
      const exactMpnInPageIdentity = this.hasExactMpnToken(
        `${citation.title ?? ''} ${citation.url}`,
        input,
      );
      const exactMpnInPageBody = this.hasExactMpnToken(
        citation.content,
        input,
        true,
      );
      if (
        (!exactMpnInPageBody && !exactMpnInPageIdentity) ||
        !/(catalog|genuine|\boem\b|dealer|manufacturer part number|part code|parts.?diagram|exploded)/i.test(
          text,
        )
      ) {
        return [];
      }
      return [{ citation, hostname, text, exactMpnInPageBody }];
    });
    if (pages.length === 0) return null;

    const rangeCandidates = pages.flatMap(({ citation, hostname, text }) => {
      const partNameTokens = this.partNameTokens(input.partName ?? '');
      const pageIdentity = `${citation.title ?? ''} ${citation.url}`;
      return this.extractTargetYearRanges(text, input)
        .filter(({ context }) => {
          if (this.hasExactMpnToken(context, input, true)) {
            return true;
          }
          const matchingPartTokens = partNameTokens.filter((token) =>
            context.toLowerCase().includes(token),
          );
          // A generic vehicle-generation heading is not a part application.
          return (
            partNameTokens.length > 0 &&
            matchingPartTokens.length >= Math.min(2, partNameTokens.length) &&
            this.hasExactMpnToken(pageIdentity, input)
          );
        })
        .map((range) => ({ ...range, citation, hostname }));
    });
    const partNameTokens = this.partNameTokens(input.partName ?? '');
    const catalogYearCandidates = pages.flatMap(
      ({ citation, exactMpnInPageBody }) => {
        if (!exactMpnInPageBody || !citation.content) return [];
        const year = this.yearSpecificCatalogYear(citation, input);
        if (
          year == null ||
          !this.hasExactPartNameContext(citation.content, input, partNameTokens)
        ) {
          return [];
        }
        return [{ year, citation }];
      },
    );
    if (rangeCandidates.length === 0 && catalogYearCandidates.length === 0) {
      return null;
    }

    // Intervals and year-specific factory catalogs are positive evidence for
    // the same exact MPN. A late-model Mopar product page does not erase the
    // earlier model years where the same MPN appears in factory catalogs.
    const supportedYearMap = new Map<number, string[]>();
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
    const initiallySupportedYears = [...supportedYearMap.keys()].sort(
      (a, b) => a - b,
    );
    if (initiallySupportedYears.length === 0) return null;
    let startYear = initiallySupportedYears[0];
    let endYear = initiallySupportedYears[initiallySupportedYears.length - 1];
    const boundaryEvidence: string[] = [];
    const relevantHosts = new Set(pages.map((page) => page.hostname));
    for (const page of citations) {
      let hostname = '';
      try {
        hostname = new URL(page.url).hostname;
      } catch {
        continue;
      }
      if (
        !relevantHosts.has(hostname) ||
        !page.content?.trim() ||
        !this.hasExactMpnToken(page.content, input, true)
      ) {
        continue;
      }
      const bounds = this.exactPartDateBounds(page.content, input.mpn);
      if (bounds.endYear != null) endYear = Math.min(endYear, bounds.endYear);
      if (bounds.evidence) boundaryEvidence.push(bounds.evidence);
    }

    if (
      startYear < 1950 ||
      endYear < startYear ||
      endYear > new Date().getFullYear() + 2 ||
      endYear - startYear > MAX_FITMENT_YEAR_SPAN
    ) {
      return null;
    }

    for (const year of initiallySupportedYears) {
      if (year > endYear) supportedYearMap.delete(year);
    }
    const supportedYears = [...supportedYearMap.keys()].sort((a, b) => a - b);
    if (supportedYears.length === 0) return null;
    startYear = supportedYears[0];
    endYear = supportedYears[supportedYears.length - 1];
    const expectedModelYears = this.modelYearsInInterval(
      input,
      startYear,
      endYear,
    );
    if (expectedModelYears.some((year) => !supportedYearMap.has(year))) {
      return null;
    }

    const selected = rangeCandidates[0];
    const selectedYearCitation = catalogYearCandidates[0]?.citation;
    const evidenceSource = selected?.citation ?? selectedYearCitation;
    if (!evidenceSource) return null;
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
      sourceTitle:
        evidenceSource.title?.trim() || new URL(evidenceSource.url).hostname,
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

  private hasExactMpnToken(
    source: string,
    input: OemFitmentLookupInput,
    rejectReplacementReferences = false,
  ): boolean {
    if (
      this.hasExactIdentifierToken(source, input.mpn, rejectReplacementReferences)
    ) {
      return true;
    }
    // Legacy Mopar Prowler catalogs and dealers commonly omit the leading zero
    // from part numbers such as 0LP78LAZ. This alias is limited to that family.
    const normalized = this.normalizeIdentifier(input.mpn);
    return (
      this.isProwler(input) &&
      /^0lp[0-9a-z]+$/i.test(normalized) &&
      this.hasExactIdentifierToken(
        source,
        normalized.slice(1),
        rejectReplacementReferences,
      )
    );
  }

  private yearSpecificCatalogYear(
    citation: { url: string; title?: string },
    input: OemFitmentLookupInput,
  ): number | null {
    const identity = `${citation.title ?? ''} ${citation.url}`;
    if (
      !/\b(?:service|parts?|oem)?[-_ ]?catalog(?:ue)?\b/i.test(identity) ||
      !this.sourceMentionsModel(
        input.vehicleModel,
        input.vehicleModel,
        undefined,
        identity,
        input.vehicleMake,
      )
    ) {
      return null;
    }
    const yearAfterCatalog = identity.match(
      /\bcatalog(?:ue)?[-_ ]*((?:19|20)\d{2})\b/i,
    );
    const yearBeforeCatalog = identity.match(
      /\b((?:19|20)\d{2})\b[^\n]{0,32}\b(?:service|parts?|oem)?[-_ ]?catalog(?:ue)?\b/i,
    );
    const year = Number(yearAfterCatalog?.[1] ?? yearBeforeCatalog?.[1]);
    return Number.isInteger(year) && year >= 1950 ? year : null;
  }

  private hasExactPartNameContext(
    content: string,
    input: OemFitmentLookupInput,
    tokens: string[],
  ): boolean {
    if (tokens.length === 0) return false;
    const lines = content.split(/\r?\n/);
    const minMatches = Math.min(2, tokens.length);
    return lines.some((line, index) => {
      if (!this.hasExactMpnToken(line, input, true)) return false;
      const rowContext = lines
        .slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
        .join(' ')
        .toLowerCase();
      return tokens.filter((token) => rowContext.includes(token)).length >= minMatches;
    });
  }

  private modelYearsInInterval(
    input: OemFitmentLookupInput,
    startYear: number,
    endYear: number,
  ): number[] {
    if (this.isProwler(input)) {
      // NHTSA CarGroup2011 lists Prowler as 1997, 1999-2002 (no 1998 model):
      // https://static.nhtsa.gov/nhtsa/downloads/CURTAIN/CarGroup2011.pdf
      return [1997, 1999, 2000, 2001, 2002].filter(
        (year) => year >= startYear && year <= endYear,
      );
    }
    return Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index,
    );
  }

  private isProwler(input: OemFitmentLookupInput): boolean {
    return this.modelTokens(input.vehicleModel).includes('prowler');
  }

  /**
   * Exact-product catalog pages often put the MPN in their product URL/title
   * while Exa highlights only the application table in its body excerpt. Keep
   * accepting an MPN from the body, and also accept an exact identifier token
   * in that same cited page's URL/title. The make/model and explicit year range
   * are still independently required from the same page below.
   */
  private hasExactIdentifierToken(
    source: string,
    identifier: string,
    rejectReplacementReferences = false,
  ): boolean {
    const expected = this.normalizeIdentifier(identifier);
    if (!expected) return false;
    const identifierPattern = [...expected]
      .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s._/-]*');
    const matcher = new RegExp(
      `(^|[^a-z0-9])${identifierPattern}(?![a-z0-9]|[-._/]\\s*[a-z]{1,2}(?=$|[^a-z0-9]))`,
      'ig',
    );
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(source)) !== null) {
      if (rejectReplacementReferences) {
        const identifierStart = match.index + match[1].length;
        const linePrefix = source
          .slice(Math.max(0, identifierStart - 120), identifierStart)
          .split(/\r?\n/)
          .at(-1) ?? '';
        if (
          /\b(?:replace(?:s|d)?(?:\s+by)?|replacement(?:\s+for)?|supersed(?:e|es|ed)?|interchange(?:able)?|cross[- ]?reference)\b/i.test(
            linePrefix,
          )
        ) {
          continue;
        }
      }
      return true;
    }
    return false;
  }

  private extractTargetYearRanges(
    text: string,
    input: OemFitmentLookupInput,
  ): Array<{ startYear: number; endYear: number; context: string }> {
    const expression = /\b((?:19|20)\d{2})\s*(?:[-–]|\bto\b)\s*((?:19|20)\d{2})\b/gi;
    const matches = [...text.matchAll(expression)];
    const result: Array<{
      startYear: number;
      endYear: number;
      context: string;
    }> = [];
    matches.forEach((match, index) => {
      const offset = match.index ?? 0;
      const nextOffset = matches[index + 1]?.index ?? text.length;
      const context = text
        .slice(Math.max(0, offset - 24), Math.min(nextOffset, offset + 240))
        .trim();
      const startYear = Number(match[1]);
      const endYear = Number(match[2]);
      if (
        startYear < 1950 ||
        endYear < startYear ||
        endYear - startYear > MAX_FITMENT_YEAR_SPAN ||
        !this.sourceMentionsMake(input.vehicleMake, context, input.vehicleModel) ||
        !this.sourceMentionsModel(
          input.vehicleModel,
          input.vehicleModel,
          undefined,
          context,
          input.vehicleMake,
        )
      ) {
        return;
      }
      result.push({ startYear, endYear, context });
    });
    return result;
  }

  private exactPartDateBounds(
    content: string,
    mpn: string,
  ): { endYear?: number; evidence?: string } {
    const mpnKey = this.normalizeIdentifier(mpn);
    const lines = content.split(/\r?\n/);
    let endYear: number | undefined;
    const evidence: string[] = [];
    for (let index = 0; index < lines.length; index++) {
      const row = lines[index].replace(/\s+/g, ' ').trim();
      if (!this.hasExactIdentifierToken(row, mpn, true)) continue;
      const endMatch = row.match(
        /\bD\s*>>\s*[-–]?\s*(?:\d{1,2}\.\d{1,2}\.)?((?:19|20)\d{2})\b/i,
      );
      if (!endMatch) continue;

      // A date on an exact-MPN row is not by itself a model-year cutoff: the
      // same part can have multiple production-date rows for different options.
      // Cap the title interval only when a later replacement suffix begins on
      // the same option-code row immediately after this exact part row.
      const prCode = this.prCodeKey(row);
      if (!prCode) continue;
      const replacement = lines
        .slice(index + 1, index + 4)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .find((line) => {
          const replacementDate = line.match(
            /\bD\s*[-–]\s*\d{1,2}\.\d{1,2}\.((?:19|20)\d{2})\s*>>/i,
          );
          return (
            !!replacementDate &&
            this.prCodeKey(line) === prCode &&
            this.partNumberTokens(line).some(
              (partNumber) => this.normalizeIdentifier(partNumber) !== mpnKey,
            )
          );
        });
      if (!replacement) continue;
      endYear = Math.min(endYear ?? Number(endMatch[1]), Number(endMatch[1]));
      evidence.push(
        `${row.slice(0, 220)} → ${replacement.slice(0, 220)}`,
      );
    }
    return {
      ...(endYear != null ? { endYear } : {}),
      ...(evidence.length ? { evidence: [...new Set(evidence)].join('\n') } : {}),
    };
  }

  private prCodeKey(row: string): string {
    const match = row.match(/\bPR\s*:\s*([^|]+)/i);
    return match ? this.normalizeIdentifier(match[1]) : '';
  }

  private partNumberTokens(row: string): string[] {
    return [...row.matchAll(/\b([0-9A-Z][0-9A-Z.-]{5,})\b/gi)]
      .map((match) => match[1])
      .filter((value) => /[A-Z]/i.test(value) && /\d/.test(value));
  }

  private makeInSource(input: OemFitmentLookupInput, context: string): string {
    const sourceKey = this.normalizeIdentifier(context);
    const alias = this.makeAliasesForVehicle(
      input.vehicleMake,
      input.vehicleModel,
    ).find((candidate) => sourceKey.includes(candidate));
    if (!alias) return input.vehicleMake;
    const canonical: Record<string, string> = {
      vw: 'Volkswagen',
      volkswagen: 'Volkswagen',
      plymouth: 'Plymouth',
      chrysler: 'Chrysler',
      chevy: 'Chevrolet',
      chevrolet: 'Chevrolet',
    };
    return canonical[alias] ?? input.vehicleMake;
  }

  private matchesMake(
    expected: string,
    actual: string,
    vehicleModel: string,
  ): boolean {
    const expectedAliases = this.makeAliasesForVehicle(expected, vehicleModel);
    const actualKey = this.normalizeIdentifier(actual);
    return expectedAliases.some(
      (alias) => actualKey === alias || actualKey.includes(alias),
    );
  }

  private sourceMentionsMake(
    expected: string,
    source: string,
    vehicleModel: string,
  ): boolean {
    const sourceKey = this.normalizeIdentifier(source);
    return this.makeAliasesForVehicle(expected, vehicleModel).some((alias) =>
      sourceKey.includes(alias),
    );
  }

  private makeAliasesForVehicle(make: string, vehicleModel: string): string[] {
    const aliases = this.makeAliases(make);
    const makeKey = this.normalizeIdentifier(make);
    const isProwler = this.modelTokens(vehicleModel).includes('prowler');
    // Plymouth sold the Prowler through MY 2001; Chrysler used the same model
    // name for MY 2001–2002. Keep this transition scoped to Prowler.
    if (
      isProwler &&
      (makeKey.includes('plymouth') || makeKey.includes('chrysler'))
    ) {
      aliases.push('plymouth', 'chrysler');
    }
    return [...new Set(aliases)];
  }

  private makeAliases(make: string): string[] {
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

  private matchesModel(
    expected: string,
    actualModel: string,
    actualTrim?: string,
    vehicleMake?: string,
  ): boolean {
    const expectedTokens = this.modelTokens(expected);
    const actualTokens = new Set([
      ...this.modelTokens(actualModel),
      ...this.modelTokens(actualTrim ?? ''),
    ]);
    return (
      expectedTokens.length > 0 &&
      (expectedTokens.every((token) => actualTokens.has(token)) ||
        this.isVolkswagenGolfGtiAlias(expected, actualModel, vehicleMake))
    );
  }

  private sourceMentionsModel(
    expected: string,
    model: string,
    trim: string | undefined,
    source: string,
    vehicleMake: string,
  ): boolean {
    const expectedTokens = this.modelTokens(expected);
    const sourceTokens = new Set(this.modelTokens(source));
    const sourceHasExpectedModel = expectedTokens.every((token) =>
      sourceTokens.has(token),
    );
    const sourceHasVolkswagenGolfGtiAlias =
      this.isVolkswagenGolfGtiAlias(expected, model, vehicleMake) &&
      sourceTokens.has('gti');
    return (
      expectedTokens.length > 0 &&
      this.matchesModel(expected, model, trim, vehicleMake) &&
      (sourceHasExpectedModel || sourceHasVolkswagenGolfGtiAlias)
    );
  }

  /** US VW catalogs often list the Golf GTI as model "GTI" (trim-specific). */
  private isVolkswagenGolfGtiAlias(
    expected: string,
    actualModel: string,
    vehicleMake?: string,
  ): boolean {
    const makeKey = this.normalizeIdentifier(vehicleMake ?? '');
    const expectedTokens = this.modelTokens(expected);
    const actualTokens = this.modelTokens(actualModel);
    return (
      ['volkswagen', 'vw'].includes(makeKey) &&
      expectedTokens.length === 2 &&
      expectedTokens.includes('golf') &&
      expectedTokens.includes('gti') &&
      ((actualTokens.length === 1 && actualTokens[0] === 'gti') ||
        (actualTokens.length === 2 &&
          actualTokens.includes('golf') &&
          actualTokens.includes('gti')))
    );
  }

  private modelTokens(value: string): string[] {
    return value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => this.normalizeIdentifier(token))
      .filter(
        (token) =>
          token.length > 0 &&
          !/^\d{4}$/.test(token) &&
          !/^mk\d+$/.test(token),
      );
  }

  private partNameTokens(value: string): string[] {
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
      ...new Set(
        value
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length > 2 && !ignored.has(token)),
      ),
    ];
  }

  private normalizeIdentifier(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private normalizeUrl(value: string): string {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`.replace(/\/$/, '').toLowerCase();
    } catch {
      return '';
    }
  }

  private stringValue(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : '';
  }

  private catalogSearchTerms(partName: string): string {
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

  private async withLookupSlot<T>(work: () => Promise<T>): Promise<T> {
    if (this.activeLookups >= this.maxConcurrentLookups) {
      await new Promise<void>((resolve) => this.lookupWaiters.push(resolve));
    } else {
      this.activeLookups++;
    }

    try {
      return await work();
    } finally {
      const next = this.lookupWaiters.shift();
      if (next) next();
      else this.activeLookups--;
    }
  }
}
