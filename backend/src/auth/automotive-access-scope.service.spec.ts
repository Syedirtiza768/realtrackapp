import { ConfigService } from '@nestjs/config';
import { AutomotiveAccessScopeService } from './automotive-access-scope.service.js';
import { UserOrganizationService } from './user-organization.service.js';

const user = { id: 'user-1' } as any;

describe('AutomotiveAccessScopeService', () => {
  it('does not expose legacy NULL rows to users outside the legacy organization', async () => {
    const organizations = {
      listForUser: jest.fn().mockResolvedValue([
        {
          organizationId: 'org-other',
          name: 'Other',
          slug: 'other',
          role: 'owner',
        },
      ]),
    } as unknown as UserOrganizationService;
    const config = {
      get: jest.fn().mockReturnValue('org-legacy'),
    } as unknown as ConfigService;
    const service = new AutomotiveAccessScopeService(organizations, config);

    const filter = await service.buildFilter(user, 'p');

    expect(filter?.sql).not.toContain('organizationId IS NULL');
    expect(filter?.params.automotiveOrganizationIds).toEqual(['org-other']);
    expect(filter?.params.automotiveVertical).toBe('automotive');
  });

  it('allows legacy NULL rows only for a member of the configured legacy organization', async () => {
    const organizations = {
      listForUser: jest.fn().mockResolvedValue([
        {
          organizationId: 'org-legacy',
          name: 'Legacy',
          slug: 'legacy',
          role: 'member',
        },
      ]),
    } as unknown as UserOrganizationService;
    const config = {
      get: jest.fn().mockReturnValue('org-legacy'),
    } as unknown as ConfigService;
    const service = new AutomotiveAccessScopeService(organizations, config);

    const filter = await service.buildFilter(user, 'r');

    expect(filter?.sql).toContain('organizationId IS NULL');
  });

  it('writes new automotive rows to the configured legacy organization when authorized', async () => {
    const organizations = {
      listForUser: jest.fn().mockResolvedValue([
        {
          organizationId: 'org-legacy',
          name: 'Legacy',
          slug: 'legacy',
          role: 'owner',
        },
      ]),
      resolveOrganizationId: jest.fn(),
    } as unknown as UserOrganizationService;
    const config = {
      get: jest.fn().mockReturnValue('org-legacy'),
    } as unknown as ConfigService;
    const service = new AutomotiveAccessScopeService(organizations, config);

    await expect(service.resolveWriteOrganizationId(user)).resolves.toBe(
      'org-legacy',
    );
    expect((organizations as any).resolveOrganizationId).not.toHaveBeenCalled();
  });
});
