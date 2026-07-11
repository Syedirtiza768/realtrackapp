#!/usr/bin/env node
/**
 * ebay-enrichment-pipeline.mjs
 * ═══════════════════════════════════════════════════════════════════════
 * eBay Motors VIN-to-Listing Enrichment Pipeline
 *
 * Processes VIN/parts inventory data through:
 *   1. NHTSA VIN Decoding
 *   2. eBay Taxonomy API (category + aspects)
 *   3. OpenAI Enrichment (titles, descriptions, specifics)
 *   4. eBay Compliance Validation
 *   5. Multi-template output generation (US Motors, AU, DE)
 *
 * Usage: node scripts/ebay-enrichment-pipeline.mjs
 * ═══════════════════════════════════════════════════════════════════════
 */

import './lib/ipv4-network-bootstrap.mjs';
import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import XLSX from 'xlsx';
import OpenAI from 'openai';
import axios from 'axios';
import { createModelRouter } from './lib/model-router.mjs';
import { applyListingGuards, validateListing, sanitizeTitle } from './lib/listing-quality.mjs';
import { createConcurrencyPool, isRateLimitError } from './lib/concurrency-pool.mjs';
import {
  PROMPT_VERSION as MOTORS_PROMPT_VERSION,
  buildMotorsEnrichmentSystemPrompt,
  buildMotorsEnrichmentUserPrompt,
  buildMotorsEnrichmentSystemPromptLegacy,
  PROMPT_VERSION_LEGACY,
} from './lib/motors-enrichment-prompt.mjs';
import { expandAllPartsWithMvl } from './lib/mvl-fitment-expander.mjs';
import { buildPnVehicleMap, resolveFitmentExpansionMode } from './lib/mvl-fitment-expander-core.mjs';
import {
  buildInterchangeSystemPrompt,
  buildInterchangeUserPrompt,
  INTERCHANGE_PROMPT_VERSION,
} from './lib/motors-interchange-prompt.mjs';
import { SHARED_PLATFORMS } from './lib/shared-platforms.mjs';
import { createEnrichmentCache } from './lib/enrichment-cache.mjs';
import { createTaxonomyClient, MOTORS_CATEGORY_TREE_ID } from './lib/taxonomy-client.mjs';
import { createOemIdentifier } from './lib/browse-oem-identifier.mjs';
import {
  createAiCategoryClassifier,
  AI_CATEGORY_DEFAULT_MODEL,
} from './lib/ai-category-classifier.mjs';
import {
  PIPELINE_MARKETPLACES,
  getActivePipelineMarketplaces,
  initActivePipelineMarketplaces,
  getMarketplaceConfig,
  getPartCategory,
  setPartCategory,
  buildCategoryKeywords,
  normalizeCategoryResult,
} from './lib/marketplace-category.mjs';
import {
  getEnrichmentProfile,
  getLowValueMaxPrice,
} from './lib/token-optimization.mjs';
import {
  buildGermanBasicDescription,
  buildGermanItemSpecifics,
  buildGermanSeoTitle,
  isLikelyGermanText,
  resolveMotorsCategoryFromPart,
  shouldRebuildGermanTitle,
} from './lib/german-listing.mjs';
import { PLATFORM_RANGES, detectTitleGenerationMismatch, buildPlatformSeoTitle } from './lib/platform-generation.mjs';
import {
  applyAustralianSpelling,
  buildEnglishBasicDescription,
  buildEnglishItemSpecifics,
  buildEnglishSeoTitle,
  localizeEnglishCopyForAu,
  resolveMotorsCategoryFromPart as resolveEnglishCategory,
  shouldRebuildEnglishTitle,
} from './lib/english-listing.mjs';

// ── HTTP connection pooling — reuse TCP sockets across requests ──
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 15, maxFreeSockets: 5 });
const httpAgent  = new http.Agent({ keepAlive: true, maxSockets: 15, maxFreeSockets: 5 });
axios.defaults.httpAgent  = httpAgent;
axios.defaults.httpsAgent = httpsAgent;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// Load from both root and backend .env (root takes precedence for shared keys)
const backendEnvPath = path.resolve(ROOT, 'backend/.env');
const backendEnv = fs.existsSync(backendEnvPath) ? loadEnv(backendEnvPath) : {};
const rootEnvPath = path.resolve(ROOT, '.env');
const rootEnv = fs.existsSync(rootEnvPath) ? loadEnv(rootEnvPath) : {};
const env = { ...backendEnv, ...rootEnv };

// Fallback to process.env for critical keys not found in .env files
// (Docker passes env vars via process.env, not .env files)
for (const key of [
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_CHAT_MODEL',
  'EBAY_CLIENT_ID',
  'EBAY_CLIENT_SECRET',
  'EBAY_ENVIRONMENT',
  'EBAY_SANDBOX',
]) {
  if (!env[key] && process.env[key]) env[key] = process.env[key];
}

const DEFAULT_CHAT_MODEL = 'openai/gpt-4.1-mini';

const CONFIG = {
  openai: {
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1',
    model: DEFAULT_CHAT_MODEL,
    batchSize: 8,                  // unchanged — quality gate for structured JSON
    concurrency: 8,                // parallel OpenRouter batches (override: PIPELINE_AI_CONCURRENCY)
    temperature: 0.25,
    maxTokens: undefined,          // allow model to use full response budget unless explicitly configured
    maxRetries: 3,
    delayBetweenCallsMs: 50,      // minimal delay — 429s use longer backoff in enrichBatch
  },
  pipeline: {
    aiConcurrency: 8,
    localizationConcurrency: 6,
    imageConcurrency: 6,
    categoryConcurrency: 2,
    vinBatchConcurrency: 6,
  },
  ebay: {
    clientId: env.EBAY_CLIENT_ID,
    clientSecret: env.EBAY_CLIENT_SECRET,
    marketplaceId: 'EBAY_MOTORS_US',
    sandbox: (() => {
      const override = env.EBAY_SANDBOX;
      if (override != null && String(override).trim() !== '') {
        return String(override).toLowerCase() === 'true';
      }
      const environment = String(env.EBAY_ENVIRONMENT || '').trim().toUpperCase();
      return environment !== 'PRODUCTION';
    })(),
    get baseUrl() {
      return this.sandbox
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';
    },
  },
  input: process.env.PIPELINE_INPUT_FILE || path.resolve(ROOT, 'Vins Report Status.xlsx'),
  templates: {
    us: path.resolve(ROOT, 'eBay-parts-and-accs-listing-template-Mar-28-2026-19-33-14.xlsx'),
    au: path.resolve(ROOT, 'eBay-category-listing-template-Mar-28-2026-19-39-50.xlsx'),
    uk: process.env.PIPELINE_UK_TEMPLATE
      ? path.resolve(ROOT, process.env.PIPELINE_UK_TEMPLATE)
      : path.resolve(ROOT, 'eBay-category-listing-template-Mar-28-2026-19-39-50.xlsx'),
    de: path.resolve(ROOT, 'eBay-category-listing-template-Mar-28-2026-19-43-18.xlsx'),
  },
  outputDir: process.env.PIPELINE_OUTPUT_DIR || path.resolve(ROOT, 'output'),
  defaultConditionId: '3000',      // Used
  defaultQuantity: 1,
  defaultFormat: 'FixedPrice',
  defaultDuration: 'GTC',
  location: 'Dubai, AE',
};

// Model lanes — OPENAI_CHAT_MODEL kept as alias for OPENAI_MODEL_DEFAULT
CONFIG.openai.model =
  env.OPENAI_MODEL_DEFAULT ||
  env.OPENAI_CHAT_MODEL ||
  DEFAULT_CHAT_MODEL;

// Pipeline parallelism — env overrides (rate-limit aware defaults)
const aiConcurrency = Number(env.PIPELINE_AI_CONCURRENCY || env.OPENAI_CONCURRENCY);
if (aiConcurrency > 0) {
  CONFIG.openai.concurrency = aiConcurrency;
  CONFIG.pipeline.aiConcurrency = aiConcurrency;
}
const aiBatchSize = Number(env.PIPELINE_AI_BATCH_SIZE);
if (aiBatchSize > 0) CONFIG.openai.batchSize = aiBatchSize;
const locConcurrency = Number(env.PIPELINE_LOCALIZATION_CONCURRENCY);
if (locConcurrency > 0) CONFIG.pipeline.localizationConcurrency = locConcurrency;
const imageConcurrency = Number(env.PIPELINE_IMAGE_CONCURRENCY);
if (imageConcurrency > 0) CONFIG.pipeline.imageConcurrency = imageConcurrency;
const categoryConcurrency = Number(env.PIPELINE_CATEGORY_CONCURRENCY);
if (categoryConcurrency > 0) CONFIG.pipeline.categoryConcurrency = categoryConcurrency;
const taxonomyRps = Number(env.PIPELINE_TAXONOMY_RPS);
const taxonomyDailyQuota = Number(env.PIPELINE_TAXONOMY_DAILY_QUOTA);
const categoryMode = String(env.PIPELINE_CATEGORY_MODE || 'auto').toLowerCase();
const categoryAiModel =
  env.PIPELINE_CATEGORY_AI_MODEL || AI_CATEGORY_DEFAULT_MODEL;
const categoryAiBatchSize = Number(env.PIPELINE_CATEGORY_AI_BATCH_SIZE);
const categoryAiMinConfidence = Number(env.PIPELINE_CATEGORY_AI_MIN_CONFIDENCE);
const vinBatchConcurrency = Number(env.PIPELINE_VIN_BATCH_CONCURRENCY);
if (vinBatchConcurrency > 0) CONFIG.pipeline.vinBatchConcurrency = vinBatchConcurrency;

const pipelineFastMode = /^(1|true|yes|on)$/i.test(
  String(env.PIPELINE_FAST_MODE || '').trim(),
);
const localizationMode = String(
  env.PIPELINE_LOCALIZATION_MODE ||
    (pipelineFastMode ? 'rule' : 'ai'),
).toLowerCase();
const localizationModel =
  env.PIPELINE_LOCALIZATION_MODEL || 'openai/gpt-4o-mini';
const localizationBatchSize = Number(env.PIPELINE_LOCALIZATION_BATCH_SIZE);
const skipImageValidation =
  pipelineFastMode ||
  /^(1|true|yes|on)$/i.test(String(env.PIPELINE_SKIP_IMAGE_VALIDATION || '').trim());
const skipImageFetch =
  /^(1|true|yes|on)$/i.test(String(env.PIPELINE_SKIP_IMAGE_FETCH || '').trim());
/** Max compatibility rows per listing in export files (eBay File Exchange). */
const exportMaxFitmentRows = Math.max(
  1,
  Number(env.PIPELINE_EXPORT_MAX_FITMENT_ROWS || 80) || 80,
);
/** Max fitment rows embedded in listing description HTML (compatibility rows carry the rest). */
const descMaxFitmentRows = Math.max(
  1,
  Number(env.PIPELINE_DESC_MAX_FITMENT_ROWS || 30) || 30,
);

const RUN_MODE = env.AI_RUN_MODE || 'default';
const FITMENT_EXPANSION_MODE = resolveFitmentExpansionMode(env);
const PROMPT_VERSION =
  FITMENT_EXPANSION_MODE === 'ai'
    ? (env.AI_PROMPT_VERSION || PROMPT_VERSION_LEGACY)
    : (env.AI_PROMPT_VERSION || MOTORS_PROMPT_VERSION);
const LOW_VALUE_MAX_PRICE = getLowValueMaxPrice(env);
const modelRouter = createModelRouter(env);
const enrichmentCache = createEnrichmentCache(ROOT, PROMPT_VERSION);

// Image enrichment API — uses internal Docker hostname when running from the
// backend processor (PIPELINE_JOB_ID is set by the NestJS worker), otherwise localhost.
const IMAGE_API_URL =
  process.env.IMAGE_ENRICHMENT_API_URL ||
  (process.env.PIPELINE_JOB_ID ? 'http://backend:4191' : 'http://localhost:4191');

// ─── Automotive Platform Year Ranges ──────────────────────────────────────────
// Loaded from shared/automotive-platform-ranges.json via scripts/lib/platform-generation.mjs

// SHARED_PLATFORMS — imported from ./lib/shared-platforms.mjs

// ═══════════════════════════════════════════════════════════════════════
//  LOGGING & REPORTING
// ═══════════════════════════════════════════════════════════════════════

const REPORT = {
  totalInput: 0,
  totalProcessed: 0,
  totalFailed: 0,
  totalSkipped: 0,
  vinDecodeSuccess: 0,
  vinDecodeFail: 0,
  categoryMappingApi: 0,
  categoryMappingAi: 0,
  categoryMappingFallback: 0,
  categoryByMarketplace: {
    US: { api: 0, ai: 0, fallback: 0, cross: 0 },
    UK: { api: 0, ai: 0, fallback: 0, cross: 0 },
    AU: { api: 0, ai: 0, fallback: 0, cross: 0 },
    DE: { api: 0, ai: 0, fallback: 0, cross: 0 },
  },
  taxonomyErrors: [],
  // ── OEM part identification (eBay Browse) ──
  oemIdentification: {
    uniqueNumbers: 0,
    identified: 0,      // confident overrides applied
    lowConfidence: 0,   // searched but < minAgreement
    skipped: 0,         // blank/too-short part numbers
    partsUpdated: 0,
  },
  taxonomyTreeCacheHit: false,
  taxonomyTreeCacheSource: null,
  taxonomyApiSkippedReason: null,
  openaiCalls: 0,
  openaiTokensUsed: 0,
  openaiErrors: 0,
  specificsEnrichedCount: 0,
  validationFixes: [],
  missingSpecifics: [],
  errors: [],
  startTime: Date.now(),
  // ── Image enrichment stats ──
  images: {
    totalParts: 0,
    withPrimary: 0,
    withGallery: 0,
    withDiagrams: 0,
    totalUrls: 0,
    validated: 0,
    accessible: 0,
    inaccessible: 0,
    belowMinResolution: 0,
    apiFailed: 0,
    apiRetries: 0,
    cacheHits: 0,
    missingParts: [],        // SKUs without any images
    failedEnrichments: [],   // SKUs where API call failed
  },
  // ── Fitment stats ──
  fitment: {
    totalParts: 0,
    platformExpanded: 0,
    crossRefExpanded: 0,
    aiInterchangeUsed: 0,
    sharedPlatformExpanded: 0,
    singleVehicle: 0,
    totalCompatEntries: 0,
    mvlExpanded: 0,
    mvlRejected: 0,
    interchangeMicroCalls: 0,
    expansionMode: FITMENT_EXPANSION_MODE,
    incomplete: [],
    noFitment: [],
  },
  aiRunLogs: [],
  routing: {
    policyVersion: modelRouter.policy?.version ?? null,
    escalations: 0,
    guardFixes: 0,
    validationFails: 0,
    enrichmentCacheHits: 0,
    attemptsByLane: {},
    estimatedCostByLane: {},
  },
  localization: {
    ukAiTranslated: 0,
    auAiTranslated: 0,
    deAiTranslated: 0,
    ukRuleOnly: 0,
    auRuleOnly: 0,
    deRuleOnly: 0,
    errors: 0,
  },
};

const log = {
  info:  (msg) => console.log(`[INFO]  ${new Date().toISOString().slice(11,19)} ${msg}`),
  warn:  (msg) => console.warn(`[WARN]  ${new Date().toISOString().slice(11,19)} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString().slice(11,19)} ${msg}`),
  step:  (msg) => console.log(`\n${'═'.repeat(60)}\n  STEP: ${msg}\n${'═'.repeat(60)}`),
  /** Structured progress line parsed by the backend processor */
  progress: (fields) => {
    const pairs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`[PROGRESS] ${pairs}`);
  },
};

if (pipelineFastMode) {
  log.info(
    'PIPELINE_FAST_MODE enabled — rule-based AU/DE localization, skipping image URL validation',
  );
}
log.info(
  `Export fitment caps: ${exportMaxFitmentRows} compatibility rows/listing, ${descMaxFitmentRows} rows in description HTML`,
);

// ═══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clean(v) { return v == null ? '' : String(v).trim(); }
function normalizePN(pn) { return clean(pn).replace(/[\s\-\.]/g, '').toUpperCase(); }

/** Cache-busting fingerprint — same MPN with different intake identity gets fresh enrichment. */
function partIdentityKey(part) {
  const images = String(part._gridx?.images || part._sourceImageUrls?.join('|') || '').trim();
  const name = String(part.partName || '').trim().toLowerCase().slice(0, 100);
  const note = String(part.note || '').trim().toLowerCase().slice(0, 200);
  return createHash('sha256').update(`${name}|${note}|${images}`).digest('hex').slice(0, 16);
}

