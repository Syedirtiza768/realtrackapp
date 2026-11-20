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
var PublishedListingsSyncProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsSyncProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const published_listings_sync_service_js_1 = require("../services/published-listings-sync.service.js");
let PublishedListingsSyncProcessor = PublishedListingsSyncProcessor_1 = class PublishedListingsSyncProcessor extends bullmq_1.WorkerHost {
    sync;
    logger = new common_1.Logger(PublishedListingsSyncProcessor_1.name);
    constructor(sync) {
        super();
        this.sync = sync;
    }
    async process(job) {
        this.logger.log(`Processing published listings sync job ${job.id} for account ${job.data.ebayAccountId}`);
        return this.sync.syncAccount(job.data);
    }
};
exports.PublishedListingsSyncProcessor = PublishedListingsSyncProcessor;
exports.PublishedListingsSyncProcessor = PublishedListingsSyncProcessor = PublishedListingsSyncProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('published-listings-sync', {
        concurrency: 1,
        lockDuration: 120 * 60 * 1000,
    }),
    __metadata("design:paramtypes", [published_listings_sync_service_js_1.PublishedListingsSyncService])
], PublishedListingsSyncProcessor);
//# sourceMappingURL=published-listings-sync.processor.js.map