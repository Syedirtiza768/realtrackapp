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
var EbayTaxonomyCacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayTaxonomyCacheService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const CACHE_VERSION = 2;
const SUGGESTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
let EbayTaxonomyCacheService = EbayTaxonomyCacheService_1 = class EbayTaxonomyCacheService {
    config;
    logger = new common_1.Logger(EbayTaxonomyCacheService_1.name);
    cachePath;
    scopeKey;
    dailyQuota;
    disk;
    constructor(config) {
        this.config = config;
        const root = this.config.get('PIPELINE_PROJECT_ROOT') ||
            path.resolve(process.cwd(), '..');
        this.cachePath = path.resolve(root, this.config.get('EBAY_TAXONOMY_CACHE_PATH') ||
            'config/.ebay-taxonomy-suggestions-cache.json');
        const sandbox = String(this.config.get('EBAY_SANDBOX', 'false')).toLowerCase() === 'true';
        const marketplace = this.config.get('EBAY_MARKETPLACE_ID') || 'EBAY_MOTORS_US';
        this.scopeKey = `${marketplace}:${sandbox ? 'sandbox' : 'production'}`;
        this.dailyQuota =
            Number(this.config.get('PIPELINE_TAXONOMY_DAILY_QUOTA')) || 4800;
        this.disk = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.cachePath)) {
                const parsed = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
                if (parsed?.version === CACHE_VERSION)
                    return parsed;
            }
        }
        catch (err) {
            this.logger.warn(`Taxonomy cache load failed: ${err.message}`);
        }
        return { version: CACHE_VERSION, scopes: {} };
    }
    persist() {
        try {
            fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
            fs.writeFileSync(this.cachePath, JSON.stringify(this.disk, null, 2));
        }
        catch (err) {
            this.logger.warn(`Taxonomy cache persist failed: ${err.message}`);
        }
    }
    scope() {
        if (!this.disk.scopes[this.scopeKey]) {
            this.disk.scopes[this.scopeKey] = {
                suggestions: {},
                aspects: {},
                compatibility: {},
                dailyUsage: {},
            };
        }
        return this.disk.scopes[this.scopeKey];
    }
    todayKey() {
        return new Date().toISOString().slice(0, 10);
    }
    getDailyUsage() {
        const day = this.todayKey();
        return this.scope().dailyUsage[day] ?? 0;
    }
    hasDailyQuota() {
        return this.getDailyUsage() < this.dailyQuota;
    }
    incrementDailyUsage() {
        const s = this.scope();
        const day = this.todayKey();
        s.dailyUsage[day] = (s.dailyUsage[day] ?? 0) + 1;
        for (const k of Object.keys(s.dailyUsage)) {
            if (k < day)
                delete s.dailyUsage[k];
        }
        this.persist();
    }
    normQuery(q) {
        return String(q || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
    getSuggestion(treeId, query) {
        const key = `${treeId}::${this.normQuery(query)}`;
        const entry = this.scope().suggestions[key];
        if (!entry)
            return undefined;
        if (Date.now() - entry.cachedAt > SUGGESTION_TTL_MS) {
            delete this.scope().suggestions[key];
            return undefined;
        }
        return entry.result;
    }
    setSuggestion(treeId, query, result) {
        const key = `${treeId}::${this.normQuery(query)}`;
        this.scope().suggestions[key] = { result, cachedAt: Date.now() };
        this.persist();
    }
    getCompatibility(categoryTreeId, categoryId) {
        const key = `${categoryTreeId}::${categoryId.trim()}`;
        const entry = this.scope().compatibility?.[key];
        if (!entry)
            return undefined;
        if (Date.now() - entry.cachedAt > SUGGESTION_TTL_MS) {
            delete this.scope().compatibility[key];
            return undefined;
        }
        return entry.required;
    }
    setCompatibility(categoryTreeId, categoryId, required) {
        const key = `${categoryTreeId}::${categoryId.trim()}`;
        if (!this.scope().compatibility)
            this.scope().compatibility = {};
        this.scope().compatibility[key] = { required, cachedAt: Date.now() };
        this.persist();
    }
};
exports.EbayTaxonomyCacheService = EbayTaxonomyCacheService;
exports.EbayTaxonomyCacheService = EbayTaxonomyCacheService = EbayTaxonomyCacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EbayTaxonomyCacheService);
//# sourceMappingURL=ebay-taxonomy-cache.service.js.map