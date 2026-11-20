import { EbayMvlRelease } from './ebay-mvl-release.entity.js';
export declare class EbayMvlEntry {
    id: string;
    releaseId: string;
    release?: EbayMvlRelease;
    marketplace: string;
    epid: string | null;
    make: string;
    model: string;
    year: number;
    trim: string | null;
    engine: string | null;
    submodel: string | null;
    variant: string | null;
    platform: string | null;
    body: string | null;
    ktype: string | null;
    displayName: string | null;
    extras: Record<string, unknown> | null;
}
