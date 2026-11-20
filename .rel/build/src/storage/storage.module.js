"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const image_asset_entity_js_1 = require("./entities/image-asset.entity.js");
const image_drive_asset_entity_js_1 = require("./entities/image-drive-asset.entity.js");
const image_drive_folder_entity_js_1 = require("./entities/image-drive-folder.entity.js");
const storage_controller_js_1 = require("./storage.controller.js");
const image_drive_controller_js_1 = require("./image-drive.controller.js");
const storage_service_js_1 = require("./storage.service.js");
const image_drive_service_js_1 = require("./image-drive.service.js");
const image_processor_service_js_1 = require("./image-processor.service.js");
const thumbnail_processor_js_1 = require("./processors/thumbnail.processor.js");
const cleanup_processor_js_1 = require("./processors/cleanup.processor.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
let StorageModule = class StorageModule {
};
exports.StorageModule = StorageModule;
exports.StorageModule = StorageModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                image_asset_entity_js_1.ImageAsset,
                image_drive_asset_entity_js_1.ImageDriveAsset,
                image_drive_folder_entity_js_1.ImageDriveFolder,
                listing_record_entity_js_1.ListingRecord,
                catalog_product_entity_js_1.CatalogProduct,
            ]),
            bullmq_1.BullModule.registerQueue({
                name: 'storage-thumbnails',
                defaultJobOptions: {
                    removeOnComplete: { age: 86400, count: 5000 },
                    removeOnFail: { age: 86400, count: 5000 },
                },
            }, { name: 'storage-cleanup' }),
        ],
        controllers: [storage_controller_js_1.StorageController, image_drive_controller_js_1.ImageDriveController],
        providers: [
            storage_service_js_1.StorageService,
            image_drive_service_js_1.ImageDriveService,
            image_processor_service_js_1.ImageProcessorService,
            thumbnail_processor_js_1.ThumbnailProcessor,
            cleanup_processor_js_1.CleanupProcessor,
        ],
        exports: [
            storage_service_js_1.StorageService,
            image_drive_service_js_1.ImageDriveService,
            image_processor_service_js_1.ImageProcessorService,
            typeorm_1.TypeOrmModule,
        ],
    })
], StorageModule);
//# sourceMappingURL=storage.module.js.map