import { Organization } from '../../../auth/entities/organization.entity.js';
export declare class InternalStore {
    id: string;
    organizationId: string;
    organization: Organization;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
}
