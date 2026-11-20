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
var MotorsPublisherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotorsPublisherService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../entities");
const channels_service_1 = require("../../channels/channels.service");
const listings_service_1 = require("../../listings/listings.service");
let MotorsPublisherService = MotorsPublisherService_1 = class MotorsPublisherService {
    motorsProductRepo;
    feedbackLogRepo;
    channelsService;
    listingsService;
    logger = new common_1.Logger(MotorsPublisherService_1.name);
    constructor(motorsProductRepo, feedbackLogRepo, channelsService, listingsService) {
        this.motorsProductRepo = motorsProductRepo;
        this.feedbackLogRepo = feedbackLogRepo;
        this.channelsService = channelsService;
        this.listingsService = listingsService;
    }
    async publishToEbay(motorsProductId, connectionId) {
        const product = await this.motorsProductRepo.findOneOrFail({
            where: { id: motorsProductId },
        });
        if (product.status !== entities_1.MotorsProductStatus.APPROVED) {
            return {
                success: false,
                error: `Product status is ${product.status}, must be 'approved' to publish`,
            };
        }
        try {
            product.status = entities_1.MotorsProductStatus.PUBLISHING;
            await this.motorsProductRepo.save(product);
            const listingData = this.buildListingData(product);
            let listingId = product.listingId;
            if (!listingId) {
                const result = await this.listingsService.createForOrganization(listingData, product.organizationId, product.createdBy);
                listingId = result.listing.id;
                product.listingId = listingId;
                await this.motorsProductRepo.save(product);
            }
            else {
                await this.listingsService.update(listingId, listingData);
            }
            await this.channelsService.enqueuePublish(connectionId, listingId);
            product.status = entities_1.MotorsProductStatus.PUBLISHED;
            product.publishedAt = new Date();
            await this.motorsProductRepo.save(product);
            return { success: true };
        }
        catch (error) {
            this.logger.error(`Publish failed for ${motorsProductId}: ${error.message}`);
            product.status = entities_1.MotorsProductStatus.FAILED;
            product.publishError = error.message;
            await this.motorsProductRepo.save(product);
            await this.feedbackLogRepo.save(this.feedbackLogRepo.create({
                motorsProductId,
                feedbackType: entities_1.FeedbackType.EBAY_API_ERROR,
                context: {
                    error: error.message,
                    connectionId,
                },
            }));
            return { success: false, error: error.message };
        }
    }
    buildListingData(product) {
        const specifics = product.generatedItemSpecifics || {};
        return {
            title: product.generatedTitle || '',
            description: product.generatedHtmlDescription || '',
            categoryId: product.ebayCategoryId || '',
            categoryName: product.ebayCategoryName || '',
            startPrice: product.price ? String(product.price) : '',
            quantity: product.quantity ? String(product.quantity) : '1',
            conditionId: this.mapConditionToId(product.condition),
            itemPhotoUrl: (product.imageUrls || []).join('|'),
            format: 'FixedPrice',
            duration: 'GTC',
            customLabelSku: product.mpn || '',
            cBrand: specifics['Brand'] || product.brand || '',
            cManufacturerPartNumber: specifics['Manufacturer Part Number'] || product.mpn || '',
            cType: specifics['Type'] || product.productType || '',
            cOeOemPartNumber: specifics['OE/OEM Part Number'] || product.oemPartNumber || '',
            pUpc: product.upc || '',
            pEpid: product.epid || '',
            status: 'ready',
        };
    }
    mapConditionToId(condition) {
        switch (condition?.toLowerCase()) {
            case 'new':
                return '1000-New';
            case 'remanufactured':
                return '2000-Remanufactured';
            case 'used':
                return '3000-Used';
            case 'for parts or not working':
                return '7000-For parts or not working';
            default:
                return '3000-Used';
        }
    }
};
exports.MotorsPublisherService = MotorsPublisherService;
exports.MotorsPublisherService = MotorsPublisherService = MotorsPublisherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.MotorsProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.MotorsFeedbackLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        channels_service_1.ChannelsService,
        listings_service_1.ListingsService])
], MotorsPublisherService);
//# sourceMappingURL=motors-publisher.service.js.map