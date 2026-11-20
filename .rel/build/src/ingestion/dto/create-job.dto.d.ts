export declare class CreateJobDto {
    mode: 'single' | 'bulk' | 'bundle';
    assetIds: string[];
    source?: 'upload' | 'camera' | 'url' | 'api';
    preferredProvider?: 'openai' | 'google';
}
