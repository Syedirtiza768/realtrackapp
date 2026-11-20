import { User } from '../auth/entities/user.entity.js';
import { StoreAccessService } from './store-access.service.js';
import { type StoreAccessLevel } from './entities/user-store-assignment.entity.js';
declare class SetAssignmentDto {
    userId: string;
    storeId: string;
    accessLevel: StoreAccessLevel;
}
export declare class StoreAccessController {
    private readonly storeAccess;
    constructor(storeAccess: StoreAccessService);
    getUserAssignments(userId: string): Promise<{
        assignments: import("./entities/user-store-assignment.entity.js").UserStoreAssignment[];
    }>;
    assign(dto: SetAssignmentDto, user: User): Promise<{
        assignment: import("./entities/user-store-assignment.entity.js").UserStoreAssignment;
    }>;
    unassign(userId: string, storeId: string, user: User): Promise<{
        success: boolean;
    }>;
    updateAssignment(userId: string, storeId: string, dto: {
        accessLevel: StoreAccessLevel;
    }, user: User): Promise<{
        assignment: import("./entities/user-store-assignment.entity.js").UserStoreAssignment;
    }>;
    setAccessAll(userId: string, dto: {
        enabled: boolean;
    }): Promise<{
        success: boolean;
    }>;
}
export {};
