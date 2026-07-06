/**
 * Pipeline orchestration for MVL-driven fitment expansion.
 */

import {
  expandFitmentDeterministic,
  evaluateNeedsAiInterchange,
  getFitmentMinMvlRows,
  getSiblingExpansionMode,
  resolveFitmentAiInterchange,
  resolveFitmentExpansionMode,
} from './mvl-fitment-expander-core.mjs';
import {
  disconnectMvlDb,
  expandSiblingModelsFromMvl,
  filterRowsAgainstMvl,
  hasActiveMvlRelease,
  queryMvlYearsInRange,
} from './mvl-fitment-db.mjs';

export function createMvlFitmentExpander(options = {}) {
  const env = options.env ?? {};
  const mode = resolveFitmentExpansionMode(env);
  const aiInterchange = resolveFitmentAiInterchange(env);
  const minRows = getFitmentMinMvlRows(env);
  const siblingMode = getSiblingExpansionMode(env);
  const marketplace = options.marketplace ?? 'US';
  const maxRows = options.maxRows ?? 400;
  const mvlRequired = !/^(0|false|no|off)$/i.test(String(env.FITMENT_MVL_REQUIRED ?? 'true'));

  return {
    mode,
    aiInterchange,
    minRows,
    siblingMode,
    marketplace,

    async expandPart(part, context) {
      const {
        donor,
        vinData,
        pnVehicleMap,
        getEbayFitmentModelFields,
        profile = 'full',
      } = context;

      const partType = part._enriched?.type || part.partName || '';
      const placement = part._enriched?.placement || '';

      if (mode === 'ai') {
        return {
          expandedRows: [],
          ranges: [],
          coverage: {},
          needsAiInterchange: false,
          fitmentSource: 'ai',
          useLegacyExpand: true,
        };
      }

      const legacyCompat =
        mode === 'hybrid' && part._enriched?.compatibility?.length
          ? part._enriched.compatibility
          : [];

      const interchangeHints = part._enriched?.interchangeHints ?? [];

      let result = expandFitmentDeterministic({
        donor,
        partType,
        placement,
        mpn: part.partNumber,
        profile,
        siblingMode,
        pnVehicleMap,
        interchangeHints,
        legacyAiCompatibility: mode === 'hybrid' ? [] : legacyCompat,
        maxRows,
        getEbayFitmentModelFields,
      });

      const gen = result.ranges.find((r) => r.source === 'platform_generation');
      if (gen && donor.make && donor.model) {
        const mvlYears = await queryMvlYearsInRange(
          marketplace,
          donor.make,
          result.expandedRows[0]?.model || donor.model,
          gen.yearStart,
          gen.yearEnd,
        );
        if (mvlYears.length > 0) {
          const seen = new Set(result.expandedRows.map((r) => `${r.year}|${r.model}`));
          const filtered = [];
          for (const row of result.expandedRows) {
            const y = parseInt(row.year, 10);
            if (row.source !== 'platform_generation' || mvlYears.includes(y)) {
              filtered.push(row);
            } else {
              result.coverage.mvlRejected = (result.coverage.mvlRejected || 0) + 1;
            }
          }
          result.expandedRows = filtered;
        }

        if (siblingMode !== 'off' && gen) {
          const fitments = [...result.expandedRows];
          const seen = new Set(fitments.map((r) => `${r.year}|${r.make}|${r.model}|${r.trim}`));
          const addRow = (entry) => {
            const key = `${entry.year}|${entry.make}|${entry.model}|${entry.trim ?? ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            fitments.push(entry);
            return true;
          };
          const sibAdded = await expandSiblingModelsFromMvl({
            marketplace,
            make: donor.make,
            yearStart: gen.yearStart,
            yearEnd: gen.yearEnd,
            donorModel: donor.model,
            tier: result.tier,
            siblingMode,
            getEbayFitmentModelFields,
            addRow,
          });
          if (sibAdded > 0) result.coverage.siblingModels = sibAdded;
          result.expandedRows = fitments.slice(0, maxRows);
        }
      }

      const dbAvailable = await hasActiveMvlRelease(marketplace);
      if (dbAvailable) {
        const { accepted, rejectedCount, usedDb } = await filterRowsAgainstMvl(
          marketplace,
          result.expandedRows,
        );
        if (usedDb) {
          result.expandedRows = accepted;
          result.coverage.mvlRejected =
            (result.coverage.mvlRejected || 0) + rejectedCount;
          result.fitmentSource = rejectedCount > 0 ? 'mvl+filtered' : 'mvl';
        }
      } else if (mvlRequired && mode === 'mvl') {
        result.needsAiInterchange = true;
        result.fitmentSource = 'mvl_pending_db';
      }

      result.needsAiInterchange = evaluateNeedsAiInterchange(
        result.expandedRows.length,
        minRows,
        result.tier,
        aiInterchange,
      );

      if (mode === 'hybrid' && legacyCompat.length > 0) {
        const hybrid = expandFitmentDeterministic({
          donor,
          partType,
          placement,
          mpn: part.partNumber,
          profile,
          siblingMode: 'off',
          legacyAiCompatibility: legacyCompat,
          maxRows,
          getEbayFitmentModelFields,
        });
        const seen = new Set(result.expandedRows.map((r) => `${r.year}|${r.make}|${r.model}`));
        for (const row of hybrid.expandedRows) {
          const key = `${row.year}|${row.make}|${row.model}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.expandedRows.push(row);
          }
        }
        result.expandedRows = result.expandedRows.slice(0, maxRows);
      }

      return result;
    },

    async close() {
      await disconnectMvlDb();
    },
  };
}

export async function expandAllPartsWithMvl(parts, context, log = console) {
  const expander = createMvlFitmentExpander({ env: context.env, marketplace: context.marketplace });
  const stats = {
    mvlExpanded: 0,
    needsInterchange: 0,
    legacySkipped: 0,
    totalRows: 0,
    mvlRejected: 0,
  };

  if (expander.mode === 'ai') {
    stats.legacySkipped = parts.length;
    return { stats, expander, interchangeQueue: [] };
  }

  const interchangeQueue = [];

  for (const part of parts) {
    if (!part._enriched && expander.mode !== 'mvl') continue;
    const donor = context.getDonor(part);
    const profile = context.getProfile(part);
    const result = await expander.expandPart(part, {
      donor,
      vinData: context.vinData,
      pnVehicleMap: context.pnVehicleMap,
      getEbayFitmentModelFields: context.getEbayFitmentModelFields,
      profile,
    });

    if (result.useLegacyExpand) {
      stats.legacySkipped++;
      continue;
    }

    part._mvlFitment = result;
    if (result.expandedRows?.length) {
      part._fitments = result.expandedRows;
      part._fitmentSource = result.fitmentSource;
      stats.mvlExpanded++;
      stats.totalRows += result.expandedRows.length;
      stats.mvlRejected += result.coverage?.mvlRejected ?? 0;
    }
    if (result.needsAiInterchange) {
      stats.needsInterchange++;
      interchangeQueue.push(part);
    }
  }

  log.info?.(
    `MVL fitment expansion: ${stats.mvlExpanded} parts, ${stats.totalRows} rows, ` +
      `${stats.needsInterchange} need interchange micro-call, mode=${expander.mode}`,
  );

  return { stats, expander, interchangeQueue };
}
