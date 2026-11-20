"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentCacheService = void 0;
const common_1 = require("@nestjs/common");
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
let EnrichmentCacheService = class EnrichmentCacheService {
    cache = new Map();
    key(mpn, promptVersion, profile) {
        const norm = mpn.replace(/\s+/g, '').toLowerCase();
        return `${norm}|${promptVersion}|${profile}`;
    }
    get(mpn, promptVersion, profile) {
        const trimmed = mpn?.trim();
        if (!trimmed)
            return null;
        const hit = this.cache.get(this.key(trimmed, promptVersion, profile));
        if (!hit)
            return null;
        if (Date.now() - hit.cachedAt > TTL_MS) {
            this.cache.delete(this.key(trimmed, promptVersion, profile));
            return null;
        }
        return hit.item;
    }
    set(mpn, promptVersion, profile, item) {
        const trimmed = mpn.trim();
        if (!trimmed)
            return;
        this.cache.set(this.key(trimmed, promptVersion, profile), {
            item,
            cachedAt: Date.now(),
        });
    }
};
exports.EnrichmentCacheService = EnrichmentCacheService;
exports.EnrichmentCacheService = EnrichmentCacheService = __decorate([
    (0, common_1.Injectable)()
], EnrichmentCacheService);
//# sourceMappingURL=enrichment-cache.service.js.map