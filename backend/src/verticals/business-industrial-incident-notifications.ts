import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class BusinessIndustrialIncidentNotifications {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly rbac: RbacService,
    @InjectRepository(OrganizationMember)
    private readonly members: Repository<OrganizationMember>,
  ) {}

  @OnEvent('business-industrial.incident')
  async onIncident(data: {
    organizationId: string;
    incidentId?: string;
    productId?: string;
    status?: string;
    notifyVerticalAdministrators?: boolean;
  }) {
    if (!data.notifyVerticalAdministrators) return;
    const members = await this.members.find({
      where: { organizationId: data.organizationId },
    });
    await Promise.all(
      members.map(async (member) => {
        if (
          !(await this.rbac.userHasPermission(
            member.userId,
            'business_industrial.incidents.view',
          ))
        )
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
      }),
    );
  }
}
