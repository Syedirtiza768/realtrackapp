import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { FashionImageBannerDto, FashionSizeChartDto } from './fashion.dto.js';
export declare class FashionIntakeImagesService {
    private readonly userOrgs;
    private readonly storage;
    constructor(userOrgs: UserOrganizationService, storage: StorageService);
    sizeChart(user: User, dto: FashionSizeChartDto, organizationId?: string): Promise<{
        url: string;
        s3Key: string;
    }>;
    banner(user: User, dto: FashionImageBannerDto, organizationId?: string): Promise<{
        url: string;
        s3Key: string;
    }>;
}
export declare function buildSizeChartSvg(dto: FashionSizeChartDto): string;
