import { User } from '../../auth/entities/user.entity.js';
import { Store } from './store.entity.js';
export type StoreAccessLevel = 'view' | 'operate' | 'admin';
export declare class UserStoreAssignment {
    id: string;
    userId: string;
    user: User;
    storeId: string;
    store: Store;
    accessLevel: StoreAccessLevel;
    createdAt: Date;
}
