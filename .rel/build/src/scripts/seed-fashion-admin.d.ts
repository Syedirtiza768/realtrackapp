import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
import { UserRoleAssignment } from '../rbac/entities/user-role-assignment.entity.js';
export declare function provisionFashionAdminUser(users: Repository<User>, assignments: Repository<UserRoleAssignment>, rbac: RbacService, options: {
    email: string;
    password?: string;
    name: string;
    requirePasswordChange: boolean;
}): Promise<{
    user: User;
    createdUser: boolean;
}>;
