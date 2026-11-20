"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ModelRouter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRouter = void 0;
exports.inferPartType = inferPartType;
exports.priceBand = priceBand;
exports.canaryBucketForSku = canaryBucketForSku;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function inferPartType(part) {
    const text = `${part.partName ?? ''} ${part.partType ?? ''}`.toLowerCase();
    for (const [type, re] of PART_TYPE_KEYWORDS) {
        if (re.test(text))
            return type;
    }
    return 'general';
}
function priceBand(price) {
    if (price == null || Number.isNaN(price))
        return '*';
    if (price >= 200)
        return '200-*';
    if (price >= 100)
        return '100-199';
    if (price >= 50)
        return '50-99';
    return '0-49';
}
let ModelRouter = ModelRouter_1 = class ModelRouter {
    config;
    logger = new common_1.Logger(ModelRouter_1.name);
    policy = null;
    constructor(config) {
        this.config = config;
    }
    onModuleInit() {
        this.reloadPolicy();
    }
    reloadPolicy() {
        const policyPath = this.resolvePolicyPath();
        if (!policyPath || !fs.existsSync(policyPath)) {
            this.policy = null;
            this.logger.log('No routing policy file — using env lane defaults');
            return;
        }
        try {
            const raw = fs.readFileSync(policyPath, 'utf8');
            this.policy = JSON.parse(raw);
            this.logger.log(`Loaded routing policy v${this.policy.version} from ${policyPath}`);
        }
        catch (err) {
            this.logger.warn(`Failed to load routing policy: ${err}`);
            this.policy = null;
        }
    }
    getPolicy() {
        return this.policy;
    }
    getBlocklist() {
        return this.policy?.blocklist ?? DEFAULT_BLOCKLIST;
    }
    selectLane(part, runMode = 'default') {
        const thresholds = this.getThresholds();
        const partType = part.partType ?? inferPartType(part);
        const price = part.price ?? 0;
        if (runMode === 'bulk')
            return 'bulk';
        if (price >= thresholds.flagshipMinPrice)
            return 'flagship';
        if (FLAGSHIP_PART_TYPES.some((t) => partType.includes(t)))
            return 'flagship';
        return 'default';
    }
    selectTextRoute(part, runMode = 'default') {
        const partType = part.partType ?? inferPartType(part);
        return this.buildSelection('text', this.modelForLane('text'), `text|${partType}|${runMode}`);
    }
    selectVisionRoute(part, runMode = 'default') {
        const base = this.selectRoute(part, runMode);
        const explicit = this.config.get('OPENAI_VISION_MODEL');
        const nonVisionModels = new Set([
            'deepseek/deepseek-chat-v3-0324',
            'openai/gpt-4o-mini',
        ]);
        let model = explicit ||
            (nonVisionModels.has(base.model) || base.lane === 'bulk'
                ? this.modelForLane('flagship')
                : base.model);
        if (nonVisionModels.has(model)) {
            model = this.modelForLane('flagship');
        }
        return this.buildSelection('flagship', model, `vision|${base.segmentKey}`);
    }
    selectRoute(part, runMode = 'default') {
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
        }
        else if (policy) {
            for (const key of segmentKeys) {
                const seg = policy.segments[key];
                if (seg && seg.lane === lane) {
                    return this.buildSelection(seg.lane, seg.model, key, policy.version);
                }
            }
        }
        return this.buildSelection(lane, this.modelForLane(lane), `${partType}|${band}`);
    }
    getEscalationModel(currentModel, lane) {
        if (lane === 'flagship')
            return null;
        const chain = this.policy?.escalationChain ?? [
            this.config.get('OPENAI_MODEL_DEFAULT', 'openai/gpt-4.1-mini'),
            this.config.get('OPENAI_MODEL_ESCALATION', 'google/gemini-2.5-flash'),
        ];
        const idx = chain.indexOf(currentModel);
        if (idx >= 0 && idx < chain.length - 1) {
            return chain[idx + 1];
        }
        if (lane === 'bulk') {
            return this.config.get('OPENAI_MODEL_ESCALATION', 'google/gemini-2.5-flash');
        }
        return this.config.get('OPENAI_MODEL_ESCALATION', 'google/gemini-2.5-flash');
    }
    assertAllowed(model) {
        if (this.getBlocklist().includes(model)) {
            throw new Error(`Model ${model} is blocklisted for enrichment`);
        }
    }
    buildSelection(lane, model, segmentKey, policyVersion = this.policy?.version ?? null) {
        this.assertAllowed(model);
        return { lane, model, policyVersion, segmentKey };
    }
    modelForLane(lane) {
        const legacy = this.config.get('OPENAI_CHAT_MODEL');
        const map = {
            default: this.config.get('OPENAI_MODEL_DEFAULT', 'openai/gpt-4.1-mini') ||
                legacy ||
                'openai/gpt-4.1-mini',
            flagship: this.config.get('OPENAI_MODEL_FLAGSHIP', 'google/gemini-2.5-flash'),
            bulk: this.config.get('OPENAI_MODEL_BULK', 'deepseek/deepseek-chat-v3-0324'),
            escalation: this.config.get('OPENAI_MODEL_ESCALATION', 'google/gemini-2.5-flash'),
            text: this.config.get('OPENAI_MODEL_TEXT', 'openai/gpt-4o-mini'),
        };
        const model = map[lane];
        this.assertAllowed(model);
        return model;
    }
    getThresholds() {
        const defaults = {
            flagshipMinPrice: Number(this.config.get('OPENAI_MODEL_FLAGSHIP_MIN_PRICE', '200')),
            lowValueMaxPrice: Number(this.config.get('AI_LOW_VALUE_MAX_PRICE', '50')),
            fitmentMinRows: Number(this.config.get('AI_FITMENT_MIN_ROWS', '5')),
            autoApproveMinScore: Number(this.config.get('AI_AUTO_APPROVE_MIN_SCORE', '85')),
        };
        return this.policy?.thresholds
            ? { ...defaults, ...this.policy.thresholds }
            : defaults;
    }
    resolvePolicyPath() {
        const configured = this.config.get('AI_ROUTING_POLICY_PATH');
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
    useCanary(sku, percent) {
        if (!percent || percent >= 100)
            return true;
        if (!sku)
            return percent >= 50;
        return canaryBucketForSku(sku) < percent;
    }
};
exports.ModelRouter = ModelRouter;
exports.ModelRouter = ModelRouter = ModelRouter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ModelRouter);
function canaryBucketForSku(sku) {
    let hash = 0;
    for (let i = 0; i < sku.length; i++) {
        hash = (hash * 31 + sku.charCodeAt(i)) % 100;
    }
    return hash;
}
//# sourceMappingURL=model-router.js.map