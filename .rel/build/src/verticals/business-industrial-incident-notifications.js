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
exports.BusinessIndustrialIncidentNotifications = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const notifications_service_js_1 = require("../notifications/notifications.service.js");
let BusinessIndustrialIncidentNotifications = class BusinessIndustrialIncidentNotifications {
    notifications;
    rbac;
    members;
    constructor(notifications, rbac, members) {
        this.notifications = notifications;
        this.rbac = rbac;
        this.members = members;
    }
    async onIncident(data) {
        if (!data.notifyVerticalAdministrators)
            return;
        const members = await this.members.find({
            where: { organizationId: data.organizationId },
        });
        await Promise.all(members.map(async (member) => {
            if (!(await this.rbac.userHasPermission(member.userId, 'business_industrial.incidents.view')))
                return;
            await this.notifications.create({
                recipientId: member.userId,
                type: 'business_industrial_incident',
                title: 'Business & Industrial enforcement incident',
                body: `A verified B&I incident quarantined product ${data.productId ?? 'unknown'} locally (${data.status ?? 'quarantined'}).`,
                severity: 'error',
                entityType: 'business_industrial_incident',
                entityId: data.incidentId ?? data.productId,
                actionUrl: '/business-industrial/incidents',
            });
        }));
    }
};
exports.BusinessIndustrialIncidentNotifications = BusinessIndustrialIncidentNotifications;
__decorate([
    (0, event_emitter_1.OnEvent)('business-industrial.incident'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BusinessIndustrialIncidentNotifications.prototype, "onIncident", null);
exports.BusinessIndustrialIncidentNotifications = BusinessIndustrialIncidentNotifications = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(organization_member_entity_js_1.OrganizationMember)),
    __metadata("design:paramtypes", [notifications_service_js_1.NotificationsService,
        rbac_service_js_1.RbacService,
        typeorm_2.Repository])
], BusinessIndustrialIncidentNotifications);
//# sourceMappingURL=business-industrial-incident-notifications.js.map