/** Apply warehouse / CSV source images onto a part (never cleared by failed API calls). */
function applySourceImagesFromInput(part) {
  const raw =
    part._gridx?.images ||
    (Array.isArray(part._sourceImageUrls) ? part._sourceImageUrls.join('|') : '');
  if (!raw) return false;
  const urls = String(raw)
    .split(/[|,;]/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'));
  if (urls.length === 0) return false;

  part._images = urls.slice(0, 24);
  part._imageData = {
    primary_image_url: urls[0],
    additional_image_urls: urls.slice(1),
    diagram_image_urls: [],
    enriched_image_urls: urls.slice(0, 24),
    confidence: 1.0,
    sources: ['upload'],
    validation: null,
  };
  return true;
}
function titleCase(s) {
  return clean(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/**
 * Scan a text string for VIN patterns and return the first match.
 * Detects:
 *   - "VIN: 1HGBH41JXMN109186" or "VIN:1HGBH41JXMN109186"
 *   - "VIN 1HGBH41JXMN109186"
 *   - Standalone 17-char alphanumeric strings (excl. I, O, Q)
 */
function extractVinFromText(text) {
  if (!text) return '';
  const s = String(text);

  // Pattern 1: "VIN" label followed by 17-char code (with optional separator)
  const labelMatch = s.match(/\bVIN\b[\s:=\-]*([A-HJ-NPR-Z0-9]{17})\b/i);
  if (labelMatch) return labelMatch[1].toUpperCase();

  // Pattern 2: Standalone 17-char VIN-like string (not part of a URL or longer token)
  const standaloneMatch = s.match(/(?<![A-HJ-NPR-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-HJ-NPR-Z0-9])/i);
  if (standaloneMatch) return standaloneMatch[1].toUpperCase();

  return '';
}

/**
 * Scan an array of text values for a VIN and return the first match.
 */
function findVinInRow(values) {
  for (const val of values) {
    const vin = extractVinFromText(val);
    if (vin) return vin;
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════
//  NHTSA VIN DECODER
// ═══════════════════════════════════════════════════════════════════════

const vinCache = new Map();

async function decodeVin(vin) {
  const cleaned = clean(vin).replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length < 11) return null;

  // Use first 11 chars for caching (WMI + VDS + check digit)
  const cacheKey = cleaned.slice(0, 17);
  if (vinCache.has(cacheKey)) return vinCache.get(cacheKey);

  try {
    const { data } = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(cleaned)}?format=json`,
      { timeout: 15000 }
    );

    const results = data.Results || [];
    const get = (varId) => {
      const r = results.find(r => r.VariableId === varId);
      return r && r.Value && r.Value !== 'Not Applicable' ? r.Value.trim() : '';
    };

    const decoded = {
      vin: cleaned,
      year: get(29) || '',          // Model Year
      make: get(26) || '',          // Make
      model: get(28) || '',         // Model
      trim: get(38) || '',          // Trim
      bodyClass: get(5) || '',      // Body Class
      engineCylinders: get(9) || '',
      engineDisplacement: get(11) || '',
      engineModel: get(18) || '',
      fuelType: get(24) || '',
      driveType: get(15) || '',
      plantCountry: get(75) || '',
      vehicleType: get(39) || '',
      manufacturer: get(27) || '',
    };

    vinCache.set(cacheKey, decoded);
    REPORT.vinDecodeSuccess++;
    return decoded;
  } catch (err) {
    log.warn(`VIN decode failed for ${cleaned}: ${err.message}`);
    REPORT.vinDecodeFail++;
    vinCache.set(cacheKey, null);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  EBAY TAXONOMY API CLIENT
// ═══════════════════════════════════════════════════════════════════════

let ebayAppToken = null;
let ebayTokenExpiry = 0;
let taxonomyApiEnabled = true;

function taxonomyCacheScopeKey() {
  return `${CONFIG.ebay.marketplaceId}:${CONFIG.ebay.sandbox ? 'sandbox' : 'production'}`;
}

function recordTaxonomyError(message, status, source) {
  const text = clean(message);
  if (!text) return;
  const dedupeKey = `${source}:${status ?? 'unknown'}:${text}`;
  if (!REPORT._taxonomyErrorKeys) REPORT._taxonomyErrorKeys = new Set();
  if (REPORT._taxonomyErrorKeys.has(dedupeKey)) return;
  REPORT._taxonomyErrorKeys.add(dedupeKey);

  const payload = { type: 'taxonomy', source, status: status ?? null, message: text };
  REPORT.taxonomyErrors.push(payload);
  if (REPORT.errors.length < 50) {
    REPORT.errors.push({ type: 'taxonomy', message: `[${source}] ${text}` });
  }
}

async function getEbayAppToken() {
  if (ebayAppToken && Date.now() < ebayTokenExpiry - 60000) return ebayAppToken;

  if (!CONFIG.ebay.clientId || !CONFIG.ebay.clientSecret) {
    const message = 'EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not configured';
    recordTaxonomyError(message, null, 'oauth');
    REPORT.taxonomyApiSkippedReason = message;
    taxonomyApiEnabled = false;
    return null;
  }

  const basic = Buffer.from(
    `${CONFIG.ebay.clientId}:${CONFIG.ebay.clientSecret}`
  ).toString('base64');

  try {
    const { data } = await axios.post(
      `${CONFIG.ebay.baseUrl}/identity/v1/oauth2/token`,
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      }
    );
    ebayAppToken = data.access_token;
    ebayTokenExpiry = Date.now() + (data.expires_in || 7200) * 1000;
    log.info('eBay application token acquired');
    return ebayAppToken;
  } catch (err) {
    const message = err.response?.data?.error_description || err.message;
    log.error(`eBay token acquisition failed: ${message}`);
    recordTaxonomyError(message, err.response?.status ?? null, 'oauth');
    REPORT.taxonomyApiSkippedReason = message;
    taxonomyApiEnabled = false;
    return null;
  }
}

const taxonomyClient = createTaxonomyClient({
  rootDir: ROOT,
  scopeKey: taxonomyCacheScopeKey(),
  getToken: getEbayAppToken,
  baseUrl: CONFIG.ebay.baseUrl,
  requestsPerSecond: taxonomyRps > 0 ? taxonomyRps : 2,
  dailyQuota: taxonomyDailyQuota > 0 ? taxonomyDailyQuota : 4800,
  log: (level, msg) => log[level]?.(msg) ?? log.info(msg),
});

// OEM part identity anchor via eBay Browse (shares the application token).
// Off only when explicitly disabled; gated by confidence so it can't regress rows it can't resolve.
const oemIdentifyEnabled = !/^(0|false|no|off)$/i.test(
  String(env.PIPELINE_OEM_IDENTIFY ?? 'true').trim(),
);
const oemIdentifyConcurrency = Math.max(
  1,
  Number(env.PIPELINE_OEM_IDENTIFY_CONCURRENCY) || 3,
);
const oemIdentifier = createOemIdentifier({
  rootDir: ROOT,
  getToken: getEbayAppToken,
  baseUrl: CONFIG.ebay.baseUrl,
  requestsPerSecond: Number(env.PIPELINE_OEM_IDENTIFY_RPS) || 2,
  dailyCap: Number(env.PIPELINE_OEM_IDENTIFY_DAILY_CAP) || 4000,
  minAgreement: Number(env.PIPELINE_OEM_IDENTIFY_MIN_AGREEMENT) || 2,
  log: (level, msg) => log[level]?.(msg) ?? log.info(msg),
});

const aiCategoryClassifier = createAiCategoryClassifier({
  rootDir: ROOT,
  getOpenAI: () => getOpenAI(),
  model: categoryAiModel,
  batchSize: categoryAiBatchSize > 0 ? categoryAiBatchSize : 12,
  minConfidence:
    categoryAiMinConfidence > 0 && categoryAiMinConfidence <= 1
      ? categoryAiMinConfidence
      : 0.55,
  log: (level, msg) => log[level]?.(msg) ?? log.info(msg),
  onTokens: (tokens) => {
    REPORT.openaiTokensUsed += tokens;
  },
  resolveOnTree: async (categoryName, lookup) => {
    const { treeId, vinData } = _categoryMappingContext;
    const keywords = buildCategoryKeywords(
      lookup,
      (p) => getVehicleInfo(p, vinData),
      categoryName,
    );
    const result = await suggestCategoryForTree(keywords, treeId);
    if (result?.categoryId) {
      return { ...result, confidence: 0.85 };
    }
    const nameOnly = await suggestCategoryForTree(categoryName, treeId);
    if (nameOnly?.categoryId) {
      return { ...nameOnly, confidence: 0.75 };
    }
    return null;
  },
});

// Motors tree ID is fixed for US — AU/DE use marketplace-specific trees (see marketplace-category.mjs).
REPORT.taxonomyTreeCacheHit = true;
REPORT.taxonomyTreeCacheSource = 'known';

/** @type {{ vinData: Map<string, object>|null; marketplace: string; treeId: string }} */
let _categoryMappingContext = { vinData: null, marketplace: 'US', treeId: '0' };

const marketplaceDefaultCategories = new Map();

async function suggestCategoryForTree(keywords, treeId) {
  if (!taxonomyApiEnabled || !keywords?.trim()) return null;

  try {
    const result = await taxonomyClient.suggestCategory(keywords, treeId);
    return result;
  } catch (err) {
    const status = err.response?.status ?? null;
    const message = err.response?.data?.errors?.[0]?.message || err.message;
    log.warn(`eBay category suggestion failed (tree ${treeId}) for "${keywords.slice(0, 40)}": ${message}`);
    recordTaxonomyError(message, status, 'category_suggestion');
    return null;
  }
}

async function getDefaultCategoryForTree(treeId, fallbackQuery) {
  if (marketplaceDefaultCategories.has(treeId)) {
    return marketplaceDefaultCategories.get(treeId);
  }
  const resolved = await suggestCategoryForTree(fallbackQuery, treeId);
  const fallback = resolved || { categoryId: '262124', categoryName: 'Car & Truck Parts & Accessories' };
  marketplaceDefaultCategories.set(treeId, fallback);
  return fallback;
}

function bumpCategoryStat(marketplace, source) {
  const bucket = REPORT.categoryByMarketplace[marketplace];
  if (!bucket) return;
  if (source === 'api') {
    bucket.api += 1;
    REPORT.categoryMappingApi += 1;
  } else if (source === 'ai') {
    bucket.ai += 1;
    REPORT.categoryMappingAi += 1;
  } else if (source === 'cross') {
    bucket.cross += 1;
    REPORT.categoryMappingApi += 1;
  } else {
    bucket.fallback += 1;
    REPORT.categoryMappingFallback += 1;
  }
}

async function suggestCategory(keywords) {
  return suggestCategoryForTree(keywords, MOTORS_CATEGORY_TREE_ID);
}

async function getCategoryAspects(categoryId) {
  if (!taxonomyApiEnabled) return null;
  return taxonomyClient.getCategoryAspects(categoryId);
}

// ═══════════════════════════════════════════════════════════════════════
//  FALLBACK CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════

const CATEGORY_KEYWORDS = [
  // Interior door trim — before generic/exterior door matches
  { kw: ['armrest', 'armlehne', 'türverkleidung', 'door armrest', 'door finisher', 'inner panel'], id: '33695', name: 'Interior Door Panels & Parts' },
  { kw: ['interior door', 'door moulding', 'door molding', 'door trim', 'innen'], id: '33695', name: 'Interior Door Panels & Parts' },
  // Doors & related (exterior before complete assembly)
  { kw: ['exterior door panel', 'door skin', 'exterior door', 'door shell'], id: '33697', name: 'Exterior Door Panels & Frames' },
  { kw: ['complete door', 'door assembly', 'door front', 'door rear', 'driver door', "driver's door", 'door body-in-white', 'door, body'], id: '174105', name: 'Doors & Door Parts' },
  { kw: ['door handle', 'handle strip'], id: '174106', name: 'Door Handles' },
  { kw: ['door hinge', 'hinge upper', 'hinge lower', 'hinge front'], id: '174107', name: 'Door Hinges' },
  { kw: ['door lock', 'door latch', 'lock actuator', 'system latch', 'lock with code', 'central locking', 'd gate'], id: '174108', name: 'Door Lock Actuators, Latches & Related' },
  { kw: ['window regulator', 'window lifter', 'window motor', 'drive for window'], id: '174085', name: 'Window Motors, Parts & Accessories' },
  { kw: ['window glass', 'door glass', 'quarter glass'], id: '33843', name: 'Auto Glass' },
  { kw: ['door seal', 'door sealing', 'weatherstrip', 'weather strip', 'belt weatherstrip', 'circumf'], id: '33712', name: 'Window Sweeps, Felts & Weatherstrips' },
  { kw: ['mirror', 'side mirror', 'rearview'], id: '33726', name: 'Exterior Mirrors' },
  { kw: ['door brake', 'door stop', 'door check', 'check arm', 'door damping'], id: '174105', name: 'Doors & Door Parts' },
  // Audio & electronics
  { kw: ['speaker', 'tweeter', 'woofer', 'subwoofer', 'amplifier', 'sound system'], id: '174920', name: 'Car Speakers' },
  { kw: ['radio', 'stereo', 'head unit', 'infotainment', 'navigation', 'sat nav', 'display screen', 'multimedia'], id: '174921', name: 'Car Audio & Video Installation' },
  // Computers & modules
  { kw: ['control unit', 'module', 'ecu', 'ecm', 'tcm', 'bcm', 'sam module', 'abs module'], id: '33596', name: 'Engine Computers' },
  // Wiring
  { kw: ['wiring', 'harness', 'cable', 'loom'], id: '174924', name: 'Wiring Harnesses' },
  { kw: ['switch', 'button', 'control panel', 'window switch', 'master switch'], id: '174917', name: 'Switches & Controls' },
  // Body panels
  { kw: ['fender', 'wing', 'fender liner', 'wheel arch'], id: '33718', name: 'Fenders' },
  { kw: ['bumper', 'bumper cover', 'bumper support', 'bumper bracket'], id: '33719', name: 'Bumpers & Parts' },
  { kw: ['hood', 'bonnet', 'hood hinge', 'hood latch'], id: '174083', name: 'Hoods' },
  { kw: ['trunk', 'boot', 'rear lid', 'tailgate', 'trunk lid', 'liftgate'], id: '174849', name: 'Trunk Lids & Parts' },
  { kw: ['grille', 'grill', 'front grille'], id: '33720', name: 'Grilles' },
  { kw: ['roof', 'sunroof', 'panoramic', 'roof panel', 'roof rack'], id: '33721', name: 'Roofs' },
  // Lighting
  { kw: ['headlight', 'headlamp', 'head light', 'head lamp', 'hid', 'xenon'], id: '33710', name: 'Headlights' },
  { kw: ['tail light', 'taillight', 'rear light', 'rear lamp', 'brake light', 'stop light'], id: '33717', name: 'Tail Lights' },
  { kw: ['fog light', 'fog lamp', 'driving light'], id: '33715', name: 'Fog Lights' },
  { kw: ['turn signal', 'indicator', 'side marker', 'corner light'], id: '33714', name: 'Turn Signals' },
  // Safety
  { kw: ['air bag', 'airbag', 'srs', 'crash sensor'], id: '174098', name: 'Air Bags' },
  { kw: ['seat belt', 'seatbelt', 'belt pretensioner', 'belt buckle'], id: '174099', name: 'Seat Belts & Parts' },
  // Interior
  { kw: ['seat', 'seat cushion', 'seat back', 'seat frame', 'headrest'], id: '174089', name: 'Seats' },
  { kw: ['dashboard', 'dash panel', 'instrument cluster', 'instrument panel', 'gauge cluster', 'speedometer'], id: '33717', name: 'Dashboards & Dashboard Parts' },
  { kw: ['steering wheel', 'steering column', 'steering shaft', 'clock spring'], id: '33588', name: 'Steering Wheels & Horns' },
  { kw: ['center console', 'console lid', 'armrest console'], id: '174090', name: 'Center Consoles' },
  { kw: ['sun visor', 'visor'], id: '174091', name: 'Sun Visors' },
  { kw: ['carpet', 'floor mat', 'floor liner'], id: '174092', name: 'Floor Mats & Carpets' },
  { kw: ['glove box', 'glovebox'], id: '174093', name: 'Glove Boxes' },
  // Engine & drivetrain
  { kw: ['engine', 'motor assembly', 'long block', 'short block', 'engine block'], id: '33615', name: 'Complete Engines' },
  { kw: ['transmission', 'gearbox', 'transaxle', 'transfer case'], id: '33616', name: 'Complete Manual Transmissions' },
  { kw: ['turbo', 'turbocharger', 'supercharger', 'blower'], id: '174934', name: 'Turbo Chargers & Parts' },
  { kw: ['alternator', 'generator'], id: '33615', name: 'Alternators & Generators' },
  { kw: ['starter', 'starter motor'], id: '33617', name: 'Starters' },
  { kw: ['radiator', 'intercooler', 'charge air cooler'], id: '33613', name: 'Radiators & Parts' },
  { kw: ['exhaust', 'muffler', 'catalytic converter', 'exhaust manifold', 'downpipe'], id: '33619', name: 'Exhaust Parts' },
  { kw: ['fuel pump', 'fuel injector', 'fuel rail', 'fuel tank'], id: '33554', name: 'Fuel Pumps & Sending Units' },
  { kw: ['water pump', 'thermostat', 'coolant'], id: '33613', name: 'Radiators & Parts' },
  { kw: ['oil pump', 'oil pan', 'oil filter', 'dipstick'], id: '174938', name: 'Oil System Parts' },
  { kw: ['intake manifold', 'throttle body', 'air filter', 'mass air flow', 'maf'], id: '33547', name: 'Air Intake & Fuel Delivery' },
  // Suspension & steering
  { kw: ['shock', 'strut', 'shock absorber', 'air suspension', 'spring'], id: '33579', name: 'Shocks & Struts' },
  { kw: ['control arm', 'ball joint', 'tie rod', 'sway bar', 'stabilizer', 'bushing'], id: '33580', name: 'Control Arms & Parts' },
  { kw: ['wheel hub', 'wheel bearing', 'hub assembly', 'knuckle', 'spindle'], id: '33582', name: 'Wheel Hubs & Bearings' },
  { kw: ['power steering', 'steering rack', 'steering pump', 'steering gear'], id: '33586', name: 'Power Steering Pumps & Parts' },
  // Brakes
  { kw: ['brake caliper', 'brake disc', 'brake rotor', 'brake pad', 'brake shoe', 'abs sensor'], id: '33559', name: 'Brake Discs, Rotors & Hardware' },
  { kw: ['brake master', 'brake booster', 'brake line', 'brake hose'], id: '33560', name: 'Brake Master Cylinders & Parts' },
  // AC & heating
  { kw: ['a/c', 'ac compressor', 'condenser', 'evaporator', 'heater core', 'blower motor', 'climate control', 'hvac'], id: '33553', name: 'A/C & Heater Controls' },
  // Trim & accessories  
  { kw: ['water shield', 'vapor barrier'], id: '174105', name: 'Doors & Door Parts' },
  { kw: ['sound absorber', 'insulation', 'damping', 'deadening'], id: '174105', name: 'Doors & Door Parts' },
  { kw: ['trim strip', 'moulding', 'molding', 'garnish', 'decal', 'emblem', 'badge'], id: '33694', name: 'Body Kits' },
  { kw: ['bolt', 'screw', 'nut', 'fastener', 'clip', 'rivet', 'cable holder', 'torx'], id: '174907', name: 'Nuts, Bolts & Fasteners' },
  // Wheels & tires  
  { kw: ['wheel', 'rim', 'alloy wheel', 'hubcap'], id: '33592', name: 'Wheels' },
  { kw: ['tire', 'tyre'], id: '66471', name: 'Tires' },
  // Cooling
  { kw: ['fan', 'cooling fan', 'fan shroud', 'fan clutch'], id: '176658', name: 'Fans & Kits' },
  // Axle & CV
  { kw: ['axle', 'cv joint', 'drive shaft', 'half shaft', 'cv axle', 'propeller shaft'], id: '174935', name: 'CV Joints & Parts' },
];

function fallbackCategoryMatch(partName, note) {
  const hint = resolveMotorsCategoryFromPart(partName, note);
  if (hint) return hint;

  const text = `${partName} ${note}`.toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.kw.some(kw => text.includes(kw))) {
      return { categoryId: entry.id, categoryName: entry.name };
    }
  }
  // Default: generic auto parts & accessories category (not Doors & Door Parts)
  return { categoryId: '262124', categoryName: 'Car & Truck Parts & Accessories' };
}

// ═══════════════════════════════════════════════════════════════════════
//  INPUT PARSER
// ═══════════════════════════════════════════════════════════════════════

function parseInputFile(filePath) {
  log.step('Parsing Input File');
  const wb = XLSX.readFile(filePath);
  const vinSheets = wb.SheetNames.filter(n => n !== 'All Vins');
  const allParts = [];

  for (const sheetName of vinSheets) {
    const ws = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rawData.length < 2) continue;

    // ── Detect GridX Connect format ──
    // GridX Connect files have an info/metadata row at index 0 (e.g. "GridX Connect"
    // or VIN info), actual column headers at row 1, and data starting at row 2.
    // The headers include columns like "Image URLs", "Vehicle Make", "Description",
    // "Weight Major", "Package Length" etc. that are not present in VIN-based sheets.
    const row0Headers = rawData[0].map(h => clean(h).toLowerCase());
    const row1Values = rawData.length > 1 ? rawData[1].map(h => clean(h).toLowerCase()) : [];
    const isGridxFormat = detectGridxFormat(row0Headers, row1Values);

    if (isGridxFormat) {
      // GridX Connect format: row 0 = info, row 1 = headers, row 2+ = data
      // Determine which row contains the actual headers.
      // Variant A: Row 0 = info/metadata, Row 1 = headers, Row 2+ = data
      // Variant B: Row 0 = headers, Row 1 = category/info row, Row 2+ = data
      const gridxColCheck = ['part number', 'price', 'image urls', 'sku'];
      const row1HeaderCount = gridxColCheck.filter(c => row1Values.includes(c)).length;
      const row0HeaderCount = gridxColCheck.filter(c => row0Headers.includes(c)).length;

      let gxHeaders, dataStartRow;
      if (row1HeaderCount >= 2) {
        // Variant A: Row 1 has the headers
        gxHeaders = row1Values;
        dataStartRow = 2;
      } else if (row0HeaderCount >= 2) {
        // Variant B: Row 0 has the headers, Row 1 is a category/info row
        gxHeaders = row0Headers;
        dataStartRow = 1;
      } else {
        // Fallback: try Row 1
        gxHeaders = row1Values;
        dataStartRow = 2;
      }

      const gxColMap = buildGridxColumnMap(gxHeaders);
      const vehicleInfo = parseVehicleFromSheetName(sheetName);

      let sheetParts = 0;
      for (let i = dataStartRow; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !row.some(c => c != null && c !== '')) continue;

        const part = extractGridxPart(row, gxColMap, sheetName, vehicleInfo);
        // Skip category/header rows — these have text only in the first cell
        // with no other data columns filled (no price, images, etc.)
        const nonEmptyCells = row.filter(c => c != null && String(c).trim() !== '').length;
        if (nonEmptyCells <= 1) continue;
        if (!part.partNumber && !part.sku && !part.price) continue;
        if (part.partName || part.partNumber) {
          allParts.push(part);
          sheetParts++;
        }
      }
      log.info(`  Sheet "${sheetName}" (GridX Connect): ${sheetParts} parts`);
    } else {
      // Standard VIN-based format: row 0 = headers, row 1+ = data
      const headers = row0Headers;
      const colMap = buildColumnMap(headers);

      let sheetParts = 0;
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !row.some(c => c != null && c !== '')) continue;

        const part = extractPart(row, colMap, sheetName);
        if (part.partName || part.partNumber) {
          allParts.push(part);
          sheetParts++;
        }
      }
      log.info(`  Sheet "${sheetName}": ${sheetParts} parts`);
    }
  }

  REPORT.totalInput = allParts.length;
  log.info(`Total parts parsed: ${allParts.length} from ${vinSheets.length} sheet(s)`);
  return allParts;
}

/**
 * Detect if a sheet uses the GridX Connect format.
 * GridX files have a metadata/info row at row 0 and actual headers at row 1.
 * Key indicators: row 1 contains "image urls", "vehicle make", "description",
 * or row 0 contains "gridx" / doesn't look like standard column headers.
 */
function detectGridxFormat(row0Headers, row1Values) {
  // Check if row 0 contains GridX identifier
  const row0Text = row0Headers.join(' ');
  if (row0Text.includes('gridx') || row0Text.includes('gridxconnect')) return true;

  // Check if row 1 has GridX-specific columns
  const gridxCols = ['image urls', 'vehicle make', 'weight major', 'package length', 'package width', 'package depth'];
  const matchCount = gridxCols.filter(col => row1Values.includes(col)).length;
  if (matchCount >= 2) return true;

  // Check if row 0 has GridX-specific columns (variant: headers in row 0, data starts at row 2)
  const row0GridxMatch = gridxCols.filter(col => row0Headers.includes(col)).length;
  if (row0GridxMatch >= 2) return true;

  // Check if row 0 doesn't look like standard headers but row 1 does
  const standardCols = ['sku', 'brand', 'make', 'model', 'vin', 'category', 'part number', 'name', 'price'];
  const row0Matches = standardCols.filter(col => row0Headers.includes(col)).length;
  const row1HasPartNumber = row1Values.includes('part number') || row1Values.includes('part no');
  const row1HasDescription = row1Values.includes('description') || row1Values.includes('parts description');
  if (row0Matches === 0 && row1HasPartNumber && row1HasDescription) return true;

  return false;
}

/**
 * Build column map for GridX Connect format.
 * Columns: Part Number, Price, Quantity, Vehicle Make, Description,
 *          Image URLs, SKU, Weight Major, Weight Minor,
 *          Package Length, Package Width, Package Depth
 */
function buildGridxColumnMap(headers) {
  const map = {
    partNumber: -1, price: -1, quantity: -1, make: -1,
    description: -1, images: -1, sku: -1,
    weightMajor: -1, weightMinor: -1,
    pkgLength: -1, pkgWidth: -1, pkgDepth: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (h === 'part number' || h === 'part no' || h === 'part no.') map.partNumber = i;
    if (h === 'price' || h === 'sell price' || h === 'unit price') map.price = i;
    if (h === 'quantity' || h === 'qty') map.quantity = i;
    if (h === 'vehicle make' || h === 'make') map.make = i;
    if (h === 'description' || h === 'parts description' || h === 'part description') map.description = i;
    if (h === 'image urls' || h === 'images' || h === 'image url') map.images = i;
    if (h === 'sku' || h === 'custom label') map.sku = i;
    if (h === 'weight major') map.weightMajor = i;
    if (h === 'weight minor') map.weightMinor = i;
    if (h === 'package length') map.pkgLength = i;
    if (h === 'package width') map.pkgWidth = i;
    if (h === 'package depth') map.pkgDepth = i;
  }

  return map;
}

// ═══════════════════════════════════════════════════════════════════════
//  SHARED VEHICLE KNOWLEDGE + FREE-TEXT / FILENAME RESOLVER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Make → known models. Single source of truth reused by the filename resolver,
 * sheet-name parser, and description parser. Multi-word models are matched
 * longest-first so "Range Rover Sport" wins over "Range Rover".
 */
const VEHICLE_MAKE_MODELS = {
  'Land Rover': ['Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque', 'Range Rover', 'Discovery Sport', 'Discovery', 'Defender', 'Freelander'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLE', 'GLC', 'GLA', 'GLB', 'CLA', 'CLS', 'A-Class', 'B-Class', 'G-Class', 'AMG GT'],
  'Jaguar': ['F-Pace', 'E-Pace', 'I-Pace', 'F-Type', 'XF', 'XE', 'XJ', 'XK', 'XJR', 'S-Type', 'X-Type'],
  'BMW': ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'M2', 'M3', 'M4', 'M5', 'M6', 'M8', 'Z4', 'Z3', 'i3', 'i4', 'i8', 'iX'],
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'R8', 'RS3', 'RS4', 'RS5', 'RS6', 'RS7', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'e-tron'],
  'Volkswagen': ['Golf', 'Jetta', 'Passat', 'Tiguan', 'Touareg', 'Polo', 'Arteon', 'Atlas', 'ID.4', 'ID.3', 'Beetle', 'CC'],
  'Porsche': ['Cayenne', 'Macan', 'Panamera', '911', '718', 'Boxster', 'Cayman', 'Taycan'],
  'Ford': ['F-150', 'F-250', 'F-350', 'Mustang', 'Explorer', 'Escape', 'Edge', 'Bronco', 'Ranger', 'Expedition', 'Focus', 'Fusion'],
  'Toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra', '4Runner', 'Prius', 'Land Cruiser', 'Supra'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'Pilot', 'Odyssey', 'Fit'],
  'Dodge': ['Charger', 'Challenger', 'Durango', 'Ram', 'Journey', 'Grand Caravan'],
  'Chrysler': ['300', 'Pacifica', 'Town & Country', 'Voyager'],
  'Jeep': ['Grand Cherokee', 'Cherokee', 'Wrangler', 'Compass', 'Renegade', 'Gladiator'],
  'Nissan': ['Altima', 'Maxima', 'Sentra', 'Rogue', 'Murano', 'Pathfinder', '370Z', 'GT-R', 'Frontier', 'Titan'],
  'Lexus': ['IS', 'ES', 'GS', 'LS', 'RX', 'NX', 'UX', 'GX', 'LX', 'RC', 'LC'],
  'Bentley': ['Continental', 'Flying Spur', 'Bentayga', 'Mulsanne'],
  'Maserati': ['Ghibli', 'Levante', 'Quattroporte', 'GranTurismo'],
  'Rolls-Royce': ['Ghost', 'Wraith', 'Dawn', 'Phantom', 'Cullinan'],
};

/** Alias map for make names found in free text (filenames, sheet names, descriptions). */
const VEHICLE_MAKE_ALIASES = {
  'range rover': 'Land Rover', 'lr': 'Land Rover', 'landrover': 'Land Rover',
  'mercedes': 'Mercedes-Benz', 'mb': 'Mercedes-Benz', 'benz': 'Mercedes-Benz',
  'vw': 'Volkswagen',
  'chevy': 'Chevrolet',
};

/** Donor vehicle parsed from the uploaded filename; gap-fills parts lacking a VIN. */
let DONOR_VEHICLE = { year: '', make: '', model: '' };

function _escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** First model year (single, or the start of a range) found in free text. */
function extractYearFromText(text) {
  const range = String(text).match(/\b((?:19|20)?\d{2})\s*[-–]\s*(?:19|20)?\d{2}\b/);
  if (range) {
    let y = parseInt(range[1], 10);
    if (y < 100) y += y > 50 ? 1900 : 2000;
    if (y >= 1950 && y <= 2100) return String(y);
  }
  const single = String(text).match(/\b(19|20)\d{2}\b/);
  return single ? single[0] : '';
}

/**
 * Resolve { year, make, model } from arbitrary text (filename, sheet name),
 * independent of token order and tolerant of color / trim / noise words.
 * "Q7 AUDI SILVER 2008" → { year: '2008', make: 'Audi', model: 'Q7' }.
 * Any field may be '' when not confidently found.
 */
function resolveVehicleFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) return { year: '', make: '', model: '' };
  const upper = text.toUpperCase();
  const year = extractYearFromText(text);

  // Make: aliases first, then canonical make names (word-boundary match)
  let make = '';
  for (const [alias, real] of Object.entries(VEHICLE_MAKE_ALIASES)) {
    if (new RegExp(`\\b${_escapeRe(alias.toUpperCase())}\\b`).test(upper)) { make = real; break; }
  }
  if (!make) {
    for (const name of Object.keys(VEHICLE_MAKE_MODELS)) {
      if (new RegExp(`\\b${_escapeRe(name.toUpperCase())}\\b`).test(upper)) { make = name; break; }
    }
  }
  if (!make) return { year, make: '', model: '' };

  // Model: the make's known models, longest match first (multi-word wins)
  let model = '';
  const models = [...(VEHICLE_MAKE_MODELS[make] || [])].sort((a, b) => b.length - a.length);
  for (const m of models) {
    if (new RegExp(`\\b${_escapeRe(m.toUpperCase())}\\b`).test(upper)) { model = m; break; }
  }

  return { year, make, model };
}

/** Parse the donor vehicle from an uploaded filename (strips extension + stored-path timestamp). */
function parseVehicleFromFilename(name) {
  const base = String(name || '')
    .replace(/\.(xlsx|xls|xlsm|csv)$/i, '')
    .replace(/^\d{10,}[_-]/, '')      // stored as `${Date.now()}_${safeName}`
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return resolveVehicleFromText(base);
}

/**
 * Parse vehicle year/make/model from a GridX Connect sheet name.
 * Examples: "2008 Mercedes C350 AMG", "2007 Mercedes-Benz C350 AMG 535 - 679"
 */
function parseVehicleFromSheetName(sheetName) {
  // Dictionary resolver first — handles reversed order ("Q7 Audi") + color/noise words.
  const resolved = resolveVehicleFromText(sheetName);
  if (resolved.make && resolved.model) return resolved;

  const yearMatch = sheetName.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';

  // Remove year and clean up
  let rest = sheetName.replace(/\b(19|20)\d{2}\b/, '').trim();
  // Remove trailing range like "535 - 679"
  rest = rest.replace(/\d+\s*-\s*\d+\s*$/, '').trim();

  // First word is typically make, rest is model
  const words = rest.split(/\s+/).filter(Boolean);
  let make = '';
  let model = '';

  if (words.length >= 1) {
    // Handle "Mercedes-Benz" or "Mercedes"
    if (words[0].toLowerCase().startsWith('mercedes')) {
      make = 'MERCEDES-BENZ';
      model = words.slice(1).join(' ').trim();
    } else if (words[0].toLowerCase() === 'bmw') {
      make = 'BMW';
      model = words.slice(1).join(' ').trim();
    } else {
      make = words[0].toUpperCase();
      model = words.slice(1).join(' ').trim();
    }
  }

  // Fill any gaps from the dictionary resolver (canonical make/year the heuristic missed).
  return {
    year: year || resolved.year || '',
    make: make || resolved.make || '',
    model: model || resolved.model || '',
  };
}

/**
 * Extract a part from a GridX Connect format row.
 */
function extractGridxPart(row, colMap, sheetName, vehicleInfo) {
  const getVal = (idx) => idx >= 0 && idx < row.length ? clean(row[idx]) : '';
  const desc = getVal(colMap.description);
  const shortName = extractPartNameFromDescription(desc, vehicleInfo);

  // Scan all row text for VIN patterns
  const detectedVin = findVinInRow(row.map(c => clean(c)));

  return {
    vin: detectedVin || sheetName,    // Use detected VIN or sheet name as placeholder
    brand: getVal(colMap.make) || vehicleInfo.make,
    model: vehicleInfo.model,
    sku: getVal(colMap.sku),
    category: '',
    partNumber: getVal(colMap.partNumber),
    partName: shortName || desc,
    note: desc,
    _shortPartName: shortName,
    code: '',
    price: parseFloat(row[colMap.price >= 0 ? colMap.price : -1]) || 0,
    // GridX-specific fields preserved for downstream use
    _gridx: {
      images: getVal(colMap.images),
      quantity: parseInt(row[colMap.quantity >= 0 ? colMap.quantity : -1]) || 1,
      weightMajor: getVal(colMap.weightMajor),
      weightMinor: getVal(colMap.weightMinor),
      pkgLength: getVal(colMap.pkgLength),
      pkgWidth: getVal(colMap.pkgWidth),
      pkgDepth: getVal(colMap.pkgDepth),
    },
    _vehicleInfo: vehicleInfo,
  };
}

/**
 * Parse vehicle year/make/model from a parts description string and brand.
 * Handles patterns like:
 *   "Jaguar XJ X351 Fuel Tank Mount A00-PW-020 3.0 Petrol 250kw 2016"
 *   "14-22 Range Rover Sport L494 FUEL TANK PUMP..."
 *   "2013 2014 2015 2016 Audi A4 AC Heat Climate..."
 *   "2010-2015 VW PASSAT B7 HEATER CLIMATE CONTROL..."
 */
function parseVehicleFromDescription(desc, brand) {
  if (!desc) return null;
  const text = desc.trim();
  const brandNorm = normalizeBrand(brand);

  // Shared make → model + alias knowledge (module-level single source of truth)
  const MAKE_MODELS = VEHICLE_MAKE_MODELS;
  const MAKE_ALIASES = VEHICLE_MAKE_ALIASES;

  const textUpper = text.toUpperCase();

  // ── Extract years ──
  // Pattern 1: "2013-2017" or "14-22" year ranges
  // Pattern 2: Multiple years "2013 2014 2015 2016"
  let years = [];
  const rangeMatch = text.match(/\b((?:19|20)?(\d{2}))\s*[-–]\s*((?:19|20)?(\d{2}))\b/);
  if (rangeMatch) {
    let startY = parseInt(rangeMatch[1]);
    let endY = parseInt(rangeMatch[3]);
    if (startY < 100) startY += startY > 50 ? 1900 : 2000;
    if (endY < 100) endY += endY > 50 ? 1900 : 2000;
    for (let y = startY; y <= endY; y++) years.push(String(y));
  }
  if (years.length === 0) {
    const multiYearMatch = text.match(/\b((?:19|20)\d{2})(?:\s+(?:19|20)\d{2})+\b/);
    if (multiYearMatch) {
      const allYears = multiYearMatch[0].match(/(19|20)\d{2}/g);
      if (allYears) years = allYears;
    }
  }
  if (years.length === 0) {
    // Single year anywhere in the text
    const singleYear = text.match(/\b(19|20)\d{2}\b/);
    if (singleYear) years = [singleYear[0]];
  }

  // ── Determine make ──
  let make = brandNorm || '';
  // Also try to find make in description if brand is generic or missing
  if (!make || make === 'Unknown') {
    for (const [alias, realMake] of Object.entries(MAKE_ALIASES)) {
      if (textUpper.includes(alias.toUpperCase())) { make = realMake; break; }
    }
  }
  // Direct make name match
  if (!make || make === 'Unknown') {
    for (const makeName of Object.keys(MAKE_MODELS)) {
      if (textUpper.includes(makeName.toUpperCase())) { make = makeName; break; }
    }
  }

  if (!make) return null;

  // ── Extract model ──
  let model = '';
  const models = MAKE_MODELS[make] || [];
  for (const m of models) {
    if (textUpper.includes(m.toUpperCase())) {
      model = m;
      break;
    }
  }

  // Fallback: try to find model pattern after make name in description
  if (!model) {
    const makeIdx = textUpper.indexOf(make.toUpperCase());
    if (makeIdx >= 0) {
      const afterMake = text.slice(makeIdx + make.length).trim();
      // Match common model patterns: A4, XJ, 911, Golf, etc.
      const modelMatch = afterMake.match(/^[,\s]*(\b[A-Z0-9][\w-]{0,15}\b)/i);
      if (modelMatch) {
        const candidate = modelMatch[1].trim();
        // Reject if it looks like a part description word
        const rejectWords = new Set(['FRONT','REAR','LEFT','RIGHT','UPPER','LOWER','INNER','OUTER','POWER','FUEL','AC','OEM','DOOR','SIDE','MOUNT','CONTROL','MODULE','TRIM','PANEL','COVER','BUMPER','SENSOR','PUMP','MOTOR','LIGHT','LAMP','SWITCH','VALVE','RELAY','FUSE','BRACKET','SUPPORT','HOUSING','ASSEMBLY','WIRING','HARNESS','CABLE','HOSE','PIPE','TUBE','FILTER']);
        if (!rejectWords.has(candidate.toUpperCase()) && candidate.length <= 15) {
          model = candidate;
        }
      }
    }
  }

  if (!model) return null;

  return {
    year: years[0] || '',
    years: years,
    make: make,
    model: model,
  };
}

/**
 * Derive a concise part name from GridX/supplier description text.
 * Strips donor-vehicle boilerplate (year, make, VIN, "this is C-350 2008 model", etc.)
 * so titles and item specifics use the actual component name.
 */
function extractPartNameFromDescription(desc, vehicle = {}) {
  if (!desc) return '';
  let text = clean(desc);

  // GridX rows embed "<17-char VIN>, Make, Model," before the part name — strip it
  // at the source so the VIN/duplicate make-model never reaches the name or title.
  text = text
    .replace(
      /\b[A-HJ-NPR-Z0-9]{17}\s*,\s*[A-Za-z][A-Za-z-]*\s*,\s*[A-Za-z0-9]+\s*,?\s*/gi,
      '',
    )
    .trim();

  text = text
    .replace(/\bthis is\b[^,]*,?\s*/gi, '')
    .replace(/\bvin\s+[A-HJ-NPR-Z0-9]{11,17}\b/gi, '')
    .replace(/\b(?:19|20)\d{2}\s*model\b/gi, '')
    .replace(/\bengine type model\s+[\d.]+\b/gi, '')
    .replace(/\bit is\b/gi, '')
    .replace(/\b(?:complete working engine tested|tested)\.?$/gi, '')
    .trim();

  // Strip leading "2008 MERCEDES C-350" / year + make + model prefixes
  text = text.replace(
    /^(?:19|20)\d{2}\s+(?:MERCEDES(?:-BENZ)?|BMW|AUDI|VOLKSWAGEN|TOYOTA|HONDA|FORD|JAGUAR|LAND ROVER|PORSCHE)[\s\w-]*?\s+/i,
    '',
  ).trim();

  if (vehicle.make) {
    const makeEsc = vehicle.make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const modelEsc = (vehicle.model || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (modelEsc) {
      text = text.replace(
        new RegExp(`^(?:19|20)\\d{2}\\s+${makeEsc}\\s+${modelEsc}\\s+`, 'i'),
        '',
      ).trim();
    }
    text = text.replace(new RegExp(`^${makeEsc}\\s+`, 'i'), '').trim();
  }

  text = text.replace(/\b(?:used|oem|genuine|new)\s*$/gi, '').trim();

  // GridX engine rows: "VIN ... M - Engine type model 204.056 it is complete working engine"
  const dashSegment = text.split(/\s+-\s+/).pop()?.trim();
  if (dashSegment && dashSegment.length >= 8 && dashSegment.length <= 90) {
    text = dashSegment;
  }

  if (/\bcomplete working engine\b/i.test(text)) {
    text = 'Complete Working Engine';
  } else if (/\bengine assembly\b/i.test(text)) {
    text = 'Engine Assembly';
  } else if (/^\s*engine\b/i.test(text) || /\bengine\b/i.test(text) && text.length <= 40) {
    text = text
      .replace(/\bengine type model\s+[\d.]+\b/gi, '')
      .replace(/\bit is\b/gi, '')
      .trim();
    if (/^engine\b/i.test(text)) text = titleCase(text);
  }

  // Strip Mercedes chassis/trim tokens left in part names (C-350, C350, W204)
  text = text
    .replace(/\bC-?\d{3}(?:\s*AMG)?\b/gi, '')
    .replace(/\bW\d{3}\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > 70 || /\bvin\b/i.test(text)) {
    const clause = text.split(/[.;]/)[0].trim();
    if (clause.length >= 8) text = clause;
  }

  if (text.length > 80) {
    text = text.slice(0, 77).trim() + '...';
  }

  return titleCase(text) || titleCase(desc.split(/[.;]/)[0].slice(0, 60));
}

/** Resolve eBay MVL-compatible model + trim from donor vehicle strings. */
function getEbayFitmentModelFields(make, model, trim = '') {
  const makeName = normalizeBrand(make);
  const rawModel = clean(model);
  const platformModel = normalizeModelForPlatform(makeName, rawModel);
  const mappedToClass =
    platformModel !== rawModel &&
    (platformModel.includes('-Class') || platformModel.includes(' Series') || /^[A-Z]\d{1,2}$/i.test(platformModel));

  const ebayModel = mappedToClass ? platformModel : rawModel;
  let ebayTrim = clean(trim);
  if (mappedToClass && !ebayTrim) {
    ebayTrim = rawModel;
  }
  return { model: ebayModel, trim: ebayTrim };
}

function resolvePartDisplayName(part, vehicle) {
  return part._shortPartName ||
    extractPartNameFromDescription(part.partName || part.note, vehicle) ||
    titleCase(part.partName || '');
}

function buildColumnMap(headers) {
  const map = {
    sku: -1, brand: -1, model: -1, vin: -1,
    category: -1, partNumber: -1, partName: -1,
    note: -1, code: -1, price: -1, quantity: -1,
    images: -1, make: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;

    // --- exact matches (original) ---
    if (h === 'sku' || h === 's.no' || h === 'bu no.' || h === 'bu no') map.sku === -1 && (map.sku = i);
    if (h === 'brand' || h === 'make') map.brand === -1 && (map.brand = i);
    if (h === 'model') map.model = i;
    if (h === 'vin') map.vin = i;
    if (h === 'category') map.category = i;
    if (h === 'part number' || h === 'oem number' || h === 'oem no' || h === 'part no' || h === 'part no.') map.partNumber === -1 && (map.partNumber = i);
    if ((h === 'name' || h === 'part name' || h === 'parts description' || h === 'part description' || h === 'part title' || h === 'title' || h === 'description') && map.partName === -1) map.partName = i;
    if (h === 'note' || h === 'notes' || h === 'additional details') map.note === -1 && (map.note = i);
    if (h === 'code') map.code = i;
    if (h === 'price' || h === 'real price' || h === 'unit price' || h === 'sell price') map.price === -1 && (map.price = i);
    if (h === 'q' || h === 'qty' || h === 'quantity') map.quantity === -1 && (map.quantity = i);
    // Image URL column — pipe-separated or single URL
    if (h === 'image urls' || h === 'images' || h === 'image url' || h === 'picurl' || h === 'item photo url') map.images === -1 && (map.images = i);
    // Vehicle make (for GridX-style files parsed as standard format)
    if (h === 'vehicle make' || h === 'make') map.make === -1 && (map.make = i);
  }

  // Handle variant layouts:
  // Some sheets: [SKU, Brand, Model, VIN, Category, Name, PartNumber, PartName, Code, null, Price]
  // Others:      [Brand, Name, Model, VIN, SKU, Category, PartNumber, Name, Code, Notes, Price]
  // Fix: if "name" appears twice, second is partName
  const nameIndices = [];
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === 'name') nameIndices.push(i);
  }
  if (nameIndices.length === 2) {
    // First "Name" in Brand/Name/Model layout = vehicle name → treat as partName context
    // Second "Name" = part name
    // But also check if "part number" is between them
    map.partName = nameIndices[1];
    // If first "Name" col is index 1 and we have Brand at 0, it's a model alias
    if (nameIndices[0] === 1 && map.brand === 0) {
      // "Name" at index 1 is the vehicle name (Brand Name Model format)
      // Keep partName as second Name
    }
  }

  // If price is still not found, check last column
  if (map.price === -1) {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i] === 'price') { map.price = i; break; }
    }
    // If still not found, last non-null header
    if (map.price === -1) map.price = headers.length - 1;
  }

  return map;
}

function extractPart(row, colMap, sheetVin) {
  const getVal = (idx) => idx >= 0 && idx < row.length ? clean(row[idx]) : '';

  const brand = getVal(colMap.brand);
  const partName = getVal(colMap.partName);
  const note = getVal(colMap.note);

  // Try to parse vehicle info from description when no VIN column exists
  const descVehicle = parseVehicleFromDescription(partName || note, brand);

  // Scan all row text for VIN patterns if no VIN column value exists
  const colVin = getVal(colMap.vin);
  const detectedVin = colVin || findVinInRow(row.map(c => clean(c)));

  const part = {
    vin: detectedVin || sheetVin,
    brand: brand,
    model: getVal(colMap.model),
    sku: getVal(colMap.sku) || getVal(colMap.category),
    category: getVal(colMap.category),
    partNumber: getVal(colMap.partNumber),
    partName: partName,
    note: note,
    code: getVal(colMap.code),
    price: parseFloat(row[colMap.price]) || 0,
  };

  // Attach quantity if available
  if (colMap.quantity >= 0) {
    part._quantity = parseInt(row[colMap.quantity]) || 1;
  }

  // Attach image URLs if available (pipe-separated in the input file)
  const rawImages = getVal(colMap.images);
  if (rawImages) {
    part._gridx = { ...(part._gridx || {}), images: rawImages };
    part._sourceImageUrls = rawImages
      .split(/[|,;]/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http'));
  }
  // Attach vehicle make if available (GridX-style files parsed as standard format)
  const vehicleMake = getVal(colMap.make);
  if (vehicleMake && !part.brand) {
    part.brand = vehicleMake;
  }

  // Attach parsed vehicle info from description
  if (descVehicle) {
    part._vehicleInfo = {
      year: descVehicle.year,
      make: descVehicle.make,
      model: descVehicle.model,
    };
    part._descYears = descVehicle.years; // all years found in description
  }

  return part;
}

// ═══════════════════════════════════════════════════════════════════════
//  VIN DECODE + VEHICLE DATA
// ═══════════════════════════════════════════════════════════════════════

async function decodeAllVins(parts) {
  log.step('VIN Decoding (NHTSA Batch API)');
  const uniqueVins = [...new Set(parts.map(p => p.vin).filter(v => v.length >= 11))];
  log.info(`Decoding ${uniqueVins.length} unique VINs...`);

  const results = new Map();

  // NHTSA Batch API: decode up to 50 VINs in a single POST (massively faster)
  // Process multiple batches in parallel (up to 3 concurrent API requests)
  const vinBatches = chunk(uniqueVins, 50);
  const VIN_BATCH_CONCURRENCY = CONFIG.pipeline.vinBatchConcurrency;

  for (let batchGroupStart = 0; batchGroupStart < vinBatches.length; batchGroupStart += VIN_BATCH_CONCURRENCY) {
    const batchGroup = vinBatches.slice(batchGroupStart, batchGroupStart + VIN_BATCH_CONCURRENCY);

    await Promise.allSettled(batchGroup.map(async (batch) => {
    try {
      const vinList = batch.map(v => v.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase()).join(';');
      const { data } = await axios.post(
        'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/',
        `DATA=${encodeURIComponent(vinList)}&format=json`,
        { timeout: 30000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      for (const row of (data.Results || [])) {
        const vin = (row.VIN || '').toUpperCase();
        if (!vin || vin.length < 11) continue;

        const year = row.ModelYear || '';
        const make = row.Make || '';
        const model = row.Model || '';

        if (year && make) {
          const decoded = {
            vin,
            year,
            make,
            model,
            trim: row.Trim || '',
            bodyClass: row.BodyClass || '',
            engineCylinders: row.EngineCylinders || '',
            engineDisplacement: row.DisplacementL || '',
            engineModel: row.EngineModel || '',
            fuelType: row.FuelTypePrimary || '',
            driveType: row.DriveType || '',
            plantCountry: row.PlantCountry || '',
            vehicleType: row.VehicleType || '',
            manufacturer: row.Manufacturer || '',
          };
          vinCache.set(vin.slice(0, 17), decoded);
          results.set(vin, decoded);
          // Also map original-cased VINs from the batch
          for (const orig of batch) {
            if (orig.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase() === vin) {
              results.set(orig, decoded);
            }
          }
          REPORT.vinDecodeSuccess++;
          log.info(`  ✓ ${vin} → ${year} ${make} ${model}`);
        } else {
          REPORT.vinDecodeFail++;
          log.warn(`  ✗ ${vin} → decode returned incomplete data`);
        }
      }
    } catch (err) {
      log.warn(`NHTSA batch decode failed, falling back to individual: ${err.message}`);
      // Fallback: parallel individual decoding with concurrency limit
      const VIN_CONCURRENCY = 5;
      for (let i = 0; i < batch.length; i += VIN_CONCURRENCY) {
        const group = batch.slice(i, i + VIN_CONCURRENCY);
        const decodeResults = await Promise.allSettled(group.map(v => decodeVin(v)));
        for (let j = 0; j < group.length; j++) {
          const r = decodeResults[j];
          if (r.status === 'fulfilled' && r.value) {
            results.set(group[j], r.value);
            log.info(`  ✓ ${group[j]} → ${r.value.year} ${r.value.make} ${r.value.model}`);
          } else {
            log.warn(`  ✗ ${group[j]} → decode failed, using sheet data`);
          }
        }
      }
    }
    }));
  }

  log.info(`VIN decode: ${REPORT.vinDecodeSuccess} success, ${REPORT.vinDecodeFail} failed`);
  log.progress({ stage: 'vin_decode', vin_success: REPORT.vinDecodeSuccess, vin_failed: REPORT.vinDecodeFail, total_parts: parts.length });
  return results;
}

function getVehicleInfo(part, vinData) {
  const decoded = vinData.get(part.vin);
  let v;
  // Only use decoded VIN data if it actually has meaningful year+make
  // (GridX sheet names like "2008 Mercedes C350 AMG" may pass VIN decode
  //  but return empty fields, which would override _vehicleInfo)
  if (decoded && decoded.year && decoded.make) {
    v = {
      year: decoded.year,
      make: decoded.make,
      model: decoded.model,
      trim: decoded.trim,
      engine: decoded.engineModel || `${decoded.engineDisplacement}L ${decoded.engineCylinders}cyl`,
      bodyClass: decoded.bodyClass,
      engineCylinders: decoded.engineCylinders,
      engineDisplacement: decoded.engineDisplacement,
      fuelType: decoded.fuelType,
      driveType: decoded.driveType,
    };
  } else if (part._vehicleInfo) {
    // GridX Connect parts carry pre-parsed vehicle info from the sheet name
    v = {
      year: part._vehicleInfo.year || '',
      make: part._vehicleInfo.make || '',
      model: part._vehicleInfo.model || '',
      trim: '',
      engine: '',
      bodyClass: '',
      engineCylinders: '',
      engineDisplacement: '',
      fuelType: '',
      driveType: '',
    };
  } else {
    // Fallback: parse from sheet data
    const brand = titleCase(part.brand);
    const model = part.model || '';
    // Try to extract year from model string (e.g. "XF 2009 - 2015 (X250)")
    const yearMatch = model.match(/\b(19|20)\d{2}\b/);
    v = {
      year: yearMatch ? yearMatch[0] : '',
      make: brand,
      model: model.replace(/\d{4}[\s\-]*/g, '').replace(/\(.*?\)/g, '').trim(),
      trim: '',
      engine: '',
      bodyClass: '',
      engineCylinders: '',
      engineDisplacement: '',
      fuelType: '',
      driveType: '',
    };
  }

  // Gap-fill from the donor vehicle parsed off the uploaded filename. For a
  // single-vehicle workbook (e.g. "Q7 AUDI SILVER 2008.xlsx") this supplies the
  // year/make/model that no VIN or sheet name provided, so the AI identifies the
  // correct part and the title leads with Year/Make/Model. VIN/sheet data always
  // wins — only empty fields are filled.
  if (!v.year && DONOR_VEHICLE.year) v.year = DONOR_VEHICLE.year;
  if (!v.make && DONOR_VEHICLE.make) v.make = DONOR_VEHICLE.make;
  if (!v.model && DONOR_VEHICLE.model) v.model = DONOR_VEHICLE.model;

  return v;
}

// ═══════════════════════════════════════════════════════════════════════
//  OEM PART IDENTIFICATION (eBay Browse — identity truth-gate)
// ═══════════════════════════════════════════════════════════════════════

/** Normalize a part number for grouping unique Browse lookups. */
function normalizePartNumberKey(pn) {
  return String(pn || '').toUpperCase().replace(/[\s\-_.\/\\]+/g, '');
}

/**
 * Anchor each row's part name/type to eBay's live catalog by searching its OEM
 * part number on the Browse API. When >= minAgreement live listings agree on a
 * leaf category and expose a Type aspect, that verified component identity
 * overrides the noisy description-derived name — so the AI titles the correct
 * part instead of inferring the wrong one. Rows we cannot confidently anchor
 * (blank/garbage part number, no agreement, no Type) keep the existing path.
 *
 * Runs once per UNIQUE part number (deduped) with bounded concurrency + disk
 * cache, before category mapping and enrichment so both benefit.
 */
async function identifyPartsByOem(parts) {
  if (!oemIdentifyEnabled) {
    log.info('OEM identification (eBay Browse) disabled via PIPELINE_OEM_IDENTIFY');
    return;
  }

  const token = await getEbayAppToken();
  if (!token) {
    log.warn('OEM identification skipped — no eBay application token');
    return;
  }

  log.step('OEM Part Identification (eBay Browse)');

  // Group parts by normalized part number → one Browse lookup per unique number.
  const groups = new Map();
  for (const part of parts) {
    const key = normalizePartNumberKey(part.partNumber);
    if (key.length < 5) {
      REPORT.oemIdentification.skipped++;
      continue;
    }
    if (!groups.has(key)) groups.set(key, { partNumber: (part.partNumber || '').trim(), parts: [] });
    groups.get(key).parts.push(part);
  }

  const uniqueGroups = [...groups.values()];
  REPORT.oemIdentification.uniqueNumbers = uniqueGroups.length;
  if (uniqueGroups.length === 0) {
    log.info('OEM identification: no usable part numbers to anchor');
    return;
  }

  log.info(`Identifying ${uniqueGroups.length} unique part number(s) via eBay Browse...`);

  let processed = 0;
  const runGroup = async (group) => {
    const result = await oemIdentifier.identify(group.partNumber);
    processed++;
    if (processed % 25 === 0 || processed === uniqueGroups.length) {
      log.progress({ sub_stage: 'oem_identify', total_parts: parts.length, processed });
    }
    if (!result || result.confidence !== 'high') {
      if (result && result.confidence === 'none') REPORT.oemIdentification.lowConfidence++;
      return;
    }
    // Category agreed but no authoritative Type aspect — don't rename the part.
    const verifiedType = result.type ? titleCase(result.type) : null;
    if (!verifiedType) return;

    REPORT.oemIdentification.identified++;
    for (const part of group.parts) {
      part._rawPartName = part._rawPartName ?? part.partName;
      part._verifiedPartType = verifiedType;
      part._verifiedIdentity = {
        type: verifiedType,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        source: 'ebay-browse',
        matchCount: result.matchCount,
      };
      // Drive category keywords (buildCategoryKeywords), the enrichment prompt,
      // and deterministic titles (resolvePartDisplayName) off the verified name.
      part.partName = verifiedType;
      part._shortPartName = verifiedType;
      REPORT.oemIdentification.partsUpdated++;
    }
  };

  for (let i = 0; i < uniqueGroups.length; i += oemIdentifyConcurrency) {
    const slice = uniqueGroups.slice(i, i + oemIdentifyConcurrency);
    await Promise.all(slice.map(runGroup));
  }

  const s = oemIdentifier.getStats();
  log.info(
    `OEM identification: ${REPORT.oemIdentification.identified} anchored, ` +
    `${REPORT.oemIdentification.lowConfidence} low-confidence, ` +
    `${REPORT.oemIdentification.partsUpdated} rows updated ` +
    `(browse calls=${s.calls}, cache hits=${s.cacheHits}, errors=${s.errors})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════════════

async function fallbackCategoryForMarketplace(lookup, vinData, marketplace, usCategoryName) {
  const cfg = getMarketplaceConfig(marketplace);
  const usFallback = fallbackCategoryMatch(lookup.parts[0].partName, lookup.parts[0].note);
  const hintName = usCategoryName || usFallback.categoryName;
  const keywords = buildCategoryKeywords(lookup, (p) => getVehicleInfo(p, vinData), hintName);
  let resolved = await suggestCategoryForTree(keywords, cfg.treeId);
  if (resolved) {
    return normalizeCategoryResult(resolved, marketplace, 'fallback');
  }
  resolved = await suggestCategoryForTree(hintName, cfg.treeId);
  if (resolved) {
    return normalizeCategoryResult(resolved, marketplace, 'fallback');
  }
  const defaultCat = await getDefaultCategoryForTree(cfg.treeId, cfg.fallbackQuery);
  return normalizeCategoryResult(defaultCat, marketplace, 'fallback');
}

async function mapCategoriesForMarketplace(parts, vinData, marketplace, uniqueLookups, useEbay, useAi) {
  const cfg = getMarketplaceConfig(marketplace);
  _categoryMappingContext = { vinData, marketplace, treeId: cfg.treeId };

  log.info(
    `Category mapping [${marketplace}] tree=${cfg.treeId} (${cfg.label}) model=${categoryAiModel}`,
  );

  const partTypeCache = new Map();
  const taxonomyAvailable = useEbay && taxonomyApiEnabled;
  const pendingAi = [];

  if (taxonomyAvailable) {
    const CAT_CONCURRENCY = Math.min(CONFIG.pipeline.categoryConcurrency, 2);

    for (let i = 0; i < uniqueLookups.length; i += CAT_CONCURRENCY) {
      if (taxonomyClient.isRateLimited()) {
        pendingAi.push(...uniqueLookups.slice(i));
        log.warn(`[${marketplace}] Taxonomy rate-limited — routing to AI/fallback`);
        break;
      }

      const group = uniqueLookups.slice(i, i + CAT_CONCURRENCY);
      const results = await Promise.allSettled(
        group.map(async (lookup) => {
          const keywords = buildCategoryKeywords(lookup, (p) => getVehicleInfo(p, vinData));
          const category = await suggestCategoryForTree(keywords, cfg.treeId);
          return { partKey: lookup.partKey, category, lookup };
        }),
      );

      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        if (r.value.category) {
          const normalized = normalizeCategoryResult(r.value.category, marketplace, 'api');
          partTypeCache.set(r.value.partKey, normalized);
          bumpCategoryStat(marketplace, 'api');
        } else if (useAi) {
          pendingAi.push(r.value.lookup);
        } else {
          const category = await fallbackCategoryForMarketplace(
            r.value.lookup,
            vinData,
            marketplace,
            getPartCategory(r.value.lookup.parts[0], 'US')?.categoryName,
          );
          partTypeCache.set(r.value.partKey, category);
          bumpCategoryStat(marketplace, 'fallback');
        }
      }

      if (taxonomyClient.isRateLimited()) {
        pendingAi.push(...uniqueLookups.slice(i + CAT_CONCURRENCY));
        break;
      }
    }
  } else if (useAi) {
    pendingAi.push(...uniqueLookups);
  } else {
    for (const lookup of uniqueLookups) {
      const category = await fallbackCategoryForMarketplace(
        lookup,
        vinData,
        marketplace,
        getPartCategory(lookup.parts[0], 'US')?.categoryName,
      );
      partTypeCache.set(lookup.partKey, category);
      bumpCategoryStat(marketplace, 'fallback');
    }
  }

  if (pendingAi.length && useAi) {
    const dedupedAi = pendingAi.filter(
      (l, idx, arr) => arr.findIndex((x) => x.partKey === l.partKey) === idx,
    );
    const aiBefore = aiCategoryClassifier.getStats().apiMapped;
    const aiResults = await aiCategoryClassifier.classifyLookups(
      dedupedAi,
      (part) => getVehicleInfo(part, vinData),
      marketplace,
    );
    const aiMappedNow = aiCategoryClassifier.getStats().apiMapped - aiBefore;
    REPORT.categoryByMarketplace[marketplace].ai += aiMappedNow;
    REPORT.categoryMappingAi += aiMappedNow;

    for (const lookup of dedupedAi) {
      if (partTypeCache.get(lookup.partKey)) continue;
      const aiCategory = aiResults.get(lookup.partKey);
      if (aiCategory) {
        partTypeCache.set(
          lookup.partKey,
          normalizeCategoryResult(aiCategory, marketplace, 'ai'),
        );
        continue;
      }
      const category = await fallbackCategoryForMarketplace(
        lookup,
        vinData,
        marketplace,
        getPartCategory(lookup.parts[0], 'US')?.categoryName,
      );
      partTypeCache.set(lookup.partKey, category);
      bumpCategoryStat(marketplace, 'fallback');
    }
  } else if (pendingAi.length) {
    for (const lookup of pendingAi) {
      if (partTypeCache.get(lookup.partKey)) continue;
      const category = await fallbackCategoryForMarketplace(
        lookup,
        vinData,
        marketplace,
        getPartCategory(lookup.parts[0], 'US')?.categoryName,
      );
      partTypeCache.set(lookup.partKey, category);
      bumpCategoryStat(marketplace, 'fallback');
    }
  }

  // Cross-resolve AU/DE from US category name when still missing
  if (marketplace !== 'US' && taxonomyAvailable) {
    for (const lookup of uniqueLookups) {
      if (partTypeCache.get(lookup.partKey)) continue;
      const usCat = getPartCategory(lookup.parts[0], 'US');
      if (!usCat?.categoryName) continue;
      const keywords = buildCategoryKeywords(
        lookup,
        (p) => getVehicleInfo(p, vinData),
        usCat.categoryName,
      );
      const cross = await suggestCategoryForTree(keywords, cfg.treeId);
      if (cross) {
        partTypeCache.set(
          lookup.partKey,
          normalizeCategoryResult(cross, marketplace, 'cross'),
        );
        bumpCategoryStat(marketplace, 'cross');
      }
    }
  }

  for (const lookup of uniqueLookups) {
    if (!partTypeCache.get(lookup.partKey)) {
      const category = await fallbackCategoryForMarketplace(
        lookup,
        vinData,
        marketplace,
        getPartCategory(lookup.parts[0], 'US')?.categoryName,
      );
      partTypeCache.set(lookup.partKey, category);
      bumpCategoryStat(marketplace, 'fallback');
    }
    for (const part of lookup.parts) {
      setPartCategory(part, marketplace, partTypeCache.get(lookup.partKey));
    }
  }

  const stats = REPORT.categoryByMarketplace[marketplace];
  log.info(
    `[${marketplace}] categories: api=${stats.api} ai=${stats.ai} cross=${stats.cross} fallback=${stats.fallback}`,
  );
}

async function mapCategories(parts, vinData) {
  const useEbay = categoryMode !== 'keyword' && categoryMode !== 'ai';
  const useAi =
    categoryMode !== 'keyword' &&
    categoryMode !== 'ebay' &&
    Boolean(CONFIG.openai.apiKey);

  log.step(
    `Category Mapping (mode=${categoryMode}: eBay=${useEbay}, AI=${useAi}, AI model=${categoryAiModel})`,
  );

  const token = await getEbayAppToken();
  const taxonomyAvailable = useEbay && Boolean(token) && taxonomyApiEnabled;

  if (!taxonomyAvailable && useEbay) {
    const reason = REPORT.taxonomyApiSkippedReason || 'eBay taxonomy unavailable';
    log.warn(`eBay category API skipped: ${reason}`);
    recordTaxonomyError(reason, null, 'category_mapping');
  } else if (taxonomyAvailable) {
    const taxStats = taxonomyClient.getStats();
    log.info(
      `eBay Taxonomy enabled for ${getActivePipelineMarketplaces().join('/')}. ` +
      `Suggestion cache: ${taxStats.suggestionCacheHits} warm, ` +
      `daily ${taxStats.dailyUsage}/${taxStats.dailyQuota}`,
    );
  }

  for (const part of parts) {
    part._categories = part._categories || {};
  }

  const uniqueLookups = [];
  for (const part of parts) {
    const partKey = `${part.partName}|${part.note}`.toLowerCase();
    const existing = uniqueLookups.find((l) => l.partKey === partKey);
    if (existing) existing.parts.push(part);
    else uniqueLookups.push({ partKey, parts: [part] });
  }

  const activeMarketplaces = getActivePipelineMarketplaces();
  log.info(`${uniqueLookups.length} unique category lookups for ${parts.length} parts × ${activeMarketplaces.length} marketplace(s)`);

  for (const marketplace of activeMarketplaces) {
    await mapCategoriesForMarketplace(
      parts,
      vinData,
      marketplace,
      uniqueLookups,
      useEbay,
      useAi,
    );
  }

  for (const part of parts) {
    part._category = getPartCategory(part, 'US');
  }

  const taxStats = taxonomyClient.getStats();
  log.info(
    `Category mapping totals: ${REPORT.categoryMappingApi} eBay API (${taxStats.suggestionCacheHits} cache hits), ` +
    `${REPORT.categoryMappingAi} AI (${categoryAiModel}), ${REPORT.categoryMappingFallback} fallback`,
  );
  log.progress({
    stage: 'category_mapping',
    cat_api: REPORT.categoryMappingApi,
    cat_ai: REPORT.categoryMappingAi,
    cat_fallback: REPORT.categoryMappingFallback,
    cat_us: REPORT.categoryByMarketplace.US.api + REPORT.categoryByMarketplace.US.ai,
    cat_uk: REPORT.categoryByMarketplace.UK.api + REPORT.categoryByMarketplace.UK.ai,
    cat_au: REPORT.categoryByMarketplace.AU.api + REPORT.categoryByMarketplace.AU.ai,
    cat_de: REPORT.categoryByMarketplace.DE.api + REPORT.categoryByMarketplace.DE.ai,
    cat_taxonomy_backoff: REPORT.taxonomyApiSkippedReason ? 1 : 0,
    total_parts: parts.length,
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  OPENAI ENRICHMENT ENGINE
// ═══════════════════════════════════════════════════════════════════════

let _openai = null;
let openaiAvailable = false;

function getOpenAI() {
  if (!_openai) {
    if (!CONFIG.openai.apiKey) {
      log.warn('OPENAI_API_KEY not set — AI enrichment will use fallback mode');
      return null;
    }
    _openai = new OpenAI({
      apiKey: CONFIG.openai.apiKey,
      baseURL: CONFIG.openai.baseURL,
      defaultHeaders: {
        'HTTP-Referer': 'https://realtrackapp.com',
        'X-Title': 'RealTrackApp',
      },
    });
  }
  return _openai;
}

async function validateOpenAiKey() {
  const client = getOpenAI();
  if (!client) {
    REPORT.errors.push({ type: 'openai', message: 'OPENAI_API_KEY not configured' });
    return false;
  }

  const candidates = [...new Set([
    CONFIG.openai.model,
    env.OPENAI_MODEL_DEFAULT,
    env.OPENAI_CHAT_MODEL,
    env.OPENAI_MODEL_TEXT,
    env.OPENAI_MODEL_BULK,
    DEFAULT_CHAT_MODEL,
    'openai/gpt-4o-mini',
    'deepseek/deepseek-chat-v3-0324',
  ].filter(Boolean))];

  const probeErrors = [];

  for (const model of candidates) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Reply with OK' }],
        max_tokens: 16,
      });
      if (response.choices?.[0]?.message?.content) {
        openaiAvailable = true;
        if (CONFIG.openai.model !== model) {
          log.warn(`Primary model "${CONFIG.openai.model}" unavailable; using "${model}" for this run`);
        }
        CONFIG.openai.model = model;
        log.info(`OpenRouter validated (baseURL=${CONFIG.openai.baseURL}, model=${model})`);
        return true;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      probeErrors.push(`${model}: ${message}`);
      log.warn(`OpenRouter probe failed for "${model}": ${message}`);
    }
  }

  const detail = probeErrors.slice(0, 3).join(' | ');
  log.error(`OpenRouter validation failed for all candidate models at ${CONFIG.openai.baseURL}`);
  REPORT.errors.push({
    type: 'openai',
    message: `OpenRouter validation failed at ${CONFIG.openai.baseURL}${detail ? `: ${detail}` : ''}`,
  });
  return false;
}

function logAiRun(part, route, validation, attempt, guardFixes = [], extra = {}) {
  const entry = {
    sku: part.sku,
    partNumber: part.partNumber,
    partType: route.segmentKey?.split('|')[0] ?? 'general',
    price: part.price,
    lane: route.lane,
    model: route.model,
    attempt,
    promptVersion: PROMPT_VERSION,
    routingPolicyVersion: route.policyVersion,
    validationScore: validation?.score ?? null,
    hardFails: validation?.hardFails ?? [],
    softFails: validation?.softFails ?? [],
    escalated: attempt > 1,
    passedGate: validation?.pass ?? false,
    fitmentRowCount: validation?.fitmentRowCount ?? part._fitments?.length ?? 0,
    fitmentSource: part._fitmentSource ?? extra.fitmentSource ?? null,
    fitmentRowsPre: extra.fitmentRowsPre ?? null,
    fitmentRowsPost: part._fitments?.length ?? extra.fitmentRowsPost ?? null,
    tokensSavedEstimate: extra.tokensSavedEstimate ?? null,
    guardFixes,
    createdAt: new Date().toISOString(),
  };
  REPORT.aiRunLogs.push(entry);
  REPORT.routing.attemptsByLane[route.lane] =
    (REPORT.routing.attemptsByLane[route.lane] ?? 0) + 1;
}

function finalizeRoutingCostByLane() {
  const totalAttempts = REPORT.aiRunLogs.length;
  if (!totalAttempts) return;
  const estimatedTotalUsd = REPORT.openaiTokensUsed * 0.0000005;
  for (const log of REPORT.aiRunLogs) {
    const share = estimatedTotalUsd / totalAttempts;
    REPORT.routing.estimatedCostByLane[log.lane] =
      (REPORT.routing.estimatedCostByLane[log.lane] ?? 0) + share;
  }
}

async function enrichBatch(batchParts, vinData, options = {}) {
  const model = options.model ?? CONFIG.openai.model;
  const partsForPrompt = batchParts.map((part, idx) => {
    const vehicle = getVehicleInfo(part, vinData);
    const decoded = vinData.get(part.vin);
    const profile = getEnrichmentProfile(part.price, LOW_VALUE_MAX_PRICE);
    const obj = {
      index: idx,
      profile,
      sku: part.sku,
      brand: part.brand,
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
      vehicleTrim: vehicle.trim,
      vehicleEngine: vehicle.engine || decoded?.engineModel || '',
      vehicleBodyClass: vehicle.bodyClass || decoded?.bodyClass || '',
      vehicleDriveType: vehicle.driveType || decoded?.driveType || '',
      partName: part.partName,
      verifiedPartType: part._verifiedPartType || '',
      partNumber: part.partNumber,
      note: part.note,
      category: getPartCategory(part, 'US')?.categoryName || part._category?.categoryName || '',
      price: part.price,
    };
    // Strip empty values to reduce token usage
    for (const [k, v] of Object.entries(obj)) {
      if (v === '' || v == null) delete obj[k];
    }
    return obj;
  });

  const systemPrompt =
    FITMENT_EXPANSION_MODE === 'ai'
      ? buildMotorsEnrichmentSystemPromptLegacy()
      : buildMotorsEnrichmentSystemPrompt();
  const userPrompt = buildMotorsEnrichmentUserPrompt(partsForPrompt);

  const client = getOpenAI();
  if (!client) return null;

  for (let attempt = 1; attempt <= CONFIG.openai.maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: CONFIG.openai.temperature,
        ...(typeof CONFIG.openai.maxTokens === 'number' ? { max_tokens: CONFIG.openai.maxTokens } : {}),
        response_format: { type: 'json_object' },
      });

      REPORT.openaiCalls++;
      const usage = response.usage;
      if (usage) REPORT.openaiTokensUsed += (usage.total_tokens || 0);

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty OpenAI response');

      const parsed = parseOpenAiJson(content);
      // Handle both { items: [...] } and direct array
      const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.results || parsed.parts || [parsed]);

      return items;
    } catch (err) {
      REPORT.openaiErrors++;
      if (attempt < CONFIG.openai.maxRetries) {
        const rateLimited = isRateLimitError(err);
        const delay = rateLimited
          ? Math.pow(2, attempt) * 3000
          : Math.pow(2, attempt) * 1000;
        log.warn(
          `OpenAI call failed (attempt ${attempt}/${CONFIG.openai.maxRetries})${rateLimited ? ' [rate limit]' : ''}: ${err.message}. Retrying in ${delay}ms...`,
        );
        await sleep(delay);
      } else {
        log.error(`OpenAI enrichment failed after ${CONFIG.openai.maxRetries} attempts: ${err.message}`);
        REPORT.errors.push({ type: 'openai', message: err.message, batchSize: batchParts.length });
        return null;
      }
    }
  }
  return null;
}

