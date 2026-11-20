"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_js_1 = require("../auth/auth.module.js");
const channels_module_js_1 = require("../channels/channels.module.js");
const rbac_module_js_1 = require("../rbac/rbac.module.js");
const teams_module_js_1 = require("../teams/teams.module.js");
const verticals_module_js_1 = require("../verticals/verticals.module.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const ebay_published_listing_entity_js_1 = require("../published-listings/entities/ebay-published-listing.entity.js");
const listing_action_log_entity_js_1 = require("../integrations/ebay/entities/listing-action-log.entity.js");
const business_industrial_review_entity_js_1 = require("../verticals/entities/business-industrial-review.entity.js");
const fashion_review_entity_js_1 = require("../verticals/entities/fashion-review.entity.js");
const team_entity_js_1 = require("../teams/entities/team.entity.js");
const catalog_workspace_service_js_1 = require("./catalog-workspace.service.js");
const catalog_workspace_controller_js_1 = require("./catalog-workspace.controller.js");
let CatalogModule = class CatalogModule {
};
exports.CatalogModule = CatalogModule;
exports.CatalogModule = CatalogModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_js_1.AuthModule,
            channels_module_js_1.ChannelsModule,
            rbac_module_js_1.RbacModule,
            teams_module_js_1.TeamsModule,
            verticals_module_js_1.VerticalsModule,
            typeorm_1.TypeOrmModule.forFeature([
                catalog_product_entity_js_1.CatalogProduct,
                listing_record_entity_js_1.ListingRecord,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                ebay_listing_channel_entity_js_1.EbayListingChannel,
                ebay_published_listing_entity_js_1.EbayPublishedListing,
                listing_action_log_entity_js_1.ListingActionLog,
                business_industrial_review_entity_js_1.BusinessIndustrialReview,
                fashion_review_entity_js_1.FashionReview,
                team_entity_js_1.Team,
            ]),
        ],
        controllers: [
            catalog_workspace_controller_js_1.FashionCatalogWorkspaceController,
            catalog_workspace_controller_js_1.BusinessIndustrialCatalogWorkspaceController,
        ],
        providers: [catalog_workspace_service_js_1.CatalogWorkspaceService],
    })
], CatalogModule);
//# sourceMappingURL=catalog.module.js.map