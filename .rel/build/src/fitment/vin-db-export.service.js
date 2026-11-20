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
var VinDbExportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VinDbExportService = void 0;
const common_1 = require("@nestjs/common");
const fitment_service_js_1 = require("./fitment.service.js");
const vin_decode_service_js_1 = require("./vin-decode.service.js");
const ebay_listing_images_util_js_1 = require("../channels/ebay/ebay-listing-images.util.js");
let VinDbExportService = VinDbExportService_1 = class VinDbExportService {
    fitmentService;
    vinDecode;
    logger = new common_1.Logger(VinDbExportService_1.name);
    constructor(fitmentService, vinDecode) {
        this.fitmentService = fitmentService;
        this.vinDecode = vinDecode;
    }
    async exportListingsByVin(vin) {
        this.logger.log(`Exporting DB listings for VIN: ${vin}`);
        const result = await this.fitmentService.findListingsByVin(vin);
        if (result.totalListings === 0) {
            throw new common_1.BadRequestException(`No listings found for VIN ${vin} (${result.vehicle.year} ${result.vehicle.make} ${result.vehicle.model}). Try searching eBay first via GET /fitment/vin/${vin}/listings.`);
        }
        const vehicle = result.vehicle;
        const rows = result.listings.map((listing, idx) => {
            const images = (0, ebay_listing_images_util_js_1.parseImageUrlField)(listing.itemPhotoUrl);
            return {
                sku: listing.customLabelSku || `ROW-${idx + 1}`,
                title: listing.title || '',
                brand: listing.cBrand || vehicle.make || '',
                type: listing.cType || '',
                category: listing.categoryName || '',
                price: listing.startPrice || listing.startPriceNum?.toString() || '',
                quantity: listing.quantity || listing.quantityNum?.toString() || '1',
                condition: listing.conditionId || '',
                mpn: listing.cManufacturerPartNumber || '',
                oemPart: listing.cOeOemPartNumber || '',
                imageUrls: images.join(' | '),
                description: listing.description || '',
                location: listing.location || '',
                format: listing.format || 'FIXED_PRICE',
            };
        });
        const buffer = this.buildXlsx(vehicle, rows, vin);
        const safeModel = (vehicle.model || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${vehicle.year}_${vehicle.make}_${safeModel}_VIN_${vin.slice(-6)}_listings.xlsx`;
        this.logger.log(`Exported ${rows.length} listings for ${vehicle.year} ${vehicle.make} ${vehicle.model} (strategy: ${result.matchStrategy})`);
        return {
            buffer,
            filename,
            vehicleInfo: vehicle,
            listingCount: rows.length,
            matchStrategy: result.matchStrategy,
        };
    }
    buildXlsx(vehicle, rows, vin) {
        const XLSX = require('xlsx');
        const wb = XLSX.utils.book_new();
        const sheetData = [];
        sheetData.push([
            '#INFO',
            `GridX Connect — DB listings for ${vehicle.year} ${vehicle.make} ${vehicle.model} (VIN: ${vin})`,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
        ]);
        sheetData.push([
            'Part Number',
            'Price',
            'Quantity',
            'Vehicle Make',
            'Description',
            'Image URLs',
            'SKU',
            'Weight Major',
            'Weight Minor',
            'Package Length',
            'Package Width',
            'Package Depth',
        ]);
        for (const row of rows) {
            sheetData.push([
                row.mpn || row.oemPart || '',
                row.price,
                row.quantity,
                row.brand,
                row.title || row.description,
                row.imageUrls,
                row.sku,
                '',
                '',
                '',
                '',
                '',
            ]);
        }
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [
            { wch: 18 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 },
            { wch: 80 },
            { wch: 50 },
            { wch: 25 },
            { wch: 12 },
            { wch: 12 },
            { wch: 14 },
            { wch: 13 },
            { wch: 13 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, vin);
        return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
};
exports.VinDbExportService = VinDbExportService;
exports.VinDbExportService = VinDbExportService = VinDbExportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [fitment_service_js_1.FitmentService,
        vin_decode_service_js_1.VinDecodeService])
], VinDbExportService);
//# sourceMappingURL=vin-db-export.service.js.map