import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity.js';
import { OrganizationMember, type OrgRole } from './entities/organization-member.entity.js';
import { User } from './entities/user.entity.js';
export type UserOrganizationSummary = {
    organizationId: string;
    name: string;
    slug: string;
    role: OrgRole;
};
export declare class UserOrganizationService {
    private readonly orgRepo;
    private readonly memberRepo;
    private readonly userRepo;
    constructor(orgRepo: Repository<Organization>, memberRepo: Repository<OrganizationMember>, userRepo: Repository<User>);
    listForUser(userId: string): Promise<UserOrganizationSummary[]>;
    ensureDefaultForUser(userId: string): Promise<UserOrganizationSummary>;
    resolveOrganizationId(userId: string, organizationId?: string | null): Promise<{
        organizationId: string;
        member: OrganizationMember;
    }>;
    getWorkspaceContext(userId: string): Promise<{
        organizationId: string;
        organizationName: string;
        organizations: UserOrganizationSummary[];
    }>;
}
