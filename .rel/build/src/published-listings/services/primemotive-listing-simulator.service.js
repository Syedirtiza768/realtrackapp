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
var PrimemotiveListingSimulatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimemotiveListingSimulatorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const scheduler_leader_service_js_1 = require("../../common/scheduler/scheduler-leader.service.js");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
let PrimemotiveListingSimulatorService = PrimemotiveListingSimulatorService_1 = class PrimemotiveListingSimulatorService {
    listingRepo;
    leader;
    logger = new common_1.Logger(PrimemotiveListingSimulatorService_1.name);
    constructor(listingRepo, leader) {
        this.listingRepo = listingRepo;
        this.leader = leader;
    }
    async updateSyntheticListing() {
        if (!this.isEnabled())
            return;
        const organizationId = process.env.PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID?.trim();
        if (!organizationId) {
            this.logger.warn('Primemotive simulator is enabled but PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID is empty');
            return;
        }
        await this.leader.runIfLeader('primemotive-listing-simulator', 55, async () => this.changeOneSyntheticListing(organizationId));
    }
    isEnabled() {
        const value = process.env.PRIMEMOTIVE_SIMULATION_ENABLED?.trim().toLowerCase();
        return value === 'true' || value === '1';
    }
    async changeOneSyntheticListing(organizationId) {
        const listings = await this.listingRepo
            .createQueryBuilder('listing')
            .innerJoin(store_entity_js_1.Store, 'store', 'store.id = listing.storeId')
            .where('listing.organizationId = :organizationId', { organizationId })
            .andWhere('listing.isTestListing = true')
            .andWhere("listing.listingStatus = 'active'")
            .andWhere('store.channel = :channel', { channel: 'ebay' })
            .andWhere('LOWER(BTRIM(store.store_name)) = :storeName', {
            storeName: 'primemotive',
        })
            .orderBy('listing.ebayItemId', 'ASC')
            .getMany();
        if (!listings.length) {
            this.logger.warn(`Primemotive simulator has no active synthetic listings for organization ${organizationId}; run seed:primemotive-dummies first`);
            return;
        }
        const listing = listings[Math.floor(Math.random() * listings.length)];
        if (Math.random() < 0.5) {
            const current = Number(listing.price ?? 100);
            const direction = Math.random() < 0.5 ? -1 : 1;
            const change = 1 + Math.floor(Math.random() * 5);
            listing.price = Math.max(1, current + direction * change).toFixed(2);
        }
        else {
            const current = listing.quantityAvailable ?? 0;
            const direction = current <= 0 ? 1 : current >= 20 ? -1 : Math.random() < 0.5 ? -1 : 1;
            listing.quantityAvailable = Math.max(0, current + direction);
        }
        await this.listingRepo.save(listing);
        this.logger.debug(`Updated synthetic Primemotive listing ${listing.ebayItemId} for integration testing`);
    }
};
exports.PrimemotiveListingSimulatorService = PrimemotiveListingSimulatorService;
__decorate([
    (0, schedule_1.Cron)('0 * * * * *', { name: 'primemotive-listing-simulator' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PrimemotiveListingSimulatorService.prototype, "updateSyntheticListing", null);
exports.PrimemotiveListingSimulatorService = PrimemotiveListingSimulatorService = PrimemotiveListingSimulatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        scheduler_leader_service_js_1.SchedulerLeaderService])
], PrimemotiveListingSimulatorService);
//# sourceMappingURL=primemotive-listing-simulator.service.js.map