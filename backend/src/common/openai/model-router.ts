/**
 * ModelRouter — lane selection from routing policy + env fallbacks.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import type {
  AiLane,
  AiRoutingPolicy,
  PartContext,
  RouteSelection,
  RoutingThresholds,
  RunMode,
} from './ai-routing-policy.types.js';

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

const PART_TYPE_KEYWORDS: Array<[string, RegExp]> = [
  ['complete_engine', /\b(complete\s+)?engine\b/i],
  ['transmission', /\btransmission\b|\bgearbox\b/i],
  ['ecu', /\becu\b|\bcontrol\s+module\b/i],
  ['abs_module', /\babs\b.*\bmodule\b/i],
  ['window_regulator', /\bwindow\s+regulator\b/i],
  ['door_hinge', /\bdoor\s+hinge\b/i],
  ['door_shell', /\bdoor\s+(shell|panel)\b/i],
  ['speaker', /\bspeaker\b/i],
];

export function inferPartType(part: PartContext): string {
  const text = `${part.partName ?? ''} ${part.partType ?? ''}`.toLowerCase();
  for (const [type, re] of PART_TYPE_KEYWORDS) {
    if (re.test(text)) return type;
  }
  return 'general';
}

export function priceBand(price?: number): string {
  if (price == null || Number.isNaN(price)) return '*';
  if (price >= 200) return '200-*';
  if (price >= 100) return '100-199';
  if (price >= 50) return '50-99';
  return '0-49';
}

@Injectable()
export class ModelRouter implements OnModuleInit {
  private readonly logger = new Logger(ModelRouter.name);
  private policy: AiRoutingPolicy | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.reloadPolicy();
  }

  reloadPolicy(): void {
    const policyPath = this.resolvePolicyPath();
    if (!policyPath || !fs.existsSync(policyPath)) {
      this.policy = null;
      this.logger.log('No routing policy file — using env lane defaults');
      return;
    }
    try {
      const raw = fs.readFileSync(policyPath, 'utf8');
      this.policy = JSON.parse(raw) as AiRoutingPolicy;
      this.logger.log(
        `Loaded routing policy v${this.policy.version} from ${policyPath}`,
      );
    } catch (err) {
      this.logger.warn(`Failed to load routing policy: ${err}`);
      this.policy = null;
    }
  }

  getPolicy(): AiRoutingPolicy | null {
    return this.policy;
  }

  getBlocklist(): string[] {
    return this.policy?.blocklist ?? DEFAULT_BLOCKLIST;
  }

  selectLane(part: PartContext, runMode: RunMode = 'default'): AiLane {
    const thresholds = this.getThresholds();
    const partType = part.partType ?? inferPartType(part);
    const price = part.price ?? 0;

    if (runMode === 'bulk') return 'bulk';
    if (price >= thresholds.flagshipMinPrice) return 'flagship';
    if (FLAGSHIP_PART_TYPES.some((t) => partType.includes(t)))
      return 'flagship';
    return 'default';
  }

  /** Low-cost text-only tasks (image URL suggestion, ranking metadata). */
  selectTextRoute(
    part: PartContext,
    runMode: RunMode = 'default',
  ): RouteSelection {
    const partType = part.partType ?? inferPartType(part);
    return this.buildSelection(
      'text',
      this.modelForLane('text'),
      `text|${partType}|${runMode}`,
    );
  }

  /** Vision-capable model; avoids bulk/text-only models without image support. */
  selectVisionRoute(
    part: PartContext,
    runMode: RunMode = 'default',
  ): RouteSelection {
    const base = this.selectRoute(part, runMode);
    const explicit = this.config.get<string>('OPENAI_VISION_MODEL');
    const nonVisionModels = new Set([
      'deepseek/deepseek-chat-v3-0324',
      'openai/gpt-4o-mini',
    ]);
    let model =
      explicit ||
      (nonVisionModels.has(base.model) || base.lane === 'bulk'
        ? this.modelForLane('flagship')
        : base.model);
    if (nonVisionModels.has(model)) {
      model = this.modelForLane('flagship');
    }
    return this.buildSelection('flagship', model, `vision|${base.segmentKey}`);
  }

  selectRoute(part: PartContext, runMode: RunMode = 'default'): RouteSelection {
    const partType = part.partType ?? inferPartType(part);
    const band = priceBand(part.price);
    const marketplace = part.marketplace ?? 'US';
    const lane = this.selectLane({ ...part, partType }, runMode);

    const segmentKeys = [
      `${partType}|${band}|${marketplace}|${runMode}`,
      `${partType}|${band}|${marketplace}`,
      `${partType}|${band}`,
      `${partType}|*`,
      `*|${band}`,
      `*|*|${runMode}`,
      '*|*',
    ];

    const policy = this.policy;
    const pins = policy?.pins ?? {};

    for (const key of segmentKeys) {
      if (pins[key]) {
        return this.buildSelection(pins[key].lane, pins[key].model, key);
      }
    }

    if (policy && this.useCanary(part.sku, policy.canaryPercent ?? 0)) {
      for (const key of segmentKeys) {
        const seg = policy.segments[key];
        if (seg) {
          return this.buildSelection(seg.lane, seg.model, key, policy.version);
        }
      }
    } else if (policy) {
      for (const key of segmentKeys) {
        const seg = policy.segments[key];
        if (seg && seg.lane === lane) {
          return this.buildSelection(seg.lane, seg.model, key, policy.version);
        }
      }
    }

    return this.buildSelection(
      lane,
      this.modelForLane(lane),
      `${partType}|${band}`,
    );
  }

  getEscalationModel(currentModel: string, lane: AiLane): string | null {
    if (lane === 'flagship') return null;
    const chain = this.policy?.escalationChain ?? [
      this.config.get('OPENAI_MODEL_DEFAULT', 'openai/gpt-4.1-mini'),
      this.config.get('OPENAI_MODEL_ESCALATION', 'google/gemini-2.5-flash'),
    ];
    const idx = chain.indexOf(currentModel);
    if (idx >= 0 && idx < chain.length - 1) {
      return chain[idx + 1];
    }
    if (lane === 'bulk') {
      return this.config.get(
        'OPENAI_MODEL_ESCALATION',
        'google/gemini-2.5-flash',
      );
    }
    return this.config.get(
      'OPENAI_MODEL_ESCALATION',
      'google/gemini-2.5-flash',
    );
  }

  assertAllowed(model: string): void {
    if (this.getBlocklist().includes(model)) {
      throw new Error(`Model ${model} is blocklisted for enrichment`);
    }
  }

  private buildSelection(
    lane: AiLane,
    model: string,
    segmentKey: string,
    policyVersion: number | null = this.policy?.version ?? null,
  ): RouteSelection {
    this.assertAllowed(model);
    return { lane, model, policyVersion, segmentKey };
  }

  private modelForLane(lane: AiLane): string {
    const legacy = this.config.get<string>('OPENAI_CHAT_MODEL');
    const map: Record<AiLane, string> = {
      default:
        this.config.get('OPENAI_MODEL_DEFAULT', 'openai/gpt-4.1-mini') ||
        legacy ||
        'openai/gpt-4.1-mini',
      flagship: this.config.get(
        'OPENAI_MODEL_FLAGSHIP',
        'google/gemini-2.5-flash',
      ),
      bulk: this.config.get(
        'OPENAI_MODEL_BULK',
        'deepseek/deepseek-chat-v3-0324',
      ),
      escalation: this.config.get(
        'OPENAI_MODEL_ESCALATION',
        'google/gemini-2.5-flash',
      ),
      text: this.config.get('OPENAI_MODEL_TEXT', 'openai/gpt-4o-mini'),
    };
    const model = map[lane];
    this.assertAllowed(model);
    return model;
  }

  getThresholds(): RoutingThresholds {
    const defaults: RoutingThresholds = {
      flagshipMinPrice: Number(
        this.config.get('OPENAI_MODEL_FLAGSHIP_MIN_PRICE', '200'),
      ),
      lowValueMaxPrice: Number(this.config.get('AI_LOW_VALUE_MAX_PRICE', '50')),
      fitmentMinRows: Number(this.config.get('AI_FITMENT_MIN_ROWS', '5')),
      autoApproveMinScore: Number(
        this.config.get('AI_AUTO_APPROVE_MIN_SCORE', '85'),
      ),
    };
    return this.policy?.thresholds
      ? { ...defaults, ...this.policy.thresholds }
      : defaults;
  }

  private resolvePolicyPath(): string | null {
    const configured = this.config.get<string>('AI_ROUTING_POLICY_PATH');
    if (configured) {
      return path.isAbsolute(configured)
        ? configured
        : path.resolve(process.cwd(), '..', configured);
    }
    const candidates = [
      path.resolve(process.cwd(), 'config/ai-routing-policy.json'),
      path.resolve(process.cwd(), '../config/ai-routing-policy.json'),
    ];
    return candidates.find((p) => fs.existsSync(p)) ?? null;
  }

  /** Deterministic canary split by SKU hash */
  private useCanary(sku: string | undefined, percent: number): boolean {
    if (!percent || percent >= 100) return true;
    if (!sku) return percent >= 50;
    return canaryBucketForSku(sku) < percent;
  }
}

/** Exported for tests — stable 0–99 bucket per SKU. */
export function canaryBucketForSku(sku: string): number {
  let hash = 0;
  for (let i = 0; i < sku.length; i++) {
    hash = (hash * 31 + sku.charCodeAt(i)) % 100;
  }
  return hash;
}
