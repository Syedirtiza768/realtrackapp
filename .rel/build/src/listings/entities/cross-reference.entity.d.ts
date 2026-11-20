import { MasterProduct } from './master-product.entity.js';
export declare class CrossReference {
    id: string;
    masterProductId: string;
    masterProduct: MasterProduct;
    partNumber: string;
    brand: string | null;
    referenceType: 'oem' | 'interchange' | 'competitor' | 'superseded' | 'alternate';
    notes: string | null;
    source: string;
    createdAt: Date;
}
