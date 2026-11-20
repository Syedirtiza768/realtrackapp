import { Store } from '../../../channels/entities/store.entity.js';
export declare class EbayHostedImage {
    id: string;
    storeId: string;
    store: Store;
    sourceUrl: string;
    hostedUrl: string;
    imageId: string | null;
    expirationDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