function parseOpenAiJson(content) {
  const direct = tryJsonParse(content);
  if (direct.ok) return direct.value;

  // Fallback: try extracting the largest JSON object/array block from mixed output.
  const firstBrace = content.indexOf('{');
  const firstBracket = content.indexOf('[');
  const starts = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (starts.length === 0) {
    throw new Error(`OpenAI returned non-JSON content: ${direct.error}`);
  }
  const start = Math.min(...starts);
  const lastBrace = content.lastIndexOf('}');
  const lastBracket = content.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end <= start) {
    throw new Error(`OpenAI returned truncated JSON: ${direct.error}`);
  }

  const extracted = content.slice(start, end + 1);
  const extractedParse = tryJsonParse(extracted);
  if (extractedParse.ok) return extractedParse.value;

  // Last attempt: remove trailing commas before closing braces/brackets.
  const normalized = extracted.replace(/,\s*([}\]])/g, '$1');
  const normalizedParse = tryJsonParse(normalized);
  if (normalizedParse.ok) return normalizedParse.value;

  throw new Error(
    `Failed to parse OpenAI JSON (direct=${direct.error}; extracted=${extractedParse.error}; normalized=${normalizedParse.error})`,
  );
}

function tryJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function enrichBatchWithRouting(batchParts, vinData) {
  const representative = batchParts[0];
  const route = modelRouter.selectRoute(
    {
      sku: representative.sku,
      partNumber: representative.partNumber,
      partName: representative.partName,
      price: representative.price,
    },
    RUN_MODE,
  );

  const thresholds = modelRouter.getThresholds();
  const lowValueMax = thresholds.lowValueMaxPrice ?? LOW_VALUE_MAX_PRICE;
  const validated = new Array(batchParts.length);
  const uncachedParts = [];
  const uncachedIndices = [];

  for (let i = 0; i < batchParts.length; i++) {
    const srcPart = batchParts[i];
    const profile = getEnrichmentProfile(srcPart.price, lowValueMax);
    const identityKey = partIdentityKey(srcPart);
    const cached = enrichmentCache.get(srcPart.partNumber, profile, identityKey);
    if (cached) {
      REPORT.routing.enrichmentCacheHits++;
      const vehicle = getVehicleInfo(srcPart, vinData);
      const { item: guarded, fixes } = applyListingGuards(
        { ...cached, index: i },
        { partNumber: srcPart.partNumber },
      );
      if (fixes.length) REPORT.routing.guardFixes += fixes.length;
      const validation = validateListing(
        guarded,
        { partNumber: srcPart.partNumber, donorMake: vehicle.make },
        {
          fitmentMinRows: thresholds.fitmentMinRows,
          lowValueMaxPrice: lowValueMax,
          price: srcPart.price,
          compactProfile: profile === 'compact',
        },
      );
      logAiRun(srcPart, { ...route, lane: 'cache' }, validation, 0, fixes);
      validated[i] = { ...guarded, index: i };
    } else {
      uncachedParts.push(srcPart);
      uncachedIndices.push(i);
    }
  }

  let items = null;
  if (uncachedParts.length > 0) {
    items = await enrichBatch(uncachedParts, vinData, { model: route.model });
    if (!items) {
      if (validated.every((v) => v != null)) return validated;
      return null;
    }
  }

  let needsEscalation = false;
  let uncachedItemIdx = 0;

  for (let i = 0; i < batchParts.length; i++) {
    if (validated[i]) continue;

    const srcPart = batchParts[i];
    const vehicle = getVehicleInfo(srcPart, vinData);
    const profile = getEnrichmentProfile(srcPart.price, lowValueMax);
    const rawItem = items[uncachedItemIdx++] ?? items[items[uncachedItemIdx - 1]];
    const { item: guarded, fixes } = applyListingGuards(rawItem, {
      partNumber: srcPart.partNumber,
    });
    if (fixes.length) REPORT.routing.guardFixes += fixes.length;

    if (srcPart.partNumber) {
      enrichmentCache.set(srcPart.partNumber, profile, guarded, partIdentityKey(srcPart));
    }

    const validation = validateListing(guarded, {
      partNumber: srcPart.partNumber,
      donorMake: vehicle.make,
    }, {
      fitmentMinRows: thresholds.fitmentMinRows,
      lowValueMaxPrice: lowValueMax,
      price: srcPart.price,
      compactProfile: profile === 'compact',
      expectedBatchSize: uncachedParts.length,
      actualBatchSize: items?.length,
    });

    logAiRun(srcPart, route, validation, 1, fixes);
    if (!validation.pass && validation.escalate) {
      needsEscalation = true;
      REPORT.routing.validationFails++;
    }
    validated[i] = { ...guarded, index: rawItem.index ?? i };
  }

  if (needsEscalation && uncachedParts.length > 0) {
    const escalationModel = modelRouter.getEscalationModel(route.model, route.lane);
    if (escalationModel) {
      REPORT.routing.escalations++;
      log.info(`Escalating batch (${batchParts.length} parts) → ${escalationModel}`);
      const escalatedItems = await enrichBatch(uncachedParts, vinData, {
        model: escalationModel,
      });
      if (escalatedItems) {
        for (let u = 0; u < uncachedIndices.length; u++) {
          const i = uncachedIndices[u];
          const srcPart = batchParts[i];
          const vehicle = getVehicleInfo(srcPart, vinData);
          const profile = getEnrichmentProfile(srcPart.price, lowValueMax);
          const rawItem = escalatedItems[u] ?? escalatedItems[u - 1];
          const { item: guarded, fixes } = applyListingGuards(rawItem, {
            partNumber: srcPart.partNumber,
          });
          if (srcPart.partNumber) {
            enrichmentCache.set(srcPart.partNumber, profile, guarded, partIdentityKey(srcPart));
          }
          const validation = validateListing(guarded, {
            partNumber: srcPart.partNumber,
            donorMake: vehicle.make,
          }, {
            fitmentMinRows: thresholds.fitmentMinRows,
            lowValueMaxPrice: lowValueMax,
            price: srcPart.price,
            compactProfile: profile === 'compact',
          });
          logAiRun(
            srcPart,
            { ...route, lane: 'escalation', model: escalationModel },
            validation,
            2,
            fixes,
          );
          validated[i] = { ...guarded, index: rawItem.index ?? i };
        }
      }
    }
  }

  return validated;
}

