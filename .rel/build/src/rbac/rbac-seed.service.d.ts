import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Organization } from '../auth/entities/organization.entity.js';
import { OrganizationMember } from '../auth/entities/organization-member.entity.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from './rbac.service.js';
export declare class RbacSeedService {
    private readonly userRepo;
    private readonly orgRepo;
    private readonly memberRepo;
    private readonly rbac;
    private readonly config;
    private readonly logger;
    constructor(userRepo: Repository<User>, orgRepo: Repository<Organization>, memberRepo: Repository<OrganizationMember>, rbac: RbacService, config: ConfigService);
    seedDemoUsers(): Promise<void>;
    private ensureDefaultWorkspace;
    private shouldSeedDemoUsers;
}
