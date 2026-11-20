"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellerpunditModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const channel_connection_entity_js_1 = require("../../channels/entities/channel-connection.entity.js");
const store_entity_js_1 = require("../../channels/entities/store.entity.js");
const token_encryption_service_js_1 = require("../../channels/token-encryption.service.js");
const connected_ebay_account_entity_js_1 = require("../ebay/entities/connected-ebay-account.entity.js");
const ebay_oauth_token_entity_js_1 = require("../ebay/entities/ebay-oauth-token.entity.js");
const ebay_account_marketplace_entity_js_1 = require("../ebay/entities/ebay-account-marketplace.entity.js");
const ebay_business_policy_entity_js_1 = require("../ebay/entities/ebay-business-policy.entity.js");
const organization_sellerpundit_config_entity_js_1 = require("./entities/organization-sellerpundit-config.entity.js");
const sellerpundit_http_client_js_1 = require("./sellerpundit-http.client.js");
const sellerpundit_auth_service_js_1 = require("./sellerpundit-auth.service.js");
const sellerpundit_token_sync_service_js_1 = require("./sellerpundit-token-sync.service.js");
const sellerpundit_account_sync_service_js_1 = require("./sellerpundit-account-sync.service.js");
const sellerpundit_policy_sync_service_js_1 = require("./sellerpundit-policy-sync.service.js");
const sellerpundit_listing_adapter_js_1 = require("./sellerpundit-listing.adapter.js");
const sellerpundit_marketplace_registry_js_1 = require("./sellerpundit-marketplace.registry.js");
const listing_action_log_entity_js_1 = require("../ebay/entities/listing-action-log.entity.js");
const ebay_marketplace_config_service_js_1 = require("../ebay/services/ebay-marketplace-config.service.js");
const listing_action_log_writer_service_js_1 = require("../ebay/services/listing-action-log-writer.service.js");
let SellerpunditModule = class SellerpunditModule {
};
exports.SellerpunditModule = SellerpunditModule;
exports.SellerpunditModule = SellerpunditModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                organization_sellerpundit_config_entity_js_1.OrganizationSellerpunditConfig,
                connected_ebay_account_entity_js_1.ConnectedEbayAccount,
                ebay_oauth_token_entity_js_1.EbayOAuthToken,
                channel_connection_entity_js_1.ChannelConnection,
                store_entity_js_1.Store,
                ebay_account_marketplace_entity_js_1.EbayAccountMarketplace,
                ebay_business_policy_entity_js_1.EbayBusinessPolicy,
                listing_action_log_entity_js_1.ListingActionLog,
            ]),
        ],
        providers: [
            token_encryption_service_js_1.TokenEncryptionService,
            ebay_marketplace_config_service_js_1.EbayMarketplaceConfigService,
            listing_action_log_writer_service_js_1.ListingActionLogWriterService,
            sellerpundit_http_client_js_1.SellerpunditHttpClient,
            sellerpundit_auth_service_js_1.SellerpunditAuthService,
            sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
            sellerpundit_account_sync_service_js_1.SellerpunditAccountSyncService,
            sellerpundit_policy_sync_service_js_1.SellerpunditPolicySyncService,
            sellerpundit_listing_adapter_js_1.SellerpunditListingAdapter,
            sellerpundit_marketplace_registry_js_1.SellerpunditMarketplaceRegistry,
        ],
        exports: [
            sellerpundit_auth_service_js_1.SellerpunditAuthService,
            sellerpundit_token_sync_service_js_1.SellerpunditTokenSyncService,
            sellerpundit_account_sync_service_js_1.SellerpunditAccountSyncService,
            sellerpundit_policy_sync_service_js_1.SellerpunditPolicySyncService,
            sellerpundit_listing_adapter_js_1.SellerpunditListingAdapter,
            sellerpundit_marketplace_registry_js_1.SellerpunditMarketplaceRegistry,
        ],
    })
], SellerpunditModule);
//# sourceMappingURL=sellerpundit.module.js.map