import { User } from '../../auth/entities/user.entity.js';
import { ConnectPartsBazar360Dto } from './partsbazar360.dto.js';
import { PartsBazar360Service } from './partsbazar360.service.js';
export declare class PartsBazar360Controller {
    private readonly partsbazar;
    constructor(partsbazar: PartsBazar360Service);
    status(): Promise<{
        configured: boolean;
        apiUrl: string;
        stores: {
            storeId: string;
            connectionId: string;
            storeName: string;
            sellerStoreId: string | null;
            status: "active" | "suspended" | "paused" | "archived";
        }[];
    }>;
    connect(dto: ConnectPartsBazar360Dto, user: User): Promise<{
        connectionId: string;
        storeId: string;
        seller: {
            id: string;
            name: string;
        } | null;
    }>;
    refresh(listingId: string): Promise<{
        storeId: string;
        status: "error" | "synced" | "draft" | "pending" | "publishing" | "ended";
        externalId: string | null;
        externalUrl: string | null;
        lastError: string | null;
    }[]>;
}
