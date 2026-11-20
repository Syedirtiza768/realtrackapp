import { ConfigService } from '@nestjs/config';
export interface WebImageResult {
    url: string;
    thumbnailUrl: string;
    title: string;
    source: string;
    hostPage: string;
    width: number;
    height: number;
    format: string;
}
export declare class ImageSearchService {
    private readonly config;
    private readonly logger;
    private readonly bingKey;
    private readonly bingEndpoint;
    private readonly googleKey;
    private readonly googleCx;
    constructor(config: ConfigService);
    search(queries: string[], options?: {
        maxPerQuery?: number;
        minWidth?: number;
    }): Promise<WebImageResult[]>;
    private searchBing;
    private searchGoogle;
    private generateOemCatalogUrls;
    private inferFormat;
}
