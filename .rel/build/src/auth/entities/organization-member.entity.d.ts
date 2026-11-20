import { Organization } from './organization.entity.js';
import { User } from './user.entity.js';
export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';
export declare class OrganizationMember {
    id: string;
    organizationId: string;
    organization: Organization;
    userId: string;
    user: User;
    role: OrgRole;
    createdAt: Date;
}