async function enrichBatchAdaptive(batchParts, vinData, depth = 0) {
  const enriched = await enrichBatchWithRouting(batchParts, vinData);
  if (enriched) return enriched;

  // Split failed batches recursively to isolate problematic rows/payload size.
  if (batchParts.length <= 1 || depth >= 3) return null;

  const mid = Math.ceil(batchParts.length / 2);
  const left = batchParts.slice(0, mid);
  const right = batchParts.slice(mid);

  const [leftRes, rightRes] = await Promise.all([
    enrichBatchAdaptive(left, vinData, depth + 1),
    enrichBatchAdaptive(right, vinData, depth + 1),
  ]);

  if (!leftRes && !rightRes) return null;

  const merged = [];
  if (leftRes) merged.push(...leftRes);
  if (rightRes) {
    for (const item of rightRes) {
      merged.push({
        ...item,
        index: typeof item.index === 'number' ? item.index + mid : item.index,
      });
    }
  }
  return merged;
}

function applyBasicFallbackEnrichment(part, vinData, { countAsFailed = true } = {}) {
  const vehicle = getVehicleInfo(part, vinData);
  const pn = normalizePN(part.partNumber);
  const displayName = resolvePartDisplayName(part, vehicle);
  part._shortPartName = displayName;

  const makeLower = (vehicle.make || '').toLowerCase();
  const countryOfMfg = makeLower.includes('mercedes') || makeLower.includes('bmw') || makeLower.includes('audi') || makeLower.includes('volkswagen') || makeLower.includes('porsche')
    ? 'Germany'
    : makeLower.includes('toyota') || makeLower.includes('honda') || makeLower.includes('nissan') || makeLower.includes('lexus') || makeLower.includes('mazda') || makeLower.includes('subaru')
      ? 'Japan'
      : makeLower.includes('ford') || makeLower.includes('chevrolet') || makeLower.includes('gm') || makeLower.includes('chrysler') || makeLower.includes('dodge') || makeLower.includes('jeep')
        ? 'United States'
        : '';

  part._enriched = {
    title: buildSeoTitle(vehicle, part, pn),
    description: buildBasicDescription(part, vehicle),
    brand: normalizeBrand(part.brand) || vehicle.make,
    type: displayName,
    mpn: pn,
    oemNumber: expandOemNumbers(part.partNumber),
    placement: extractPlacement(part.note),
    material: '',
    warranty: 'No Warranty',
    fitmentType: 'Direct Replacement',
    color: '',
    interchangeNumber: '',
    surfaceFinish: '',
    performanceType: '',
    bundleDescription: '',
    countryOfManufacture: countryOfMfg,
    itemSpecifics: buildFallbackItemSpecifics(part, vehicle),
  };

  if (countAsFailed) REPORT.totalFailed++;
}

/** Apply one enrichment batch to parts; returns counts for progress reporting. */
function applyEnrichmentBatchResults(batch, enrichedItems, vinData) {
  let enriched = 0;
  let failed = 0;

  if (enrichedItems) {
    for (const item of enrichedItems) {
      const idx = item.index ?? enrichedItems.indexOf(item);
      if (idx < 0 || idx >= batch.length) continue;
      const part = batch[idx];
      part._enriched = {
        title: clean(item.title).slice(0, 80),
        description: clean(item.description),
        brand: clean(item.brand),
        type: clean(item.type),
        mpn: clean(item.mpn),
        oemNumber: clean(item.oemNumber),
        placement: clean(item.placement),
        material: clean(item.material),
        warranty: clean(item.warranty) || 'No Warranty',
        fitmentType: clean(item.fitmentType) || 'Direct Replacement',
        color: clean(item.color),
        interchangeNumber: clean(item.interchangeNumber),
        surfaceFinish: clean(item.surfaceFinish),
        performanceType: clean(item.performanceType),
        bundleDescription: clean(item.bundleDescription),
        itemSpecifics: sanitizeItemSpecifics(item.itemSpecifics),
        compatibility: Array.isArray(item.compatibility) ? item.compatibility : [],
        interchangeHints: Array.isArray(item.interchangeHints) ? item.interchangeHints : [],
        technicalNotes: clean(item.technicalNotes),
      };
      const vehicle = getVehicleInfo(part, vinData);
      const fallbackSpecifics = buildFallbackItemSpecifics(part, vehicle);
      const mergedSpecifics = mergeAiSpecificsOnly(
        fallbackSpecifics,
        part._enriched.itemSpecifics,
      );
      if (countAdditionalSpecifics(fallbackSpecifics, mergedSpecifics) > 0) {
        REPORT.specificsEnrichedCount++;
      }
      part._enriched.itemSpecifics = mergedSpecifics;
      enriched++;
    }
  } else {
    for (const part of batch) {
      applyBasicFallbackEnrichment(part, vinData);
      failed++;
    }
  }

  return { enriched, failed };
}

async function enrichAllParts(parts, vinData) {
  log.step('OpenAI Enrichment');

  // Validate API key first
  if (!await validateOpenAiKey()) {
    log.warn('OpenAI unavailable — using fallback enrichment for all parts');
    for (const part of parts) {
      applyBasicFallbackEnrichment(part, vinData);
    }
    REPORT.totalFailed = parts.length;
    log.progress({
      stage: 'enrichment_done',
      enriched: 0,
      failed: parts.length,
      total_parts: parts.length,
      processed: parts.length,
      enrichment_mode: 'fallback',
    });
    return;
  }

  const batches = chunk(parts, CONFIG.openai.batchSize);
  log.info(`Processing ${parts.length} parts in ${batches.length} batches of ${CONFIG.openai.batchSize} (concurrency ${CONFIG.openai.concurrency})...`);
  log.progress({ stage: 'enrichment', enriched: 0, failed: 0, total_parts: parts.length, processed: 0 });

  let enrichedCount = 0;
  let failedCount = 0;
  const concurrency = CONFIG.openai.concurrency;
  const pool = createConcurrencyPool(concurrency);

  const emitEnrichmentProgress = () => {
    log.progress({
      stage: 'enrichment',
      enriched: enrichedCount,
      failed: failedCount,
      total_parts: parts.length,
      processed: enrichedCount + failedCount,
      tokens: REPORT.openaiTokensUsed,
    });
  };

  // Keep N AI batches in flight; emit [PROGRESS] as each batch settles (not after all finish).
  await Promise.allSettled(
    batches.map((batch) =>
      pool.run(async () => {
        let enrichedItems = null;
        try {
          enrichedItems = await enrichBatchAdaptive(batch, vinData);
        } catch {
          enrichedItems = null;
        }

        const counts = applyEnrichmentBatchResults(batch, enrichedItems, vinData);
        enrichedCount += counts.enriched;
        failedCount += counts.failed;
        emitEnrichmentProgress();
      }),
    ),
  );

  REPORT.totalProcessed = enrichedCount;
  REPORT.totalFailed = failedCount;
  log.info(`Enrichment complete: ${enrichedCount} enriched, ${failedCount} basic fallback`);
  log.progress({
    stage: 'enrichment_done',
    enriched: enrichedCount,
    failed: failedCount,
    total_parts: parts.length,
    processed: parts.length,
    tokens: REPORT.openaiTokensUsed,
    enrichment_mode: getEnrichmentMode(),
  });
}

/**
 * Build an SEO-optimized eBay title following best practices.
 * Format: [Year] [Make] [Model] [Part Name] [Placement] [MPN] OEM
 * Max 80 chars.
 */
function buildSeoTitle(vehicle, part, normalizedPN) {
  const placement = extractPlacement(part.note);
  const partName = resolvePartDisplayName(part, vehicle);
  const fitments = part._fitments || part._enriched?.compatibility || [];

  // sanitizeTitle strips any VIN + duplicate make/model that leaked through the
  // part name (e.g. un-anchored GridX rows) so the deterministic title is clean.
  return sanitizeTitle(
    buildPlatformSeoTitle({
      vehicle,
      partName,
      mpn: normalizedPN,
      placement,
      fitments,
    }),
  );
}

function buildBasicDescription(part, vehicle) {
  const partName = resolvePartDisplayName(part, vehicle);
  const brandName = normalizeBrand(part.brand) || vehicle.make;
  const pn = part.partNumber || '';
  const modelLabel = normalizeModelForPlatform(vehicle.make, vehicle.model) || vehicle.model;

  // Generate a descriptive text paragraph
  const descText = `Genuine OEM ${partName}${pn ? ` part number ${pn}` : ''} for ${vehicle.year ? vehicle.year + ' ' : ''}${brandName} ${modelLabel}${vehicle.trim ? ' ' + vehicle.trim : ''}. This part has been carefully removed and inspected for quality assurance. Please verify part number compatibility with your vehicle before purchasing.`;

  return descText;
}

