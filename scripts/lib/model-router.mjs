/**
 * Pipeline-side model router — reads config/ai-routing-policy.json + env.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const DEFAULT_BLOCKLIST = [
  'amazon/nova-lite-v1',
  'anthropic/claude-3.5-haiku',
  'meta-llama/llama-3.3-70b-instruct',
];

const FLAGSHIP_PART_TYPES = [
  'complete_engine',
  'transmission',
  'ecu',
  'abs_module',
  'engine',
  'gearbox',
];

const PART_TYPE_KEYWORDS = [
  ['complete_engine', /\b(complete\s+)?engine\b/i],
  ['transmission', /\btransmission\b|\bgearbox\b/i],
  ['ecu', /\becu\b|\bcontrol\s+module\b/i],
  ['abs_module', /\babs\b.*\bmodule\b/i],
  ['window_regulator', /\bwindow\s+regulator\b/i],
  ['door_hinge', /\bdoor\s+hinge\b/i],
  ['door_shell', /\bdoor\s+(shell|panel)\b/i],
  ['speaker', /\bspeaker\b/i],
];

export function inferPartType(part) {
  const text = `${part.partName ?? ''} ${part.partType ?? ''}`.toLowerCase();
  for (const [type, re] of PART_TYPE_KEYWORDS) {
    if (re.test(text)) return type;
  }
  return 'general';
}

export function priceBand(price) {
  if (price == null || Number.isNaN(price)) return '*';
  if (price >= 200) return '200-*';
  if (price >= 100) return '100-199';
  if (price >= 50) return '50-99';
  return '0-49';
}

function loadEnvDefaults(env = {}) {
  const legacy = env.OPENAI_CHAT_MODEL;
  return {
    default:
      env.OPENAI_MODEL_DEFAULT || legacy || 'openai/gpt-4.1-mini',
    flagship: env.OPENAI_MODEL_FLAGSHIP || 'google/gemini-2.5-flash',
    bulk: env.OPENAI_MODEL_BULK || 'deepseek/deepseek-chat-v3-0324',
    escalation:
      env.OPENAI_MODEL_ESCALATION || 'google/gemini-2.5-flash',
    text: env.OPENAI_MODEL_TEXT || 'openai/gpt-4o-mini',
    flagshipMinPrice: Number(env.OPENAI_MODEL_FLAGSHIP_MIN_PRICE || 200),
    lowValueMaxPrice: Number(env.AI_LOW_VALUE_MAX_PRICE || 50),
    fitmentMinRows: Number(env.AI_FITMENT_MIN_ROWS || 5),
    blocklist: DEFAULT_BLOCKLIST,
  };
}

function loadPolicy(env) {
  const policyPath =
    env.AI_ROUTING_POLICY_PATH
      ? path.isAbsolute(env.AI_ROUTING_POLICY_PATH)
        ? env.AI_ROUTING_POLICY_PATH
        : path.resolve(ROOT, env.AI_ROUTING_POLICY_PATH)
      : path.resolve(ROOT, 'config/ai-routing-policy.json');
  if (!fs.existsSync(policyPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  } catch {
    return null;
  }
}

export function createModelRouter(env = {}) {
  const defaults = loadEnvDefaults(env);
  const policy = loadPolicy(env);
  const blocklist = policy?.blocklist ?? defaults.blocklist;

  function assertAllowed(model) {
    if (blocklist.includes(model)) {
      throw new Error(`Model ${model} is blocklisted for enrichment`);
    }
  }

  function selectLane(part, runMode = 'default') {
    const partType = part.partType ?? inferPartType(part);
    const price = part.price ?? 0;
    const flagshipMin =
      policy?.thresholds?.flagshipMinPrice ?? defaults.flagshipMinPrice;
    if (runMode === 'bulk') return 'bulk';
    if (price >= flagshipMin) return 'flagship';
    if (FLAGSHIP_PART_TYPES.some((t) => partType.includes(t))) return 'flagship';
    return 'default';
  }

  function modelForLane(lane) {
    const model = defaults[lane] ?? defaults.default;
    assertAllowed(model);
    return model;
  }

  function selectTextRoute(part, runMode = 'default') {
    const partType = part.partType ?? inferPartType(part);
    const model = modelForLane('text');
    return {
      lane: 'text',
      model,
      policyVersion: policy?.version ?? null,
      segmentKey: `text|${partType}|${runMode}`,
    };
  }

  function selectVisionRoute(part, runMode = 'default') {
    const base = selectRoute(part, runMode);
    const explicit = env.OPENAI_VISION_MODEL;
    const nonVision = new Set([
      'deepseek/deepseek-chat-v3-0324',
      'openai/gpt-4o-mini',
    ]);
    let model =
      explicit ||
      (nonVision.has(base.model) || base.lane === 'bulk'
        ? modelForLane('flagship')
        : base.model);
    if (nonVision.has(model)) model = modelForLane('flagship');
    assertAllowed(model);
    return {
      lane: 'flagship',
      model,
      policyVersion: policy?.version ?? null,
      segmentKey: `vision|${base.segmentKey}`,
    };
  }

  function selectRoute(part, runMode = 'default') {
    const partType = part.partType ?? inferPartType(part);
    const band = priceBand(part.price);
    const lane = selectLane({ ...part, partType }, runMode);

    const segmentKeys = [
      `${partType}|${band}`,
      `${partType}|*`,
      `*|${band}`,
      `*|*|${runMode}`,
      '*|*',
    ];

    if (policy?.segments) {
      for (const key of segmentKeys) {
        const seg = policy.segments[key];
        if (seg && (seg.lane === lane || key === '*|*')) {
          assertAllowed(seg.model);
          return {
            lane: seg.lane,
            model: seg.model,
            policyVersion: policy.version ?? null,
            segmentKey: key,
          };
        }
      }
    }

    const model = modelForLane(lane);
    return {
      lane,
      model,
      policyVersion: policy?.version ?? null,
      segmentKey: `${partType}|${band}`,
    };
  }

  function getEscalationModel(currentModel, lane) {
    if (lane === 'flagship') return null;
    const chain = policy?.escalationChain ?? [
      defaults.default,
      defaults.escalation,
    ];
    const idx = chain.indexOf(currentModel);
    if (idx >= 0 && idx < chain.length - 1) return chain[idx + 1];
    return defaults.escalation;
  }

  function getBatchConfig(lane) {
    const configs = {
      default: { batchSize: 8, concurrency: 8 },
      flagship: { batchSize: 6, concurrency: 4 },
      bulk: { batchSize: 8, concurrency: 8 },
      escalation: { batchSize: 6, concurrency: 4 },
      text: { batchSize: 8, concurrency: 6 },
    };
    const base = configs[lane] ?? configs.default;
    const override = Number(env.PIPELINE_AI_CONCURRENCY || env.OPENAI_CONCURRENCY);
    if (override > 0) return { ...base, concurrency: override };
    return base;
  }

  return {
    selectRoute,
    selectTextRoute,
    selectVisionRoute,
    selectLane,
    getEscalationModel,
    getBatchConfig,
    getThresholds: () => ({
      fitmentMinRows:
        policy?.thresholds?.fitmentMinRows ?? defaults.fitmentMinRows,
      flagshipMinPrice:
        policy?.thresholds?.flagshipMinPrice ?? defaults.flagshipMinPrice,
      lowValueMaxPrice:
        policy?.thresholds?.lowValueMaxPrice ?? defaults.lowValueMaxPrice,
    }),
    policy,
    defaults,
  };
}
