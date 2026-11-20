import { FeatureFlagService } from './feature-flag.service.js';
export declare class FeatureFlagController {
    private readonly flagService;
    constructor(flagService: FeatureFlagService);
    list(): Promise<import("./feature-flag.entity.js").FeatureFlag[]>;
    get(key: string): Promise<import("./feature-flag.entity.js").FeatureFlag>;
    update(key: string, body: {
        enabled: boolean;
    }): Promise<import("./feature-flag.entity.js").FeatureFlag>;
    toggle(key: string): Promise<import("./feature-flag.entity.js").FeatureFlag>;
}