/**
 * Wrap description text in the rich CSS tabbed HTML layout matching
 * the reference eBay File Exchange template. Includes embedded fitment table
 * and policy tabs (Payment, Shipping, Returns, Handling, International).
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MARKETPLACE_TAB_SHELLS = {
  'en-US': {
    productTitle: 'Product Information',
    fitmentHeading: (n) => `Vehicle Compatibility (${n} applications)`,
    fitmentIntro: 'Complete fitment list — verify part number before purchasing.',
    fitmentCols: ['Year', 'Make', 'Model', 'Submodel', 'Trim', 'Engine'],
    tabs: ['Payment Policy', 'Shipping Policy', 'Returns Policy', 'Handling Time', 'International Buyers'],
    policies: [
      '- We accept only online payment methods provided by eBay at checkout.',
      '- We provide worldwide shipping to most countries using reputed couriers like DHL, FedEx or Aramex.',
      '- We accept 14-day returns. Please clarify all doubts before purchasing.',
      '- All packages are shipped within 3 working days.',
      '- Import duties, taxes and charges are not included in the item price or shipping cost. These charges are the buyer\'s responsibility. Please check with your country\'s customs office before buying.',
    ],
  },
  'en-AU': {
    productTitle: 'Product Information',
    fitmentHeading: (n) => `Vehicle Compatibility (${n} applications)`,
    fitmentIntro: 'Complete fitment list — please verify part number compatibility before purchasing.',
    fitmentCols: ['Year', 'Make', 'Model', 'Submodel', 'Trim', 'Engine'],
    tabs: ['Payment Policy', 'Shipping Policy', 'Returns Policy', 'Handling Time', 'International Buyers'],
    policies: [
      '- We accept only online payment methods provided by eBay at checkout.',
      '- We ship Australia-wide and internationally via DHL, FedEx or Aramex.',
      '- We accept 14-day returns. Please clarify all doubts before purchasing.',
      '- All packages are dispatched within 3 business days.',
      '- Import duties, taxes and charges are not included in the item price or shipping cost. These charges are the buyer\'s responsibility. Please check with your country\'s customs office before buying.',
    ],
  },
  'de-DE': {
    productTitle: 'Produktinformationen',
    fitmentHeading: (n) => `Fahrzeugkompatibilität (${n} Anwendungen)`,
    fitmentIntro: 'Vollständige Passgenauigkeitsliste — bitte prüfen Sie die Teilenummer vor dem Kauf.',
    fitmentCols: ['Baujahr', 'Marke', 'Modell', 'Untermodell', 'Ausstattung', 'Motor'],
    tabs: ['Zahlungsrichtlinie', 'Versandrichtlinie', 'Rückgaberichtlinie', 'Bearbeitungszeit', 'Internationale Käufer'],
    policies: [
      '- Wir akzeptieren ausschließlich die bei eBay angebotenen Online-Zahlungsmethoden.',
      '- <strong>Artikelstandort: Vereinigte Staaten (USA).</strong> Internationaler Versand nach Deutschland und in viele weitere Länder (z. B. DHL, FedEx).',
      '- Die Lieferzeit kann variieren. Einfuhrzölle, Steuern und Gebühren sind nicht im Artikel- oder Versandpreis enthalten — Käuferpflicht.',
      '- 14-tägige Rückgabe möglich. Bitte klären Sie alle Fragen vor dem Kauf.',
      '- Versand in der Regel innerhalb von 3–5 Werktagen nach Zahlungseingang.',
    ],
  },
};

const DE_VALUE_MAP = {
  'No Warranty': 'Keine Garantie',
  'Direct Replacement': 'Direkter Ersatz',
  'Does not apply': 'Nicht zutreffend',
  'Used': 'Gebraucht',
  'New': 'Neu',
  'Front': 'Vorne',
  'Rear': 'Hinten',
  'Left': 'Links',
  'Right': 'Rechts',
  'Upper': 'Oben',
  'Lower': 'Unten',
  'Driver Side': 'Fahrerseite',
  'Passenger Side': 'Beifahrerseite',
};

function mapLocalizedTokens(value, tokenMap) {
  if (!value) return value;
  let out = String(value);
  for (const [en, localized] of Object.entries(tokenMap)) {
    out = out.replace(new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), localized);
  }
  return out;
}

function applyRuleBasedLocalization(enriched, locale) {
  const copy = {
    title: enriched.title,
    description: enriched.description,
    brand: enriched.brand,
    type: enriched.type,
    placement: enriched.placement,
    warranty: enriched.warranty || 'No Warranty',
    fitmentType: enriched.fitmentType || 'Direct Replacement',
    material: enriched.material,
    color: enriched.color,
    surfaceFinish: enriched.surfaceFinish,
    bundleDescription: enriched.bundleDescription,
    itemSpecifics: enriched.itemSpecifics ? { ...enriched.itemSpecifics } : {},
    aiTranslated: false,
  };

  if (locale === 'de-DE') {
    copy.warranty = DE_VALUE_MAP[copy.warranty] || copy.warranty;
    copy.fitmentType = DE_VALUE_MAP[copy.fitmentType] || copy.fitmentType;
    copy.placement = mapLocalizedTokens(copy.placement, DE_VALUE_MAP);
    copy.type = mapLocalizedTokens(copy.type, DE_VALUE_MAP);
    copy.material = mapLocalizedTokens(copy.material, DE_VALUE_MAP);
    copy.color = mapLocalizedTokens(copy.color, DE_VALUE_MAP);
    copy.surfaceFinish = mapLocalizedTokens(copy.surfaceFinish, DE_VALUE_MAP);
    for (const [key, val] of Object.entries(copy.itemSpecifics)) {
      copy.itemSpecifics[key] = mapLocalizedTokens(val, DE_VALUE_MAP);
    }
  }

  return copy;
}

function fitmentsForExport(part, vinData) {
  const vehicle = getVehicleInfo(part, vinData);
  const source = part._fitments?.length
    ? part._fitments
    : vehicle.year
      ? [vehicle]
      : [];
  return source.slice(0, exportMaxFitmentRows);
}

function wrapInTabbedDescriptionLocalized(descriptionText, fitments, locale = 'en-US') {
  const shell = MARKETPLACE_TAB_SHELLS[locale] || MARKETPLACE_TAB_SHELLS['en-US'];
  const allRows = (fitments || []).filter(f => f.make && f.model && f.year);
  const truncated = allRows.length > descMaxFitmentRows;
  const rows = allRows.slice(0, descMaxFitmentRows);
  const fitmentTableRows = rows
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.year)}</td><td>${escapeHtml(f.make)}</td><td>${escapeHtml(f.model)}</td><td>${escapeHtml(f.submodel || f.chassisCode || '')}</td><td>${escapeHtml(f.trim)}</td><td>${escapeHtml(f.engine)}</td></tr>`,
    )
    .join('');

  const fitmentCount = allRows.length;
  const [cYear, cMake, cModel, cSub, cTrim, cEngine] = shell.fitmentCols;
  const truncatedNote = truncated
    ? `<p style="font-size: 12px;color: #666;margin-top: 8px;">Showing ${rows.length} of ${allRows.length} vehicles — see Compatibility rows in the listing file for the full fitment list.</p>`
    : '';
  const fitmentSection = fitmentTableRows
    ? `<div class="fitment-section" style="margin-top: 15px;"><h3 style="font-size: 16px;font-weight: bold;margin-bottom: 10px;color: #333;">${shell.fitmentHeading(fitmentCount)}</h3><p style="font-size: 13px;color: #555;margin-bottom: 8px;">${shell.fitmentIntro}</p><table class="fitment" style="width: 100%;border-collapse: collapse;margin-bottom: 10px;font-size: 13px;"><thead><tr style="background-color: #333;color: white;"><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">${cYear}</th><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">${cMake}</th><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">${cModel}</th><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">${cSub}</th><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">${cTrim}</th><th style="padding: 8px;text-align: left;border: 1px solid #ddd;">${cEngine}</th></tr></thead><tbody>${fitmentTableRows}</tbody></table>${truncatedNote}</div>`
    : '';

  const tabLabels = shell.tabs.map((label, i) => `<label for="tab${i + 1}">${label}</label>`).join('');
  const tabContents = shell.policies.map((text, i) => `<div id="content${i + 1}" class="tab-content">${text}</div>`).join('');

  return `<style>.tab-wrap {font-family: Arial, sans-serif;font-size: 14px;color: #333;max-width: 800px;margin: auto;}.tab-title {background-color: #222;color: #fff;padding: 12px;font-size: 18px;font-weight: bold;text-align: center;}.product-description {padding: 15px;border: 1px solid #ddd;background-color: #f9f9f9;margin-bottom: 10px;}.fitment tbody tr:nth-child(even) {background-color: #f9f9f9;}.fitment tbody tr:nth-child(odd) {background-color: #fff;}.fitment tbody td {padding: 8px;border: 1px solid #ddd;}input[type="radio"] {display: none;}.tab-labels {display: flex;flex-wrap: wrap;background-color: #333;}.tab-labels label {flex: 1;text-align: center;padding: 10px;font-weight: bold;cursor: pointer;background-color: #333;color: white;border-right: 1px solid #444;transition: background 0.3s;}.tab-labels label:hover {background-color: #444;}.tab-content {display: none;padding: 15px;border: 1px solid #ddd;background-color: #f9f9f9;}#tab1:checked ~ .tabs #content1,#tab2:checked ~ .tabs #content2,#tab3:checked ~ .tabs #content3,#tab4:checked ~ .tabs #content4,#tab5:checked ~ .tabs #content5 {display: block;}#tab1:checked ~ .tab-labels label[for="tab1"],#tab2:checked ~ .tab-labels label[for="tab2"],#tab3:checked ~ .tab-labels label[for="tab3"],#tab4:checked ~ .tab-labels label[for="tab4"],#tab5:checked ~ .tab-labels label[for="tab5"] {background-color: #fff;color: #000;border-bottom: none;}</style><div class="tab-wrap"><div class="tab-title">${shell.productTitle}</div><div class="product-description">${descriptionText}</div>${fitmentSection}<input type="radio" name="tab" id="tab1" checked><input type="radio" name="tab" id="tab2"><input type="radio" name="tab" id="tab3"><input type="radio" name="tab" id="tab4"><input type="radio" name="tab" id="tab5"><div class="tab-labels">${tabLabels}</div><div class="tabs">${tabContents}</div></div>`;
}

function wrapInTabbedDescription(descriptionText, fitments) {
  return wrapInTabbedDescriptionLocalized(descriptionText, fitments, 'en-US');
}

function getEnrichmentMode() {
  if (REPORT.totalProcessed > 0) {
    return REPORT.totalFailed > 0 ? 'mixed' : 'ai';
  }
  return REPORT.totalFailed > 0 ? 'fallback' : 'none';
}

async function localizeBatchForMarketplace(batchParts, marketplace, locale) {
  const includesDescription =
    localizationMode === 'copy' || localizationMode === 'ai';

  const itemsForPrompt = batchParts.map((part, idx) => {
    const item = { index: idx, title: part._enriched.title };
    if (localizationMode === 'titles_only' || localizationMode === 'ai') {
      item.type = part._enriched.type;
      item.placement = part._enriched.placement;
      item.material = part._enriched.material;
      item.color = part._enriched.color;
      item.bundleDescription = part._enriched.bundleDescription;
    }
    if (includesDescription) {
      item.description = part._enriched.description;
    }
    return item;
  });

  const localeGuide = marketplace === 'DE'
    ? `Schreibe natürliches Deutsch für eBay.de Gebrauchtteile. Keine wörtliche Übersetzung. Vermeide "gebraucht OE", "Genuine OEM", englische Positionswörter. Nutze z. B. Armlehne, hinten links, Original gebraucht, Teilenummer. Titel max. 80 Zeichen. Teilenummern unverändert lassen.`
    : marketplace === 'UK'
      ? 'British English spelling (colour, metre, organise). Title max 80 chars. Keep part numbers unchanged.'
      : 'Australian English spelling (colour, metre, organise). Title max 80 chars. Keep part numbers unchanged.';

  const fitmentNote =
    'Vehicle fitment/compatibility tables are added separately — do NOT include fitment tables or Year/Make/Model lists in the description.';

  let systemPrompt;
  if (localizationMode === 'copy') {
    systemPrompt = `Localize eBay Motors listing title and description HTML for ${marketplace}. ${localeGuide}
${fitmentNote}
- Translate the description HTML body (Details, Compatibility notes, Condition). Keep simple HTML tags (<p>, <ul>, <li>, <strong>).
- Part numbers and MPNs must stay unchanged.
Return JSON: { "items": [{ "index": N, "title": "...", "description": "..." }] }`;
  } else if (localizationMode === 'titles_only') {
    systemPrompt = `Localize eBay Motors listing fields for ${marketplace}. ${localeGuide}
Do NOT translate descriptions — only the fields in the user JSON.
Return JSON: { "items": [{ "index": N, "title": "...", "type": "...", "placement": "...", "material": "...", "color": "...", "bundleDescription": "..." }] }`;
  } else {
    systemPrompt = `Localize eBay Motors listing fields for ${marketplace}. ${localeGuide}
${fitmentNote}
- Translate title, description HTML, type, placement, material, color, bundleDescription.
Return JSON: { "items": [{ "index": N, "title": "...", "description": "...", "type": "...", "placement": "...", "material": "...", "color": "...", "bundleDescription": "..." }] }`;
  }

  const client = getOpenAI();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: localizationModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(itemsForPrompt) },
      ],
      temperature: 0.3,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    });

    REPORT.openaiCalls++;
    if (response.usage) REPORT.openaiTokensUsed += (response.usage.total_tokens || 0);

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty localization response');

    const parsed = parseOpenAiJson(content);
    return Array.isArray(parsed) ? parsed : (parsed.items || parsed.results || []);
  } catch (err) {
    REPORT.localization.errors++;
    REPORT.errors.push({
      type: 'localization',
      message: `${marketplace} localization batch failed: ${err.message}`,
      batchSize: batchParts.length,
    });
    return null;
  }
}

function bumpLocalizationStat(marketplace, kind) {
  const key =
    marketplace === 'UK'
      ? (kind === 'rule' ? 'ukRuleOnly' : 'ukAiTranslated')
      : marketplace === 'AU'
        ? (kind === 'rule' ? 'auRuleOnly' : 'auAiTranslated')
        : (kind === 'rule' ? 'deRuleOnly' : 'deAiTranslated');
  REPORT.localization[key]++;
}

async function localizeMarketplaceCopy(parts, marketplace, locale) {
  const enriched = parts.filter(p => p._enriched);
  if (!enriched.length) return;

  for (const part of enriched) {
    if (!part._localized) part._localized = {};
    part._localized[marketplace] = applyRuleBasedLocalization(part._enriched, locale);
  }

  if (!openaiAvailable || localizationMode === 'rule') {
    for (const part of enriched) bumpLocalizationStat(marketplace, 'rule');
    return;
  }

  const includesDescription =
    localizationMode === 'copy' || localizationMode === 'ai';
  const locBatchSize =
    localizationBatchSize > 0
      ? localizationBatchSize
      : includesDescription
        ? 8
        : Math.max(CONFIG.openai.batchSize, 12);
  const batches = chunk(enriched, locBatchSize);
  const locPool = createConcurrencyPool(CONFIG.pipeline.localizationConcurrency);

  await Promise.allSettled(
    batches.map((batch) =>
      locPool.run(async () => {
        const items = await localizeBatchForMarketplace(batch, marketplace, locale);
        if (!items) {
          for (const part of batch) bumpLocalizationStat(marketplace, 'rule');
          return;
        }

        for (const item of items) {
          const idx = item.index ?? items.indexOf(item);
          if (idx < 0 || idx >= batch.length) continue;
          const part = batch[idx];
          const base = part._localized[marketplace];
          const titlesOnly = localizationMode === 'titles_only';
          const copyMode = localizationMode === 'copy';
          const localizedDescription =
            (copyMode || localizationMode === 'ai') && item.description
              ? String(item.description).trim()
              : base.description;
          part._localized[marketplace] = {
            ...base,
            title: clean(item.title || base.title).slice(0, 80),
            description: localizedDescription || base.description,
            type: titlesOnly || copyMode ? base.type : clean(item.type || base.type),
            placement: titlesOnly || copyMode ? base.placement : clean(item.placement || base.placement),
            material: titlesOnly || copyMode ? base.material : clean(item.material || base.material),
            color: titlesOnly || copyMode ? base.color : clean(item.color || base.color),
            bundleDescription: titlesOnly || copyMode
              ? base.bundleDescription
              : clean(item.bundleDescription || base.bundleDescription),
            aiTranslated: true,
          };
          bumpLocalizationStat(marketplace, 'ai');
        }
      }),
    ),
  );
}

async function localizeAllMarketplaceCopy(parts) {
  const targets = getActivePipelineMarketplaces().filter((m) => m !== 'US');
  if (targets.length === 0) {
    log.info('Skipping localization — target marketplace is US (master copy)');
    return;
  }

  log.step(`Marketplace Copy Localization (${targets.join(' · ')})`);
  log.progress({
    stage: 'validation',
    sub_stage: localizationMode === 'rule' ? 'localization_rule' : 'localization',
  });

  const localeByMarketplace = { UK: 'en-GB', AU: 'en-AU', DE: 'de-DE' };
  await Promise.all(
    targets.map((marketplace) =>
      localizeMarketplaceCopy(parts, marketplace, localeByMarketplace[marketplace]),
    ),
  );

  const loc = REPORT.localization;
  log.info(
    `Localization complete` +
    (targets.includes('UK') ? `; UK ${loc.ukAiTranslated} AI / ${loc.ukRuleOnly} rule-only` : '') +
    (targets.includes('AU') ? `; AU ${loc.auAiTranslated} AI / ${loc.auRuleOnly} rule-only` : '') +
    (targets.includes('DE') ? `; DE ${loc.deAiTranslated} AI / ${loc.deRuleOnly} rule-only` : ''),
  );
}

function getMarketplaceListingCopy(part, marketplace) {
  const base = part._enriched;
  const localized = part._localized?.[marketplace];
  if (!localized) return base;
  return { ...base, ...localized };
}

function extractPlacement(note) {
  const n = (note || '').toLowerCase();
  const parts = [];
  if (n.includes('front')) parts.push('Front');
  if (n.includes('rear') || n.includes('back')) parts.push('Rear');
  if (n.includes('left') || n.includes('lh') || n.includes('driver')) parts.push('Left');
  if (n.includes('right') || n.includes('rh') || n.includes('passenger')) parts.push('Right');
  if (n.includes('upper') || n.includes('top')) parts.push('Upper');
  if (n.includes('lower') || n.includes('bottom')) parts.push('Lower');
  return parts.join(', ') || '';
}

/**
 * Generate alternate OEM part number formats for cross-referencing.
 * E.g., "A2048800657" → "2048800657, 204-880-06-57, 204.880.06.57"
 */
function expandOemNumbers(partNumber) {
  if (!partNumber) return partNumber;
  const pn = clean(partNumber);
  const variants = new Set();
  variants.add(pn);

  // Remove "A" or "Q" prefix for alternate format
  const noPrefix = pn.replace(/^[AQ]\s*/, '');
  if (noPrefix !== pn) variants.add(noPrefix);

  // Add dashed format: 204-880-06-57
  if (noPrefix.length >= 10) {
    const dashed = noPrefix.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4');
    if (dashed !== noPrefix) variants.add(dashed);
    // Add dotted format: 204.880.06.57
    const dotted = noPrefix.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1.$2.$3.$4');
    if (dotted !== noPrefix) variants.add(dotted);
    // Add spaced format: 204 880 06 57
    const spaced = noPrefix.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    if (spaced !== noPrefix) variants.add(spaced);
  }

  return [...variants].join(', ');
}

// ═══════════════════════════════════════════════════════════════════════
//  COMPLIANCE VALIDATION
// ═══════════════════════════════════════════════════════════════════════

async function syncCategoryHintToMarketplaces(part, catHint, vinData) {
  if (!catHint?.categoryId || !catHint?.categoryName) return;
  setPartCategory(
    part,
    'US',
    normalizeCategoryResult(
      { categoryId: catHint.categoryId, categoryName: catHint.categoryName },
      'US',
      'hint',
    ),
  );
  const lookup = {
    partKey: `${part.partName}|${part.note}`.toLowerCase(),
    parts: [part],
  };
  for (const marketplace of ['UK', 'AU', 'DE']) {
    const resolved = await fallbackCategoryForMarketplace(
      lookup,
      vinData,
      marketplace,
      catHint.categoryName,
    );
    if (resolved) setPartCategory(part, marketplace, resolved);
  }
}

async function validateAndFix(parts, vinData) {
  log.step('Compliance Validation');
  let fixes = 0;

  for (const part of parts) {
    if (!part._enriched) continue;
    const e = part._enriched;

    // Title length check
    if (e.title.length > 80) {
      e.title = e.title.slice(0, 77) + '...';
      REPORT.validationFixes.push({ sku: part.sku, field: 'title', fix: 'truncated to 80 chars' });
      fixes++;
    }

    // Title must not be empty
    if (!e.title) {
      const vehicle = getVehicleInfo(part, vinCache);
      e.title = `${part.brand} ${part.partName} ${part.partNumber}`.slice(0, 80).trim();
      fixes++;
    }

    // Brand normalization
    e.brand = normalizeBrand(e.brand || part.brand);
    e.itemSpecifics = mergeAiSpecificsOnly(
      buildFallbackItemSpecifics(part, getVehicleInfo(part, vinCache)),
      sanitizeItemSpecifics(e.itemSpecifics),
    );

    // MPN: must not be fabricated — only use raw part number
    if (e.mpn && normalizePN(e.mpn) !== normalizePN(part.partNumber)) {
      // AI might have cleaned the format; keep if it's a normalized version
      const rawNorm = normalizePN(part.partNumber);
      const aiNorm = normalizePN(e.mpn);
      if (rawNorm && aiNorm && !aiNorm.includes(rawNorm) && !rawNorm.includes(aiNorm)) {
        // Divergent — revert to original
        e.mpn = part.partNumber;
        REPORT.validationFixes.push({ sku: part.sku, field: 'mpn', fix: 'reverted to original part number' });
        fixes++;
      }
    }

    // OEM number: must match source data
    if (!e.oemNumber) e.oemNumber = part.partNumber;

    // Price validation
    if (part.price <= 0) {
      part.price = 49.99; // Reasonable default
      REPORT.validationFixes.push({ sku: part.sku, field: 'price', fix: 'set default price 49.99' });
      fixes++;
    }

    // Description: must not be empty
    if (!e.description || e.description.length < 50) {
      const vehicle = getVehicleInfo(part, vinCache);
      e.description = buildBasicDescription(part, vehicle);
      fixes++;
    }

    const vehicle = getVehicleInfo(part, vinCache);
    const fitments = part._fitments || [];

    // US title: fix generation/year mismatch (e.g. AL20 + 2013-2021)
    const usTitleMismatch = detectTitleGenerationMismatch(
      e.title,
      e.brand || vehicle.make,
      vehicle.model,
      vehicle.year,
    );
    if (usTitleMismatch) {
      e.title = buildSeoTitle(vehicle, part, normalizePN(part.partNumber));
      REPORT.validationFixes.push({
        sku: part.sku,
        field: 'title',
        fix: `generation/year realigned (${usTitleMismatch})`,
      });
      fixes++;
    }

    e.itemSpecifics = mergeAiSpecificsOnly(
      buildEnglishItemSpecifics({
        part,
        vehicle,
        partNumber: part.partNumber,
        placement: extractPlacement(part.note || ''),
        fitments,
      }),
      e.itemSpecifics,
    );

    // German marketplace copy quality (rule-based + AI fallback)
    if (part._localized?.DE) {
      const de = part._localized.DE;
      const placement = extractPlacement(part.note || '');
      if (
        !isLikelyGermanText(de.title) ||
        shouldRebuildGermanTitle(de.title, vehicle)
      ) {
        de.title = buildGermanSeoTitle({
          vehicle,
          part,
          partNumber: part.partNumber,
          placement,
          fitments,
        });
        fixes++;
      }
      if (!de.description || de.description.length < 80 || !isLikelyGermanText(de.description)) {
        de.description = buildGermanBasicDescription({
          part,
          vehicle,
          partNumber: part.partNumber,
          placement,
          fitments,
        });
        fixes++;
      }
      de.itemSpecifics = mergeAiSpecificsOnly(
        buildGermanItemSpecifics({
          part,
          vehicle,
          partNumber: part.partNumber,
          placement,
          fitments,
        }),
        de.itemSpecifics || {},
      );
    }

    // AU marketplace: platform-aligned title, description, specifics + spelling
    if (part._localized?.AU) {
      const au = part._localized.AU;
      const placement = extractPlacement(part.note || '');
      if (shouldRebuildEnglishTitle(au.title, vehicle) || au.title.length < 24) {
        au.title = applyAustralianSpelling(
          buildEnglishSeoTitle({
            vehicle,
            part,
            partNumber: part.partNumber,
            placement,
            fitments,
          }),
        );
        fixes++;
      }
      if (!au.description || au.description.length < 80) {
        au.description = buildEnglishBasicDescription({
          part,
          vehicle,
          partNumber: part.partNumber,
          placement,
          fitments,
          marketplace: 'AU',
        });
        fixes++;
      }
      au.itemSpecifics = mergeAiSpecificsOnly(
        buildEnglishItemSpecifics({
          part,
          vehicle,
          partNumber: part.partNumber,
          placement,
          fitments,
        }),
        localizeEnglishCopyForAu(au).itemSpecifics || {},
      );
    }

    // Interior vs exterior category correction (US hint → re-resolve AU/DE IDs)
    const catHint =
      resolveEnglishCategory(part.partName, part.note) ||
      resolveMotorsCategoryFromPart(part.partName, part.note);
    const usCategory = getPartCategory(part, 'US');
    if (catHint && usCategory?.categoryId) {
      const exteriorIds = new Set(['33697', '174105']);
      const interiorIds = new Set(['33695', '33717', '174090']);
      if (
        interiorIds.has(String(catHint.categoryId)) &&
        exteriorIds.has(String(usCategory.categoryId))
      ) {
        await syncCategoryHintToMarketplaces(part, catHint, vinData);
        REPORT.validationFixes.push({
          sku: part.sku,
          field: 'category',
          fix: `corrected to ${catHint.categoryName} (US/AU/DE)`,
        });
        fixes++;
      }
    }

    // Track missing required specifics
    const missing = [];
    if (!e.brand) missing.push('Brand');
    if (!e.mpn && !part.partNumber) missing.push('Manufacturer Part Number');
    if (missing.length > 0) {
      REPORT.missingSpecifics.push({ sku: part.sku, missing });
    }
  }

  log.info(`Validation: ${fixes} automatic fixes applied`);
}

function normalizeBrand(brand) {
  const map = {
    'mercedes': 'Mercedes-Benz', 'mercedes-benz': 'Mercedes-Benz', 'mer': 'Mercedes-Benz',
    'bmw': 'BMW', 'jaguar': 'Jaguar', 'jag': 'Jaguar',
    'volkswagen': 'Volkswagen', 'vw': 'Volkswagen',
    'audi': 'Audi', 'aud': 'Audi',
    'dodge': 'Dodge', 'ford': 'Ford',
    'land rover': 'Land Rover', 'landrover': 'Land Rover', 'range rover': 'Land Rover', 'rangerover': 'Land Rover',
    'bentley': 'Bentley', 'bent': 'Bentley',
  };
  const lower = (brand || '').toLowerCase().trim();
  return map[lower] || titleCase(brand);
}

