import { Repository } from 'typeorm';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
export declare class BusinessIndustrialIncidentNotifications {
    private readonly notifications;
    private readonly rbac;
    private readonly members;
    constructor(notifications: NotificationsService, rbac: RbacService, members: Repository<OrganizationMember>);
    onIncident(data: {
        organizationId: string;
        incidentId?: string;
        productId?: string;
        status?: string;
        notifyVerticalAdministrators?: boolean;
    }): Promise<void>;
}
