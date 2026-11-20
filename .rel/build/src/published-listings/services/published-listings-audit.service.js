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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsAuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_published_listing_revision_entity_js_1 = require("../entities/ebay-published-listing-revision.entity.js");
let PublishedListingsAuditService = class PublishedListingsAuditService {
    revisionRepo;
    constructor(revisionRepo) {
        this.revisionRepo = revisionRepo;
    }
    async writeRevision(entry) {
        const row = this.revisionRepo.create(entry);
        await this.revisionRepo.save(row);
    }
    async listRevisions(publishedListingId, organizationId, limit = 50) {
        return this.revisionRepo.find({
            where: { publishedListingId, organizationId },
            order: { createdAt: 'DESC' },
            take: Math.min(limit, 200),
        });
    }
};
exports.PublishedListingsAuditService = PublishedListingsAuditService;
exports.PublishedListingsAuditService = PublishedListingsAuditService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_revision_entity_js_1.EbayPublishedListingRevision)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PublishedListingsAuditService);
//# sourceMappingURL=published-listings-audit.service.js.map