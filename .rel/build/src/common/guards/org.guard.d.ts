import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { OrganizationMember } from '../../auth/entities/organization-member.entity.js';
import { FeatureFlag } from '../feature-flags/feature-flag.entity.js';
export declare const ORG_ROLES_KEY = "org_roles";
export declare class OrgGuard implements CanActivate {
    private readonly reflector;
    private readonly memberRepo;
    private readonly flagRepo;
    private readonly logger;
    constructor(reflector: Reflector, memberRepo: Repository<OrganizationMember>, flagRepo: Repository<FeatureFlag>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