function sanitizeItemSpecifics(rawSpecifics) {
  if (!rawSpecifics || typeof rawSpecifics !== 'object') return {};
  const out = {};
  for (const [rawKey, rawValue] of Object.entries(rawSpecifics)) {
    const key = clean(String(rawKey || ''));
    const value = clean(String(rawValue || ''));
    if (!key || !value) continue;
    if (value.length > 120) continue;
    out[key] = value;
  }
  return out;
}

function buildFallbackItemSpecifics(part, vehicle) {
  const pn = normalizePN(part.partNumber || '');
  const displayName = resolvePartDisplayName(part, vehicle);
  return sanitizeItemSpecifics({
    Brand: normalizeBrand(part.brand) || vehicle.make || '',
    'Manufacturer Part Number': pn || part.partNumber || '',
    Type: displayName,
    'Placement on Vehicle': extractPlacement(part.note || ''),
    'Fitment Type': 'Direct Replacement',
    Warranty: 'No Warranty',
    Material: '',
    Color: '',
    'OE/OEM Part Number': expandOemNumbers(part.partNumber),
  });
}

function mergeAiSpecificsOnly(baseSpecifics, aiSpecifics) {
  const merged = { ...sanitizeItemSpecifics(baseSpecifics) };
  const cleanAi = sanitizeItemSpecifics(aiSpecifics);
  for (const [k, v] of Object.entries(cleanAi)) {
    if (!merged[k]) merged[k] = v;
  }
  return merged;
}

function countAdditionalSpecifics(baseSpecifics, mergedSpecifics) {
  const base = sanitizeItemSpecifics(baseSpecifics);
  const merged = sanitizeItemSpecifics(mergedSpecifics);
  let added = 0;
  for (const key of Object.keys(merged)) {
    if (!base[key] && merged[key]) added++;
  }
  return added;
}

