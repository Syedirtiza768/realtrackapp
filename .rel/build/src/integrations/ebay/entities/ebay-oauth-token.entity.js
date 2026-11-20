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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayOAuthToken = void 0;
const typeorm_1 = require("typeorm");
const connected_ebay_account_entity_js_1 = require("./connected-ebay-account.entity.js");
let EbayOAuthToken = class EbayOAuthToken {
    id;
    ebayAccountId;
    ebayAccount;
    accessTokenEncrypted;
    accessTokenExpiresAt;
    refreshTokenEncrypted;
    refreshTokenExpiresAt;
    grantedScopes;
    lastRefreshedAt;
    revokedAt;
    reconnectRequired;
    createdAt;
    updatedAt;
};
exports.EbayOAuthToken = EbayOAuthToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EbayOAuthToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ebay_account_id', type: 'uuid', unique: true }),
    __metadata("design:type", String)
], EbayOAuthToken.prototype, "ebayAccountId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => connected_ebay_account_entity_js_1.ConnectedEbayAccount, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ebay_account_id' }),
    __metadata("design:type", connected_ebay_account_entity_js_1.ConnectedEbayAccount)
], EbayOAuthToken.prototype, "ebayAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'access_token_encrypted', type: 'text' }),
    __metadata("design:type", String)
], EbayOAuthToken.prototype, "accessTokenEncrypted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'access_token_expires_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayOAuthToken.prototype, "accessTokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refresh_token_encrypted', type: 'text' }),
    __metadata("design:type", String)
], EbayOAuthToken.prototype, "refreshTokenEncrypted", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'refresh_token_expires_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Object)
], EbayOAuthToken.prototype, "refreshTokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'granted_scopes', type: 'jsonb', default: () => `'[]'` }),
    __metadata("design:type", Array)
], EbayOAuthToken.prototype, "grantedScopes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayOAuthToken.prototype, "lastRefreshedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'revoked_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], EbayOAuthToken.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reconnect_required', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], EbayOAuthToken.prototype, "reconnectRequired", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayOAuthToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], EbayOAuthToken.prototype, "updatedAt", void 0);
exports.EbayOAuthToken = EbayOAuthToken = __decorate([
    (0, typeorm_1.Entity)('ebay_oauth_tokens')
], EbayOAuthToken);
//# sourceMappingURL=ebay-oauth-token.entity.js.map