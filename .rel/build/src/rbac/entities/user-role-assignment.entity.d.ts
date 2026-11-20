import { User } from '../../auth/entities/user.entity.js';
import { Role } from './role.entity.js';
export declare class UserRoleAssignment {
    id: string;
    userId: string;
    roleId: string;
    isPrimary: boolean;
    user: User;
    role: Role;
    createdAt: Date;
}
