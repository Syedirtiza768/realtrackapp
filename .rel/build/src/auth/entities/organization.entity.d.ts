import { OrganizationMember } from './organization-member.entity.js';
export declare class Organization {
    id: string;
    name: string;
    slug: string;
    plan: string;
    listingLimit: number | null;
    connectionLimit: number | null;
    memberLimit: number | null;
    status: 'active' | 'suspended' | 'cancelled';
    settings: Record<string, unknown>;
    members: OrganizationMember[];
    createdAt: Date;
    updatedAt: Date;
}
