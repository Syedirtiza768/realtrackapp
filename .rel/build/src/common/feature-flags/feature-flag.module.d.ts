import { OnModuleInit } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
export declare class FeatureFlagModule implements OnModuleInit {
    private readonly flagService;
    constructor(flagService: FeatureFlagService);
    onModuleInit(): Promise<void>;
}