function applyDynamicItemSpecifics(headers, row, specifics) {
  if (!specifics || typeof specifics !== 'object') return;
  const indexByNormalized = new Map();
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').trim();
    if (!header.startsWith('C:')) continue;
    const normalized = header.slice(2).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!indexByNormalized.has(normalized)) indexByNormalized.set(normalized, i);
  }
  for (const [key, value] of Object.entries(specifics)) {
    const normalizedKey = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const idx = indexByNormalized.get(normalizedKey);
    if (idx == null) continue;
    if (row[idx] != null && String(row[idx]).trim() !== '') continue;
    row[idx] = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  FITMENT EXPANSION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Normalize model names to match PLATFORM_RANGES keys.
 * E.g., "C350 AMG" → "C-Class", "328i" → "3 Series", "A4 Quattro" → "A4"
 */
function normalizeModelForPlatform(make, model) {
  if (!model) return model;
  const m = model.trim();
  const makeLower = (make || '').toLowerCase();

  if (makeLower.includes('mercedes')) {
    // Mercedes: C250/C300/C350/C63 → C-Class, E350/E550 → E-Class, S500/S550 → S-Class
    const mbMatch = m.match(/^([A-Z]{1,3})\s*\d/i);
    if (mbMatch) {
      const prefix = mbMatch[1].toUpperCase();
      const classMap = { 'C': 'C-Class', 'E': 'E-Class', 'S': 'S-Class', 'A': 'A-Class', 'B': 'B-Class' };
      if (classMap[prefix]) return classMap[prefix];
      // GLE, GLC, GLA, GLB, CLA etc. — return as-is if it matches PLATFORM_RANGES
      return prefix.length >= 2 ? prefix : m;
    }
  }

  if (makeLower === 'bmw') {
    // BMW: 328i/335i → 3 Series, 528i/535i → 5 Series, X5 xDrive → X5
    const bmwMatch = m.match(/^([1-8X]\d?)\s*\d{0,2}/i);
    if (bmwMatch) {
      const prefix = bmwMatch[1];
      if (/^\d$/.test(prefix)) return `${prefix} Series`;
      return prefix.toUpperCase(); // X3, X5, etc.
    }
  }

  return m;
}

function fitmentDedupeKey(f) {
  return `${f.year}|${f.make}|${f.model}|${f.trim || ''}|${f.engine || ''}|${f.submodel || f.chassisCode || ''}`.toLowerCase();
}

function addUniqueFitment(fitments, seen, entry) {
  if (!entry?.year || !entry?.make || !entry?.model) return false;
  const key = fitmentDedupeKey(entry);
  if (seen.has(key)) return false;
  seen.add(key);
  fitments.push(entry);
  return true;
}

/** Append fitment export columns missing from eBay template headers. */
function ensureFitmentExportColumns(headers) {
  const extra = [
    'Compatibility',
    'Description Note',
    'fitment_json',
    'fitment_flat',
    'fitment_year_range',
    'fitment_notes',
    'technical_notes',
  ];
  for (const col of extra) {
    if (!headers.some(h => h && String(h).trim() === col)) {
      headers.push(col);
    }
  }
  return headers;
}

/**
 * MVL-driven fitment expansion (deterministic) — replaces AI compatibility in v4 prompt.
 */
async function runMvlFitmentExpansion(parts, vinData) {
  if (FITMENT_EXPANSION_MODE === 'ai') {
    log.info('FITMENT_EXPANSION_MODE=ai — using legacy expandFitments with AI compatibility');
    return { interchangeQueue: [], expander: null };
  }

  log.step(`MVL Fitment Expansion (mode=${FITMENT_EXPANSION_MODE})`);

  const pnVehicleMap = buildPnVehicleMap(parts, (part) => {
    const v = getVehicleInfo(part, vinData);
    const decoded = vinData.get(part.vin);
    return {
      year: v.year,
      make: normalizeBrand(v.make || part.brand),
      model: v.model,
      trim: v.trim || '',
      engine: v.engine || decoded?.engineModel || '',
      submodel: '',
      bodyType: decoded?.bodyClass || '',
    };
  });

  const { stats, expander, interchangeQueue } = await expandAllPartsWithMvl(
    parts,
    {
      env,
      marketplace: 'US',
      vinData,
      pnVehicleMap,
      getDonor: (part) => {
        const v = getVehicleInfo(part, vinData);
        const decoded = vinData.get(part.vin);
        return {
          year: v.year,
          make: normalizeBrand(v.make || part.brand),
          model: v.model,
          trim: v.trim || '',
          engine: v.engine || decoded?.engineModel || '',
          bodyClass: decoded?.bodyClass || '',
        };
      },
      getProfile: (part) => getEnrichmentProfile(part.price, LOW_VALUE_MAX_PRICE),
      getEbayFitmentModelFields,
    },
    log,
  );

  REPORT.fitment.mvlExpanded = stats.mvlExpanded;
  REPORT.fitment.mvlRejected = stats.mvlRejected;

  for (const part of parts) {
    if (part._fitments?.length) {
      generateFitmentOutput(part);
    }
  }

  return { interchangeQueue, expander, stats };
}

/**
 * Small AI micro-call for parts where MVL expansion is thin.
 */
async function runInterchangeMicroCalls(queue, vinData) {
  if (!queue?.length) return;
  const mode = String(env.FITMENT_AI_INTERCHANGE || 'auto').trim().toLowerCase();
  if (mode === 'off') return;

  const client = getOpenAI();
  if (!client) return;

  log.info(`Interchange micro-call for ${queue.length} parts`);
  const batches = chunk(queue, 8);
  const { createMvlFitmentExpander } = await import('./lib/mvl-fitment-expander.mjs');

  for (const batch of batches) {
    const partsForPrompt = batch.map((part, idx) => {
      const vehicle = getVehicleInfo(part, vinData);
      return {
        index: idx,
        sku: part.sku,
        mpn: part.partNumber,
        partName: part.partName,
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
        placement: part._enriched?.placement || '',
        type: part._enriched?.type || '',
        existingRows: part._fitments?.length ?? 0,
      };
    });

    try {
      const response = await client.chat.completions.create({
        model: CONFIG.openai.model,
        messages: [
          { role: 'system', content: buildInterchangeSystemPrompt() },
          { role: 'user', content: buildInterchangeUserPrompt(partsForPrompt) },
        ],
        temperature: 0.15,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      });

      REPORT.openaiCalls++;
      REPORT.fitment.interchangeMicroCalls++;
      const usage = response.usage;
      if (usage) REPORT.openaiTokensUsed += usage.total_tokens || 0;

      const content = response.choices[0]?.message?.content;
      if (!content) continue;
      const parsed = parseOpenAiJson(content);
      const items = Array.isArray(parsed) ? parsed : (parsed.items || []);

      for (const item of items) {
        const idx = item.index ?? 0;
        const part = batch[idx];
        if (!part) continue;
        const hints = Array.isArray(item.interchangeHints) ? item.interchangeHints : [];
        if (!hints.length) continue;

        if (!part._enriched) part._enriched = {};
        part._enriched.interchangeHints = [
          ...(part._enriched.interchangeHints || []),
          ...hints,
        ].slice(0, 5);

        const expander = createMvlFitmentExpander({ env });
        const vehicle = getVehicleInfo(part, vinData);
        const donor = {
          year: vehicle.year,
          make: normalizeBrand(vehicle.make),
          model: vehicle.model,
        };
        const refreshed = await expander.expandPart(part, {
          donor,
          pnVehicleMap: null,
          profile: getEnrichmentProfile(part.price, LOW_VALUE_MAX_PRICE),
          getEbayFitmentModelFields,
        });
        if (refreshed.expandedRows?.length) {
          part._fitments = refreshed.expandedRows;
          part._fitmentSource = 'mvl+ai';
          generateFitmentOutput(part);
        }
        await expander.close();
      }
    } catch (err) {
      log.warn(`Interchange micro-call failed: ${err.message}`);
    }
  }
}

/**
 * Expands per-part fitment data from a single VIN year to the complete
 * platform generation year range (e.g. 2015 BMW 3-Series → 2011-2019 F3x).
 *
 * Also extracts submodel/body type from VIN data and builds a structured
 * JSON representation for every part.
 *
 * Stores:
 *   part._fitments     — Array of {year, make, model, trim, engine, submodel, bodyType, notes}
 *   part._fitmentJson  — Full structured JSON string for the output column
 *   part._fitmentFlat  — Pipe-separated flat string for CSV compatibility
 */
function expandFitments(parts, vinData) {
  log.step('Fitment Expansion (Universal Interchange)');

  // Build part-number → all decoded vehicles map for cross-referencing
  const pnVehicleMap = new Map();
  for (const part of parts) {
    const norm = normalizePN(part.partNumber);
    if (!norm) continue;
    const v = vinData.get(part.vin);
    if (!v || !v.year) continue;
    if (!pnVehicleMap.has(norm)) pnVehicleMap.set(norm, []);
    pnVehicleMap.get(norm).push({
      year: v.year,
      make: normalizeBrand(v.make || part.brand),
      model: v.model,
      trim: v.trim || '',
      engine: v.engineModel || (v.engineDisplacement ? `${v.engineDisplacement}L` : ''),
      submodel: '',
      bodyType: v.bodyClass || '',
    });
  }

  let platformExpanded = 0;
  let crossRefExpanded = 0;
  let aiInterchangeUsed = 0;
  let sharedPlatformExpanded = 0;
  let singleVehicle = 0;

  for (const part of parts) {
    if (part._fitments?.length && part._fitmentSource && FITMENT_EXPANSION_MODE !== 'ai') {
      continue;
    }
    const vehicle = getVehicleInfo(part, vinData);
    const decoded = vinData.get(part.vin);

    if (!vehicle.make || !vehicle.model || !vehicle.year) {
      // Even without complete VIN data, AI enrichment may have generated compatibility entries
      const aiCompat = part._enriched?.compatibility;
      const fitments = [];
      const seen = new Set();

      if (Array.isArray(aiCompat) && aiCompat.length > 0) {
        for (const c of aiCompat) {
          if (!c.make || !c.model) continue;
          const aiFields = getEbayFitmentModelFields(c.make, c.model, c.trim);
          const yStart = parseInt(c.yearStart) || parseInt(c.year) || 0;
          const yEnd = parseInt(c.yearEnd) || yStart;
          if (!yStart) continue;
          for (let y = yStart; y <= yEnd; y++) {
            addUniqueFitment(fitments, seen, {
              year: String(y),
              make: normalizeBrand(c.make),
              model: aiFields.model,
              trim: aiFields.trim || c.trim || '',
              engine: c.engine || '',
              submodel: c.chassisCode || '',
              bodyType: c.bodyType || '',
              notes: c.notes || '',
            });
          }
        }
        if (fitments.length > 0) aiInterchangeUsed++;
      }

      // If still no fitments, try partial vehicle info
      if (fitments.length === 0) {
        const ebayFitment = getEbayFitmentModelFields(vehicle.make, vehicle.model, vehicle.trim);
        if (vehicle.year) {
          addUniqueFitment(fitments, seen, {
            year: vehicle.year, make: normalizeBrand(vehicle.make || ''), model: ebayFitment.model || '',
            trim: ebayFitment.trim || '', engine: '', submodel: '', bodyType: decoded?.bodyClass || '', notes: '',
          });
        }
        if (fitments.length === 0) {
          REPORT.fitment.noFitment.push(part.sku || part.partNumber);
        }
      }

      part._fitments = fitments.slice(0, 400);
      generateFitmentOutput(part);
      continue;
    }

    const makeName = normalizeBrand(vehicle.make);
    const normalizedModel = normalizeModelForPlatform(makeName, vehicle.model);
    const ebayFitment = getEbayFitmentModelFields(makeName, vehicle.model, vehicle.trim);
    const platformKey = `${makeName}|${normalizedModel}`;
    const platforms = PLATFORM_RANGES[platformKey];
    const yearNum = parseInt(vehicle.year) || 0;
    const fitments = [];
    const seen = new Set();
    let generationCode = '';
    // ── Platform generation expansion (full year range per chassis) ──
    if (platforms && yearNum) {
      const gen = platforms.find(g => yearNum >= g.start && yearNum <= g.end);
      if (gen) {
        generationCode = gen.code;
        let added = 0;
        for (let y = gen.start; y <= gen.end; y++) {
          if (addUniqueFitment(fitments, seen, {
            year: String(y), make: makeName, model: ebayFitment.model,
            trim: ebayFitment.trim || '', engine: '',
            submodel: gen.code,
            bodyType: decoded?.bodyClass || '',
            notes: `Platform ${gen.code}`,
          })) added++;
        }
        if (added > 0) platformExpanded++;
      }
    }

    // ── AI interchange / compatibility (merge — do not replace platform years) ──
    // AI returns yearStart/yearEnd ranges; expand each to individual year rows
    const aiCompat = part._enriched?.compatibility;
    if (Array.isArray(aiCompat) && aiCompat.length > 0) {
      let added = 0;
      for (const c of aiCompat) {
        if (!c.make || !c.model) continue;
        const aiFields = getEbayFitmentModelFields(c.make, c.model, c.trim);
        const yStart = parseInt(c.yearStart) || parseInt(c.year) || 0;
        const yEnd = parseInt(c.yearEnd) || yStart;
        if (!yStart) continue;
        for (let y = yStart; y <= yEnd; y++) {
          if (addUniqueFitment(fitments, seen, {
            year: String(y),
            make: normalizeBrand(c.make),
            model: aiFields.model,
            trim: aiFields.trim || c.trim || '',
            engine: c.engine || '',
            submodel: c.chassisCode || '',
            bodyType: c.bodyType || '',
            notes: c.notes || '',
          })) added++;
        }
      }
      if (added > 0) aiInterchangeUsed++;
    }

    // ── Description-based year range ──
    if (part._descYears && part._descYears.length > 1) {
      let added = 0;
      for (const yr of part._descYears) {
        if (addUniqueFitment(fitments, seen, {
          year: yr, make: makeName, model: ebayFitment.model,
          trim: ebayFitment.trim || '', engine: '', submodel: '',
          bodyType: '', notes: 'Year range from description',
        })) added++;
      }
      if (added > 0 && fitments.length === added) platformExpanded++;
    }

    // ── Cross-reference from multiple VINs ──
    if (fitments.length === 0) {
      const norm = normalizePN(part.partNumber);
      const crossVehicles = (pnVehicleMap.get(norm) || [])
        .filter(v => v.make?.toLowerCase() === vehicle.make?.toLowerCase() &&
                     v.model?.toLowerCase() === vehicle.model?.toLowerCase());
      if (crossVehicles.length > 1) {
        let added = 0;
        for (const v of crossVehicles.sort((a, b) => parseInt(a.year) - parseInt(b.year))) {
          if (addUniqueFitment(fitments, seen, {
            ...v,
            submodel: v.submodel || '',
            bodyType: v.bodyType || decoded?.bodyClass || '',
            notes: 'Cross-referenced from multiple VINs',
          })) added++;
        }
        if (added > 0) crossRefExpanded++;
      }
    }

    // ── Single-vehicle fallback ──
    if (fitments.length === 0) {
      addUniqueFitment(fitments, seen, {
        year: vehicle.year, make: makeName, model: ebayFitment.model,
        trim: ebayFitment.trim || vehicle.trim || '', engine: vehicle.engine || '',
        submodel: generationCode || '',
        bodyType: decoded?.bodyClass || '',
        notes: vehicle.trim ? `Trim: ${vehicle.trim}` : '',
      });
      singleVehicle++;
    }

    // ── Shared platform expansion ──
    // If we have fitments for Make|Model, also look for cross-brand platform siblings
    const sharedSiblings = SHARED_PLATFORMS[platformKey] || [];
    if (sharedSiblings.length > 0 && fitments.length > 0) {
      const existingKeys = new Set(fitments.map(f => `${f.make}|${f.model}`));
      for (const siblingKey of sharedSiblings) {
        if (existingKeys.has(siblingKey)) continue;
        const sibPlatforms = PLATFORM_RANGES[siblingKey];
        if (!sibPlatforms) continue;
        const sibGen = sibPlatforms.find(g => yearNum >= g.start && yearNum <= g.end);
        if (sibGen) {
          const [sibMake, sibModel] = siblingKey.split('|');
          let added = 0;
          for (let y = sibGen.start; y <= sibGen.end; y++) {
            if (addUniqueFitment(fitments, seen, {
              year: String(y), make: sibMake, model: sibModel,
              trim: '', engine: '',
              submodel: sibGen.code,
              bodyType: '',
              notes: `Shared platform with ${makeName} ${vehicle.model} (${sibGen.code})`,
            })) added++;
          }
          if (added > 0) sharedPlatformExpanded++;
        }
      }
    }

    // Store technical notes from AI
    if (part._enriched?.technicalNotes) {
      part._technicalNotes = part._enriched.technicalNotes;
      // Tag all fitments with the technical notes
      for (const f of fitments) {
        if (!f.notes) f.notes = part._enriched.technicalNotes;
      }
    }

    part._fitments = fitments.slice(0, 400);
    if (fitments.length > 400) {
      log.warn(`Fitment list truncated for ${part.sku || part.partNumber}: ${fitments.length} → 400`);
    }

    // Validate fitment completeness
    const incomplete = part._fitments.filter(f => !f.make || !f.model || !f.year);
    if (incomplete.length > 0) {
      REPORT.fitment.incomplete.push(part.sku || part.partNumber);
      log.warn(`Incomplete fitment for ${part.partNumber}: missing make/model/year in ${incomplete.length}/${part._fitments.length} entries`);
    }

    generateFitmentOutput(part);
  }

  // Update report stats
  REPORT.fitment.totalParts = parts.length;
  REPORT.fitment.platformExpanded = platformExpanded;
  REPORT.fitment.crossRefExpanded = crossRefExpanded;
  REPORT.fitment.aiInterchangeUsed = aiInterchangeUsed || 0;
  REPORT.fitment.sharedPlatformExpanded = sharedPlatformExpanded || 0;
  REPORT.fitment.singleVehicle = singleVehicle;
  REPORT.fitment.totalCompatEntries = parts.reduce((s, p) => s + (p._fitments?.length || 0), 0);

  log.info(`Fitment expansion: ${aiInterchangeUsed} AI-interchange, ${platformExpanded} platform, ${crossRefExpanded} cross-ref, ${sharedPlatformExpanded} shared-platform, ${parts.length - platformExpanded - crossRefExpanded - aiInterchangeUsed} single-vehicle`);
  log.info(`Total compatibility entries: ${REPORT.fitment.totalCompatEntries}`);
  if (REPORT.fitment.incomplete.length) log.warn(`Incomplete fitments: ${REPORT.fitment.incomplete.length} parts`);
  if (REPORT.fitment.noFitment.length) log.warn(`No fitment data: ${REPORT.fitment.noFitment.length} parts`);
}

/**
 * Populate structured JSON and flat fitment output fields on a part.
 */
function generateFitmentOutput(part) {
  const fitments = part._fitments || [];
  if (fitments.length === 0) {
    part._fitmentJson = '[]';
    part._fitmentFlat = '';
    return;
  }

  // Structured JSON for the fitment_json column
  const structured = fitments.map(f => ({
    year: f.year || '',
    make: f.make || '',
    model: f.model || '',
    trim: f.trim || '',
    engine: f.engine || '',
    submodel: f.submodel || '',
    bodyType: f.bodyType || '',
    notes: f.notes || '',
  }));
  part._fitmentJson = JSON.stringify(structured);

  // Flat pipe-separated format: Year Make Model [Chassis] [Trim] [Engine]
  part._fitmentFlat = fitments
    .map(f => [f.year, f.make, f.model, f.submodel ? `(${f.submodel})` : '', f.trim, f.engine].filter(Boolean).join(' '))
    .join(' | ');

  // eBay MVL Compatibility string — pipe-separated Year|Make|Model|Trim|Engine per vehicle,
  // semicolon-separated entries for a single-cell "Compatibility" column
  part._compatibilityMVL = fitments
    .filter(f => f.year && f.make && f.model)
    .map(f => {
      const segs = [];
      if (f.year) segs.push(`Year=${f.year}`);
      if (f.make) segs.push(`Make=${f.make}`);
      if (f.model) segs.push(`Model=${f.model}`);
      if (f.submodel || f.chassisCode) segs.push(`Submodel=${f.submodel || f.chassisCode}`);
      if (f.trim) segs.push(`Trim=${f.trim}`);
      if (f.engine) segs.push(`Engine=${f.engine}`);
      return segs.join('|');
    })
    .join('; ');

  // Description Note: concise fit summary + technical requirements
  const techNotes = part._technicalNotes || part._enriched?.technicalNotes || '';
  const yearRange = (() => {
    const yrs = fitments.map(f => parseInt(f.year)).filter(y => y > 1900).sort((a, b) => a - b);
    return yrs.length > 1 ? `${yrs[0]}-${yrs[yrs.length - 1]}` : yrs.length === 1 ? String(yrs[0]) : '';
  })();
  const makes = [...new Set(fitments.map(f => f.make).filter(Boolean))].join(', ');
  const fitSummary = yearRange && makes ? `Fits ${yearRange} ${makes}` : '';
  const countNote =
    fitments.length > 0
      ? `${fitments.length} vehicle applications — full list in description table, Compatibility column, fitment_flat, and Relationship rows`
      : '';
  part._descriptionNote = [fitSummary, countNote, techNotes].filter(Boolean).join('. ');

  // Compute year range summary for quick display
  const years = fitments.map(f => parseInt(f.year)).filter(y => y > 1900).sort((a, b) => a - b);
  if (years.length > 1) {
    part._fitmentYearRange = `${years[0]}-${years[years.length - 1]}`;
  } else if (years.length === 1) {
    part._fitmentYearRange = String(years[0]);
  } else {
    part._fitmentYearRange = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  IMAGE FETCHING & VALIDATION
// ═══════════════════════════════════════════════════════════════════════

/** LRU-style image cache — keyed on normalized(partNumber||title) */
const _imageResultCache = new Map();
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

function imageCacheKey(part) {
  return `${normalizePN(part.partNumber || '')}||${(part._enriched?.title || part.partName || '').toLowerCase().slice(0, 60)}`;
}

/**
 * Calls the ImageEnrichmentService API to fetch ranked image URLs for all
 * enriched parts with retry, caching, and URL validation.
 *
 * For every part stores:
 *   part._images     — flat array of up to 12 image URLs (backward compatible)
 *   part._imageData  — structured { primary, gallery, diagrams, enriched, validation }
 */
async function fetchImages(parts) {
  log.step('Image Enrichment & Validation');
  log.progress({ stage: 'validation', sub_stage: 'images' });
  const forceVision = process.env.PIPELINE_FORCE_VISION === '1';
  if (forceVision) {
    log.info('PIPELINE_FORCE_VISION enabled — validating warehouse photos for all parts with source images');
  }

  // Always seed uploaded / CSV source images before any API fetch
  let sourceImageParts = 0;
  for (const p of parts) {
    if (applySourceImagesFromInput(p)) {
      sourceImageParts++;
      REPORT.images.withPrimary++;
      REPORT.images.totalUrls += p._images?.length || 0;
    }
  }
  if (sourceImageParts > 0) {
    log.info(`Preloaded source/upload images for ${sourceImageParts} parts`);
  }

  const toBeFetched = parts.filter((p) => {
    if (!p._enriched) return false;
    if (skipImageFetch) return false;
    if (forceVision && (p._gridx?.images || (p._images && p._images.length > 0))) return true;
    return !p._images || p._images.length === 0;
  });
  REPORT.images.totalParts = parts.filter(p => p._enriched).length;

  if (!skipImageFetch && toBeFetched.length) {
  log.info(`Fetching images for ${toBeFetched.length} parts via ${IMAGE_API_URL}...`);

  const IMAGE_BATCH_SIZE = 25;
  const MAX_RETRIES = 2;
  const IMAGE_CONCURRENCY = CONFIG.pipeline.imageConcurrency;
  const batches = chunk(toBeFetched, IMAGE_BATCH_SIZE);
  const imagePool = createConcurrencyPool(IMAGE_CONCURRENCY);

  await Promise.allSettled(
    batches.map((batch, batchIdx) =>
      imagePool.run(async () => {

    // Check cache first — bypass API for cached results
    const uncached = [];
    for (const p of batch) {
      const key = imageCacheKey(p);
      const cached = _imageResultCache.get(key);
      if (cached && Date.now() - cached.ts < IMAGE_CACHE_TTL) {
        Object.assign(p, cached.data);
        REPORT.images.cacheHits++;
      } else {
        uncached.push(p);
      }
    }

    if (uncached.length === 0) return;

    // Retry loop for the API call
    let apiSuccess = false;
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const payload = {
          parts: uncached.map(p => ({
            partNumber: p.partNumber || p.sku || '',
            title: p._enriched?.title || p.partName || '',
            brand: p._enriched?.brand || p.brand || '',
            mpn: p._enriched?.mpn || p.partNumber || '',
            fitment: p._fitmentFlat || '',
          })),
          downloadImages: false,
        };

        const { data } = await axios.post(
          `${IMAGE_API_URL}/api/pipeline/images/enrich`,
          payload,
          { timeout: 120_000, headers: { 'Content-Type': 'application/json' } },
        );

        const results = data.results || [];
        for (let i = 0; i < uncached.length; i++) {
          processImageResult(uncached[i], results[i]);
        }

        apiSuccess = true;
        break;
      } catch (err) {
        log.warn(`Image API batch ${batchIdx + 1}/${batches.length} attempt ${attempt} failed: ${err.message}`);
        REPORT.images.apiRetries++;
        if (attempt <= MAX_RETRIES) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    if (!apiSuccess) {
      REPORT.images.apiFailed++;
      for (const p of uncached) {
        if (!applySourceImagesFromInput(p)) {
          setEmptyImageData(p);
          REPORT.images.failedEnrichments.push(p.sku || p.partNumber);
          log.warn(`Image enrichment failed for ${p.partNumber} — no images available`);
        } else {
          log.warn(`Image API failed for ${p.partNumber} — kept ${p._images.length} source upload(s)`);
        }
      }
    }
      }),
    ),
  );

  // ── URL validation pass (parallel) — optional; slow on large jobs ──
  if (skipImageValidation) {
    log.info('Skipping image URL validation (PIPELINE_SKIP_IMAGE_VALIDATION or PIPELINE_FAST_MODE)');
    for (const p of toBeFetched) {
      if (p._images?.length) {
        REPORT.images.accessible += p._images.length;
        REPORT.images.validated += p._images.length;
      }
    }
  } else {
  log.info('Validating enriched image URLs...');
  const uniqueUrls = [...new Set(
    toBeFetched
      .flatMap(p => p._images || [])
      .filter(u => u && u.startsWith('http'))
  )];

  const validationResults = new Map();

  // Validate via the backend API — parallel batches of 80
  const valBatches = [];
  for (let i = 0; i < uniqueUrls.length; i += 80) {
    valBatches.push(uniqueUrls.slice(i, i + 80));
  }
  const VAL_CONCURRENCY = 4;
  for (let g = 0; g < valBatches.length; g += VAL_CONCURRENCY) {
    const group = valBatches.slice(g, g + VAL_CONCURRENCY);
    const valResults = await Promise.allSettled(
      group.map(urlBatch =>
        axios.post(
          `${IMAGE_API_URL}/api/pipeline/images/validate`,
          { urls: urlBatch },
          { timeout: 30_000, headers: { 'Content-Type': 'application/json' } },
        ).then(({ data }) => {
          for (const r of (data.results || [])) validationResults.set(r.url, r);
        }).catch(err => {
          log.warn(`Image validation batch failed: ${err.message}`);
          for (const u of urlBatch) validationResults.set(u, { url: u, accessible: true, issues: [] });
        })
      )
    );
  }

  // Apply validation — remove inaccessible URLs, update stats
  for (const p of toBeFetched) {
    if (!p._images || p._images.length === 0) continue;

    const validated = [];
    const removed = [];
    for (const url of p._images) {
      const v = validationResults.get(url);
      if (v && !v.accessible) {
        removed.push(url);
        REPORT.images.inaccessible++;
      } else {
        validated.push(url);
        REPORT.images.accessible++;
      }
    }

    if (removed.length > 0) {
      log.warn(`Removed ${removed.length} inaccessible image(s) for ${p.partNumber}: ${removed.join(', ')}`);
    }

    p._images = validated.slice(0, 24);

    if (p._imageData) {
      p._imageData.enriched_image_urls = validated;
      p._imageData.primary_image_url = validated[0] || '';
      p._imageData.additional_image_urls = validated.slice(1);
      p._imageData.validation = {
        total: validated.length + removed.length,
        accessible: validated.length,
        inaccessible: removed.length,
        issues: removed.map(u => `Inaccessible: ${u}`),
      };
    }

    REPORT.images.validated += validated.length + removed.length;
  }
  } // end skipImageValidation else
  } else if (skipImageFetch) {
    log.info('PIPELINE_SKIP_IMAGE_FETCH enabled — using source/upload images only');
  } else {
    log.info('No additional image API fetch needed — all parts have source images or none require enrichment');
  }

  // Final observability summary — count all enriched parts, not only API fetch candidates
  const allEnriched = parts.filter((p) => p._enriched);
  const imagesWithPrimary = allEnriched.filter(p => p._imageData?.primary_image_url || p._images?.length).length;
  const imagesWithGallery = allEnriched.filter(p => (p._imageData?.additional_image_urls?.length || 0) > 0).length;
  const imagesWithDiagrams = allEnriched.filter(p => (p._imageData?.diagram_image_urls?.length || 0) > 0).length;
  const missingImages = allEnriched.filter(p => !p._images || p._images.length === 0);

  REPORT.images.withPrimary = imagesWithPrimary;
  REPORT.images.withGallery = imagesWithGallery;
  REPORT.images.withDiagrams = imagesWithDiagrams;
  REPORT.images.totalUrls = allEnriched.reduce((s, p) => s + (p._images?.length || 0), 0);

  for (const p of missingImages) {
    REPORT.images.missingParts.push(p.sku || p.partNumber);
  }

  log.info(`Images: ${imagesWithPrimary}/${allEnriched.length} with primary, ${imagesWithGallery} with gallery, ${imagesWithDiagrams} with diagrams`);
  log.info(`Validated ${REPORT.images.validated} URLs: ${REPORT.images.accessible} accessible, ${REPORT.images.inaccessible} removed`);
  if (REPORT.images.cacheHits > 0) log.info(`Cache hits: ${REPORT.images.cacheHits}`);
  if (missingImages.length > 0) log.warn(`${missingImages.length} parts have NO images`);
  if (REPORT.images.failedEnrichments.length > 0) log.warn(`${REPORT.images.failedEnrichments.length} parts had API failures`);

  log.progress({
    stage: 'validation',
    sub_stage: 'images_done',
    with_images: imagesWithPrimary,
    no_images: missingImages.length,
    total_parts: toBeFetched.length,
    validated: REPORT.images.validated,
    inaccessible: REPORT.images.inaccessible,
  });
}

/** Process a single image enrichment API result into part fields. */
function processImageResult(part, result) {
  if (!result || !result.primaryImage?.url) {
    if (!applySourceImagesFromInput(part)) {
      setEmptyImageData(part);
    }
    return;
  }

  const primaryUrl = result.primaryImage.url;
  const galleryUrls = (result.galleryImages || []).map(g => g?.url).filter(Boolean);
  const diagramUrls = (result.diagramImages || []).map(d => d?.url).filter(Boolean);
  const allUrls = [primaryUrl, ...galleryUrls, ...diagramUrls].filter(Boolean).slice(0, 12);

  // Backward-compatible flat array
  part._images = allUrls;

  // Structured image data
  part._imageData = {
    primary_image_url: primaryUrl,
    additional_image_urls: galleryUrls,
    diagram_image_urls: diagramUrls,
    enriched_image_urls: allUrls,
    confidence: result.confidenceScore || 0,
    sources: (result.sourceAttribution || []).map(s => s.source).filter(Boolean),
    validation: result.validation || null,
  };

  // Cache the result
  const key = imageCacheKey(part);
  _imageResultCache.set(key, { data: { _images: part._images, _imageData: { ...part._imageData } }, ts: Date.now() });

  // Manage cache size (evict oldest when over 5k entries)
  if (_imageResultCache.size > 5000) {
    const oldest = [..._imageResultCache.entries()]
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(0, 1000);
    for (const [k] of oldest) _imageResultCache.delete(k);
  }
}

/** Set empty image data on a part (fallback when API fails and no source uploads). */
function setEmptyImageData(part) {
  if (applySourceImagesFromInput(part)) return;
  if (part._images?.length) return;

  part._images = [];
  part._imageData = {
    primary_image_url: '',
    additional_image_urls: [],
    diagram_image_urls: [],
    enriched_image_urls: [],
    confidence: 0,
    sources: [],
    validation: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  PART NUMBER INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════

function deduplicatePartNumbers(parts) {
  log.step('Part Number Intelligence');
  const pnMap = new Map();
  let dupes = 0;

  for (const part of parts) {
    const norm = normalizePN(part.partNumber);
    if (!norm) continue;

    if (pnMap.has(norm)) {
      const existing = pnMap.get(norm);
      if (existing.vin !== part.vin) {
        // Same part from different vehicles — not a dupe, cross-reference
        part._crossRef = existing.partNumber;
      } else {
        dupes++;
      }
    } else {
      pnMap.set(norm, part);
    }
  }

  log.info(`Part numbers: ${pnMap.size} unique, ${dupes} duplicates within same VIN`);
}

// ═══════════════════════════════════════════════════════════════════════
//  TEMPLATE OUTPUT GENERATORS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build eBay compatibility (Relationship) rows from a fitment array.
 * Returns one row per vehicle entry — eBay requires one row per vehicle.
 */
function buildCompatibilityRows(headers, fitments) {
  if (!fitments || fitments.length === 0) return [];
  const relIdx = headers.findIndex(h => h && /^Relationship$/i.test(String(h).trim()));
  const relDetailIdx = headers.findIndex(h => h && /^Relationship\s*details$/i.test(String(h).trim()));
  const rIdx = relIdx >= 0 ? relIdx : 5;
  const rdIdx = relDetailIdx >= 0 ? relDetailIdx : 6;
  return fitments
    .filter(f => f.year && f.make && f.model)
    .map(f => {
      const row = new Array(headers.length).fill(null);
      row[rIdx] = 'Compatibility';
      row[rdIdx] = buildFitmentString(f);
      return row;
    });
}

/**
 * Read a template file and extract its structure.
 */
function readTemplate(filePath) {
  const wb = XLSX.readFile(filePath, { cellStyles: true });
  return wb;
}

/**
 * Extract business policies from upload job env or template fallback.
 */
function getBusinessPolicies(wb) {
  const fromJob = {
    shipping: process.env.PIPELINE_SHIPPING_PROFILE || '',
    returns: process.env.PIPELINE_RETURN_PROFILE || '',
    payment: process.env.PIPELINE_PAYMENT_PROFILE || '',
  };
  if (fromJob.shipping || fromJob.returns || fromJob.payment) {
    return fromJob;
  }

  const ws = wb.Sheets['BusinessPolicy'];
  if (!ws) return { shipping: '', returns: '', payment: '' };
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  return {
    shipping: data[1]?.[0] || '',
    returns: data[1]?.[1] || '',
    payment: data[1]?.[2] || '',
  };
}

/**
 * Build fitment compatibility string for eBay File Exchange.
 * Format: Year=YYYY|Make=XXX|Model=YYY|Submodel=ZZZ|Trim=TTT|Engine=EEE
 */
function buildFitmentString(vehicle) {
  const parts = [];
  if (vehicle.year) parts.push(`Year=${vehicle.year}`);
  if (vehicle.make) parts.push(`Make=${vehicle.make}`);
  if (vehicle.model) parts.push(`Model=${vehicle.model}`);
  if (vehicle.submodel || vehicle.chassisCode) parts.push(`Submodel=${vehicle.submodel || vehicle.chassisCode}`);
  if (vehicle.trim) parts.push(`Trim=${vehicle.trim}`);
  if (vehicle.engine) parts.push(`Engine=${vehicle.engine}`);
  return parts.join('|');
}

/**
 * Find the primary image column name from headers.
 * eBay templates use various names: PicURL, Item photo URL, Artikelfoto-URL, etc.
 */
function findImageColumn(headers) {
  const aliases = ['PicURL', 'Item photo URL', 'Artikelfoto-URL', 'Picture URL', 'Photo URL', 'Image URL'];
  for (const alias of aliases) {
    if (headers.indexOf(alias) >= 0) return alias;
  }
  // Fallback: case-insensitive search for common patterns
  const found = headers.find(h => h && /^(pic\s*url|item\s*photo\s*url|picture\s*url|image\s*url|artikelfoto)/i.test(String(h).trim()));
  return found || null;
}

/**
 * Find the additional images column name from headers.
 */
function findAdditionalImageColumn(headers) {
  const aliases = ['AdditionalImageURLs', 'Additional image URLs', 'Zus\u00E4tzliche Bild-URLs'];
  for (const alias of aliases) {
    if (headers.indexOf(alias) >= 0) return alias;
  }
  const found = headers.find(h => h && /additional\s*image/i.test(String(h).trim()));
  return found || null;
}

// ────────── US Motors Template ──────────

function generateUSMotorsOutput(parts, vinData) {
  log.info('Generating US Motors (eBay Motors) template...');
  const templateWb = readTemplate(CONFIG.templates.us);
  const policies = getBusinessPolicies(templateWb);

  // Get the full header from Cat-ConnectingRodsParts (it has the most complete column set)
  const refSheet = templateWb.Sheets['Cat-ConnectingRodsParts'];
  const refData = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
  const fullHeaders = refData[3]; // Row 3 has headers

  // Inject AdditionalPicURL columns right after PicURL (if not already present)
  // Supports up to 24 images total (PicURL + AdditionalPicURL + AdditionalPicURL1-22)
  const picUrlIdx = fullHeaders.findIndex(h => h && /picurl|item photo url/i.test(h));
  const addPicCols = ['AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2',
    'AdditionalPicURL3', 'AdditionalPicURL4', 'AdditionalPicURL5',
    'AdditionalPicURL6', 'AdditionalPicURL7', 'AdditionalPicURL8', 'AdditionalPicURL9',
    'AdditionalPicURL10', 'AdditionalPicURL11', 'AdditionalPicURL12', 'AdditionalPicURL13',
    'AdditionalPicURL14', 'AdditionalPicURL15', 'AdditionalPicURL16', 'AdditionalPicURL17',
    'AdditionalPicURL18', 'AdditionalPicURL19', 'AdditionalPicURL20', 'AdditionalPicURL21',
    'AdditionalPicURL22'];
  if (picUrlIdx >= 0 && !fullHeaders.includes('AdditionalPicURL')) {
    fullHeaders.splice(picUrlIdx + 1, 0, ...addPicCols);
  }
  ensureFitmentExportColumns(fullHeaders);

  // Build output workbook preserving template structure
  const outWb = XLSX.utils.book_new();

  // Copy INFO rows + headers for Listings sheet
  const listingsData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_multi_category_template_EBAY_MOTOR', null, null, ' Indicates missing recommended field'],
    ['#INFO'],
    fullHeaders,
  ];

  // Add data rows
  for (const part of parts) {
    if (!part._enriched) continue;
    const e = part._enriched;
    const vehicle = getVehicleInfo(part, vinData);

    // Main listing row
    const row = buildUSRow(fullHeaders, part, e, vehicle, policies);
    listingsData.push(row);

    // Comprehensive fitment rows — one row per year in the expanded platform range
    for (const fitRow of buildCompatibilityRows(fullHeaders, fitmentsForExport(part, vinData))) {
      listingsData.push(fitRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(listingsData);
  XLSX.utils.book_append_sheet(outWb, ws, 'Listings');

  // Copy supporting sheets
  copySheet(templateWb, outWb, 'Categories');
  copySheet(templateWb, outWb, 'BusinessPolicy');
  copySheet(templateWb, outWb, 'Aspects');

  return outWb;
}

function buildUSRow(headers, part, enriched, vehicle, policies) {
  const row = new Array(headers.length).fill(null);
  const set = (colName, value) => {
    const idx = headers.indexOf(colName);
    if (idx >= 0 && value !== undefined && value !== null && value !== '') row[idx] = value;
  };

  // Wrap description in rich tabbed HTML with embedded fitment table
  const descriptionHtml = wrapInTabbedDescription(
    enriched.description,
    part._fitments || [],
  );

  set('*Action(SiteID=eBayMotors|Country=US|Currency=USD|Version=1193)', 'Add');
  set('Custom label (SKU)', part.sku || part.category);
  set('Category ID', getPartCategory(part, 'US')?.categoryId || part._category?.categoryId || '262124');
  set('Category Name', getPartCategory(part, 'US')?.categoryName || part._category?.categoryName || 'Car & Truck Parts & Accessories');
  set('Title', enriched.title);
  set('P:UPC', 'Does not apply');
  set('Start price', part.price);
  set('Quantity', part._gridx?.quantity || part._quantity || CONFIG.defaultQuantity);
  set('Condition ID', CONFIG.defaultConditionId);
  set('Description', descriptionHtml);
  set('Format', CONFIG.defaultFormat);
  set('Duration', CONFIG.defaultDuration);
  set('Best Offer Enabled', 1);
  set('Immediate pay required', 1);
  set('Location', CONFIG.location);
  set('Max dispatch time', 3);
  set('Returns accepted option', 'ReturnsAccepted');
  set('Returns within option', 'Days_30');
  set('Refund option', 'MoneyBack');
  set('Return shipping cost paid by', 'Buyer');
  set('Shipping profile name', policies.shipping);
  set('Return profile name', policies.returns);
  set('Payment profile name', policies.payment);
  // Item Specifics
  set('C:Brand', enriched.brand);
  set('C:Type', enriched.type);
  set('C:Manufacturer Part Number', enriched.mpn || part.partNumber);
  set('C:OE/OEM Part Number', enriched.oemNumber || expandOemNumbers(part.partNumber));
  set('C:Placement on Vehicle', enriched.placement);
  set('C:Fitment Type', enriched.fitmentType || 'Direct Replacement');
  set('C:Warranty', enriched.warranty || 'No Warranty');
  set('C:Material', enriched.material);
  set('C:Color', enriched.color);
  set('C:Surface Finish', enriched.surfaceFinish);
  set('C:Interchange Part Number', enriched.interchangeNumber);
  set('C:Bundle Description', enriched.bundleDescription);
  set('C:Country/Region of Manufacture', enriched.countryOfManufacture || '');
  applyDynamicItemSpecifics(
    headers,
    row,
    mergeAiSpecificsOnly(buildFallbackItemSpecifics(part, vehicle), enriched.itemSpecifics),
  );

  // Images — eBay File Exchange requires separate columns per image (not pipe-separated)
  // PicURL = primary, AdditionalPicURL = 2nd, AdditionalPicURL1-22 = 3rd-24th (up to 24 total)
  if (part._images && part._images.length > 0) {
    const imgs = part._images.slice(0, 24);
    const imgCol = findImageColumn(headers);
    if (imgCol) set(imgCol, imgs[0]);
    if (imgs.length > 1) set('AdditionalPicURL', imgs[1]);
    for (let i = 2; i < imgs.length; i++) {
      set(`AdditionalPicURL${i - 1}`, imgs[i]);
    }
  }

  // Enriched image metadata columns (append-only, backward compatible)
  set('primary_image_url', part._imageData?.primary_image_url || '');
  set('additional_image_urls', (part._imageData?.additional_image_urls || []).join('|'));
  set('enriched_image_urls', (part._imageData?.enriched_image_urls || []).join('|'));

  // eBay File Exchange / MIP columns
  set('Compatibility', part._compatibilityMVL || '');
  set('Description Note', part._descriptionNote || '');

  // Fitment structured output columns
  set('fitment_json', part._fitmentJson || '[]');
  set('fitment_flat', part._fitmentFlat || '');
  set('fitment_year_range', part._fitmentYearRange || '');
  set('fitment_notes', (part._fitments?.[0]?.notes) || '');
  set('technical_notes', part._technicalNotes || part._enriched?.technicalNotes || '');

  return row;
}

// ────────── AU Template ──────────

function generateAUOutput(parts, vinData) {
  log.info('Generating AU (Australia) template...');
  const templateWb = readTemplate(CONFIG.templates.au);
  const policies = getBusinessPolicies(templateWb);

  const refSheet = templateWb.Sheets['Listings'];
  const refData = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
  const fullHeaders = refData[3];

  // Inject AdditionalPicURL columns right after PicURL (if not already present)
  // Supports up to 24 images total (PicURL + AdditionalPicURL + AdditionalPicURL1-22)
  const auPicUrlIdx = fullHeaders.findIndex(h => h && /item photo url|picurl|artikelfoto/i.test(h));
  const auAddPicCols = ['AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2',
    'AdditionalPicURL3', 'AdditionalPicURL4', 'AdditionalPicURL5',
    'AdditionalPicURL6', 'AdditionalPicURL7', 'AdditionalPicURL8', 'AdditionalPicURL9',
    'AdditionalPicURL10', 'AdditionalPicURL11', 'AdditionalPicURL12', 'AdditionalPicURL13',
    'AdditionalPicURL14', 'AdditionalPicURL15', 'AdditionalPicURL16', 'AdditionalPicURL17',
    'AdditionalPicURL18', 'AdditionalPicURL19', 'AdditionalPicURL20', 'AdditionalPicURL21',
    'AdditionalPicURL22'];
  if (auPicUrlIdx >= 0 && !fullHeaders.includes('AdditionalPicURL')) {
    fullHeaders.splice(auPicUrlIdx + 1, 0, ...auAddPicCols);
  }
  ensureFitmentExportColumns(fullHeaders);

  const outWb = XLSX.utils.book_new();
  const listingsData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_category_template_EBAY_AU', null, null, ' Indicates missing recommended field'],
    ['#INFO'],
    fullHeaders,
  ];

  for (const part of parts) {
    if (!part._enriched) continue;
    const e = getMarketplaceListingCopy(part, 'AU');
    const vehicle = getVehicleInfo(part, vinData);

    const row = new Array(fullHeaders.length).fill(null);
    const set = (colName, value) => {
      const idx = fullHeaders.indexOf(colName);
      if (idx >= 0) row[idx] = value;
    };

    set('*Action(SiteID=Australia|Country=AU|Currency=AUD|Version=1193)', 'Add');
    set('Custom label (SKU)', part.sku || part.category);
    set('Category ID', getPartCategory(part, 'AU')?.categoryId || '262124');
    set('Category name', getPartCategory(part, 'AU')?.categoryName || 'Car & Truck Parts & Accessories');
    set('Title', e.title);
    set('P:UPC', 'Does not apply');
    set('Start price', Math.round(part.price * 1.55 * 100) / 100); // ~USD→AUD
    set('Quantity', part._gridx?.quantity || part._quantity || CONFIG.defaultQuantity);
    set('Condition ID', CONFIG.defaultConditionId);
    set('Description', wrapInTabbedDescriptionLocalized(e.description, part._fitments || [], 'en-AU'));
    set('Format', CONFIG.defaultFormat);
    set('Duration', CONFIG.defaultDuration);
    set('Best Offer Enabled', 1);
    set('Immediate pay required', 1);
    set('Location', CONFIG.location);
    set('Max dispatch time', 5);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', policies.shipping);
    set('Return profile name', policies.returns);
    set('Payment profile name', policies.payment);
    // Item Specifics (AU uses English names like US, but OE/OEM is different)
    set('C:Brand', e.brand);
    set('C:Type', e.type);
    set('C:Manufacturer Part Number', e.mpn || part.partNumber);
    set('C:Reference OE/OEM Number', e.oemNumber || expandOemNumbers(part.partNumber));
    set('C:Country/Region of Manufacture', e.countryOfManufacture || '');
    set('C:Placement on Vehicle', e.placement);
    set('C:Fitment Type', e.fitmentType || 'Direct Replacement');
    set('C:Warranty', e.warranty || 'No Warranty');
    set('C:Material', e.material);
    set('C:Color', e.color);
    set('C:Surface Finish', e.surfaceFinish);
    set('C:Interchange Part Number', e.interchangeNumber);
    applyDynamicItemSpecifics(
      fullHeaders,
      row,
      mergeAiSpecificsOnly(buildFallbackItemSpecifics(part, vehicle), e.itemSpecifics),
    );

    // Images — eBay File Exchange requires separate columns per image
    if (part._images && part._images.length > 0) {
      const imgs = part._images.slice(0, 24);
      const imgCol = findImageColumn(fullHeaders);
      if (imgCol) set(imgCol, imgs[0]);
      if (imgs.length > 1) set('AdditionalPicURL', imgs[1]);
      for (let i = 2; i < imgs.length; i++) {
        set(`AdditionalPicURL${i - 1}`, imgs[i]);
      }
    }

    // Enriched image metadata columns
    set('primary_image_url', part._imageData?.primary_image_url || '');
    set('additional_image_urls', (part._imageData?.additional_image_urls || []).join('|'));
    set('enriched_image_urls', (part._imageData?.enriched_image_urls || []).join('|'));

    // eBay File Exchange / MIP columns
    set('Compatibility', part._compatibilityMVL || '');
    set('Description Note', part._descriptionNote || '');

    // Fitment structured output columns
    set('fitment_json', part._fitmentJson || '[]');
    set('fitment_flat', part._fitmentFlat || '');
    set('fitment_year_range', part._fitmentYearRange || '');
    set('fitment_notes', (part._fitments?.[0]?.notes) || '');
    set('technical_notes', part._technicalNotes || part._enriched?.technicalNotes || '');

    listingsData.push(row);

    // Comprehensive fitment rows
    for (const fitRow of buildCompatibilityRows(fullHeaders, fitmentsForExport(part, vinData))) {
      listingsData.push(fitRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(listingsData);
  XLSX.utils.book_append_sheet(outWb, ws, 'Listings');
  copySheet(templateWb, outWb, 'Categories');
  copySheet(templateWb, outWb, 'BusinessPolicy');
  copySheet(templateWb, outWb, 'Aspects');

  return outWb;
}

// ────────── UK Template ──────────

function generateUKOutput(parts, vinData) {
  log.info('Generating UK (United Kingdom) template...');
  const templateWb = readTemplate(CONFIG.templates.uk);
  const policies = getBusinessPolicies(templateWb);

  const refSheet = templateWb.Sheets['Listings'];
  const refData = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
  const fullHeaders = refData[3];

  const ukPicUrlIdx = fullHeaders.findIndex(h => h && /item photo url|picurl|artikelfoto/i.test(h));
  const ukAddPicCols = ['AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2',
    'AdditionalPicURL3', 'AdditionalPicURL4', 'AdditionalPicURL5',
    'AdditionalPicURL6', 'AdditionalPicURL7', 'AdditionalPicURL8', 'AdditionalPicURL9',
    'AdditionalPicURL10', 'AdditionalPicURL11', 'AdditionalPicURL12', 'AdditionalPicURL13',
    'AdditionalPicURL14', 'AdditionalPicURL15', 'AdditionalPicURL16', 'AdditionalPicURL17',
    'AdditionalPicURL18', 'AdditionalPicURL19', 'AdditionalPicURL20', 'AdditionalPicURL21',
    'AdditionalPicURL22'];
  if (ukPicUrlIdx >= 0 && !fullHeaders.includes('AdditionalPicURL')) {
    fullHeaders.splice(ukPicUrlIdx + 1, 0, ...ukAddPicCols);
  }
  ensureFitmentExportColumns(fullHeaders);

  const outWb = XLSX.utils.book_new();
  const listingsData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Indicates missing required fields'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_category_template_EBAY_GB', null, null, ' Indicates missing recommended field'],
    ['#INFO'],
    fullHeaders,
  ];

  for (const part of parts) {
    if (!part._enriched) continue;
    const e = getMarketplaceListingCopy(part, 'UK');
    const vehicle = getVehicleInfo(part, vinData);

    const row = new Array(fullHeaders.length).fill(null);
    const set = (colName, value) => {
      const idx = fullHeaders.indexOf(colName);
      if (idx >= 0) row[idx] = value;
    };

    set('*Action(SiteID=UK|Country=GB|Currency=GBP|Version=1193)', 'Add');
    set('Custom label (SKU)', part.sku || part.category);
    set('Category ID', getPartCategory(part, 'UK')?.categoryId || '262124');
    set('Category name', getPartCategory(part, 'UK')?.categoryName || 'Car & Truck Parts & Accessories');
    set('Title', e.title);
    set('P:UPC', 'Does not apply');
    set('Start price', Math.round(part.price * 0.79 * 100) / 100);
    set('Quantity', part._gridx?.quantity || part._quantity || CONFIG.defaultQuantity);
    set('Condition ID', CONFIG.defaultConditionId);
    set('Description', wrapInTabbedDescriptionLocalized(e.description, part._fitments || [], 'en-GB'));
    set('Format', CONFIG.defaultFormat);
    set('Duration', CONFIG.defaultDuration);
    set('Best Offer Enabled', 1);
    set('Immediate pay required', 1);
    set('Location', CONFIG.location);
    set('Max dispatch time', 5);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', policies.shipping);
    set('Return profile name', policies.returns);
    set('Payment profile name', policies.payment);
    set('C:Brand', e.brand);
    set('C:Type', e.type);
    set('C:Manufacturer Part Number', e.mpn || part.partNumber);
    set('C:Reference OE/OEM Number', e.oemNumber || expandOemNumbers(part.partNumber));
    set('C:Country/Region of Manufacture', e.countryOfManufacture || '');
    set('C:Placement on Vehicle', e.placement);
    set('C:Fitment Type', e.fitmentType || 'Direct Replacement');
    set('C:Warranty', e.warranty || 'No Warranty');
    set('C:Material', e.material);
    set('C:Color', e.color);
    set('C:Surface Finish', e.surfaceFinish);
    set('C:Interchange Part Number', e.interchangeNumber);
    applyDynamicItemSpecifics(
      fullHeaders,
      row,
      mergeAiSpecificsOnly(buildFallbackItemSpecifics(part, vehicle), e.itemSpecifics),
    );

    if (part._images && part._images.length > 0) {
      const imgs = part._images.slice(0, 24);
      const imgCol = findImageColumn(fullHeaders);
      if (imgCol) set(imgCol, imgs[0]);
      if (imgs.length > 1) set('AdditionalPicURL', imgs[1]);
      for (let i = 2; i < imgs.length; i++) {
        set(`AdditionalPicURL${i - 1}`, imgs[i]);
      }
    }

    set('primary_image_url', part._imageData?.primary_image_url || '');
    set('additional_image_urls', (part._imageData?.additional_image_urls || []).join('|'));
    set('enriched_image_urls', (part._imageData?.enriched_image_urls || []).join('|'));
    set('Compatibility', part._compatibilityMVL || '');
    set('Description Note', part._descriptionNote || '');
    set('fitment_json', part._fitmentJson || '[]');
    set('fitment_flat', part._fitmentFlat || '');
    set('fitment_year_range', part._fitmentYearRange || '');
    set('fitment_notes', (part._fitments?.[0]?.notes) || '');
    set('technical_notes', part._technicalNotes || part._enriched?.technicalNotes || '');

    listingsData.push(row);

    for (const fitRow of buildCompatibilityRows(fullHeaders, fitmentsForExport(part, vinData))) {
      listingsData.push(fitRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(listingsData);
  XLSX.utils.book_append_sheet(outWb, ws, 'Listings');
  copySheet(templateWb, outWb, 'Categories');
  copySheet(templateWb, outWb, 'BusinessPolicy');
  copySheet(templateWb, outWb, 'Aspects');

  return outWb;
}

// ────────── DE Template ──────────

function generateDEOutput(parts, vinData) {
  log.info('Generating DE (Germany) template...');
  const templateWb = readTemplate(CONFIG.templates.de);
  const policies = getBusinessPolicies(templateWb);

  const refSheet = templateWb.Sheets['Listings'];
  const refData = XLSX.utils.sheet_to_json(refSheet, { header: 1 });
  const fullHeaders = refData[3];

  // Inject AdditionalPicURL columns right after PicURL (if not already present)
  // Supports up to 24 images total (PicURL + AdditionalPicURL + AdditionalPicURL1-22)
  const dePicUrlIdx = fullHeaders.findIndex(h => h && /artikelfoto|item photo url|picurl/i.test(h));
  const deAddPicCols = ['AdditionalPicURL', 'AdditionalPicURL1', 'AdditionalPicURL2',
    'AdditionalPicURL3', 'AdditionalPicURL4', 'AdditionalPicURL5',
    'AdditionalPicURL6', 'AdditionalPicURL7', 'AdditionalPicURL8', 'AdditionalPicURL9',
    'AdditionalPicURL10', 'AdditionalPicURL11', 'AdditionalPicURL12', 'AdditionalPicURL13',
    'AdditionalPicURL14', 'AdditionalPicURL15', 'AdditionalPicURL16', 'AdditionalPicURL17',
    'AdditionalPicURL18', 'AdditionalPicURL19', 'AdditionalPicURL20', 'AdditionalPicURL21',
    'AdditionalPicURL22'];
  if (dePicUrlIdx >= 0 && !fullHeaders.includes('AdditionalPicURL')) {
    fullHeaders.splice(dePicUrlIdx + 1, 0, ...deAddPicCols);
  }
  ensureFitmentExportColumns(fullHeaders);

  const outWb = XLSX.utils.book_new();
  const listingsData = [
    ['#INFO', `Created=${Date.now()}`, null, null, null, null, ' Kennzeichnet fehlende Felder, die erforderlich sind'],
    ['#INFO', 'Version=1.0', null, 'Template=fx_category_template_EBAY_DE', null, null, ' Kennzeichnet ein fehlendes Feld, das empfohlen wird'],
    ['#INFO'],
    fullHeaders,
  ];

  for (const part of parts) {
    if (!part._enriched) continue;
    const e = getMarketplaceListingCopy(part, 'DE');
    const vehicle = getVehicleInfo(part, vinData);

    const row = new Array(fullHeaders.length).fill(null);
    const set = (colName, value) => {
      const idx = fullHeaders.indexOf(colName);
      if (idx >= 0) row[idx] = value;
    };

    set('*Action(SiteID=Germany|Country=DE|Currency=EUR|Version=1193)', 'Add');
    set('Custom label (SKU)', part.sku || part.category);
    set('Category ID', getPartCategory(part, 'DE')?.categoryId || '262124');
    set('Category name', getPartCategory(part, 'DE')?.categoryName || 'Car & Truck Parts & Accessories');
    set('Title', e.title);
    set('P:EAN', 'Nicht zutreffend');  // "Does not apply" in German
    set('Start price', Math.round(part.price * 0.92 * 100) / 100); // ~USD→EUR
    set('Quantity', part._gridx?.quantity || part._quantity || CONFIG.defaultQuantity);
    set('Condition ID', CONFIG.defaultConditionId);
    set('Description', wrapInTabbedDescriptionLocalized(e.description, part._fitments || [], 'de-DE'));
    set('Format', CONFIG.defaultFormat);
    set('Duration', CONFIG.defaultDuration);
    set('Best Offer Enabled', 1);
    set('VAT%', 19); // German VAT
    set('Immediate pay required', 1);
    set('Location', CONFIG.location);
    set('Max dispatch time', 5);
    set('Returns accepted option', 'ReturnsAccepted');
    set('Returns within option', 'Days_30');
    set('Refund option', 'MoneyBack');
    set('Return shipping cost paid by', 'Buyer');
    set('Shipping profile name', policies.shipping);
    set('Return profile name', policies.returns);
    set('Payment profile name', policies.payment);
    // German aspect names
    set('C:Hersteller', e.brand);                                      // Brand
    set('C:Produktart', e.type);                                       // Type
    set('C:Herstellernummer', e.mpn || part.partNumber);               // MPN
    set('C:OE/OEM Referenznummer(n)', e.oemNumber || expandOemNumbers(part.partNumber)); // OE/OEM Number
    set('C:Einbauposition', e.placement);                              // Placement
    set('C:Herstellungsland und -region', e.countryOfManufacture || ''); // Country/Region
    // VIN-decoded vehicle specifics for DE templates
    if (vehicle.engineCylinders || (vinData.get && vinData.get(part.vin)?.engineCylinders)) {
      const cylinders = vehicle.engineCylinders || vinData.get(part.vin)?.engineCylinders || '';
      if (cylinders) set('C:Zylinder', cylinders);                    // Cylinders
    }
    if (vehicle.fuelType || (vinData.get && vinData.get(part.vin)?.fuelType)) {
      const fuel = vehicle.fuelType || vinData.get(part.vin)?.fuelType || '';
      if (fuel) set('C:Kraftstoffart', fuel);                         // Fuel type
    }
    if (vehicle.engineDisplacement || (vinData.get && vinData.get(part.vin)?.engineDisplacement)) {
      const disp = vehicle.engineDisplacement || vinData.get(part.vin)?.engineDisplacement || '';
      if (disp) set('C:Hubraum', disp.includes('L') ? disp : `${disp} L`); // Engine displacement
    }
    set('C:Material', e.material);
    set('C:Farbe', e.color);                                          // Color in German
    applyDynamicItemSpecifics(
      fullHeaders,
      row,
      mergeAiSpecificsOnly(buildFallbackItemSpecifics(part, vehicle), e.itemSpecifics),
    );

    // Images — eBay File Exchange requires separate columns per image
    if (part._images && part._images.length > 0) {
      const imgs = part._images.slice(0, 24);
      const imgCol = findImageColumn(fullHeaders);
      if (imgCol) set(imgCol, imgs[0]);
      if (imgs.length > 1) set('AdditionalPicURL', imgs[1]);
      for (let i = 2; i < imgs.length; i++) {
        set(`AdditionalPicURL${i - 1}`, imgs[i]);
      }
    }

    // Enriched image metadata columns
    set('primary_image_url', part._imageData?.primary_image_url || '');
    set('additional_image_urls', (part._imageData?.additional_image_urls || []).join('|'));
    set('enriched_image_urls', (part._imageData?.enriched_image_urls || []).join('|'));

    // eBay File Exchange / MIP columns
    set('Compatibility', part._compatibilityMVL || '');
    set('Description Note', part._descriptionNote || '');

    // Fitment structured output columns
    set('fitment_json', part._fitmentJson || '[]');
    set('fitment_flat', part._fitmentFlat || '');
    set('fitment_year_range', part._fitmentYearRange || '');
    set('fitment_notes', (part._fitments?.[0]?.notes) || '');
    set('technical_notes', part._technicalNotes || part._enriched?.technicalNotes || '');

    listingsData.push(row);

    // Comprehensive fitment rows
    for (const fitRow of buildCompatibilityRows(fullHeaders, fitmentsForExport(part, vinData))) {
      listingsData.push(fitRow);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(listingsData);
  XLSX.utils.book_append_sheet(outWb, ws, 'Listings');
  copySheet(templateWb, outWb, 'Categories');
  copySheet(templateWb, outWb, 'BusinessPolicy');
  copySheet(templateWb, outWb, 'Aspects');

  return outWb;
}

/**
 * Copy a sheet from source workbook to destination workbook.
 */
function copySheet(srcWb, dstWb, sheetName) {
  if (srcWb.Sheets[sheetName]) {
    XLSX.utils.book_append_sheet(dstWb, srcWb.Sheets[sheetName], sheetName);
  }
}

/**
 * Read template Aspects sheet to get valid aspect values for a category.
 * Returns Map<categoryId, Map<aspectName, string[]>> for lookup.
 */
function readTemplateAspects(wb) {
  const ws = wb.Sheets['Aspects'];
  if (!ws) return new Map();

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const aspectMap = new Map();

  // Aspects sheet: CategoryID | AspectName | Value1 | Value2 | ...
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    const catId = String(row[0]);
    const aspectName = String(row[1] || '');
    if (!aspectName) continue;

    if (!aspectMap.has(catId)) aspectMap.set(catId, new Map());
    const catAspects = aspectMap.get(catId);

    const values = row.slice(2).filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim());
    catAspects.set(aspectName, values);
  }

  return aspectMap;
}

/**
 * Save pipeline checkpoint for resume capability.
 */
function saveCheckpoint(parts, step) {
  const checkpointPath = path.join(CONFIG.outputDir, '.pipeline-checkpoint.json');
  try {
    const checkpoint = {
      step,
      timestamp: new Date().toISOString(),
      totalParts: parts.length,
      processedCount: parts.filter(p => p._enriched).length,
      // Save minimal data for resume — just enriched flags and core IDs
      partStates: parts.map(p => ({
        vin: p.vin,
        sku: p.sku,
        partNumber: p.partNumber,
        hasEnriched: !!p._enriched,
        hasCategory: !!getPartCategory(p, 'US'),
        categories: p._categories
          ? Object.fromEntries(
              getActivePipelineMarketplaces().map((m) => [m, getPartCategory(p, m)?.categoryId ?? null]),
            )
          : null,
      })),
    };
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint));
    log.info(`Checkpoint saved: step=${step}, ${checkpoint.processedCount}/${parts.length} enriched`);
  } catch (err) {
    log.warn(`Failed to save checkpoint: ${err.message}`);
  }
}

/**
 * Check if a checkpoint exists and return it.
 */
function loadCheckpoint() {
  const checkpointPath = path.join(CONFIG.outputDir, '.pipeline-checkpoint.json');
  if (!fs.existsSync(checkpointPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    log.info(`Found checkpoint from ${data.timestamp}: step=${data.step}, ${data.processedCount}/${data.totalParts} enriched`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Clear checkpoint after successful completion.
 */
function clearCheckpoint() {
  const checkpointPath = path.join(CONFIG.outputDir, '.pipeline-checkpoint.json');
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════

function generateReport() {
  const elapsed = ((Date.now() - REPORT.startTime) / 1000).toFixed(1);

  const report = {
    summary: {
      totalInputParts: REPORT.totalInput,
      totalProcessed: REPORT.totalProcessed,
      totalFailedEnrichment: REPORT.totalFailed,
      totalListingsGenerated: REPORT.totalInput - REPORT.totalSkipped,
      totalAiEnriched: REPORT.totalProcessed,
      totalFallbackEnrichment: REPORT.totalFailed,
      enrichmentMode: getEnrichmentMode(),
      totalSkipped: REPORT.totalSkipped,
      processingTimeSeconds: parseFloat(elapsed),
      templatesGenerated: ['US-Motors', 'AU-Category', 'DE-Category'],
    },
    vinDecoding: {
      success: REPORT.vinDecodeSuccess,
      failed: REPORT.vinDecodeFail,
      successRate: REPORT.vinDecodeSuccess > 0
        ? `${((REPORT.vinDecodeSuccess / (REPORT.vinDecodeSuccess + REPORT.vinDecodeFail)) * 100).toFixed(1)}%`
        : '0%',
    },
    categoryMapping: {
      apiMapped: REPORT.categoryMappingApi,
      aiMapped: REPORT.categoryMappingAi,
      fallbackMapped: REPORT.categoryMappingFallback,
      categoryMode,
      aiModel: aiCategoryClassifier.getStats().model,
      byMarketplace: REPORT.categoryByMarketplace,
      apiRate: (() => {
        const total =
          REPORT.categoryMappingApi +
          REPORT.categoryMappingAi +
          REPORT.categoryMappingFallback;
        if (!total) return '0%';
        const apiPlusAi = REPORT.categoryMappingApi + REPORT.categoryMappingAi;
        return `${((apiPlusAi / total) * 100).toFixed(1)}%`;
      })(),
      taxonomyErrors: REPORT.taxonomyErrors.slice(0, 20),
      apiSkippedReason: REPORT.taxonomyApiSkippedReason,
      treeCacheHit: REPORT.taxonomyTreeCacheHit,
      treeCacheSource: REPORT.taxonomyTreeCacheSource,
      suggestionCacheHits: taxonomyClient.getStats().suggestionCacheHits,
      suggestionApiCalls: taxonomyClient.getStats().suggestionApiCalls,
      aiCacheHits: aiCategoryClassifier.getStats().cacheHits,
      aiApiCalls: aiCategoryClassifier.getStats().apiCalls,
      aiTokensUsed: aiCategoryClassifier.getStats().tokensUsed,
      dailyTaxonomyUsage: taxonomyClient.getStats().dailyUsage,
      dailyTaxonomyQuota: taxonomyClient.getStats().dailyQuota,
    },
    openai: {
      defaultModel: CONFIG.openai.model,
      totalCalls: REPORT.openaiCalls,
      totalTokens: REPORT.openaiTokensUsed,
      errors: REPORT.openaiErrors,
      specificsEnrichedCount: REPORT.specificsEnrichedCount,
      estimatedCost: `$${(REPORT.openaiTokensUsed * 0.00000050).toFixed(4)}`,
      enrichmentRate: REPORT.totalInput > 0
        ? `${((REPORT.totalProcessed / REPORT.totalInput) * 100).toFixed(1)}%`
        : '0%',
    },
    aiRouting: {
      policyVersion: REPORT.routing.policyVersion,
      runMode: RUN_MODE,
      promptVersion: PROMPT_VERSION,
      escalations: REPORT.routing.escalations,
      guardFixes: REPORT.routing.guardFixes,
      validationFails: REPORT.routing.validationFails,
      enrichmentCacheHits: REPORT.routing.enrichmentCacheHits,
      runLogCount: REPORT.aiRunLogs.length,
    },
    validationFixes: REPORT.validationFixes.slice(0, 100),
    missingRequiredSpecifics: REPORT.missingSpecifics.slice(0, 100),
    errors: REPORT.errors.slice(0, 50),
    localization: {
      ukAiTranslated: REPORT.localization.ukAiTranslated,
      auAiTranslated: REPORT.localization.auAiTranslated,
      deAiTranslated: REPORT.localization.deAiTranslated,
      ukRuleOnly: REPORT.localization.ukRuleOnly,
      auRuleOnly: REPORT.localization.auRuleOnly,
      deRuleOnly: REPORT.localization.deRuleOnly,
      errors: REPORT.localization.errors,
    },
    imageEnrichment: {
      totalParts: REPORT.images.totalParts,
      withPrimaryImage: REPORT.images.withPrimary,
      withGalleryImages: REPORT.images.withGallery,
      withDiagramImages: REPORT.images.withDiagrams,
      totalImageUrls: REPORT.images.totalUrls,
      urlsValidated: REPORT.images.validated,
      urlsAccessible: REPORT.images.accessible,
      urlsInaccessible: REPORT.images.inaccessible,
      belowMinResolution: REPORT.images.belowMinResolution,
      apiFailures: REPORT.images.apiFailed,
      apiRetries: REPORT.images.apiRetries,
      cacheHits: REPORT.images.cacheHits,
      coverage: REPORT.images.totalParts > 0
        ? `${((REPORT.images.withPrimary / REPORT.images.totalParts) * 100).toFixed(1)}%`
        : '0%',
      missingParts: REPORT.images.missingParts.slice(0, 50),
      failedEnrichments: REPORT.images.failedEnrichments.slice(0, 50),
    },
    fitmentExpansion: {
      totalParts: REPORT.fitment.totalParts,
      aiInterchangeUsed: REPORT.fitment.aiInterchangeUsed || 0,
      platformExpanded: REPORT.fitment.platformExpanded,
      crossRefExpanded: REPORT.fitment.crossRefExpanded,
      sharedPlatformExpanded: REPORT.fitment.sharedPlatformExpanded || 0,
      singleVehicle: REPORT.fitment.singleVehicle,
      totalCompatibilityEntries: REPORT.fitment.totalCompatEntries,
      coverage: REPORT.fitment.totalParts > 0
        ? `${(((REPORT.fitment.totalParts - REPORT.fitment.noFitment.length) / REPORT.fitment.totalParts) * 100).toFixed(1)}%`
        : '0%',
      incompleteFitments: REPORT.fitment.incomplete.slice(0, 50),
      noFitment: REPORT.fitment.noFitment.slice(0, 50),
    },
  };

  return report;
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const activeMarketplaces = initActivePipelineMarketplaces(process.env.PIPELINE_TARGET_MARKETPLACE);
  const marketplaceBanner =
    activeMarketplaces.length === PIPELINE_MARKETPLACES.length
      ? 'US · UK · AU · DE'
      : activeMarketplaces.join(' · ');

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  eBay Motors Enrichment Pipeline                             ║
║  VIN → Enriched Listings (${marketplaceBanner.padEnd(24)})║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Donor vehicle context from the uploaded filename (e.g. "Q7 AUDI SILVER 2008.xlsx").
  // Fills make/model/year for parts that lack a VIN or a descriptive sheet name so the
  // AI identifies the correct part and the title leads with Year/Make/Model.
  DONOR_VEHICLE = parseVehicleFromFilename(
    process.env.PIPELINE_ORIGINAL_FILENAME || path.basename(CONFIG.input || ''),
  );
  if (DONOR_VEHICLE.make || DONOR_VEHICLE.model || DONOR_VEHICLE.year) {
    log.info(
      `Donor vehicle (from filename): ${`${DONOR_VEHICLE.year} ${DONOR_VEHICLE.make} ${DONOR_VEHICLE.model}`.trim()}`,
    );
  }

  // ── Step 1: Parse Input ──
  const parts = parseInputFile(CONFIG.input);
  if (parts.length === 0) {
    log.error('No parts found in input file. Exiting.');
    process.exit(1);
  }
  log.progress({ stage: 'uploading', total_parts: parts.length, processed: 0 });

  // ── Step 2: VIN Decoding ──
  const vinData = await decodeAllVins(parts);
  saveCheckpoint(parts, 'vin-decode');

  // ── Step 2.5: OEM Part Identification (eBay Browse) ──
  // Anchor each row's part name/type to eBay's live catalog before category
  // mapping + enrichment so both use the verified component, not the noisy
  // supplier description.
  await identifyPartsByOem(parts);

  // ── Step 3: Category Mapping ──
  await mapCategories(parts, vinData);
  saveCheckpoint(parts, 'category-mapping');

  // ── Step 4: Part Number Intelligence ──
  deduplicatePartNumbers(parts);

  // ── Step 5: OpenAI Enrichment ──
  await enrichAllParts(parts, vinData);
  saveCheckpoint(parts, 'enrichment');

  // ── Step 5.4: MVL fitment expansion (deterministic; v4 prompt has no compatibility[]) ──
  const { interchangeQueue, expander: mvlExpander } = await runMvlFitmentExpansion(parts, vinData);
  await runInterchangeMicroCalls(interchangeQueue, vinData);
  if (mvlExpander) await mvlExpander.close();
  saveCheckpoint(parts, 'mvl-fitment');

  // ── Step 5.5: Legacy fitment expansion fallback (skipped when MVL rows present) ──
  expandFitments(parts, vinData);

  // ── Step 6: Compliance Validation + Image Enrichment (parallel) ──
  log.progress({ stage: 'validation', total_parts: parts.length, processed: parts.filter(p => p._enriched).length });

  const enrichedParts = parts.filter(p => p._enriched);
  const needsLocalization = activeMarketplaces.some((m) => m !== 'US');
  log.info(
    `${enrichedParts.length} enriched parts ready for validation + images` +
    (needsLocalization ? ' + localization' : ''),
  );

  // Validation is sync and mutates _enriched — must finish before localization reads copy
  await validateAndFix(parts, vinData);

  // Images and non-US localization are independent — run together when needed
  if (needsLocalization) {
    await Promise.all([
      fetchImages(enrichedParts),
      localizeAllMarketplaceCopy(parts),
    ]);
  } else {
    await fetchImages(enrichedParts);
  }

  // ── Step 7: Generate Template Outputs (sequential — lower peak memory for large jobs) ──
  log.step('Generating Output Templates');
  log.progress({
    stage: 'output_generation',
    sub_stage: 'writing_us',
    total_parts: enrichedParts.length,
    processed: 0,
  });

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const outputSpecs = {
    US: {
      path: path.join(CONFIG.outputDir, `US-Motors-Listings-${dateSuffix}.xlsx`),
      subStage: 'writing_us',
      label: 'US Motors',
      generate: () => generateUSMotorsOutput(enrichedParts, vinData),
    },
    UK: {
      path: path.join(CONFIG.outputDir, `UK-Category-Listings-${dateSuffix}.xlsx`),
      subStage: 'writing_uk',
      label: 'UK',
      generate: () => generateUKOutput(enrichedParts, vinData),
    },
    AU: {
      path: path.join(CONFIG.outputDir, `AU-Category-Listings-${dateSuffix}.xlsx`),
      subStage: 'writing_au',
      label: 'AU',
      generate: () => generateAUOutput(enrichedParts, vinData),
    },
    DE: {
      path: path.join(CONFIG.outputDir, `DE-Category-Listings-${dateSuffix}.xlsx`),
      subStage: 'writing_de',
      label: 'DE',
      generate: () => generateDEOutput(enrichedParts, vinData),
    },
  };

  let written = 0;
  for (const marketplace of activeMarketplaces) {
    const spec = outputSpecs[marketplace];
    if (!spec) continue;
    log.progress({
      stage: 'output_generation',
      sub_stage: spec.subStage,
      total_parts: enrichedParts.length,
      processed: Math.ceil((enrichedParts.length * written) / activeMarketplaces.length),
    });
    const wb = spec.generate();
    XLSX.writeFile(wb, spec.path);
    log.info(`  ✓ ${spec.label}: ${spec.path}`);
    written += 1;
  }
  log.progress({
    stage: 'output_generation',
    sub_stage: 'writing_done',
    total_parts: enrichedParts.length,
    processed: enrichedParts.length,
  });

  // ── Step 8: Generate Report ──
  log.step('Pipeline Report');
  const report = generateReport();
  const reportPath = path.join(CONFIG.outputDir, `enrichment-report-${new Date().toISOString().slice(0,10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  finalizeRoutingCostByLane();
  const aiRunLogsPath = path.join(CONFIG.outputDir, 'ai-run-logs.json');
  fs.writeFileSync(
    aiRunLogsPath,
    JSON.stringify(
      {
        logs: REPORT.aiRunLogs,
        summary: {
          total: REPORT.aiRunLogs.length,
          attemptsByLane: REPORT.routing.attemptsByLane,
          estimatedCostByLane: REPORT.routing.estimatedCostByLane,
          policyVersion: REPORT.routing.policyVersion,
        },
      },
      null,
      2,
    ),
  );
  log.info(`  ✓ AI run logs: ${aiRunLogsPath} (${REPORT.aiRunLogs.length} entries)`);

  console.log('\n' + JSON.stringify(report.summary, null, 2));
  console.log(`\nFull report: ${reportPath}`);
  console.log(`\n✓ Pipeline complete. ${enrichedParts.length} listings generated for ${marketplaceBanner}.`);

  // Clear checkpoint on success
  clearCheckpoint();
}

main().catch(err => {
  log.error(`Pipeline failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
